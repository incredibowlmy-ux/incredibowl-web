/**
 * 网站直接发 WhatsApp 文本（碗妈收件箱「回复」用）。
 *
 * 之前所有出站消息都由 n8n 的 WhatsApp 节点发；dashboard 要能像 WATI 那样在线程里
 * 直接回，就得让 Vercel 也能发。用 Meta Cloud API 最小集：一个 POST、一个 token。
 *
 * 环境变量：
 *   WA_ACCESS_TOKEN      Meta system-user 永久 token（老板提供；没配则 sendText 回 configured=false）
 *   WA_PHONE_NUMBER_ID   默认 1019276584602589（碗妈号）
 *
 * 24 小时窗口：Meta 只允许在客户最后一条消息后 24h 内发自由文本，窗口外要审核过的模板。
 * 这里不发模板 —— 调用方先用 windowOpenMs() 判定，过期就别调。
 */

export const WA_WINDOW_MS = 24 * 60 * 60 * 1000;
const GRAPH = 'https://graph.facebook.com/v20.0';

export function isConfigured(): boolean {
  return !!process.env.WA_ACCESS_TOKEN;
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

export async function sendText(to: string, text: string): Promise<SendResult> {
  const token = process.env.WA_ACCESS_TOKEN;
  if (!token) return { ok: false, configured: false, error: 'WA_ACCESS_TOKEN 未配置' };
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID || '1019276584602589';
  const body = String(text || '').trim().slice(0, 4096);
  if (!body) return { ok: false, configured: true, error: '空文本' };
  const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body, preview_url: true } }),
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok || j?.error) {
    const e = j?.error || {};
    return { ok: false, configured: true, error: `Meta ${res.status}: ${e.message || 'unknown'}${e.error_data?.details ? ' — ' + e.error_data.details : ''}` };
  }
  return { ok: true, configured: true, msgId: j?.messages?.[0]?.id };
}
