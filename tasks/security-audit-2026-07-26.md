# 安全 / 订单 / 支付审计 — 2026-07-26

审计范围：`src/app/api/**`（38 个路由）、`src/lib/**`（支付/餐券/库存/通知）、
`src/components/cart/CartDrawer.tsx`、`firestore.rules`、`next.config.ts`。

分级：P0 = 直接损失钱 / 免费拿货；P1 = 顾客或库存被无声吞掉；P2 = 需要技术手段的薅羊毛 / 数据泄露；P3 = 卫生问题。

---

## P0-1 🔴 QR 餐券购买可以用「别人的/自己旧的」付款签名白嫖 —— 无限免费餐券

**位置**：`src/app/api/meal-vouchers/confirm-purchase/route.ts:65-67`

```ts
// Sanity: order ID on the purchase doc must match what Razorpay paid
if (purchaseData.razorpayOrderId && purchaseData.razorpayOrderId !== razorpayOrderId) {
  return NextResponse.json({ error: '支付订单不匹配' }, { status: 400 });
}
```

**根因**：`create-purchase` 只在 **FPX** 分支才写 `razorpayOrderId`
（`create-purchase/route.ts:156`）；**QR** 分支的 purchase doc 根本没有这个字段
（`route.ts:110-135`，status = `'pending-review'`）。所以上面那个 `&&` 短路 → 校验被整个跳过。

`finalizeMealVoucherPurchase()`（`src/lib/mealVoucherUtils.ts:134`）也**不检查**
`status` 是不是 `pending-review`、`paymentMethod` 是不是 fpx，直接铸券。

**攻击步骤**（任何登录用户，5 分钟可复现）：
1. 真买一次最小套餐（FPX），拿到浏览器回调里的 `razorpay_order_id / payment_id / signature` 三件套
   —— 这三个值 FPX 跳回时明文挂在 URL 上（`?fpx_oid=…&fpx_pid=…&fpx_sig=…`）。
2. 用 QR 方式下一个 20 张装的 purchase（`receiptUrl` 随便填一个图床链接，服务端不校验）。
3. 拿第 1 步那套签名 POST `/api/meal-vouchers/confirm-purchase`，`purchaseId` 填第 2 步的。
4. 签名验过（它是真的）→ 铸 20 张券。**同一套签名可以无限次复用**。

**损失**：每次 RM 300+ 的餐券白拿，且账面显示 `status:'paid'`、`totalSpent` 被灌水，
MFRS 15 负债表也跟着错。

**修法**（三道锁，都要加）：
```ts
// confirm-purchase/route.ts，签名校验之前
if (purchaseData.paymentMethod !== 'fpx') {
  return NextResponse.json({ error: '此订单不是 FPX 支付，请等待人工确认' }, { status: 400 });
}
if (!purchaseData.razorpayOrderId || purchaseData.razorpayOrderId !== razorpayOrderId) {
  return NextResponse.json({ error: '支付订单不匹配' }, { status: 400 });
}
```
外加在 `finalizeMealVoucherPurchase()` 里兜底：只接受
`status === 'pending'`（FPX 待确认）或已 `'paid'`（幂等），
`'pending-review'` 一律拒绝——那条路只能走
`/api/admin/confirm-meal-voucher-purchase`（老板人工核收据）。

---

## P0-2 🔴 送餐地址来自请求体，不受地址验证约束 —— 远距离白嫖免运费

**位置**：`src/app/api/submit-order/route.ts:44-54` + `:414-416`

```ts
const { userName, userEmail, userPhone, userAddress, ... } = body;   // ← 客户端说了算
...
const payload = { userId, userName, userEmail, userPhone, userAddress, ... };
```

运费/免运门槛却是从 **user doc** 算的（`:235-261` 读 `userData.deliveryZone`/`addressDistanceKm`），
防换址检查也只是比 `userData.addressVerifiedText === userData.address` —— **两边都不看请求体里的
`userAddress`**。

**攻击步骤**：正常验证一个 1 km 内的地址（免运费）→ 下单时 body 里把 `userAddress`
改成 6 km 外的真实地址。订单 doc 上 `deliveryFee: 0`，但 Dashboard、备餐单、
打包页、CSV 导出、碗妈 Telegram 提醒读的全是 `order.userAddress` = 那个 6 km 地址。
碗妈会照着送。

**损失**：每单白送 RM 3–12，且实际配送成本（自送 ~RM 0.35/km 往返）全额倒贴。
比下面 P2-1 的 `deliveryZone` 篡改更容易——**连 Firestore 都不用碰，改个 JSON 字段就行**。

**修法**：身份字段一律以服务端为准，不接受 body：
```ts
// 已经读了 userSnap，直接用它
const payload = {
  userId,
  userName:   userData.displayName || userName || 'Guest',
  userEmail:  userData.email || '',
  userPhone:  userData.phone || '',
  userAddress: userData.address || '',   // ← 权威来源，与运费计算同源
  ...
};
```
并在最前面加一句：`if (!userData.address) return 400 '请先完善配送地址'`。

---

## P1-1 🟠 取消订单不回补 dishStock / ingredientStock —— 库存被无声吃掉

**位置**：`src/app/api/confirm-order/route.ts:214-246`

`status = 'cancelled'` 分支回补了：餐券（`releaseMealVouchers`）、预付加料 credit
（`releaseAddonCredits`）、promo 券（`usedCount--`）。
**唯独没有** `releaseDishStock` 和 `releaseIngredientStock`。

而 `/api/n8n/release-stale-fpx`（唯一会回补两层库存的地方）查询条件是
`status == 'pending'`（`release-stale-fpx/route.ts:58-61`）——订单已经被客户端标成
`cancelled` 了，**永远扫不到**。

**触发路径（每天都在发生，不需要攻击者）**：
- `CartDrawer.tsx:633` —— FPX 弹窗被关掉 / 网络失败 → 立刻 POST cancelled。
- `page.tsx:91` / `en/page.tsx:95` —— `?fpx_error=` 跳回 → `cancelPending()`。
- `admin/page.tsx:320` —— 老板在 Dashboard 手动取消订单。

**后果**：每一次放弃的 FPX 结账都会永久烧掉一份 dishStock（比如参峇臭豆会提前显示
「售罄」）和一整单的原料库存（盘点数字持续往下漂）。这大概率就是你偶尔觉得
「库存数字对不上」的原因。

**修法**：把回补逻辑搬进 `confirm-order` 的 cancel 分支，跟餐券回补并排放：
```ts
if (status === 'cancelled' && orderData.status !== 'cancelled') {
  const items = Array.isArray(orderData.items) ? orderData.items : [];
  const dishItems = items
    .filter(it => it?.name && !/^↳/.test(it.name) && (it.quantity || 0) > 0)
    .map(it => { const d = menuByName.get(it.name); return d ? { dishId: d.id, qty: it.quantity, name: it.name } : null; })
    .filter(Boolean);
  try { await releaseDishStock(db, dishItems); } catch (e) { console.error(...); }
  try { await releaseIngredientStock(db, items, { orderId, source: '取消回补' }); } catch {}
}
```
（映射逻辑直接抄 `release-stale-fpx/route.ts:87-97`，最好抽成 `lib/orderRollback.ts`
一个函数，三个调用方共用，别再复制第四遍。）

⚠️ 幂等要注意：已经是 `cancelled` 的单再点一次取消不能重复回补——上面的
`orderData.status !== 'cancelled'` 守卫就是干这个的，别漏。

---

## P1-2 🟠 `/api/admin/data` 是个 GET，但会偷偷取消订单，而且什么都不回补

**位置**：`src/app/api/admin/data/route.ts:48-60`

```ts
// Auto-cancel FPX pending orders older than 10 minutes
if (d.status === 'pending' && d.paymentMethod === 'fpx' && orderTime < tenMinAgo) {
  cancelPromises.push(doc.ref.update({ status: 'cancelled', updatedAt: new Date() }));
}
```

三个问题叠在一起：

1. **裸 `doc.ref.update()`** —— 绕过 `confirm-order` 的全部回补逻辑。餐券、预付
   credit、promo 券、dishStock、ingredientStock **一个都不还**。顾客的餐券会
   永久卡在 `status:'redeemed'`、指向一个已取消的订单 = **顾客的钱没了**。
2. **10 分钟 vs 1 小时冲突** —— 老板 2026-07-02 拍板的窗口是 1 小时
   （`release-stale-fpx`）。这里 10 分钟就先下手，把订单从 `pending` 挪走，
   导致那个**做得对的**1 小时对账任务再也扫不到它。
3. **只读接口有写副作用** —— 你每刷新一次 Dashboard 就触发一次。FPX 银行慢一点
   （手机 App 跳转、TAC 慢）就会被误杀；顾客随后付款成功 → webhook 走
   `handleFoodOrderFallback` 发现单已 cancelled → 只打个 `needsReview` 标记
   （`payment/webhook/route.ts:162-173`）→ **钱收了，单没了**。

**修法**：直接删掉 `admin/data/route.ts:48-60` 整段。这件事
`/api/n8n/release-stale-fpx` 已经做对了（1 小时 + 三层回补 + 日志），
不需要第二个实现。如果你想要 Dashboard 打开时也触发一次，就让前端调
`release-stale-fpx` 那个接口，别在 GET 里写库。

---

## P1-3 🟠 支付了但订单确认不了：`razorpayOrderId` 会被后一次 create-order 覆盖

**位置**：`src/app/api/payment/create-order/route.ts:83-86`

```ts
for (const ref of refs) {
  batch.update(ref, { razorpayOrderId: order.id, ... });   // ← 无条件覆盖
}
```

`confirm-order` 的 Path A 要求 `o.razorpayOrderId === pd.razorpayOrderId`
（`confirm-order/route.ts:91`）。

**场景**：顾客 A 标签页开了 FPX（绑定 R1）跳去银行 App；期间在 B 标签页又加了菜
重新结账（绑定 R2，覆盖了 R1）。回来付掉 R1 → `confirm-order` 拒绝（403 未授权）
→ webhook 兜底查 `where('razorpayOrderId','==',R1)` 也查不到，**静默返回 200**
（`webhook/route.ts:155-157`），连 `needsReview` 都不打 → 1 小时后被扫成 cancelled。
**顾客付了钱，订单消失，零告警。**

**修法**：`create-order` 里拒绝重新绑定一个已经有在途绑定的订单，或者把绑定改成数组：
```ts
// 简单版：已有绑定且不是本次的，直接拒
if (o.razorpayOrderId) {
  return NextResponse.json({ error: '该订单已有进行中的支付，请先完成或等待 1 小时后重试' }, { status: 409 });
}
```
稳妥版：改成 `razorpayOrderIds: FieldValue.arrayUnion(order.id)`，`confirm-order`
判定改成 `o.razorpayOrderIds?.includes(pd.razorpayOrderId)`。
另外 webhook 那条「查不到订单」的分支应该 `console.error` + 打标记，不要静默 200。

---

## P2-1 🟡 `deliveryZone` / `addressDistanceKm` 客户端可写 —— 骗免运费（已知残余）

**位置**：`firestore.rules:25-35`（`userSafeFields()` 白名单里）+ `src/lib/auth.ts:139-167`

规则文件里自己也写了这条 ⚠️ 注释。浏览器控制台一句
`updateDoc(doc(db,'users',uid), { addressDistanceKm: 0.5, deliveryZone:'within2km',
address:'X', addressVerifiedText:'X' })` 就能永久免运费。

**注**：P0-2 那条比这个更好用（连 Firestore 都不用碰），所以两条要一起修才有意义。

**修法**（安全计划阶段 2.5，一直没做）：把地址落库挪到服务端。新建
`POST /api/save-address`：服务端自己调 geocode → 自己算 distance/zone → 用 Admin SDK 写；
然后从 `userSafeFields()` 里删掉 `addressLat/addressLng/addressDistanceKm/deliveryZone/
addressFormatted/addressVerifiedAt/addressVerifiedText`，客户端只留 `address` 文本。

---

## P2-2 🟡 服务端不校验「这道菜今天到底卖不卖」

**位置**：`src/app/api/submit-order/route.ts:88-105`

服务端只查了两件事：菜在 `weeklyMenu` 里存在 + `availableWeekdays`（只有少数常驻菜有这字段）。
**完全没查**：

| 漏掉的校验 | 后果 |
|---|---|
| `dish.retired`（暂别菜，7 道） | 灰显卡片只是 UI；旧购物车 / 直接调 API 照样下单 |
| `dish.hidden`（未上架菜，emoji 占位图） | 还没准备好的菜被点走 |
| `dish.weekday`（周特餐排期） | 周一特餐可以下单到周三 |
| `isDishBlockedOn(dish.id, date)` | 老板手动停某道菜那天，照样收单 |

**这不只是理论攻击**：`CartDrawer.tsx:109` 的过期清理**只看日期不看菜**
（`isOrderDateValid(item.selectedDate)`）。购物车存 localStorage，上周加的
酱油鸡（本周已 PAUSED）今天点结账 → 客户端放行、服务端放行 → **厨房收到一道
今天根本没买料的菜**。

**修法**：在 `submit-order` 菜品循环里补齐（紧跟现有 `availableWeekdays` 那段）：
```ts
if (dish.retired) return 400 `${dish.name} 已暂别菜单，请从购物车移除`;
if (dish.hidden)  return 400 `${dish.name} 暂未上架`;
if (isDishBlockedOn(dish.id, bundle.selectedDate))
  return 400 `${dish.name} 在 ${bundle.selectedDate} 暂停供应`;
// 周特餐：只能下单到它自己的 weekday
if (dish.weekday !== undefined && wd !== dish.weekday)
  return 400 `${dish.name} 仅在${wdCn[dish.weekday]}供应`;
```
同时 `CartDrawer` 的清理逻辑也要一起加菜品维度（复用同一个函数，别写两份），
否则顾客会在结账那一刻才看到报错。

---

## P2-3 🟡 `/api/check-voucher` 零认证，可无限枚举优惠码

**位置**：`src/app/api/check-voucher/route.ts:5-13`

```ts
const { voucherCode, userId } = await request.json();   // userId 也是客户端说了算
const result = await validateVoucher(db, voucherCode, { userId });
```

没有 Bearer 校验、没有速率限制。任何人可以：
- 暴力枚举优惠码（返回体直接带 `discount` 和 `remainingUses`）；
- 传任意 `userId` 探测「某个 uid 有没有用过某码」（`validateVoucher` 会读 users doc）。

**修法**：加 `verifyBearerUser`，`userId` 只从 token 取（跟 `submit-order` 一样的姿势）；
再套一层 `check-delivery/route.ts:38-77` 已经写好的 IP 限流（直接复用那个函数）。

---

## P2-4 🟡 `/api/geocode` 有认证但无限流 → Google Maps 账单可被刷爆

**位置**：`src/app/api/geocode/route.ts:41-45`

只验了「是个登录用户」。但匿名登录是开着的（访客下单方案），
`signInAnonymously` 无成本无限拿 uid → 每个 uid 无限次调 Google Geocoding API
（$5/1000 次）。旁边的 `/api/check-delivery` 反而有限流，这里没有。

**修法**：把 `check-delivery` 的 `checkRateLimit(ip)` 抽到 `lib/rateLimit.ts`，
`geocode` 也套上（建议 per-uid + per-ip 双维度，20 次/小时足够正常改地址）。

---

## P2-5 🟡 任何人可取消任意 `pending` 订单（无需登录）

**位置**：`src/app/api/confirm-order/route.ts:98-102`

```ts
authorized = isOwnerOfAll || gateOrders.every(o => o.status === 'pending');
```

无 token 也能取消，只要订单还是 pending。缓解因素是 Firestore auto-id 20 字符不可猜
（`/api/track` 只暴露末 6 位，拼不回来）。属于**设计取舍**（银行跳转回来时没有 session），
但配合 P1-1 就变成了「知道 id 就能烧掉别人的库存和餐券」。

**修法**：不用大改。给这条路径加个绑定校验——取消时要求带上
`trackToken` 或 `razorpayOrderId` 作为持有凭证，比裸 orderId 强一档。

---

## P3 卫生问题（不紧急，顺手修）

1. **`finalizeMealVoucherPurchase` 用 `tx.update(userRef)`**（`mealVoucherUtils.ts:171`）——
   user doc 不存在会抛错。此时券**已经铸出来了**（batch 先 commit），但 purchase
   卡在 `pending` + webhook 无限重试。改成 `tx.set(userRef, {...}, {merge:true})`，
   跟 `confirm-order/route.ts:169` 保持一致。
2. **`submit-order` 不限制 `cartBundles` 长度**（`route.ts:62-64`）——加个
   `cartBundles.length > 50 → 400`。同一个循环里还对同一个 user doc 做了 N 次
   `update({lastOrderAt})`（`:455`），挪到循环外一次搞定。
3. **`receiptUrl` 不校验协议**（`submit-order:434` → `ownerNotify.ts:93` 渲染成
   `<a href>`）。`escapeHtml` 不挡 `javascript:`。加一句
   `if (receiptUrl && !/^https:\/\//.test(receiptUrl)) return 400`。
4. **QR 单服务端不强制 `receiptUrl`** —— 只有 `CartDrawer.tsx:535` 的前端 alert 挡着。
   服务端加一句 `if (paymentMethod === 'qr' && !receiptUrl) return 400`。

---

## 检查过、没问题的部分 ✅

- Razorpay 签名校验四处（verify / confirm-order / confirm-purchase / webhook）
  全部用 `crypto.timingSafeEqual` + 长度预检，写法正确。
- Webhook HMAC 走 `req.text()` 原始字节，没有 JSON 重序列化破坏签名。
- `create-order` 金额从订单 doc 服务端求和，不信客户端（2026-07-03 加固有效）。
- `confirm-order` Path A 的 `razorpayOrderId` 绑定比对，确实能挡住「拿一次真付款的签名
  去确认另一单」的重放。
- 全部 19 个 `/api/admin/*` 路由都有 Bearer + email 白名单，无遗漏。
- `.env*` 已在 `.gitignore`，git 历史里没有泄露过密钥。
- `/api/track` 是白名单字段输出，不漏地址/电话/金额；token 格式预校验。
- 安全响应头（HSTS / X-Frame-Options / nosniff / Referrer-Policy）已配。

---

## 建议修复顺序

| 顺序 | 项 | 理由 |
|---|---|---|
| 1 | P0-1 餐券白嫖 | 直接免费拿货，5 分钟可复现 |
| 2 | P1-2 删掉 admin/data 自动取消 | 一行删除，立刻止住「顾客餐券被吞」 |
| 3 | P1-1 取消回补库存 | 每天都在漏，影响售罄判断和盘点 |
| 4 | P0-2 地址以服务端为准 | 改 5 行，顺手把 P2-1 的一半堵掉 |
| 5 | P2-2 菜品排期服务端校验 | 防厨房收到没料的菜 |
| 6 | P1-3 razorpayOrderId 覆盖 | 概率低但丢钱且无告警 |
| 7 | P2-1 地址验证挪服务端 | 工程量最大，独立一轮做 |
| 8 | P2-3/2-4/2-5 + P3 | 打包一轮清掉 |
