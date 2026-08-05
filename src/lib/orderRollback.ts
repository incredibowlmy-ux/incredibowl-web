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
    /**
     * 被闸门挡下时的原因（`cancelled` 为 false 且订单其实还在）。目前只有
     * 「组合单孤儿 part」一种 —— 调用方应把这句话原样显示给操作者。
     */
    blockedReason?: string;
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
        /**
         * 放行「组合单孤儿 part」（见下方闸门）。只有 scripts/cancel-group-part.mjs
         * 该传 true —— 它自己负责退券 + 修同组其他 part 的账。
         */
        allowOrphanGroupPart?: boolean;
        /**
         * 放行「已是 cancelled 但从没回补过」的历史单（2026-07-26 统一之前取消的，
         * 当时只退券不退库存 / 甚至什么都不退）。补退它们占用的资源是合法操作，
         * 但不该是默认行为 —— 要调用方明确知道自己在补历史账。
         */
        allowLegacyCancelled?: boolean;
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
    let blocked: string | null = null;
    /** 逐项回补完成进度（从订单读出，每完成一项立刻写回）—— 中途死掉可续跑。 */
    let progress: Record<string, boolean> = {};
    /** 标记某项已回补完成并立刻落库，这样进程死掉后重试知道它不用再补。 */
    const markDone = async (key: string) => {
        progress[key] = true;
        try {
            await ref.update({ [`rollbackProgress.${key}`]: true, updatedAt: FieldValue.serverTimestamp() });
        } catch (e) {
            // 落库失败不影响本次回补已经做完的事实；最坏情况是重试时重复补一次
            // 该项。所以真正危险的项（库存 increment）必须自己另有幂等保护。
            console.error(`[orderRollback] ${orderId} 记录 ${key} 进度失败:`, e);
        }
    };
    await db.runTransaction(async (tx) => {
        // ⚠️ 必须每次重试都重置。Firestore 事务遇到写冲突会**重跑整个回调**：
        // 第一次跑读到 pending、给 orderData 赋了值、提交时输给了并发者；重试
        // 时读到 cancelled 直接 return —— 如果不清空，上一轮的 orderData 还在，
        // 函数会以为自己是赢家继续回补库存。
        // 实测：3 个并发取消全部「获胜」，dishStock 被 +3 而不是 +1 = 超卖。
        orderData = null;
        blocked = null;
        progress = {};
        const snap = await tx.get(ref);
        if (!snap.exists) return;
        const d = snap.data()!;

        // ── 幂等的**唯一**判据：rollbackDoneAt（2026-08-04 修正）──────────
        // 以前这里是 `if (status === 'cancelled' || rollbackAt) return`，把
        // rollbackAt 当成了「已回补」的凭据。但 rollbackAt 是在事务里、**5 项
        // 回补开始之前**打的，回补本身全在事务外顺序 await。进程若在 commit
        // 之后、回补跑完之前被杀（函数超时 / 冷启动回收 / 崩溃），订单就停在
        // 「cancelled + rollbackAt + 只补了一半」；重试进来读到 rollbackAt 直接
        // no-op，剩下的券和库存**永远回不来**，还会报告成功。那正是 07-25
        // 猪扒漏 3 份的失效模式。现在只有 rollbackDoneAt（全部回补成功后才写）
        // 才算完成；中途死掉的单重试时**续跑**未完成项，逐项进度记在
        // rollbackProgress 里，已完成的不会重复补。
        if (d.rollbackDoneAt) return;

        const resuming = !!d.rollbackAt;
        if (!resuming) {
            // 已是取消态、却从没开始回补 —— 2026-07-26 统一之前取消的单就是这样
            // （confirm-order 只退券不退库存、admin/data 裸 update 什么都不退，
            // 文件头注释里实测 17 笔有 14 笔漏库存）。这些单的资源确实该退，但
            // 「取消一张已取消的单」不该是默认行为，要调用方显式放行。
            if (d.status === 'cancelled' && !opts.allowLegacyCancelled) {
                blocked = `#${orderId.slice(-6).toUpperCase()} 已是取消态但从未回补过`
                    + `（2026-07-26 统一前的历史单）。要补退它占用的库存/券，`
                    + `请显式传 allowLegacyCancelled。`;
                console.warn(`[orderRollback] ${blocked}`);
                return;
            }
            // 🔒 2026-08-02 兜底闸门：终态单（confirmed / preparing / delivering /
            // delivered）不许走自助取消。菜已经做出来送出去了，退券退库存都是凭空
            // 印钱印货。调用方的鉴权是第一道锁（confirm-order 只放行 pending），
            // 这里是第二道 —— 将来第四个调用方接进来时不会重蹈覆辙。
            if (d.status !== 'pending' && !opts.allowNonPending) {
                console.warn(`[orderRollback] ${orderId} 状态为 ${d.status}，非 admin 路径不予取消`);
                return;
            }
        }
        // 🔒 2026-08-04 组合单闸门：一次结账拆成多个配送日时，2026-08-04 之前
        // 下的单把餐券 claim 记录**全挂在 part 1**，其余 part 只有一个摊分出来
        // 的 mealVoucherDiscount 数字。这种「孤儿 part」直接走到下面会读到空的
        // claimedMealVoucherIds → 退 0 张券，客户的券凭空蒸发，同组其他 part 的
        // 摊销收入也跟着错位（#C77ODR 实例）。
        // 新单已在 submit-order 按组精确归属，不会再产生孤儿；历史单要么先跑
        // scripts/backfill-multipart-voucher-attribution.mjs 补归属，要么走
        // scripts/cancel-group-part.mjs（它带 allowOrphanGroupPart 并自己修账）。
        //
        // ⚠️ 餐券和预付 credit 必须**分开判**：它们是两个独立的资源池，各有各的
        // claim 字段。混在一起判会误伤「只用了 credit、且自己就带着
        // addonCreditsUsed 的 part」（part 1 正是这样）—— 它明明退得回 credit，
        // 却因为没有餐券记录被当成孤儿拦死，pending 单还会卡住不放库存。
        //
        // 字段名两套并存：网页单（submit-order）写 addonCreditDiscount（单数），
        // dashboard 手动单写 addonCreditsDiscount（复数）。闸门两个都认，否则
        // 将来手动单支持组合时这半边判据会静默失效。
        const mvDiscount = Number(d.mealVoucherDiscount || 0);
        const acDiscount = Number(d.addonCreditDiscount ?? d.addonCreditsDiscount ?? 0);
        const orphanVoucher = mvDiscount > 0
            && !(Array.isArray(d.claimedMealVoucherIds) && d.claimedMealVoucherIds.length > 0);
        const orphanCredit = acDiscount > 0
            && !(Array.isArray(d.addonCreditsUsed) && d.addonCreditsUsed.length > 0);
        if (!resuming && d.groupId && (orphanVoucher || orphanCredit) && !opts.allowOrphanGroupPart) {
            const lost = [
                orphanVoucher ? `餐券 RM${mvDiscount.toFixed(2)}` : '',
                orphanCredit ? `预付 credit RM${acDiscount.toFixed(2)}` : '',
            ].filter(Boolean).join(' + ');
            blocked = `#${orderId.slice(-6).toUpperCase()} 是组合单 part ${d.partIndex ?? '?'}/${d.totalParts ?? '?'}`
                + `（groupId ${d.groupId}），抵扣了 ${lost} 但对应的领用记录挂在同组另一单上。`
                + `直接取消会退 0 份 —— 请改用 scripts/cancel-group-part.mts。`;
            console.warn(`[orderRollback] ${blocked}`);
            return;
        }
        orderData = d;
        // 续跑时把已完成的项读出来，下面逐项跳过 —— 不会重复补。
        progress = (d.rollbackProgress && typeof d.rollbackProgress === 'object')
            ? { ...d.rollbackProgress } : {};
        tx.update(ref, {
            status: 'cancelled',
            // 续跑保留最初的取消原因，别被重试的 reason 覆盖掉审计线索
            cancelReason: d.cancelReason || opts.reason,
            rollbackAt: d.rollbackAt || FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
    });

    if (!orderData) {
        // 订单不存在 / 已被别人取消 / 被闸门挡下（后者带原因，供调用方显示）
        if (blocked) out.blockedReason = blocked;
        return out;
    }
    out.cancelled = true;
    const o = orderData as FirebaseFirestore.DocumentData;

    const items: PrepOrderItem[] = Array.isArray(o.items) ? o.items : [];
    const createdMs: number = o.createdAt?.toMillis?.() ?? 0;
    const inStockEra = createdMs >= STOCK_ERA_MS;

    // ── ① 菜品限量库存（硬闸门，不还会误报售罄）─────────────────
    //
    // 2026-08-04：优先按 order.stockDeducted（下单时记下的**实扣量**）回补。
    // 三个旧毛病一次解决：
    //   · 手动/订阅单走 lenient 扣减，库存见底时 clamp 到 0 扣不满，按 items 的
    //     qty 全额退 = 凭空印货（超卖方向，比少卖严重）；
    //   · 有 stockDeducted 就等于「这单确实扣过」，不必再拿 createdAt 猜纪元
    //     —— 手动单的 createdAt 是配送日 12:00 且能被编辑改写，那是个会说谎的代理；
    //   · 菜改过名时 menuByName 查不到会静默漏补，而 dishId 是稳定的。
    // 没有这个字段的历史单才 fallback 回「纪元闸 + 按菜名映射 qty」的旧口径。
    const { releaseDishStock, deductedToItems } = await import('@/lib/stockUtils');
    const recordedDeduction = deductedToItems(o.stockDeducted);
    const dishItems = recordedDeduction.length
        ? recordedDeduction
        : (inStockEra
            ? items
                .filter(it => it?.name && !isAddOnRow(it.name) && (it.quantity || 0) > 0)
                .map(it => {
                    const dish = menuByName.get(it.name);
                    if (!dish) console.warn(`[orderRollback] ${orderId} 的「${it.name}」在 weeklyMenu 里查不到（菜改名了？）—— 跳过限量回补`);
                    return dish ? { dishId: dish.id, qty: it.quantity || 0, name: it.name } : null;
                })
                .filter((x): x is { dishId: number; qty: number; name: string } => x !== null)
            : []);
    // progress.dishStock 已 true = 上一次尝试补过了（进程随后死掉），跳过。
    // 这一项用的是 increment(+qty)，本身不幂等，绝不能重复跑。
    if (dishItems.length && !progress.dishStock) {
        try {
            // released.dishStock 报的是**真正 increment 回去的份数**（不限量的菜
            // 没有 dishStock 文档、不计），不再是「菜名映射成功的份数」——后者
            // 在绝大多数订单上都是个好看但虚假的数字。
            const restored = await releaseDishStock(db, dishItems);
            out.released.dishStock = Object.values(restored).reduce((s, n) => s + n, 0);
            await markDone('dishStock');
        } catch (e) {
            out.failures.push('dishStock');
            console.error(`[orderRollback] ${orderId} dishStock 回补失败:`, e);
        }
    }

    // ── ② 原料库存（advisory，每日盘点会纠偏）────────────────────
    // 「扣过没」优先看 stockDeductedIngredients 标记，没有才 fallback 纪元闸。
    const ingredientsWereDeducted = o.stockDeductedIngredients === true || inStockEra;
    if (ingredientsWereDeducted && items.length && !progress.ingredientStock) {
        try {
            const { releaseIngredientStock } = await import('@/lib/ingredientStock');
            // ⚠️ 这个函数契约上 NEVER THROWS（内部 try/catch 吞掉一切），所以外面
            // 这个 catch 永远不会命中 —— 必须看它的返回值才知道到底补没补成。
            // 以前直接 `out.released.ingredientStock = true` 是无条件的假成功：
            // 食材层 batch 提交失败时没日志行、没 failure 标记，三重静默。
            const res = await releaseIngredientStock(db, items, { orderId, source: `取消回补(${opts.reason})` });
            const okAll = !res || res.ok !== false;
            out.released.ingredientStock = okAll;
            if (okAll) await markDone('ingredientStock');
            else {
                out.failures.push('ingredientStock');
                console.error(`[orderRollback] ${orderId} ingredientStock 回补未完成:`, res?.error);
            }
        } catch (e) {
            out.failures.push('ingredientStock');
            console.error(`[orderRollback] ${orderId} ingredientStock 回补失败:`, e);
        }
    }

    // ── ③ 餐券（顾客的钱，最不能丢）──────────────────────────────
    const voucherIds: string[] = Array.isArray(o.claimedMealVoucherIds) ? o.claimedMealVoucherIds : [];
    if (voucherIds.length && !progress.mealVouchers) {
        try {
            const { releaseMealVouchers } = await import('@/lib/mealVoucherUtils');
            await releaseMealVouchers(db, voucherIds);
            out.released.mealVouchers = voucherIds.length;
            await markDone('mealVouchers');
        } catch (e) {
            out.failures.push('mealVouchers');
            console.error(`[orderRollback] ${orderId} 餐券回补失败:`, e);
        }
    }

    // ── ④ 预付加料 credit ──────────────────────────────────────
    // ⚠️ releaseAddonCredits 只有 headroom 封顶、**没有去重**，重复跑会把别的
    // 订单的额度也退给客户 → 必须靠 progress 守卫挡住第二次。
    const addonLines: Array<{ addonId: string; count: number }> =
        Array.isArray(o.addonCreditsUsed) ? o.addonCreditsUsed : [];
    if (addonLines.length && o.userId && !progress.addonCredits) {
        try {
            const { releaseAddonCredits } = await import('@/lib/addonCreditUtils');
            const res: any = await releaseAddonCredits(db, o.userId, addonLines, orderId);
            const asked = addonLines.reduce((s, l) => s + (Number(l.count) || 0), 0);
            // 报「实际退成的数」而非「要求退的数」：放不下的额度（unplaced）扣掉。
            const unplaced = Number(res?.unplaced ?? 0) || 0;
            out.released.addonCredits = Math.max(0, asked - unplaced);
            if (unplaced > 0) console.warn(`[orderRollback] ${orderId} 有 ${unplaced} 份 credit 退不回原批次（已满）`);
            await markDone('addonCredits');
        } catch (e) {
            out.failures.push('addonCredits');
            console.error(`[orderRollback] ${orderId} 预付 credit 回补失败:`, e);
        }
    }

    // ── ⑤ promo 优惠码：usedCount-- + 从 user.vouchersUsed 移除 ──
    // 只有 confirm-order 的 confirmed 分支会 claim —— 所以「订单上有 promoCode」
    // ≠「这单占用过一次额度」。以前只判 `if (o.promoCode)` 就退，会把**别人**
    // 占用的 usedCount 减 1、还把码从 user.vouchersUsed 里删掉（而去重正是靠
    // 那个数组），等于白送一次使用额度。踩得到的场景：删一张用了码但从没
    // confirm 过的单（FPX 没付成功 / dashboard 手动单写了 promoCode 却从不 claim）。
    // 现在只认 confirm-order 落下的 promoClaimed 凭据；历史单没有这个字段，
    // 用「曾经 confirmed 过」作 fallback —— 取消时 status 已被改写，所以看
    // confirmedAt 之类的痕迹，没有就宁可不退（少退可人工补，错退查不出来）。
    const promoWasClaimed = o.promoClaimed === true
        || (o.promoClaimed === undefined && !!o.confirmedAt);
    if (o.promoCode && promoWasClaimed && !progress.promoVoucher) {
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
            await markDone('promoVoucher');
        } catch (e) {
            out.failures.push('promoVoucher');
            console.error(`[orderRollback] ${orderId} promo 券回补失败:`, e);
        }
    }

    // ── 收尾：只有**全部**回补都成功才打完成标记 ────────────────────
    // rollbackDoneAt 是这个函数唯一的「已完整回补」凭据（幂等判据看它，不看
    // rollbackAt）。有失败项就不打 —— 订单停在 cancelled + rollbackAt +
    // 部分 progress，下次同参重跑会**只补没补上的那几项**，补齐了才封口。
    if (out.failures.length === 0) {
        try {
            await ref.update({ rollbackDoneAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        } catch (e) {
            console.error(`[orderRollback] ${orderId} 写 rollbackDoneAt 失败（回补已完成，重试会因 progress 全 true 而空跑）:`, e);
        }
    }

    console.log(
        `[orderRollback] ${orderId} 已取消(${opts.reason})：` +
        `菜 ${out.released.dishStock} 份 · 原料 ${out.released.ingredientStock ? '已回补' : '跳过'} · ` +
        `餐券 ${out.released.mealVouchers} 张 · credit ${out.released.addonCredits} 份 · ` +
        `promo ${out.released.promoVoucher ? '已还' : '无'}` +
        (out.failures.length
            ? ` · ⚠️ 未完成: ${out.failures.join(',')}（未封口，重试会续补）`
            : ''),
    );

    return out;
}
