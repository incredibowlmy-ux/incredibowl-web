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

const POINTS_PER_REFERRAL = 50;

/**
 * POST /api/referral-stats
 * Auth: Bearer token
 *
 * Returns counts of users who signed up using the caller's referralCode,
 * split by whether their first-order bonus has been awarded yet.
 *
 * Server-side because the locked-down Firestore Rules forbid clients from
 * querying `users` where referredBy == X.
 */
export async function POST(req: NextRequest) {
    const auth = await verifyAuth(req);
    if (!auth) {
        return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    try {
        const db = await getDb();
        const me = await db.collection('users').doc(auth.uid).get();
        if (!me.exists) {
            return NextResponse.json({ error: '用户不存在' }, { status: 404 });
        }
        const myCode = me.data()?.referralCode;
        if (!myCode) {
            return NextResponse.json({
                referredCount: 0,
                confirmedCount: 0,
                pendingCount: 0,
                pointsEarned: 0,
            });
        }

        const refereesSnap = await db.collection('users')
            .where('referredBy', '==', myCode)
            .get();

        let confirmedCount = 0;
        let pendingCount = 0;
        for (const doc of refereesSnap.docs) {
            const d = doc.data() || {};
            if (d.referralBonusAwarded === true) confirmedCount++;
            else pendingCount++;
        }

        return NextResponse.json({
            referredCount: refereesSnap.size,
            confirmedCount,
            pendingCount,
            pointsEarned: confirmedCount * POINTS_PER_REFERRAL,
        });
    } catch (err) {
        console.error('referral-stats error:', err);
        return NextResponse.json({ error: '查询失败' }, { status: 500 });
    }
}
