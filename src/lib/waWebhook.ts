/**
 * waWebhook.ts —— Meta WhatsApp webhook 进入层的**纯函数**（无 IO，可单测）。
 *
 * v4 把「消息进入」从 n8n 挪到 Vercel：Meta → /api/wa/webhook → 逐条转 n8n。
 * 这里放的是所有能脱离网络/Firestore 验证的判断：
 *   · 验签（X-Hub-Signature-256 = HMAC-SHA256(App Secret, raw body)）
 *   · 拆包（一个 webhook 里可能有多个 entry / changes / messages；statuses 事件直接丢）
 *   · 每条消息的处置决定（去重 / 限流 / 人工接管），输入是 lead 文档的一小片状态
 *
 * 为什么必须是纯函数：这一层错一次就是「客户消息静默消失」或「同一条回两遍」，
 * 而它又站在 Meta 和 n8n 中间，线上出事没有 UI 可看。scripts/dogfood-wa-webhook.mts
 * 用固定输入把每条规则钉死。
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 同一号码一个 MYT 小时内最多转发多少条给 AI。超过 = 刷 bot（老板号码豁免）。 */
export const RATE_LIMIT_PER_HOUR = 30;
/** seenMsgIds 保留多少个最近 message id 做去重。Meta 重试通常在几分钟内，50 个足够。 */
export const SEEN_IDS_MAX = 50;
/** 对话记录（turns）每个客户最多保留多少条。 */
export const TURNS_MAX = 30;
/** 单条 turn 文本上限。 */
export const TURN_TEXT_MAX = 600;

// ────────────────────────────────────────────────────────────
// 验签
// ────────────────────────────────────────────────────────────
/**
 * Meta 的签名头形如 `sha256=<hex>`，对**原始 body 字节**算 HMAC-SHA256。
 * 任何 JSON 重排都会让签名失效，所以调用方必须传 req.text() 的原文。
 */
export function verifyMetaSignature(rawBody: string, header: string | null | undefined, appSecret: string): boolean {
  if (!appSecret || !header) return false;
  const m = /^sha256=([0-9a-f]{64})$/i.exec(header.trim());
  if (!m) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(m[1], 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

// ────────────────────────────────────────────────────────────
// 拆包
// ────────────────────────────────────────────────────────────
export interface InboundMessage {
  entryId: string;
  metadata: Record<string, unknown>;
  /** 该消息对应的 contacts 条目（Meta 按 wa_id 对应；找不到就空数组）。 */
  contacts: Record<string, unknown>[];
  message: Record<string, any>;
  from: string;
  msgId: string;
  type: string;
  /** Meta 给的秒级时间戳（字符串）→ ms。取不到用 0。 */
  timestampMs: number;
}

/** 把一个 Meta webhook payload 拆成「每条消息一份」。statuses / 非 messages 字段一律跳过。 */
export function splitInbound(payload: any): InboundMessage[] {
  const out: InboundMessage[] = [];
  if (!payload || payload.object !== 'whatsapp_business_account') return out;
  const entries: any[] = Array.isArray(payload.entry) ? payload.entry : [];
  for (const entry of entries) {
    const changes: any[] = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const ch of changes) {
      if (ch?.field && ch.field !== 'messages') continue;
      const value = ch?.value;
      const msgs: any[] = Array.isArray(value?.messages) ? value.messages : [];
      if (!msgs.length) continue; // statuses-only 事件
      const contacts: any[] = Array.isArray(value?.contacts) ? value.contacts : [];
      for (const msg of msgs) {
        const from = String(msg?.from || '').replace(/\D/g, '');
        if (!from) continue;
        const mine = contacts.filter(c => String(c?.wa_id || '').replace(/\D/g, '') === from);
        out.push({
          entryId: String(entry?.id || ''),
          metadata: (value?.metadata && typeof value.metadata === 'object') ? value.metadata : {},
          contacts: mine.length ? mine : contacts.slice(0, 1),
          message: msg,
          from,
          msgId: String(msg?.id || ''),
          type: String(msg?.type || ''),
          timestampMs: (Number(msg?.timestamp) || 0) * 1000,
        });
      }
    }
  }
  return out;
}

export interface RelayFlags {
  relay: 'v4';
  receivedAtMs: number;
  human: boolean;
  humanUntil: number;
  throttled: boolean;
  /** 人工接管刚结束（6 小时内）—— 提示词用，让 AI 别重新自我介绍。 */
  humanEndedRecently: boolean;
}

/**
 * 还原成 Meta 原始形状（单条消息），n8n 侧 Router 完全不用改读法。
 * 额外塞一个 `value.incredibowl` 给 Router 读处置标记。
 */
export function buildSinglePayload(im: InboundMessage, flags: RelayFlags) {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      id: im.entryId,
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: im.metadata,
          contacts: im.contacts,
          messages: [im.message],
          incredibowl: flags,
        },
        field: 'messages',
      }],
    }],
  };
}

// ────────────────────────────────────────────────────────────
// 每条消息的处置决定
// ────────────────────────────────────────────────────────────
/** MYT 墙上时钟的「小时桶」，例：2026-09-06T14。 */
export function mytHourKey(ms: number): string {
  return new Date(ms + MYT_OFFSET_MS).toISOString().slice(0, 13);
}

export interface InboundState {
  seenMsgIds?: string[];
  inboundWindow?: { hourKey?: string; count?: number };
  humanUntil?: number;
  /** 上一次因限流给客户发过固定话术的小时桶（同一小时只发一次）。 */
  throttleNotifiedHourKey?: string;
}

export interface InboundDecision {
  /** 同一 message id 已处理过 → 直接丢，不转发。 */
  duplicate: boolean;
  /** 本小时已超限 → 不转发给 AI。 */
  throttled: boolean;
  /** 超限的第一条要给客户一句固定话术（后面的连话术都不发）。 */
  throttleNotify: boolean;
  human: boolean;
  humanUntil: number;
  humanEndedRecently: boolean;
  /** 要写回 lead 文档的字段（调用方在事务里 merge）。 */
  patch: Record<string, unknown>;
}

export const HUMAN_ENDED_RECENT_MS = 6 * 60 * 60 * 1000;

export function decideInbound(
  state: InboundState | null | undefined,
  im: Pick<InboundMessage, 'msgId'>,
  now: number,
  opts: { exempt?: boolean } = {},
): InboundDecision {
  const s = state || {};
  const seen: string[] = Array.isArray(s.seenMsgIds) ? s.seenMsgIds.map(String) : [];
  const patch: Record<string, unknown> = {};

  if (im.msgId && seen.includes(im.msgId)) {
    return { duplicate: true, throttled: false, throttleNotify: false, human: false, humanUntil: 0, humanEndedRecently: false, patch };
  }
  if (im.msgId) patch.seenMsgIds = [...seen, im.msgId].slice(-SEEN_IDS_MAX);

  // 限流：MYT 小时桶计数。老板号码豁免（exempt）。
  const hourKey = mytHourKey(now);
  const win = s.inboundWindow || {};
  const count = win.hourKey === hourKey ? (Number(win.count) || 0) : 0;
  const nextCount = count + 1;
  patch.inboundWindow = { hourKey, count: nextCount };
  const throttled = !opts.exempt && nextCount > RATE_LIMIT_PER_HOUR;
  const throttleNotify = throttled && s.throttleNotifiedHourKey !== hourKey;
  if (throttleNotify) patch.throttleNotifiedHourKey = hourKey;

  const humanUntil = Number(s.humanUntil) || 0;
  const human = humanUntil > now;
  const humanEndedRecently = !human && humanUntil > 0 && now - humanUntil < HUMAN_ENDED_RECENT_MS;

  return { duplicate: false, throttled, throttleNotify, human, humanUntil, humanEndedRecently, patch };
}

// ────────────────────────────────────────────────────────────
// 对话记录（turns）
// ────────────────────────────────────────────────────────────
export type TurnRole = 'in' | 'out' | 'boss' | 'nudge' | 'sys';
export interface Turn { role: TurnRole; text: string; ts: number }

/** 追加一条 turn，超长截断、超量只留最近 TURNS_MAX 条。返回新数组（不改入参）。 */
export function appendTurn(prev: unknown, role: TurnRole, text: string, ts: number): Turn[] {
  const base: Turn[] = Array.isArray(prev)
    ? prev.filter((t: any) => t && typeof t.text === 'string').map((t: any) => ({
        role: (['in', 'out', 'boss', 'nudge', 'sys'].includes(t.role) ? t.role : 'sys') as TurnRole,
        text: String(t.text).slice(0, TURN_TEXT_MAX),
        ts: Number(t.ts) || 0,
      }))
    : [];
  const clean = String(text || '').trim().slice(0, TURN_TEXT_MAX);
  if (!clean) return base.slice(-TURNS_MAX);
  return [...base, { role, text: clean, ts }].slice(-TURNS_MAX);
}

/** 入站消息 → 记进 turns 的一行文字（非文字类型给一个可读占位）。 */
export function describeInboundForTurn(msg: Record<string, any>): string {
  const type = String(msg?.type || '');
  switch (type) {
    case 'text': return String(msg?.text?.body || '');
    case 'interactive': {
      const br = msg?.interactive?.button_reply;
      const lr = msg?.interactive?.list_reply;
      return String(br?.title || lr?.title || br?.id || lr?.id || '[按钮]');
    }
    case 'image': return `[图片]${msg?.image?.caption ? ' ' + msg.image.caption : ''}`;
    case 'location': return `[定位] ${msg?.location?.name || msg?.location?.address || ''}`.trim();
    case 'audio': return '[语音]';
    case 'document': return `[文件]${msg?.document?.filename ? ' ' + msg.document.filename : ''}`;
    case 'sticker': return '[贴纸]';
    case 'reaction': return `[表情 ${msg?.reaction?.emoji || ''}]`.trim();
    case 'contacts': return '[名片]';
    default: return `[${type || '未知类型'}]`;
  }
}

/** 这些类型不值得记进对话记录，也不转发给 n8n 做任何回复。 */
export const SILENT_TYPES = new Set(['reaction', 'sticker', 'contacts', 'unsupported', 'system', 'unknown']);

/** 把 turns 渲染成进提示词的中文块（最近 n 条，带相对时间）。 */
export function renderTurnsBlock(turns: unknown, now: number, limit = 12): string {
  const arr = Array.isArray(turns) ? (turns as Turn[]).slice(-limit) : [];
  if (!arr.length) return '【最近对话】（这是这个号码的第一次对话，没有历史记录）';
  const lines = arr.map(t => {
    const who = t.role === 'in' ? '客户' : t.role === 'boss' ? '碗妈（老板亲自回）' : t.role === 'nudge' ? '碗妈（自动追单）' : t.role === 'sys' ? '系统' : '碗妈';
    return `${relativeTime(t.ts, now)} ${who}：${t.text}`;
  });
  return ['【最近对话（服务端记录，可信；越下面越新）】', ...lines].join('\n');
}

export function relativeTime(ts: number, now: number): string {
  const d = now - (Number(ts) || 0);
  if (!Number.isFinite(d) || d < 0 || !ts) return '[刚刚]';
  const min = Math.floor(d / 60000);
  if (min < 1) return '[刚刚]';
  if (min < 60) return `[${min} 分钟前]`;
  const h = Math.floor(min / 60);
  if (h < 24) return `[${h} 小时前]`;
  const day = Math.floor(h / 24);
  if (day === 1) return '[昨天]';
  if (day < 7) return `[${day} 天前]`;
  return `[${new Date(ts + MYT_OFFSET_MS).toISOString().slice(5, 10).replace('-', '/')}]`;
}

// ────────────────────────────────────────────────────────────
// 客户备注白名单（bot 只能写这几个 key）
// ────────────────────────────────────────────────────────────
export const PROFILE_KEYS = ['nickname', 'allergy', 'dropoff', 'preferredMeal', 'tag', 'note'] as const;
export type ProfileKey = typeof PROFILE_KEYS[number];
export const PROFILE_VALUE_MAX = 120;
export const PROFILE_NOTES_MAX = 10;
export const PROFILE_TAGS_MAX = 8;

/**
 * 把一条 (key, value) 合并进 profile。返回 null = 拒收（key 不在白名单 / 值空）。
 * nickname/allergy/dropoff/preferredMeal 是单值覆盖；tag/note 是列表追加（去重、封顶）。
 */
export function mergeProfileFact(prev: unknown, key: string, value: unknown): Record<string, unknown> | null {
  if (!(PROFILE_KEYS as readonly string[]).includes(key)) return null;
  const v = String(value ?? '').trim().slice(0, PROFILE_VALUE_MAX);
  if (!v) return null;
  const p: Record<string, any> = (prev && typeof prev === 'object') ? { ...(prev as Record<string, any>) } : {};
  if (key === 'preferredMeal') {
    const norm = /dinner|晚/i.test(v) ? 'dinner' : /lunch|午/i.test(v) ? 'lunch' : '';
    if (!norm) return null;
    p.preferredMeal = norm;
  } else if (key === 'tag') {
    const tags: string[] = Array.isArray(p.tags) ? p.tags.map(String) : [];
    if (!tags.includes(v)) tags.push(v);
    p.tags = tags.slice(-PROFILE_TAGS_MAX);
  } else if (key === 'note') {
    const notes: string[] = Array.isArray(p.notes) ? p.notes.map(String) : [];
    if (!notes.includes(v)) notes.push(v);
    p.notes = notes.slice(-PROFILE_NOTES_MAX);
  } else {
    p[key] = v;
  }
  return p;
}

/** profile → 进提示词的中文块；空档案返回空串（调用方决定要不要显示）。 */
export function renderProfileBlock(profile: unknown): string {
  const p = (profile && typeof profile === 'object') ? profile as Record<string, any> : {};
  const lines: string[] = [];
  if (p.nickname) lines.push(`- 称呼：${p.nickname}`);
  if (p.allergy) lines.push(`- 忌口/过敏（客户自述，仅供参考；涉及过敏一律 [求救老板]）：${p.allergy}`);
  if (p.dropoff) lines.push(`- 交接方式：${p.dropoff} —— 下单时主动问「还是${p.dropoff}吗」`);
  if (p.preferredMeal) lines.push(`- 习惯时段：${p.preferredMeal === 'dinner' ? '晚餐' : '午餐'}`);
  if (Array.isArray(p.tags) && p.tags.length) lines.push(`- 标签：${p.tags.join('、')}`);
  if (Array.isArray(p.notes) && p.notes.length) lines.push(`- 备注：${p.notes.join('；')}`);
  if (!lines.length) return '';
  return ['【客户备注】（bot 之前记下的，或老板在 dashboard 填的）', ...lines].join('\n');
}

// ────────────────────────────────────────────────────────────
// 老板指令（#pause / #resume / #status）
// ────────────────────────────────────────────────────────────
export interface BossCommand { cmd: 'pause' | 'resume' | 'status'; phone: string; minutes?: number }

/** 解析老板直发的指令；不是指令返回 null。号码必须是 60 开头的纯数字（9–12 位）。 */
export function parseBossCommand(text: string): BossCommand | null {
  // 按空白切 token：#pause 60123456789 45 / #status +60 12-345 6789
  // 最后一个 token 若是 1–3 位数字且前面还有号码 → 当分钟数；其余 token 拼成号码。
  const m = /^#\s*(pause|resume|status|暂停|恢复|状态)\s+(.+)$/i.exec(String(text || '').trim());
  if (!m) return null;
  const word = m[1].toLowerCase();
  const cmd: BossCommand['cmd'] = (word === 'pause' || word === '暂停') ? 'pause'
    : (word === 'resume' || word === '恢复') ? 'resume' : 'status';
  const tokens = m[2].trim().split(/\s+/);
  let minutes: number | undefined;
  if (cmd === 'pause' && tokens.length >= 2 && /^\d{1,3}$/.test(tokens[tokens.length - 1])) {
    minutes = Number(tokens.pop());
  }
  const phone = tokens.join('').replace(/\D/g, '');
  if (!/^60\d{8,10}$/.test(phone)) return null;
  const out: BossCommand = { cmd, phone };
  if (cmd === 'pause') out.minutes = Math.min(720, Math.max(5, minutes || 120));
  return out;
}
