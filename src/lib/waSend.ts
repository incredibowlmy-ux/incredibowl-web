/**
 * 网站直接发 WhatsApp（碗妈收件箱「回复」用）。
 *
 * 之前所有出站消息都由 n8n 的 WhatsApp 节点发；dashboard 要能像 WATI 那样在线程里
 * 直接回，就得让 Vercel 也能发。用 Meta Cloud API 最小集：一个 POST、一个 token。
 *
 * 环境变量：
 *   WA_ACCESS_TOKEN      Meta system-user 永久 token（老板提供；没配则 send* 回 configured=false）
 *   WA_PHONE_NUMBER_ID   默认 1019276584602589（碗妈号）
 *
 * 24 小时窗口：Meta 只允许在客户最后一条消息后 24h 内发自由文本，窗口外要审核过的模板。
 * 自由文本类（text / media / interactive）调用方先用 windowRemainingMs() 判定，过期就别调；
 * 模板（sendTemplate）不受窗口限制，这是窗口外唯一的路。
 *
 * 这里所有函数都不抛：网络/Meta 出错一律回 { ok:false, error }，由调用方决定怎么显示。
 * 原因是它们全在「老板正在等界面响应」或「relay 正在转发客户消息」的路径上，
 * 抛异常只会把更重要的事一起打断。
 */

export const WA_WINDOW_MS = 24 * 60 * 60 * 1000;
const GRAPH = 'https://graph.facebook.com/v20.0';
const SEND_TIMEOUT_MS = 10_000;

export function isConfigured(): boolean {
  return !!process.env.WA_ACCESS_TOKEN;
}

function phoneNumberId(): string {
  return process.env.WA_PHONE_NUMBER_ID || '1019276584602589';
}

/** turns 里最后一条客户消息的时间；没有客户消息 → 0。 */
export function lastInboundTs(turns: unknown): number {
  if (!Array.isArray(turns)) return 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (t && t.role === 'in') return Number(t.ts) || 0;
  }
  return 0;
}

/** 窗口剩余毫秒（≤0 = 已过期或从未有客户消息）。 */
export function windowRemainingMs(turns: unknown, now = Date.now()): number {
  const last = lastInboundTs(turns);
  return last ? last + WA_WINDOW_MS - now : 0;
}

export interface SendResult { ok: boolean; msgId?: string; error?: string; configured: boolean }

/** 所有出站消息的唯一出口：拼 URL、带 token、翻译 Meta 的错误。 */
async function graphSend(body: Record<string, unknown>): Promise<SendResult> {
  const token = process.env.WA_ACCESS_TOKEN;
  if (!token) return { ok: false, configured: false, error: 'WA_ACCESS_TOKEN 未配置' };
  let res: Response;
  try {
    res = await fetch(`${GRAPH}/${phoneNumberId()}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...body }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
  } catch (e: any) {
    return { ok: false, configured: true, error: `打不通 Meta：${String(e?.message || e).slice(0, 120)}` };
  }
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok || j?.error) {
    const e = j?.error || {};
    return { ok: false, configured: true, error: `Meta ${res.status}: ${e.message || 'unknown'}${e.error_data?.details ? ' — ' + e.error_data.details : ''}` };
  }
  return { ok: true, configured: true, msgId: j?.messages?.[0]?.id };
}

/** 引用回复：给 body 加 context。replyTo 为空时什么都不加。 */
function withContext(body: Record<string, unknown>, replyTo?: string): Record<string, unknown> {
  return replyTo ? { ...body, context: { message_id: replyTo } } : body;
}

// ────────────────────────────────────────────────────────────
// 文本
// ────────────────────────────────────────────────────────────
export async function sendText(to: string, text: string, opts: { replyTo?: string } = {}): Promise<SendResult> {
  if (!isConfigured()) return { ok: false, configured: false, error: 'WA_ACCESS_TOKEN 未配置' };
  const body = String(text || '').trim().slice(0, 4096);
  if (!body) return { ok: false, configured: true, error: '空文本' };
  return graphSend(withContext({ to, type: 'text', text: { body, preview_url: true } }, opts.replyTo));
}

// ────────────────────────────────────────────────────────────
// 媒体（图片 / 文件）
// ────────────────────────────────────────────────────────────
export type SendMediaKind = 'image' | 'document';
export interface SendMediaSpec {
  kind: SendMediaKind;
  /** 公网可达的 https 链接。Meta 自己去抓，抓不到就 131053。 */
  link: string;
  caption?: string;
  /** 只对 document 有意义：客户看到的文件名。 */
  filename?: string;
  replyTo?: string;
}

export async function sendMedia(to: string, spec: SendMediaSpec): Promise<SendResult> {
  if (!isConfigured()) return { ok: false, configured: false, error: 'WA_ACCESS_TOKEN 未配置' };
  if (spec.kind !== 'image' && spec.kind !== 'document') return { ok: false, configured: true, error: '只支持 image / document' };
  const link = String(spec.link || '').trim();
  // Meta 只从公网 https 抓，localhost / http 一律当场拒掉，别等它回 131053
  if (!/^https:\/\/[^\s]+$/i.test(link)) return { ok: false, configured: true, error: '媒体链接必须是公网 https' };
  // 图片只收 jpeg/png —— webp 是本站的默认格式，但 Meta 图片消息不收（会静默失败）
  if (spec.kind === 'image' && /\.webp(\?|$)/i.test(link)) {
    return { ok: false, configured: true, error: 'Meta 图片消息不收 webp，用 /meta-jpg/ 下的 jpg' };
  }
  const media: Record<string, unknown> = { link };
  const caption = String(spec.caption || '').trim().slice(0, 1024);
  if (caption) media.caption = caption;
  if (spec.kind === 'document' && spec.filename) media.filename = String(spec.filename).slice(0, 120);
  return graphSend(withContext({ to, type: spec.kind, [spec.kind]: media }, spec.replyTo));
}

// ────────────────────────────────────────────────────────────
// 交互消息（按钮 / 列表）
// ────────────────────────────────────────────────────────────
/** Meta 的硬上限。超了它只回一句没头没尾的 #100，所以在本地就拦。 */
export const WA_BUTTON_MAX = 3;
export const WA_BUTTON_TITLE_MAX = 20;
export const WA_LIST_ROW_MAX = 10;
export const WA_LIST_TITLE_MAX = 24;
export const WA_LIST_DESC_MAX = 72;
export const WA_INTERACTIVE_BODY_MAX = 1024;

export interface ButtonSpec { id: string; title: string }
export interface ListRowSpec { id: string; title: string; description?: string }
export interface SendInteractiveSpec {
  body: string;
  buttons?: ButtonSpec[];
  list?: { button: string; rows: ListRowSpec[] };
  replyTo?: string;
}

/** 校验 + 拼 Meta 的 interactive 结构。返回 string = 错误原因（人话）。 */
export function buildInteractive(spec: SendInteractiveSpec): Record<string, unknown> | string {
  const body = String(spec.body || '').trim().slice(0, WA_INTERACTIVE_BODY_MAX);
  if (!body) return '交互消息要有正文';
  const hasButtons = Array.isArray(spec.buttons) && spec.buttons.length > 0;
  const hasList = !!spec.list && Array.isArray(spec.list.rows) && spec.list.rows.length > 0;
  if (hasButtons === hasList) return '按钮和列表二选一（不能都给也不能都不给）';

  if (hasButtons) {
    const btns = spec.buttons!;
    if (btns.length > WA_BUTTON_MAX) return `按钮最多 ${WA_BUTTON_MAX} 个`;
    for (const b of btns) {
      const title = String(b?.title || '').trim();
      if (!title) return '按钮文字不能为空';
      if (title.length > WA_BUTTON_TITLE_MAX) return `按钮文字「${title}」超过 ${WA_BUTTON_TITLE_MAX} 字`;
    }
    const ids = btns.map((b, i) => String(b?.id || `ib_${i + 1}`).slice(0, 200));
    if (new Set(ids).size !== ids.length) return '按钮 id 不能重复';
    return {
      type: 'button',
      body: { text: body },
      action: { buttons: btns.map((b, i) => ({ type: 'reply', reply: { id: ids[i], title: String(b.title).trim() } })) },
    };
  }

  const rows = spec.list!.rows;
  if (rows.length > WA_LIST_ROW_MAX) return `列表最多 ${WA_LIST_ROW_MAX} 项`;
  const ids = rows.map((r, i) => String(r?.id || `ib_${i + 1}`).slice(0, 200));
  if (new Set(ids).size !== ids.length) return '列表项 id 不能重复';
  for (const r of rows) {
    const title = String(r?.title || '').trim();
    if (!title) return '列表项标题不能为空';
    if (title.length > WA_LIST_TITLE_MAX) return `列表项「${title}」超过 ${WA_LIST_TITLE_MAX} 字`;
    if (r?.description && String(r.description).length > WA_LIST_DESC_MAX) return `列表项「${title}」的说明超过 ${WA_LIST_DESC_MAX} 字`;
  }
  const label = String(spec.list!.button || '选择').trim().slice(0, WA_BUTTON_TITLE_MAX);
  return {
    type: 'list',
    body: { text: body },
    action: {
      button: label,
      sections: [{
        title: '选项',
        rows: rows.map((r, i) => ({
          id: ids[i],
          title: String(r.title).trim(),
          ...(r.description ? { description: String(r.description).trim() } : {}),
        })),
      }],
    },
  };
}

export async function sendInteractive(to: string, spec: SendInteractiveSpec): Promise<SendResult> {
  if (!isConfigured()) return { ok: false, configured: false, error: 'WA_ACCESS_TOKEN 未配置' };
  const interactive = buildInteractive(spec);
  if (typeof interactive === 'string') return { ok: false, configured: true, error: interactive };
  return graphSend(withContext({ to, type: 'interactive', interactive }, spec.replyTo));
}

// ────────────────────────────────────────────────────────────
// 已读回执 + 正在输入
// ────────────────────────────────────────────────────────────
/**
 * 把客户那条消息标成已读（可选同时显示「正在输入…」）。
 *
 * 刻意不抛也不返回细节：这是「顺手做的礼貌动作」，失败了对话照样得往下走，
 * 绝不能因为它挂掉而拖累消息转发。typing 指示器由 Meta 在收到我们下一条消息时
 * 自动撤掉，最长 25 秒自己消失，所以不需要「取消」接口。
 */
export async function markRead(msgId: string, opts: { typing?: boolean } = {}): Promise<boolean> {
  const token = process.env.WA_ACCESS_TOKEN;
  if (!token || !msgId) return false;
  try {
    const res = await fetch(`${GRAPH}/${phoneNumberId()}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: msgId,
        ...(opts.typing ? { typing_indicator: { type: 'text' } } : {}),
      }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      console.warn('[waSend] markRead 失败', res.status, (await res.text().catch(() => '')).slice(0, 160));
      return false;
    }
    return true;
  } catch (e: any) {
    console.warn('[waSend] markRead 打不通', String(e?.message || e).slice(0, 120));
    return false;
  }
}

// ────────────────────────────────────────────────────────────
// 模板（窗口外唯一能发的东西）
// ────────────────────────────────────────────────────────────
export async function sendTemplate(to: string, name: string, lang: string, params: string[] = []): Promise<SendResult> {
  if (!isConfigured()) return { ok: false, configured: false, error: 'WA_ACCESS_TOKEN 未配置' };
  const tplName = String(name || '').trim();
  if (!tplName) return { ok: false, configured: true, error: '缺模板名' };
  const components = params.length
    ? [{ type: 'body', parameters: params.map(p => ({ type: 'text', text: String(p ?? '').slice(0, 1024) })) }]
    : [];
  return graphSend({
    to,
    type: 'template',
    template: { name: tplName, language: { code: String(lang || 'en') }, ...(components.length ? { components } : {}) },
  });
}
