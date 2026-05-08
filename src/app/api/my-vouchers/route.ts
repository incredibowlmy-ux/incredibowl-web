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

interface MyVoucher {
    code: string;
    discount: number;
    source: string;
    expiresAt: string;
    daysLeft: number;
}

/**
 * POST /api/my-vouchers
 * Auth: Bearer token
 *
 * Returns the caller's currently usable vouchers — minted via points
 * redemption (POINTS-*) or referral (REFERRAL-*) — that are not yet used
 * and not expired. Server-side because Firestore Rules block clients
 * from querying the `vouchers` collection.
 */
export async function POST(req: NextRequest) {
    const auth = await verifyAuth(req);
    if (!auth) {
        return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    try {
        const db = await getDb();
        // Filter on a single field (redeemedBy) so no composite index is
        // required. Used / expired filtering happens here in JS.
        const snap = await db.collection('vouchers')
            .where('redeemedBy', '==', auth.uid)
            .get();

        const now = Date.now();
        const vouchers: MyVoucher[] = [];

        for (const doc of snap.docs) {
            const v = doc.data() || {};
            if (v.isUsed === true) continue;

            const maxUses = typeof v.maxUses === 'number' && v.maxUses > 0 ? v.maxUses : 1;
            const usedCount = typeof v.usedCount === 'number' ? v.usedCount : 0;
            if (usedCount >= maxUses) continue;

            const expiresAtMs = v.expiresAt?.toMillis ? v.expiresAt.toMillis() : null;
            if (!expiresAtMs || expiresAtMs <= now) continue;

            const daysLeft = Math.max(0, Math.ceil((expiresAtMs - now) / 86_400_000));

            vouchers.push({
                code: doc.id,
                discount: typeof v.discount === 'number' ? v.discount : 0,
                source: typeof v.source === 'string' ? v.source : 'voucher',
                expiresAt: new Date(expiresAtMs).toISOString(),
                daysLeft,
            });
        }

        // Soonest-expiring first.
        vouchers.sort((a, b) => a.daysLeft - b.daysLeft);

        return NextResponse.json({ vouchers });
    } catch (err) {
        console.error('my-vouchers error:', err);
        return NextResponse.json({ error: '查询失败' }, { status: 500 });
    }
}
