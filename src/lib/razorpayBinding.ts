/**
 * Razorpay 订单绑定 —— 「这笔付款到底属不属于这张订单」的**唯一判定**。
 *
 * 为什么要有这个文件（2026-09-05）：
 *   `create-order` 以前对每张 pending 单**无条件**写 `razorpayOrderId = 本次的 R`，
 *   而 `confirm-order` 要求 `o.razorpayOrderId === 付款的 R` 才放行。于是：
 *     顾客 A 标签页开 FPX（绑 R1）→ 跳银行 App
 *     顾客 B 标签页又加了菜重新结账（绑 R2，**把 R1 冲掉了**）
 *     顾客回来付掉 R1 → confirm-order 403
 *                    → webhook 按 `razorpayOrderId == R1` 也查不到，静默 200
 *                    → 1 小时后被 stale-FPX 扫成 cancelled
 *   **钱收了，订单没了，零告警。**
 *
 * 修法不是「拒绝第二次绑定」——那会把「关掉银行页想重试」的正常顾客挡整整
 * 一小时。改成**保留所有在途绑定**：`razorpayOrderIds` 数组累加，任何一个匹配
 * 都算数。旧字段 `razorpayOrderId` 保留为「最近一次绑定」，老单只有它。
 *
 * ⚠️ 安全性不变：这里放宽的只是「同一张订单的多次结账尝试」，跨订单重放依然
 * 挡得住 —— R 是 Razorpay 服务端生成的、金额由 create-order 按订单文档权威算出，
 * 拿别人的 R 来对本单依然 `isBoundTo === false`。
 */

export interface RazorpayBindable {
  /** 最近一次 create-order 的绑定（老单只有这个字段）。 */
  razorpayOrderId?: string | null;
  /** 所有在途绑定，2026-09-05 起由 create-order 用 arrayUnion 累加。 */
  razorpayOrderIds?: string[] | null;
}

/**
 * 这张订单是否绑定到了 `rzpOrderId` 这笔 Razorpay 订单。
 *
 * 空 / 非字符串的 `rzpOrderId` 一律 false —— 绝不能让「两边都没有绑定」
 * 变成「匹配成功」（那等于取消了整道校验）。
 */
export function isBoundTo(order: RazorpayBindable | null | undefined, rzpOrderId: unknown): boolean {
  if (!order) return false;
  if (typeof rzpOrderId !== 'string' || !rzpOrderId) return false;
  if (Array.isArray(order.razorpayOrderIds) && order.razorpayOrderIds.includes(rzpOrderId)) return true;
  return order.razorpayOrderId === rzpOrderId;
}

/** 一批订单是否**全部**绑定到同一笔付款（confirm-order 的放行条件）。 */
export function allBoundTo(orders: Array<RazorpayBindable | null | undefined>, rzpOrderId: unknown): boolean {
  if (!Array.isArray(orders) || orders.length === 0) return false;
  return orders.every(o => isBoundTo(o, rzpOrderId));
}

/* ────────────────────────────────────────────────────────────────────────
 * 持有凭证 —— 「没有登录 session 的人，凭什么动这张单」
 *
 * 银行跳转回来时 session 常常已经没了，所以取消 pending 单这条路必须能无 token
 * 走通。但以前的条件只有「单子还是 pending」，等于**知道 orderId 就能取消别人的
 * 单** —— 而取消会走 cancelOrderWithRollback 把餐券翻回、预付 credit 退回、
 * dishStock +N，是能被用来烧库存的。
 *
 * 持有凭证 = 只有真正下单的那个浏览器才有的东西：这张单自己的 trackToken
 * （submit-order 建单时生成，随成功页/WhatsApp 链接发给顾客），或者 create-order
 * 绑给它的 razorpayOrderId。
 * ──────────────────────────────────────────────────────────────────────── */

export interface OrderHolderSubject extends RazorpayBindable {
  /** 公开的跟踪凭据（**不是** doc id）。 */
  trackToken?: string | null;
}

/** 单张订单是否被这组凭证之一持有。 */
export function isHeldBy(order: OrderHolderSubject | null | undefined, tokens: unknown[]): boolean {
  if (!order || !Array.isArray(tokens)) return false;
  const clean = tokens.filter((x): x is string => typeof x === 'string' && x.length > 0);
  if (clean.length === 0) return false;
  return clean.some(tk => (!!order.trackToken && order.trackToken === tk) || isBoundTo(order, tk));
}

/** 一批订单是否**全部**被这组凭证持有（无 session 取消的放行条件）。 */
export function allHeldBy(orders: Array<OrderHolderSubject | null | undefined>, tokens: unknown[]): boolean {
  if (!Array.isArray(orders) || orders.length === 0) return false;
  return orders.every(o => isHeldBy(o, tokens));
}
