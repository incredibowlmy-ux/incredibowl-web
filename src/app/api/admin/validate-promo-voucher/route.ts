import { NextRequest, NextResponse } from 'next/server';
import { validateVoucher } from '@/lib/voucherValidation';
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
 * POST /api/admin/validate-promo-voucher
 * Auth: admin
 *
 * Read-only voucher lookup used by the dashboard's manual order modal to
 * auto-fill the discount RM when admin types a promo code. Performs the
 * same validation chain as /api/check-voucher:
 *   - Code exists
 *   - Not expired
 *   - Global usedCount < maxUses
 *   - (per-user dedup) if phone resolves to a real user
 *
 * Body: { code: string, phone?: string }
 * Returns: { ok, discount, remainingUses, ... } | { ok:false, error }
 */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return corsify(NextResponse.json({ error: '未授权访问' }, { status: 403 }));

  try {
    const body = await req.json();
    const { code, phone } = body || {};
    if (!code || typeof code !== 'string') {
      return corsify(NextResponse.json({ error: '缺少优惠码' }, { status: 400 }));
    }

    const db = await getDb();
    let userId: string | undefined;
    if (phone && typeof phone === 'string') {
      const normalized = normalizePhone(phone);
      if (normalized) {
        const snap = await db.collection('users')
          .where('phoneNormalized', '==', normalized)
          .limit(1)
          .get();
        if (!snap.empty) userId = snap.docs[0].id;
      }
    }

    const result = await validateVoucher(db, code, { userId });
    if (!result.ok) {
      return corsify(NextResponse.json({ ok: false, error: result.error }, { status: result.status }));
    }

    return corsify(NextResponse.json({
      ok: true,
      code: code.trim().toUpperCase(),
      discount: result.discount,
      remainingUses: result.remainingUses,
      matchedUserId: userId || null,
    }));
  } catch (err: any) {
    console.error('admin validate-promo-voucher error:', err);
    return corsify(NextResponse.json({ error: err?.message || '操作失败' }, { status: 500 }));
  }
}
