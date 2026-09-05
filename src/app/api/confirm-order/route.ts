import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { sendCapiEvent, extractRequestContext } from '@/lib/meta-capi';

let adminDb: FirebaseFirestore.Firestore | null = null;
async function getDb() {
  if (adminDb) return adminDb;
  const { getAdminDb } = await import('@/lib/firebase-admin');
  adminDb = getAdminDb();
  return adminDb;
}

// Constant-time Razorpay signature check — identical math to /api/payment/verify
// and the production-proven meal-voucher webhook.
function isValidRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
  try {
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * POST /api/confirm-order
 *
 * Confirms or cancels an order. On first confirm: bumps totalOrders /
 * totalSpent, claims the promo voucher used at checkout, and fires the
 * Meta CAPI Purchase event. Uses Firebase Admin SDK so it bypasses
 * Firestore rules.
 *
 * 🔒 2026-07-03 authZ state machine (was: ZERO auth — anyone could POST an
 * orderId and mark it paid = eat free):
 *   → confirmed:  admin token
 *               | valid Razorpay signature whose razorpayOrderId matches the
 *                 binding stamped on the orders by create-order (FPX; works
 *                 even when the bank redirect lands with no auth session)
 *               | owner token + voucher-fully-covered order (total 0, no cash)
 *   → cancelled:  admin | owner token | order still 'pending' (unpaid
 *                 throwaway — redirect-failure flows cancel without a session;
 *                 doc ids are unguessable)
 *   → preparing/delivering/delivered: admin only
 */
export async function POST(req: Request) {
  try {
    const { orderIds, status, paymentData } = await req.json();

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0 || orderIds.length > 20) {
      return NextResponse.json({ error: '缺少订单 ID' }, { status: 400 });
    }
    if (!status || !['confirmed', 'cancelled', 'preparing', 'delivering', 'delivered'].includes(status)) {
      return NextResponse.json({ error: '无效状态' }, { status: 400 });
    }

    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');

    // ── AuthZ gate (before ANY mutation) ─────────────────────
    const { verifyBearerUser } = await import('@/lib/adminApi');
    const auth = await verifyBearerUser(req); // null when no/invalid token

    const gateSnaps = await db.getAll(...orderIds.map((id: string) => db.collection('orders').doc(id)));
    const gateOrders = gateSnaps.filter(s => s.exists).map(s => s.data()!);
    if (gateOrders.length === 0) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 });
    }

    const isAdmin = !!auth?.isAdmin;
    const isOwnerOfAll = !!auth && gateOrders.every(o => o.userId === auth.uid);

    let authorized = false;
    if (isAdmin) {
      authorized = true;
    } else if (status === 'confirmed') {
      // Path A — cryptographic proof of payment (FPX). The signature must be
      // valid AND the paid razorpayOrderId must EQUAL the one create-order
      // bound to every order doc here. Requiring the match (not just a valid
      // signature) blocks replaying one real payment's signature onto a
      // different unpaid order. In-flight orders created before this deploy
      // lack the binding → they fail here and the 1h stale-FPX sweep cancels
      // them (customer re-orders); acceptable for a low-traffic deploy window.
      const pd = paymentData || {};
      if (pd.razorpayOrderId && pd.razorpayPaymentId && pd.razorpaySignature
          && isValidRazorpaySignature(pd.razorpayOrderId, pd.razorpayPaymentId, pd.razorpaySignature)) {
        // 2026-09-05：从 `o.razorpayOrderId === pd.razorpayOrderId` 改成认
        // razorpayOrderIds 数组里的**任一**在途绑定 —— 双标签页结账时后一次
        // create-order 会覆盖单值字段，顾客付掉前一笔就再也确认不了（收了钱
        // 订单没了）。跨订单重放依然挡得住，见 lib/razorpayBinding 的说明。
        const { allBoundTo } = await import('@/lib/razorpayBinding');
        authorized = allBoundTo(gateOrders, pd.razorpayOrderId);
      }
      // Path B — voucher fully covered the bill: no cash due, owner confirms.
      if (!authorized && isOwnerOfAll) {
        authorized = gateOrders.every(o =>
          o.paymentMethod === 'voucher' && (Number(o.total) || 0) === 0 && (Number(o.deliveryFee) || 0) === 0);
      }
    } else if (status === 'cancelled') {
      // 🔒 2026-08-02：只允许取消仍是 'pending'（未确认）的单。
      // 原来是 `isOwnerOfAll || 全 pending` —— isOwnerOfAll 只看「是不是自己的单」，
      // 不看状态，等于顾客吃完饭还能自助取消：cancelOrderWithRollback 会把餐券翻回
      // available、预付加料 credit 退回、dishStock 凭空 +N、promo 券 usedCount 减回，
      // 循环白吃到券过期为止（顺带把已送达单踢出 PAID_STATUSES，营收和 MFRS 15 负债表一起错）。
      //
      // 不会误伤任何现有流程：顾客侧三处取消（CartDrawer FPX 弹窗关闭 / 结账失败、
      // 首页 ?fpx_error= 回跳）取消的都是刚建、还没确认的 pending 单；
      // 老板在 Dashboard 取消已确认单走上面的 isAdmin 分支，照常可用。
      //
      // 保留「无 token 也能取消 pending 单」：银行跳转回来时没有 session，
      // 这条路必须能走（缓解因素：orderId 是 Firestore 20 字符 auto-id，不可猜）。
      authorized = gateOrders.every(o => o.status === 'pending');
    }
    if (!authorized) {
      return NextResponse.json({ error: '未授权操作' }, { status: 403 });
    }

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

    // Orders confirmed for the FIRST time in this batch → customer receipt
    // email after the writes settle. Unlike purchaseEvents this includes
    // zero-cash voucher-covered orders — the customer still wants a receipt.
    const receiptOrders: Array<{ id: string; data: Record<string, any> }> = [];

    for (const orderId of orderIds) {
      const orderRef = db.collection('orders').doc(orderId);
      const orderSnap = await orderRef.get();
      if (!orderSnap.exists) continue;

      const orderData = orderSnap.data()!;

      // ── 取消：整条回补链走共用实现 ─────────────────────────
      // 以前这里只退餐券 / 预付 credit / promo 券，漏了 dishStock 和
      // ingredientStock（2026-07-26 审计实测 14 笔漏账）。现在与
      // release-stale-fpx、admin/data 共用 cancelOrderWithRollback：
      // 事务幂等（双取消不会把库存加两遍）、状态写入也由它负责。
      if (status === 'cancelled') {
        const { cancelOrderWithRollback } = await import('@/lib/orderRollback');
        await cancelOrderWithRollback(db, orderId, {
          reason: isAdmin ? 'admin-cancel' : 'web-cancel',
          // 只有老板能取消已确认 / 配送中 / 已送达的单（真退款）。
          // 顾客侧上面的鉴权已经只放行 pending，这里是第二道锁。
          allowNonPending: isAdmin,
        });
        continue;
      }

      const isFirstConfirm = status === 'confirmed' && orderData.status !== 'confirmed';
      if (isFirstConfirm) receiptOrders.push({ id: orderId, data: orderData });

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

        // set+merge (not update): increment still works and a missing user doc
        // can't 500 the confirm — a paid order must never be left unconfirmed.
        await userRef.set({
          totalOrders: FieldValue.increment(1),
          totalSpent: FieldValue.increment(foodAfterDiscount + deliveryFee),
        }, { merge: true });
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
            // 「这单确实占用过一次额度」的凭据。取消回补只认它 —— 光有
            // promoCode 不代表 claim 过（FPX 没付成功、dashboard 手动单写了
            // 码却从不 claim），照着退会把**别人**占用的 usedCount 减掉。
            // 注意写在同一个事务里：claim 成功才有凭据，不会各自为政。
            tx.update(db.collection('orders').doc(orderId), {
              promoClaimed: true,
              updatedAt: FieldValue.serverTimestamp(),
            });
          });
        } catch (e) {
          console.warn('Failed to claim voucher on confirm:', e);
        }
      }

      // 取消相关的回补（餐券 / 预付 credit / promo 券 / 两层库存）已全部
      // 移进 cancelOrderWithRollback，见上面的 status === 'cancelled' 早返回。

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

    // ── Customer receipt email ───────────────────────────────
    // Best-effort and AWAITED (same Vercel-freeze reasoning as CAPI above).
    // sendOrderReceiptEmails never throws; a bounced email can't 500 a paid
    // order's confirmation.
    if (receiptOrders.length > 0) {
      const { sendOrderReceiptEmails } = await import('@/lib/receiptEmail');
      await sendOrderReceiptEmails(receiptOrders);
    }

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

