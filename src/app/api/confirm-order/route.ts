import { NextResponse } from 'next/server';
import { sendCapiEvent, extractRequestContext } from '@/lib/meta-capi';
import { releaseMealVouchers } from '@/lib/mealVoucherUtils';

let adminDb: FirebaseFirestore.Firestore | null = null;
async function getDb() {
  if (adminDb) return adminDb;
  const { getAdminDb } = await import('@/lib/firebase-admin');
  adminDb = getAdminDb();
  return adminDb;
}

/**
 * POST /api/confirm-order
 *
 * Confirms or cancels an order. On first confirm: bumps totalOrders /
 * totalSpent, claims the promo voucher used at checkout, and fires the
 * Meta CAPI Purchase event. Uses Firebase Admin SDK so it bypasses
 * Firestore rules.
 */
export async function POST(req: Request) {
  try {
    const { orderIds, status, paymentData } = await req.json();

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: '缺少订单 ID' }, { status: 400 });
    }
    if (!status || !['confirmed', 'cancelled', 'preparing', 'delivered'].includes(status)) {
      return NextResponse.json({ error: '无效状态' }, { status: 400 });
    }

    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');

    // Collect per-order Purchase events to fire after Firestore writes
    // succeed. Keyed by orderId so the client can dedupe against fbq.
    const purchaseEvents: Array<{
      orderId: string;
      eventId: string;
      value: number;
      userEmail?: string;
      userPhone?: string;
      userId?: string;
      items: Array<{ id: string; quantity: number; item_price: number }>;
    }> = [];

    for (const orderId of orderIds) {
      const orderRef = db.collection('orders').doc(orderId);
      const orderSnap = await orderRef.get();
      if (!orderSnap.exists) continue;

      const orderData = orderSnap.data()!;
      const isFirstConfirm = status === 'confirmed' && orderData.status !== 'confirmed';

      // Queue Meta CAPI Purchase event for any order transitioning to 'confirmed'
      // for the first time (FPX flow: customer just paid; QR flow: admin
      // marked the receipt verified). We fire after the Firestore writes
      // settle, so a CAPI failure can't roll back the order.
      // Skip zero-value orders (voucher fully covered the bill) — Purchase
      // event was already fired when customer bought the voucher bundle, so
      // firing again on redemption would double-count in Meta ads.
      if (isFirstConfirm) {
        const foodAfterDiscount = orderData.total ?? 0;
        const deliveryFee = orderData.deliveryFee ?? 0;
        const purchaseValue = foodAfterDiscount + deliveryFee;
        if (purchaseValue > 0) {
          const items: Array<Record<string, unknown>> = Array.isArray(orderData.items) ? orderData.items : [];
          purchaseEvents.push({
            orderId,
            eventId: `purchase_${orderId}`,
            value: purchaseValue,
            userEmail: orderData.userEmail || undefined,
            userPhone: orderData.userPhone || undefined,
            userId: orderData.userId || undefined,
            items: items.map((it) => ({
              id: String(it.name ?? ''),
              quantity: Number(it.quantity ?? 1),
              item_price: Number(it.price ?? 0),
            })),
          });
        }
      }

      if (isFirstConfirm && orderData.userId) {
        const userRef = db.collection('users').doc(orderData.userId);
        const foodAfterDiscount = orderData.total ?? 0;
        const deliveryFee = orderData.deliveryFee ?? 0;

        await userRef.update({
          totalOrders: FieldValue.increment(1),
          totalSpent: FieldValue.increment(foodAfterDiscount + deliveryFee),
        });
      }

      // Claim voucher when transitioning TO confirmed for the first time.
      // (Deferred from submit-order so FPX failures don't burn the voucher.)
      if (isFirstConfirm && orderData.promoCode && orderData.userId) {
        try {
          const code = String(orderData.promoCode).trim().toUpperCase();
          const voucherRef = db.collection('vouchers').doc(code);
          const userRef = db.collection('users').doc(orderData.userId);
          await db.runTransaction(async (tx) => {
            const vSnap = await tx.get(voucherRef);
            if (!vSnap.exists) return;
            const v = vSnap.data() || {};
            const max = typeof v.maxUses === 'number' && v.maxUses > 0 ? v.maxUses : 1;
            const used = typeof v.usedCount === 'number' ? v.usedCount : (v.isUsed ? 1 : 0);
            // Race guard: if voucher got fully claimed between submit and
            // confirm (rare two-customer race on a global single-use code),
            // we still let the order through — customer already paid — but
            // skip the increment so we don't go past maxUses in the doc.
            if (used >= max) {
              console.warn(`Voucher ${code} maxed out at confirm time for order ${orderId}`);
              return;
            }
            const nextUsed = used + 1;
            tx.update(voucherRef, {
              usedCount: nextUsed,
              isUsed: nextUsed >= max,
              usedBy: orderData.userId,
              usedAt: FieldValue.serverTimestamp(),
            });
            tx.set(
              userRef,
              { vouchersUsed: FieldValue.arrayUnion(code) },
              { merge: true }
            );
          });
        } catch (e) {
          console.warn('Failed to claim voucher on confirm:', e);
        }
      }

      // Release meal vouchers when cancelling an order that claimed any.
      // Skips vouchers that have since expired.
      if (
        status === 'cancelled'
        && orderData.status !== 'cancelled'
        && Array.isArray(orderData.claimedMealVoucherIds)
        && orderData.claimedMealVoucherIds.length > 0
      ) {
        try {
          await releaseMealVouchers(db, orderData.claimedMealVoucherIds);
        } catch (e) {
          console.warn('Failed to release meal vouchers on cancel:', e);
        }
      }

      // Restore voucher when cancelling an order that used one.
      // Multi-use vouchers: decrement usedCount and clear isUsed flag if it was set.
      // Also remove from the user's vouchersUsed array so per-user dedup releases.
      if (status === 'cancelled' && orderData.promoCode && orderData.status !== 'cancelled') {
        try {
          const voucherRef = db.collection('vouchers').doc(orderData.promoCode);
          await db.runTransaction(async (tx) => {
            const vSnap = await tx.get(voucherRef);
            if (!vSnap.exists) return;
            const v = vSnap.data() || {};
            const used = typeof v.usedCount === 'number' ? v.usedCount : (v.isUsed ? 1 : 0);
            if (used <= 0) return;
            const nextUsed = used - 1;
            const max = typeof v.maxUses === 'number' && v.maxUses > 0 ? v.maxUses : 1;
            tx.update(voucherRef, {
              usedCount: nextUsed,
              isUsed: nextUsed >= max,
              ...(nextUsed === 0 ? { usedBy: '', usedAt: null } : {}),
            });
          });

          if (orderData.userId) {
            try {
              await db.collection('users').doc(orderData.userId).update({
                vouchersUsed: FieldValue.arrayRemove(orderData.promoCode),
              });
            } catch (e) {
              console.warn('Failed to release user voucher dedup:', e);
            }
          }
        } catch (e) {
          console.warn('Failed to restore voucher:', e);
        }
      }

      // Update order status + optional payment data
      const updateFields: Record<string, any> = {
        status,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (paymentData?.razorpayPaymentId) updateFields.razorpayPaymentId = paymentData.razorpayPaymentId;
      if (paymentData?.razorpayOrderId) updateFields.razorpayOrderId = paymentData.razorpayOrderId;
      if (paymentData?.razorpaySignature) updateFields.razorpaySignature = paymentData.razorpaySignature;

      await orderRef.update(updateFields);
    }

    // ── Meta CAPI: Purchase ──────────────────────────────────
    // Fire one Purchase per order that just transitioned to 'confirmed'.
    // Each carries its own event_id so the browser fbq call can dedupe
    // (FPX flow only — QR flow has no client present when admin confirms).
    let capiCtx;
    try { capiCtx = extractRequestContext(req); } catch { capiCtx = null; }

    const purchaseEventIds: Record<string, string> = {};
    // AWAIT — fire-and-forget (`void`) gets killed by Vercel serverless when the
    // function instance is frozen post-response. Awaiting adds ~200ms but
    // guarantees the CAPI fetch completes before we return.
    await Promise.allSettled(purchaseEvents.map((ev) => {
      purchaseEventIds[ev.orderId] = ev.eventId;
      return sendCapiEvent({
        eventName: 'Purchase',
        eventId: ev.eventId,
        eventSourceUrl: capiCtx?.eventSourceUrl,
        userData: {
          email: ev.userEmail,
          phone: ev.userPhone,
          externalId: ev.userId,
          fbp: capiCtx?.fbp,
          fbc: capiCtx?.fbc,
          clientIpAddress: capiCtx?.clientIpAddress || '',
          clientUserAgent: capiCtx?.clientUserAgent || '',
        },
        customData: {
          currency: 'MYR',
          value: ev.value,
          numItems: ev.items.length,
          contents: ev.items,
          orderId: ev.orderId,
        },
      });
    }));

    return NextResponse.json({
      success: true,
      // Map of { orderId: eventId } — FPX client uses this to dedup
      // browser fbq Purchase against the server-side CAPI event we just
      // queued. Empty for non-confirm transitions (cancelled, etc).
      purchaseEventIds,
    });
  } catch (err: any) {
    console.error('confirm-order error:', err);
    return NextResponse.json({ error: err.message || '操作失败' }, { status: 500 });
  }
}

