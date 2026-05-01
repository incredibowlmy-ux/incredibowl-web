/**
 * Server-side voucher validation shared by /api/check-voucher and /api/submit-order.
 *
 * Layered checks (in order):
 *   1. Voucher exists
 *   2. Not expired
 *   3. Global usage cap (maxUses) not exceeded
 *   4. (per-user) Current user has not already redeemed this code
 *   5. (phone dedup) No OTHER user with the same normalized phone has redeemed it
 *
 * Steps 4 + 5 are skipped when userId is missing (anonymous pre-check).
 *
 * Returns { ok: true, discount, ... } or { ok: false, error, status }.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { normalizePhone } from './phoneUtils';

export type VoucherCheckResult =
    | {
          ok: true;
          discount: number;
          maxUses: number;
          usedCount: number;
          remainingUses: number;
      }
    | { ok: false; error: string; status: number };

export async function validateVoucher(
    db: Firestore,
    voucherCodeRaw: string,
    opts: { userId?: string } = {}
): Promise<VoucherCheckResult> {
    const code = (voucherCodeRaw || '').trim().toUpperCase();
    if (!code) return { ok: false, error: '请输入优惠码', status: 400 };

    const snap = await db.collection('vouchers').doc(code).get();
    if (!snap.exists) {
        return { ok: false, error: '优惠码无效，请检查后重试', status: 404 };
    }

    const data = snap.data() || {};

    if (data.expiresAt && data.expiresAt.toDate && data.expiresAt.toDate() < new Date()) {
        return { ok: false, error: '此优惠码已过期', status: 400 };
    }

    const maxUses = typeof data.maxUses === 'number' && data.maxUses > 0 ? data.maxUses : 1;
    const usedCount = typeof data.usedCount === 'number' ? data.usedCount : (data.isUsed ? 1 : 0);
    if (usedCount >= maxUses) {
        return { ok: false, error: '此优惠码已被使用', status: 400 };
    }

    // Per-user + phone dedup (only when we know who's checking).
    if (opts.userId) {
        const userSnap = await db.collection('users').doc(opts.userId).get();
        const userData = userSnap.data() || {};

        const usedByMe: string[] = Array.isArray(userData.vouchersUsed) ? userData.vouchersUsed : [];
        if (usedByMe.includes(code)) {
            return { ok: false, error: '您已使用过此优惠码', status: 400 };
        }

        const myPhone = normalizePhone(userData.phone);
        if (myPhone) {
            const sameByPhone = await db
                .collection('users')
                .where('phoneNormalized', '==', myPhone)
                .get();
            for (const otherDoc of sameByPhone.docs) {
                if (otherDoc.id === opts.userId) continue;
                const otherUsed: string[] = Array.isArray(otherDoc.data().vouchersUsed)
                    ? otherDoc.data().vouchersUsed
                    : [];
                if (otherUsed.includes(code)) {
                    return { ok: false, error: '此手机号已在另一个账户用过此优惠码', status: 400 };
                }
            }
        }
    }

    const discount = typeof data.discount === 'number' ? data.discount : 1;
    return {
        ok: true,
        discount,
        maxUses,
        usedCount,
        remainingUses: maxUses - usedCount,
    };
}
