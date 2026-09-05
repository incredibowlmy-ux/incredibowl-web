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
      // Not a meal-voucher purchase → try the FOOD-ORDER fallback. Before this
      // existed, a food order whose browser never made it back (closed tab,
      // WebView navigation) sat 'pending' until the 1h stale-FPX sweep
      // cancelled it — money captured, order gone. Now the webhook confirms it
      // server-side, exactly like vouchers.
      return handleFoodOrderFallback(db, type, orderId, paymentId);
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

/**
 * Server-side confirmation for regular FOOD orders (the voucher path above has
 * had this safety net since day one; food orders relied on the browser coming
 * back).
 *
 * Rather than duplicating confirm-order's side effects (LTV bump, promo-voucher
 * claim, CAPI Purchase, receipt email), we invoke the production-proven route
 * handler directly with a self-computed Razorpay signature: we hold
 * RAZORPAY_KEY_SECRET, and the webhook body was already HMAC-verified above,
 * so signing `orderId|paymentId` here is legitimate cryptographic proof of the
 * same payment — it flows through confirm-order's Path A and its
 * razorpayOrderId-binding check unchanged. Idempotent: a second delivery (or
 * the browser callback racing us) finds no 'pending' docs and no-ops.
 */
async function handleFoodOrderFallback(
  db: FirebaseFirestore.Firestore,
  type: string,
  orderId: string,
  paymentId: string | undefined,
) {
  // 2026-09-05：以前只查单值 razorpayOrderId。双标签页结账时后一次 create-order
  // 会把前一次的绑定冲掉，顾客付掉前一笔 → 这里查不到 → 静默 200 → 1h 后订单被
  // 扫成 cancelled，钱收了订单没了。现在先查累加数组，再退回老字段（老单没有
  // 数组），按 doc id 去重。
  const [byArray, byLegacy] = await Promise.all([
    db.collection('orders').where('razorpayOrderIds', 'array-contains', orderId).get(),
    db.collection('orders').where('razorpayOrderId', '==', orderId).get(),
  ]);
  const orderDocs = [...byArray.docs, ...byLegacy.docs]
    .filter((d, i, arr) => arr.findIndex(x => x.id === d.id) === i);

  if (orderDocs.length === 0) {
    // 钱进来了但对不上任何订单/餐券购买 —— 这是**最后一道网**，绝不能再静默 200
    // 吞掉。落一条 unmatchedPayments 记录，daily-check 的 C13 每天扫它。
    console.error(
      `[webhook] ⚠️ UNMATCHED PAYMENT — razorpayOrderId=${orderId} paymentId=${paymentId || '(none)'} ` +
      '对不上任何 mealVoucherPurchases 或 orders，钱可能已经收了。',
    );
    try {
      await db.collection('unmatchedPayments').doc(paymentId || orderId).set({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId || '',
        eventType: type,
        receivedAt: new Date(),
        needsReview: true,
      }, { merge: true });
    } catch (e) {
      console.error('[webhook] failed to record unmatched payment:', e);
    }
    return NextResponse.json({ ok: true, note: 'no matching purchase or order', unmatched: true }, { status: 200 });
  }

  // Money arrived but the stale-FPX sweep already cancelled the order (payment
  // event came >1h late). Do NOT auto-revive — the 06:00 cutoff may have
  // passed and the kitchen never planned this meal. Flag for a human instead.
  const lateCancelled = orderDocs.filter(d => d.data().status === 'cancelled');
  for (const d of lateCancelled) {
    await d.ref.update({
      latePaymentCaptured: true,
      latePaymentId: paymentId || '',
      needsReview: true,
    });
    console.error(
      `[webhook] ⚠️ LATE PAYMENT on cancelled order ${d.id} (payment ${paymentId}) — ` +
      'customer paid but order was already cancelled; needs manual refund-or-revive.',
    );
  }

  const pendingIds = orderDocs.filter(d => d.data().status === 'pending').map(d => d.id);
  if (pendingIds.length === 0 || !paymentId) {
    return NextResponse.json({
      ok: true,
      note: lateCancelled.length ? 'late payment flagged' : 'orders already settled',
      flagged: lateCancelled.length,
    }, { status: 200 });
  }

  const signature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const { POST: confirmOrder } = await import('@/app/api/confirm-order/route');
  const res = await confirmOrder(new Request('http://internal/api/confirm-order', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      orderIds: pendingIds,
      status: 'confirmed',
      paymentData: {
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: signature,
      },
    }),
  }));

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // 500 → Razorpay retries; a transient Firestore hiccup must not drop a paid order.
    console.error(`[webhook] food-order confirm failed (${res.status}): ${body}`);
    return NextResponse.json({ error: 'food order confirm failed' }, { status: 500 });
  }

  console.log(`[webhook] ${type} → confirmed food orders [${pendingIds.join(', ')}] via server fallback`);
  return NextResponse.json({ ok: true, confirmedOrders: pendingIds }, { status: 200 });
}
