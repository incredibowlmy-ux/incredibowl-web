/**
 * 手动单历史「接管」——把纯 WhatsApp 老客挂在 `manual_<电话>` 下的旧订单，
 * 转到他真正的档案 uid 上，并把 LTV 补回去。
 *
 * 为什么需要：dashboard 手动单在客户还没档案时，userId 兜底写成
 * `manual_<电话数字>`（见 manualOrderCore.resolveManualUserId），而
 * `/api/admin/manual-voucher-purchase` 卖券时若查不到账号，会用**随机 uid**
 * 新建 stub。两边各写各的 → 同一个人被劈成两个身份：券和加料 credit 挂新档，
 * 历史订单还挂 `manual_*`，新档 totalOrders 空、totalSpent 只含券钱。
 * 2026-08-09 Yan Yuan（0102250779）就是这样：RM350 券 + RM95.60 加料 credit
 * 在新档，5 单 RM210.90 的历史在 `manual_0102250779`（那个 users 文档根本
 * 不存在）。参见 2026-07-12 的同类事故与 scripts/merge-manual-stub-uids.mjs。
 *
 * 设计要点：
 *   - 纯函数 planner（computeAdoptionPlan）+ 薄 IO 层，dogfood 能直打算法。
 *   - 电话数字形态不止一种（0102250779 / 102250779 / 60102250779 都可能被
 *     写进 uid），所以按候选 id 集合查，不赌单一写法。
 *   - 逐单复核 userPhone：uid 是电话拼的，但电话可能录错；订单自带的电话
 *     对不上就不认领（宁可漏，不可错认别人的单）。
 *   - LTV 口径抄 /api/confirm-order：`order.total + order.deliveryFee`，且只
 *     数 confirmed/delivering/delivered —— 手动单从来没走过 confirm-order，
 *     所以这些单的 LTV 一次都没记过，不存在重复计。
 *   - 留痕 userIdMergedFrom + userIdMergedAt，可反查可回滚。
 */

import { normalizePhone } from './phoneUtils';

/** 与 dashboard / admin 营收口径一致的「算钱」状态。 */
const LTV_COUNTED_STATUSES = new Set(['confirmed', 'delivering', 'delivered']);

export interface AdoptableOrder {
    id: string;
    userId?: string;
    userPhone?: string;
    status?: string;
    total?: number;
    deliveryFee?: number;
    deliveryDate?: string;
    userIdMergedFrom?: string;
}

export interface AdoptionPlan {
    /** 要改 userId 的订单（已排除认不准的）。 */
    orders: Array<{ id: string; from: string; deliveryDate: string | null; countsForLtv: boolean; ltvAmount: number }>;
    /** LTV 回填量：只数已确认/在送/已送达的单。 */
    ltvOrderCount: number;
    ltvSpentAdded: number;
    /** 被跳过的单 + 原因，便于排查（不写库）。 */
    skipped: Array<{ id: string; reason: string }>;
}

/**
 * 一个电话可能被拼成哪些 `manual_*` uid。
 * manualOrderCore 用的是原始输入去掉非数字（可能带前导 0 或 60），
 * 所以四种形态都要覆盖。
 */
export function manualUidCandidates(phoneRaw: string, phoneNormalized: string): string[] {
    const digits = String(phoneRaw || '').replace(/\D/g, '');
    const out = new Set<string>();
    for (const d of [digits, phoneNormalized, `0${phoneNormalized}`, `60${phoneNormalized}`]) {
        if (d) out.add(`manual_${d}`);
    }
    return [...out];
}

/**
 * 纯函数：给定候选订单，算出该接管哪些、LTV 补多少。
 * 不碰 Firestore，dogfood 直接喂假数据即可全覆盖。
 */
export function computeAdoptionPlan(
    orders: AdoptableOrder[],
    opts: { targetUserId: string; phoneNormalized: string },
): AdoptionPlan {
    const { targetUserId, phoneNormalized } = opts;
    const plan: AdoptionPlan = { orders: [], ltvOrderCount: 0, ltvSpentAdded: 0, skipped: [] };

    for (const o of orders) {
        const from = String(o.userId || '');
        // 自查在前：目标账号本身可能就是 manual_<电话>（老客一直没注册），
        // 这时它名下的单当然不用动，理由要说得准。
        if (from === targetUserId) { plan.skipped.push({ id: o.id, reason: '已经在目标 uid 下' }); continue; }
        if (!from.startsWith('manual_')) { plan.skipped.push({ id: o.id, reason: `不是 manual_ 单（${from}）` }); continue; }
        // 订单自带电话就必须对得上；没带电话时才信 uid 里的数字（早期手动单不写 userPhone）。
        if (o.userPhone && normalizePhone(o.userPhone) !== phoneNormalized) {
            plan.skipped.push({ id: o.id, reason: `订单电话 ${o.userPhone} 与本次 ${phoneNormalized} 不符` });
            continue;
        }
        const countsForLtv = LTV_COUNTED_STATUSES.has(String(o.status || ''));
        const ltvAmount = countsForLtv
            ? (Number(o.total) || 0) + (Number(o.deliveryFee) || 0)
            : 0;
        plan.orders.push({ id: o.id, from, deliveryDate: o.deliveryDate ?? null, countsForLtv, ltvAmount });
        if (countsForLtv) {
            plan.ltvOrderCount += 1;
            plan.ltvSpentAdded += ltvAmount;
        }
    }
    // 浮点尘埃：金额一律收到分。
    plan.ltvSpentAdded = Math.round(plan.ltvSpentAdded * 100) / 100;
    return plan;
}

/** 读：把候选 manual_* uid 名下的订单捞出来（只读，无副作用）。 */
export async function fetchManualOrders(
    db: FirebaseFirestore.Firestore,
    candidates: string[],
): Promise<AdoptableOrder[]> {
    if (candidates.length === 0) return [];
    // 候选最多 4 个，远低于 Firestore `in` 的 30 上限。
    const snap = await db.collection('orders').where('userId', 'in', candidates).get();
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as AdoptableOrder[];
}

/**
 * 读 + 写：接管历史单并补 LTV。**best-effort** —— 调用方必须包 try/catch，
 * 钱已经收了，接管失败绝不能让卖券整单失败（大不了事后跑归并脚本）。
 */
export async function adoptManualOrders(
    db: FirebaseFirestore.Firestore,
    opts: { targetUserId: string; phoneRaw: string; phoneNormalized: string },
): Promise<AdoptionPlan> {
    const { targetUserId, phoneRaw, phoneNormalized } = opts;
    const candidates = manualUidCandidates(phoneRaw, phoneNormalized).filter(c => c !== targetUserId);
    const orders = await fetchManualOrders(db, candidates);
    const plan = computeAdoptionPlan(orders, { targetUserId, phoneNormalized });
    if (plan.orders.length === 0) return plan;

    const { FieldValue } = await import('firebase-admin/firestore');

    // 500 是 Firestore 批量写上限；留出用户档那一笔的余量，按 400 切块。
    for (let i = 0; i < plan.orders.length; i += 400) {
        const batch = db.batch();
        for (const o of plan.orders.slice(i, i + 400)) {
            batch.update(db.collection('orders').doc(o.id), {
                userId: targetUserId,
                userIdMergedFrom: o.from,
                userIdMergedAt: FieldValue.serverTimestamp(),
            });
        }
        await batch.commit();
    }

    if (plan.ltvOrderCount > 0) {
        await db.collection('users').doc(targetUserId).set({
            totalOrders: FieldValue.increment(plan.ltvOrderCount),
            totalSpent: FieldValue.increment(plan.ltvSpentAdded),
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
    }

    return plan;
}
