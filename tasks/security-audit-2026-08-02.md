# 全站 BUG / 安全审计 — 2026-08-02

上一轮：`tasks/security-audit-2026-07-26.md`（7 天前）。

## 本轮怎么做的 + 诚实声明

1. **发现阶段**：9 个审计代理并行深读 `src/app/api/**`、`src/lib/**`、`firestore.rules`、
   `src/components/cart/**`、最近 25 个 commit 的新代码，共报 45 条（含跨维度重复）。
2. **对抗性复核阶段**：14 组复核代理**全部因会话额度上限失败**，一条判决都没拿到。
3. 因此下面**严格分层**：
   - ✅ **已亲验** = 我自己用 Read 打开源文件逐行核过，行号、代码、可达路径都对得上。
   - ⚠️ **待复核** = 审计代理报的，我**没有**逐行核实，可能有误报。修之前请先自行确认。

**未验证的东西一律标出来，不会为了报告好看而填空。**

---

# ✅ 已亲验的问题

## P0-A 🔴 任何人在网站上「注册」一个管理员邮箱，即可拿到全站管理员权限

**位置**：[firestore.rules:12-17](../firestore.rules#L12-L17) + [src/lib/adminApi.ts:12,48](../src/lib/adminApi.ts#L48)

```
// firestore.rules
function isAdmin() {
  return isSignedIn() && request.auth.token.email in [
    'incredibowl.my@gmail.com',
    'hello@incredibowl.my'
  ];
}
// adminApi.ts:48
return decoded.email && ADMIN_EMAILS.includes(decoded.email) ? decoded.email : null;
```

**根因**：两处都只比对 email **字符串**，都**不检查 `email_verified`**。
而邮箱密码注册在本站是**活的**：
[AuthModal.tsx:148](../src/components/auth/AuthModal.tsx#L148) → [auth.ts:67](../src/lib/auth.ts#L67)
`createUserWithEmailAndPassword(auth, email, password)`。

Firebase 在注册时**不验证你是否拥有这个邮箱**。所以：

**攻击步骤**：打开网站 → 点注册 → 邮箱填 `hello@incredibowl.my`、密码随便 → 注册成功。
拿到的 ID token 里 `email: "hello@incredibowl.my"`、`email_verified: false` →
同时通过 `firestore.rules` 的 `isAdmin()` **和** 19 个 `/api/admin/*` 的鉴权。

**能干什么**：
- 兜底规则 [firestore.rules:102-104](../firestore.rules#L102-L104) 是 `allow read, write: if isAdmin()`
  → 客户端 SDK 直接**读写整个数据库**：全部顾客姓名/电话/地址、全部订单、全部餐券。
- 19 个 admin API 全开：凭空卖餐券、取消任意订单、改任意用户、改库存。

**唯一的未知数**（我从代码里看不到，**需要老板去 Firebase Console 确认**）：
1. Authentication → Sign-in method → **Email/Password 是否启用**？
   （代码里 `registerWithEmail` 是活的，所以大概率是开的）
2. Authentication → Users → **`hello@incredibowl.my` 这个账号是否已经存在**？
   - 已存在 → 注册会报 `auth/email-already-in-use`，这条路暂时被堵（但仍是定时炸弹）。
   - 不存在 → **现在就是敞开的**。
3. `incredibowl.my@gmail.com` 应该已被老板的 Google 登录占用，相对安全。

**修法**（三层，建议全做）：

第一层——立刻堵（5 分钟）：去 Firebase Console 用邮箱密码方式**自己把
`hello@incredibowl.my` 注册掉**（占位），或直接停用 Email/Password 登录方式。

第二层——代码层加 `email_verified`：
```ts
// adminApi.ts:48
return decoded.email && decoded.email_verified === true && ADMIN_EMAILS.includes(decoded.email)
  ? decoded.email : null;
```
```
// firestore.rules
function isAdmin() {
  return isSignedIn()
      && request.auth.token.email_verified == true
      && request.auth.token.email in ['incredibowl.my@gmail.com', 'hello@incredibowl.my'];
}
```
⚠️ 注意：Google 登录返回的 `email_verified` 是 true，所以老板自己不受影响。

第三层——根治，改成 UID 白名单（email 是可变的，uid 不是）：
```ts
export const ADMIN_UIDS = ['<老板的 uid>'];   // Firebase Console → Users 里抄
// 判定：ADMIN_UIDS.includes(decoded.uid)
```
```
function isAdmin() { return isSignedIn() && request.auth.uid in ['<老板的 uid>']; }
```

---

## P0-B 🔴 顾客可以取消自己**已送达**的订单，餐券 / 预付 credit / 两层库存全额退回 = 吃完再退

**位置**：[confirm-order/route.ts:100](../src/app/api/confirm-order/route.ts#L100) + [orderRollback.ts:96](../src/lib/orderRollback.ts#L96)

```ts
// confirm-order:97-101
} else if (status === 'cancelled') {
  authorized = isOwnerOfAll || gateOrders.every(o => o.status === 'pending');
}
// isOwnerOfAll (line 74) = 带自己 token 且订单都是自己的 —— 不看订单状态
```
```ts
// orderRollback:96 —— 事务门只挡「已取消」和「已回补」，不挡 delivered
if (d.status === 'cancelled' || d.rollbackAt) return;
```

**攻击步骤**（登录顾客，浏览器 F12 一行）：
1. 用餐券下单 → `submit-order` 把券翻成 `redeemed` 并写进 `order.claimedMealVoucherIds`。
2. 收货、吃完。老板在 Dashboard 把单标成 `delivered`。
3. 顾客控制台：
   ```js
   fetch('/api/confirm-order', {method:'POST',
     headers:{'Content-Type':'application/json','Authorization':'Bearer '+await firebase.auth().currentUser.getIdToken()},
     body: JSON.stringify({orderIds:['<自己那张已送达的单>'], status:'cancelled'})})
   ```
4. `isOwnerOfAll` = true → 放行 → `cancelOrderWithRollback` 把**餐券翻回 available、
   预付 credit 退回、dishStock 凭空 +N、promo 券 usedCount 减回**。
5. 券回到账户，再下一单。循环到券过期为止。

**损失**：一次购券可反复吃到过期（30~60 天）。附带：已送达单被翻成 cancelled →
掉出 `PAID_STATUSES` → Dashboard 营收和 MFRS 15 负债表同时错账；dishStock 凭空印库存 → 超卖。

**修法**（一行）：
```ts
} else if (status === 'cancelled') {
  // ⚠️ 只允许取消仍是 'pending' 的单。原来的 `isOwnerOfAll ||` 等于顾客吃完
  //    还能自助取消 → releaseMealVouchers/releaseAddonCredits 全额退回 = 白吃。
  //    admin 走上面的 isAdmin 分支，Dashboard 手动取消不受影响。
  authorized = gateOrders.every(o => o.status === 'pending');
}
```
**✅ 已确认不会误伤**：顾客侧现有的三处取消调用
（[CartDrawer.tsx:638](../src/components/cart/CartDrawer.tsx#L638)、
[CartDrawer.tsx:748](../src/components/cart/CartDrawer.tsx#L748)、
[page.tsx:104](../src/app/page.tsx#L104)）取消的都是刚建、还没确认的 `pending` 单。

再在 `orderRollback.ts:96` 加一道兜底，防止将来第四个调用方绕过：
```ts
if (d.status === 'cancelled' || d.rollbackAt) return;
if (d.status !== 'pending' && !opts.allowNonPending) return;  // 终态单不回补
```
（`allowNonPending: true` 只由 admin 路径传。）

---

## P0-C 🔴 加料数量不校验正负 —— 用负数把 RM 50 的单压成 RM 5，厨房照做

**位置**：[submit-order/route.ts:113](../src/app/api/submit-order/route.ts#L113)

```ts
serverAddOnsTotal += serverPrice * (addOn.quantity || 0);          // :113 无正数校验
const serverBundlePrice = (serverDishPrice * (bundle.dishQty || 1)) + serverAddOnsTotal;  // :118
const serverBundleTotal = serverBundlePrice * (bundle.quantity || 1);                     // :119
// :123-124 的"价格校验"是拿客户端自己传的 price 比，两边填一致就过
const clientBundleTotal = (bundle.price || 0) * (bundle.quantity || 1);
if (Math.abs(serverBundleTotal - clientBundleTotal) > 0.02) { ...400... }
```

**攻击步骤**：直接 POST `/api/submit-order`，某个 bundle 的 `addOns` 里塞
`{id:'<任意合法加料id>', quantity: -20}`，同时把 `bundle.price` 填成压低后的数字。
服务端算出来和客户端一致 → 放行 → 订单 `total` 是压低价，`items` 里**主菜原样保留**。
走正常 FPX 付款：[create-order](../src/app/api/payment/create-order/route.ts) 按订单 doc 求和收款
→ **只收压低后的钱，厨房按 items 做全套菜**。

不用打到 0（打到 0 会被运费和老板肉眼发现），压到「看起来像个小单」最隐蔽。

**修法**：所有来自 body 的数量统一归一化，放在 bundle 循环最前面：
```ts
const posInt = (v: unknown, max = 50) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0;
};
// 加料
const qty = posInt(addOn.quantity, 20);
if (qty === 0) return NextResponse.json({ error: `加购项数量非法: ${addOn.id}` }, { status: 400 });
serverAddOnsTotal += serverPrice * qty;
validatedAddOns.push({ ...addOn, price: serverPrice, quantity: qty });
// 菜品
const dishQty = posInt(bundle.dishQty, 20) || 1;
const bundleQty = posInt(bundle.quantity, 20) || 1;
```
顺手补 `cartBundles.length > 50 → 400`（上一轮 P3-2 也提过，仍未加）。

---

## P0-D 🔴 QR 餐券购买可用「自己旧的付款签名」无限铸免费餐券（**上一轮 P0-1，一字未改**）

**位置**：[confirm-purchase/route.ts:65](../src/app/api/meal-vouchers/confirm-purchase/route.ts#L65)

```ts
if (purchaseData.razorpayOrderId && purchaseData.razorpayOrderId !== razorpayOrderId) {
  return NextResponse.json({ error: '支付订单不匹配' }, { status: 400 });
}
```

**根因**：QR 分支建 purchase doc 时 `status: 'pending-review'`
（[create-purchase:129](../src/app/api/meal-vouchers/create-purchase/route.ts#L129)），
**不写 `razorpayOrderId`**（只有 FPX 分支在 :157 才写）→ 上面那个 `&&` 短路 →
绑定校验被整个跳过。`finalizeMealVoucherPurchase`（[mealVoucherUtils.ts:134](../src/lib/mealVoucherUtils.ts#L134)）
也**不检查 status / paymentMethod**，直接铸券。

**攻击步骤**：① 真买一次最小套餐（FPX），FPX 跳回时 `fpx_oid/fpx_pid/fpx_sig`
明文挂在 URL 上，抄下来。② 用 QR 方式下一个 20 张装的 purchase。
③ 拿第 ① 步的签名 POST confirm-purchase，`purchaseId` 填第 ② 步的 → 铸 20 张券。
**同一套签名可无限复用。**

**修法**（替换现在的 :64-67）：
```ts
// 这条路只服务 FPX。QR 单必须由老板核收据后走 /api/admin/confirm-meal-voucher-purchase
if (purchaseData.paymentMethod !== 'fpx') {
  return NextResponse.json({ error: '此订单不是 FPX 支付，请等待人工确认' }, { status: 400 });
}
if (!purchaseData.razorpayOrderId || purchaseData.razorpayOrderId !== razorpayOrderId) {
  return NextResponse.json({ error: '支付订单不匹配' }, { status: 400 });
}
```
外加 `finalizeMealVoucherPurchase` 里兜底（`const d = snap.data() || {};` 之后）：
```ts
if (d.status !== 'pending' && d.status !== 'paid') {
  throw new Error(`purchase ${purchaseId} 状态为 ${d.status}，不可自动铸券`);
}
```

---

# ✅ 已亲验的 P1

## P1-A 🟠 订单地址取自请求体，运费却按 user doc 算（**上一轮 P0-2，未修**）

[submit-order:45,59,431](../src/app/api/submit-order/route.ts#L431) —— `userAddress` 从 body 解构、
校验非空、**原样落库**；运费和防换址检查读的是 user doc。
验证一个 1km 内地址（免运）→ 下单时 body 里把 `userAddress` 换成 6km 外的真地址 →
`deliveryFee: 0`，但 Dashboard / 备餐单 / 打包页 / Telegram 提醒读的都是 body 那个地址，碗妈照送。

**修法**：身份与配送字段一律以服务端 user doc 为准：
```ts
const payload = {
  userId,
  userName:   userData.displayName || userName || 'Guest',
  userEmail:  userData.email || '',
  userPhone:  userData.phone || '',
  userAddress: userData.address || '',   // ← 与运费计算同源
  ...
};
```
并在最前面加 `if (!userData.address) return 400 '请先完善配送地址'`。

## P1-B 🟠 `razorpayOrderId` 被后一次结账无条件覆盖 → 付了钱订单消失（**上一轮 P1-3，未修**）

[create-order/route.ts:84](../src/app/api/payment/create-order/route.ts#L84) `batch.update(ref, { razorpayOrderId: order.id })` 无守卫。
A 标签页开 FPX 绑 R1 → B 标签页重新结账绑 R2 覆盖 → 回来付掉 R1 →
confirm-order 的绑定比对失败（403），webhook 也查不到订单静默 200。**钱收了，单没了，零告警。**

**修法**：改成数组绑定
```ts
batch.update(ref, { razorpayOrderIds: FieldValue.arrayUnion(order.id), razorpayOrderId: order.id });
// confirm-order:90 判定改成
authorized = gateOrders.every(o => (o.razorpayOrderIds || [o.razorpayOrderId]).includes(pd.razorpayOrderId));
```
webhook 那条「查不到订单」的分支必须 `console.error` + 打 `needsReview`，不要静默 200。

## P1-C 🟠 多段订单的餐券全挂在第 1 段，取消第 1 段能拿回全部券但其余段仍享折扣

[submit-order:515](../src/app/api/submit-order/route.ts#L515)
```ts
const claimed = await claimMealVouchers(db, userId, mealVouchersUsed, orderIds[0]);
```
一次结账跨两天/两个时段会被拆成多个 order doc，但券只写进 `orderIds[0]` 的
`claimedMealVoucherIds`；而每一段的 `total` 都已经按比例减掉了餐券折扣
（[:387](../src/app/api/submit-order/route.ts#L387)）。取消第 1 段 → 全部券退回 → 其余段白拿折扣。

**修法**：按段分配券 id（每段 claim 自己那部分），或取消任一段时按段释放对应券。
最简单：`claimMealVouchers` 改成返回 ids 后**按段切片**写入各自的 doc。

## P1-D 🟠 铸券的「幂等」在事务外，浏览器 + webhook 同时确认会铸双倍券

[mealVoucherUtils.ts:44-50](../src/lib/mealVoucherUtils.ts#L44)
```ts
const existing = await purchaseRef.get();                    // ← 普通读，不在事务里
if (Array.isArray(existingData.voucherIds) && existingData.voucherIds.length > 0) return existingData.voucherIds;
...
const batch = db.batch();  // ← 之后才写
```
两个确认同时进来（浏览器确认 + Razorpay webhook，这在本项目是**真实存在**的双路径）
都读到空 `voucherIds` → 各铸 N 张 → 顾客拿到 2N 张券。

**修法**：把幂等键的读和写放进同一个 `runTransaction`：
```ts
await db.runTransaction(async (tx) => {
  const snap = await tx.get(purchaseRef);
  const d = snap.data() || {};
  if (Array.isArray(d.voucherIds) && d.voucherIds.length) { ids = d.voucherIds; return; }
  ids = [];
  for (let i = 0; i < voucherCount; i++) { const ref = db.collection('mealVouchers').doc(); ids.push(ref.id); tx.set(ref, {...}); }
  tx.update(purchaseRef, { voucherIds: ids });
});
```

## P1-E 🟠 计费用的字段客户端可写

[firestore.rules:25-35](../firestore.rules#L25-L35) 的 `userSafeFields()` 里包含
`addressDistanceKm` / `deliveryZone` / `phone` / `phoneNormalized`。
浏览器一句 `updateDoc(doc(db,'users',uid), {addressDistanceKm:0.5, deliveryZone:'within2km'})`
→ 永久免运费。`phone/phoneNormalized` 可写还让首单券 FIRST5 的
「同号去重」兜底（[voucherValidation.ts:121-128](../src/lib/voucherValidation.ts#L121)）失效——清空 phone 即可复用。

**修法**（安全计划阶段 2.5，一直没做）：新建 `POST /api/save-address`，服务端自己
geocode、自己算 distance/zone、用 Admin SDK 写；然后从 `userSafeFields()` 删掉
`addressLat/addressLng/addressDistanceKm/deliveryZone/addressFormatted/addressVerifiedAt/addressVerifiedText`
和 `phoneNormalized`，客户端只留 `address` 和 `phone` 文本。

---

# ✅ 已亲验的 P2

- **QR 凭证零校验**：[submit-order:442,454](../src/app/api/submit-order/route.ts#L442)
  `receiptUploaded: receiptUploaded || false` + `if (receiptUrl) payload.receiptUrl = receiptUrl`
  —— 不强制 QR 单必须有凭证、不校验 `https://` 协议（`ownerNotify` 会把它渲染成 `<a href>`）。
  修：`if (paymentMethod==='qr' && !receiptUrl) return 400` + `if (receiptUrl && !/^https:\/\//.test(receiptUrl)) return 400`。
- **手动单库存一扣一补凭空印货**：[stockUtils.ts](../src/lib/stockUtils.ts) 的
  `decrementDishStockLenient` 扣减时 `Math.max(0, remaining - qty)` 会 clamp，
  而 `releaseDishStock` 回补时按 `qty` 全额 increment。remaining=1、下 3 份 → 扣成 0；
  取消 → +3 → 库存变成 3。**修**：clamp 时记录实际扣减量写进订单，回补按实际量。

---

# ⚠️ 待复核清单（审计代理报的，我没亲验）

修之前请自己先核一遍。按代理给的严重度排：

| 代理定级 | 问题 | 位置 |
|---|---|---|
| P0 | 已取消并全额回补的订单能被重新 confirm 复活，资源不重扣 | confirm-order:88,143 |
| P1 | 加料 `name` 由客户端提供并直接进厨房备餐单（RM0 加料换 RM18.50 鳗鱼） | submit-order:114 |
| P1 | 手动核销先扣券后扣 credit，加料不足抛错时券已被吞 | admin/manual-voucher-redemption:154 |
| P1 | 周订阅「确认建单+扣券」幂等非原子且无 maxDuration，重试扣两遍券 | admin/subscriptions/week:314 |
| P2 | 删掉 user doc 的 `addressDistanceKm` 变「legacy 用户」→ 免运 + 绕 25km 上限 | submit-order:268 |
| P2 | 未付款的 QR 单立刻占限量菜库存且永不超时清理 → 零成本刷售罄 | release-stale-fpx:53 |
| P2 | 首单码 FIRST5 提交时不预占，同一账号可连开多单反复减 RM5 | voucherValidation:104 |
| P2 | 食材盘点「结余」重复扣同一批订单 → 虚假缺货多买货 | admin/ingredient-stock:113 |
| P2 | 开新配送批次会静默关掉上一趟没送完的单，跟踪页永远转圈 | admin/delivery-batch:77 |
| P2 | admin 改客户电话不同步 `phoneNormalized` → 后续餐券记到幽灵账号 | admin/update-user:84 |
| P2 | 购物车清掉过期菜后，解释用的琥珀提示条被同一个 effect 立刻清空 | CartDrawer:168 |
| P2 | 新内嵌收货表单丢了 `partialMatch` 警告，Google 模糊匹配到别的地址也照存 | CartDeliveryInfo:205 |
| P2 | 整周 QR 大单的 Telegram 提醒超 4096 字符静默发不出 | ownerNotify:109 |
| P2 | QR 餐券购买（RM168~333）落 pending-review 后**没有任何老板提醒** | meal-vouchers/create-purchase:127 |
| P2 | 复活过的订单此后永远取消不掉，接口却返回 success:true | orderRollback:96 |
| P2 | 首次确认副作用非原子：webhook + 浏览器同时到会记两次 LTV、发两封收据 | confirm-order:143 |
| P2 | 事务回调里累加外部变量，事务重试导致券 id 重复 | mealVoucherUtils:256 |
| P3 | 4 个 n8n 端点仍允许 `?key=` 明文传密钥且用 `!==` 比较（另两个已硬化） | n8n/daily-prep:412 |
| P3 | 成功页/发给碗妈的金额是折前小计，与 FPX 回跳显示的实付不一致 | CartDrawer:780 |
| P3 | 回给 Meta 的 InitiateCheckout 金额没扣餐券和 credit，餐券单虚报全价 | submit-order:556 |
| P3 | Meta CAPI 商品 ID 有三套口径，Purchase 用中文菜名，跟目录 feed 永远匹配不上 | confirm-order:166 |
| P3 | 手动单兜底客户 id 用未归一化电话，同号分裂成两个客户 | manualOrderCore:132 |
| P3 | 改单同步库存是两次独立 HTTP，第二次失败只 console.warn → 库存永久虚高 | dashboard HTML:13311 |
| P3 | submit-order 预留 dishStock 后中途抛错，外层 catch 不释放 | submit-order:627 |

---

# 上一轮（07-26）问题的现状

| 旧编号 | 现状 |
|---|---|
| P0-1 QR 餐券签名重放 | 🔴 未修（= 本轮 P0-D） |
| P0-2 地址取自请求体 | 🔴 未修（= 本轮 P1-A） |
| P1-3 razorpayOrderId 覆盖 | 🔴 未修（= 本轮 P1-B） |
| P2-1 deliveryZone 客户端可写 | 🔴 未修（= 本轮 P1-E） |
| P2-5 任何人可取消 pending 单 | 🟡 仍在，但收紧 P0-B 时会顺手改善 |
| P1-1 取消不回补库存 | ✅ 已修（统一走 `cancelOrderWithRollback`） |
| P1-2 admin/data 10 分钟裸取消 | ✅ 已修（1 小时 + 事务幂等回补） |
| P2-2 菜品排期服务端校验 | ✅ 已修（`isDishOrderableOn` 共用） |
| P2-3 check-voucher 零认证 | ✅ 已修（Bearer + 双限流） |
| P2-4 geocode 无限流 | ✅ 已修 |
| P3-2 cartBundles 不限长度 | 🔴 未修 |
| P3-3 receiptUrl 不校验协议 | 🔴 未修 |

---

# 建议修复顺序

| # | 项 | 工作量 | 理由 |
|---|---|---|---|
| 1 | **P0-A** Firebase Console 占位 `hello@incredibowl.my` + 停用邮箱密码登录 | 5 分钟 | 唯一一条「全站接管」，且不用改代码就能先堵住 |
| 2 | **P0-B** confirm-order 取消权限收紧 | 1 行 | 已确认零误伤 |
| 3 | **P0-C** 数量正数校验 | 10 行 | 直接压价白吃 |
| 4 | **P0-D** QR 餐券两道锁 | 10 行 | 上一轮就该修 |
| 5 | P0-A 第二/三层：`email_verified` + UID 白名单 | 半小时 | 根治 |
| 6 | P1-A 地址以服务端为准 | 5 行 | 顺手堵掉 P1-E 一半 |
| 7 | P1-B / P1-C / P1-D | 各半小时 | 丢钱但概率低 |
| 8 | P1-E 地址验证挪服务端（阶段 2.5） | 独立一轮 | 工程量最大 |
| 9 | ⚠️ 待复核清单：先复核再修 | — | 额度恢复后跑一轮对抗性复核 |

---

# 怎么防止再犯（根因模式）

这 11 条亲验问题其实只有 **5 个根因模式**，把模式堵住比逐条打补丁重要。

### 模式 1：拿「用户可自助设置的值」做权限或计费判定
中招：P0-A（email 字符串）、P1-A（body 里的 userAddress）、P1-E（客户端可写的 deliveryZone）。

**规则**：**凡是会影响权限或金额的字段，只能来自三个地方**——
① token 里的 `uid`（不是 email）；② 服务端读的 user doc；③ 服务端常量表。
从 `request.json()` 解构出来的任何东西都当敌意输入。

**落地检查**：给 `submit-order` / `confirm-order` 顶部的解构行加一条注释规范——
每个 body 字段后面注明「用途：展示 / 计价 / 权限」，凡是标了后两者的一律改成服务端取。

### 模式 2：状态机守卫散落在调用方，不在唯一入口
中招：P0-B（取消不看状态）、待复核的「复活」。

**规则**：每个状态转移的**合法前置状态**写在唯一一个函数里
（本项目已有成功先例：`cancelOrderWithRollback` 把三处回补收敛成一处）。
新增调用方不许自己判断状态。

**落地检查**：`orderRollback.ts` 顶部维护一张
`ALLOWED_TRANSITIONS: Record<from, to[]>` 表，所有改状态的地方过这张表。

### 模式 3：数字输入不归一化
中招：P0-C（负数量）、待复核的多条。

**规则**：**禁止裸写 `Number(x) || 0`**。所有从 body 来的数字过统一的
`posInt(v, max)` / `money(v)` 归一函数（负数、NaN、Infinity、超大值一律拒）。

**落地检查**：加个 lint 规则或 grep 检查——`Number(body.` 出现即人工复核。

### 模式 4：幂等靠「先读后写」而不是事务
中招：P1-D（铸券）、待复核的订阅建单 / 首次确认。

**规则**：**幂等键的读和写必须在同一个 `runTransaction` 里。**
只要存在「浏览器 + webhook」双路径，就一定会撞上并发窗口。

**落地检查**：Grep `await .*Ref.get()` 后面跟 `batch()` 的组合，逐个审。

### 模式 5：同一逻辑多份副本，修一处漏三处
中招：P1-C（多段订单券只挂第一段）、待复核的改单库存、dashboard 两副本。

**规则**：延续 `cancelOrderWithRollback` / `isDishOrderableOn` / `addonCreditMath`
的做法——**两端同源**，客户端和服务端跑同一个模块。

---

# 制度层（低成本、高回报）

1. **把这 11 条写成攻击回归脚本**。项目已有 `scripts/dogfood-*.mts` 惯例
   （`dogfood-order-rollback.mts`、`dogfood-dish-orderable.mts` 等）。
   新增 `scripts/dogfood-attack-suite.mts`：每条洞一个用例，**期望是被拒收**。
   改支付 / 餐券 / 库存代码后必跑。这样「修好了又被改回去」会立刻暴露。
2. **Firestore 规则改动 checklist**：往 `userSafeFields()` 加字段前必须回答
   「服务端会不会拿这个字段算钱或判权限？」——会 → 不许加。
3. **审计节奏改成「回归 + 增量」**：这次距上轮只有 7 天，5 条旧洞仍开着，
   说明问题不是发现不了，是**修复没排进日程**。建议把 P0/P1 直接进 `tasks/todo.md`
   当正式任务，而不是躺在审计报告里。
4. **部署前 `npm run build`**（已有教训，见 `tasks/lessons.md`）。
5. **Firebase Console 定期看一眼 Authentication → Users**，出现陌生的
   admin 邮箱账号立即删。

---

## 本轮检查过、确认没问题的部分 ✅

（发现阶段代理共列了 131 条 clean，以下是我自己也核过的）

- Razorpay 签名校验四处全部用 `crypto.timingSafeEqual` + 长度预检，写法正确。
- Webhook HMAC 走 `req.text()` 原始字节，没有 JSON 重序列化破坏签名。
- `create-order` 金额从订单 doc 服务端求和，不信客户端。
- `orders` 集合客户端只读不可写（[firestore.rules:74-78](../firestore.rules#L74)），
  下单必须走 `/api/submit-order`。
- `feedbacks` 只公开读 `status == 'APPROVED'`。
- `users` 的 `points/totalSpent/totalOrders/vouchersUsed` 不在客户端可写白名单里。
- `check-voucher` / `geocode` 的 Bearer + 双维度限流已生效。
- `cancelOrderWithRollback` 的事务重试处理正确（每次重试重置 `orderData`，
  注释里记录了「3 个并发取消全部获胜」的实测教训）。
