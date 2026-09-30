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
  return {
    phone: id,
    name: String(x?.name || profile.nickname || ''),
    status: String(x?.status || 'engaged'),
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
