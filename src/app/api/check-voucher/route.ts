import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { validateVoucher } from '@/lib/voucherValidation';
import { verifyBearerUser } from '@/lib/adminApi';
import { checkBurst, checkDailyQuota } from '@/lib/rateLimit';

/**
 * POST /api/check-voucher — 结账前预校验优惠码。
 *
 * 🔒 2026-07-26 加固（原来零认证 + 零限流）：
 *   ① 必须带 Firebase ID token；userId 一律取自 token，不再读请求体
 *      —— 旧版可以传任意 uid 探测「某个用户用没用过某码」。
 *   ② 限流：突发 10 次/分钟 + 每人每天 30 次。正常顾客一单最多试一两个码；
 *      枚举优惠码（返回体直接带 discount 和 remainingUses）需要成千上万次。
 *
 * 调用方（CartDrawer / MealVouchersView）本来就要求先登录才让点「应用」，
 * 所以加认证不影响任何正常流程。
 */

const BURST = { max: 10, windowMs: 60_000 };
const DAILY_LIMIT = 30;

export async function POST(request: NextRequest) {
    try {
        const auth = await verifyBearerUser(request);
        if (!auth) {
            return NextResponse.json({ error: '请先登录再使用优惠码' }, { status: 401 });
        }

        const burst = checkBurst(`check-voucher:${auth.uid}`, BURST);
        if (!burst.ok) {
            return NextResponse.json(
                { error: '尝试次数过多，请稍后再试' },
                { status: 429, headers: { 'Retry-After': String(burst.retryAfterSec) } },
            );
        }

        const { voucherCode } = await request.json();
        if (!voucherCode) {
            return NextResponse.json({ error: '请输入优惠码' }, { status: 400 });
        }

        const db = getAdminDb();

        // 管理员不占配额（后台核对优惠码时会连查多次）
        if (!auth.isAdmin) {
            const quota = await checkDailyQuota(db, 'check-voucher', auth.uid, DAILY_LIMIT);
            if (!quota.ok) {
                return NextResponse.json(
                    { error: '今日优惠码尝试次数已达上限，请明天再试或联系碗妈' },
                    { status: 429 },
                );
            }
        }

        // userId 来自 token —— 请求体里的 userId 一律忽略
        const result = await validateVoucher(db, voucherCode, { userId: auth.uid });

        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        return NextResponse.json({
            valid: true,
            discount: result.discount,
            remainingUses: result.remainingUses,
            maxUses: result.maxUses,
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '验证失败';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
