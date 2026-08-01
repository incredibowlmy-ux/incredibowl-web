/**
 * 首单优惠码「网站自助领取」的客户端粘合层。
 *
 * 背景：在此之前「首单立减 RM 5」只存在于退出弹窗和底部条的 WhatsApp 话术里
 * —— 新客必须离开网站、私聊碗妈、等人工发码，才能拿到折扣。转化最热的那一秒
 * 被推去了站外。现在改成：站内一键领取 → 码存进 localStorage → 打开购物车自动
 * 填进优惠码框并（已登录时）自动应用。WhatsApp 入口保留为次选。
 *
 * 安全边界：这里只是「记住客户想用哪个码」。折扣金额、可用性、每人一次、
 * 同手机号去重、firstOrderOnly 全部由服务端 validateVoucher 判定
 * （/api/check-voucher 预检 + /api/submit-order 权威计价 + /api/confirm-order
 * 落地 claim）。伪造 localStorage 只能让自己看到一个会被服务端拒掉的码。
 *
 * ⚠️ 这个码对应的 Firestore vouchers/{code} 文档需要老板先执行
 * scripts/seed-first-order-promo.mjs --commit 才存在。文档不存在时，客户端
 * 一切照旧运行，只是应用时服务端会回「优惠码无效」——不会白屏也不会卡单。
 */

/** 与 vouchers/{code} 的 doc id 一致（大写）。改这里必须同步改 seed 脚本。 */
export const FIRST_ORDER_PROMO_CODE = 'FIRST5';

/** 面值仅用于展示。真实折扣以服务端 voucher 文档的 discount 为准。 */
export const FIRST_ORDER_PROMO_RM = 5;

const STORAGE_KEY = 'incredibowl_pending_promo';

/** 客户点了「领取」→ 记下来，等他打开购物车时自动用上。 */
export function claimFirstOrderPromo(): void {
    try {
        localStorage.setItem(STORAGE_KEY, FIRST_ORDER_PROMO_CODE);
    } catch {
        /* 隐私模式 / storage 满 —— 领取失败不该阻断任何事，客户仍可手动输码 */
    }
}

/** 购物车打开时读取待用的码；没有就返回 null。 */
export function readPendingPromo(): string | null {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        return v ? v.trim().toUpperCase() : null;
    } catch {
        return null;
    }
}

/** 用掉了 / 被服务端拒了 → 清掉，避免每次开购物车都重试一个坏码。 */
export function clearPendingPromo(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        /* noop */
    }
}
