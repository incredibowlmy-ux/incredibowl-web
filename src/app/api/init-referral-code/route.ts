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
 * POST /api/init-referral-code
 * Auth: Bearer token
 *
 * Backfills the deterministic `referralCode` field on the caller's user
 * doc if it's missing. Needed for users who registered before the referral
 * system existed — without this they're invisible to /api/validate-referral
 * and friends can't redeem their code.
 *
 * The value is computed server-side from uid (`'IB-' + uid[0..6].upper()`)
 * so users can't pick someone else's code. Admin SDK bypasses the
 * Firestore Rule that locks this field down.
 */
export async function POST(req: NextRequest) {
    const auth = await verifyAuth(req);
    if (!auth) {
        return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    try {
        const db = await getDb();
        const userRef = db.collection('users').doc(auth.uid);
        const snap = await userRef.get();
        if (!snap.exists) {
            return NextResponse.json({ error: '用户不存在' }, { status: 404 });
        }

        const data = snap.data() || {};
        const expected = 'IB-' + auth.uid.slice(0, 6).toUpperCase();
        if (data.referralCode === expected) {
            return NextResponse.json({ ok: true, referralCode: expected, alreadySet: true });
        }

        await userRef.update({ referralCode: expected });
        return NextResponse.json({ ok: true, referralCode: expected, alreadySet: false });
    } catch (err) {
        console.error('init-referral-code error:', err);
        return NextResponse.json({ error: '初始化失败' }, { status: 500 });
    }
}
