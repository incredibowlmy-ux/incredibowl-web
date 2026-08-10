/**
 * Server-side voucher validation shared by /api/check-voucher and /api/submit-order.
 *
 * Layered checks (in order):
 *   1. Voucher exists
 *   2. Not expired
 *   3. Global usage cap (maxUses) not exceeded
 *   4. (per-user) Current user has not already redeemed this code
 *   5. (per-user) Current user has not redeemed a MUTUALLY EXCLUSIVE code
 *   6. (phone dedup) No OTHER user with the same normalized phone has redeemed
 *      this code — or an exclusive one
 *
 * Steps 4–6 are skipped when userId is missing (anonymous pre-check).
 *
 * Returns { ok: true, discount, ... } or { ok: false, error, status }.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { normalizePhone } from './phoneUtils';

/**
 * Atomically consume one use of a promo voucher and dedupe it on the user.
 *
 * Mirrors the in-flight logic in /api/confirm-order so meal-voucher purchases
 * can burn the same code when an FPX payment settles or admin approves a QR
 * receipt. Idempotent at the caller — call sites must guard with a status
 * transition so we don't double-claim across retries.
 *
 * Race-safe: if another order/purchase fully claimed the code between
 * validate-time and confirm-time, we skip the increment but DO NOT throw —
 * the customer already paid and we'd rather honor the order than reverse.
 */
export async function claimPromoVoucher(
    db: Firestore,
    voucherCodeRaw: string,
    userId: string,
): Promise<void> {
    const code = (voucherCodeRaw || '').trim().toUpperCase();
    if (!code || !userId) return;
    const voucherRef = db.collection('vouchers').doc(code);
    const userRef = db.collection('users').doc(userId);
    await db.runTransaction(async (tx) => {
        const vSnap = await tx.get(voucherRef);
        if (!vSnap.exists) return;
        const v = vSnap.data() || {};
        const max = typeof v.maxUses === 'number' && v.maxUses > 0 ? v.maxUses : 1;
        const used = typeof v.usedCount === 'number' ? v.usedCount : (v.isUsed ? 1 : 0);
        if (used >= max) return;
        const nextUsed = used + 1;
        tx.update(voucherRef, {
            usedCount: nextUsed,
            isUsed: nextUsed >= max,
            usedBy: userId,
            usedAt: FieldValue.serverTimestamp(),
        });
        tx.set(
            userRef,
            { vouchersUsed: FieldValue.arrayUnion(code) },
            { merge: true }
        );
    });
}

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

    // excludeIfUsed：互斥码组。写在**这个码自己的文档**上（不是写死在代码里），
    // 语义是「用过里面任何一个码的账号，不能再用我」。
    //
    // 用途：DAD5 这类节日新客码不该发给已经领过 BOWL5 / FIRST5 的老客——
    // 「每个码每人一次」挡不住同一个人把几个新客码轮流用一遍。
    //
    // 之所以放 Firestore 而不是代码常量：validateVoucher 本来就读了这个文档，
    // 判定零额外查询；加新的互斥关系不用发版。
    // ⚠️ 手填字段的老陷阱（见 vouchers 集合其它字段）：类型错了不报错。这里
    //    只认「字符串数组」，逐项 trim + 大写；不是数组 / 混了脏值一律忽略，
    //    最坏结果是这条规则不生效，绝不会误伤正常客人。
    const excludeIfUsed: string[] = Array.isArray(data.excludeIfUsed)
        ? data.excludeIfUsed
              .filter((c: unknown): c is string => typeof c === 'string')
              .map((c) => c.trim().toUpperCase())
              .filter((c) => c && c !== code)
        : [];

    // Per-user + phone dedup (only when we know who's checking).
    if (opts.userId) {
        const userSnap = await db.collection('users').doc(opts.userId).get();
        const userData = userSnap.data() || {};

        const usedByMe: string[] = Array.isArray(userData.vouchersUsed) ? userData.vouchersUsed : [];
        if (usedByMe.includes(code)) {
            return { ok: false, error: '您已使用过此优惠码', status: 400 };
        }
        if (excludeIfUsed.some((c) => usedByMe.includes(c))) {
            return { ok: false, error: '此优惠码不能与您已使用过的新客优惠同享', status: 400 };
        }

        // firstOrderOnly：公开发放的拉新码（网站自助领取的首单 RM5）用它挡住
        // 老客户。totalOrders 由 /api/confirm-order:183 在首次确认时 +1，所以
        // 「还没有一张确认单」== 新客。
        //
        // 匿名访客每次都是新 uid、totalOrders 恒为 0，靠下面的 phoneNormalized
        // 去重兜底 —— 同一个手机号第二次来，会在这里被 usedByPhone 拦下。
        if (data.firstOrderOnly === true) {
            const placed = typeof userData.totalOrders === 'number' ? userData.totalOrders : 0;
            if (placed > 0) {
                return { ok: false, error: '此优惠码只限首次下单使用', status: 400 };
            }
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
                if (excludeIfUsed.some((c) => otherUsed.includes(c))) {
                    return {
                        ok: false,
                        error: '此手机号已在另一个账户领过新客优惠，不能再用此码',
                        status: 400,
                    };
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
