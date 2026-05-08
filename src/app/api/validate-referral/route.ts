import { NextRequest, NextResponse } from 'next/server';

const REFERRAL_PATTERN = /^IB-[A-Z0-9]{4,8}$/;

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
 * POST /api/validate-referral
 * Body: { code: string }
 * Auth: Bearer token (any signed-in user)
 *
 * Returns { valid: true, code } if a user exists with that referralCode,
 * else { valid: false }. Server-side because the client cannot read other
 * users' docs under the locked-down Firestore Rules. Auth-required to
 * prevent enumeration of referral codes by anonymous bots.
 */
export async function POST(req: NextRequest) {
    const auth = await verifyAuth(req);
    if (!auth) {
        return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    let codeRaw: string;
    try {
        const body = await req.json();
        codeRaw = String(body.code || '').trim().toUpperCase();
    } catch {
        return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
    }

    if (!REFERRAL_PATTERN.test(codeRaw)) {
        return NextResponse.json({ valid: false, reason: 'format' });
    }

    try {
        const db = await getDb();
        const snap = await db.collection('users')
            .where('referralCode', '==', codeRaw)
            .limit(1)
            .get();

        if (snap.empty) {
            return NextResponse.json({ valid: false, reason: 'not_found' });
        }

        const referrerDoc = snap.docs[0];
        // Don't allow self-referral.
        if (referrerDoc.id === auth.uid) {
            return NextResponse.json({ valid: false, reason: 'self_referral' });
        }

        return NextResponse.json({ valid: true, code: codeRaw });
    } catch (err) {
        console.error('validate-referral error:', err);
        return NextResponse.json({ error: '验证失败' }, { status: 500 });
    }
}
