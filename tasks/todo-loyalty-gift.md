# 回头客赠品（Orders 奖励机制）— 2026-09-30

## 老板定的规则（09-30 问卷拍板）
- 用餐券付款的单（`mealVouchersUsed > 0`）＝ Subscription：**每 5 个配送日**送一份
- 其余（现金 / FPX / QR）＝ Pay-as-you-order：**每 3 个配送日**送一份
- 一个配送日只算 1 次（午+晚两张单也只算 1）；送完重新数 = 第 3/6/9… 天送
- **上线日 2026-10-01 所有人从 0 开始数**，不追溯历史
- 赠品 = 薯煎蛋B（马铃薯 37.5g + 鸡蛋 0.5 颗，与新客首单赠品同一份量）
- **客人看不到**：只在备餐层派生，订单文档一个字节不改（照搬 newCustomerGift 做法）

## 口径细节（我定的默认，写进代码注释）
- 客户身份 = 电话优先退回 uid（复用 `customerKeyOf`）
- 两个计数器各数各的：同一人餐券单和现金单分开数
- 同一天有两张同类单 → 赠品挂在当天那类单里最早的一张（午先于晚 → createdAt → id）
- 不计入：cancelled / refunded / FPX pending（没付钱）
- 过去的日子计数不会被新单改动（新单配送日总在未来），所以已送过的不会「挪位」

## 实施
- [x] `src/lib/loyaltyGift.ts`：纯函数 `selectLoyaltyGiftIds` + `loadLoyaltyGiftIds(db)`（60s 缓存）
- [x] `src/data/dishIngredients.ts`：`LOYALTY_GIFT_SOURCE`（配方复用 NEW_CUSTOMER_GIFT_RECIPE）
- [x] `src/lib/prepIngredients.ts`：`PrepOrder.isLoyaltyGift` + 两处聚合都加这份料
- [x] `api/admin/daily-prep`：打标记 + 返回 `loyaltyGifts` 名单
- [x] `api/n8n/daily-prep`：打标记 + 客户表 🎁 标签 + `aggregate()` addOns 带赠品行（碗妈 23:59 Telegram 只读 addOns）
- [x] `api/admin/ingredient-stock`：两处打标记（盘点「所需」与备餐单同数）
- [x] Dashboard（Desktop 源）：备餐页横幅 + 食材清单行显示回头客名单 → sync 回 public/（只提交自己那块）
- [x] `scripts/dogfood-loyalty-gift.mts`

## 验证
- [x] dogfood 纯函数全绿
- [x] 真实数据：同一天带/不带标记两遍聚合做差，差异只有马铃薯+鸡蛋
- [x] 用 9 月数据模拟（SINCE 临时改 09-01）看送出份数合理
- [x] tsc + npm run build；dashboard `node --check` 抽出的 script
- [x] commit 留本地；push 等老板同意（未 push）

## Review（2026-09-30 完成，commit 留本地未 push）
全部实施项 ✅。验证：
- `dogfood-loyalty-gift.mts` 26/26；`dogfood-new-customer-gift` 25/25、`dogfood-combo-components` 仍绿（走 run-dogfood.mjs）
- 9 月真实订单回放（日期平移对齐上线日）：365 张在效单 → 共 54 份，每周 10–18 份；
  峰值 09-23 一天 11 份（多位餐券常客同周起步，同一天数到第 5 天）。
  当天带/不带标记聚合做差 = **只有** 马铃薯 +412.5g、鸡蛋 +5.5 颗
- `loadLoyaltyGiftIds` 真实路径跑通（10-01 起尚无人满 3 天 → 0 张，符合预期）
- tsc ✅ / `npm run build` ✅ / dashboard 两份 `node --check` ✅ / Desktop 相对备份只多这 28 行
- 本地 `next start` 真调 `/api/n8n/daily-prep`：200，`loyaltyGifts` 字段在；赠品行进了 addOns，
  喂进 Telegram Code 节点后碗妈消息里出现「➕ 🎁新客赠送·薯煎蛋B ×1」（回头客走同一段代码）

顺带的行为变化（老板需知）：
- 碗妈 23:59 Telegram 以前**不显示**新客赠品（09-08 改版后只读 mains/addOns）→ 现在新客/回头客赠品都会占一行
- dashboard 两份是**手工打同样补丁**，没跑 sync:dashboard（Desktop 源里有别的 session 的半成品）

没做 / 已知口径：
- dashboard「🥚 鸡蛋合计」是前端按订单现算的，不含任何赠品的 0.5 颗（新客赠品本来就这样）；赠品份数看食材清单「加料」行
- 下单时不自动扣赠品的食材库存（同新客赠品，靠每日盘点）
- 停用 = 把 `LOYALTY_GIFT_SINCE` 改成未来某天

## 09-30 晚 · 老板反馈后的跟进（第二个 commit）
- [x] 更正：「新客首单 + 回头客同一张单送两份」是不可能发生的情况（首单=第 1 天，回头客最早第 3 天）。
      删掉那条叠加测试，换成第 9 节断言：300 轮随机订单史重叠 = 0。dogfood 现 27/27
- [x] dashboard「🥚 鸡蛋合计」计入赠品的蛋（每份 0.5 颗，归在「马铃薯煎蛋B」行，括号里多一项「🎁赠送」）。
      新客 + 回头客赠品都算。两份 dashboard 手工同补丁；vm 实测不传赠品数时输出与旧行为逐字相同
- [ ] **待老板定**：用券 + 加料的单归哪类。现状 = 只要用了 ≥1 张券就算餐券单（每 5 天）。
      08-01~09-30 实测：在效 737 单，用券 420，其中 274 单同时有标价 > 0 的加料、4 单主菜没全用券
