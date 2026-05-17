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
    // null = permanent voucher (no expiresAt field on the doc).
    // Used by points-migration-2026-05 and referrer-bonus vouchers.
    expiresAt: string | null;
    daysLeft: number | null;
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

            // Missing expiresAt = permanent voucher (points-migration / referrer-bonus
            // sources from the 2026-05 sunset). Matches voucherValidation.ts:88
            // which skips the expiry check when the field is absent.
            const expiresAtMs = v.expiresAt?.toMillis ? v.expiresAt.toMillis() : null;
            const isPermanent = expiresAtMs === null;
            if (!isPermanent && expiresAtMs! <= now) continue;

            const daysLeft = isPermanent
                ? null
                : Math.max(0, Math.ceil((expiresAtMs! - now) / 86_400_000));

            vouchers.push({
                code: doc.id,
                discount: typeof v.discount === 'number' ? v.discount : 0,
                source: typeof v.source === 'string' ? v.source : 'voucher',
                expiresAt: isPermanent ? null : new Date(expiresAtMs!).toISOString(),
                daysLeft,
            });
        }

        // Soonest-expiring first; permanent vouchers sink to the bottom.
        vouchers.sort((a, b) => {
            if (a.daysLeft === null && b.daysLeft === null) return 0;
            if (a.daysLeft === null) return 1;
            if (b.daysLeft === null) return -1;
            return a.daysLeft - b.daysLeft;
        });

        return NextResponse.json({ vouchers });
    } catch (err) {
        console.error('my-vouchers error:', err);
        return NextResponse.json({ error: '查询失败' }, { status: 500 });
    }
}
