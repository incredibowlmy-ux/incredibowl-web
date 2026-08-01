/**
 * 取消订单 = 一次性把这单占用的所有资源还回去。**唯一实现**。
 *
 * 为什么要有这个文件（2026-07-26 审计）：
 *   取消订单以前有三条各写各的路径，回补的东西各不相同 ——
 *     · confirm-order       退了餐券 / 预付 credit / promo 券，**漏了两层库存**
 *     · release-stale-fpx   四样齐全（做得对，但从来没被调用过）
 *     · admin/data          裸 `doc.ref.update()`，**什么都不退**
 *   实测 17 笔已取消 FPX 单里 14 笔漏了库存（8 笔走 admin/data、6 笔走
 *   客户端取消）。猪扒(id 27) 07-19~07-23 漏了 3 份，直到 07-25 老板手动
 *   重设库存才被覆盖抹平 —— 期间计数器一直比真实少，接近临界会误报售罄。
 *
 * 现在三条路都调这一个函数，不可能再各退各的。
 *
 * ── 幂等：这是本文件最重要的性质 ──────────────────────────────
 * `releaseDishStock` 用的是 `FieldValue.increment(+qty)`，**不幂等**。同一单
 * 取消两次就会多加一次库存 → 计数器虚高 → 超卖（答应了做不出来的菜，比
 * 少卖严重得多）。而并发取消是真实存在的：CartDrawer 的 catch 取消一次、
 * `?fpx_error=` 跳回时 page.tsx 读 localStorage 又取消一次。
 *
 * 所以「翻状态 + 打 rollbackAt 标记」放在**同一个事务**里，只有真正翻动了
 * 状态的那次调用才继续做回补；第二次进来看到标记直接 no-op 返回。
 *
 * ── 回补本身一律 best-effort ────────────────────────────────
 * 每项独立 try/catch。库存/券回补失败**绝不能**让「取消」这个动作失败 ——
 * 订单状态已经翻了，卡在中间才是最糟的。失败项打日志，由每日盘点纠偏。
 *
 * 纯服务端（firebase-admin）。
 */

import type { Firestore } from 'firebase-admin/firestore';
import { weeklyMenu } from '@/data/weeklyMenu';
import type { PrepOrderItem } from '@/lib/prepIngredients';

/**
 * 库存系统上线时间（2026-06-29 00:00 MYT）。更早的订单当初就没扣过库存，
 * 回补它们等于凭空印库存。原本只有 release-stale-fpx 有这道闸，现在挪进来
 * 三条路共享。
 */
const STOCK_ERA_MS = Date.parse('2026-06-28T16:00:00Z');

const menuByName = new Map(weeklyMenu.map(d => [d.name, d]));
/** 订单 items 里加料是「↳ 」前缀的独立行，不是菜。 */
const isAddOnRow = (name: string) => /^↳/.test(name || '');

export interface RollbackOutcome {
    /** 本次调用是否真的翻动了状态（false = 别人已经取消过，本次 no-op）。 */
    cancelled: boolean;
    orderId: string;
    /** 各项回补结果，供调用方打日志 / 返回给 dashboard。 */
    released: {
        dishStock: number;        // 归还的菜份数
        ingredientStock: boolean; // 是否跑了原料回补
        mealVouchers: number;
        addonCredits: number;
        promoVoucher: boolean;
    };
    /** 回补过程中失败的项（不影响取消本身）。 */
    failures: string[];
}

/**
 * 取消一笔订单并归还它占用的一切。
 *
 * @param reason 写进 `cancelReason` 的审计标签。以前 confirm-order 和
 *   admin/data 都不写，导致 16 笔已取消订单查不出是谁取消的 —— 现在强制要求。
 */
export async function cancelOrderWithRollback(
    db: Firestore,
    orderId: string,
    opts: {
        reason: string;
        /**
         * 允许取消**非 pending** 的单（已确认 / 配送中 / 已送达）。
         * 只有 admin 路径能传 true —— 老板在 Dashboard 取消已确认单是合法操作
         * （真退款）。顾客侧一律不传，防止「吃完再取消把餐券和库存全额退回」。
         */
        allowNonPending?: boolean;
    },
): Promise<RollbackOutcome> {
    const { FieldValue } = await import('firebase-admin/firestore');
    const ref = db.collection('orders').doc(orderId);

    const out: RollbackOutcome = {
        cancelled: false,
        orderId,
        released: { dishStock: 0, ingredientStock: false, mealVouchers: 0, addonCredits: 0, promoVoucher: false },
        failures: [],
    };

    // ── 关口：翻状态 + 打标记，一个事务，赢家才继续 ──────────────
    let orderData: FirebaseFirestore.DocumentData | null = null;
    await db.runTransaction(async (tx) => {
        // ⚠️ 必须每次重试都重置。Firestore 事务遇到写冲突会**重跑整个回调**：
        // 第一次跑读到 pending、给 orderData 赋了值、提交时输给了并发者；重试
        // 时读到 cancelled 直接 return —— 如果不清空，上一轮的 orderData 还在，
        // 函数会以为自己是赢家继续回补库存。
        // 实测：3 个并发取消全部「获胜」，dishStock 被 +3 而不是 +1 = 超卖。
        orderData = null;
        const snap = await tx.get(ref);
        if (!snap.exists) return;
        const d = snap.data()!;
        // 已经取消过 / 已经回补过 → 本次 no-op（防双取消把库存加两遍）
        if (d.status === 'cancelled' || d.rollbackAt) return;
        // 🔒 2026-08-02 兜底闸门：终态单（confirmed / preparing / delivering /
        // delivered）不许走自助取消。菜已经做出来送出去了，退券退库存都是凭空
        // 印钱印货。调用方的鉴权是第一道锁（confirm-order 只放行 pending），
        // 这里是第二道 —— 将来第四个调用方接进来时不会重蹈覆辙。
        if (d.status !== 'pending' && !opts.allowNonPending) {
            console.warn(`[orderRollback] ${orderId} 状态为 ${d.status}，非 admin 路径不予取消`);
            return;
        }
        orderData = d;
        tx.update(ref, {
            status: 'cancelled',
            cancelReason: opts.reason,
            rollbackAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
    });

    if (!orderData) return out; // 订单不存在，或已被别人取消
    out.cancelled = true;
    const o = orderData as FirebaseFirestore.DocumentData;

    const items: PrepOrderItem[] = Array.isArray(o.items) ? o.items : [];
    const createdMs: number = o.createdAt?.toMillis?.() ?? 0;
    const inStockEra = createdMs >= STOCK_ERA_MS;

    // ── ① 菜品限量库存（硬闸门，不还会误报售罄）─────────────────
    if (inStockEra && items.length) {
        const dishItems = items
            .filter(it => it?.name && !isAddOnRow(it.name) && (it.quantity || 0) > 0)
            .map(it => {
                const dish = menuByName.get(it.name);
                if (!dish) console.warn(`[orderRollback] ${orderId} 的「${it.name}」在 weeklyMenu 里查不到（菜改名了？）—— 跳过限量回补`);
                return dish ? { dishId: dish.id, qty: it.quantity || 0, name: it.name } : null;
            })
            .filter((x): x is { dishId: number; qty: number; name: string } => x !== null);
        if (dishItems.length) {
            try {
                const { releaseDishStock } = await import('@/lib/stockUtils');
                await releaseDishStock(db, dishItems);
                out.released.dishStock = dishItems.reduce((s, d) => s + d.qty, 0);
            } catch (e) {
                out.failures.push('dishStock');
                console.error(`[orderRollback] ${orderId} dishStock 回补失败:`, e);
            }
        }
    }

    // ── ② 原料库存（advisory，每日盘点会纠偏）────────────────────
    if (inStockEra && items.length) {
        try {
            const { releaseIngredientStock } = await import('@/lib/ingredientStock');
            await releaseIngredientStock(db, items, { orderId, source: `取消回补(${opts.reason})` });
            out.released.ingredientStock = true;
        } catch (e) {
            out.failures.push('ingredientStock');
            console.error(`[orderRollback] ${orderId} ingredientStock 回补失败:`, e);
        }
    }

    // ── ③ 餐券（顾客的钱，最不能丢）──────────────────────────────
    const voucherIds: string[] = Array.isArray(o.claimedMealVoucherIds) ? o.claimedMealVoucherIds : [];
    if (voucherIds.length) {
        try {
            const { releaseMealVouchers } = await import('@/lib/mealVoucherUtils');
            await releaseMealVouchers(db, voucherIds);
            out.released.mealVouchers = voucherIds.length;
        } catch (e) {
            out.failures.push('mealVouchers');
            console.error(`[orderRollback] ${orderId} 餐券回补失败:`, e);
        }
    }

    // ── ④ 预付加料 credit ──────────────────────────────────────
    const addonLines: Array<{ addonId: string; count: number }> =
        Array.isArray(o.addonCreditsUsed) ? o.addonCreditsUsed : [];
    if (addonLines.length && o.userId) {
        try {
            const { releaseAddonCredits } = await import('@/lib/addonCreditUtils');
            await releaseAddonCredits(db, o.userId, addonLines, orderId);
            out.released.addonCredits = addonLines.reduce((s, l) => s + (Number(l.count) || 0), 0);
        } catch (e) {
            out.failures.push('addonCredits');
            console.error(`[orderRollback] ${orderId} 预付 credit 回补失败:`, e);
        }
    }

    // ── ⑤ promo 优惠码：usedCount-- + 从 user.vouchersUsed 移除 ──
    // 只有 confirm-order 的 confirmed 分支会 claim，所以只有确认过的单需要还。
    if (o.promoCode) {
        try {
            const code = String(o.promoCode).trim().toUpperCase();
            const voucherRef = db.collection('vouchers').doc(code);
            await db.runTransaction(async (tx) => {
                const vSnap = await tx.get(voucherRef);
                if (!vSnap.exists) return;
                const v = vSnap.data() || {};
                const used = typeof v.usedCount === 'number' ? v.usedCount : (v.isUsed ? 1 : 0);
                if (used <= 0) return;
                const nextUsed = used - 1;
                const max = typeof v.maxUses === 'number' && v.maxUses > 0 ? v.maxUses : 1;
                tx.update(voucherRef, {
                    usedCount: nextUsed,
                    isUsed: nextUsed >= max,
                    ...(nextUsed === 0 ? { usedBy: '', usedAt: null } : {}),
                });
            });
            if (o.userId) {
                await db.collection('users').doc(o.userId).update({
                    vouchersUsed: FieldValue.arrayRemove(o.promoCode),
                }).catch(e => console.warn(`[orderRollback] ${orderId} 用户券去重释放失败:`, e));
            }
            out.released.promoVoucher = true;
        } catch (e) {
            out.failures.push('promoVoucher');
            console.error(`[orderRollback] ${orderId} promo 券回补失败:`, e);
        }
    }

    console.log(
        `[orderRollback] ${orderId} 已取消(${opts.reason})：` +
        `菜 ${out.released.dishStock} 份 · 原料 ${out.released.ingredientStock ? '已回补' : '跳过'} · ` +
        `餐券 ${out.released.mealVouchers} 张 · credit ${out.released.addonCredits} 份 · ` +
        `promo ${out.released.promoVoucher ? '已还' : '无'}` +
        (out.failures.length ? ` · ⚠️ 失败项: ${out.failures.join(',')}` : ''),
    );

    return out;
}
