# Lessons learned

## 2026-05-11 — Discount mechanisms must handle the zero-total edge case

**Bug:** Customer with 5+ meal vouchers redeems 5 main dishes in free-delivery zone → cart total = RM 0.00, but UI still required them to select QR/FPX and upload a receipt. "确认下单" button was permanently disabled because it required `paymentMethod` to be set.

**Root cause:** The checkout flow was built assuming there's always cash to collect. When the discount fully covered the bill, none of the existing code paths handled "no payment needed."

**Rule for myself:** When introducing ANY new discount mechanism (vouchers, promo codes, loyalty points, refer-a-friend credits, etc.), explicitly enumerate the boundary cases:
- finalTotal = 0 → no cash flow path needs to exist (skip payment selector, skip receipt upload, skip Razorpay)
- finalTotal < 0 → impossible by `Math.max(0, ...)` but worth a server-side guard
- finalTotal between 0 and 1 → Razorpay will reject (min 100 paise / 1 INR equivalent), so still needs the no-cash branch

**Pattern to apply:** Add a computed `isFullyCovered = total <= 0 && discount > 0` and short-circuit the payment ceremony. Don't try to bend the existing QR/FPX flow to accept zero-amount transactions.

## 2026-05-18 — 配送费定价要把竞争位放在防亏前面

**事件：** 老板让我分析配送费规则。我用 Lalamove 单订单成本算出"0-2.5km 满 RM 20 免运是套利漏洞"，建议把门槛提高到 RM 28/RM 35。老板回："2. that is not competative at all." —— 他完全对。

**根本错误：** 我把配送费当 P&L line item 优化，而不是当 marketing / acquisition cost。在 Hometaste RM 2 全场、Grab RM 2-7 的市场，把"防套利"放在第一位等于让自己退出竞争。配送费规则的首要目的是**让客户选你**，而不是**让每单不亏**。

**应用规则：** 给食品/外送业务做定价建议时，先问：
1. 直接竞品（同类型，同地区）的对外价格是多少？这设定了**消费者锚点**
2. 我们的护城河是什么？（邻里关系、新鲜度、本地化）—— **不是价格**
3. 配送费是当 acquisition cost（争客户）还是 retention cost（订阅）？两种角色定价逻辑完全不同
4. 单订单经济学是约束（不能亏太多就破产），不是目标。目标是 LTV × 客户数

**反模式（这次犯的）：** 计算 Lalamove RM 7 / 单 vs 客户付 RM 5 → 提门槛"防亏" → 结果对竞争对手送上市场份额。

**正确模式：** 把配送费亏损（RM 2-4/单）当 CAC 看 → 算 LTV（食物毛利 × 复购次数）能不能覆盖 → 用订阅/餐券锁定高频客户把亏损摊薄。

**核对清单：** 任何"建议提高门槛 / 提高费用"的建议出口前，先 grep 同地区直接竞品的对外价格，确认我没把自己推到市场之外。
