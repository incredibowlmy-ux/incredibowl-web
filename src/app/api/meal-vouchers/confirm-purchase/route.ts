import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { finalizeMealVoucherPurchase } from '@/lib/mealVoucherUtils';

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

    // 🔒 2026-08-02：这条路**只服务 FPX**。
    //
    // 旧写法 `if (purchaseData.razorpayOrderId && ...)` 是短路的：QR 单在
    // create-purchase 里 status = 'pending-review' 且**根本不写 razorpayOrderId**
    //（只有 FPX 分支才写），所以整个绑定校验被跳过，只剩「签名本身有效吗」。
    // 攻击者真买一次最小套餐拿到 fpx_oid/fpx_pid/fpx_sig（FPX 跳回时明文挂 URL 上），
    // 再新建任意个 QR purchase，拿同一套签名反复调这个接口 → 无限铸免费餐券。
    //
    // QR 单必须由老板核过收据后走 /api/admin/confirm-meal-voucher-purchase 铸券
    // —— 即「收到钱才批」这条业务规则，现在由服务端强制，而不是靠人工把关
    //（人工根本看不到：走这条路的 QR 单会直接翻成 paid，压根不进待核队列）。
    if (purchaseData.paymentMethod !== 'fpx') {
      return NextResponse.json({ error: '此订单不是 FPX 支付，请等待人工确认' }, { status: 400 });
    }
    // 绑定必须**存在且相等** —— 不允许「没有绑定就放行」。
    if (!purchaseData.razorpayOrderId || purchaseData.razorpayOrderId !== razorpayOrderId) {
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

    // ── Finalize: mint + flip paid + bump LTV + burn promo ──────
    // Shared with /api/payment/webhook so the browser path and the Curlec
    // server-to-server path can never drift. Idempotent across retries.
    const { voucherIds } = await finalizeMealVoucherPurchase(db, purchaseId, {
      razorpayPaymentId,
      razorpaySignature,
      source: 'client-confirm',
    });

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
