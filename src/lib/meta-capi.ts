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

export type CapiEvent = {
  eventName: CapiEventName;
  eventId: string;
  eventSourceUrl?: string;
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

  const u: Record<string, unknown> = {
    client_ip_address: event.userData.clientIpAddress,
    client_user_agent: event.userData.clientUserAgent,
  };
  if (event.userData.fbp) u.fbp = event.userData.fbp;
  if (event.userData.fbc) u.fbc = event.userData.fbc;
  if (event.userData.email) u.em = [sha256(event.userData.email)];
  if (event.userData.phone) u.ph = [sha256(normalizePhone(event.userData.phone))];
  if (event.userData.externalId) u.external_id = [sha256(event.userData.externalId)];

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
      event_time: Math.floor(Date.now() / 1000),
      event_id: event.eventId,
      action_source: 'website',
      event_source_url: event.eventSourceUrl || 'https://www.incredibowl.my/',
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
