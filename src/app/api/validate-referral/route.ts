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
 * Body: { code: string, phoneNormalized?: string }
 * Auth: Bearer
 *
 * Lightweight signup-time validation. Returns whether the referral code
 * looks usable so the caller can save `referredBy` on the new user's doc.
 *
 * IMPORTANT: voucher minting was moved to /api/claim-referral-voucher,
 * which fires only AFTER the new user has filled phone + verified address.
 * That defers the reward until the user has committed real contact info,
 * killing the "spin up 10 Google accounts to harvest free RM 10 vouchers"
 * abuse path. Phone-match self-referral is also re-checked there with
 * the user's actual saved phone (not whatever they typed at signup).
 *
 * Returns:
 *   { valid: true, code, deferred: true }   — save referredBy, defer mint
 *   { valid: false, reason, message? }      — show reason to caller
 */
export async function POST(req: NextRequest) {
    const auth = await verifyAuth(req);
    if (!auth) {
        return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    let codeRaw: string;
    let phoneNormalizedRaw: string | undefined;
    try {
        const body = await req.json();
        codeRaw = String(body.code || '').trim().toUpperCase();
        phoneNormalizedRaw = body.phoneNormalized ? String(body.phoneNormalized) : undefined;
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
        const referrerData = referrerDoc.data() || {};

        if (referrerDoc.id === auth.uid) {
            return NextResponse.json({ valid: false, reason: 'self_referral' });
        }

        const referrerOrders = typeof referrerData.totalOrders === 'number' ? referrerData.totalOrders : 0;
        if (referrerOrders < 1) {
            return NextResponse.json({
                valid: false,
                reason: 'referrer_no_orders',
                message: '推荐人需先完成至少 1 笔订单后才能推荐他人',
            });
        }

        if (phoneNormalizedRaw && referrerData.phoneNormalized
            && phoneNormalizedRaw === referrerData.phoneNormalized) {
            return NextResponse.json({
                valid: false,
                reason: 'phone_match',
                message: '推荐码无效（手机号与推荐人相同）',
            });
        }

        return NextResponse.json({ valid: true, code: codeRaw, deferred: true });
    } catch (err) {
        console.error('validate-referral error:', err);
        return NextResponse.json({ error: '验证失败' }, { status: 500 });
    }
}
