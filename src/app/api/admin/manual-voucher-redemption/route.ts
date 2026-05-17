import { NextRequest, NextResponse } from 'next/server';
import { claimMealVouchers, countAvailableVouchers } from '@/lib/mealVoucherUtils';
import { normalizePhone } from '@/lib/phoneUtils';

const ADMIN_EMAILS = ['hello@incredibowl.my', 'incredibowl.my@gmail.com'];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function corsify(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

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
 * POST /api/admin/manual-voucher-redemption
 * Auth: admin email
 *
 * FIFO-claims N vouchers from a specific user's available pool and links
 * them to an existing food order. Mirrors what /api/submit-order does
 * automatically for web checkouts, but for manually-entered offline orders.
 *
 * Flow:
 *   1. Resolve user (by userId OR phone)
 *   2. Check available count
 *   3. claimMealVouchers — atomic FIFO mark as redeemed
 *   4. Update the order doc with mealVouchersUsed + claimedMealVoucherIds
 *      + mealVoucherAllocatedRevenue (MFRS 15 revenue recognition)
 *
 * Body:
 *   - phone?: string OR userId?: string (one required)
 *   - voucherCount: number (required, > 0)
 *   - orderId: string (required — must exist in `orders`)
 */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return corsify(NextResponse.json({ error: '未授权访问' }, { status: 403 }));

  try {
    const body = await req.json();
    const { phone, userId: bodyUserId, voucherCount, orderId } = body || {};

    const count = Math.floor(Number(voucherCount) || 0);
    if (count <= 0) {
      return corsify(NextResponse.json({ error: '餐券数量必须大于 0' }, { status: 400 }));
    }
    if (!orderId || typeof orderId !== 'string') {
      return corsify(NextResponse.json({ error: '缺少订单 ID' }, { status: 400 }));
    }

    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');

    // ── 1. Resolve user ───────────────────────────────────────────
    let userId = typeof bodyUserId === 'string' && bodyUserId.trim() ? bodyUserId.trim() : '';
    if (!userId) {
      if (!phone || typeof phone !== 'string') {
        return corsify(NextResponse.json({ error: '请提供电话或 userId' }, { status: 400 }));
      }
      const normalized = normalizePhone(phone);
      if (!normalized) return corsify(NextResponse.json({ error: '电话格式无效' }, { status: 400 }));
      const userSnap = await db.collection('users')
        .where('phoneNormalized', '==', normalized)
        .limit(1)
        .get();
      if (userSnap.empty) {
        return corsify(NextResponse.json({ error: '找不到该电话对应的客户账号（请先卖券，会自动建账号）' }, { status: 404 }));
      }
      userId = userSnap.docs[0].id;
    }

    // ── 2. Verify order exists ─────────────────────────────────────
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return corsify(NextResponse.json({ error: '订单不存在' }, { status: 404 }));
    }

    // Guard: don't double-redeem
    const orderData = orderSnap.data() || {};
    if (Array.isArray(orderData.claimedMealVoucherIds) && orderData.claimedMealVoucherIds.length > 0) {
      return corsify(NextResponse.json({
        error: `该订单已抵扣 ${orderData.claimedMealVoucherIds.length} 张餐券，不可重复操作`,
      }, { status: 400 }));
    }

    // ── 3. Available count check (friendlier error than claim's exception) ──
    const available = await countAvailableVouchers(db, userId);
    if (available < count) {
      return corsify(NextResponse.json({
        error: `客户餐券不足：要扣 ${count} 张，可用 ${available} 张`,
        available,
      }, { status: 400 }));
    }

    // ── 4. Atomic FIFO claim ───────────────────────────────────────
    const claimed = await claimMealVouchers(db, userId, count, orderId);

    // ── 5. Write back to the order ─────────────────────────────────
    await orderRef.update({
      mealVouchersUsed: count,
      claimedMealVoucherIds: claimed.ids,
      mealVoucherAllocatedRevenue: claimed.allocatedTotalRM,
      redemptionRecordedBy: admin.email,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return corsify(NextResponse.json({
      success: true,
      orderId,
      userId,
      voucherCount: count,
      claimedVoucherIds: claimed.ids,
      allocatedTotalRM: claimed.allocatedTotalRM,
    }));
  } catch (err: any) {
    console.error('admin manual-voucher-redemption error:', err);
    return corsify(NextResponse.json({ error: err?.message || '操作失败' }, { status: 500 }));
  }
}
