/**
 * Meta Conversions API (CAPI) helper
 * --------------------------------------------------------------
 * Sends server-side events to Meta to complement browser Pixel,
 * recovering the ~30% signal lost to ad-blockers and iOS 14+ ATT.
 *
 * Pixel ID is fixed (already public in the bundle via fbq init).
 * Access token MUST be kept server-side — never expose to client.
 *
 * Events fire silently — failures are logged but never thrown,
 * so a CAPI outage cannot break the checkout flow.
 *
 * Dedup: pass the same `eventId` to both browser fbq and this
 * helper, with the SAME event_name. Meta will collapse the pair.
 */

import crypto from 'crypto';

const PIXEL_ID = process.env.META_PIXEL_ID || '762982966692354';
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN || '';
// Incredibowl 的 Facebook Page —— business_messaging 事件必须带 page_id。
const PAGE_ID = process.env.META_PAGE_ID || '1005456919311982';
const TEST_EVENT_CODE = process.env.META_CAPI_TEST_EVENT_CODE; // unset in prod
const META_API_VERSION = 'v21.0';
const ENDPOINT = `https://graph.facebook.com/${META_API_VERSION}/${PIXEL_ID}/events`;

/** SHA-256 hex of a normalized (trimmed, lowercased) string. */
const sha256 = (v: string) =>
  crypto.createHash('sha256').update(v.trim().toLowerCase()).digest('hex');

/**
 * Normalize a Malaysian phone number to E.164-ish format expected
 * by Meta (digits only, country code prefix, no leading +).
 *   "010-337 0197" → "60103370197"
 *   "+60103370197" → "60103370197"
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('60')) return digits;
  if (digits.startsWith('0')) return '60' + digits.slice(1);
  // Fallback: assume MY user typed national number without 0
  return '60' + digits;
}

export type CapiUserData = {
  email?: string;
  phone?: string;
  externalId?: string; // Firebase UID — gives Meta a stable identity hook
  fbp?: string;        // _fbp cookie
  fbc?: string;        // _fbc cookie
  clientIpAddress: string;
  clientUserAgent: string;
  /**
   * Facebook Page id。action_source = 'business_messaging' 时 Meta 必填
   * （subcode 2804069 "Missing Page ID"）。不填会整条拒。
   * 不传就用 META_PAGE_ID / Incredibowl 的 Page id 兜底。
   */
  pageId?: string;
  /**
   * Click-to-WhatsApp 的点击 id。
   *
   * ⚠️ 2026-09-29 实测出来的硬约束：`business_messaging` **必须**带它
   * （subcode 2804071 "Missing CTWA clid"），没有兜底值可编。
   * 换句话说 business_messaging 只服务「客户从 CTWA 广告点进 WhatsApp」
   * 这一条路 —— 客户自己找上来、老板手工成交的单**没有**这个 id，
   * 那种单的正确口径是 action_source = 'other'，不是 business_messaging。
   *
   * CTWA 战役重开之后，webhook payload 里会带 referral.ctwa_clid，
   * 存下来再往这里传，手工单才能真正走 business_messaging。
   */
  ctwaClid?: string;
};

export type CapiCustomData = {
  currency?: string;
  value?: number;
  contentIds?: string[];
  contents?: Array<{ id: string; quantity: number; item_price: number }>;
  numItems?: number;
  orderId?: string;
};

export type CapiEventName =
  | 'PageView'
  | 'ViewContent'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'Purchase'
  | 'Lead'
  | 'CompleteRegistration';

/**
 * Where the conversion actually happened. Meta uses this to grade match
 * quality and to keep offline sales out of the website funnel's stats.
 *   'website'           — customer completed it on incredibowl.my (default)
 *   'business_messaging'— completed in a WhatsApp/Messenger thread
 *   'other'             — anything else we booked on the customer's behalf
 * Sending 'website' for a sale the boss keyed in by hand misreports the
 * funnel, so manual flows must pass the right value.
 */
export type CapiActionSource = 'website' | 'business_messaging' | 'other';

/**
 * 对话渠道。当 action_source = 'business_messaging' 时 Meta **强制要求**这个
 * 参数，缺了整条事件被拒（code 100 / subcode 2804063 "Missing messaging
 * channel parameter"）。2026-09-29 实测踩到过。
 */
export type CapiMessagingChannel = 'whatsapp' | 'messenger' | 'instagram';

export type CapiEvent = {
  eventName: CapiEventName;
  eventId: string;
  eventSourceUrl?: string;
  /** Defaults to 'website'. */
  actionSource?: CapiActionSource;
  /**
   * action_source = 'business_messaging' 时必填，其它情况不要传。
   * 不填会被 Meta 整条拒掉（subcode 2804063）。
   */
  messagingChannel?: CapiMessagingChannel;
  /**
   * 事件真正发生的时刻（ms）。默认「现在」。
   * 手工单老板可能隔一两天才录（manual-voucher-purchase 支持补录日期），
   * 拿录入时刻当成交时刻会把归因窗口算歪，所以要传真实成交时刻。
   * ⚠️ Meta 只接受过去 7 天内的 event_time，更早的会被整条丢掉。
   */
  eventTimeMs?: number;
  userData: CapiUserData;
  customData?: CapiCustomData;
};

/**
 * Send a single event to Meta CAPI. Always returns — never throws.
 * Caller can ignore the result; we log failures for diagnostics.
 */
export async function sendCapiEvent(event: CapiEvent): Promise<{ ok: boolean; error?: string }> {
  if (!ACCESS_TOKEN) {
    // Soft-fail in dev when token isn't configured yet, so /api routes
    // don't get noisy. In prod this should never happen.
    if (process.env.NODE_ENV !== 'production') {
      console.info('[CAPI] META_CAPI_ACCESS_TOKEN not set — skipping (dev mode)');
    } else {
      console.warn('[CAPI] META_CAPI_ACCESS_TOKEN not set in production!');
    }
    return { ok: false, error: 'no_token' };
  }

  const actionSource = event.actionSource || 'website';
  // business_messaging 缺 messaging_channel 会被整条拒（subcode 2804063）。
  // 默认补 whatsapp —— 这个生意的对话成交只走 WhatsApp，兜底比丢事件好。
  const messagingChannel = actionSource === 'business_messaging'
    ? (event.messagingChannel || 'whatsapp')
    : undefined;

  const u: Record<string, unknown> = {
    client_ip_address: event.userData.clientIpAddress,
    client_user_agent: event.userData.clientUserAgent,
  };
  if (event.userData.fbp) u.fbp = event.userData.fbp;
  if (event.userData.fbc) u.fbc = event.userData.fbc;
  if (event.userData.email) u.em = [sha256(event.userData.email)];
  if (event.userData.phone) u.ph = [sha256(normalizePhone(event.userData.phone))];
  if (event.userData.externalId) u.external_id = [sha256(event.userData.externalId)];
  // page_id / ctwa_clid 都不 hash —— Meta 要原值。
  if (event.userData.pageId) u.page_id = event.userData.pageId;
  else if (actionSource === 'business_messaging') u.page_id = PAGE_ID;
  if (event.userData.ctwaClid) u.ctwa_clid = event.userData.ctwaClid;

  const c: Record<string, unknown> = {};
  if (event.customData) {
    if (event.customData.currency) c.currency = event.customData.currency;
    if (typeof event.customData.value === 'number') c.value = event.customData.value;
    if (event.customData.contentIds) c.content_ids = event.customData.contentIds;
    if (event.customData.contents) c.contents = event.customData.contents;
    if (typeof event.customData.numItems === 'number') c.num_items = event.customData.numItems;
    if (event.customData.orderId) c.order_id = event.customData.orderId;
  }

  const payload = {
    data: [{
      event_name: event.eventName,
      event_time: Math.floor((event.eventTimeMs ?? Date.now()) / 1000),
      event_id: event.eventId,
      action_source: actionSource,
      ...(messagingChannel ? { messaging_channel: messagingChannel } : {}),
      // business_messaging 事件**不许**带 event_source_url —— 带了整条被拒
      // （subcode 2804064 "Please remove all invalid arguments ... event_source_url"）。
      // 对话里成交本来就没有网页 URL，Meta 这个要求是合理的。2026-09-29 实测。
      ...(actionSource === 'business_messaging'
        ? {}
        : { event_source_url: event.eventSourceUrl || 'https://www.incredibowl.my/' }),
      user_data: u,
      custom_data: c,
    }],
    access_token: ACCESS_TOKEN,
    ...(TEST_EVENT_CODE ? { test_event_code: TEST_EVENT_CODE } : {}),
  };

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // Don't tie up the request handler waiting on Meta — but we still
      // await so per-event errors land in our logs.
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[CAPI] ${event.eventName} (${event.eventId}) → ${res.status}`, text);
      return { ok: false, error: `${res.status}: ${text}` };
    }
    // Log success too so we can verify the call completed in Vercel logs.
    console.log(`[CAPI] ${event.eventName} (${event.eventId}) → 200`);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[CAPI] ${event.eventName} (${event.eventId}) network error:`, msg);
    return { ok: false, error: msg };
  }
}

/**
 * Extract per-request context (cookies, IP, UA, referer) from the
 * incoming Next.js Request. Pass into sendCapiEvent.userData so the
 * event ties back to the same browser session that fired the Pixel.
 */
export function extractRequestContext(req: Request): {
  fbp?: string;
  fbc?: string;
  clientIpAddress: string;
  clientUserAgent: string;
  eventSourceUrl: string;
} {
  const cookies = parseCookieHeader(req.headers.get('cookie') || '');
  const ipHeader = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
  return {
    fbp: cookies['_fbp'],
    fbc: cookies['_fbc'],
    clientIpAddress: ipHeader.split(',')[0].trim(),
    clientUserAgent: req.headers.get('user-agent') || '',
    eventSourceUrl: req.headers.get('referer') || 'https://www.incredibowl.my/',
  };
}

function parseCookieHeader(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k) {
      try { out[k] = decodeURIComponent(v); }
      catch { out[k] = v; }
    }
  }
  return out;
}
