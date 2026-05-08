import { NextRequest, NextResponse } from 'next/server';

const REDEEM_COST = 100;
const VOUCHER_DISCOUNT_RM = 10;
const VOUCHER_VALID_DAYS = 30;
const MAX_COLLISION_RETRIES = 5;

let adminDb: FirebaseFirestore.Firestore | null = null;
async function getDb() {
    if (adminDb) return adminDb;
    const { getAdminDb } = await import('@/lib/firebase-admin');
    adminDb = getAdminDb();
    return adminDb;
}

async function verifyUser(req: NextRequest): Promise<{ uid: string } | null> {
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

function generateCode(): string {
    return 'POINTS-' + Math.random().toString(36).substring(2, 7).toUpperCase();
}

/**
 * POST /api/redeem-points
 *
 * Atomically deducts 100 points from the signed-in user and creates a
 * RM10 voucher (POINTS-XXXXX, 30-day expiry). Uses a Firestore transaction
 * so a partial failure cannot leave the user with deducted points but no
 * voucher (the bug that existed when the client wrote both docs directly).
 */
export async function POST(req: NextRequest) {
    const auth = await verifyUser(req);
    if (!auth) {
        return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    try {
        const db = await getDb();
        const { Timestamp } = await import('firebase-admin/firestore');

        const userRef = db.collection('users').doc(auth.uid);

        // Try a few times in the (extremely unlikely) event of code collision.
        let lastError: unknown = null;
        for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt++) {
            const code = generateCode();
            const voucherRef = db.collection('vouchers').doc(code);

            try {
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + VOUCHER_VALID_DAYS);

                const result = await db.runTransaction(async (tx) => {
                    const userSnap = await tx.get(userRef);
                    if (!userSnap.exists) {
                        throw new Error('USER_NOT_FOUND');
                    }
                    const userData = userSnap.data() || {};
                    const currentPoints = typeof userData.points === 'number' ? userData.points : 0;
                    if (currentPoints < REDEEM_COST) {
                        throw new Error('INSUFFICIENT_POINTS');
                    }

                    const voucherSnap = await tx.get(voucherRef);
                    if (voucherSnap.exists) {
                        throw new Error('CODE_COLLISION');
                    }

                    tx.update(userRef, { points: currentPoints - REDEEM_COST });
                    tx.set(voucherRef, {
                        code,
                        discount: VOUCHER_DISCOUNT_RM,
                        isUsed: false,
                        usedBy: '',
                        source: 'points-redemption',
                        redeemedBy: auth.uid,
                        createdAt: Timestamp.now(),
                        expiresAt: Timestamp.fromDate(expiresAt),
                    });

                    return { code, expiresAt: expiresAt.toISOString(), pointsAfter: currentPoints - REDEEM_COST };
                });

                return NextResponse.json({
                    success: true,
                    code: result.code,
                    discount: VOUCHER_DISCOUNT_RM,
                    expiresAt: result.expiresAt,
                    pointsAfter: result.pointsAfter,
                });
            } catch (err: unknown) {
                lastError = err;
                const msg = err instanceof Error ? err.message : '';
                if (msg === 'CODE_COLLISION') {
                    // retry with a fresh code
                    continue;
                }
                if (msg === 'USER_NOT_FOUND') {
                    return NextResponse.json({ error: '用户不存在' }, { status: 404 });
                }
                if (msg === 'INSUFFICIENT_POINTS') {
                    return NextResponse.json({ error: '积分不足，需要 100 分才能兑换' }, { status: 400 });
                }
                throw err;
            }
        }

        console.error('redeem-points: exhausted collision retries', lastError);
        return NextResponse.json({ error: '兑换失败，请稍后再试' }, { status: 500 });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '兑换失败';
        console.error('redeem-points error:', err);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
