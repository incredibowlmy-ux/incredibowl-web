import { NextRequest, NextResponse } from 'next/server';
import { mintVouchersForPurchase } from '@/lib/mealVoucherUtils';
import { claimPromoVoucher } from '@/lib/voucherValidation';
import { sendVoucherPurchaseCapi } from '@/lib/voucherPurchaseCapi';

const ADMIN_EMAILS = ['hello@incredibowl.my', 'incredibowl.my@gmail.com'];

let adminDb: FirebaseFirestore.Firestore | null = null;
async function getDb() {
  if (adminDb) return adminDb;
  const { getAdminDb } = await import('@/lib/firebase-admin');
  adminDb = getAdminDb();
  return adminDb;
}

async function verifyAdmin(req: NextRequest): Promise<{ email: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    await getDb();
    const { getAuth } = await import('firebase-admin/auth');
    const decoded = await getAuth().verifyIdToken(token);
    if (!decoded.email || !ADMIN_EMAILS.includes(decoded.email)) return null;
    return { email: decoded.email };
  } catch {
    return null;
  }
}

/**
 * POST /api/admin/confirm-meal-voucher-purchase
 * Auth: admin email
 *
 * Body:
 *   - purchaseId: string
 *   - action: 'approve' | 'reject'
 *   - reason?: string  (required for reject)
 *
 * Approve → mints N vouchers and flips purchase to status='paid'.
 * Reject  → flips purchase to status='cancelled' (no vouchers minted).
 */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: '未授权访问' }, { status: 403 });

  try {
    const { purchaseId, action, reason } = await req.json();
    if (!purchaseId) return NextResponse.json({ error: '缺少订单 ID' }, { status: 400 });
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: '无效操作' }, { status: 400 });
    }

    const db = await getDb();
    const ref = db.collection('mealVoucherPurchases').doc(purchaseId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: '订单不存在' }, { status: 404 });
    const data = snap.data() || {};

    // Idempotency: don't double-confirm or undo a finalized purchase
    if (data.status === 'paid' && action === 'approve') {
      return NextResponse.json({ success: true, alreadyPaid: true, voucherIds: data.voucherIds || [] });
    }
    if (data.status === 'cancelled' && action === 'reject') {
      return NextResponse.json({ success: true, alreadyCancelled: true });
    }
    if (data.status !== 'pending-review' && data.status !== 'pending') {
      return NextResponse.json({ error: `状态不允许此操作（当前: ${data.status}）` }, { status: 400 });
    }

    const { FieldValue } = await import('firebase-admin/firestore');

    if (action === 'reject') {
      await ref.update({
        status: 'cancelled',
        cancelReason: reason?.trim() || '',
        cancelledBy: admin.email,
        cancelledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true });
    }

    // Approve → mint
    const voucherIds = await mintVouchersForPurchase(db, {
      userId: data.userId,
      purchaseId,
      voucherCount: Number(data.voucherCount) || 0,
    });

    // Atomic: flip status='paid' + bump customer LTV (idempotent via
    // status guard so admin double-clicks don't double-bump).
    const userRef = db.collection('users').doc(data.userId);
    let shouldClaimPromo = false;
    let firstPaidTransition = false;
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(ref);
      if (!fresh.exists) return;
      const d = fresh.data() || {};
      if (d.status === 'paid') return;
      firstPaidTransition = true;
      shouldClaimPromo = !!d.promoCode;
      tx.update(ref, {
        status: 'paid',
        approvedBy: admin.email,
        paidAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.update(userRef, {
        totalSpent: FieldValue.increment(Number(d.amountPaid) || 0),
      });
    });

    // First-time paid transition → burn the promo voucher. Swallows
    // failures so a flaky voucher claim doesn't block admin approval.
    if (shouldClaimPromo && data.promoCode && data.userId) {
      try {
        await claimPromoVoucher(db, data.promoCode, data.userId);
      } catch (e) {
        console.warn('Failed to claim promo voucher on admin meal-voucher confirm:', e);
      }
    }

    // Meta CAPI Purchase —— 这是 QR 路：客户在**网站上**下的券单，老板只是
    // 核了收据，所以 action_source 仍是 'website'。但发起这个请求的浏览器是
    // 老板的，绝不能把老板的 _fbp/_fbc/IP/UA 当成客户的传过去 —— 只传客户
    // 的身份字段。事件 id 与 FPX 路共用 `voucher_<purchaseId>`，Meta 去重。
    if (firstPaidTransition) {
      await sendVoucherPurchaseCapi({
        purchaseId,
        amountPaid: Number(data.totalAmountPaid ?? data.amountPaid) || 0,
        userId: data.userId || undefined,
        userEmail: data.userEmail || undefined,
        userPhone: data.userPhone || undefined,
        actionSource: 'website',
      });
    }

    return NextResponse.json({
      success: true,
      voucherCount: voucherIds.length,
      voucherIds,
    });
  } catch (err: any) {
    console.error('admin confirm-meal-voucher-purchase error:', err);
    return NextResponse.json({ error: err.message || '操作失败' }, { status: 500 });
  }
}
