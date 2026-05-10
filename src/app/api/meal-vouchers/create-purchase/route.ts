import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { getBundle, MEAL_VOUCHER_VALIDITY_DAYS } from '@/data/mealVoucherConfig';
import { validateBundleClientPrice } from '@/lib/mealVoucherUtils';

let adminDb: FirebaseFirestore.Firestore | null = null;
async function getDb() {
  if (adminDb) return adminDb;
  const { getAdminDb } = await import('@/lib/firebase-admin');
  adminDb = getAdminDb();
  return adminDb;
}

let razorpay: Razorpay | null = null;
function getRazorpay() {
  if (!razorpay) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }
  return razorpay;
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
 * POST /api/meal-vouchers/create-purchase
 * Auth: Bearer token
 *
 * Body:
 *   - bundleId: '5' | '10' | '20'
 *   - clientPrice: number  (RM, must match server price)
 *   - paymentMethod: 'fpx' | 'qr'
 *   - receiptUrl?: string  (required for QR mode)
 *
 * Creates a pending mealVoucherPurchases doc. For FPX, also creates a
 * Razorpay order so the client can open the checkout modal.
 *
 * Vouchers are NOT minted here — only on confirm-purchase (FPX) or
 * admin-confirm-purchase (QR).
 */
export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  try {
    const body = await req.json();
    const { bundleId, clientPrice, paymentMethod, receiptUrl } = body;

    // ── Validate bundle + price ─────────────────────────────────
    const validation = validateBundleClientPrice(bundleId, Number(clientPrice));
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const bundle = getBundle(bundleId)!;

    if (!['fpx', 'qr'].includes(paymentMethod)) {
      return NextResponse.json({ error: '无效支付方式' }, { status: 400 });
    }
    if (paymentMethod === 'qr' && !receiptUrl) {
      return NextResponse.json({ error: 'QR 付款需上传付款凭证' }, { status: 400 });
    }

    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');

    // Pull user info for record-keeping
    const userSnap = await db.collection('users').doc(auth.uid).get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};

    // ── Create the purchase doc (pending) ───────────────────────
    const purchaseDoc: Record<string, any> = {
      userId: auth.uid,
      userName: userData.displayName || '',
      userEmail: userData.email || '',
      userPhone: userData.phone || '',
      bundleId: bundle.id,
      voucherCount: bundle.voucherCount,
      amountPaid: bundle.price,
      validityDays: MEAL_VOUCHER_VALIDITY_DAYS,
      paymentMethod,
      // FPX flow → 'pending' until confirm-purchase verifies signature
      // QR  flow → 'pending-review' until admin confirms manually
      status: paymentMethod === 'fpx' ? 'pending' : 'pending-review',
      receiptUploaded: !!receiptUrl,
      ...(receiptUrl ? { receiptUrl } : {}),
      voucherIds: [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const purchaseRef = await db.collection('mealVoucherPurchases').add(purchaseDoc);

    // ── FPX: create Razorpay order ──────────────────────────────
    if (paymentMethod === 'fpx') {
      const rzp = getRazorpay();
      const order = await rzp.orders.create({
        amount: Math.round(bundle.price * 100), // sen
        currency: 'MYR',
        receipt: `mv_${purchaseRef.id}`.slice(0, 40),
        notes: {
          purchaseId: purchaseRef.id,
          bundleId: bundle.id,
          voucherCount: String(bundle.voucherCount),
          userId: auth.uid,
          kind: 'meal-voucher',
        },
      });

      // Stash Razorpay order ID for cross-referencing
      await purchaseRef.update({
        razorpayOrderId: order.id,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        purchaseId: purchaseRef.id,
        razorpayOrderId: order.id,
        amount: order.amount,
        currency: order.currency,
        bundle: {
          id: bundle.id,
          voucherCount: bundle.voucherCount,
          price: bundle.price,
        },
      });
    }

    // ── QR: just return the purchase ID; admin confirms later ───
    return NextResponse.json({
      purchaseId: purchaseRef.id,
      pendingReview: true,
      bundle: {
        id: bundle.id,
        voucherCount: bundle.voucherCount,
        price: bundle.price,
      },
    });
  } catch (err: any) {
    console.error('create-meal-voucher-purchase error:', err);
    return NextResponse.json({ error: err.message || '创建订单失败' }, { status: 500 });
  }
}
