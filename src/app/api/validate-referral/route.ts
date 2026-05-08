import { NextRequest, NextResponse } from 'next/server';

const REFERRAL_PATTERN = /^IB-[A-Z0-9]{4,8}$/;
const REFERRAL_VOUCHER_DISCOUNT_RM = 10;
const REFERRAL_VOUCHER_VALID_DAYS = 30;
const MAX_COLLISION_RETRIES = 5;

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

function generateVoucherCode(): string {
    return 'REFERRAL-' + Math.random().toString(36).substring(2, 7).toUpperCase();
}

/**
 * POST /api/validate-referral
 * Body: { code: string, phoneNormalized?: string }
 * Auth: Bearer token (any signed-in user)
 *
 * Validates a referral code AND mints a RM 10 first-order voucher for the
 * referee — but only if every check passes:
 *
 *   1. Code format ok (IB-XXXXX)
 *   2. Referrer exists
 *   3. Referrer is not the caller (no self-referral by uid)
 *   4. Referrer has ≥ 1 confirmed order (only "real customers" can refer —
 *      kills the "two new accounts referring each other for free RM 10 +
 *      free 50 points" loophole)
 *   5. Caller's normalized phone (if provided) does not match referrer's
 *      (kills "same person, two accounts on the same SIM")
 *
 * Returns:
 *   { valid: true,  code, voucherCode }
 *   { valid: false, reason }
 *
 * The 50-point award to the referrer still fires from /api/confirm-order
 * after the referee's first confirmed order, with its own anti-fraud
 * checks for defense in depth.
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

        // 1. UID self-referral
        if (referrerDoc.id === auth.uid) {
            return NextResponse.json({ valid: false, reason: 'self_referral' });
        }

        // 2. Referrer must be a real customer (≥ 1 confirmed order)
        const referrerOrders = typeof referrerData.totalOrders === 'number' ? referrerData.totalOrders : 0;
        if (referrerOrders < 1) {
            return NextResponse.json({
                valid: false,
                reason: 'referrer_no_orders',
                message: '推荐人需先完成至少 1 笔订单后才能推荐他人',
            });
        }

        // 3. Phone-match self-referral (same person, two accounts on same SIM)
        if (phoneNormalizedRaw && referrerData.phoneNormalized
            && phoneNormalizedRaw === referrerData.phoneNormalized) {
            return NextResponse.json({
                valid: false,
                reason: 'phone_match',
                message: '推荐码无效（手机号与推荐人相同）',
            });
        }

        // ── Mint a RM 10 voucher for the referee ──
        const { Timestamp } = await import('firebase-admin/firestore');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + REFERRAL_VOUCHER_VALID_DAYS);

        let lastError: unknown = null;
        for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt++) {
            const voucherCode = generateVoucherCode();
            const voucherRef = db.collection('vouchers').doc(voucherCode);
            try {
                await db.runTransaction(async (tx) => {
                    const vSnap = await tx.get(voucherRef);
                    if (vSnap.exists) throw new Error('CODE_COLLISION');
                    tx.set(voucherRef, {
                        code: voucherCode,
                        discount: REFERRAL_VOUCHER_DISCOUNT_RM,
                        isUsed: false,
                        usedBy: '',
                        source: 'referral',
                        redeemedBy: auth.uid,
                        referrerUid: referrerDoc.id,
                        createdAt: Timestamp.now(),
                        expiresAt: Timestamp.fromDate(expiresAt),
                    });
                });
                return NextResponse.json({
                    valid: true,
                    code: codeRaw,
                    voucherCode,
                    discount: REFERRAL_VOUCHER_DISCOUNT_RM,
                    expiresAt: expiresAt.toISOString(),
                });
            } catch (err) {
                lastError = err;
                const msg = err instanceof Error ? err.message : '';
                if (msg === 'CODE_COLLISION') continue;
                throw err;
            }
        }

        console.error('validate-referral: voucher collision retries exhausted', lastError);
        return NextResponse.json({ error: '系统繁忙，请稍后再试' }, { status: 500 });
    } catch (err) {
        console.error('validate-referral error:', err);
        return NextResponse.json({ error: '验证失败' }, { status: 500 });
    }
}
