import { NextResponse } from 'next/server';

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
 * Confirms an order (or cancels it) and awards points + referral bonus.
 * Uses Firebase Admin SDK so it bypasses Firestore security rules.
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

    for (const orderId of orderIds) {
      const orderRef = db.collection('orders').doc(orderId);
      const orderSnap = await orderRef.get();
      if (!orderSnap.exists) continue;

      const orderData = orderSnap.data()!;

      // Award points only when changing TO 'confirmed' from a non-confirmed status
      if (status === 'confirmed' && orderData.status !== 'confirmed' && orderData.userId) {
        const userRef = db.collection('users').doc(orderData.userId);
        const total = orderData.total ?? 0;

        // Basic points: RM 1 = 1 point + update order stats
        await userRef.update({
          totalOrders: FieldValue.increment(1),
          totalSpent: FieldValue.increment(total),
          points: FieldValue.increment(Math.floor(total)),
        });

        // Referral bonus (only on first confirmed order)
        const userSnap = await userRef.get();
        const userData = userSnap.data();
        if (userData?.referredBy && !userData?.referralBonusAwarded) {
          const referralCode = userData.referredBy;
          const referrerQuery = await db.collection('users')
            .where('referralCode', '==', referralCode)
            .limit(1)
            .get();

          if (!referrerQuery.empty) {
            const referrerDoc = referrerQuery.docs[0];
            // Award 50 points to referrer
            await db.collection('users').doc(referrerDoc.id).update({
              points: FieldValue.increment(50),
            });
            // Award 50 points to referred user + mark as awarded
            await userRef.update({
              points: FieldValue.increment(50),
              referralBonusAwarded: true,
            });
          }
        }
      }

      // Restore voucher when cancelling an order that used one
      if (status === 'cancelled' && orderData.promoCode && orderData.status !== 'cancelled') {
        try {
          const voucherRef = db.collection('vouchers').doc(orderData.promoCode);
          const voucherSnap = await voucherRef.get();
          if (voucherSnap.exists && voucherSnap.data()?.isUsed) {
            await voucherRef.update({ isUsed: false, usedBy: '', usedAt: null });
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

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('confirm-order error:', err);
    return NextResponse.json({ error: err.message || '操作失败' }, { status: 500 });
  }
}
