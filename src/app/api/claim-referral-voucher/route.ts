import { NextRequest, NextResponse } from 'next/server';

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
 * POST /api/claim-referral-voucher
 * Auth: Bearer
 *
 * Mints the RM 10 referral voucher for the caller — but only after
 * they have committed real contact info:
 *   - phoneNormalized set
 *   - addressVerifiedAt set (geocode confirmed)
 *   - referredBy set on user doc
 *   - referralVoucherClaimed not already true
 *
 * Re-runs the anti-fraud checks with the user's actual saved phone
 * (since the signup-time check often happens before phone is known on
 * Google/Facebook signups). This is the gate that prevents abuse:
 * burner Google accounts can't keep harvesting vouchers because the
 * phone-match check rejects re-use of the same SIM.
 *
 * Idempotent — safe to call multiple times. Returns the existing
 * voucher code if it was already claimed (no double-mint).
 */
export async function POST(req: NextRequest) {
    const auth = await verifyAuth(req);
    if (!auth) {
        return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    try {
        const db = await getDb();
        const userRef = db.collection('users').doc(auth.uid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
            return NextResponse.json({ error: '用户不存在' }, { status: 404 });
        }
        const userData = userSnap.data() || {};

        // Already claimed → no-op idempotent return.
        if (userData.referralVoucherClaimed === true) {
            return NextResponse.json({ alreadyClaimed: true });
        }

        // No referral on file.
        const referredBy = typeof userData.referredBy === 'string' ? userData.referredBy : null;
        if (!referredBy) {
            return NextResponse.json({ valid: false, reason: 'no_referral' });
        }

        // Profile must be complete.
        const phoneNormalized = typeof userData.phoneNormalized === 'string' ? userData.phoneNormalized : null;
        if (!phoneNormalized) {
            return NextResponse.json({ valid: false, reason: 'phone_missing', message: '请先填写手机号' });
        }
        if (!userData.addressVerifiedAt) {
            return NextResponse.json({ valid: false, reason: 'address_unverified', message: '请先确认配送地址' });
        }

        // Look up referrer & re-run anti-fraud checks.
        const refQuery = await db.collection('users')
            .where('referralCode', '==', referredBy)
            .limit(1)
            .get();
        if (refQuery.empty) {
            return NextResponse.json({ valid: false, reason: 'referrer_not_found' });
        }
        const referrerDoc = refQuery.docs[0];
        const referrerData = referrerDoc.data() || {};

        if (referrerDoc.id === auth.uid) {
            return NextResponse.json({ valid: false, reason: 'self_referral' });
        }

        const referrerOrders = typeof referrerData.totalOrders === 'number' ? referrerData.totalOrders : 0;
        if (referrerOrders < 1) {
            return NextResponse.json({ valid: false, reason: 'referrer_no_orders' });
        }

        if (referrerData.phoneNormalized && referrerData.phoneNormalized === phoneNormalized) {
            return NextResponse.json({
                valid: false,
                reason: 'phone_match',
                message: '推荐券无法发放：手机号与推荐人相同',
            });
        }

        // Mint voucher with collision retry.
        const { Timestamp, FieldValue } = await import('firebase-admin/firestore');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + REFERRAL_VOUCHER_VALID_DAYS);

        let lastError: unknown = null;
        for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt++) {
            const voucherCode = generateVoucherCode();
            const voucherRef = db.collection('vouchers').doc(voucherCode);
            try {
                await db.runTransaction(async (tx) => {
                    // Re-read user inside tx to prevent double-mint races.
                    const liveUser = await tx.get(userRef);
                    if (liveUser.data()?.referralVoucherClaimed === true) {
                        throw new Error('ALREADY_CLAIMED');
                    }
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

                    tx.update(userRef, {
                        referralVoucherClaimed: true,
                        referralVoucherClaimedAt: FieldValue.serverTimestamp(),
                    });
                });

                return NextResponse.json({
                    valid: true,
                    voucherCode,
                    discount: REFERRAL_VOUCHER_DISCOUNT_RM,
                    expiresAt: expiresAt.toISOString(),
                });
            } catch (err) {
                lastError = err;
                const msg = err instanceof Error ? err.message : '';
                if (msg === 'CODE_COLLISION') continue;
                if (msg === 'ALREADY_CLAIMED') {
                    return NextResponse.json({ alreadyClaimed: true });
                }
                throw err;
            }
        }

        console.error('claim-referral-voucher: collision retries exhausted', lastError);
        return NextResponse.json({ error: '系统繁忙，请稍后再试' }, { status: 500 });
    } catch (err) {
        console.error('claim-referral-voucher error:', err);
        return NextResponse.json({ error: '领取失败' }, { status: 500 });
    }
}
