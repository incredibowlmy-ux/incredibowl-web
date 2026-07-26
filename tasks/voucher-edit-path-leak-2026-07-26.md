# 餐券白送洞：Dashboard「编辑订单」不扣券（2026-07-26）

## 现象
Zowi3（`Zxu1PvRzTyM6qALYLDf9` / 0129135662）两单账面记了 RM18.50 餐券折扣 + RM2.50
预付加料折扣、现金收 RM0，但 `mealVouchers` 一张没扣、`mealVoucherAddonCredits`
一个没扣、`redemptionRecordedBy` 为空 —— 等于白送两碗。

## 根因
`incredibowl-dashboard.html` 手动单保存处理器分两条岔路：

- **新增**（`else` 分支）：`addDoc` → 调 `/api/admin/manual-voucher-redemption` 真扣券
  → 扣券失败则 `deleteDoc` 回滚整单。**安全**。
- **编辑**（`if (editingOrderId)` 分支）：只跑 `updateDoc(updateFields)`，
  `updateFields` 里带着按输入框算出的 `mealVoucherDiscount` / `addonCreditsDiscount`
  和减到 RM0 的 `total`，但**整个扣券 API 调用块在 `else` 里，编辑时根本不执行**。

弹窗打开时把 `#moVouchersUsed` 重置为 0，注释写着「vouchers are immutable once
claimed; admin should delete+recreate」，**但输入框没 disable** —— 在编辑模式下照样能
填数字，填了就走上面那条不扣券的路。

## 影响范围（全库 665 单扫描）
「账面有券折但本单无 `claimedMealVoucherIds`」共 23 单，分两类：

- **20 单 = 网页多天分单，正常**。券挂在 part 1，兄弟单只记折扣标记；
  按 `groupId` 汇总张数全部对得上。
- **3 单 = 真漏**，全部 `isManual: true` 且无 `redemptionRecordedBy`：

  | 配送日 | 客户 | 券折 | credit 折 | orderId |
  |---|---|---|---|---|
  | 2026-06-29 | Zowi3 | RM18.50 | RM2.50 | `vdQ7RTwncYLQQ4ytmfnb` |
  | 2026-07-08 | Zowi3 | RM18.50 | RM2.50 | `O53EeC2fvud4uCj7YBqc` |
  | 2026-07-09 | HuannMean | RM18.50 | – | `D5ZQaZsOQ6U6uPsi9EiF` |

排除了「API 跑了一半失败」的可能：路由里扣券（step 3）在扣 credit（step 4）
和写订单（step 5）之前，若 step 5 失败会有券的 `redeemedOrderId` 指向这些单 ——
实际没有任何券指向它们，且订单还在（失败会被 `deleteDoc` 回滚）。
**结论：API 对这 3 单从未运行过。**

顺带排除的另一个怀疑：编辑已用券的单会不会把 `total` 还原成面值虚增营收 —— 扫描 0 单命中。

## 修复
### 代码（已改，本地未 push）
`C:\Users\User\Desktop\Incredibowl Services\incredibowl-dashboard.html`
（+ `npm run sync:dashboard` 已回灌 `public/dashboard-h7x2q9.html`）

1. 新增 `applyEditModeRedeemLock()`：编辑模式下把 `#moVouchersUsed` 和
   `.mo-prepaid-qty` 全部归零 + `disabled`，提示文案换成锁定说明。
   在 `refreshOrderVoucherHint()` 的两条 return 路径都调用（渲染会重建这些 input，
   必须每次重跑）。
2. 保存处理器加硬闸：`if (editingOrderId && (vouchersUsed > 0 || prepaidAddonsUsed.length > 0))`
   → 报错并 return，放在任何写库之前。

验证：script 块 `node --check` 通过；从源文件抽出 `applyEditModeRedeemLock` 原文
跑单元测试 10/10 通过（编辑模式锁 5 项 + 新增模式不误伤 5 项）。

### 数据（✅ 已执行）
`scripts/backfill-unclaimed-voucher-orders.mts` —— 复用生产同一个
`claimMealVouchers`（FIFO + 事务），写回字段与 redemption API 一致，
`redemptionRecordedBy` 标成 backfill 便于审计区分。带安全闸：
状态不再是「有券折 + 没扣券」就跳过。

**✅ 2026-07-26 老板授权后已执行完成**（口径：退回 3 个再扣 2 个）：

```
阶段 0  sunny-egg 池退回 3 个（删单吞掉的）        remaining 1 → 4
06-29 Zowi3      扣券 sHQyBjbbOFQDT8jpCefg  RM17.25 + sunny-egg×1 RM2.50
07-08 Zowi3      扣券 sPvXf4kXblb6hIf02qSh  RM17.25 + sunny-egg×1 RM2.50
07-09 HuannMean  扣券 nIyX8Z1MjKn8kJUnEySl  RM17.50
```
终态全部命中预期：sunny-egg 池剩 2 · Zowi3 券 4→2 · HuannMean 券 5→4。
`audit-addon-credit-leaks.mjs` 复跑，Zowi3 差异已消失。

## ✅ 已闭合：Zowi3 预付加料 credit
Zowi3 的 sunny-egg 池：`quantityTotal 19` / `quantityRemaining 1` → 已扣 18，
但订单侧只记录 15 次，差 3 个（RM7.50）。`voucherAuditLog` 该账号 0 条记录。

`scripts/audit-addon-credit-leaks.mjs` 全库跑出 2 条同类差异
（Zowi3 sunny-egg 差 3、`xIqHg2RREZ2t5mGQMB0s` wagyu-upgrade 差 1），
脚本自己的注释指向「被删单吞掉的 credit」（删单退 credit 是 07-12 的
`966d5e6` 才修的，之前删的都吞了）。

账务上顾客买了 19 个蛋，存活订单真实消耗 17 个（15 已记 + 2 待补），
应剩 2 个而不是 1 个。老板 2026-07-26 定口径「退回 3 个再扣 2 个」，已按此执行完毕。

同类的另一条（`xIqHg2RREZ2t5mGQMB0s` = Zhi Yuen，wagyu-upgrade 差 1 个 / RM3.00）
不在本次授权范围内，**未处理**，见下方审计报告。

---

# 全量收支闭合审计（2026-07-26 16:42）

脚本：`scripts/audit-voucher-revenue-closure.mjs`（只读，可反复跑）
恒等式：**合同负债(收到的现金) = 已确认收入 + 未使用余额 + 过期沉没**

## 餐券（41 笔已付购买 / 461 张）
| 项 | 金额 |
|---|---|
| 收到现金 | RM 8,128.75 |
| 已确认收入（354 张已用） | RM 6,251.75 |
| 未使用负债（106 张有效） | RM 1,877.00 |
| 过期沉没 | RM 0.00 |
| **闭合差额** | **RM 0.00** ✅ |

- 铸券完整性：41 笔购买的张数 + 摊销总额全部等于收款 ✅
- Tommy Choong 的 RM1 FPX 测试购买已 cancelled、券已 voided，冲销正确 ✅
- 订单侧 `mealVoucherAllocatedRevenue` RM6,251.70 vs 券侧 RM6,251.75，差 RM0.05
  = Zowi3 那笔 RM170.75/10 张 → 每张 RM17.075，订单按 `toFixed(2)` 存成 17.07，
  10 单 × 0.005。**纯四舍五入尘埃，非差错** ✅
- redeemed 券 100% 挂在有效未取消订单上 ✅
- 22 个分单组按 `groupId` 聚合，券折与实扣全部有对应 ✅

## 预付加料券（33 批次）
| 项 | 金额 |
|---|---|
| 铸出面值 = 加料收款 | RM 423.60 ✅ |
| 已确认收入 | RM 274.80 |
| 未使用负债 | RM 120.90 |
| 过期沉没 | RM 27.90 |
| **面值闭合差额** | **RM 0.00** ✅ |

**唯一真差错：** 订单侧记 RM271.80 vs 批次侧扣 RM274.80，差 **RM3.00**
= Zhi Yuen 的 wagyu-upgrade 批次扣 3 个但订单只持有 2 个。
同 Zowi3 那个「07-12 前删单吞 credit」旧洞（`966d5e6` 已修根因）。
顾客付了钱没拿到东西，**未处理，待老板定夺**。

## 临期提醒
- 餐券：lim karen 1 张（08-01，6 天）· Jing Wen 1 张（08-08，13 天）
- 加料券：Claudia 蒜蓉西兰花炒蛋 2 个 RM21.80 + 和牛升级 2 个 RM6.00（08-05，10 天）
- 已过期沉没 RM27.90：HuannMean RM15.90（07-21）· Zhi Yuen RM12.00（07-21）
