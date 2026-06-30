import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { finalizeMealVoucherPurchase } from '@/lib/mealVoucherUtils';

/**
 * POST /api/payment/webhook
 *
 * Razorpay/Curlec server-to-server webhook. This is the SAFETY NET that mints
 * meal vouchers even when the browser never makes it back — FPX bank redirects,
 * a closed tab, or (soon) a Capacitor WebView that fully navigates away.
 *
 * Unlike /api/meal-vouchers/confirm-purchase (which depends on an in-memory
 * Razorpay handler closure surviving the redirect), Curlec calls THIS endpoint
 * directly from its servers the moment a payment is captured. No browser needed.
 *
 * Security: the URL is public, so every request is verified with HMAC-SHA256
 * over the raw body against RAZORPAY_WEBHOOK_SECRET. Unverified → 400, no work.
 *
 * Idempotent: minting + the paid-status flip are guarded inside
 * finalizeMealVoucherPurchase(), so the webhook and the browser path can both
 * fire on the same purchase without double-minting or double-counting LTV.
 *
 * Setup (done once, by the operator):
 *   1. Curlec Dashboard → Webhooks → Add New Webhook
 *      URL    : https://www.incredibowl.my/api/payment/webhook
 *      Secret : <same random string as RAZORPAY_WEBHOOK_SECRET>
 *      Events : payment.captured  (order.paid optional)
 *   2. Vercel → Environment Variables → RAZORPAY_WEBHOOK_SECRET = <that string>
 */

let adminDb: FirebaseFirestore.Firestore | null = null;
async function getDb() {
  if (adminDb) return adminDb;
  const { getAdminDb } = await import('@/lib/firebase-admin');
  adminDb = getAdminDb();
  return adminDb;
}

export async function POST(req: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[webhook] RAZORPAY_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'webhook not configured' }, { status: 500 });
  }

  // Raw body is REQUIRED — HMAC must run over the exact bytes Razorpay signed.
  // Parsing to JSON first and re-serializing would change the bytes and break
  // verification.
  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature') || '';

  // ── Verify signature (constant-time) ──────────────────────────
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const expBuf = Buffer.from(expected, 'hex');
  const recBuf = Buffer.from(signature, 'hex');
  if (expBuf.length !== recBuf.length || !crypto.timingSafeEqual(expBuf, recBuf)) {
    console.warn('[webhook] signature verification failed');
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  try {
    const type: string = event?.event || '';

    // Only act on "money has settled" events. Anything else (refunds,
    // authorized-but-not-captured, etc.) we acknowledge with 200 and ignore so
    // Razorpay doesn't retry.
    if (type !== 'payment.captured' && type !== 'order.paid') {
      return NextResponse.json({ ok: true, ignored: type }, { status: 200 });
    }

    // The Razorpay order id ties the payment back to our purchase doc
    // (stored as razorpayOrderId at create-purchase time).
    const orderId: string | null =
      event?.payload?.payment?.entity?.order_id ||
      event?.payload?.order?.entity?.id ||
      null;
    const paymentId: string | undefined =
      event?.payload?.payment?.entity?.id || undefined;

    if (!orderId) {
      return NextResponse.json({ ok: true, note: 'no order id on event' }, { status: 200 });
    }

    const db = await getDb();
    const q = await db.collection('mealVoucherPurchases')
      .where('razorpayOrderId', '==', orderId)
      .limit(1)
      .get();

    if (q.empty) {
      // Not a meal-voucher order (e.g. a regular food order, which is
      // confirmed via its own browser callback + /api/confirm-order). Nothing
      // for this endpoint to do — ack so Razorpay stops retrying.
      return NextResponse.json({ ok: true, note: 'no matching voucher purchase' }, { status: 200 });
    }

    const purchaseId = q.docs[0].id;
    const result = await finalizeMealVoucherPurchase(db, purchaseId, {
      razorpayPaymentId: paymentId,
      source: `webhook:${type}`,
    });

    console.log(
      `[webhook] ${type} → purchase ${purchaseId}: minted ${result.voucherIds.length}` +
      `${result.alreadyPaid ? ' (already paid, idempotent no-op)' : ''}`,
    );

    return NextResponse.json({
      ok: true,
      purchaseId,
      minted: result.voucherIds.length,
      alreadyPaid: result.alreadyPaid,
    }, { status: 200 });
  } catch (err: any) {
    // Return 500 so Razorpay RETRIES the webhook (it backs off and re-sends on
    // non-2xx). Better a retry than a silently-dropped voucher.
    console.error('[webhook] processing error:', err);
    return NextResponse.json({ error: err.message || 'webhook failed' }, { status: 500 });
  }
}
