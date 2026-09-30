/**
 * 碗妈收件箱的共用逻辑：列表行怎么从一份 waLeads 文档算出来、怎么安全地改一份 lead。
 *
 * 纯函数（leadRow）不碰 Firestore，dogfood 直接喂假文档；mutateLead 是唯一带 IO 的。
 */
import { windowRemainingMs } from '@/lib/waSend';

export interface InboxRow {
  phone: string;
  name: string;
  status: string;
  lang: string;
  human: boolean;
  humanUntil: number;
  /** 最后一条**对话**（跳过系统行）；只有系统行时退回最后一条。 */
  lastMsg: { role: string; text: string; ts: number } | null;
  /** 最后活动时间：列表排序 + 行上显示的时间。见 leadRow 的说明。 */
  activityMs: number;
  /** = activityMs。旧版 dashboard 读这个名字，留着别让它显示成空。 */
  lastMsgMs: number;
  /** 客户最后一条消息的时间（新消息提醒靠它判断「有没有新的」）。 */
  lastInMs: number;
  unread: number;
  clicked: boolean;
  nudgeCount: number;
  nudgeOff: boolean;
  tags: string[];
  windowRemainingMs: number;
  /** bot 向老板求救过（escalate / ai_down），之后老板还没在这条对话里说过话。 */
  sos: boolean;
  /** 这条对话在等老板（不是等 bot）。见 needsReplyWhy。 */
  needsReply: boolean;
  /** 'human' | 'sos' | 'media' | ''：列表 chip 的说明用。 */
  needsWhy: string;
}

/** bot 求救 / 客户发来媒体之后，多久还没人理就不再算「待回复」（那时 24h 窗口早过了，置顶只会变噪音）。 */
export const NEEDS_REPLY_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const SOS_KINDS = new Set(['escalate', 'ai_down']);
/** n8n 的 alert 里哪些 kind 算「bot 求救」（答不上来 / AI 挂了）。图片、定位、人工转发不算。 */
export const isSosKind = (kind: unknown): boolean => SOS_KINDS.has(String(kind || ''));

/**
 * 给收件箱看的状态。已关闭之后客户又来了消息 → 当作重新进行中。
 * 库里的 status 只有 n8n 文字路线的 touch 会改回 engaged；客户发图片 / 语音 / 定位、或人工接管期间来消息
 * 都不经过 touch，对话会一直停在「已关闭」里没人看。这里只改显示，不写库、不影响 bot 的新一轮判断。
 */
export function effectiveStatus(x: Record<string, any>): string {
  const status = String(x?.status || 'engaged');
  if (status !== 'closed') return status;
  const closedAt = Number(x?.closedAtMs) || 0;
  const turns: any[] = Array.isArray(x?.turns) ? x.turns : [];
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (t && t.role === 'in') return closedAt > 0 && (Number(t.ts) || 0) > closedAt ? 'engaged' : status;
  }
  return status;
}

/**
 * 这条对话是不是在等**老板本人**回。只认三种确定的情形：
 *   human  人工接管中（bot 已静音）而客户说了最后一句 —— 只有老板能回
 *   sos    bot 求救过（答不上来 / AI 挂了），之后老板没说过话
 *   media  老板最后一次说话之后，客户发来过图片 / 文件 / 语音 / 视频（多半是付款截图）。
 *          看的是「之后有没有」，不是「最后一条是不是」：客户发完截图紧跟一句「已转账」很常见，不能被那句文字冲掉。
 *
 * 故意**不**把「bot 接待中、客户说了最后一句文字」算进来：n8n 的开场白、图片自动回复等
 * 没有记进 turns，那样判断会把 bot 其实已经回过的对话全部误报成待回复。
 * 已成交 / 已关闭发生在客户最后一条消息之后 → 这件事已经了结，不算。
 */
export function needsReplyWhy(x: Record<string, any>, now: number): '' | 'human' | 'sos' | 'media' {
  const turns: any[] = Array.isArray(x?.turns) ? x.turns.filter((t: any) => t && typeof t === 'object') : [];
  let last: any = null, lastIn: any = null, lastBossTs = 0, mediaInMs = 0;
  // 从后往前，走到最后一条老板消息为止：它之前的事老板已经接过手了
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (!last && t.role !== 'sys') last = t;
    if (t.role === 'boss') { lastBossTs = Number(t.ts) || 0; break; }
    if (t.role === 'in') {
      if (!lastIn) lastIn = t;
      if (!mediaInMs && t.media) mediaInMs = Number(t.ts) || 0;
    }
  }
  const lastInMs = lastIn ? Number(lastIn.ts) || 0 : 0;
  const settled = (x?.status === 'ordered' || x?.status === 'closed') && (Number(x?.closedAtMs) || 0) >= lastInMs;
  if (settled) return '';
  if ((Number(x?.humanUntil) || 0) > now && last?.role === 'in') return 'human';
  const alertAt = Number(x?.alertAtMs) || 0;
  if (isSosKind(x?.alertKind) && alertAt > lastBossTs && now - alertAt < NEEDS_REPLY_MAX_AGE_MS) return 'sos';
  if (mediaInMs > 0 && now - mediaInMs < NEEDS_REPLY_MAX_AGE_MS) return 'media';
  return '';
}

/**
 * 一份 waLeads 文档 → 收件箱列表的一行。
 *
 * activityMs 为什么不直接用文档的 lastMsgMs：那个字段只有 n8n 的 touch（客户文字路线）
 * 和老板发消息会写，客户发图片 / 语音 / 人工接管期间的消息都不更新它 —— 2026-09-30 实查
 * 26 条对话里 8 条的最新消息比 lastMsgMs 新，它们在列表里不冒顶。turns 才是完整的事实。
 * lastMsgMs 本身的语义（追单窗口锚点）不动。
 */
export function leadRow(id: string, x: Record<string, any>, now: number): InboxRow {
  const turns: any[] = Array.isArray(x?.turns) ? x.turns.filter((t: any) => t && typeof t === 'object') : [];
  let last: any = null;
  let lastInMs = 0;
  for (let i = turns.length - 1; i >= 0 && (!last || !lastInMs); i--) {
    const t = turns[i];
    if (!last && t.role !== 'sys') last = t;
    if (!lastInMs && t.role === 'in') lastInMs = Number(t.ts) || 0;
  }
  const preview = last || turns[turns.length - 1] || null;
  const readAt = Number(x?.bossReadAtMs) || 0;
  const profile = (x?.profile && typeof x.profile === 'object') ? x.profile : {};
  const activityMs = Math.max(Number(x?.lastMsgMs) || 0, last ? Number(last.ts) || 0 : 0);
  const needsWhy = needsReplyWhy(x, now);
  return {
    phone: id,
    name: String(x?.name || profile.nickname || ''),
    status: effectiveStatus(x),
    lang: String(x?.lang || ''),
    human: (Number(x?.humanUntil) || 0) > now,
    humanUntil: Number(x?.humanUntil) || 0,
    lastMsg: preview ? { role: String(preview.role || ''), text: String(preview.text || '').slice(0, 120), ts: Number(preview.ts) || 0 } : null,
    activityMs,
    lastMsgMs: activityMs,
    lastInMs,
    unread: turns.filter(t => t.role === 'in' && Number(t.ts) > readAt).length,
    clicked: !!x?.clickedAtMs,
    nudgeCount: Number(x?.nudgeCount) || 0,
    nudgeOff: x?.nudgeOff === true,
    tags: Array.isArray(profile.tags) ? profile.tags : [],
    windowRemainingMs: windowRemainingMs(turns, now),
    sos: needsWhy === 'sos',
    needsReply: needsWhy !== '',
    needsWhy,
  };
}

/** 一批文档 → 排好序的列表行（没有任何对话活动的文档不出现，例如老板自己号码的去重记录）。 */
export function inboxRows(docs: Array<{ id: string; data: Record<string, any> }>, now: number, limit = 400): InboxRow[] {
  return docs
    .map(d => leadRow(d.id, d.data, now))
    .filter(r => r.activityMs > 0)
    .sort((a, b) => b.activityMs - a.activityMs)
    .slice(0, limit);
}

/**
 * 事务内重读 lead → 算 patch → 合并写回。凡是要追加 turns / 合并 profile 的写入都走这里。
 *
 * 以前是「请求开头读一次、最后把整个数组写回」：中间客户来一条消息（webhook 写 turns），
 * 就被这边的旧数组盖掉 —— 线程里和 bot 记忆里都没了，也不计未读。老板和客户实时对聊时最容易撞上。
 * build 回 null = 这次不用写。事务可能重跑，build 必须无副作用。
 */
export async function mutateLead(
  ref: FirebaseFirestore.DocumentReference,
  build: (cur: Record<string, any>, exists: boolean) => Record<string, any> | null,
): Promise<void> {
  await ref.firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const patch = build((snap.exists ? snap.data() : {}) as Record<string, any>, snap.exists);
    if (patch) tx.set(ref, patch, { merge: true });
  });
}
