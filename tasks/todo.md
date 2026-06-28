# Incredibowl 安全修复 + Bug + 优化 — 总计划

> 状态：待审批。生产环境有真实客户/营收，支付链改动属高风险，每阶段改完按「push 前必须先验证」规则本地 tsc + dogfood 再 commit。

## 阶段 0 — 前置确认（需老板参与，阻塞阶段 2）
- [ ] 登录 Firebase Console → Firestore → 规则，把当前**线上规则原文**贴给我。
      原因：我无法读取线上规则。若现状是 test-mode `allow read, write: if true`，则全部客户姓名/电话/地址正在裸奔；若已有规则，我要按现状增量收紧，避免改坏客户端直读。

## 阶段 1 — 支付与订单完整性（🔴 最高危，核心修复）
统一闭合「免费下单 / 盗刷别人餐券 / RM1 付 RM50」三个洞，照搬 meal-vouchers 已验证的正确写法。

- [ ] **submit-order 加鉴权**（src/app/api/submit-order/route.ts）
      - 加 `verifyAuth`（复制 admin/data 的 helper），无 token → 401
      - 强制 `userId = decoded.uid`，**忽略** body 里的 userId
      - 客户端 CartDrawer.tsx:335 的 fetch 加 `Authorization: Bearer <token>`
- [ ] **create-order 改为服务端权威金额 + 绑定订单**（src/app/api/payment/create-order/route.ts）
      - 加 `verifyAuth`
      - 入参从 `{amount}` 改为 `{orderIds}`；服务端读这些订单，校验 `userId===uid` 且 `status==='pending'`，**用订单 doc 里的权威 `total+deliveryFee` 求和**当作 Razorpay 金额（不再信任客户端 amount）
      - 把生成的 `razorpayOrderId` 写回每个订单 doc（像 meal-voucher purchase 那样绑定）
      - 客户端 `initiateRazorpayPayment` 改签名，传 orderIds + token（FPX 流里 submit-order 已先返回 orderIds，可直接用）
- [ ] **confirm-order 加鉴权 + 签名校验矩阵**（src/app/api/confirm-order/route.ts）
      解析可选 token，算出 isAdmin；逐订单按 transition 判定：
      - → **confirmed**：
        - 有 paymentData 且「HMAC 验签通过 **且** `paymentData.razorpayOrderId === orderData.razorpayOrderId`」→ 放行（FPX，签名即授权，重定向流不依赖 token）
        - 否则 isAdmin → 放行（QR 收据确认）
        - 否则「餐券全额覆盖单：`total===0 && paymentMethod==='voucher'` 且 owner token 匹配」→ 放行
        - 否则 403
      - → **cancelled**：isAdmin / owner-token / 或订单仍为 `pending`（未付临时单，低风险）→ 放行
      - → **preparing / delivered**：仅 admin
      - 客户端给所有 confirm-order 调用点带 token（能拿到 currentUser 的：CartDrawer 4 处、admin 1 处）；page.tsx / en/page.tsx 重定向流的 confirm 走签名授权不需 token、cancel 走 pending 放行
- [ ] tsc 通过 + 本地 dogfood：跑通 FPX 付款、QR 收据、餐券全覆盖、取消回滚四条流 → 再 commit

## 阶段 2 — Firestore 规则（🔴，依赖阶段 0）
- [ ] 按阶段 0 拿到的现状，写 `firestore.rules`（提交进仓库）：
      - `users`/`orders`：仅文档 owner + admin 自定义声明可读；客户端禁写 `vouchers`/`mealVouchers`（强制走已有 admin API）
      - `feedbacks`：按现有展示需求定读写
- [ ] 若 admin 页仍有客户端直读 `vouchers`，同步挪到 `/api/admin/*`（与阶段 6-P3 合并），否则收紧规则会打断 admin
- [ ] ⚠️ 我只能写文件，**部署由老板执行** `firebase deploy --only firestore:rules`（或我指导）；部署前用 Rules Playground 验证客户/admin 两种身份读写

## 阶段 3 — 依赖漏洞（🟠）
- [ ] `next` 16.1.6 → 最新 16.1.x patch（请求走私 / SSRF / DoS / Server Actions CSRF）
- [ ] `npm audit fix`；firebase-admin / razorpay 的传递依赖（protobufjs/axios/node-forge）等上游 patch 时 bump
- [ ] `npm run build` 验证升级不破坏

## 阶段 4 — 业务逻辑 Bug（🟡）
- [ ] **B1** nextSpecial.ts:65-71 — 加 `diff>2` 分支显示明确日期（现在周末误显「今日特餐」）
- [ ] **B2** cartStore.ts:29-38 — 修死代码 filter（按 CartItemCard UI 定：减到 0 删除 or 夹在 1）
- [ ] **B3** submit-order:406 — `serverTotal` 补减 `serverMealVoucherDiscount`（修 CAPI 上报虚高，不影响扣款）
- [ ] **B4** mealVoucherUtils.ts:232 — expired 分支补 `FieldValue.delete()` 清 stale `redeemedOrderId`（清洁性）

## 阶段 5 — 仓库卫生（🟡）
- [ ] `git rm --cached` 商业敏感草稿：prices.json、prospect.md、costing_*.txt、*trace*.txt、.temp_log*.txt、extract_*.js、run_opt.js、script.js、.claude/settings*.json
- [ ] 把它们加进 .gitignore（prices.json 是真有竞争价值的成本表）

## 阶段 6 — 性能优化（⚡，体量大，建议单独排期，可选）
- [ ] P1 dashboard-h7x2q9.html(595KB) 确认 Vercel brotli + 拆内联 JS/CSS
- [ ] P2 admin 页（1861 行单 client）服务端分页 + 按 tab 懒加载拆分
- [ ] P3 admin 直读 Firestore → 走 /api/admin/*（与阶段 2 协同）
- [ ] P4 确保 firestore/storage SDK 不进落地页 chunk
- [ ] P5 菜品/Hero 图全走 next/image（呼应 NO_LCP 记忆）

## Review（执行后回填）
（完成后在此记录每阶段实际改动与验证结果）

---

# 2026-06-20 · 预付加料（Prepaid Add-on Credits）— 已完成

**需求**：客户一次付清「20 餐券 + 19 煎蛋 + 1 三文鱼升级 − RM5 = RM396.50」，旧系统加料只能兑餐收现金。
计划文件：`.claude/plans/majestic-discovering-gadget.md`。

**改动**：
- `src/data/addOnsConfig.ts`：加 `salmon-upgrade`(RM4) + 导出 `PREPAID_ADDON_OPTIONS` 白名单。
- `src/lib/addonCreditUtils.ts`（新）：`mintAddonCredits`/`getAvailableAddonCredits`/`claimAddonCredits`，集合 `mealVoucherAddonCredits`（批次文档 + FIFO 递减）。
- `manual-voucher-purchase`：收 `prepaidAddOns`，记 `addOnAmountPaid`/`totalAmountPaid`，铸预付券，totalSpent 加总额。
- `manual-voucher-redemption`：收 `addonCreditsUsed`，扣券 + 订单加 `↳ X（预付）` RM0 行 + `addonCreditsAllocatedRevenue`。
- `admin/data`：加 `addonCreditStats` 负债 KPI。
- dashboard：卖券 modal 预付加料区 + 总额预览；录单 modal 预付抵扣区（按客户余额）；新增「预付加料负债」KPI 卡。
  - 改 Desktop 源 → `npm run sync:dashboard` 回灌仓库（见 lessons 2026-06-20）。财务版无餐券逻辑、不动。

**验证**：
- `tsc --noEmit` 全绿；`eslint` 0 error（仅既有 any 警告）。
- dashboard 内联 JS `node --check` 解析通过。
- **真实 Firestore 跑真实 helper：14/14 通过**（铸券/幂等/FIFO 扣减/收入确认 2.50&4.00/余额不足报错/用尽状态/清理零残留）。
- ⏳ 待办：dashboard UI dogfood（需 admin 登录态）；commit + push（按惯例 push 前再确认）。

**范围外**：顾客端 app（CartDrawer/submit-order）未碰——该客户订单全由 admin 手动录。

---

# 库存系统（Stock Count）— 计划（待批准开工）

> 决策（2026-06-28 老板拍板）：**两层都做 + 一次做完 + 食材层下单自动扣 + 只提醒不阻挡**。
> 语言/UI 简体中文；最小改动、根因优先；改完按「push 前先验证」规则。

## 架构总览：两层独立互补，不强行合并
- **Layer A 按菜可售份数**（扩展现有 `dishStock`）= 顾客端**硬闸**，防超卖。
- **Layer B 食材原料库存**（新 `ingredientStock`）= 后厨**采购可见性**，下单自动扣但**永不阻挡**，靠定期盘点校正漂移。
- 复用点：Layer B「所需量」直接来自已上线的备餐聚合（src/lib/prepIngredients.ts + dishIngredients.ts 配方），不重造。

## 数据模型
- `dishStock/{dishId}`（已存在）：`{ remaining, dishName, updatedAt }`，无文档=不限量。
- `ingredientStock/{name}`（新）：`{ onHand:number, unit:string, threshold?:number, updatedAt }`。
      - doc id = 食材中文名（配方里的 `line.name`，与备餐聚合同源，保证 key 对齐）。
      - 36 种原料初始播种（单位取配方里的 unit）。单位含 g/只/颗/块/盒/ml/份/汤匙。
      - ⚠️ 模糊单位原料（`时蔬`/`sambal`/`份`）照样建文档，但盘点时老板自行决定是否维护；不强算。

## Layer A — 按菜可售份数（增量）
- [ ] 新 admin API `POST /api/admin/dish-stock`（鉴权+CORS 照搬 admin/daily-prep）
      - body `{ dishId, remaining }` → set；`remaining:null` → 删文档（恢复不限量）。
      - 复用 set-dish-stock.mjs 的写法（merge set + dishName + serverTimestamp）。
- [ ] Dashboard「📦 按菜限量」面板：列全菜单（weeklyMenu）显示 remaining/不限量，输入即改/清。
- [ ] **补手动单漏洞**：见下方统一 consume 端点。手动单对 dishStock = **减且不阻挡**（admin 自主，允许减到 0 以下只标红警告，不拒绝）。

## Layer B — 食材原料库存（新）
- [ ] 新 `src/lib/ingredientStock.ts`：
      - `consumeIngredientStock(db, items)`：按配方（getRecipeForDish/getAddOnRecipe，含手动单别名）累加每种食材用量，对有文档的 `ingredientStock` 做 `increment(-qty)`，**best-effort 永不抛错**；无文档的食材跳过。
      - `getAllIngredientStock(db)` / `setIngredientStock(db, name, onHand)`。
- [ ] 播种脚本 `scripts/seed-ingredient-stock.mjs`：扫 dishIngredients 全配方 → 36 种原料建文档（onHand=0, unit, threshold 默认空），dry-run + --apply。
- [ ] Dashboard「🥩 食材盘点」面板：选日期（默认明天）→ 表格 `食材 | 所需(备餐聚合) | 现有(可改) | 差额 | 阈值`，差额<0 或低于阈值标红；可逐项改 onHand（盘点）。
      - 「所需」复用 /api/admin/daily-prep 同源聚合（新增/扩展一个返回扁平食材+onHand 对照的端点，或前端用现有 groups 汇总）。

## 自动扣减接线（下单自动扣 + 不阻挡）
- [ ] **网页单**：submit-order 在订单创建成功后，**非关键路径**调用 `consumeIngredientStock`（fire-and-forget，包 try/catch，失败只 log，绝不影响下单）。dishStock 仍走现有 consumeDishStock（硬闸保留）。
- [ ] **手动单**：新统一端点 `POST /api/admin/consume-stock` { items }：① dishStock 减（不阻挡）② ingredientStock 减（best-effort）。Dashboard 手动单**保存成功后**用 callAdminAPI 调它。
- [ ] 取消/退款：dishStock 已有 releaseDishStock；ingredient 漂移靠盘点校正（本期不做自动回补，盘点覆盖）。文档里注明。

## Dashboard 改动注意（两副本同步坑）
- [ ] UI 改 **源头** `Desktop/Incredibowl Services/incredibowl-dashboard.html`（671KB），再 `npm run sync:dashboard` 回灌 public/dashboard-h7x2q9.html。
- [ ] 所有新 fetch 走现成 `callAdminAPI()`（带 admin idToken + 处理 CORS）。

## 验证（Definition of Done）
- [ ] `tsc --noEmit` 全绿；dashboard 内联 JS `node --check` 通过。
- [ ] 真实 Firestore：播种 36 文档零残留；下一网页单/手动单后用脚本核对 dishStock 与 ingredientStock 扣减数字 = 配方手算；盘点改 onHand 持久化。
- [ ] 故意造一个食材不够：确认**只标红不拦下单**；Layer A 限量菜售罄确认**仍拦**。
- [ ] /en 与 /（zh）菜单「仅剩 X/售罄」不回归。

## 开放细节（开工前最后确认 1 项）
- 食材盘点单位：grams 类原料 onHand 存 g、显示自动升 kg（沿用 formatQty）。只/颗/块/盒按个数。— 除非你要按 kg 录入，否则按此实现。

## ✅ Review — 库存系统已实现（2026-06-29）
决策落实：两层都做 · 一次做完 · 食材下单自动扣 · 只提醒不阻挡 · 克存克显示升 kg。

**新增/改动文件**
- `src/lib/ingredientStock.ts`（新）— consume/getAll/set；consumeIngredientStock 复用 aggregateIngredients，best-effort 永不抛错；ingredientDocId() 处理 “/” 非法字符。
- `src/lib/stockUtils.ts`（改）— +decrementDishStockLenient（手动单：clamp 0、不阻挡、忽略不限量菜）。
- `src/lib/adminApi.ts`（新）— 共享 verifyAdmin/CORS/adminJson，三个新路由复用。
- `src/lib/prepIngredients.ts`（改）— IngredientLine 改 `import type`（isolatedModules 正确性 + 工具链可跑）。
- `src/app/api/admin/dish-stock/route.ts`（新）— 设/清某菜 remaining。
- `src/app/api/admin/consume-stock/route.ts`（新）— 手动单扣两层（名→id 用 weeklyMenu 映射）。
- `src/app/api/admin/ingredient-stock/route.ts`（新）— list（所需 vs 现有 vs 差额）/ set（盘点）。
- `src/app/api/submit-order/route.ts`（改）— 订单创建后 best-effort 扣食材，try/catch 包住绝不影响下单。
- `scripts/seed-ingredient-stock.mjs`（新）— 枚举配方播种 36 原料（已 --apply，onHand 保留，幂等）。
- Dashboard 源 `Desktop/.../incredibowl-dashboard.html`（改）→ `npm run sync:dashboard` 回灌 public — +「库存」导航/页、按菜限量面板、食材盘点面板、手动单保存后调 consume-stock。

**验证**
- `tsc --noEmit` 全绿。
- 假 db 注入单元测试 **9/9**：配方金额(2×90=180g)/合并同名/跳过未跟踪/“/”doc-id 编码/限量 clamp 0/不限量忽略/破 db 不抛错。
- Dashboard 内联 JS `node --check` 通过；public 拷贝已含新面板（5 处标记）。
- ⏳ 待办（需线上）：**部署后**才能用（dashboard 调 https://www.incredibowl.my 上的新路由）；浏览器 dogfood（需 admin 登录态）；commit+push（按惯例待拍板）。

**已知数据瑕疵（非本次引入）**：配方里 `时蔬`(份/g)、`樱桃番茄`(g/颗) 单位不一致；模糊原料盘点自行决定是否维护。
**运维点**：dashboard 选单加新短 label 要同步 ① dishIngredients 的 MANUAL_LABEL_ALIASES ② 若是限量菜在库存页设份数。
