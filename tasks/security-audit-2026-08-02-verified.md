# 审计复核结果 — 2026-08-02（对抗性复核后的完整清单）

本文件由复核代理的结构化判决**自动生成**，未经我改写，保证与判决原文一致。

- 复核方式：13 组代理，指令是「尽力推翻」，不确定一律判 REFUTED。
- 结果：**CONFIRMED 17 / PARTIAL 11 / REFUTED 0**。
- ⚠️ 零推翻不等于零误报：PARTIAL 的 11 条里，复核员推翻的是原报告的**严重度夸大**和**错误修法**（有几个照抄会把已修好的 bug 请回来），请按下面「修正后」的内容来做。

| 判决 | 级别 | 问题 | 工作量 |
|---|---|---|---|
| CONFIRMED | P1 | cancelled-order-resurrect | 约 15 行 + 客户端 3 处提示文案，半小时内；含 dogfood 验证约 1~2 小时 |
| CONFIRMED | P1 | cancelled-order-revive-no-reserve | 0（与 #1 同一处修复，别当成两个任务排期） |
| CONFIRMED | P2 | rollbackat-permanent-lock-silent-success | 5~8 行，10 分钟；但排在 #1 之后做 |
| CONFIRMED | P2 | addon-name-spoof | 半天到一轮：新表 60+ 条（可从 dashboard HTML 的 WEB_LABEL_TO_ADDON_ID 脚本生 |
| CONFIRMED | P2 | submit-order-stock-leak-on-throw | A 约 3 行；B 约 20 行 + 两处补标志。合起来半小时，但要跑一遍 dogfood 确认多组订单失败时不多不少地 |
| CONFIRMED | P2 | legacy-user-fee-bypass | 临时闸 3 行 + 一个只读清点脚本（半小时）；根治要独立一轮：新 API + geocode 搬服务端 + 改 Mem |
| CONFIRMED | P2 | delivery-batch-start-silently-orphans | 路由约 15 行 + dashboard 成功面板加一行提示；连带跑一次 scripts/check-active-ba |
| CONFIRMED | P2 | qr-pending-holds-dishstock | 约 20 行 / 半小时：submit-order 加 5 行收据门 + release-stale-fpx 和 adm |
| CONFIRMED | P2 | admin-update-user-derived-fields-desync | 电话侧 4 行 + 1 个 import，10 分钟；地址侧另算半小时（含弹窗提示文案）；存量体检脚本独立一轮。 |
| CONFIRMED | P2 | qr-voucher-purchase-no-owner-alert | 约 40 行（新函数 + kind 参数贯穿 buildTelegramText/sendEmail/orderLine |
| CONFIRMED | P3 | finalize-tx-update-missing-user-doc | 1 行 × 2 处（mealVoucherUtils.ts:182 + admin/confirm-meal-vouch |
| CONFIRMED | P3 | manual-stub-uid-unnormalized-phone | 两个文件约 15 行（manualOrderCore + n8n/customer），含本地 dogfood 约 1 小 |
| CONFIRMED | P3 | stale-cart-notice-self-erased | 2 行，5 分钟；改完 tsc 即可，无需回归其他链路 |
| CONFIRMED | P3 | success-screen-shows-predisc0unt-total | 1 行 + 一句注释，5 分钟；改完 tsc，建议顺手用一笔餐券全免的测试单看一眼成功页 |
| CONFIRMED | P3 | n8n-key-in-query-string | 半小时代码（新建 n8nAuth.ts + 改 4 处），但必须配一轮线上 n8n / dogfood 脚本改造与验证， |
| CONFIRMED | P3 | capi-initiatecheckout-value-ignores-voucher-discounts | 1 行（加注释共 4 行） |
| CONFIRMED | P3 | capi-content-id-three-namespaces | 约 20 行、跨 3 个文件（submit-order / confirm-order / meta-capi），加上事 |
| PARTIAL | P2 | manual-redemption-voucher-eaten-on-addon-failure | 约 15 行 + 2 个 import；含 tsc 和一次人工造错验证约半小时 |
| PARTIAL | P2 | subscription-week-nonatomic-idempotency | (1) 1 行；(2) 约 25 行改动 + 跑一次 dogfood，半小时；(3) 另起一轮（约 15 行 + 需要想 |
| PARTIAL | P2 | first-confirm-race-double-ltv | 约半小时：confirm-order/route.ts 改 ~20 行（一个事务 + 一个常量集合），跑 tsc + 本 |
| PARTIAL | P3 | promo-concurrent-reuse | 1 个查询 + 1 个复合索引（等索引 build），约半小时；多段双扣再加 2 行。 |
| PARTIAL | P3 | first-order-promo-phone-dedup-bypass | 2 行 + 函数签名加一个可选参数，10 分钟；不需要动 firestore.rules，不需要重新发布规则。 |
| PARTIAL | P3 | ingredient-need-double-count | 约 15 行、跨 2 个源文件（ingredientStock.ts 3 处 + ingredient-stock/ro |
| PARTIAL | P3 | cart-delivery-info-drops-partialmatch-warning | 约 15 分钟：dict 2 条 key + 6 行 JSX；跑 tsc 即可，无需回归结账链路 |
| PARTIAL | P3 | owner-telegram-4096-silent-drop | 约 20~25 行，单文件（src/lib/ownerNotify.ts），半小时含自测。 |
| PARTIAL | P3 | tx-callback-mutates-outer-state | 20 分钟：两个文件各搬 ~10 行进闭包 + 各加一句注释，tsc 过一遍，跑现成的餐券/credit dogfood |
| PARTIAL | P3 | n8n-key-in-query-and-nonconstant-compare | 0（并入 n8n-key-in-query-string 一起修） |
| PARTIAL | P3 | edit-order-release-consume-not-atomic | ① 加错误 toast：源头 2 行 + npm run sync:dashboard，5 分钟。② 服务端 swapF |

---

## [CONFIRMED] P1 — cancelled-order-resurrect

**结论**：真的：已取消并全额回补的单能被翻回 confirmed，餐券/预付credit/两层库存一样都不会重新扣 —— 刚才那 3 处 P0 修复完全没碰到这条路。但「每天都可能发生」是夸大的，真正稳定可复现的是顾客主动薅（需要会重放接口）。

**判决依据**

evidence 逐字属实（行号已偏移到 156）：`src/app/api/confirm-order/route.ts:156` = `const isFirstConfirm = status === 'confirmed' && orderData.status !== 'confirmed';`，整个 confirmed 分支（:156-252）从头到尾没有一处读 `orderData.status === 'cancelled'` 或 `orderData.rollbackAt`；:244-252 的 `updateFields` 只有 `status / updatedAt / razorpay*` 三类字段，`await orderRef.update(updateFields)` 无条件把 status 写成 'confirmed'，没有任何 consumeDishStock / claimMealVouchers / claimAddonCredits 的重新占用动作。
取消侧确实已经把东西全退了：`src/lib/orderRollback.ts:114-119` 事务里 `tx.update(ref, { status:'cancelled', cancelReason, rollbackAt, updatedAt })` —— 只写这 4 个字段，`razorpayOrderId / paymentMethod / total / deliveryFee` 原封不动，所以 confirm-order 的两条授权路径（:88-91 Path A 签名+绑定、:93-96 Path B `o.paymentMethod === 'voucher' && (Number(o.total)||0) === 0 && (Number(o.deliveryFee)||0) === 0`）在取消后依然全部成立。
对照证据也属实：`src/app/api/payment/webhook/route.ts:159-161` 逐字写着「Money arrived but the stale-FPX sweep already cancelled the order ... Do NOT auto-revive」，:175 只挑 `status === 'pending'` 的单去确认 —— 服务端这条路有防线，浏览器/顾客那条路没有。
刚才那 4 处改动的影响核对完毕：:110 `authorized = gateOrders.every(o => o.status === 'pending');` 只收紧了「取消」，orderRollback:109-112 的 `allowNonPending` 兜底也只管取消；两处都不在 confirmed 分支上，所以本洞未被消掉。

**修正后的触发路径**

【路径 B（确定性、可重复、只需自己的 idToken）—— 这才是主路径】
1. 从 DevTools「Copy as fetch」重放一次 /api/submit-order 的纯餐券单（`src/app/api/submit-order/route.ts:489` 写入 `status:'pending'`；:404 `await consumeDishStock(db, stockItems)` 已扣菜品库存；:561-567 `claimMealVouchers` 已抢占餐券；:594-600 已扣原料）。不点 UI 的确认，让它停在 pending。
2. `POST /api/confirm-order {orderIds, status:'cancelled'}` —— confirm-order:110 现在要求「全 pending」，这单**正好是 pending**，照样放行 → cancelOrderWithRollback 把餐券翻回 available、dishStock `+N`、原料回补。
3. `POST /api/confirm-order {orderIds, status:'confirmed'}`（带自己的 Bearer token）→ :93-96 Path B 三个字段（voucher / total 0 / deliveryFee 0）取消时没被改过 → authorized → :252 翻回 confirmed，进 Dashboard 出餐列表。
净结果：饭照做照送，餐券还在账户里，两层库存也没扣。换一张新单重复即可（同一张单第二次取消会被 orderRollback:104 的 rollbackAt 挡住，但换单不受限）。

【路径 A（FPX，确定性变体）】下 FPX 混付单 → 趁 pending 先 `POST cancel`（:110 放行）→ 回银行把款付掉 → webhook 走 handleFoodOrderFallback，看到 cancelled 只打 needsReview 不复活（webhook:162-173）→ 顾客拿回跳 URL 上的 `fpx_oid/fpx_pid/fpx_sig`（`src/app/api/payment/fpx-callback/route.ts:29-34` 明文回传）`POST confirm` → :90 `gateOrders.every(o => o.razorpayOrderId === pd.razorpayOrderId)` 依旧成立 → 复活。现金部分照付，但餐券和库存全额白拿回来。

【修正原报告夸大的部分】原文说的「迟到 FPX 每天都可能发生、顾客零技术门槛就会撞上」不成立：付款单会被 webhook 在几秒内确认（webhook:103 → :175-202，生产实证有 finalizedBy=webhook 的单），所以 1 小时清扫跑到时它早已是 confirmed、没有「已取消单」可复活。被动撞上只发生在「付款晚于清扫」或「webhook 投递失败」这两种少见情形。另外顺带一个原报告没提的真实副作用：复活时 :188-199 会**再次** `totalOrders/totalSpent += 1`（取消时并不回退），老客户 LTV 会被重复计一次。

**修正后的改法**

在 `src/app/api/confirm-order/route.ts` 循环里、`const orderData = orderSnap.data()!;`（:138）之后、`if (status === 'cancelled')`（:145）之前插一道闸门，与 webhook 同一条规矩：

```ts
      // 已取消的单绝不复活：餐券 / 预付 credit / dishStock / ingredientStock
      // 都被 cancelOrderWithRollback 还回去了，翻回 confirmed = 白送一单。
      if (status === 'confirmed' && (orderData.status === 'cancelled' || orderData.rollbackAt)) {
        await orderRef.update({
          latePaymentCaptured: true,
          ...(paymentData?.razorpayPaymentId ? { latePaymentId: String(paymentData.razorpayPaymentId) } : {}),
          needsReview: true,
          updatedAt: FieldValue.serverTimestamp(),
        });
        refusedRevive.push(orderId);
        continue;
      }
```
循环外 `const refusedRevive: string[] = [];`，:300 的响应里带上 `...(refusedRevive.length ? { refusedRevive } : {})`。

【会不会误伤现有正常流程 —— 逐条核对过，不会】
· webhook（:175）本来就只传 pending 单，命不中新闸门；
· CartDrawer 餐券流（`CartDrawer.tsx:622`）确认的是刚建的 pending 单；
· CartDrawer FPX 流（:721）与 page.tsx / en/page.tsx 回跳确认（`page.tsx:171-175`）正常情况下也都是 pending 单；
· 唯一被挡住的是「老板在 Dashboard 把 cancelled 拖回 confirmed」（`admin/page.tsx:320`）。这个能力**本来就是坏的**（复活不会重扣券和库存），建议：非 admin 一律硬拒；admin 保留但强制走 Dashboard 手动建单（那条路会真扣库存和餐券）。若老板坚持保留一键复活，至少让 admin 分支复活时清掉 rollbackAt 并打日志（见 finding #3）。
· 客户端拿到 `refusedRevive` 非空时不要弹「下单成功」，改 amber 内联块（顾客侧 alert 已清零，别引回来）。

**影响面**：每成功一次 = 白送 1 张餐券（面值 RM19.90 / 摊销价 ≈RM16）或 1 份餐（COGS RM4.6~8.1 + 配送净补贴 RM3.15），同时 dishStock 计数虚高 1 份（会答应做不出来的菜）、原料盘点漂移。被动触发（迟到付款/webhook 失败）实际很少见；主动薅需要会重放 fetch 的顾客，但一旦有人会，就是可无限重复的。目前无法证明线上已发生（本地是 rzp_test 密钥，查不了生产库），需要老板用生产凭据跑一次「status=confirmed 且存在 rollbackAt 字段」的查询来确认是否已中招。

**工作量**：约 15 行 + 客户端 3 处提示文案，半小时内；含 dogfood 验证约 1~2 小时

---

## [CONFIRMED] P1 — cancelled-order-revive-no-reserve

**结论**：真的，且与 #1 是同一个洞的两种写法（重复报告）—— Path A 只比对签名和 razorpayOrderId，完全不看订单状态，取消时又不动这个字段，所以绑定永远匹配；一处修复同时消掉两条。

**判决依据**

evidence 逐字属实，现位于 `src/app/api/confirm-order/route.ts:87-91`：
```
      const pd = paymentData || {};
      if (pd.razorpayOrderId && pd.razorpayPaymentId && pd.razorpaySignature
          && isValidRazorpaySignature(pd.razorpayOrderId, pd.razorpayPaymentId, pd.razorpaySignature)) {
        authorized = gateOrders.every(o => o.razorpayOrderId === pd.razorpayOrderId);
      }
```
确实一个字都没提 `o.status`。取消侧 `src/lib/orderRollback.ts:114-119` 只写 `status / cancelReason / rollbackAt / updatedAt`，`razorpayOrderId` 原样保留 → 绑定恒成立，这一点核实无误。
「不重新占用资源」也核实无误：confirm-order:156-252 的 confirmed 分支只做 LTV 累加（:188-199）、promo 券 claim（:203-238）、CAPI/收据，没有任何 `consumeDishStock` / `claimMealVouchers` / `claimAddonCredits` 调用（全仓只有 `src/app/api/submit-order/route.ts:404、542、561` 这三处会占资源）。

**修正后的触发路径**

原文的步骤顺序需要修正 —— 它写的第 2 步「顾客带 token POST cancel（已付款的单）」在 2026-08-02 之后**不成立**了：confirm-order:110 现在是 `authorized = gateOrders.every(o => o.status === 'pending');`，付完款的单已是 confirmed，顾客自助取消会吃 403。
但把顺序调过来照样通：**先取消再付款**。
1. FPX 混付单下单成功 → status='pending'（submit-order:489），餐券/dishStock/原料已被占用。
2. 趁未付款 `POST /api/confirm-order {status:'cancelled'}` → :110 放行（确实是 pending）→ 餐券回 available、dishStock `+N`、原料回补。
3. 回银行把这笔 FPX 付掉 → webhook 命中 `handleFoodOrderFallback`，:162-173 看到 cancelled 只写 `latePaymentCaptured/needsReview`，:175 的 pendingIds 为空 → 不复活。
4. 顾客用回跳 URL 上的 `fpx_oid/fpx_pid/fpx_sig`（`fpx-callback/route.ts:29-34`）`POST confirm` → :88-91 签名有效 + 绑定匹配 → authorized → :156 `isFirstConfirm` 为真 → :252 翻回 confirmed。
结果：现金部分照付，但餐券、菜品限量、原料全都白拿回来。

原文「路径 B：每次迟到付款都会发生」被夸大：付款单几秒内就被 webhook 确认（webhook:103 → :189-202），1 小时清扫扫不到它；只有「付款晚于清扫」或「webhook 投递失败」时，`page.tsx:171-175` 的自动 confirm 才会撞上一张 cancelled 单并把它复活 —— 是真实但低频的被动路径。

**修正后的改法**

**不要按原文那样在 :112 之前加一段独立的 `if (status === 'confirmed' && !isAdmin) {...}`**（它写在鉴权段里，会对整批 orderIds 一刀切 409，多单批次里只要一张是 cancelled 就把其它正常单也拒了）。用 #1 的按单闸门即可，一处覆盖两条 finding：

```ts
      // 在循环内、拿到 orderData 之后（route.ts:138 之后）
      if (status === 'confirmed' && (orderData.status === 'cancelled' || orderData.rollbackAt)) {
        await orderRef.update({ latePaymentCaptured: true, needsReview: true, updatedAt: FieldValue.serverTimestamp() });
        refusedRevive.push(orderId);
        continue;
      }
```
误伤评估同 #1：webhook 只送 pending 单、CartDrawer 两条路和 page.tsx 回跳送的也都是 pending 单，正常下单零影响；唯一被挡的是老板在 Dashboard 手动把 cancelled 拖回 confirmed（该能力本身就有缺陷，建议改走手动建单）。
附带建议（原文提到但仓库确实缺）：`needsReview / latePaymentCaptured` 目前全仓只有 webhook:164-168 会写，`src/` 和 `public/dashboard-h7x2q9.html` 里 **0 处读取或展示** —— 标了也没人看得见。要真闭环，Dashboard 得加一个 needsReview 红标筛选。

**影响面**：与 #1 完全重叠，不要重复计账。单次影响：一张 FPX 混付单的餐券（≈RM16 摊销价）+ 该单的 dishStock 份数 + 原料计数。被动路径低频；主动路径确定性可复现，但需要顾客会手敲 3 个 fetch。

**工作量**：0（与 #1 同一处修复，别当成两个任务排期）

---

## [CONFIRMED] P2 — rollbackat-permanent-lock-silent-success

**结论**：真的，但完全寄生在 #1 上：只有被复活过的单才会带着 rollbackAt 活着，此后任何取消都静默 no-op 而接口照返 success:true —— 老板点了「取消」，厨房第二天照做照送。

**判决依据**

四个环节逐字核实：
① `src/lib/orderRollback.ts:103-104`：
```
        // 已经取消过 / 已经回补过 → 本次 no-op（防双取消把库存加两遍）
        if (d.status === 'cancelled' || d.rollbackAt) return;
```
注意它 `return` 在 `tx.update` 之前（:114），所以**连 status 都不翻**，`out.cancelled` 保持 false。
② 复活时 rollbackAt 不会被清：`src/app/api/confirm-order/route.ts:244-250` 的 `updateFields` 只有 `status / updatedAt / razorpayPaymentId / razorpayOrderId / razorpaySignature`；全仓 grep `rollbackAt` 只有 orderRollback.ts 三处（:21 注释、:104 读、:117 写），**没有任何地方删除它**。
③ confirm-order 吞掉结果：:146-153 `await cancelOrderWithRollback(db, orderId, {...}); continue;` —— 返回值没有被赋值给任何变量；:300-306 无条件 `return NextResponse.json({ success: true, purchaseEventIds })`。
④ 对比组属实：`src/app/api/n8n/release-stale-fpx/route.ts:70-73` 有 `const r = ...; if (!r.cancelled) continue;`，`src/app/api/admin/data/route.ts:70-71` 有 `if (r.cancelled) autoCancelled.add(id);` —— 三条路里只有 confirm-order 不看。
⑤ 前端会跟着撒谎：`src/app/admin/page.tsx:317` 先乐观改 UI，:320-325 只在 `!res.ok` 时回滚，而这里永远 200 → 界面显示「已取消」，Firestore 里仍是 confirmed。

**修正后的触发路径**

前置条件是 #1 必须先发生过一次（这是唯一能产出「status=confirmed 且 rollbackAt 存在」文档的路径）。之后：
1. 老板在 Dashboard 对这张单选「已取消」→ `admin/page.tsx:320` POST /api/confirm-order {status:'cancelled'}。
2. :110 的鉴权走 isAdmin 分支通过 → :146 调 cancelOrderWithRollback（allowNonPending: true）。
3. 事务里 :104 命中 `d.rollbackAt` → return，status 仍是 confirmed，`out.cancelled = false`。
4. confirm-order 不看返回值 → :300 返回 success:true → 前端乐观更新不回滚，显示「已取消」。
5. 第二天这张单照样进备餐单 / 装碗页 / 配送批次。
注意：单纯的「重复取消」（本来就已 cancelled）也会 no-op 返回 success:true，但那种情况订单状态与 UI 一致，不构成 bug —— 真正会撒谎的只有被复活过的单这一种。

**修正后的改法**

两处，都小：
① 复活/确认时清掉标记（`src/app/api/confirm-order/route.ts:244-247`）：
```ts
      const updateFields: Record<string, any> = {
        status,
        updatedAt: FieldValue.serverTimestamp(),
        ...(status === 'confirmed' ? { rollbackAt: FieldValue.delete(), cancelReason: FieldValue.delete() } : {}),
      };
```
② 别再吞返回值（:146-153）：
```ts
        const r = await cancelOrderWithRollback(db, orderId, { reason: isAdmin ? 'admin-cancel' : 'web-cancel', allowNonPending: isAdmin });
        if (!r.cancelled) {
          const fresh = (await orderRef.get()).data();
          if (fresh?.status !== 'cancelled') noopCancels.push(orderId);
        }
        continue;
```
最后 `return NextResponse.json({ success: noopCancels.length === 0, noopCancels, purchaseEventIds })`。

【误伤评估】
· ①：`FieldValue.delete()` 对没有该字段的文档是安全 no-op，正常 pending→confirmed 的单零影响。
· ②：`success` 由 true 变 false 会让 `admin/page.tsx:325` 抛错并**回滚乐观 UI** —— 这正是我们要的（UI 不再撒谎），但要确认没有别的调用方把 200 当成功却不看 body：核对过 `CartDrawer.tsx:635/745` 与 `page.tsx:101` 的取消调用都是 `.catch(() => {})` 完全不读 body，不受影响。
· ⚠️ 但请注意顺序：**先修 #1**。#1 修好之后就不会再产出「confirmed + rollbackAt」的文档，本条的症状自然不可达；这 5 行属于纵深防御（防将来第五个调用方接进来），不要单独排一轮。

**影响面**：仅限已被复活过的订单，且必须老板事后再去取消它。单次影响 = 一份没人要的菜（COGS RM4.6~8.1）+ 一趟配送 + 备餐单/装碗页被污染。数量上限等于 #1 的发生次数，目前无法证明线上已有（需要用生产凭据查 status=confirmed 且带 rollbackAt 的订单）。

**工作量**：5~8 行，10 分钟；但排在 #1 之后做

---

## [CONFIRMED] P2 — addon-name-spoof

**结论**：真的能用 RM0 的「少饭」冒充 RM18.50 的加三文鱼——厨房备餐单、装碗页、食材扣库存全部认这个假名字，只有 Dashboard 订单详情那行 RM 0.00 露馅。

**判决依据**

证据逐字属实（行号已因本轮改动从 114 移到 156，内容未变）。完整链路我逐处核对过：
1) src/app/api/submit-order/route.ts:156 `validatedAddOns.push({ ...addOn, price: serverPrice, quantity: addOnQty });` —— 本轮只补了 `quantity: addOnQty`，`...addOn` 展开原封不动，客户端的 name/nameEn/image 全部保留。
2) src/data/addOnsConfig.ts:18 `'less-rice': 0.00,` 确实存在，是零成本载体；对照 addOnsConfig.ts:70 `'extra-salmon-70g': 18.50,`。服务端只有 id→价格，全仓 grep `ADD_ON_LABELS|getAddOnLabel` 零命中 —— 没有任何服务端名字表。
3) route.ts:463 `name: \`↳ ${a.name || a.id}\`,` / :464 `nameEn: a.nameEn || '',` / :466 `image: a.image || '',` —— 假名字直接落进 items。
4) 客户端确实是名字的来源：src/components/cart/CartDrawer.tsx:531-532 `name: a.item.name, nameEn: a.item.nameEn || '',`。
5) 备餐链路全部按 label 聚合、无价格列：src/app/api/n8n/daily-prep/route.ts:107-110 `if (isAddOnItem(it.name)) { const key = stripAddOnPrefix(it.name); addOnCounts[key] = (addOnCounts[key] || 0) + qty; }`，以及 :247 `lines.push(\`       + ${a.name}${a.qty > 1 ? \` ×${a.qty}\` : ''}\`);`。
6) 比 finding 说得更糟的一处（它没写）：src/lib/prepIngredients.ts:95 `const recipe = getAddOnRecipe(stripAddOnPrefix(it.name));` 与 :199 同款，而 src/data/dishIngredients.ts:388 `'加香煎三文鱼 (70g+)': [{ name: '三文鱼', qty: 120, unit: 'g' }],` —— 假名字会命中真配方，采购清单会多要 120g 三文鱼，consumeIngredientStock 也会真扣 120g。整个作案在运营侧是自洽的，不会有任何「食材对不上」的告警。

【推翻的子主张】finding 结尾「同一个洞还能把任意文字注入到碗妈的 Telegram/邮件提醒」对老板提醒这条不成立：src/lib/ownerNotify.ts:37-38 `const escapeHtml = (s: string) => s.replace(/&/g, '&')...`，:80 对 `it.name` 逐条转义；:177-187 明确 `Best-effort: never throws`。所以老板邮件/Telegram 只会显示纯文本，注入不了标记。n8n 06:30 那条 brief 的排版在仓库外，无法核实，不给结论。

【为什么降到 P2 不是 P1】这条走不通 UI —— AddOnModal 只能勾选内置项，必须手工构造带 Firebase Bearer token 的 POST。每次作案都绑定真实 uid + 电话 + 地址，可追溯；单次损失一份加料 COGS（三文鱼 120g / 鳗鱼半片 addOnsConfig.ts:120 注明进价 RM 5.225），不是能规模化静默放血的洞。另外我没有查过线上 Firestore，无法证明它已经发生过。

**修正后的触发路径**

必须是已登录客户手工发请求（UI 做不到）：POST /api/submit-order，Bearer 用自己的真 token，body 里某个 bundle 写 `addOns: [{ id: 'less-rice', quantity: 1, name: '加香煎三文鱼 (70g+)', nameEn: 'Extra Salmon (70g+)' }]`，`price` 照常填不含加料的菜价。route.ts:145-153 价格校验通过（serverPrice=0，加料合计 0，与客户端一致）→ :156 展开保留假 name → :463 写成 items 里 `↳ 加香煎三文鱼 (70g+)` ×1 / price 0.00 → 次日 06:30 daily-prep 的「加料」段和装碗页照做，prepIngredients 按 dishIngredients.ts:388 要 120g 三文鱼。全程无价格对照，无告警。

**修正后的改法**

根因是「加料显示名由客户端决定」，只能靠服务端权威标签表堵。方向与 finding 一致，但它给的示例表只列了 3 条，实际 ADD_ON_PRICES 有 60+ 个 key，漏一个就退化成 id 裸奔（顾客侧订单/备餐单会显示 `↳ extra-unagi-half` 这种开发者黑话）。

1) 新建 `src/data/addOnLabels.ts`，key 必须与 ADD_ON_PRICES 完全同集（建议加一个 tsc 层断言 `const _: Record<keyof typeof ADD_ON_PRICES, {zh:string;en:string}> = ADD_ON_LABELS` 让漏项在 build 期爆）。数据不用手敲：`public/dashboard-h7x2q9.html:3297` 的 `WEB_LABEL_TO_ADDON_ID` 反转即可拿到 id→中文 label，英文从 src/components/menu/AddOnModal.tsx 的 `nameEn` 抄。
2) submit-order/route.ts:156 改成不再展开客户端对象：
```ts
const label = getAddOnLabel(addOn.id);
validatedAddOns.push({ id: addOn.id, quantity: addOnQty, price: serverPrice, name: label.zh, nameEn: label.en });
```
3) route.ts:466 的 `image: a.image || ''` 改成固定 `''`（图片同样不该客户端决定；Dashboard 订单详情会渲染这个 URL）。

【会不会误伤】关键风险就一个：标签表里的中文字符串必须与 dishIngredients.ts 的 ADD_ON_RECIPES / MANUAL_LABEL_ALIASES 的 key 逐字一致（含空格和括号，如 `'加香煎三文鱼 (70g+)'`），否则备餐食材会静默算 0 —— 这正是记忆里「按 label 聚合会漏算」那个坑。上线前必须跑一遍：对 ADD_ON_PRICES 每个 id 取 label 去 getAddOnRecipe，把「有配方但查不到」的差集打出来。做到这一点后，正常下单零行为变化（客户端本来就发的是同一批标签）。

**影响面**：每次作案白拿 1 份最贵加料：extra-salmon-70g / extra-unagi-half 售价各 RM18.50、extra-wagyu-patty RM17.50、extra-pork-chop RM14.90；真实成本约 RM4–5.2/份（鳗鱼半片进价 RM5.225 见 addOnsConfig.ts:120），另加 120g 三文鱼被静默扣出原料库存。可重复、每单一份。但只能手工构造请求、每次都绑真实 uid+电话+地址可追溯。我没有查线上 Firestore，无法判断是否已发生。

**工作量**：半天到一轮：新表 60+ 条（可从 dashboard HTML 的 WEB_LABEL_TO_ADDON_ID 脚本生成，不用手敲）+ 改 2 处调用 + 一次 label↔配方 key 的差集自检。

---

## [CONFIRMED] P2 — submit-order-stock-leak-on-throw

**结论**：外层 catch 确实不释放已预留的限量菜库存；而且触发条件比报告说的强得多——不是靠 Firestore 抽风，任何登录用户少传一个 userName 就能稳定复现，反复打几次就把限量菜刷成「售罄」。

**判决依据**

证据逐字属实。src/app/api/submit-order/route.ts:673-675：
```
  } catch (err: any) {
    console.error('submit-order error:', err);
    return NextResponse.json({ error: err.message || '提交订单失败' }, { status: 500 });
```
预留在 :403-407 `try { await consumeDishStock(db, stockItems); } catch ...`，之后到成功返回之间未被局部 try 包住的写操作确实有 :516 `const docRef = await db.collection('orders').add(payload);` 和 :521 `await db.collection('users').doc(userId).update({ lastOrderAt: ... });`。补偿逻辑「设计里本来就有」也属实：:554 与 :577 各有一行 `try { await releaseDishStock(db, stockItems); } catch {}`，唯独外层漏了。

【我推翻了它列的一部分抛错来源】:594-600 食材扣减自带 try；:611-614 notifyOwnerNewQrOrder 永不抛（src/lib/ownerNotify.ts:177-187 注释 `Best-effort: never throws` + 实现是 try/catch 包 Promise.allSettled）；:631 sendCapiEvent 永不抛（src/lib/meta-capi.ts:80 `Always returns — never throws`，:145-148 catch 兜住）。所以「若干处」实际只有 :516 和 :521 两处。另外它担心的 users.update 打不到不存在的 doc —— 走不到，:292-294 已经用 `userZone !== 'within2km' && userZone !== 'outside2km'` 把无 user doc 的请求拦在 400。

【但我找到一条它没看见、且严重得多的确定性触发】src/lib/firebase-admin.ts:20-22 `export function getAdminDb() { return getFirestore(getAdminApp()); }` —— 没有 `settings({ ignoreUndefinedProperties: true })`，Admin SDK 默认遇到 undefined 字段直接抛 INVALID_ARGUMENT。而 route.ts:59 的必填校验只有 `if (!userPhone || !userAddress)`，userName / userEmail 不校验，:477 却无条件写进 payload：`userId, userName, userEmail, userPhone, userAddress,`。body 里省掉 userName（JSON 里 undefined 键会被 stringify 直接丢掉）→ :516 `orders.add(payload)` 必抛 → 落 :673 外层 catch → 库存已扣、订单文档一个都没建。

「永远不会被释放」也核实为真：src/app/api/n8n/release-stale-fpx/route.ts:51-54 `.where('status', '==', 'pending').where('paymentMethod', '==', 'fpx')` 是按订单文档查的，没有订单文档就永远扫不到。

【正常流程不会误踩】src/components/cart/CartDrawer.tsx:548-549 `userName: currentUser!.displayName || userProfile?.displayName || 'Guest', userEmail: currentUser!.email || '',` 都有兜底，所以这是攻击路径不是线上偶发 bug。

【范围收窄】src/lib/stockUtils.ts:63 `if (!snaps[i].exists) continue; // unlimited` —— 只有建了 dishStock 文档的限量菜会被扣，普通菜完全不受影响。

**修正后的触发路径**

不需要等 Firestore 瞬时错误。已登录用户对着任意一道有 dishStock 文档的限量菜，POST /api/submit-order，body 完整通过所有校验但**故意不带 userName 字段**（或 userEmail）→ route.ts:404 consumeDishStock 原子扣掉 N 份 → :516 orders.add 因 payload.userName === undefined 抛 INVALID_ARGUMENT（firebase-admin.ts:20-22 未开 ignoreUndefinedProperties）→ :673 外层 catch 只 log + 500。库存少了、订单文档为 0、release-stale-fpx 按订单查所以永远扫不到。循环 N 次即把该菜刷成「售罄」。原报告说的 Firestore 瞬时 UNAVAILABLE 路径同样成立，只是概率低。

**修正后的改法**

两块，都要做：

**A. 堵掉确定性触发（1 行级，先做）** —— 在 route.ts:477 组 payload 时把可选人名字段强制成字符串，别依赖 body：
```ts
userId,
userName: String(userName ?? '').slice(0, 100),
userEmail: String(userEmail ?? '').slice(0, 200),
userPhone, userAddress,
```
（不建议图省事去开全局 `ignoreUndefinedProperties: true` —— 那是全 app 行为变更，会把别处真正的 undefined bug 静默吞掉。）

**B. 外层 catch 补偿释放** —— finding 给的补丁方向对（`reservedStockItems` + `reservationSettled` 双标志、`db` 和标志提到 try 外层、releaseDishStock 是 increment 不幂等所以必须防重复），这些我都核实过是对的（stockUtils.ts:112-121 确实是 `FieldValue.increment(qty)`）。

**但它的补丁有个会造成「凭空印库存」的缺陷，必须修正**：多组订单时 :417 的循环可能已经成功建了第 1 张订单文档，第 2 组的 :516/:521 才抛。此时按它写的直接 `releaseDishStock(db, reservedStockItems)` 会把**两组**的库存都还回去，而第 1 张订单还活着、还会被备餐和收款 → 净多出一份库存，正是它自己警告过的那个坑。正确写法要抄 :574-577 已有的餐券失败分支：先删已建订单，再整体释放。
```ts
if (reservedStockItems && !reservationSettled) {
  try {
    for (const oid of createdOrderIds) {          // 循环里 push 进来的
      try { await db!.collection('orders').doc(oid).delete(); } catch {}
    }
    const { releaseDishStock } = await import('@/lib/stockUtils');
    await releaseDishStock(db!, reservedStockItems);
  } catch (relErr) {
    console.error('[submit-order] 预留库存释放失败（需人工重设 dishStock）:', relErr);
  }
}
```

【会不会误伤】A 零风险（正常客户端本来就发这两个字段，CartDrawer.tsx:548-549）。B 只在已经要返 500 的失败路径上跑，成功路径被 `reservationSettled = true` 完全短路；唯一要盯的是 :554 / :577 两处已有的局部释放后面各补一行 `reservationSettled = true;`，漏了就会重复释放。

**影响面**：只影响建了 dishStock 文档的限量菜（stockUtils.ts:63：无文档=不限量，普通菜零影响）。不丢钱，丢的是可售份数：被幽灵占用的 remaining 不会自愈，菜单误报「仅剩 X」直到老板手动重设 dishStock。攻击者可任意次数重放，等于对限量菜的定向下架。被动触发（Firestore 瞬时错误）概率很低。

**工作量**：A 约 3 行；B 约 20 行 + 两处补标志。合起来半小时，但要跑一遍 dogfood 确认多组订单失败时不多不少地还库存。

---

## [CONFIRMED] P2 — legacy-user-fee-bypass

**结论**：删掉自己 user doc 的 addressDistanceKm 确实一键关掉三道防线：无条件免运 + 绕过 25km 上限 + 绕过防换址；但这是 firestore.rules 里已白纸黑字记录的老洞的一个变体，而且 finding 给的临时补丁本身能被绕过。

**判决依据**

整条链我逐处核实，全部属实（行号偏移到 285/300/314，内容一致）：
1) 客户端确实能自写：firestore.rules:25-35 `userSafeFields()` 返回值里逐字包含 `'address', 'addressLat', 'addressLng', 'addressDistanceKm',` `'deliveryZone', 'addressFormatted',` `'addressVerifiedAt', 'addressVerifiedText',`；rules:53-56 `allow update: if isSignedIn() && request.auth.uid == userId && request.resource.data.diff(resource.data).affectedKeys().hasOnly(userSafeFields())` —— 删除某个白名单键同样计入 affectedKeys 且在白名单内，所以 deleteField() 放行。
2) submit-order/route.ts:285 `const userDistance = typeof userData.addressDistanceKm === 'number' ? userData.addressDistanceKm : null;` —— 删掉或写成字符串都得 null，属实。
3) 25km 上限短路：route.ts:300 `if (userDistance !== null && isBeyondServiceRange(userDistance)) {` —— null 直接跳过。
4) 防换址整段跳过：route.ts:314 `const isLegacyUser = userDistance === null;` 紧接 :315 `if (!isLegacyUser) {`，verifiedText === address 的比对被整体绕开。
5) 永久免运：src/lib/deliveryUtils.ts:404-406 `// Legacy zone-only path: pre-geocode users are inherently "existing".` / `if (zone === 'within2km') { return { fee: 0, tier: 'free', isLegacy: true }; }` —— 无视篮子大小、无视门槛。route.ts:356 的 calcPerDeliveryFees 每组都走 deliveryUtils.ts:477 的 resolveDeliveryFee，所以 :364 的 `resolvable` 为 true，不会被拦。
6) route.ts:373 的防篡改比对不构成障碍：攻击者传 clientDeliveryFee=0，而真实客户端读的是同一份被改过的 user doc，本来也会算出 0。

【必须说清的两点，避免老板高估「新洞」的含金量】
(a) 这是**已登记的老洞的一个变体**，不是新根因。firestore.rules:21-24 原文写着「⚠️ 已知残余风险：deliveryZone / addressDistanceKm / addressVerified* 由客户端地理编码流程写入…恶意客户可自写骗免运费。根治需把地址验证挪服务端 API（安全计划阶段 2.5）」。同一把写权限还有个同样简单的用法：写 `addressDistanceKm: 0.1` + `addressVerifiedText` 抄成 address，一样过 25km 检查和防换址，只是免运需要篮子满 RM20（deliveryUtils.ts:180/196）。所以 finding 说「比上一轮 P2-1 更彻底」在**操作步骤**上成立，但增量只有「不用凑篮子 + 25km 上限也跟着失效」。
(b) **finding 给的临时补丁是可绕过的，别照抄**：它提议用 `customerCreatedAtMs < GEOCODE_ERA_MS` 把 legacy 通道关死，但 `createdAt` 本身就在 firestore.rules:33 的白名单里（`'createdAt', 'lastLoginAt', 'updatedAt'`），攻击者把 createdAt 改成旧日期就继续是 legacy。顺带一提，同一件事还打开了另一条独立免运路径：deliveryUtils.ts:390 `customerCreatedAtMs < PRICING_V2_CUTOFF_MS` + :394-396 `if (isExistingCustomer && distanceKm <= FREE_DELIVERY_RADIUS_KM) return { fee: 0, tier: 'free', ... }` —— 改 createdAt 到 2026-05-16 前 + 距离写 ≤2km，一样白嫖，且这条连 legacy 分支都不用碰。

**修正后的触发路径**

已登录客户在浏览器控制台（站点已加载 Firebase SDK）执行 `updateDoc(doc(db,'users',uid), { addressDistanceKm: deleteField(), deliveryZone: 'within2km' })`，由 firestore.rules:53-56 放行。之后任意下单：route.ts:285 得 null → :300 跳过 25km 上限 → :314-315 跳过防换址（address 可随便改成任意远地址）→ deliveryUtils.ts:404-406 返回 fee 0 / tier 'free'，与客户端算出的 0 对得上，route.ts:373 的防篡改比对通过。已复核过没有任何上游守卫拦这条（下单必须登录 route.ts:37-41，但那只是身份不是授权）。

**修正后的改法**

根治仍是 finding 说的方向，但白名单要删得比它列的更多。

**根治**：新建 POST /api/save-address，服务端自己 geocode、自己算 distance/zone、用 Admin SDK 写；然后从 firestore.rules 的 userSafeFields() 里删掉 `addressLat / addressLng / addressDistanceKm / deliveryZone / addressFormatted / addressVerifiedAt / addressVerifiedText`，**外加 `createdAt`**（理由见上：留着它 PRICING_V2 老客户免运照样能伪造，且会让任何基于注册时间的补丁失效）。客户端只留 `address` 文本。
**误伤面**：MemberView / AuthModal / lib/auth.ts 现在是直接写这些字段的，全部要改成调新 API，否则正常改地址会被规则拒。这是必须一起做的，不能只改规则。

**在那之前的临时闸（不要用 finding 的 createdAt 版本）**：直接把 legacy 通道整个关掉，route.ts:314 附近改成
```ts
if (userDistance === null) {
  return NextResponse.json({ error: '配送地址需要重新验证。请到「个人资料 → 编辑资料」重新点「确认地址」。' }, { status: 400 });
}
```
三行，一次性关掉「无条件免运 + 25km 上限失效 + 防换址失效」。
**误伤面要如实说**：真的 geocode 流程上线前注册、之后从没重新验证过地址的老用户会被挡一次，需要点一下「确认地址」才能下单。老板可以先跑一个只读脚本数一下 users 里 `deliveryZone` 存在但 `addressDistanceKm` 缺失的账号有几个再决定；按记忆里 7 月起单量翻十倍的曲线，绝大多数活跃客户都在 geocode 之后。**并且要明说：这个临时闸不封「写 addressDistanceKm: 0.1 + 抄 addressVerifiedText」那条路，也不封改 createdAt 那条路** —— 只有把字段移出 userSafeFields() 才算真堵上。

**影响面**：每单免掉 RM 3–30 的运费（近中三档 3/5/12，远档 15/20/25/30），且 25km 服务上限失效——30km 也能下单，一趟 Grab RM25+ 全额倒贴。需要客户会用浏览器控制台调 Firebase SDK，不是点几下就能做到，所以是「少数懂技术的客户可持续白嫖」而非规模化流血。我没有查线上 Firestore，无法判断是否已有账号处于这个状态；建议一并跑那个「有 zone 无 distance」的清点脚本，它既是误伤面评估也是入侵检测。

**工作量**：临时闸 3 行 + 一个只读清点脚本（半小时）；根治要独立一轮：新 API + geocode 搬服务端 + 改 MemberView/AuthModal/lib/auth.ts 三处写入 + 规则改 + 全链路回归。

---

## [CONFIRMED] P2 — delivery-batch-start-silently-orphans

**结论**：属实：开新批次会无条件把上一趟关掉，没送完的单从此被所有配送工具屏蔽（/driver 看不到、新批次选不进），顾客跟踪页永久卡在「正在获取司机位置…」，只能靠一次性脚本收尾——仓库里已经有两个这样的脚本。

**判决依据**

【被指控代码逐字属实】
src/app/api/admin/delivery-batch/route.ts:76-80 逐字为：
      // Only one batch on the road at a time — close any stale active batch
      const activeSnap = await db.collection('deliveryBatches').where('status', '==', 'active').get();
      for (const doc of activeSnap.docs) {
        await doc.ref.update({ status: 'completed', completedAt: FieldValue.serverTimestamp(), driverLoc: FieldValue.delete() });
      }
无条件、不看 deliveredOrderIds、不回传任何信息（成功响应见 107-118，只有 batchId + route）。

【下游每一环都亲自核过】
- 新批次选不进它：public/dashboard-h7x2q9.html:12502-12507 `dbmEligibleOrders()` 逐字过滤 `(o.status === 'confirmed' || o.status === 'preparing')`——delivering 的单永远进不了下一个批次。
- /driver 看不到它：route.ts:122-124 `action === 'current'` 只查 `.where('status', '==', 'active').limit(1)`；DriverClient.tsx:77 只调这一个 action。
- 顾客端永久转圈：src/app/api/track/route.ts:47 逐字 `if (batch.status === 'active' && loc && ...)`——批次已 completed → driver 恒为 null；TrackClient.tsx:285 `{data.status === 'delivering' && data.carrier !== 'grab' && (` → 290-293 `{data.driver ? (<DriverMap .../>) : (<p ...>{t.gettingLocation}</p>)}`，而 TrackClient.tsx:59 逐字 `gettingLocation: '📡 正在获取司机位置…（司机手机信号恢复后自动更新）'`。链路闭合。
- 对照物属实：DriverClient.tsx:190 逐字 `if (!batch || !confirm('确定结束本趟配送？未送达的订单会保持「配送中」状态。')) return;`——手动收尾那条路有警告，自动关闭这条路一句都没有。
- 「漏点 ✅ 是常态」有实证：scripts/fix-0724-batch-mark-delivered.mjs 开头逐字「batch vxOz9PYxljikzYc5YGV2 … was never closed — no per-order ✅ taps, so all 13 orders are still status=delivering a day later」，另有 scripts/fix-0723-lunch-mark-delivered.mjs。收尾靠脚本，dashboard 没有通用的「改成已送达」按钮（全库只有 12624 那个 Grab 专用按钮）。

【找到的反证，够降调门但不足以推翻】
- 不是完全无声：dashboard:12512-12526 `dbmExcludedNote()` 会在弹窗里显示「ℹ️ 今天另有 N 单不在列表：配送中 1 单」，且 openDeliveryBatchModal 默认 `dbmSlot = 'all'`，所以同一天午→晚的典型场景老板是能看到这行字的。但它是被动说明、不拦截、切到「晚餐」筛选就消失、隔天完全不提。
- 订单本身在 dashboard 列表里仍有「配送中」状态药丸（11269 行），所以 finding 说的「再也看不到」略夸张——准确说法是「所有配送工具都够不着它，顾客端永久误导」。

**修正后的触发路径**

1) 午餐批次 A 里的 Y 单司机没点「✅ 本单已送达」（当面交接/手机锁屏/忘了点，07-24 一次漏 13 单有据可查）。Y: status=delivering，batchId=A。
2) 晚上老板开晚餐批次：dashboard 的 dbmEligibleOrders 只列 confirmed/preparing，Y 已经是 delivering → **不可能被重新勾进新批次**。
3) POST action='start' → route.ts:77-80 把 A 无条件改成 completed、删掉 driverLoc；响应（107-118）对 Y 只字未提。
4) 从此 Y 对 /driver 不可见（current 只回 active 批次）、对新批次不可选、对 /api/track 拿不到司机位置（要求 batch.status==='active'）。
5) 顾客打开 /track/<token>：status 仍是 delivering、carrier=self、driver=null → TrackClient 永远渲染「📡 正在获取司机位置…（司机手机信号恢复后自动更新）」。
6) 收尾只能写一次性脚本（仓库已有 fix-0723 / fix-0724 两个先例）。

**修正后的改法**

**不要照抄 finding 给的 409 拦截版**——本路由第 63-64 行自己写着「绝不能让排序失败挡住建批次（批次建不了 = 当天送不了货）」。409 需要 dashboard 同一次部署跟着改；只要漏了，老板当天就开不了批次，比原 bug 更糟。改成不阻断的版本：

```ts
// src/app/api/admin/delivery-batch/route.ts，把 76-80 换成：
const activeSnap = await db.collection('deliveryBatches').where('status', '==', 'active').get();
const orphaned: string[] = [];
for (const doc of activeSnap.docs) {
  const b = doc.data() || {};
  const done = new Set<string>((b.deliveredOrderIds || []) as string[]);
  // routedIds 排除：万一同一单同时出现在新旧批次，绝不能把刚出发的单标成已送达
  const left = ((b.orderIds || []) as string[]).filter(id => !done.has(id) && !routedIds.includes(id));
  orphaned.push(...left);
  await doc.ref.update({
    status: 'completed',
    completedAt: FieldValue.serverTimestamp(),
    driverLoc: FieldValue.delete(),
    ...(left.length ? { orphanedOrderIds: left, forceClosedBy: adminEmail } : {}),
  });
}
// 漏点 ✅ 的单不能烂在 delivering —— 与 fix-0724 脚本的人工收尾同款，留审计标记可回滚
for (const id of orphaned) {
  const ref = db.collection('orders').doc(id);
  const s = await ref.get();
  if (s.data()?.status !== 'delivering') continue;
  await ref.update({ status: 'delivered', deliveredBy: 'auto-close-prev-batch', updatedAt: FieldValue.serverTimestamp() });
}
```
再在 107-118 的成功响应里加一个 `orphanedOrderIds: orphaned`，dashboard 收到非空就在成功面板上显示一行「上一趟有 N 单没点 ✅，已按送达收尾」。

误伤评估：
- 只碰「老板正在主动退休的那个批次里、仍是 delivering」的单，不碰新批次、不碰任何 confirmed/pending 单。
- 会把一单**可能真没送到**的单写成 delivered——但这正是老板历史上人工做的事（fix-0724 就是把 13 单全刷 delivered），且 `deliveredBy:'auto-close-prev-batch'` 让它可查可回滚。
- 若老板坚持不替他下判断，退一步的版本是：只写 orphanedOrderIds + 响应回传 + dashboard 提示，不动订单状态——代价是顾客跟踪页仍会转圈，只是老板有了明确提醒。

**影响面**：不涉及钱。单次事故 1~13 单（07-24 实际 13 单）永久停在 delivering：已送达统计长期偏低、按状态做的对账/回访口径失真；顾客侧最难看——饭早吃完了，跟踪页还在说司机在路上。触发频率取决于司机漏点 ✅ 的概率，仓库两个 fix-*-mark-delivered 脚本说明这不是理论值。现有唯一缓解是弹窗里那行被动的「今天另有 N 单：配送中 1 单」，跨天即失效。

**工作量**：路由约 15 行 + dashboard 成功面板加一行提示；连带跑一次 scripts/check-active-batches.mjs 核对存量，半小时内

---

## [CONFIRMED] P2 — qr-pending-holds-dishstock

**结论**：属实：未付款的 QR 单下单那一刻就原子扣掉限量菜库存，而全站两个超时清理器都写死只扫 fpx，QR pending 单永远没人管 —— 任何登录用户（含匿名访客）不花一分钱就能把限量菜刷成「售罄」，只能靠老板在 Dashboard 逐单删单才放得回来。

**判决依据**

四步逐字核对，全部成立（本轮 posInt 修复只让行号前移，内容没被消掉）：

① 服务端对 QR 完全不要收据。`src/app/api/submit-order/route.ts:68`：`if (!paymentMethod || !['qr', 'fpx', 'voucher'].includes(paymentMethod)) {` —— 全文再无第二处 QR 校验；`:488` `receiptUploaded: receiptUploaded || false,` 和 `:500` `if (receiptUrl) payload.receiptUrl = receiptUrl;` 都是纯可选。唯一的收据门在客户端：`src/components/cart/CartDrawer.tsx:647` `if (paymentMethod === 'qr' && !receiptUploaded) { setCheckoutError({ msg: t.uploadReceiptFirstAlert }); return; }` —— 直接打 API 就绕过。

② 建单即硬扣库存。`submit-order/route.ts:404` `await consumeDishStock(db, stockItems);`，`:489` `status: 'pending',`。`src/lib/stockUtils.ts:77` `tx.update(refs[i], { remaining: FieldValue.increment(-qty), updatedAt: ... });` 是事务内真扣，且 `:66-72` 对真顾客抛 `「${name}」已售罄，无法下单`。

③ 两个清理器都把 QR 排除在外（finding 的 evidence 逐字命中）。`src/app/api/n8n/release-stale-fpx/route.ts:51-54`：
```
    const snap = await db.collection('orders')
      .where('status', '==', 'pending')
      .where('paymentMethod', '==', 'fpx')
      .get();
```
另一条兜底路 `src/app/api/admin/data/route.ts:61`：`if (d.status !== 'pending' || d.paymentMethod !== 'fpx' || !d.createdAt) continue;` —— 同样只放 fpx。全仓 grep `cancelOrderWithRollback` 只有 confirm-order / release-stale-fpx / admin/data 三个调用方，没有第四条会碰 QR 的路。

④ 前置条件真能满足，不是纸上谈兵。`src/lib/adminApi.ts:71-85` 的 `verifyBearerUser` 只做 `getAuth().verifyIdToken(token)`，**不查 sign_in_provider** → 匿名 token 一样放行（访客下单方案已上线，线上确有匿名单）。submit-order:292-323 要求 users 文档有 `deliveryZone` 且 `addressVerifiedText === address`，而 `firestore.rules:25-35` 的 `userSafeFields()` 逐字包含 `'address', 'addressLat', 'addressLng', 'addressDistanceKm',` / `'deliveryZone', 'addressFormatted',` / `'addressVerifiedAt', 'addressVerifiedText',` —— 本人可自写，规则注释自己也承认「⚠️ 已知残余风险…恶意客户可自写骗免运」。运费不一致时服务端还把正确值回吐在报错里（`:375` `服务器: RM${serverDeliveryFee.toFixed(2)}`），试一次就对上。

影响面也属实：`src/components/home/MenuCarousel.tsx:90-93` `const stockLeft = dishStock[String(dish.id)];` / `const isSoldOut = isLimited && stockLeft <= 0;` / `const isDisabled = !!dInfo?.disabled || isSoldOut;` —— 全站真顾客直接看到「售罄」。

夸大之处只有一点：finding 说「只能人工逐单取消」，实际 Dashboard 是**删单**（`public/dashboard-h7x2q9.html:11383-11386` 判 STOCK_ERA 后 `callAdminAPI('/api/admin/consume-stock', { items: order.items, release: true, orderId: id })`）—— 结果一样是纯手工，结论不受影响。

**修正后的触发路径**

1) 匿名或随便一个 Google 账号登录拿 ID token（`verifyBearerUser` 不看 provider）。2) 用同一 token 直接写自己的 `users/{uid}`：`deliveryZone:'within2km'`、`address:'X'`、`addressVerifiedText:'X'`、`addressDistanceKm:1`（firestore.rules userSafeFields 允许）。3) `GET /api/dish-stock`（公开，无鉴权）读到限量菜的 `remaining`。4) `POST /api/submit-order`，`paymentMethod:'qr'`、不带 receiptUrl、dishQty×quantity 凑到 remaining（posInt 各封顶 20，不够就多开 bundle，上限 50 个 bundle），bundle.price 和 clientDeliveryFee 按服务端报错回吐的数字对齐。5) 返回 200，`dishStock/{dishId}.remaining` 归零，订单停在 `status:'pending'`。6) release-stale-fpx:53 和 admin/data:61 都因 `paymentMethod !== 'fpx'` 跳过它 → 永不释放；老板不手动删单，这道菜就一直「售罄」。附带：`submit-order:611-614` 每单都 `await notifyOwnerNewQrOrder(...)`，刷单同时把 Telegram 刷成噪音。

**修正后的改法**

三处一起改（finding 只给了两处，漏了实际唯一在跑的那条）：

① `src/app/api/submit-order/route.ts` 第 70 行之后加服务端收据门（把「客户端 alert」升成服务端硬门）：
```ts
if (paymentMethod === 'qr' && !/^https:\/\/firebasestorage\.googleapis\.com\//.test(String(receiptUrl || ''))) {
  return NextResponse.json({ error: '请先上传转账收据截图' }, { status: 400 });
}
```
**零误伤实证**：正常 QR 流程在 `CartDrawer.tsx:503-509` 先 `uploadBytes` 到 `receipts/${uid}/...` 再 `setReceiptUrl(await getDownloadURL(storageRef)); setReceiptUploaded(true);` —— receiptUrl 必为 firebasestorage 下载 URL，且 `:1257` 的按钮在 `!receiptUploaded` 时是 disabled。写死 host 前缀顺带堵掉 finding 提到的 `javascript:` 协议（ownerNotify 会把它渲成 `<a href>`）。若担心 Storage 域名将来变，退一步只校 `/^https:\/\//`。

② `src/app/api/n8n/release-stale-fpx/route.ts:51-54` 去掉 paymentMethod 过滤，改成「fpx 一律扫；qr 只扫没收据的」——**有收据的 QR 单绝不能自动取消**（老板要人工核对 DuitNow，深夜真单会被误杀）：
```ts
const snap = await db.collection('orders').where('status', '==', 'pending').get();
// 循环里：
const isFpx = o.paymentMethod === 'fpx';
const isOrphanQr = o.paymentMethod === 'qr' && !o.receiptUrl;
if (!isFpx && !isOrphanQr) continue;
```

③ **finding 漏掉的关键一处** —— `src/app/api/admin/data/route.ts:61` 用同一条判据（`tasks/todo.md:687` 逐字写着「⏳ 仍缺调度器：release-stale-fpx 没有任何东西定时调它。现在靠 admin/data（开 Dashboard 触发）兜底」，只改 ② 等于改了个从没被调用过的接口）：
```ts
const isFpx = d.paymentMethod === 'fpx';
const isOrphanQr = d.paymentMethod === 'qr' && !d.receiptUrl;
if (d.status !== 'pending' || (!isFpx && !isOrphanQr) || !d.createdAt) continue;
```

**误伤面核查（全部为零）**：WhatsApp 碗妈 bot 和 Dashboard 手动单不走 submit-order，且 `src/lib/manualOrderCore.ts:189` 写死 `paymentMethod, receiptUploaded: true, status: 'confirmed',` —— 根本不是 pending，两个 sweeper 都碰不到；网页 QR 真单必带 receiptUrl 所以 ②③ 只会扫到「无收据的孤儿 QR 单」，那正是攻击单本身。

**影响面**：不丢钱，丢的是「限量菜卖不出去」。影响面 = 当时 `dishStock` 集合里有文档的那几道菜（无文档 = 不限量，stockUtils.ts:63 `if (!snaps[i].exists) continue;` 直接跳过）；线上此刻具体有几道菜挂着 dishStock 文档我没有生产凭据、无法核实，所以最坏情况按「当天所有限量菜全被刷成售罄」算，损失≈那几道菜当天的全部销售额（近期日均约 21 单 / 33 碗）。攻击成本 0 元、可无限重复；老板侧有信号（每单一条 Telegram + Dashboard 待确认单），但只能逐单删单回补，一边刷一边删撑不住。

**工作量**：约 20 行 / 半小时：submit-order 加 5 行收据门 + release-stale-fpx 和 admin/data 各改 3 行判据；收尾跑一次 scripts/dogfood-order-rollback.mts 确认回补路径没被改坏。可与其他 submit-order 类修复合在同一轮。

---

## [CONFIRMED] P2 — admin-update-user-derived-fields-desync

**结论**：电话那半是真的：admin 改电话只写 phone 不写 phoneNormalized，且 auth.ts 只在字段「缺失」时回填 → 永久失真，之后按新号卖餐券会静默新建幽灵账号；地址那半被夸大了（网页端是 fail-closed 拒收，不是丢钱）。

**判决依据**

evidence 逐字属实。update-user/route.ts:5 `const TEXT_FIELDS = ['displayName', 'phone', 'address'] as const;`；L83-89 的 else 分支只写 `sanitized[key] = str;`；L101 `batch.update(userRef, sanitized);` 全程没有 phoneNormalized。
入口真实可达：admin/page.tsx:1448 `setEditingUser(user);`（客户卡片上的「编辑」按钮），EditCustomerModal.tsx:138 `<FieldText label="电话" value={phone} onChange={setPhone} .../>`，L83 `if (trimPh !== (user.phone || '')) updates.phone = trimPh;`。
永久性成立：auth.ts:131 `if (existing.phone && !existing.phoneNormalized) {` —— 有值就永不刷新，登录也不修。
下游确实只认 phoneNormalized：adminUserLookup.ts:15 `.where('phoneNormalized', '==', phoneNormalized)`；manual-voucher-purchase/route.ts:154 `const existingUser = await findUserByNormalizedPhone(db, phoneNormalized);`，查不到就走 L162-184 `const stubRef = db.collection('users').doc();` 新建 stub 并把券 mint 上去。
我主动找到的三处反证（都只是减轻、不推翻）：
1) 弱告警存在：dashboard-h7x2q9.html:12957 成功 toast 里有 `${result.wasStubCreated ? '（已建 stub 账号）' : ''}` —— 不是「零告警」，但老板不一定看。
2) 网页老客会自愈：deliveryProfile.ts:42 保存时带 phone → auth.ts:159-161 `if (typeof data.phone === 'string') { payload.phoneNormalized = normalizePhone(data.phone); }`。所以只有「不上网页的纯 WhatsApp / stub 客户」才是永久失真。
3) 地址那半被夸大：网页链路是 fail-closed —— submit-order/route.ts:318-322 `if (!verifiedText || verifiedText !== currentAddress) { return ... '配送地址已修改但未重新验证' }`，属于「结不了账」的摩擦，不是错运费也不是丢钱。真正会拿新文本+旧坐标的只有 wa-order/route.ts:296-299 那条兜底分支，而它要求请求里既没坐标又没 ≥4 字地址，路径很窄。

**修正后的触发路径**

仅电话侧可复现且值得修：/admin 客户列表点「编辑」→ 改电话 → 填原因保存（update-user/route.ts:87 只写 phone）→ users 文档 phone=新号、phoneNormalized=旧号且永不刷新（auth.ts:131）→ 老板在 dashboard 用新号卖餐券 → manual-voucher-purchase:154 查不到 → :165 新建 stub 并把 5/10/20 张券 mint 到 stub → 客户自己的账号余额 0。同一条失真还会打到 wa-order:278 的会员识别、resolveManualUserId:129 的手动单归属、manual-addon-topup:126。
地址侧真正可复现的只有：admin 改地址 → 客户走碗妈 bot 下单且既不发定位也不给地址 → wa-order:296-299 用新地址文本 + 旧 addressLat/Lng 算距离运费、并在 :256 把旧坐标写进订单。网页侧不可复现为「错运费」，只会被 submit-order:318 拒收。

**修正后的改法**

分两步，先做零风险的电话侧：
```ts
// src/app/api/admin/update-user/route.ts —— 顶部加 import
import { normalizePhone } from '@/lib/phoneUtils';
// L88 之后（else 分支内）
if (key === 'phone') {
    sanitized.phoneNormalized = normalizePhone(str);
    changes.phoneNormalized = { from: String(currentData.phoneNormalized || ''), to: sanitized.phoneNormalized };
}
```
不会误伤：L69 `if (!(ALLOWED_FIELDS as readonly string[]).includes(key)) continue;` 保证客户端注入不了 phoneNormalized，这里是服务端自己派生；写库是 batch.update，多写一个字段对其它读取方全是增益。
地址侧建议单独一轮再做，而且我核过原 fix 的删字段方案是安全的（不是免运洞）：删掉 addressDistanceKm/deliveryZone 后 submit-order:316 `const isLegacyUser = userDistance === null;` 会跳过防换址校验，但 deliveryUtils.ts:481 的 resolveDeliveryFee 拿不到 distance+zone → resolvable=false → submit-order:366-368 直接 400「配送地址未确认」，仍然 fail-closed。唯一真实误伤：被改过地址的客户下次网页下单必须重新点「确认地址」——这正是想要的行为，但要在弹窗里写清楚，否则老板会以为是 bug。
另外建议跑一次性体检脚本列出 phone 与 phoneNormalized 不一致的存量 users 文档（存量修不修由老板定，脚本本身零风险）。

**影响面**：钱不会平白消失（老板已收款），但客户预付的 5/10/20 张装餐券（RM 一两百到三百多）会落在客户永远登录不进去的 stub 账号上，网页端兑不了，只能人工写归并脚本救。影响人数 = 老板历史上用过「编辑客户→改电话」的次数 × 其中「不上网页的纯 WhatsApp 客户」比例。⚠️ 我无法查线上 Firestore，没有实证案例，仅证明了机制真实可达。

**工作量**：电话侧 4 行 + 1 个 import，10 分钟；地址侧另算半小时（含弹窗提示文案）；存量体检脚本独立一轮。

---

## [CONFIRMED] P2 — qr-voucher-purchase-no-owner-alert

**结论**：确认为真：QR 买券写完 pending-review 就直接 return，全仓两条通知通道（Telegram/Resend）都够不到它，21:00 的 daily-recap 又只查 status=='paid' 也漏掉，老板唯一出口是人肉开 Dashboard 看角标——而顾客页面已经承诺「24 小时内核对」。

**判决依据**

evidence 逐字属实（src/app/api/meal-vouchers/create-purchase/route.ts:127-131）。我读了该文件全部 192 行：QR 分支 :176-187 `    // ── QR: just return the purchase ID; admin confirms later ───\n    return NextResponse.json({\n      purchaseId: purchaseRef.id,\n      pendingReview: true,` —— 从 :137 `const purchaseRef = await db.collection('mealVoucherPurchases').add(purchaseDoc);` 到 return 之间零通知调用，整个文件没有 import ownerNotify / receiptEmail。

我主动找了四条可能的反证，全部不成立：
1. 别的通知通道？全仓 grep `api.telegram.org|api.resend.com|RESEND_API_KEY|TELEGRAM_BOT_TOKEN` 只命中 src/lib/ownerNotify.ts 和 src/lib/receiptEmail.ts，两者都没有餐券入口。notifyOwnerNewQrOrder 的唯一调用点是 src/app/api/submit-order/route.ts:611 `    if (paymentMethod === 'qr') {` 内部，圈死在餐食订单链路。
2. 21:00 n8n daily-recap 兜底？src/app/api/n8n/daily-recap/route.ts:163 `      db.collection('mealVoucherPurchases').where('status', '==', 'paid').get(),` —— **明确只取 paid**，pending-review 被 Firestore query 层就过滤掉了，:219-225 的 todayVoucherPurchases 也只在这个已过滤集合上再按 paidAt 筛。所以晚上那条 Telegram recap 也不会提。
3. 本机 Task Scheduler 兜底？scripts/list-stuck-voucher-purchases.mjs:5 `// Usage: node scripts/list-stuck-voucher-purchases.mjs` 是纯手动脚本，仓库里没有任何调度引用它。
4. 顾客会自己 WhatsApp 老板？src/app/meal-vouchers/dict.tsx:233-234 `        pendingReviewTitle: '付款已收到，等待核对',\n        pendingReviewBody1: '我们会在 24 小时内核对你的付款凭证。',` —— 成功页压根不叫顾客联系任何人，反而给了 24h SLA 承诺。整个 /meal-vouchers 目录里 WhatsApp 只出现在「上传失败」和「账号合并冲突」两个错误文案里。

唯一的老板侧出口是 src/app/admin/page.tsx:459-460 `    const pendingMvpCount = mealVoucherPurchases.filter((p: any) =>\n        p.status === 'pending-review' || (p.status === 'pending' && p.paymentMethod === 'qr')` 的角标——正是 finding 说的「等下次开 Dashboard」。

需要更正 finding 的一处数字（不影响结论）：标题写「RM 168~333」，实际按 src/data/mealVoucherConfig.ts:63-65 是 `buildBundle('5',  5,  92.50,  30)` / `buildBundle('10', 10, 180.00, 30, '人气之选')` / `buildBundle('20', 20, 350.00, 60, '最划算')`，即 RM 92.50 / 180.00 / 350.00（再减 promo 折扣）。

**修正后的触发路径**

顾客登录（:189 匿名被拒，必须真 Google 账号）→ /meal-vouchers 选任意 bundle → 选 QR → MealVouchersView.tsx:163-168 上传收据到 Storage → :201-215 POST /api/meal-vouchers/create-purchase 带 receiptUrl → route.ts:74-76 通过 QR 收据校验 → :137 写入 status:'pending-review' 文档 → :177 直接 return → MealVouchersView.tsx:221-227 `if (paymentMethod === 'qr') { setPendingReview(true); return; }` 顾客看到「24 小时内核对」。全程零通知。半夜下单 = 老板到第二天开 Dashboard 才知道。这是**正常顾客路径**，不需要任何攻击手法。

**修正后的改法**

在 src/lib/ownerNotify.ts 末尾加 notifyOwnerNewVoucherPurchase（必须写在**同一个文件**——sendTelegram(:97) / sendEmail(:129) 都没有 export，跨文件调不到；finding 的 fix 位置正确），并在 create-purchase/route.ts 的 QR 分支 :177 return 之前 `await` 调用。

必须补 finding 没写死的一点：标题写死在 buildTelegramText:67-69 `? `🔔 新 QR 订单待核对收款（${orders.length} 单）`` 和 sendEmail:137-139 `? `🔔 新 QR 订单 ${orders.length} 单待核对 · Incredibowl``。直接复用会让老板收到「新 QR 订单待核对收款」误以为是餐食单去备餐 —— **必须**给这两处加 `kind: 'order' | 'voucher'` 参数，餐券版标题改成「🔔 新餐券购买待核对收款」。

误伤评估：
- create-purchase 的 QR 分支多一次 await 的 best-effort 通知，响应慢约 0.5~2s（两个外部 HTTP）。买券不是高频路径，可接受。
- ownerNotify 全链路 swallow（:182-187 外层 try/catch + :184 Promise.allSettled），通知失败不会让买券失败、不会吞掉 purchaseId。
- 必须放在 :137 purchaseRef 创建**之后**、:177 return 之前；放在 FPX 分支之外，别让 FPX 单也发（FPX 走 confirm-purchase 自动铸券，没有这个缺口）。
- 对现有 QR 餐食订单提醒零影响（只要加 kind 参数时给 order 侧留默认值）。
- 若同时采纳另一条 finding 的分片修复，两者不冲突（餐券消息只有 1 个块，远低于 4096）。

**影响面**：每一笔 QR 餐券购买：RM 92.50 / 180.00 / 350.00（减 promo 后）。钱已经转到老板账户，券一张没发，顾客页面显示「等待核对」且被承诺 24 小时内处理。老板在打开 Dashboard 之前完全不知道有这笔进账 —— 顾客来问时他还得现查。金额是普通餐食单（AOV 约 RM 25~50）的 4~14 倍，且是现金流最健康的那类交易。

**工作量**：约 40 行（新函数 + kind 参数贯穿 buildTelegramText/sendEmail/orderLinesText 标题）+ 调用点 8 行，半小时含自测。

---

## [CONFIRMED] P3 — finalize-tx-update-missing-user-doc

**结论**：属实且未修：finalize 事务里用 tx.update 写 users doc，doc 缺失时整个事务 NOT_FOUND 回滚 —— 券已在事务外铸好，purchase 却永远卡 pending，同一坑在 admin QR 确认路由里也有一份；但触发前提（users doc 缺失）很窄，P3 合理。

**判决依据**

evidence 逐字属实，只是行号从 171 漂到 182（就是任务里预告的那 4 处改动造成的偏移）。src/lib/mealVoucherUtils.ts:182-184 现为 `tx.update(userRef, {` / `totalSpent: FieldValue.increment(Number(fd.amountPaid) || 0),` / `});`，与 finding 的 evidence 一字不差。铸券确实在事务之外先完成：:158 `const voucherIds = await mintVouchersForPurchase(db, {` → :106 `await batch.commit();`，事务从 :168 `await db.runTransaction(async (tx) => {` 才开始，所以事务失败不会撤销已铸的券。Firestore Admin SDK 的 `Transaction.update()` 带 `exists: true` 前置条件，doc 不存在时 commit 报 NOT_FOUND（非 ABORTED，不会被内部重试吞掉）→ runTransaction reject → :174 那个 `tx.update(purchaseRef, { status: 'paid', ... })` 一并回滚，purchase 留在 'pending'。调用方确认 500：src/app/api/meal-vouchers/confirm-purchase/route.ts:112-114 `catch (err: any) { console.error(...); return NextResponse.json({ error: err.message || '确认失败' }, { status: 500 }); }`。重投也没用：mintVouchersForPurchase :48-50 幂等返回旧 ID，事务再走到同一行再挂。

对照组也属实：src/app/api/confirm-order/route.ts:193-198 `// set+merge (not update): increment still works and a missing user doc` / `// can't 500 the confirm — a paid order must never be left unconfirmed.` / `await userRef.set({ totalOrders: FieldValue.increment(1), ... }, { merge: true });` —— 同一仓库同一类问题已经用 set+merge 修过，这里确实没跟上。

我额外查了有没有上游守住 users doc 一定存在：lib/auth.ts:111-126 saveUserProfile 在首次登录会 `setDoc` 建档且字段满足 firestore.rules:49-50 的 `safeInitialDefaults()`，MealVouchersView.tsx:189 也拦了匿名（`if (!currentUser || currentUser.isAnonymous)`），所以正常客户都有 doc —— 这就是前提很窄、只值 P3 的原因，但**没有任何一处能保证它一定存在**（signInWithGoogle 里 saveUserProfile 的 setDoc 若被网络/规则拒掉，Auth 会话照样已建立，此时买券即命中），所以不构成「被别处挡住」的反证。

**修正后的触发路径**

users/{uid} doc 缺失的已登录真客户（唯一现实路径：登录时 lib/auth.ts:112 的 setDoc 因断网/规则被拒静默失败，但 Firebase Auth 会话已存在）→ 走 FPX 买券 → 付款成功 → confirm-purchase 通过签名校验 → finalizeMealVoucherPurchase :158 铸券落库 → :168 事务在 :182 tx.update(userRef) 上 NOT_FOUND → 500「确认失败」，purchase 永远 pending。webhook 路径（source='webhook:payment.captured'）同理，每次重投都失败。我无法在本仓库证明线上真的存在这样的 users doc，所以按「代码缺陷确凿、发生概率未证实」计。

**修正后的改法**

两处一起改成 set+merge（increment 在 set+merge 下同样生效，doc 不存在时自动创建）：

```ts
// src/lib/mealVoucherUtils.ts:182
    // set+merge 而非 update：user doc 不存在也不能让确认失败——
    // 券已经铸出来了，卡在中间态才是最糟的（同 confirm-order:195）。
    tx.set(userRef, {
      totalSpent: FieldValue.increment(Number(fd.amountPaid) || 0),
    }, { merge: true });
```

**finding 漏了一处：** src/app/api/admin/confirm-meal-voucher-purchase/route.ts:106-108 有一模一样的 `tx.update(userRef, { totalSpent: FieldValue.increment(Number(d.amountPaid) || 0), });`（QR 单老板确认路径），只改一处等于留半个洞，两处要一起改。

**误伤评估：** 幂等性不受影响（事务仍由 :172 `if (fd.status === 'paid') { alreadyPaid = true; return; }` 守着，不会重复 bump）；正常客户 doc 存在时 set+merge 与 update 行为等价，零差异。唯一副作用要跟老板讲清楚：doc 真的不存在时会创建一个只有 totalSpent 的「瘦档案」，而 lib/auth.ts:111 的 saveUserProfile 判断是 `if (!userSnap.exists())`，之后这个 uid 再登录就走 else 分支、不会补 uid/email/displayName/phoneNormalized —— 该客户在 dashboard 按电话查会找不到。confirm-order:195 现有代码已经有同样的副作用（不是本次新增）。要根治可顺手把 saveUserProfile 的判断改成 `if (!userSnap.exists() || !userSnap.data()?.uid)`，属于独立小改动。

**影响面**：单笔卡住：顾客付了 RM 88~330 的券包、券能用但页面报「确认失败」，purchase 永远 pending → 该笔收入不进营收对账、负债表也对不上，老板需手动改状态。线上未证实发生过（我没有生产数据可查），属潜伏型健壮性缺陷；一旦真发生，是「钱收了系统不认账」，客服成本高。

**工作量**：1 行 × 2 处（mealVoucherUtils.ts:182 + admin/confirm-meal-voucher-purchase/route.ts:106），加 tsc 约 10 分钟

---

## [CONFIRMED] P3 — manual-stub-uid-unnormalized-phone

**结论**：确实成立：dashboard 手打 010… 生成 manual_0103370197、碗妈 bot 的 wa_id 6010… 生成 manual_60103370197，同一人两个壳；而且同根问题在 n8n/customer:82 已经在「今天」让 bot 认不出所有历史 manual_0… 老客——但原 fix 会造出第三种格式，不能照抄。

**判决依据**

evidence 逐字属实：manualOrderCore.ts:132 `if (!userId) userId = \`manual_${phone.replace(/\D/g, '')}\`;`，上面 L126 已经算好了 `const normalized = normalizePhone(phone);` 却没用它。
两个调用方口径确实不同：multi-day-orders/route.ts:77-79 `const phone = String(customer.phone).trim(); const userId = await resolveManualUserId(db, String(customer.userId || ''), phone);`（老板手打）；wa-order/route.ts:367 `const userId = await resolveManualUserId(db, userSnap ? userSnap.id : '', phoneRaw);`。
WhatsApp 侧确实带国码：n8n-workflows/bowlmama-v2-main.json Router 节点 `const phone = msg.from;`，同文件 `const BOSS_PHONE = '60165014501';` 逐字证明是 60 开头无 +。dashboard 侧的 0 开头格式在生产数据里有实证：tasks/todo.md:532 `manual_0163702408`。
我找到的反证只挡住一半：admin/multi-day/page.tsx:170-193 `fillFromCustomer` 里 L182 `userId: c.userId`，而客户名录来自 admin/subscriptions/route.ts:120-136（会把只在 orders 里出现过的 manual_* 客户补进来），搜索用 L153 `c.phone.replace(/\D/g, '').includes(qd)` —— 老板输 0103370197 能命中 60103370197 那条。所以「bot 先建 → 老板后录且用了联想选择」不会分裂。但反过来「老板先录 manual_0… → 客户再走 bot」没有任何人在环：wa-order 只查 users 集合（adminUserLookup.ts:15 只认 phoneNormalized），查不到就直接造 manual_60…，必然分裂。
额外（原 finding 漏了、同一根因、危害更大）：n8n/customer/route.ts:82 `const uid = userSnap ? userSnap.id : \`manual_${phoneDigits}\`;` + L88 `where('userId', '==', uid)` —— phoneDigits 来自 WhatsApp 的 6010…，所以 bot 的「老客档案」查询今天就已经查不到任何 manual_0… 的历史单。
不涉及钱这点我也核过：餐券挂在 users 文档那条线（manual-voucher-purchase:154/165），与 manual_* 壳无关。

**修正后的触发路径**

可复现路径（无人可拦那条）：某纯 WhatsApp 客户没有 users 档案 → 老板先用 /admin/multi-day 手打电话 0103370197 建单 → resolveManualUserId 兜底出 `manual_0103370197` → 之后该客户走碗妈 bot 下单，Router 给的是 wa_id `60103370197` → wa-order:367 → findUserByNormalizedPhone 在 users 集合查不到 → 兜底出 `manual_60103370197` → 同一人两个壳。
反向路径（bot 先、老板后）被 multi-day 的客户联想挡住——前提是老板用了联想而不是纯手打。
今天就已生效的那条：任何 manual_0… 老客给碗妈发消息 → n8n/customer:82 拼出 manual_60… → L88 查 0 条订单 → bot 把老客当生客接待。（bot 端点已在 origin/main 上，n8n workflow 是否已导入线上我无法核实。）

**修正后的改法**

⚠️ 别照抄原 fix：把兜底改成 `manual_${normalized}` 会造出第三种格式（manual_103370197），历史 manual_0…/manual_60… 全部变孤儿，且原 fix 只提了 wa-order:238，漏了 n8n/customer:82 和 admin/subscriptions/page.tsx:420（`userId: editing.userId || \`manual_${e.target.value.replace(/\D/g, '')}\``）——只改一半会让 bot 的老客识别当场更糟。
零迁移、不误伤历史数据的最小改法是「先复用已存在的壳」：
```ts
// src/lib/manualOrderCore.ts —— 换掉 L132
export function manualIdVariants(normalized: string, raw: string): string[] {
  const digits = raw.replace(/\D/g, '');
  return [...new Set([`manual_${normalized}`, `manual_0${normalized}`, `manual_60${normalized}`, `manual_${digits}`].filter(s => s !== 'manual_'))];
}
// 兜底分支内：
if (!userId) {
  const variants = manualIdVariants(normalized, phone);   // ≤4 个，'in' 上限 10
  const hit = await db.collection('orders').where('userId', 'in', variants).limit(1).get();
  userId = hit.empty ? `manual_${normalized || phone.replace(/\D/g, '')}` : String(hit.docs[0].data().userId);
}
```
同一个 variants 也要用在 n8n/customer/route.ts:88（`where('userId','in', manualIdVariants(...))` 取代 `'=='`），否则 bot 仍然认不出老客。
不会误伤：单字段 equality-in 查询不需要复合索引；有真实 users 档案的客户在 L127-130 就已 return，根本走不到这里；历史壳 id 一个都不用改、不用迁移、不用回滚日志。

**影响面**：不丢钱（餐券走 users 文档那条线，与 manual_* 壳无关）。真实影响是运营数据：纯 WhatsApp 客户（记忆里约 45 个 manual_* 档案）的订单历史可能被劈成两半 → 常客识别 / 复购率 / LTV / 订阅候选名单低估。更实在的是同根因的 n8n/customer:82：只要碗妈 bot 已上线，所有 manual_0… 老客发消息时都会被当成生客（无老客话术、无地址兜底）。分裂的具体条数我无法查线上 Firestore 核实。

**工作量**：两个文件约 15 行（manualOrderCore + n8n/customer），含本地 dogfood 约 1 小时；不需要数据迁移脚本。admin/subscriptions/page.tsx:420 的前端拼 id 属同类隐患，可顺手删掉让服务端统一决定。

---

## [CONFIRMED] P3 — stale-cart-notice-self-erased

**结论**：确认是真 bug：清理过期菜的那个 effect 会因为自己删了菜而被再触发一次，第二次跑到「没东西可清 → setStaleNotice('')」把刚写的解释文字抹掉，顾客只看到菜凭空消失。但纯 UI，不丢钱不丢单。

**判决依据**

evidence 逐字真实。src/components/cart/CartDrawer.tsx:157-186 完整链路：
- L158 `if (!isOpen) return;`
- L168-171 `if (dateStale.length === 0 && unavailable.length === 0) { setStaleNotice(''); return; }`
- L172 `[...dateStale, ...unavailable].forEach((item: any) => removeFromCart(item.cartItemId));`
- L185 `setStaleNotice(notices.join('；'));`
- L186 依赖数组 `}, [isOpen, cart, removeFromCart]);`
反证没找到，反而找到三条正证：
① src/store/cartStore.ts:45-48 `removeFromCart: (cartItemId) => set(state => ({ cart: state.cart.filter(item => item.cartItemId !== cartItemId), }))` —— filter 必产新数组引用。
② src/app/page.tsx:35 `const { cart, addBundle, updateBundle, updateQuantity, removeFromCart, clearCart } = useCartStore();`（EN 站 src/app/en/page.tsx:37 同）—— 无 selector 订阅整个 store，store 一变父组件必重渲染，L396 `cart={cart}` 把新引用传下来 → L186 依赖变化 → effect 必定第二次执行。
③ 第二次执行时 stale 项已被删干净，for 循环产出两个空数组，直接命中 L169 的 `setStaleNotice('')`。
渲染端 CartDrawer.tsx:815 `{staleNotice && (` —— 提示条挂在 `flex-1 overflow-y-auto` 里，购物车空了也照渲染，所以「空车不渲染」这条反驳也不成立。
staleNotice 全仓只有 3 处引用（L89 声明、L815/818 渲染），没有第二个地方能把它救回来。
补充：这不是本次 recent-diff 引入的 —— `git log -S "setStaleNotice('')"` 只有 4b8bf5f（2026-05-08），②「菜不卖了」分支是 d0f777f（2026-07-26）加的，两次都没碰这个自清逻辑。

**修正后的触发路径**

1) 顾客昨晚把某道菜加进购物车（localStorage 持久化），今天该菜本周暂别，或已过 06:00 截单。
2) 点开购物车 → CartDrawer 挂载（page.tsx:391 `{isCartOpen && (`）→ effect 第一次跑：L172 removeFromCart 删菜 + L174-181 重置 promo/paymentMethod/receipt/mealVouchersUsed + L185 写提示。
3) zustand 新 cart 数组 → 父组件重渲染 → cart prop 新引用 → effect 第二次跑。
4) 第二次 dateStale/unavailable 全空 → L169 `setStaleNotice('')`。提示条最多存活一次 commit 的时间（不到一帧），顾客读不到。
注：原 finding 说的「promoCode/paymentMethod/收据一起被静默重置」也属实（L174-181），且这部分本来就靠这条提示解释，所以提示被抹掉等于整段重置全无交代。

**修正后的改法**

最小改法（2 行，只动 CartDrawer.tsx，ZH/EN 共用同一组件一次改两边）：

```ts
// L158：关购物车时才清提示
-        if (!isOpen) return;
+        if (!isOpen) { setStaleNotice(''); return; }

// L168-171：没东西可清就直接退出，绝不清空提示
-        if (dateStale.length === 0 && unavailable.length === 0) {
-            setStaleNotice('');
-            return;
-        }
+        if (dateStale.length === 0 && unavailable.length === 0) return;
```

误伤评估：无。staleNotice 全仓只有 L169 和 L185 两个写入点，删掉 L169 后唯一写入点是「真删过东西」的 L185；渲染点只有 L815。CartDrawer 在 page.tsx:391 / en/page.tsx:371 都是 `{isCartOpen && (…)}` 条件挂载，关车即卸载、state 自然归零，所以不存在「提示跨会话残留」。不碰 repriced / reorderNotice / 结账状态重置这三条逻辑。
不建议采用原 finding 里那个 cleanedRef 版本：它多引入一个 ref 生命周期，且 `setStaleNotice(prev => …)` 会在同一次开车里反复追加同一句话。

**影响面**：仅 UI 文案，金额/订单/库存零影响。触发人群 = 隔夜留购物车或跨换菜周留购物车再回来下单的顾客（购物车 localStorage 持久化，这类人不算少）。后果是「菜和已填的优惠码、支付方式、收据一起没了且零解释」→ 观感像网站坏了，可能弃单。无法量化到具体单数。

**工作量**：2 行，5 分钟；改完 tsc 即可，无需回归其他链路

---

## [CONFIRMED] P3 — success-screen-shows-predisc0unt-total

**结论**：确认：站内成功页和发给碗妈的 WhatsApp 里的金额传的是折前小计（还漏了运费），三条站内下单路全中；finding 只说了餐券/优惠码场景，实际连普通有运费的单也报错（少报运费）。

**判决依据**

evidence 逐字真实：src/components/cart/CartDrawer.tsx:780 `setOrderSuccess({ id, items: [...cart], total: cartTotal, trackInfo, voucherUsed: mealVouchersUsed > 0 });`
cartTotal 的定义确为折前且不含运费：src/lib/cartUtils.ts:3-5 `export function calcCartTotal(cart: CartBundle[]): number { return cart.reduce((sum, item) => sum + item.price * item.quantity, 0); }`，由 src/app/page.tsx:313 `const cartTotal = calcCartTotal(cart);` 传入（EN 站 en/page.tsx:296 同）。
实付口径在同文件同作用域：CartDrawer.tsx:256 `const subtotalAfterDiscount = Math.max(0, cartTotal - promoDiscount - mealVoucherDiscount - addonCreditDiscount);`、L317 `const finalTotal = subtotalAfterDiscount + deliveryFee;`。
消费端确认：src/components/cart/CartSuccess.tsx:98 `` `💰 RM ${total.toFixed(2)}` `` 进 WhatsApp 文案；:133 `RM {total.toFixed(2)}` 是页面「金额」。
口径不一致确认：同文件 L695 `total: finalTotal,`（FPX 跳银行前存 localStorage 的 summary），src/app/page.tsx:200 `total: typeof summary?.total === 'number' ? summary.total : null,` → FPX 回跳弹窗显示实付。两条路对同一笔单给不同数字，属实。
反证没找到：orderSuccess.total 只被 CartSuccess 消费，不进订单 payload、不进 Firestore、不进任何金额校验，所以不会丢钱。
两处需要修正 finding 的说法：
① 不是 recent-diff。`git log -L 777,782` 显示这行在 1b78a24（2026-07-16）之前就是 `total: cartTotal`，那次提交只加了 voucherUsed。属长期存在。
② 影响面被低估。cartTotal 不含 deliveryFee，所以**任何要付运费的普通单**（近 RM3 / 中 RM5-12 / 远 RM15-30）成功页都会少报运费，而不只是餐券/优惠码单。

**修正后的触发路径**

三条站内路径全部命中（都调 showOrderSuccess，CartDrawer.tsx:777）：
1) 餐券全免：L615 isFullyCoveredByVouchers → L630 `showOrderSuccess(...)` → 实付 RM 0，页面写「金额 RM 55.50」（最吓人的一种）。
2) FPX 站内不跳转完成：L741 `showOrderSuccess(isMultiPart ? groupId! : orderIds[0], trackInfo);` → 已按 finalTotal 扣款，页面写折前小计。
3) QR 转账：L767 `showOrderSuccess(result.isMultiPart ? result.groupId! : result.orderIds[0], result.trackInfo);` → 顾客照 finalTotal 转的账，页面写折前小计。
最常见的错法其实是**少报**：没优惠码没餐券但有运费时 finalTotal > cartTotal，成功页比实付少一个运费。
（FPX 跳银行再回跳那条路走的是 page.tsx:200 的 summary.total，显示正确 —— 所以同一个顾客换个支付路径会看到两个数。）

**修正后的改法**

一行：

```ts
// src/components/cart/CartDrawer.tsx:780
-        setOrderSuccess({ id, items: [...cart], total: cartTotal, trackInfo, voucherUsed: mealVouchersUsed > 0 });
+        // ⚠️ 必须是实付（含运费、已减 promo/餐券/加料 credit），与 FPX 快照 L695
+        //    的 summary.total 同口径；传 cartTotal 会让餐券全免的顾客看到吓人的折前数字，
+        //    也会让普通单少报一个运费。
+        setOrderSuccess({ id, items: [...cart], total: finalTotal, trackInfo, voucherUsed: mealVouchersUsed > 0 });
```

误伤评估：无。
· finalTotal 在同一组件作用域（L317 定义，L780 使用），且 L672/L695 已经在用同一个闭包值，不存在取到过期值的问题。
· 数值范围安全：L256 有 `Math.max(0, …)`，deliveryFee ≥ 0，所以 finalTotal ≥ 0，`toFixed(2)` 不会出负数。
· orderSuccess.total 的消费方只有 CartSuccess.tsx:98（WhatsApp 文案）和 :133（页面金额），不参与任何提交/校验/统计，改它不影响 submit-order 的服务端价格校验、不影响 Pixel/CAPI（那两处用的是 L665/L735 的 finalTotal，本来就对）。
· 改完 ZH/EN 两站同时生效（共用组件）。

**影响面**：每一笔站内完成的订单都看到（按记忆里 ~21 单/天 的量级，绝大多数单都带运费 → 天天在少报）。不丢一分钱（服务端金额独立计算），纯客诉制造机：餐券全免的顾客付 RM 0 看到「金额 RM 55.50」会以为被重复扣款；发给碗妈的 WhatsApp 也带着错数字，人工对账要来回问。

**工作量**：1 行 + 一句注释，5 分钟；改完 tsc，建议顺手用一笔餐券全免的测试单看一眼成功页

---

## [CONFIRMED] P3 — n8n-key-in-query-string

**结论**：属实：返回当天全部客户姓名+住址的 daily-prep 接口确实还允许 ?key= 传密钥，同仓另两个接口已经改硬了它没跟上——但今天没有实际泄露证据，是收口不是事故。

**判决依据**

evidence 逐字为真（行号因本轮改动漂移，按内容匹配到）。src/app/api/n8n/daily-prep/route.ts:412-418 逐字：
```
  const url = new URL(req.url);
  const headerKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const queryKey = url.searchParams.get('key');
  const supplied = headerKey || queryKey;
  if (!supplied || supplied !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
```
文档注释也确实把 ?key= 写成受支持 fallback：daily-prep/route.ts:17-18 `*   - ?key=<N8N_API_KEY>                   (fallback for tools that` / `*                                             can't set headers)`。
返回内容属实：daily-prep/route.ts:206-211 `summaries.push({ userName: o.userName || '客户', userAddress: (o.userAddress || '').trim(), ... })`，daily-prep/route.ts:239-241 `lines.push(\`👤 ${s.userName}\`)` / `lines.push(\`📍 ${s.userAddress}\`)`。
同款写法确实还有 3 处：daily-recap/route.ts:140-146（一字不差）、menu/route.ts:79-84（`const suppliedKey = headerKey || url.searchParams.get('key');`）、release-stale-fpx/route.ts:32-38（`return new URL(req.url).searchParams.get('key') === expected;`）。
对照组也属实：customer/route.ts:56-67 注释逐字 `// ── Auth：返回客户 PII，只收 Authorization 头（?key= 会漏进日志）+ 常数时间比较` 后接 `timingSafeEqual`；wa-order/route.ts:118-130 同款。所以「团队自己定了口径、这几个没跟上」成立。
主动找反证但没找到能挡住的东西：这 4 个路由没有任何其它守卫（无 Firebase auth、无 IP 白名单、无 middleware——只有 env key 一道）。

**修正后的触发路径**

任何用 `GET https://www.incredibowl.my/api/n8n/daily-prep?key=<N8N_API_KEY>` 形式发起的调用，都会把静态长效密钥写进 URL → Vercel 访问日志、任何中间代理日志、本机 shell history。反证补充（削弱 trigger）：仓库提交的 4 个 n8n workflow JSON（n8n/daily-prep-bowlmama.workflow.json:26、daily-prep-bowlmama-telegram:26、daily-recap-boss:26、daily-recap-boss-telegram:26）URL 都是干净的 `https://www.incredibowl.my/api/n8n/daily-prep`，且 daily-prep-bowlmama.workflow.json:51 notes 写明 `Uses Header Auth credential`——说明线上定时任务本身没在用 ?key=。目前仓库里唯一真的把 key 塞进 query 的调用是 scripts/dogfood-web-addon-credits.mjs:271 `${BASE}/api/n8n/release-stale-fpx?hours=1&key=${process.env.N8N_API_KEY}`（本机 dogfood）。

**修正后的改法**

把 4 个路由统一到 customer/wa-order 已经写对的那份，抽成共用函数别再复制第七遍：新建 src/lib/n8nAuth.ts
```ts
export async function requireN8nKey(req: NextRequest): Promise<Response | null> {
  const expected = process.env.N8N_API_KEY;
  if (!expected) return Response.json({ error: 'N8N_API_KEY not configured on server' }, { status: 500 });
  const supplied = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const { timingSafeEqual } = await import('node:crypto');
  const exp = Buffer.from(expected), got = Buffer.from(supplied);
  if (got.length !== exp.length || !timingSafeEqual(got, exp)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
```
daily-prep:412-418 / daily-recap:140-146 / menu:79-84 / release-stale-fpx:32-38 都换成 `const unauth = await requireN8nKey(req); if (unauth) return unauth;`，同时删掉 daily-prep:17-18、daily-recap:19-21、menu:22-23、release-stale-fpx:18 四处「?key= 也行」的注释。
⚠️ 会误伤现有正常流程（这是本条最大的实际风险，比漏洞本身大）：改完 = 任何还在用 ?key= 的调用方立刻 401。上线前必须逐个确认并同步改：① 线上 n8n 4 个 workflow 的 HTTP 节点全部走 Header Auth 凭据（Name=Authorization，Value=Bearer <key>）；② scripts/dogfood-web-addon-credits.mjs:271 改成 `fetch(url, { headers: { Authorization: \`Bearer ${process.env.N8N_API_KEY}\` } })`；③ 本机 Task Scheduler / 任何手写 curl。漏一个的后果：daily-prep 挂 = 06:30 碗妈收不到备餐单；release-stale-fpx 挂 = FPX 弃单不回补 dishStock，会假售罄挡真实订单。建议改完当天手动各触发一次确认 200，别等第二天早上。
另外 release-stale-fpx:42 现在返回 403，统一后会变 401，n8n 里如果有按状态码分支的判断要一起看。

**影响面**：当前=仅理论（要先把密钥泄出去才谈得上）。密钥若泄露：一次 GET 拿到当天每一单的顾客姓名+完整住址+备注（按 memory 日均约 21 单/33 碗，即一天约 20 户住址）；密钥静态、无轮换、泄露后长期有效。不丢钱、不影响下单。

**工作量**：半小时代码（新建 n8nAuth.ts + 改 4 处），但必须配一轮线上 n8n / dogfood 脚本改造与验证，实际按「独立一轮」排。

---

## [CONFIRMED] P3 — capi-initiatecheckout-value-ignores-voucher-discounts

**结论**：属实：回给 Meta 的 InitiateCheckout 金额只减了 promo，没减餐券和预付加料券，餐券单按面值上报——纯数据污染，不影响收款。

**判决依据**

evidence 逐字为真，行号因本轮 posInt 改动从 556 漂到 602。src/app/api/submit-order/route.ts:602 逐字：`    const serverTotal = Math.max(0, serverCartTotal - serverPromoDiscount) + serverDeliveryFee;`——确实只减 serverPromoDiscount。
同文件里正确口径的对照两处都存在：:442 `const finalTotal = Math.max(0, group.subtotal - currentPromo - currentMV - currentAC);`（写进订单文档的）、:388 `const cashDue = Math.max(0, serverCartTotal - serverPromoDiscount - serverMealVoucherDiscount - serverAddonCreditDiscount) + serverDeliveryFee;`（校验纯餐券支付的）。三个变量确实都在作用域内（:214/:236 serverMealVoucherDiscount、:269 serverAddonCreditDiscount），所以不是「拿不到值」。
这个数确实直接进 CAPI：:646 `value: serverTotal,` 在 :631 `await sendCapiEvent({ eventName: 'InitiateCheckout'` 的 customData 里，且 lib/meta-capi.ts:108 `if (typeof event.customData.value === 'number') c.value = event.customData.value;` 原样上报。
Purchase 侧口径正确也属实：confirm-order/route.ts:167-169 `const foodAfterDiscount = orderData.total ?? 0; const deliveryFee = orderData.deliveryFee ?? 0; const purchaseValue = foodAfterDiscount + deliveryFee;`，order.total 就是上面那个 finalTotal，所以 IC 与 Purchase 确实不同口径。
反证找了但没找到：submit-order/route.ts:667-668 的注释 `// serverTotal = food (after voucher) + delivery — what customer actually pays` 反而是错的（它没有 after voucher），说明是 bug 不是有意的 gross-value 设计。
同时确认了「不丢钱」：全仓 grep `serverTotal` 只有 submit-order 与 CartDrawer.tsx:572 一处**类型声明**，没有任何地方消费这个返回值；真正收款金额走 CartDrawer.tsx:405-407 注释所述 `Server derives the authoritative amount from the pending order docs`（/api/payment/create-order），与 serverTotal 无关。

**修正后的触发路径**

顾客用餐券（或预付加料 credit）下单 → submit-order 走到 :602 → InitiateCheckout 以未扣券的面值上报。例：3 张餐券吃掉 RM55.50、运费 0，serverMealVoucherDiscount=55.50 而 serverTotal 仍 = 55.50（应为 0）。确认后 confirm-order 按 order.total=0 触发 :170 `if (purchaseValue > 0)` 而**不发** Purchase——所以这类单在 Meta 里是「IC RM55.50 → 无 Purchase」，落差被双重放大。

**修正后的改法**

一行改，与订单文档同口径：
```ts
    // ⚠️ 只用于回前端 + CAPI，必须与订单文档的 finalTotal(:442) 同口径：
    //    餐券和预付加料券也要减，否则餐券单按面值上报给 Meta。
    const serverTotal =
      Math.max(0, serverCartTotal - serverPromoDiscount - serverMealVoucherDiscount - serverAddonCreditDiscount)
      + serverDeliveryFee;
```
顺手把 :667 那句已经写错的注释改对。
不会误伤任何现有流程：serverTotal 在全仓没有第二个消费方（CartDrawer.tsx:572 只是类型声明），收款金额由 /api/payment/create-order 独立从订单文档推导；改完只影响 Meta 收到的 IC value。
附带影响需老板知情：改完之后历史 IC 数据与新数据不同口径，做趋势对比要在 ad-week-real-roas 那套里标一个分界日期，不然会看成「IC 价值突然暴跌」。

**影响面**：不丢钱不丢单，纯广告数据。影响面 = 所有餐券/加料 credit 抵扣的订单（按 memory 餐券已是主力复购形态，日均约 21 单里占相当比例），这些单的 IC value 全部虚高，IC→Purchase 漏斗和真实 ROAS 校准这一段不可用。

**工作量**：1 行（加注释共 4 行）

---

## [CONFIRMED] P3 — capi-content-id-three-namespaces

**结论**：属实：目录用 dish-12、InitiateCheckout 用 12、Purchase 用中文菜名还混进「↳ 加料」行，三套 ID 两两不等，目录匹配率恒为 0；但提议的修法还漏了一件事——全站 CAPI 根本没发 content_type，只统一 ID 仍然匹配不上。

**判决依据**

三处 evidence 逐字全部为真（confirm-order 行号因本轮取消权限改动从 166 漂到 179）：
① src/app/api/meta/product-feed/route.ts:46 逐字 `` `dish-${d.id}`, `` —— 目录 SKU 是 dish-12。
② src/app/api/submit-order/route.ts:625 `      id: String(vb.dish.id),` 与 :648 `        contentIds: validatedBundles.map(vb => String(vb.dish.id)),` —— IC 是裸 12。
③ src/app/api/confirm-order/route.ts:179-183 逐字：
```
            items: items.map((it) => ({
              id: String(it.name ?? ''),
              quantity: Number(it.quantity ?? 1),
              item_price: Number(it.price ?? 0),
            })),
```
而 items 里的名字来自 submit-order/route.ts:448 `          name: vb.dish.name,`（中文菜名），加料行来自 :463 `                name: \`↳ ${a.name || a.id}\`,` —— 「加料行也被当成商品 ID 报上去」成立。
这些 id 确实原样落地到 Meta：lib/meta-capi.ts:109-110 `if (event.customData.contentIds) c.content_ids = event.customData.contentIds;` / `if (event.customData.contents) c.contents = event.customData.contents;`。
目录是活的也属实：product-feed/route.ts:43-44 从 weeklyMenu 现算，:21-22 注释 `No auth: the menu is already public`。
找反证时反而挖到一个加重项，也是原 fix 的漏洞：全仓 grep `content_type|contentType` 在 src 下只命中 MealVouchersView.tsx:167 与 CartDrawer.tsx:507 两处 Firebase Storage 上传，CAPI 侧一处都没有——lib/meta-capi.ts:105-113 拼 custom_data 时只写 currency/value/content_ids/contents/num_items/order_id，没有 `content_type: 'product'`。Meta 目录匹配要求 content_type，所以就算把 ID 统一成 dish-<id>，匹配率仍然是 0。

**修正后的触发路径**

任何一笔真实成交都走通：下单 → submit-order:648 上报 content_ids=['12']；确认 → confirm-order:179-183 上报 contents=[{id:'香煎金黄鸡扒饭'},{id:'↳ 加溏心蛋'}]；而目录里躺的是 dish-12。三者两两不等，Meta 侧按 content id 关联恒 0 命中。

**修正后的改法**

要一起做三件事，只做原 fix 的两件仍然无效：
1) submit-order/route.ts:625 与 :648 改成 `` `dish-${vb.dish.id}` ``。
2) confirm-order/route.ts:179-183 —— 订单文档只存中文名，需按名回查：文件顶部 `import { weeklyMenu } from '@/data/weeklyMenu';` + `const DISH_ID_BY_NAME = new Map(weeklyMenu.map(d => [d.name, d.id]));`，然后先 `.filter(it => !/^↳/.test(String(it.name ?? '')))` 再 map，命中就 `dish-<id>`、没命中保留原名兜底。注意 value 仍用 :169 的 purchaseValue，别改成过滤后加总，否则营收少掉加料。
3) **补 content_type**（原 fix 漏了，不补前两步白做）：lib/meta-capi.ts 的 CapiCustomData 加 `contentType?: string`，:105-113 拼装处加 `if (event.customData.contentType) c.content_type = event.customData.contentType;`，两个事件都传 `contentType: 'product'`。
误伤评估：不会影响下单/收款/订单文档——三处改的都只是发给 Meta 的字段。两个副作用要提前知会老板：① 改完之后历史 Purchase 的 content id 是中文名、新的是 dish-<id>，Meta 后台按商品拆分的历史数据不会追溯，等于换了口径要重新攒；② 回查用的是当前 weeklyMenu，已 retired 且从数组里删掉的老菜会走兜底保留中文名（不报错，只是那几单仍不匹配）；③ 若 weeklyMenu 里出现同名菜，Map 会后者覆盖前者，加新菜时要留意重名。

**影响面**：不丢单不丢钱，污染的是每月有真实预算的广告投放决策：动态商品广告 / Advantage+ 目录广告无法把成交归到具体菜品，「看过 A 菜再营销」做不了；且 IC 与 Purchase 口径不同，按菜品拆分的转化率全错。影响面 = 目录上线以来的全部事件。

**工作量**：约 20 行、跨 3 个文件（submit-order / confirm-order / meta-capi），加上事件调试器实测一次匹配率，半小时到一小时。

---

## [PARTIAL] P2 — manual-redemption-voucher-eaten-on-addon-failure

**结论**：核心漏洞是真的：先扣券后扣预付加料，加料一抛错券就被吞且订单上零记录、dashboard 回滚只删单不退券 —— 但 finding 描述的「靠第129行重复守卫再吞一次」的重试机制是错的（订单已被删，重试是全新单），且这是 admin-only + 需要缓存过期，P1 偏高，实际 P2。

**判决依据**

逐字核对通过：src/app/api/admin/manual-voucher-redemption/route.ts:150 `claimed = await claimMealVouchers(db, userId, count, orderId);`，:154 `const addonResult = await claimAddonCredits(db, userId, addonItems, orderId);`，:175 `await orderRef.update(update);`，:187-189 `catch (err: any) { ... return corsify(NextResponse.json({ error: err?.message || '操作失败' }, { status: 500 })); }` —— 三步之间**没有任何 try/catch 或补偿**，文件顶部 import 只有 `claimMealVouchers, countAvailableVouchers` 和 `claimAddonCredits`，**根本没 import release* 系列**，所以确实做不了回滚。抛错点也真实存在：src/lib/addonCreditUtils.ts:205-208 `if (totalAvail < count) { ... throw new Error(`预付「${name}」不足：需要 ${count} 个，账户里只有 ${totalAvail} 个`); }`，另外 :237/:241/:244 三个「抢占失败」也在事务里抛。扣券本身已落库：src/lib/mealVoucherUtils.ts:292-297 `tx.update(r, { status: 'redeemed', redeemedOrderId: orderId, ... })` 已 commit。

**但 finding 的重试叙述是错的。** 唯一调用方 public/dashboard-h7x2q9.html:13327（Desktop 源头副本 /c/Users/User/Desktop/Incredibowl Services/incredibowl-dashboard.html 同样在 13327）在 catch 里写的是 :13355-13357 `} catch (claimErr) { // Roll back the order to keep voucher / credit state consistent  try { await deleteDoc(doc(db, 'orders', orderId)); } catch {}` —— 订单被直接删掉了，所以第二次点保存走的是 :13317 `const docRef = await addDoc(collection(db, 'orders'), orderData);` 全新 orderId，route.ts:129 那个 `claimedMealVoucherIds` 守卫压根不参与，不是它「放行」的。而且第二次仍要过 :143-148 `countAvailableVouchers` 检查，池子被吃空时会 400，所以「每重试一次多吞 count 张」只在客户余券充裕时成立，不是无限吞。

反过来，我找到了比 finding 更硬的证据说明这个洞真实且不可自愈：dashboard 正常删单路径（Desktop 副本 11363-11371）是靠读 `order.claimedMealVoucherIds` / `order.addonCreditsUsed` 再调 `/api/admin/manual-voucher-release` 退券的；而失败回滚路径 :13357 用的是**裸 deleteDoc，没有任何 release 调用**，且此时订单上这两个字段本来就是空的 —— 券永久孤儿化，UI 上再也查不到、退不回。同类事故有先例：scripts/backfill-unclaimed-voucher-orders.mts 文件头写明「Zowi3 的 sunny-egg ... 差 3 个是 07-12 之前被删单吞掉的、顾客白付的」。

**修正后的触发路径**

1) 碗妈在 dashboard 手动单里同时勾了餐券和预付加料（UI 的 max 取自 state 缓存，见 dashboard renderMoPrepaidAddons `max="${c.remaining}"`），而该客户的 credit 已被订阅引擎/另一台设备消耗 → 缓存过期；或 2) claimAddonCredits 事务里撞并发抛「预付加料抢占失败」；或 3) route.ts:175 `orderRef.update` / 网络在扣券之后失败。任一情况：route.ts:150 已把 N 张券改成 redeemed，:154 或 :175 抛错 → :189 返回 500 → dashboard :13357 裸 deleteDoc 删掉订单（不调 manual-voucher-release）→ 券 status 停在 'redeemed'、redeemedOrderId 指向一个已不存在的订单。碗妈重新建单（新 orderId）再扣一次，只要余券够就再吞 N 张。注意：不是 finding 说的第 129 行守卫被绕过。

**修正后的改法**

最小改法 —— 不动成功路径，只给扣券之后的每一步配补偿（route.ts 顶部先补两个 import：`import { claimMealVouchers, countAvailableVouchers, releaseMealVouchers } from '@/lib/mealVoucherUtils';` / `import { claimAddonCredits, releaseAddonCredits } from '@/lib/addonCreditUtils';`）：

```ts
    // ── 4. 预付加料（会抛错）——失败必须把刚扣的券还回去，
    //      否则券被吞、订单零记录，dashboard 回滚只 deleteDoc 不 release。
    let addonResult;
    try {
      addonResult = await claimAddonCredits(db, userId, addonItems, orderId);
    } catch (e) {
      if (claimed.ids.length) await releaseMealVouchers(db, claimed.ids).catch(() => {});
      throw e;
    }

    // ── 5. 写回订单 —— 失败同样两样都退，绝不留「扣了但订单没记」的中间态。
    try {
      await orderRef.update(update);
    } catch (e) {
      if (claimed.ids.length) await releaseMealVouchers(db, claimed.ids).catch(() => {});
      if (addonResult.lines.length) {
        await releaseAddonCredits(db, userId,
          addonResult.lines.map(l => ({ addonId: l.addonId, count: l.count })), orderId).catch(() => {});
      }
      throw e;
    }
```

不采用 finding 的「调换顺序」版：调换后 claimMealVouchers 仍可能抛（mealVoucherUtils.ts:280/284 两个「抢占失败」），还是得写同一套补偿，白改一次成功路径的语义。

**误伤评估：两段代码只在 error path 执行，成功路径逐字不变。** releaseMealVouchers（mealVoucherUtils.ts:321 `if (v.status !== 'redeemed') continue;`）只处理本次请求刚拿到的 ID，动不了别单的券；releaseAddonCredits 优先退回 `lastRedeemedOrderId === orderId` 的批次并按 `quantityTotal - quantityRemaining` 封顶（addonCreditUtils.ts:310/339），orderId 是刚建的新单不会撞别人。唯一退不了的残余是「服务端已全部成功但响应在路上丢了」——那时 dashboard 仍会删单，建议顺手把 dashboard :13355 的 catch 改成先 `getDoc(orders/orderId)`，若已有 claimedMealVoucherIds 就当成功不删（这条属于 dashboard 两副本同步改动，可另开一轮）。

**影响面**：单次事故吞 count 张券，按 allocatedValueRM ≈ RM17.5-18.5/张算，典型 1-3 张 = RM 18~55 的客户预付款静默蒸发，且订单侧零记录、dashboard「已抵扣」显示 0，只能逐条翻 mealVouchers 集合（找 redeemedOrderId 指向已删订单的 doc）才查得出来。仅 admin（ADMIN_EMAILS 两个邮箱）手动建单时可能触发，顾客端 /api/submit-order 走的是另一条链路不受影响；同类「删单吞 credit」历史上真实发生过 3 个荷包蛋（见 backfill-unclaimed-voucher-orders.mts 文件头），所以不是纯理论。

**工作量**：约 15 行 + 2 个 import；含 tsc 和一次人工造错验证约半小时

---

## [PARTIAL] P2 — subscription-week-nonatomic-idempotency

**结论**：缺口是真的（没有 maxDuration、batchTag 查重非原子、扣券失败没有补偿），但「券永久烧掉没有任何路径退回」是误读——admin 的 manual-voucher-release 只要 voucherIds、根本不需要订单；而「被平台掐掉」的前提也站不住，这个循环实测只有 ~40 次往返。

**判决依据**

【真实部分，逐字核对通过】
src/app/api/admin/subscriptions/week/route.ts:313-315 逐字为：
    const batchTag = `sub-${weekStart}-${subscriptionId}`;
    const existing = await db.collection('orders').where('batchTag', '==', batchTag).limit(1).get();
    if (!existing.empty) return adminJson({ error: `batchTag=${batchTag} 已建过单，拒绝重复` }, 409);
确实是 check-then-act，不是原子。

同文件 343-348 逐字为：
      const addonClaim = d.upgradeUsed.length > 0
        ? await claimAddonCredits(db, sub.userId, d.upgradeUsed, orderRef.id)
        : { recognizedRevenueRM: 0, lines: [] };
      const claim = await claimMealVouchers(db, sub.userId, d.vCount, orderRef.id);
      const deliveryFee = Number(sub.deliveryFeePerDelivery) || 0;
      await orderRef.set({
这段确实无 try/catch、无补偿；整个 POST（241-406 行）也没有顶层 try/catch（对比 src/app/api/admin/delivery-batch/route.ts:41 `try {` / 270 `} catch (err: any) {` 是包住的）。

全仓 maxDuration 只有两处：delivery-batch/route.ts:36 `export const maxDuration = 60;`、migrate-points/route.ts:23。本文件确实没有。delivery-batch:34-35 的注释逐字含「默认 10s 不够」——属实。

扣券确实会留痕到幽灵订单：mealVoucherUtils.ts:292-297 `tx.update(r, { status: 'redeemed', redeemedOrderId: orderId, ... })`；addonCreditUtils.ts 事务里 `lastRedeemedOrderId: orderId`。orderId 就是 340 行 `db.collection('orders').doc()` 预分配、可能永远不写入的 id。

仓库里确实有原子认领的对照实现：src/app/api/n8n/wa-order/route.ts:201-213 逐字 `// 原子认领 pending→confirming：并发的第二个 confirm…` + `const claim = await db.runTransaction(async tx => {`。这条对照成立。

【被夸大/误读的部分——这是判 PARTIAL 而不是 CONFIRMED 的理由】
1) finding 写「没有任何路径会退回（…这里根本没有订单可取消）」——**错**。src/app/api/admin/manual-voucher-release/route.ts:54-59 文档逐字写「Body (at least one of the two): - voucherIds: string[]」，:68 `const hasVouchers = Array.isArray(voucherIds) && voucherIds.length > 0;`，:81 `if (hasVouchers) await releaseMealVouchers(db, voucherIds);`——**全程不校验订单是否存在**。幽灵订单的券可以直接按 id 退回。加料储值同理（:84 releaseAddonCredits，且 addonCreditUtils 的退回优先找 lastRedeemedOrderId === orderId 的批次，正好命中幽灵 id）。所以是「要人肉发现 + 一条 admin API 收尾」，不是「永久烧掉」。
2) finding 引 scripts/audit-addon-credit-leaks.mjs「说明这类泄漏已经发生过」——**误引**。该脚本首行逐字：「Global sweep: any user whose addon-credit batch consumption exceeds what their EXISTING orders hold → credits swallowed by **deleted orders**」。它审的是删单导致的泄漏，与本路由的中途失败无关，不构成本 bug 的实证。
3) 「30~50 次往返被平台掐掉」的成本估算偏高：consumeIngredientStock 是**单次批量提交**（src/lib/ingredientStock.ts:241 `const batch = db.batch();` … :258 `if (touched) await batch.commit();`），不是逐条写。5 天单实测量级 ≈ 40 次往返（1-3 秒），离 10s 预算还很远。超时是尾部风险，不是常态。
4) 只有 admin 能进（route.ts:242 `const adminEmail = await verifyAdminEmail(req);`），前端还有 confirm() 弹窗（page.tsx:145）+ 按钮 disabled（page.tsx:288 `disabled={!p.canConfirm || confirmingId === p.subscriptionId}`）。并发双提交要两个标签页/两台设备，单人操作下属理论并发。

**修正后的触发路径**

真正可复现、且不需要平台超时的路径（比 finding 写的窄一档但更现实）：
1) 老板对某个 5 天订阅点「确认建单 + 扣券」。route.ts:329-332 先按整周总量做了 countAvailableVouchers 预检，所以正常情况下不会不够。
2) 建到第 3 天时 claimMealVouchers 抛错——现实触发源：顾客自己在网页结账同时抢走了券（mealVoucherUtils.ts:280 `throw new Error('餐券抢占失败（可能在另一个会话被使用了），请重试')`），或 Firestore 事务 ABORTED/DEADLINE 之类的瞬时错误。
3) 该 POST 无顶层 try/catch → 直接 500。此时第 3 天的 claimAddonCredits 已经提交（如果这天有升级/预付加料），mealVoucherAddonCredits 的 quantityRemaining 已扣、lastRedeemedOrderId 指向一个永远不会写入的 orderRef.id，**没有任何回滚**。
4) 老板重试 → 313-315 因为第 1、2 天订单已存在而 409，剩余 3 天只能手工补；第 3 天被扣掉的储值不会自己回来。

「重试把整周再建一遍、券扣两批」的变体成立但更窄：必须恰好掐在**第 1 天** claimMealVouchers 之后、orderRef.set 之前（约 30~100ms 的窗口），此时 orders 里还没有任何 batchTag 文档。这属于尾部概率，不是常见路径。
并发双提交（两个标签页同时点确认）能绕过 313-315，也成立，但需要单人开两处操作。

**修正后的改法**

按性价比排序，前两条建议做，第三条可选：

(1) 一行，零风险——加时间预算，和 delivery-batch 同款：
```ts
// src/app/api/admin/subscriptions/week/route.ts 顶部
export const maxDuration = 60;
```

(2) 核心修复：给每天的「扣券→建单」加补偿，失败原路退回。只在异常分支生效，happy path 一行不动，**不会误伤现有正常流程**：
```ts
for (const d of usable) {
  const orderRef = db.collection('orders').doc();
  let addonClaim: { recognizedRevenueRM: number; lines: { addonId: string; count: number }[] } =
    { recognizedRevenueRM: 0, lines: [] };
  let claim: { ids: string[]; allocatedTotalRM: number } | null = null;
  try {
    if (d.upgradeUsed.length > 0) {
      addonClaim = await claimAddonCredits(db, sub.userId, d.upgradeUsed, orderRef.id);
    }
    claim = await claimMealVouchers(db, sub.userId, d.vCount, orderRef.id);
    await orderRef.set({ /* …原字段一字不改… */ });
  } catch (err) {
    const { releaseMealVouchers } = await import('@/lib/mealVoucherUtils');
    const { releaseAddonCredits } = await import('@/lib/addonCreditUtils');
    if (claim?.ids.length) await releaseMealVouchers(db, claim.ids).catch(() => {});
    if (addonClaim.lines.length) {
      await releaseAddonCredits(db, sub.userId,
        addonClaim.lines.map(l => ({ addonId: l.addonId, count: l.count })), orderRef.id).catch(() => {});
    }
    console.error(`[subscriptions] ${d.date} 建单失败，已退回券/储值`, err);
    return adminJson({ ok: false, batchTag, created,
      error: `建到 ${d.date} 失败（该天的券/储值已退回，前 ${created.length} 天已建好，请手工补剩余天数）：${(err as Error).message}` }, 500);
  }
  created.push({ orderId: orderRef.id, date: d.date, voucherIds: claim.ids });
  /* …扣库存段不动（它自己已有 try/catch，385-398）… */
}
```
注意：releaseAddonCredits 的退回优先落回 lastRedeemedOrderId === orderRef.id 的批次，正好是刚扣的那批，退得准。

(3) 原子锁（可选，优先级最低）。**不要照抄 finding 给的版本**——它写「锁故意不删」，那会让一次干净的 500（什么都没建）永久锁死这个 subscription+week，再也确认不了，属于自伤。要做就抄本仓已有的 wa-order 模式（wa-order/route.ts:203-213），带过期重领：
```ts
const lockRef = db.collection('subscriptionWeekLocks').doc(batchTag);
const got = await db.runTransaction(async tx => {
  const s = await tx.get(lockRef);
  const cur = s.data() || {};
  const stale = Date.now() - (Number(cur.startedAtMs) || 0) > 3 * 60 * 1000;
  if (!s.exists || stale) { tx.set(lockRef, { startedBy: adminEmail, startedAtMs: Date.now() }); return true; }
  return false;
});
if (!got) return adminJson({ error: `${batchTag} 正在建单中，别重复点` }, 409);
```
原有的 313-315 orders 查重保留不动（历史数据兜底）。

**影响面**：仅 admin 可触发（route.ts:242 verifyAdminEmail），每周一次、当前只有个位数订阅。单次事故的现实规模：失败那一天的餐券（1~2 张，面值约 RM15/张）+ 该天的预付储值份数；极窄的第 1 天窗口才会变成整周 5~10 张券（RM75~150）+ 整周订单/备餐/库存翻倍。且并非不可逆——manual-voucher-release 可按 voucherIds 直接退回。目前没有证据显示已经发生过（audit-addon-credit-leaks.mjs 审的是删单泄漏，不是这条）。

**工作量**：(1) 1 行；(2) 约 25 行改动 + 跑一次 dogfood，半小时；(3) 另起一轮（约 15 行 + 需要想清楚锁的过期语义）

---

## [PARTIAL] P2 — first-confirm-race-double-ltv

**结论**：「首次确认」的副作用确实会重复执行 —— 生产库里已经抓到 3 个账号被多记了 1 单和 1 笔钱；但报告写的触发路径（webhook 撞浏览器）没被证实，真正跑出来的那条路是老板在 Dashboard 把已送达单往回点成「已确认」，而报告给的修法恰恰堵不住这条路。

**判决依据**

evidence 逐字真实。src/app/api/confirm-order/route.ts:156 `const isFirstConfirm = status === 'confirmed' && orderData.status !== 'confirmed';`、:157 `if (isFirstConfirm) receiptOrders.push({ id: orderId, data: orderData });`；判定源头是 :135 `const orderSnap = await orderRef.get();`，状态写回在 :252 `await orderRef.update(updateFields);`，中间无事务无 CAS —— 结构指控成立。

【生产实证：确有重复执行】我用只读脚本比对了 170 个 users 的 `totalOrders` 与其名下「曾确认」订单数，抓到 3 个干净命中：
· Nicole Lin `nNuId7EpXG…` totalOrders=3 但只有 2 单；totalSpent=121.50 vs 已确认单合计 79.70，差额 **RM 41.80 恰好等于 #SIZS4K 的 total+fee**；该账号 0 笔取消单、无合并痕迹。
· Guest `GSV7uVW86m…` totalOrders=3 / 实际 2；差额 **RM 19.90 恰好等于 #JQYYVL 的 14.90+5.00**；同样 0 笔取消单。
· ChungEe Tan `WJvAscXcAr…` totalOrders=10 / 实际 9；差额 **RM 35.40 等于一笔单的额**（此人有取消单，稍弱）。
全仓 `totalOrders` 只有一处会 +1：confirm-order/route.ts:195-198 `await userRef.set({ totalOrders: FieldValue.increment(1), totalSpent: FieldValue.increment(foodAfterDiscount + deliveryFee), }, { merge: true });`。合并脚本已排除（scripts/logs 里两次合并的目标 uid 是 s7xJQXnd…/bvwK3hsU…，都不是上述账号，且这些 user doc 无 mergedInto 痕迹）。所以「同一笔单跑了两次首次确认」是**已发生的事实**。

【但触发路径判错了】报告只讲 webhook vs 浏览器的毫秒级竞态。实际存在一条**确定性、无需并发**的路：src/app/admin/page.tsx:312 `const handleStatusChange = async (order: AdminOrder, newStatus: OrderStatus) => {` → :320-324 把任意 newStatus 直接 POST 给 confirm-order。老板把单推到 preparing/delivering/delivered 之后，只要再从下拉框选回「已确认」，:156 读到的 `orderData.status` 是 'delivered' ≠ 'confirmed' → isFirstConfirm 又为 true → 再 +1 单 +1 笔钱 + 再发一封收据。上面 3 个命中单全是 delivered 态，与这条路完全吻合。

【报告的影响①是误读，必须驳回】它说会让 voucherValidation.ts 的首单券对真首单顾客失效。src/lib/voucherValidation.ts:115-117 逐字是 `const placed = typeof userData.totalOrders === 'number' ? userData.totalOrders : 0;` / `if (placed > 0) {` / `return { ok: false, error: '此优惠码只限首次下单使用', status: 400 };` —— 判据是 `> 0`，totalOrders 是 1 还是 2 结论完全一样；而且 LTV 是在 confirm 阶段才 +1，本单的券早在 submit 阶段就校验完了，不可能自己影响自己。这条影响不存在。

【影响②③成立】收据邮件无幂等标记：src/lib/receiptEmail.ts 全文没有任何 receiptSentAt/已发标记，:295-297 `if (receiptOrders.length > 0) { … await sendOrderReceiptEmails(receiptOrders); }` 跑两次就发两封。LTV 虚高会污染 admin/page.tsx:476-477 的客户排序、member 页展示、n8n/customer:151-160 给 WhatsApp bot 的「历史 N 单」。

【CAPI 不受影响】:174 `eventId: \`purchase_${orderId}\`` 两次相同，Meta 按 event_id 去重，广告数据不会双记 —— 报告没乱说这条，予以确认。

【webhook 竞态本身：可能但未证实】src/app/api/payment/webhook/route.ts:74 确实两个事件都收（`if (type !== 'payment.captured' && type !== 'order.paid')`），:175 `const pendingIds = ordersQ.docs.filter(d => d.data().status === 'pending').map(d => d.id);` 是 read-then-act，无锁，理论上会与浏览器 page.tsx:171 / CartDrawer.tsx:721 同时读到 pending。但 order.paid 是否真的开着只有 Curlec 后台能看（:27 注释写「order.paid optional」），我在代码里无法证实；而且实测数据无法把 3 个命中归因到毫秒竞态而非 Dashboard 回点。所以判 PARTIAL 而非 CONFIRMED。

**修正后的触发路径**

主路径（确定性，已在生产留下痕迹）：老板在 /admin 订单行把状态下拉框从「已确认/备餐中/配送中/已送达」再选一次「已确认」→ admin/page.tsx:320 POST confirm-order → route.ts:135 读到 status='delivered' → :156 isFirstConfirm=true → :195-198 再 +1 单 +total → :295-297 再发一封收据邮件。零并发即可复现。

次路径（理论并发，未证实）：同一笔 FPX 付款的 Razorpay webhook（webhook/route.ts:175 过滤 pending 后调 confirm-order）与浏览器回跳（page.tsx:171 或 CartDrawer.tsx:721）在 :135 get 与 :252 update 之间（窗口约 100–500ms，中间夹着 userRef.set 和 promo 事务两次往返）同时读到 pending。

**修正后的改法**

把「是不是首次确认」改成一次性的单调标记，并且用事务把判定和状态翻转绑在一起。只改 confirm-order/route.ts 一个文件：

```ts
// route.ts 顶部
const EVER_CONFIRMED = new Set(['confirmed', 'preparing', 'delivering', 'delivered']);

// 替换 :156-157 与 :244-252
let isFirstConfirm = false;
await db.runTransaction(async (tx) => {
  isFirstConfirm = false;                    // ⚠️ 事务重试会重跑回调，必须重置
  const fresh = await tx.get(orderRef);
  if (!fresh.exists) return;
  const fd = fresh.data()!;
  // 单调标记：只认「这单从没被确认过」，不认「当前状态碰巧不是 confirmed」。
  // firstConfirmedAt 挡住新单重复；EVER_CONFIRMED 挡住存量老单（它们还没有
  // 这个字段），两条合起来免去回填。
  isFirstConfirm = status === 'confirmed'
    && !fd.firstConfirmedAt
    && !EVER_CONFIRMED.has(fd.status);
  const f: Record<string, any> = { status, updatedAt: FieldValue.serverTimestamp() };
  if (isFirstConfirm) f.firstConfirmedAt = FieldValue.serverTimestamp();
  if (paymentData?.razorpayPaymentId)  f.razorpayPaymentId  = paymentData.razorpayPaymentId;
  if (paymentData?.razorpayOrderId)    f.razorpayOrderId    = paymentData.razorpayOrderId;
  if (paymentData?.razorpaySignature)  f.razorpaySignature  = paymentData.razorpaySignature;
  tx.update(orderRef, f);
});
if (isFirstConfirm) receiptOrders.push({ id: orderId, data: orderData });
```
然后把 :166 / :188 / :203 三个 `if (isFirstConfirm)` 分支原样留着，删掉 :244-252 的 updateFields + orderRef.update（状态写入已进事务）。

⚠️ 报告原方案不能照抄：它写的是 `isFirstConfirm = status === 'confirmed' && fresh.data()!.status !== 'confirmed'` —— 只是把同一个错误判据搬进事务。老板从 delivered 回点确认时 fresh.status 仍是 'delivered'，照样判成首次，**堵不住已经在生产发生的那条主路径**。必须换成 firstConfirmedAt + EVER_CONFIRMED。

误伤评估：不会误伤任何现有正常流程。① 首次 FPX/QR 确认：fd.status='pending'、无 firstConfirmedAt → 照常走全部副作用。② 老板推进 preparing→delivering→delivered：status 不是 'confirmed'，本来就不进这个分支。③ 迟到付款把 cancelled 单救活：'cancelled' 不在 EVER_CONFIRMED 里 → 仍判首次，顾客照样拿到 LTV 和收据（正确行为）。④ 存量已确认/已送达老单被再点一次：现在正确地不再重复计。

配套（可选，老板拍板后再做）：写个一次性脚本按上面的诊断口径把 Nicole Lin / Guest GSV7uVW86m / ChungEe Tan 的 totalOrders 与 totalSpent 回退到实际值 —— 参照现成模板 scripts/cancel-k66xns-unpaid-duplicate.mts:59 `totalOrders: FieldValue.increment(-1)`。

**影响面**：已发生：170 个账号里 3 个 LTV 被多记（Nicole Lin +1 单/+RM41.80、Guest GSV7uVW86m +1 单/+RM19.90、ChungEe Tan +1 单/+RM35.40），对应这 3 位顾客各多收到一封重复的订单确认邮件。不丢钱、不白吃、不影响广告数据（CAPI 同 event_id 被 Meta 去重）、不影响首单券发放。真实损失=客户分层/LTV 报表偏高 + 少量重复邮件。若不修，随老板每次回点状态继续累积。

**工作量**：约半小时：confirm-order/route.ts 改 ~20 行（一个事务 + 一个常量集合），跑 tsc + 本地起服务器过一遍 FPX 确认和 admin 状态来回切；另可选一个一次性回退脚本 ~30 分钟。

---

## [PARTIAL] P3 — promo-concurrent-reuse

**结论**：机制属实——promo 码确实只在「订单被确认」时才扣，确认前的窗口里同一账号能重复减 RM5；但「一个人吃光 RM250 拉新预算」是夸大（每多减一次都要真下一单真付钱），而且它给的修法会把 07 月刚修好的「FPX 半路放弃就把券烧掉」老 bug 原样请回来。

**判决依据**

三处代码逐字核实，claim 确实全部推迟到确认时：
① src/app/api/submit-order/route.ts:200-205 只 validate 不预占：`if (promoCode && clientPromoDiscount > 0) { const result = await validateVoucher(db, promoCode, { userId }); ... serverPromoDiscount = result.discount; }`；同文件 582-587 行注释自证是故意的：`// Voucher consumption (usedCount + user.vouchersUsed) is intentionally // deferred to /api/confirm-order.`
② src/app/api/confirm-order/route.ts:203 `if (isFirstConfirm && orderData.promoCode && orderData.userId) {` 内的事务才写 231 行 `{ vouchersUsed: FieldValue.arrayUnion(code) },` 和 223-228 的 `usedCount: nextUsed`。
③ 拦截侧 src/lib/voucherValidation.ts:103-106 读的正是这个数组：`const usedByMe: string[] = Array.isArray(userData.vouchersUsed) ? userData.vouchersUsed : []; if (usedByMe.includes(code)) {`；firstOrderOnly 的 115 行 `const placed = typeof userData.totalOrders === 'number' ? userData.totalOrders : 0;` 读的 totalOrders 同样只在 confirm-order:195-198 `totalOrders: FieldValue.increment(1)` 里加。
所以「提交时的三道锁全部依赖确认后才落地的字段」为真，TOCTOU 成立。

但 finding 的 impact 段落经不起推敲：usedCount 只在确认时 +1，要把 maxUses=50 吃满，攻击者得先真下 50 单、真付 50 次钱（每单省 RM5、成本 RM25+），「把拉新码整个打掉」在经济上不成立。
另外 finding 的 fix 有硬伤：submit-order:582 那段注释写得很清楚，提前扣就是当初被回退掉的方案；而回补它的 /api/n8n/release-stale-fpx 至今没有调度器（仓库无 vercel.json crons，src/lib/orderRollback.ts:8 逐字写着「release-stale-fpx 四样齐全（做得对，但从来没被调用过）」），顾客关掉标签页放弃 FPX 就没人取消，券会被白烧。

**修正后的触发路径**

真正可复现的只有「未确认窗口」这一条，且必须蓄意：
· QR 单窗口最长——submit-order:489 落库即 `status: 'pending'`，一直等老板在 Dashboard 核收据，几小时。这期间同一账号连下 N 单，每单都手动输 FIRST5，validateVoucher 看到的 vouchersUsed 仍是 []、totalOrders 仍是 0 → N 单全减 RM5。
· FPX 是「先把 N 单全部 submit（都 pending），再逐一付款」；正常一单付完立刻 confirm，窗口只有几秒，做不到顺手重复。
· 排除「顾客不小心重复用」：CartDrawer.tsx:359 套用成功就 `clearPendingPromo();`，localStorage 里的码被清掉，第二次结账不会自动填 → 必须人肉重输，属蓄意。
· 顺带核实 finding 尾巴那条多段订单问题为真：submit-order:501 `if (promoCode) payload.promoCode = promoCode.trim().toUpperCase();` 在 417 行的 per-group 循环里，每一段都带码，confirm-order 按段各 claim 一次 → 一张 RM5 码在两日订单上吃掉 2 次 maxUses（顾客拿到的折扣仍只有 RM5，只是计数器虚耗，不是漏钱）。

**修正后的改法**

不要按 finding 说的提前扣 usedCount（会重演「放弃 FPX 烧券」）。改成查订单历史做互斥，取消单天然不算数：

```ts
// src/app/api/submit-order/route.ts —— validateVoucher 通过之后、建单之前
const code = promoCode.trim().toUpperCase();
const prior = await db.collection('orders')
  .where('userId', '==', userId)
  .where('promoCode', '==', code)
  .limit(20).get();
if (prior.docs.some(d => d.data().status !== 'cancelled')) {
  return NextResponse.json({ error: '您已使用过此优惠码' }, { status: 400 });
}
```
需要 Firestore 复合索引 (userId ASC, promoCode ASC)。
误伤评估：① 真·首单客户没有任何带该码的历史单 → 零影响；② FPX 放弃/失败的单会被 cancelOrderWithRollback 标 `status:'cancelled'`，被 `!== 'cancelled'` 排除，客户能重下，不会重蹈烧券老坑；③ 多段订单是在这段代码之后才进 517 行的写库循环，不会自撞。

顺带修多段双扣（1 行，可选）：confirm-order:203 改成 `if (isFirstConfirm && orderData.promoCode && orderData.userId && (!orderData.isMultiPart || orderData.partIndex === 1))`；⚠️ 必须同步给 src/lib/orderRollback.ts:193 的退还加同样条件，否则取消两段会把 usedCount 减 2，反而把码「退多了」。

**影响面**：每重复一次 RM5，且攻击者要为每一单真付钱。按备忘录里单份净贡献 RM4.95 算，重复 FIRST5 ≈ 那一单白做，不是净亏现金。现实上限是老板在 Dashboard 看到同一电话/同一地址反复挂 FIRST5；日均 ~21 单的量级，一个人在被发现前大概能薅 3~5 次 = RM15~25。理论上限 RM250（maxUses 50），但需要 50 单真实付款才够得着。

**工作量**：1 个查询 + 1 个复合索引（等索引 build），约半小时；多段双扣再加 2 行。

---

## [PARTIAL] P3 — first-order-promo-phone-dedup-bypass

**结论**：「清空 users.phone 就跳过同号去重」这一步是真的，我把整条路走通了（甚至比它说的更顺——UI 完全察觉不到）；但根因不是规则白名单，而是「首单去重靠一个自己填的电话号」，所以它开的两个药方一个没用、一个会直接打断访客下单。

**判决依据**

逐字核实，evidence 与触发链每一步都成立：
① firestore.rules:29 userSafeFields() 里确实有 `'phone', 'phoneNormalized',`，53-56 行 `allow update: if isSignedIn() && request.auth.uid == userId && request.resource.data.diff(resource.data).affectedKeys().hasOnly(userSafeFields())` → 本人（含匿名）能把这两个字段写成任意值，包括空串。
② src/lib/voucherValidation.ts:121-122 `const myPhone = normalizePhone(userData.phone); if (myPhone) {` —— phone 为空则整段去重（123-135 行那次 `.where('phoneNormalized','==',myPhone)` 查询）根本不执行。
③ 另两道锁对新 uid 天然失效：103 行 vouchersUsed 新文档为空（rules:43 `safeInitialDefaults()` 强制建档时为 0 条），115 行 totalOrders 新 uid 恒为 0。
④ 匿名 uid 免费无限：src/lib/auth.ts:77-78 `export const signInAsGuest = async () => { const result = await signInAnonymously(auth);`，CartDrawer.tsx:72-73 直接调。
⑤ 我还找到 finding 没写的加强证据：src/context/AuthContext.tsx:102 `const data = await getUserProfile(user.uid);` 是一次性 getDoc、**没有 onSnapshot**，所以控制台清空 phone 之后 React 里的 userProfile 仍是旧值 → CartDrawer.tsx:602 的 `if (!userProfile?.phone || !userProfile?.address)` 照样放行，550 行 `userPhone: userProfile!.phone` 还会把真号写进订单。攻击者不用手搓 API，走正常 UI 就行。

判 PARTIAL 而不是 CONFIRMED，因为两点被说歪了：
· 根因归错。phone 在白名单里只是「最省事的一种绕法」；`phone` 本来就是顾客自己在收货表单里填的，换个号码打字就绕过了，一行控制台都不用敲。把洞挂在 rules-clienttrust 上会引导老板去改规则，改完照样能绕。
· 「一个人吃掉 50 次 = RM250」同上一条：usedCount 只在确认时 +1，要吃满得下 50 单真付款单。

**修正后的触发路径**

两条路都能到，控制台那条不是必需的：
· 路 A（finding 描述的，已验证可走）：无痕窗口 → 访客下单拿新匿名 uid → 填真手机+地址走完 geocode（saveDeliveryProfile 写 phone/phoneNormalized）→ 控制台 `setDoc(doc(db,'users',uid),{phone:'',phoneNormalized:''},{merge:true})` → 规则放行 → 输 FIRST5 → voucherValidation:122 去重跳过 → 减 RM5；因为 AuthContext 不是实时监听，前端毫无反应，订单里 userPhone 仍是真号，碗妈照样联系得上。
· 路 B（更省事，finding 没提）：无痕 + 新匿名 uid + **收货表单里直接填另一个号码**（家人号/多一位少一位的号）→ 上一轮那个 uid 的 phoneNormalized 对不上，123-126 行的查询查不到 → 同样减 RM5，零 console、零技术门槛。
两条路都必须等上一单**已确认**之后才有必要（未确认窗口内连 vouchersUsed 都是空的，见 promo-concurrent-reuse）。

**修正后的改法**

⚠️ 先否掉 finding 的两个药方：
· 第一层「空 phone 就拒发首单码」——拦得住路 A，拦不住路 B（phone 在白名单里，写空和写别的号一样自由），等于只挡住最笨的一种。
· 第二层「把 phone/phoneNormalized 从 userSafeFields() 拿掉」——**会直接打断现有正常流程**：saveDeliveryProfile → src/lib/auth.ts:166 `await setDoc(userRef, payload, { merge: true });` 走的是客户端 SDK，phone 一旦不在白名单，规则的 hasOnly() 立刻拒写，购物车内嵌收货表单（CartDeliveryInfo:120）和 AuthModal 资料页（:169）全部保存失败，访客下单直接死。要做必须先建服务端写入 API，绝不能只删白名单。

最小正确改法（2 行，零误伤）：让去重键用「这一单实际填的收货电话」而不是「users 文档里那个可以随便改的 phone」——
```ts
// src/app/api/submit-order/route.ts:201
const result = await validateVoucher(db, promoCode, { userId, phone: userPhone });
// src/lib/voucherValidation.ts —— 签名加 phone?: string，121 行改成
const myPhone = normalizePhone(opts.phone || userData.phone);
```
误伤评估：正常顾客 body 里的 userPhone 和 users.phone 本来就是同一个（CartDrawer:550 直接取 userProfile.phone），判定结果与现在完全一致；只有被人为抹掉 users.phone 的账号会从「跳过去重」变回「照常去重」。这一刀把路 A 彻底封死，路 B 的成本也从「敲一行 console」升到「必须给假收货电话」（老板打不通电话本身就是人工识别信号）。
真正根治只有下单 OTP —— 那是产品决策，不建议现在做。

**影响面**：和上一条同源、同量级：每绕一次 RM5，理论天花板 RM250（maxUses 50）但需要 50 单真付款。识别信号是「同一送货地址反复出现 FIRST5」和（修完之后）「电话打不通」。对广告 CAC 有轻微污染（假新客），但按日均 ~21 单的体量属噪声级。

**工作量**：2 行 + 函数签名加一个可选参数，10 分钟；不需要动 firestore.rules，不需要重新发布规则。

---

## [PARTIAL] P3 — ingredient-need-double-count

**结论**：重复扣是真的（onHand 在下单当刻已被扣过，面板又按同一批订单再减一次），但只影响老板一人看的建议采购面板、不阻挡任何下单、每次盘点校正就自愈；而且它给的修法是错的，照抄会从「多买」变成「真断货」。建议降到 P3 当小活干。

**判决依据**

【机制属实，逐字核对通过】
- src/lib/ingredientStock.ts:196-201 consumeIngredientStock 转调 applyOrderMovement(db, items, -1, 'consume', ctx)；:247-250 batch.update(refs[i], { onHand: FieldValue.increment(delta), updatedAt: FieldValue.serverTimestamp() })。扣的时机是建单当刻，与 deliveryDate 无关。
- 三个建单入口逐字确认：src/lib/manualOrderCore.ts:214-215（上方 :202 注释「老板拍板 2026-07-05：提前单也建单即扣」）、src/app/api/admin/subscriptions/week/route.ts:394-395、src/app/api/submit-order/route.ts:596-597（finding 写的 550-551 是旧行号，内容一致）。
- src/app/api/admin/ingredient-stock/route.ts:93 const snap = await db.collection('orders').where('deliveryDate', '==', date).get(); → :96 汇总成 needed → :113 shortfall: Math.max(0, need - onHand),（evidence 逐字命中）。同一批订单被算了两次。
- matrix 同病：:165 let bal = onHand, runoutIndex = -1; 起点就是被扣过的 onHand，:166 再逐日 bal -= perDay[i]。
- 文案冲突属实：public/dashboard-h7x2q9.html:11666「消耗由下单自动扣」与 :11667「结余 = 现有 − 当日所需」同框；:11780「红＝已不够（最深红那格＝首个告罄日）」；:2113「红格＝那天告罄」。（finding 把 2113 的话挂在 11780，位置写错但两句都真实存在。）

【但被夸大的四点，所以判 PARTIAL 不判 CONFIRMED】
1. 仅 admin 可见、纯提醒：route.ts:27-28 const adminEmail = await verifyAdminEmail(req); if (!adminEmail) return adminJson({ error: '未授权访问' }, 403);；ingredientStock.ts:16-17 注释「ADVISORY ONLY: a shortage NEVER blocks an order.」。不掉一分钱、不挡一张单、不影响顾客。
2. 默认日期是今天，而今天那一行通常是对的：dashboard:11551 $('#invIngDate').value = ymdKey(t);。面板 card-sub（:2096）写「每日盘点录入现有量」，而 setIngredientStock 是覆盖写（ingredientStock.ts:143 const payload: Record<string, unknown> = { name, onHand, updatedAt: FieldValue.serverTimestamp() };），所以每次校正都把「校正之前所有单的扣减」一笔勾销。老板 06:00 截单后早上盘点一次，今天的单全在盘点之前 → 已被覆盖抹掉 → need(今天) − onHand 是单算、正确的。误差只等于「上次校正之后新进来的单」，不是 finding 说的「通常等于一整天的用量」。
3. 自愈且有明显破绽：那行「现有」显示 0 而冰箱躺着 2kg，本身就是刺眼信号；老板按面板设计流程点一下「校正=」输真实数，shortfall 立刻归零。
4. 取消单不构成加重因素（我特意查了）：src/lib/orderRollback.ts:155-156 releaseIngredientStock(db, items, { orderId, source: 取消回补(...) })；src/app/api/admin/consume-stock/route.ts:59-60 删单回补。取消/删单两侧对称，不会额外制造假缺口。

【它给的修法是错的，不能照抄】
- shortfall: Math.max(0, -onHand)：route.ts:78 if (!Number.isFinite(onHand) || onHand < 0) return adminJson({ error: 'onHand 必须为非负数' }, 400); 校正后 onHand 恒 >= 0，于是每次盘点后所有食材 shortfall 一律 0 —— 哪怕本周已下的订单实际根本不够。等于把面板的前瞻价值整个废掉。
- matrix 的 bal = onHand + totalNeeded：把整段区间的需求全加回去，但校正的覆盖写早已抹掉「校正之前那批单」的扣减，这部分会被补第二次 → 库存虚高 → 少买 → 真断货。这个失败方向比多买严重得多（多买的易腐品还能自己吃，断货是直接砸单）。

**修正后的触发路径**

可复现，但只在「上次盘点校正之后又进了单」这个窗口内，且只有 admin 打开 Dashboard 库存 tab 才看得到：
1. POST /api/admin/ingredient-stock {action:'set', name:'五花肉', onHand:2000} → setIngredientStock 覆盖 onHand=2000（ingredientStock.ts:143 / route.ts:79）。
2. 之后建 10 张周五单、每份 200g → applyOrderMovement sign=-1 → onHand: FieldValue.increment(-2000) → onHand=0。
3. 面板选周五 → route.ts:93 where('deliveryDate','==','周五') 抓回同一批 10 张单 → needed=2000 → :113 shortfall = max(0, 2000-0) = 2000 → dashboard invBalanceHtml（:11535-11540）渲染成红字「缺 2kg」。冰箱实物仍是 2000g，正确答案是「刚好够，结余 0」。
4. matrix 同一时刻：:165 bal 从 0 起算，周五格 running = -2000 → 深红「缺2kg」且标成首个告罄日。
特征化：matrix 每一格恒定低估一个常数 = 上次校正之后新扣掉的总量（不分配送日）。
不可复现的情形：所有单都在最近一次校正之前下的（如 06:00 截单后才盘点，看当天那一行）→ 覆盖写已抹掉扣减 → 数字正确。

**修正后的改法**

不要用 finding 的写法。最小且不制造反向风险的做法是「记住上次盘点之后扣了多少」，读侧据此还原实物量：

1) src/lib/ingredientStock.ts applyOrderMovement 的 batch.update（现 :247-250）多写一个累计字段：
   batch.update(refs[i], {
     onHand: FieldValue.increment(delta),
     sinceCount: FieldValue.increment(-delta),   // consume delta<0 → +qty；release → -qty
     updatedAt: FieldValue.serverTimestamp(),
   });

2) src/lib/ingredientStock.ts setIngredientStock 的 payload（现 :143）加一行归零：
   const payload: Record<string, unknown> = { name, onHand, sinceCount: 0, updatedAt: FieldValue.serverTimestamp() };

3) getAllIngredientStock（:54-60）把 sinceCount 读出来（Number(x.sinceCount) || 0）。

4) src/app/api/admin/ingredient-stock/route.ts list 分支（:103-117）：
   const onHand = s?.onHand ?? 0;
   const physical = onHand + (s?.sinceCount ?? 0);   // 还原成冰箱里的实物量
   ... onHand: physical, freeOnHand: onHand,
   shortfall: Math.max(0, need - physical),
   low: s?.threshold != null && physical <= s.threshold,

5) matrix 分支 :165 起点同改：let bal = onHand + (s?.sinceCount ?? 0), runoutIndex = -1;

会不会误伤现有正常流程：
- 不会误伤下单/付款/备餐任何一条链路 —— 只动 admin 读侧显示 + 一个新字段的累加，consume/release 仍是 best-effort 吞错（ingredientStock.ts:259-262 的 catch 原样保留）。
- 老文档没有 sinceCount → 默认 0 → 行为与今天完全一致，零回归；老板下一次点「校正=」之后该食材才转为精确值，属于渐进迁移。
- 唯一残余偏差：已经做出来吃掉的单，其 sinceCount 要等下一次盘点才清零，期间实物量会略微虚高。上界 = 盘点间隔，且方向与今天相反、幅度更小；面板本来就是 advisory。若要更严，可在 list/matrix 里只把 deliveryDate >= 今天 的部分加回，但那要给 ledger join 订单，性价比不值。
- 备餐单、n8n daily-prep、dishStock 硬限量全部不碰（它们不读 ingredientStock）。

配套（按项目规矩，public 那份是派生拷贝会被覆盖）：先改 Desktop\Incredibowl Services\incredibowl-dashboard.html 的 :11667「结余 = 现有 − 当日所需」和 :11780 matrix 说明，讲清「现有＝已还原的实物量」，再跑 npm run sync:dashboard 回灌 public/dashboard-h7x2q9.html。

**影响面**：零金钱、零顾客、零订单影响 —— 面板 admin-only（verifyAdminEmail 403 门），且缺货只提醒不阻挡（ingredientStock.ts:16-17）。真实影响面只有老板一个人的采购判断：在「上次盘点之后又进了单」的窗口里，红字会虚报缺口，最坏是照红字多买一批易腐食材。误差上界 = 上次校正到现在新扣的量（若真按面板写的每日盘点走，约等于一天的进单量，不是一整天全部用量）。次生风险是老板发现数字对不上就不再信这个面板，Layer B 白做。

**工作量**：约 15 行、跨 2 个源文件（ingredientStock.ts 3 处 + ingredient-stock/route.ts 2 处）+ Dashboard 两处文案再跑 sync:dashboard。半小时以内，不需要独立一轮。

---

## [PARTIAL] P3 — cart-delivery-info-drops-partialmatch-warning

**结论**：「新内嵌表单没有 partialMatch 提示」属实，但它是一条告知性提示、不是守卫 —— 老宿主里它也不拦保存、不改运费，所以「运费和坐标一起错」不是这条缺失造成的；而且只有访客/内嵌路径丢了它，走 AuthModal 的登录顾客照旧能看到。

**判决依据**

evidence 逐字真实：src/components/cart/CartDeliveryInfo.tsx:205-212 结果块只渲染 `{t.tierLine(tierLabel(tier), result.distanceKm)}` 和 `{tierFeeHint(tier, result.distanceKm)}`，整份 225 行文件 grep `partialMatch` 零命中。
上游确实产出该字段：src/app/api/geocode/route.ts:227 `partialMatch: !!top.partial_match,`；src/lib/deliveryProfile.ts:22 `partialMatch?: boolean;`。
老宿主确实有提示：src/components/auth/AuthProfileView.tsx:377 `{geocodeResult.partialMatch && tier !== 'free' && (` → :379 `{t.partialMatchNote(geocodeResult.distanceKm)}`；src/app/member/MemberView.tsx:879 `{geocodeResult.partialMatch && tier !== 'free' && (` → :881 `{t.partialMatchWarning(geocodeResult.distanceKm)}`。
文案也确实只在 auth/member 两份字典里：src/components/auth/dict.ts:217/322、src/app/member/dict.ts:181/263；`grep -n partialMatch src/components/cart/dict.ts` 零命中 → 补这条要新加 dict key（finding 这点说对了）。
但有两条实质性反证，所以只能给 PARTIAL：
① 它不是「守卫」。AuthProfileView.tsx:377 和 MemberView.tsx:879 都只是多渲染一个 `<p>`，既不 disable 保存按钮也不改 tier —— 老路径下 Google 模糊匹配到别处，运费和坐标一样是错的，区别只是有没有告诉顾客。所以 finding 的 impact「运费按错的距离收 + 订单存错坐标」是 partial_match 本身的性质，不是这次改版新造成的。
② 不是所有新客都丢了这条提示。src/components/auth/AuthModal.tsx:218 仍渲染 `<AuthProfileView`，而 CartDrawer.tsx:600 `if (!currentUser) { onAuthOpen(); return; }` —— 没登录直接点结账的顾客还是被送进 AuthModal → AuthProfileView（有提示）。真正丢失的只有「点访客快速下单 → CartDeliveryInfo 内嵌表单」这一条路径（CartDrawer.tsx:68-82 handleGuestCheckout 只在异常时才 onAuthOpen）。
改版时间点核实：CartDeliveryInfo.tsx 只有一次提交 a6ec8c4（2026-08-02 00:31，新增 225 行），确为最近改动。

**修正后的触发路径**

1) 新访客点「访客快速下单」→ CartDrawer.tsx:68 handleGuestCheckout 静默建匿名号（成功路径不开 AuthModal）。
2) CartDrawer.tsx:307-308 `profileIncomplete` 为真 → L868 渲染 `<CartDeliveryInfo>`（此路径下是唯一填址入口）。
3) 顾客只打「Pearl Suria」这类不完整地址 → CartDeliveryInfo.tsx:110-118 拿到 geo（含 partialMatch:true）→ L205 绿色块只显示档位+距离，没有任何模糊匹配提醒。
4) L120-128 saveDeliveryProfile 照存。
⚠️ 与 finding 的差别：这一步「运费算错」并非本条缺陷引入 —— 走 AuthProfileView 保存同一个模糊地址，运费和坐标一样错，只是那边会多印一行小字。本条真正的损失 = 顾客失去了自查的机会。

**修正后的改法**

纯追加 UI，零行为改动：

src/components/cart/dict.ts —— interface 加 `partialMatchNote: (km: number) => string;`，zh/en 各加一条（建议逐字复用 auth/dict.ts:217/322 的现成文案，避免第三套口径）：
```ts
// zh
partialMatchNote: (km) => `⚠️ Google 没找到完全匹配，按 ${km}km 计算运费。请补上单位/门牌号再保存，或 WhatsApp 联系碗妈`,
// en
partialMatchNote: (km) => `⚠️ Google couldn't find an exact match — delivery fee is based on ${km}km. Add your unit/floor, or WhatsApp BowlMama`,
```

src/components/cart/CartDeliveryInfo.tsx:205-212 结果块内，在 tierFeeHint 那行之后追加：
```tsx
{result.partialMatch && tier !== 'free' && (
    <p className="mt-1.5 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-[10px] font-bold text-amber-800">
        {t.partialMatchNote(result.distanceKm)}
    </p>
)}
```
（`tier !== 'free'` 逐字沿用 AuthProfileView.tsx:377 的条件，保持三个宿主口径一致。）

误伤评估：无。只在 `result && tier` 已为真的分支里多渲染一个 `<p>`，不动 verifyAndSave、不动 saveDeliveryProfile、不动运费推导、不动订单 payload。tier==='free' 的老客户不会被新提示打扰。

**影响面**：只影响「访客快速下单 + 地址写得不完整 + Google 恰好回 partial_match」的交集人群，且只是少一行小字，本身不改一分钱。潜在最坏情况是顾客没发现地址匹配错 → 运费档位错（近 RM3/5 vs 中 RM12 vs 远 RM15-30，最大差 ~RM27）+ 配送批次按错坐标排线，但这个风险在老宿主同样存在，本条缺失只是少了自查窗口。属于「改版丢的告知」，不是新增漏洞。

**工作量**：约 15 分钟：dict 2 条 key + 6 行 JSX；跑 tsc 即可，无需回归结账链路

---

## [PARTIAL] P3 — owner-telegram-4096-silent-drop

**结论**：机制是真的——我实测 10 单一次结账的 Telegram 消息 4293 字符（UTF-16）确实越过 4096 被 Telegram 整条退回；但触发需要「一次结账把周一~周五午+晚全买齐」= 网页 UI 能给的绝对上限，而且邮件那条完全不受影响，所以不是 finding 说的「老板手机零响动」。

**判决依据**

evidence 逐字属实。src/lib/ownerNotify.ts:61 `    if (d.receiptUrl) lines.push(`📸 收据：${String(d.receiptUrl)}`);` —— 收据链接确实写在**每个订单块**里；src/app/api/submit-order/route.ts:500 `      if (receiptUrl) payload.receiptUrl = receiptUrl;` 把同一个 body.receiptUrl 原样复制进每个 payload，所以 N 个订单 = 同一条 URL 印 N 遍。ownerNotify.ts:109 `    const text = buildTelegramText(orders);` 之后 :112 单次 fetch，:117-119 `if (!res.ok) { const body = await res.text().catch(() => ''); console.warn(...` —— 只 warn，:110 `await Promise.allSettled(chatIds.map(...))` 吞掉，:181-188 notifyOwnerNewQrOrder 外层再吞一次，顾客侧照常成功。

我把 ownerNotify.ts:33-73 的 shortId/rm/timeLabel/orderLinesText/buildTelegramText 逐字复制成 node 脚本实测（收据 URL 按 src/lib/firebase.ts:10 `    storageBucket: "incredibowl-1eedd.firebasestorage.app",` + src/components/cart/CartDrawer.tsx:506 `ref(storage, `receipts/${currentUser.uid}/${Date.now()}_${safeName}`)` 拼真实格式，长度**正好 216 字符**，与 finding 声称的 216 完全吻合，不是编的）：
  1 单 = 485、5 单 = 2180、8 单 = 3447、9 单 = 3870~3996、**10 单 = 4293~4433（超）**、20 单 = 8518、50 单 = 21193（UTF-16 计，Telegram 就是按 UTF-16 code unit 算，emoji 每个占 2）。
  同样 10 单**去掉收据行**只有 2068 —— 证实「收据 URL 重复 N 遍」就是撑爆的主因（216×10 = 2160）。

我要更正 finding 的两点夸大：
(1) severity。9 单还在线内，必须**正好 10 组**才炸，而 10 组 = 5 个工作日 × 午/晚两档 = 网页菜单能给的上限（src/lib/dateUtils.ts:41 computeMenuDates 只按本周 5 个工作日发日期），不是常见单。
(2) 「老板手机零响动」不成立。ownerNotify.ts:184 `await Promise.allSettled([sendTelegram(orders), sendEmail(orders)]);` 两条腿独立，:140-149 的 HTML 邮件没有任何长度上限，Resend 照发，老板手机 Gmail 推送照响。真实退化是「Telegram 静音、只剩邮件」，不是全静默。

（我没有真的打 Telegram API 验证 400；4096 上限与超限整条拒收而非截断是 Bot API 的既有文档行为。）

**修正后的触发路径**

正常 UI 路径：顾客一次结账选满周一~周五、每天午+晚各一份 → src/app/api/submit-order/route.ts:340 `      const key = `${vb.selectedDate || '未定'}|${vb.selectedTime || 'Lunch'}`;` 分出 10 组 → :516 写 10 个 order doc → :611-613 `if (paymentMethod === 'qr') { ... await notifyOwnerNewQrOrder(orderIds.map((id, i) => ({ id, data: payloads[i] }))); }` → 4293 字符 → Telegram 400，只留 console.warn。9 组（3870~3996）在线内但只差 100 字符，地址长一点/多一个加料就一样炸。

直接打 API 还能更狠：src/lib/cartDateUtils.ts:62-83 isOrderDateValid **只挡过去/周末/停业日，没有未来日期上限**，配合 route.ts:65 `if (cartBundles.length > 50)` 的 50 上限，可以造 50 组 = 21193 字符。但这条对攻击者价值有限——邮件仍然会到。

**修正后的改法**

两处一起改，只动 src/lib/ownerNotify.ts：
(1) orderLinesText 里删掉第 61 行的 receiptUrl push，改成在 buildTelegramText 尾部去重后印一次。**安全**：submit-order route.ts:500 证明多组订单的 receiptUrl 是同一个 body 字段复制出来的，去重不会丢信息。
```ts
function buildTelegramText(orders: NotifyOrder[]): string {
    const sep = '━━━━━━━━━━━━━━━━━━━━';
    const head = orders.length > 1 ? `🔔 新 QR 订单待核对收款（${orders.length} 单）` : '🔔 新 QR 订单待核对收款';
    const blocks = orders.map(o => orderLinesText(o).join('\n'));
    const urls = [...new Set(orders.map(o => String(o.data.receiptUrl || '')).filter(Boolean))];
    return [head, sep, blocks.join(`\n${sep}\n`), sep,
        ...urls.map(u => `📸 收据：${u}`),
        '⚠️ 请核对收款后到 Dashboard 确认此单'].join('\n');
}
```
(2) sendTelegram 里按行分片（阈值用 3800 留余量），逐片顺序发，每片失败照旧只 warn 不抛。

误伤评估：
- 1~3 单的日常提醒实测 485~1335 字符，分片逻辑走 `if (text.length <= TG_LIMIT) return [text]` 直接原样返回，**格式一个字不变**。
- 唯一可见变化是收据链接从「每单一条」变成「消息末尾一条」；老板核对多单时点同一个链接，体验不降。
- 分片后单条消息会拆成多条推送，属预期。
- 长度判断要用 `text.length`（UTF-16）不要用 `[...text].length`（code point），后者会低估 ~1.5%。finding 给的 fix 用了 `[...text].length`，在 3800 阈值下余量够，但仍建议改成 `text.length`。

**影响面**：仅影响提醒渠道，订单/金额/库存/餐券全部不受影响，邮件通道照常送达。只有「一次结账 ≥10 个配送组的 QR 单」会退化成邮件-only，这是网页 UI 的上限场景（整周午+晚全包）。我没有查线上历史数据确认这种单是否真的发生过。

**工作量**：约 20~25 行，单文件（src/lib/ownerNotify.ts），半小时含自测。

---

## [PARTIAL] P3 — tx-callback-mutates-outer-state

**结论**：代码写法确实是那个经典坑，SDK 源码可证事务重试会重跑整个回调；但生产库 252 笔用餐券的订单里重复 id 0 笔、长度不符 0 笔 —— 至今一次都没发生过，P2 定高了，属于该修的隐患而不是在流血的伤口。

**判决依据**

evidence 逐字真实。src/lib/mealVoucherUtils.ts:267-270 `const claimedIds: string[] = [];` / `let allocatedTotal = 0;` / 空行 / `await db.runTransaction(async (tx) => {`，回调内 :291 `allocatedTotal += allocatedRM;`、:298 `claimedIds.push(r.id);` 确实往回调外的变量塞。src/lib/addonCreditUtils.ts:227-228 `let recognized = 0;` / `const linesByAddon = new Map<string, ClaimedAddonLine>();` 同样在外，:258 `recognized += p.take * p.unitAllocatedRM;`、:260 `if (line) line.count += p.take;` 同样在内 —— 两处指控都属实。

【机制成立，有 SDK 源码为证】node_modules/@google-cloud/firestore/build/src/transaction.js:397 `for (let attempt = 0; attempt < this._maxAttempts; ++attempt) {` → :410 `this._writeBatch._reset();` → :412 `return await this.runTransactionOnce(updateFunction);`，而 :436 `const promise = updateFunction(this);`。`_reset()` 只清 SDK 自己的写批次，**清不了调用方闭包里的数组**。index.js:923-924 官方注释逐字：「the transaction is retried up to five times. The `updateFunction` is invoked once for each attempt.」触发码见 transaction.js:585-594（ABORTED / UNAVAILABLE / DEADLINE_EXCEEDED / INTERNAL 等）。本仓库自己也踩过并写了警告：src/lib/orderRollback.ts:94-99「⚠️ 必须每次重试都重置。Firestore 事务遇到写冲突会**重跑整个回调**…实测：3 个并发取消全部「获胜」，dishStock 被 +3 而不是 +1 = 超卖。」所以这类坑在本项目是真咬过人的。

【但触发面比报告说的窄得多】回调开头 :276-286 有一道校验：重试时若 doc 已被别人改成非 'available' 就 `throw new Error('餐券抢占失败…')`（:280），而普通 Error 没有 `.code`，transaction.js:583 `if (error.code !== undefined)` 直接返回 false → 不再重试、整单失败。所以「另一个 claim 抢走券」这条最常见的并发路**只会报错不会翻倍**。真正能翻倍的只剩两种：① 有人碰了同一批 doc 但没改 status（releaseMealVouchers 回补 / 人工脚本触碰 updatedAt）；② commit 时撞上瞬时 UNAVAILABLE/DEADLINE_EXCEEDED 且本次确实没落库。都属低概率。

【生产实证：0 命中】只读扫全量 orders：带 `claimedMealVoucherIds` 的订单 **252 笔**，其中 id 有重复的 **0 笔**、`claimedMealVoucherIds.length !== mealVouchersUsed` 的 **0 笔**；带 `addonCreditsUsed` 的订单 57 笔。这两个字段在 submit-order/route.ts:564-569 写一次之后不再改写，所以 0 命中就是「从未发生」，不是「发生了又被抹平」。

【报告的影响有一处说反】它称「mealVouchersUsed 与实际扣券数对不上」。实际上 src/app/api/submit-order/route.ts:565 写的是 `mealVouchersUsed,`（来自 :56 `const mealVouchersUsed = Math.max(0, Math.floor(Number(rawMealVouchersUsed) || 0));`，请求侧的数），admin/manual-voucher-redemption/route.ts:162 `update.mealVouchersUsed = count;` 同理 —— 这个字段不会跟着翻倍，翻倍的只有 `claimedMealVoucherIds`（多出重复 id）和 `mealVoucherAllocatedRevenue`（:567）。

【营收影响方向是对的】`mealVoucherAllocatedRevenue` 确实是 MFRS 15 权责营收的输入：src/app/admin/page.tsx:538 `const orderMfrs15Revenue = (o: any) => Number(o.total ?? 0) + Number(o.deliveryFee ?? 0) + Number(o.mealVoucherAllocatedRevenue ?? 0) + Number(o.addonCreditsAllocatedRevenue ?? 0);`，以及 n8n/daily-recap/route.ts:187-188 同款求和。真翻倍了报表会虚高。

【报告对 credit 兜底说得偏乐观】addonCreditUtils.ts:339 `const give = Math.min(plan[i].give, Math.max(0, total - rem));` 只按**单个批次**的 quantityTotal 封顶。若同 addonId 下别的批次还有 headroom（来自更早的订单），翻倍的 count 会被塞进那些批次 → 仍可能凭空多还出 credit。不改变结论，只是把「不至于凭空造 credit」这句纠正掉。

**修正后的触发路径**

claimMealVouchers / claimAddonCredits 的 runTransaction 因 ABORTED（有并发写者碰了同一批 doc 但**没改 status**，例如取消单触发的 releaseMealVouchers、人工脚本 touch updatedAt）或瞬时 UNAVAILABLE/DEADLINE_EXCEEDED 而重试 → transaction.js:412 再次调用 updateFunction → 回调内 :291/:298（及 addonCreditUtils :258/:260）在上一轮残留值上继续累加 → claimedIds 变 2N 个含重复、allocatedTotal / recognized 变 2 倍、linesByAddon 的 count 变 2 倍。注意：若并发者把 status 改成了 'redeemed'，:280 会抛普通 Error，SDK 判为不可重试直接失败 —— 那条路不会翻倍。截至今天生产 252 笔餐券单 + 57 笔 credit 单里 0 次命中。

**修正后的改法**

把累加变量搬进回调、结果从回调 return 出来。两处都改，各约 10 行位移，happy path 行为完全不变。

src/lib/mealVoucherUtils.ts（替换 :267-302）：
```ts
  // ⚠️ 累加变量必须声明在回调**内部**。Firestore 事务遇冲突/瞬时错误会重跑
  //    整个回调（@google-cloud/firestore transaction.js:397-412），写在外面
  //    上一轮 push 进去的 id 还在，会累成两倍。同 orderRollback.ts:94-99 的坑。
  const result = await db.runTransaction(async (tx) => {
    const claimedIds: string[] = [];
    let allocatedTotal = 0;
    const refs = targets.map(t => db.collection('mealVouchers').doc(t.id));
    const fresh = await Promise.all(refs.map(r => tx.get(r)));
    for (let i = 0; i < fresh.length; i++) { /* …:276-286 原有校验一字不动… */ }
    for (let i = 0; i < refs.length; i++) {
      const r = refs[i];
      const v = fresh[i].data() || {};
      const allocatedRM = typeof v.allocatedValueRM === 'number' ? v.allocatedValueRM : FACE_VALUE_RM;
      allocatedTotal += allocatedRM;
      tx.update(r, {
        status: 'redeemed',
        redeemedOrderId: orderId,
        redeemedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      claimedIds.push(r.id);
    }
    return { ids: claimedIds, allocatedTotalRM: Number(allocatedTotal.toFixed(2)) };
  });
  return result;
```

src/lib/addonCreditUtils.ts（:227-268）照抄同样处理：把 `recognized` 和 `linesByAddon` 挪进 :230 的回调，末尾 `return { recognizedRevenueRM: Number(recognized.toFixed(2)), lines: [...linesByAddon.values()] };`，函数体最后直接 `return result;`。

误伤评估：零误伤。返回值结构、字段名、四舍五入口径、校验顺序、抛错文案全部不变；调用方 submit-order/route.ts:544/563、admin/manual-voucher-redemption/route.ts:150/154、admin/subscriptions/week/route.ts:344/346 都只读 `.ids/.allocatedTotalRM/.lines/.recognizedRevenueRM`，一行都不用动。唯一的行为差别就是重试时从零重算 —— 那正是我们要的。

验证：现成的 dogfood 脚本跑一遍餐券 + 预付 credit 下单链路即可（结果字段应与改前逐字一致）。

**影响面**：目前为止 **0**：生产 252 笔用餐券的订单、57 笔用预付 credit 的订单，无一出现重复 id 或长度不符。属于纯隐患。真发生的话影响面是单笔订单的 `mealVoucherAllocatedRevenue` / `addonCreditsAllocatedRevenue` 翻倍（约 RM 10–40 量级）污染 admin MFRS 15 权责营收卡和 n8n 日报，外加取消时可能多退几个加料 credit；不影响顾客付款、不影响券的实际扣减张数（只有 N 张 doc 被真正翻成 redeemed）。

**工作量**：20 分钟：两个文件各搬 ~10 行进闭包 + 各加一句注释，tsc 过一遍，跑现成的餐券/credit dogfood 对比返回值。可以和别的小修一起 commit，不值得单开一轮。

---

## [PARTIAL] P3 — n8n-key-in-query-and-nonconstant-compare

**结论**：代码事实全对（就是上一条的同一个问题、覆盖 4 个端点），但三处论证被夸大：timing attack 不可利用、「n8n 执行历史里已躺着一份 key」无证据、release-stale-fpx 不是「所有 pending FPX 单」。修一次即两条一起消。

**判决依据**

代码部分逐字属实，与 n8n-key-in-query-string 是同一处缺陷的超集，四个位置我都亲自 Read 过：daily-prep:412-418、daily-recap:140-146、menu:79-84、release-stale-fpx:32-38（`function authorized(req: NextRequest): boolean { const expected = process.env.N8N_API_KEY; if (!expected) return false; const header = req.headers.get('Authorization'); if (header === \`Bearer ${expected}\`) return true; return new URL(req.url).searchParams.get('key') === expected; }`）；已硬化的两个也属实（customer:56-67、wa-order:118-130 都有 `if (gotBuf.length !== expBuf.length || !timingSafeEqual(gotBuf, expBuf))`）。scripts/dogfood-web-addon-credits.mjs:271 逐字属实。
夸大/不成立的部分（这是判 PARTIAL 的理由）：
① 「非常数时间比较」在 title 里被并列成缺陷，但对一个随机静态密钥、经 HTTPS + Vercel 边缘、每次比较差异在纳秒级的远程 `!==`，实际不可利用。真正的问题只有 ?key= 进日志这一半。
② 「n8n 执行历史（HTTP 节点把完整 URL 存进 execution data）里就有一份」——仓库提交的 4 个 workflow JSON URL 里都没有 ?key=（n8n/daily-prep-bowlmama.workflow.json:26 等），且:51 notes 明写 `Uses Header Auth credential`，所以这条泄露路径拿不出证据，属推测。
③ 「一个 GET 就能把所有 pending FPX 单批量取消」不准确：release-stale-fpx/route.ts:44-45 `const hours = Number.isFinite(hoursParam) && hoursParam >= 0.5 ? hoursParam : 1;` + :67 `if (!createdMs || createdMs > cutoffMs) continue;`，只动创建满 cutoff（最少 0.5 小时）的单；而且走的是 :70 `cancelOrderWithRollback`，会同时回补 dishStock/食材/餐券/加料 credit，是「带回滚的取消」不是纯破坏。
④ 「GET /api/n8n/customer?phone=… 能拉任意号码档案」列在泄露后果里，但 customer/route.ts:56-67 恰恰是已经硬化的那个，压根不收 ?key=——自相矛盾。

**修正后的触发路径**

与 n8n-key-in-query-string 完全同一条路径（?key= 进日志）。差别只在覆盖范围：daily-prep / daily-recap / menu / release-stale-fpx 四个端点。menu 只返回公开菜单不含 PII，release-stale-fpx 是唯一的写接口。密钥不在客户端 bundle、无 NEXT_PUBLIC_ 前缀，这点我复核过成立。

**修正后的改法**

NONE（与 n8n-key-in-query-string 同一处修复，按那条的 src/lib/n8nAuth.ts 方案一次改 4 个路由即可，别开两个工单）。只补两点：一是 title 里的 timingSafeEqual 顺手带上就行，别当独立理由排期；二是「顺手轮换 N8N_API_KEY」这条建议缺乏泄露证据支撑，轮换要同步改 Vercel env + n8n 凭据 + 本机脚本，收益不明确、误伤面不小，建议只在确实发现日志里出现过 ?key= 时再做。

**影响面**：同上一条：仅理论，需先泄密钥。真的泄了：daily-prep 全天顾客姓名+住址；release-stale-fpx 可提前取消超时 pending FPX 单（会回补库存和餐券，顾客侧表现为「单没了但券退回来了」）；menu 无损失。

**工作量**：0（并入 n8n-key-in-query-string 一起修）

---

## [PARTIAL] P3 — edit-order-release-consume-not-atomic

**结论**：代码和静默 catch 都是真的，但只有「第一次调用已成功、第二次在几十毫秒内偏偏失败」这一瞬时网络窗口才会中招，而且只有老板能触发、损坏的是可在库存页手改的盘点数字——不涉及钱，不涉及顾客路径。

**判决依据**

evidence 逐字属实，两个副本同步且行号一致。

public/dashboard-h7x2q9.html:13305-13314（Desktop 源头 incredibowl-dashboard.html 同样在 13309/13311/13313，grep 已确认）：
```
if (origCreatedMs >= new Date('2026-06-29T00:00:00+08:00').getTime()
    && stockShape(orig && orig.items) !== stockShape(items)) {
    try {
        if (orig && Array.isArray(orig.items) && orig.items.length) {
            await callAdminAPI('/api/admin/consume-stock', { items: orig.items, release: true, orderId: editingOrderId });
        }
        await callAdminAPI('/api/admin/consume-stock', { items, orderId: editingOrderId });
        toast('库存已按改单同步（回补旧菜 → 扣新菜）', 'success');
    } catch (stockErr) { console.warn('[edit-order] stock sync skipped:', stockErr && stockErr.message); }
}
```
确实是两次独立 HTTP、无事务、无补偿、catch 只 console.warn。

三个「真」都成立：
1. 回补确实已落库：src/lib/stockUtils.ts:117-119 `const snap = await ref.get(); if (!snap.exists) continue; await ref.update({ remaining: FieldValue.increment(qty), ... })`；src/lib/ingredientStock.ts:247-250 `batch.update(refs[i], { onHand: FieldValue.increment(delta), ... })`（release 时 sign=+1，ingredientStock.ts:214）。
2. 老板确实看不见：catch 后代码继续走到 13315 `toast(\`订单已更新：${name}\`, 'success')`，弹的是绿色成功提示；唯一信号是 13312 那条库存 toast 没弹（负向信号，等于没有）。
3. 确实不自愈：13297 `if (idx >= 0) state.orders[idx] = { ...state.orders[idx], ...updateFields, id: editingOrderId };` 已把 items 换成新值，下次再编辑 orig.items 就是新 items。仓库里也没有任何库存对账/自愈脚本（scripts/ 只有 seed-ingredient-stock.mjs / set-dish-stock.mjs 这类手动播种设值工具）。

判 PARTIAL 而不是 CONFIRMED，因为触发条件被夸大了：
- trigger 里写的「冷启动超时」站不住脚。第二次调用打的是同一个 endpoint、同一条已建立的连接、同一个刚刚被第一次调用唤醒的 serverless 实例，冷启动只会打在**第一次**上——而第一次失败会直接跳 catch，第二次根本不执行，此时库存状态 = 什么都没做，零损伤。
- 不存在任何确定性失败路径让「第一次成功、第二次失败」。核对 src/app/api/admin/consume-stock/route.ts：consume 分支里 decrementDishStockLenient 逐菜 try/catch 吞错（stockUtils.ts:104-106），consumeIngredientStock 整个包在 try/catch 里 `// Advisory layer — log and move on; ordering must never fail on this.`（ingredientStock.ts:259-262）永不抛；能让路由回 4xx/5xx 的只有 verifyAdmin(route.ts:28)、items 为空(route.ts:39)、getAdminDb() 抛(route.ts:42) —— 这三个在第一次调用里同样会触发，不可能只挂第二次。所以剩下的只有纯瞬时传输故障（断网/关笔电/响应丢包）。
- impact 里「网页放行超卖」有前提：stockUtils.ts:117-118 `if (!snap.exists) continue;` —— 只有当时确实建了 dishStock 文档的限量菜才会被虚高，不限量的菜回补是 no-op。食材层虚高是真的（36 个已播种原料基本都有文档），但 ingredientStock 按设计就是 advisory 只提醒不阻挡，坏的是盘点差额不是收单。

**修正后的触发路径**

老板在 Dashboard 编辑一张 2026-06-29 之后创建的手动单，并且改动了菜品/数量/加料的形状（改地址、改时间、改电话不触发，13303 的 stockShape 已过滤）→ 第一次 release 调用成功返回 → 在发出第二次 consume 请求到拿到响应的这几十毫秒里网络中断/关闭页面/响应丢失 → 第一次的回补已落库，新单一份没扣。老板看到的是绿色「订单已更新」，只有那条「库存已按改单同步」的 toast 悄悄没弹。不存在确定性触发路径，纯瞬时故障。

**修正后的改法**

分两步，都不会误伤现有流程。

① 立刻做（1 行，零风险）——让失败看得见。改 Desktop\Incredibowl Services\incredibowl-dashboard.html:13313，改完 `npm run sync:dashboard` 回灌 public（直接改 public 会被覆盖）：
```js
} catch (stockErr) {
    console.warn('[edit-order] stock sync skipped:', stockErr && stockErr.message);
    toast('⚠️ 订单已改，但库存同步失败（旧菜可能已回补、新菜没扣）：'
        + (stockErr && stockErr.message) + ' — 请到「库存」页手动核对', 'error');
}
```
只在 catch 里加，happy path 一个字都不变，不可能误报。顺带把同文件 13393 行新单的 `catch (stockErr) { console.warn('[manual-order] stock decrement skipped:', ...) }` 也补上同样的 toast —— 那条也是静默的，失败方向一样是库存虚高。

② 根治（约半小时）——把两次 HTTP 合成一次。给 src/app/api/admin/consume-stock/route.ts 加一个可选字段 `swapFrom`：`const swapFrom = Array.isArray(body?.swapFrom) ? body.swapFrom : null;`，在 consume 分支前先跑 releaseDishStock/releaseIngredientStock(swapFrom)，同一个请求内接着 consume(items)。客户端 13307-13313 塌成一次 `callAdminAPI('/api/admin/consume-stock', { items, swapFrom: orig.items, orderId: editingOrderId })`。这是向后兼容的新增字段，删单路径（11384 行 release:true）和新单路径（13392 行）完全不受影响。

⚠️ 不要采纳原 finding 里写的「客户端补偿：失败后再 consume(orig.items) 扣回去」。两个坑：(a) 真实故障多半是「服务端已经处理完、只是响应丢了」，这时补偿会变成实打实的双倍扣减，把库存虚高换成库存虚低直接卡住网页收单，比原问题更伤；(b) decrementDishStockLenient 用 `Math.max(0, remaining - qty)`（stockUtils.ts:100）会在 0 处截断，而 release 是无截断 increment，一来一回本身就不等价。

**影响面**：仅老板一人可触发（route.ts:28 verifyAdmin 挡死，顾客侧无此入口），且需改单+改动菜品形状+恰好卡进瞬时网络窗口。真命中一次的损失：该单食材 onHand 虚高一份的量（advisory 层，库存页盘点面板可手改）；只有当涉及的菜当时确实建了 dishStock 文档时，remaining 才会虚高 → 网页最多多放行那几份。不涉及任何金额、不影响已收的钱、不影响顾客下单链路。目前无线上事故证据，属「只理论上会发生的瞬时故障」。

**工作量**：① 加错误 toast：源头 2 行 + npm run sync:dashboard，5 分钟。② 服务端 swapFrom 合并成单次调用：路由约 10 行 + 客户端 1 处，约半小时。可以并到下一轮 dashboard 改动里顺手做，不值得单开一轮。

---

