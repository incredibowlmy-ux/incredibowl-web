# Lessons learned

## 2026-06-08 — 写菜品文案别凭想象定配料，照图核对

**现象：** 给「古早味姜葱鱼片饭」写描述时，我把那颗蛋写成「月见蛋」（生蛋黄拌饭式），沿用了纳豆饭的叫法。老板更正：是**荷包蛋（煎蛋）**。回看产品图，蛋白已凝固、明显是煎过的荷包蛋。

**根因：** 写文案时偷懒套用了别道菜的措辞，没逐一对照这道菜的实拍图/食材表确认配料形态。

**给自己的规则：**
- 写任何菜品 desc / tag 前，**逐项对照该菜的实拍图 + 食材表**，配料名称（蛋的做法、肉的部位、菜的种类）要跟图一致，别套用模板或近似菜的叫法。
- 荷包蛋（sunny-side-up，蛋白凝固）≠ 月见蛋（tsukimi，生蛋黄）。中餐家常饭上盖的煎蛋默认是荷包蛋。
- 文案属于「面向用户的描述」，错配料等同 [诚实原则] 里的编造——宁可问也别想当然。


## 2026-06-02 — scratch 工作区会冲掉未提交改动，改完立刻 commit

**现象：** 在 `.gemini/antigravity/scratch/incredibowl-web` 改了 dashboard 文件 7 处，Edit 全部成功、Grep 当场能搜到。但稍后跑 `git status` 发现该文件「干净」、改动全没了；HEAD 从 `a79f6d6` 跳到 `ac1798a`（工作区在我编辑后做了一次 git 同步/拉新提交，把未提交的工作树改动冲掉）。todo.md 侥幸幸存，dashboard 被覆盖。

**根因：** 这个 scratch 路径不是稳定工作区，会被外部同步/reset。未提交（uncommitted）的工作树改动随时可能蒸发。

**给自己的规则：**
- 在 `scratch/` 路径下，**每完成一组逻辑改动就立刻 `git add && git commit`**，别攒着等用户说 push。
- push/验证前先 `git diff --stat <file>` 确认 git 真的看到改动；只靠 Edit 返回成功 + Grep 搜到**不够**（工具的文件视图可能比 git 工作区滞后或被回退）。
- 如果发现改动消失：别慌，重做后**立即提交**抢在下一次同步前锁住。


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

## 2026-06-01 — 写累积型文档前必须先 Read，且不能在同一批 Read+Write

**错误：** 要往 `tasks/todo.md` 和 `tasks/lessons.md` 追加内容时直接用 Write，导致整文件被覆盖，
抹掉了历史记录（todo 的 dashboard/推荐券/餐券/菜单计划；lessons 的前 3 条）。更糟的是第二次
把 Read 和 Write 放在**同一个 tool 批次**里，Write 在我看到 Read 结果之前就执行了，重犯一次。

**根因：** ① 把 Write 当「追加」用（Write 是全量覆盖）；② 对依赖前一步结果的操作做了并行批处理。

**规则：**
1. 对 `tasks/todo.md`、`tasks/lessons.md`、`CLAUDE.md`、`README` 等累积型文档，动手前先 Read 全文，
   再「原文 + 新内容」整体 Write；优先用 **Edit 精确插入/追加**，避免全量 Write。
2. **有依赖关系的 Read→Write 绝不放同一批**：必须先拿到 Read 结果，再决定 Write 内容。
