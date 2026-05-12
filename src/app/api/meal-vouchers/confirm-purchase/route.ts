import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { mintVouchersForPurchase } from '@/lib/mealVoucherUtils';
import { claimPromoVoucher } from '@/lib/voucherValidation';

let adminDb: FirebaseFirestore.Firestore | null = null;
async function getDb() {
  if (adminDb) return adminDb;
  const { getAdminDb } = await import('@/lib/firebase-admin');
  adminDb = getAdminDb();
  return adminDb;
}

async function verifyAuth(req: NextRequest): Promise<{ uid: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    await getDb();
    const { getAuth } = await import('firebase-admin/auth');
    const decoded = await getAuth().verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    return null;
  }
}

/**
 * POST /api/meal-vouchers/confirm-purchase
 * Auth: Bearer token
 *
 * Body:
 *   - purchaseId
 *   - razorpayPaymentId, razorpayOrderId, razorpaySignature
 *
 * Verifies the Razorpay signature for an FPX-mode meal voucher purchase
 * and mints the vouchers. Idempotent — minting is guarded inside
 * mintVouchersForPurchase().
 */
export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  try {
    const body = await req.json();
    const { purchaseId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = body;

    if (!purchaseId || !razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return NextResponse.json({ error: '缺少支付字段' }, { status: 400 });
    }

    const db = await getDb();
    const purchaseRef = db.collection('mealVoucherPurchases').doc(purchaseId);
    const purchaseSnap = await purchaseRef.get();
    if (!purchaseSnap.exists) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 });
    }
    const purchaseData = purchaseSnap.data() || {};

    // Ownership check (one user can't confirm another's purchase)
    if (purchaseData.userId !== auth.uid) {
      return NextResponse.json({ error: '无权操作' }, { status: 403 });
    }

    // Sanity: order ID on the purchase doc must match what Razorpay paid
    if (purchaseData.razorpayOrderId && purchaseData.razorpayOrderId !== razorpayOrderId) {
      return NextResponse.json({ error: '支付订单不匹配' }, { status: 400 });
    }

    // ── Signature verification (constant-time) ──────────────────
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    const receivedBuf = Buffer.from(razorpaySignature, 'hex');
    if (
      expectedBuf.length !== receivedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, receivedBuf)
    ) {
      return NextResponse.json({ error: '支付签名验证失败' }, { status: 400 });
    }

    // ── Mint vouchers (idempotent) ──────────────────────────────
    const voucherIds = await mintVouchersForPurchase(db, {
      userId: auth.uid,
      purchaseId,
      voucherCount: Number(purchaseData.voucherCount) || 0,
    });

    // ── Atomic: flip status='paid' + bump customer LTV ──────────
    // Voucher purchase is "stored value" cash inflow (MFRS 15 contract
    // liability), but for CRM/LTV view, the customer DID give us this
    // cash and should see it in their lifetime spend.
    // Transaction with status='paid' guard makes it idempotent across
    // double-clicks / network retries.
    const { FieldValue } = await import('firebase-admin/firestore');
    const userRef = db.collection('users').doc(auth.uid);
    let shouldClaimPromo = false;
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(purchaseRef);
      if (!fresh.exists) return;
      const d = fresh.data() || {};
      if (d.status === 'paid') return; // already finalized
      shouldClaimPromo = !!d.promoCode;
      tx.update(purchaseRef, {
        status: 'paid',
        razorpayPaymentId,
        razorpaySignature,
        paidAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.update(userRef, {
        totalSpent: FieldValue.increment(Number(d.amountPaid) || 0),
      });
    });

    // Burn the promo voucher only on a first-time paid transition. Wrapped
    // in try/catch so a flaky voucher-claim doesn't fail the customer's
    // purchase — they already paid and the vouchers are already minted.
    if (shouldClaimPromo && purchaseData.promoCode) {
      try {
        await claimPromoVoucher(db, purchaseData.promoCode, auth.uid);
      } catch (e) {
        console.warn('Failed to claim promo voucher on meal-voucher purchase:', e);
      }
    }

    return NextResponse.json({
      success: true,
      purchaseId,
      voucherCount: voucherIds.length,
      voucherIds,
    });
  } catch (err: any) {
    console.error('confirm-meal-voucher-purchase error:', err);
    return NextResponse.json({ error: err.message || '确认失败' }, { status: 500 });
  }
}
