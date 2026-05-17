import { NextRequest, NextResponse } from 'next/server';
import { releaseMealVouchers } from '@/lib/mealVoucherUtils';

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
 * POST /api/admin/manual-voucher-release
 * Auth: admin email
 *
 * Releases previously-claimed meal vouchers back to status='available' — used
 * when admin deletes / cancels a redeemed order to avoid leaving vouchers
 * permanently marked 'redeemed'. Mirrors the web /api/confirm-order release.
 *
 * Body:
 *   - voucherIds: string[] (required) — the claimedMealVoucherIds array
 *     stored on the order being cancelled
 */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return corsify(NextResponse.json({ error: '未授权访问' }, { status: 403 }));

  try {
    const body = await req.json();
    const { voucherIds } = body || {};
    if (!Array.isArray(voucherIds) || voucherIds.length === 0) {
      return corsify(NextResponse.json({ error: '缺少 voucherIds' }, { status: 400 }));
    }

    const db = await getDb();
    await releaseMealVouchers(db, voucherIds);

    return corsify(NextResponse.json({
      success: true,
      releasedCount: voucherIds.length,
    }));
  } catch (err: any) {
    console.error('admin manual-voucher-release error:', err);
    return corsify(NextResponse.json({ error: err?.message || '操作失败' }, { status: 500 }));
  }
}
