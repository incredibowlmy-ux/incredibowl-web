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
/** 30 → 200（2026-09-07 收件箱要看完整线程；600 字 × 200 = 120KB，远低于 Firestore 1MB；提示词只取最近 12 条）。 */
export const TURNS_MAX = 200;
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

// ────────────────────────────────────────────────────────────
// 出站回执（statuses）与模板审核事件
// ────────────────────────────────────────────────────────────
export interface StatusEvent {
  /** 收件人号码（纯数字）。 */
  recipient: string;
  /** 出站消息的 wamid。 */
  msgId: string;
  status: TurnStatus;
  ts: number;
  errCode?: number;
  errTitle?: string;
  errDetails?: string;
}

/**
 * 从 webhook payload 里拆出出站回执。
 * v4 上线时这一整类事件是被 splitInbound 直接丢掉的 —— 收件箱因此没有任何送达/已读信号，
 * 更糟的是**发送失败也静默**（Meta 只在 statuses 里报 failed，发送 API 那一刻是 200）。
 */
export function splitStatuses(payload: any): StatusEvent[] {
  const out: StatusEvent[] = [];
  if (!payload || payload.object !== 'whatsapp_business_account') return out;
  const entries: any[] = Array.isArray(payload.entry) ? payload.entry : [];
  for (const entry of entries) {
    const changes: any[] = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const ch of changes) {
      if (ch?.field && ch.field !== 'messages') continue;
      const sts: any[] = Array.isArray(ch?.value?.statuses) ? ch.value.statuses : [];
      for (const s of sts) {
        const status = String(s?.status || '');
        const msgId = String(s?.id || '');
        const recipient = String(s?.recipient_id || '').replace(/\D/g, '');
        if (!msgId || !recipient || !(TURN_STATUSES as readonly string[]).includes(status)) continue;
        const e = Array.isArray(s?.errors) ? s.errors[0] : null;
        const ev: StatusEvent = { recipient, msgId, status: status as TurnStatus, ts: (Number(s?.timestamp) || 0) * 1000 };
        if (e) {
          if (Number(e.code)) ev.errCode = Number(e.code);
          if (e.title) ev.errTitle = String(e.title).slice(0, 160);
          if (e.error_data?.details) ev.errDetails = String(e.error_data.details).slice(0, 200);
        }
        out.push(ev);
      }
    }
  }
  return out;
}

/** Meta 常见发送失败码 → 人话。查不到的原样回 title。 */
export function describeSendError(ev: Pick<StatusEvent, 'errCode' | 'errTitle' | 'errDetails'>): string {
  const known: Record<number, string> = {
    131047: '24 小时窗口已过，只能发模板',
    131026: '对方不是 WhatsApp 用户或没法收（可能拉黑了）',
    131049: 'Meta 限流：为了健康度暂时不投递这条营销消息',
    130472: '对方在 Meta 的实验分组里，这条不投递',
    131000: 'Meta 内部错误，可重试',
    131053: '媒体上传失败（链接不可达或格式不支持）',
    132000: '模板参数数量对不上',
    132001: '模板不存在或语言不对',
    132015: '模板被停用',
    133010: '号码没注册到 Cloud API',
  };
  const base = (ev.errCode && known[ev.errCode]) || ev.errTitle || '未知错误';
  const code = ev.errCode ? `${ev.errCode} ` : '';
  return `${code}${base}${ev.errDetails ? ` — ${ev.errDetails}` : ''}`.slice(0, 120);
}

export interface TemplateEvent { name: string; event: string; reason: string; language: string }

/** 模板审核结果事件（field = message_template_status_update）。 */
export function splitTemplateEvents(payload: any): TemplateEvent[] {
  const out: TemplateEvent[] = [];
  if (!payload || payload.object !== 'whatsapp_business_account') return out;
  const entries: any[] = Array.isArray(payload.entry) ? payload.entry : [];
  for (const entry of entries) {
    const changes: any[] = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const ch of changes) {
      if (ch?.field !== 'message_template_status_update') continue;
      const v = ch?.value || {};
      out.push({
        name: String(v.message_template_name || ''),
        event: String(v.event || ''),
        reason: String(v.reason || ''),
        language: String(v.message_template_language || ''),
      });
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
export const TURN_ROLES = ['in', 'out', 'boss', 'nudge', 'sys'] as const;
export type TurnRole = typeof TURN_ROLES[number];

export const MEDIA_KINDS = ['image', 'document', 'audio', 'video'] as const;
export type MediaKind = typeof MEDIA_KINDS[number];
export interface TurnMedia { kind: MediaKind; id?: string; link?: string; mime?: string; filename?: string }

/** Meta 的出站回执状态。排序见 STATUS_RANK —— 只能往前走，不能倒退。 */
export const TURN_STATUSES = ['sent', 'delivered', 'read', 'failed'] as const;
export type TurnStatus = typeof TURN_STATUSES[number];
const STATUS_RANK: Record<TurnStatus, number> = { sent: 1, delivered: 2, read: 3, failed: 4 };

export interface Turn {
  role: TurnRole;
  text: string;
  ts: number;
  /** Meta 的 wamid：出站是发送响应里的 id，入站是 msg.id。回执靠它对上号。 */
  msgId?: string;
  /** 只有出站 turn 有：sent → delivered → read，或 failed。 */
  status?: TurnStatus;
  statusAtMs?: number;
  /** failed 时 Meta 给的原因（已转成人话，≤120 字）。 */
  err?: string;
  media?: TurnMedia;
  /** 引用回复：被引用那条的 wamid。 */
  replyTo?: string;
}

/** appendTurn 的第 5 个参数：只有这些 key 会被收下，其余一律丢弃。 */
export interface TurnExtra { msgId?: string; status?: TurnStatus; statusAtMs?: number; err?: string; media?: TurnMedia; replyTo?: string }

function cleanMedia(m: unknown): TurnMedia | undefined {
  if (!m || typeof m !== 'object') return undefined;
  const x = m as Record<string, unknown>;
  const kind = String(x.kind || '');
  if (!(MEDIA_KINDS as readonly string[]).includes(kind)) return undefined;
  const out: TurnMedia = { kind: kind as MediaKind };
  // Firestore 拒收 undefined —— 所有可选字段都只在有值时才写进对象。
  if (x.id) out.id = String(x.id).slice(0, 200);
  if (x.link) out.link = String(x.link).slice(0, 600);
  if (x.mime) out.mime = String(x.mime).slice(0, 100);
  if (x.filename) out.filename = String(x.filename).slice(0, 120);
  return out;
}

/** 把任意来源的一条 turn 洗成合法形状（丢 undefined、截断、白名单 role/status）。 */
function cleanTurn(t: any): Turn {
  const out: Turn = {
    role: ((TURN_ROLES as readonly string[]).includes(t.role) ? t.role : 'sys') as TurnRole,
    text: String(t.text).slice(0, TURN_TEXT_MAX),
    ts: Number(t.ts) || 0,
  };
  if (t.msgId) out.msgId = String(t.msgId).slice(0, 200);
  if ((TURN_STATUSES as readonly string[]).includes(t.status)) out.status = t.status as TurnStatus;
  if (Number(t.statusAtMs)) out.statusAtMs = Number(t.statusAtMs);
  if (t.err) out.err = String(t.err).slice(0, 120);
  const media = cleanMedia(t.media);
  if (media) out.media = media;
  if (t.replyTo) out.replyTo = String(t.replyTo).slice(0, 200);
  return out;
}

/**
 * 追加一条 turn，超长截断、超量只留最近 TURNS_MAX 条。返回新数组（不改入参）。
 * `extra` 里的 msgId / media / replyTo 等可选字段会被保留 —— 清洗历史数组时也保留，
 * 否则每写一条新消息就会把老消息的回执状态洗掉。
 */
export function appendTurn(prev: unknown, role: TurnRole, text: string, ts: number, extra?: TurnExtra): Turn[] {
  const base: Turn[] = Array.isArray(prev)
    ? prev.filter((t: any) => t && typeof t.text === 'string').map(cleanTurn)
    : [];
  const clean = String(text || '').trim().slice(0, TURN_TEXT_MAX);
  if (!clean) return base.slice(-TURNS_MAX);
  const next = cleanTurn({ ...(extra || {}), role, text: clean, ts });
  return [...base, next].slice(-TURNS_MAX);
}

/**
 * 把一条回执盖到对应的 turn 上。找不到 msgId 或状态会倒退 → **返回原数组引用**
 * （调用方靠 `next === prev` 判断「不用写库」，省掉 Meta 重发回执带来的无谓写入）。
 */
export function applyStatus(turns: unknown, msgId: string, status: string, err: string | undefined, now: number): Turn[] {
  const arr = Array.isArray(turns) ? turns as Turn[] : [];
  if (!msgId || !(TURN_STATUSES as readonly string[]).includes(status)) return arr;
  const next = status as TurnStatus;
  const idx = arr.map((t, i) => (t && t.msgId === msgId ? i : -1)).filter(i => i >= 0).pop();
  if (idx === undefined) return arr;
  const cur = arr[idx];
  const curRank = cur.status ? STATUS_RANK[cur.status] : 0;
  if (STATUS_RANK[next] <= curRank) return arr;
  const patched = cleanTurn({ ...cur, status: next, statusAtMs: now, ...(err ? { err: String(err) } : {}) });
  const out = arr.map(cleanTurn);
  out[idx] = patched;
  return out;
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

/** 入站消息里的媒体（有就返回，没有返回 undefined）。id 之后用 /api/admin/wa-media 换真文件。 */
export function mediaOfInbound(msg: Record<string, any>): TurnMedia | undefined {
  const type = String(msg?.type || '');
  if (!(MEDIA_KINDS as readonly string[]).includes(type)) return undefined;
  const m = msg?.[type];
  if (!m || typeof m !== 'object') return undefined;
  return cleanMedia({ kind: type, id: m.id, mime: m.mime_type, filename: m.filename });
}

/** 入站消息引用了哪条（客户长按回复）。没有返回 undefined。 */
export function replyToOfInbound(msg: Record<string, any>): string | undefined {
  const id = msg?.context?.id;
  return id ? String(id).slice(0, 200) : undefined;
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
// 群发退订（STOP / START）
// ────────────────────────────────────────────────────────────
/**
 * 客户回 STOP 退订群发、START 重新订阅。返回 null = 不是退订指令。
 *
 * 为什么必须在 relay 这一层认、而不是交给 AI 判断：营销模板正文里白纸黑字写着
 * "Reply STOP anytime to unsubscribe"，这是对客户的承诺，也是 Meta 政策要求。
 * 交给 AI 意味着某次它答歪了就等于失信 —— 这种事只能用确定性规则。
 *
 * 刻意只认「整条消息就是这个词」：客户说 "don't stop sending" 不该被退订。
 */
export function parseOptOut(text: unknown): 'stop' | 'start' | null {
  const t = String(text || '').trim().toLowerCase().replace(/[.!。！]+$/, '');
  if (!t) return null;
  if (/^(stop|unsubscribe|退订|停止发送|取消订阅)$/.test(t)) return 'stop';
  if (/^(start|subscribe|订阅|重新订阅)$/.test(t)) return 'start';
  return null;
}

/** 退订/订阅的固定回执（双语一条，不走 AI）。 */
export function optOutReply(kind: 'stop' | 'start'): string {
  return kind === 'stop'
    ? '已帮你退订每周菜单群发 ✅ 你随时可以回复 START 重新订阅。有需要下单还是可以直接找碗妈聊 😊\n\nYou\'ve been unsubscribed from our weekly menu broadcast. Reply START anytime to resubscribe.'
    : '好的，已重新订阅每周菜单 🎉 每周会收到一次下周菜单。\n\nYou\'re subscribed to our weekly menu again. Reply STOP anytime to opt out.';
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
