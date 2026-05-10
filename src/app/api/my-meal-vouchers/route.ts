import { NextRequest, NextResponse } from 'next/server';

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
 * POST /api/my-meal-vouchers
 * Auth: Bearer token
 *
 * Returns the caller's currently-usable meal voucher count + the soonest
 * expiry date. Vouchers are filtered to status='available' AND not
 * expired.
 */
export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  try {
    const db = await getDb();
    const snap = await db.collection('mealVouchers')
      .where('userId', '==', auth.uid)
      .where('status', '==', 'available')
      .get();

    const now = Date.now();
    let availableCount = 0;
    let soonestExpiryMs: number | null = null;
    const expiryBuckets: Record<string, number> = {}; // yyyy-mm-dd -> count

    for (const doc of snap.docs) {
      const v = doc.data() || {};
      const exp = v.expiresAt;
      const expMs = exp?.toMillis ? exp.toMillis() : null;
      if (!expMs || expMs <= now) continue;

      availableCount++;
      if (soonestExpiryMs === null || expMs < soonestExpiryMs) {
        soonestExpiryMs = expMs;
      }
      const dt = new Date(expMs);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      expiryBuckets[key] = (expiryBuckets[key] || 0) + 1;
    }

    const soonestDaysLeft = soonestExpiryMs
      ? Math.max(0, Math.ceil((soonestExpiryMs - now) / 86_400_000))
      : null;

    // Also pull recent purchase history (last 5)
    const purchasesSnap = await db.collection('mealVoucherPurchases')
      .where('userId', '==', auth.uid)
      .get();
    const recentPurchases = purchasesSnap.docs
      .map(d => {
        const data = d.data() || {};
        return {
          id: d.id,
          bundleId: data.bundleId,
          voucherCount: data.voucherCount,
          amountPaid: data.amountPaid,
          paymentMethod: data.paymentMethod,
          status: data.status,
          createdAtMs: data.createdAt?.toMillis ? data.createdAt.toMillis() : null,
        };
      })
      .filter(p => p.createdAtMs !== null)
      .sort((a, b) => (b.createdAtMs! - a.createdAtMs!))
      .slice(0, 5);

    // Expiry buckets sorted by date for client display
    const expirySchedule = Object.entries(expiryBuckets)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      availableCount,
      soonestExpiryMs,
      soonestDaysLeft,
      expirySchedule,
      recentPurchases,
    });
  } catch (err: any) {
    console.error('my-meal-vouchers error:', err);
    return NextResponse.json({ error: err.message || '查询失败' }, { status: 500 });
  }
}
