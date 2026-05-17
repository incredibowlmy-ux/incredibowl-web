import { NextRequest, NextResponse } from 'next/server';
import { claimPromoVoucher, validateVoucher } from '@/lib/voucherValidation';
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
 * POST /api/admin/claim-promo-voucher
 * Auth: admin
 *
 * Burns a promo voucher on behalf of a customer (manual order entry). Mirrors
 * the claim that /api/confirm-order does after FPX/QR payment settles. Atomic
 * via the existing claimPromoVoucher helper.
 *
 * Validates first to surface friendly errors (expired / already used / dedup).
 * Per-user dedup requires a real user account — phone must resolve to a user
 * doc. If phone doesn't resolve (rare with how we build orders), we fail loud
 * rather than silently skipping dedup.
 *
 * Body: { code: string, phone: string }   OR   { code, userId }
 * Returns: { success: true, code, discount } | { error }
 */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return corsify(NextResponse.json({ error: '未授权访问' }, { status: 403 }));

  try {
    const body = await req.json();
    const { code, phone, userId: bodyUserId } = body || {};
    if (!code || typeof code !== 'string') {
      return corsify(NextResponse.json({ error: '缺少优惠码' }, { status: 400 }));
    }

    const db = await getDb();

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
        return corsify(NextResponse.json({ error: '找不到该电话对应的客户账号 — 优惠码需绑定到实名账号' }, { status: 404 }));
      }
      userId = userSnap.docs[0].id;
    }

    // Validate first for the friendly error path (validateVoucher returns
    // a structured result instead of throwing on already-used / expired).
    const check = await validateVoucher(db, code, { userId });
    if (!check.ok) {
      return corsify(NextResponse.json({ error: check.error }, { status: check.status }));
    }

    await claimPromoVoucher(db, code, userId);

    return corsify(NextResponse.json({
      success: true,
      code: code.trim().toUpperCase(),
      discount: check.discount,
      userId,
    }));
  } catch (err: any) {
    console.error('admin claim-promo-voucher error:', err);
    return corsify(NextResponse.json({ error: err?.message || '操作失败' }, { status: 500 }));
  }
}
