# Meta Conversions API (CAPI) 设置指南

> **目的**：让 Pixel 数据完整 — 服务器端事件补浏览器端被广告拦截 / iOS ATT 丢失的 ~30%。Meta 自己说装了之后 cost per result 中位数下降 **26.9%**。

实施日期：2026-05-10  
代码改动范围：[src/lib/meta-capi.ts](../src/lib/meta-capi.ts) (新) · [src/app/api/submit-order/route.ts](../src/app/api/submit-order/route.ts) · [src/app/api/confirm-order/route.ts](../src/app/api/confirm-order/route.ts) · [src/components/cart/CartDrawer.tsx](../src/components/cart/CartDrawer.tsx) · [src/components/cart/CartSuccess.tsx](../src/components/cart/CartSuccess.tsx)

---

## 架构

| 事件 | 触发点（server） | 触发点（browser） | 去重 eventID |
|---|---|---|---|
| **InitiateCheckout** | `/api/submit-order` 创建 pending 订单后 | `CartDrawer.handleCheckout` submit-order 成功 | `ic_{groupId or orderId}` |
| **Purchase** | `/api/confirm-order` 状态首次转 `confirmed` | `CartDrawer` confirm-order 成功（仅 FPX） | `purchase_{orderId}`（一单一个）|

**QR 流程的 Purchase**：客户上传截图后订单是 `pending`，**不会**前端发 Purchase（之前会，是误报）。Admin 在管理后台改成 `confirmed` → confirm-order 路由触发 server-side Purchase（无浏览器配对，纯 CAPI）。

---

## 启动步骤（5 分钟）

### 1. 拿 Access Token

```
1. 打开 business.facebook.com/events_manager2
2. 选 "Incredibowl Events Manager" Pixel (ID 762982966692354)
3. 顶部 tab → Settings
4. 滑到 "Conversions API" section
5. 点 "Set up manually" / "Generate access token"
6. 复制弹出的 EAA 开头长字符串
   ⚠️ 只显示一次，立即存到密码管理器
```

### 2. 写入环境变量

**本地** — 编辑 [.env.local](../.env.local)：

```bash
META_CAPI_ACCESS_TOKEN=EAAxxxxxxx...你刚拿的
META_CAPI_TEST_EVENT_CODE=TEST12345    # ← 测试期间用，上线删
```

**生产**（Vercel / 部署平台）：
- Vercel Dashboard → Project → Settings → Environment Variables
- 加 `META_PIXEL_ID` = `762982966692354`
- 加 `META_CAPI_ACCESS_TOKEN` = `EAA...`（敏感，标记 Secret）
- ⚠️ **不要**加 `META_CAPI_TEST_EVENT_CODE` 到 prod，那只用在 Events Manager 测试模式

### 3. 重启 dev server / 重新部署

```bash
npm run dev   # 本地
# 或
git push      # Vercel auto-deploy
```

### 4. 验证 — Test Events 模式（强烈建议先做这步）

1. 在 [.env.local](../.env.local) 设 `META_CAPI_TEST_EVENT_CODE=TEST12345` 重启 dev server
2. 打开 `business.facebook.com/events_manager2` → 你的 Pixel → **Test Events** tab
3. Test Event Code 输入框填 `TEST12345`
4. 在 [http://localhost:3000](http://localhost:3000)（带 Test Code 的环境）走完整下单流程：
   - 加菜到购物车
   - 点结账 → 期待看到 `InitiateCheckout` 在 Test Events 出现 **2 次**：
     - 一次 source=Browser（来自 Pixel）
     - 一次 source=Server（来自 CAPI）
     - **Deduplication 列显示 "Match"** ✅ = 配对成功
   - 完成 FPX 支付 → 期待 `Purchase` 同样去重成功
5. 全部 Match → 把 `META_CAPI_TEST_EVENT_CODE` 从 .env.local 删掉，重启
6. 部署 prod（**不带** TEST_EVENT_CODE）

### 5. Production 验证（24h 后）

```
Events Manager → Overview
- Total events 跳升 ≈ 1.5-2× （因为现在每个事件都成对发了）
- Pixel "26.9% lower cost" 提示卡片应该消失
- Diagnostics tab → 不应有 "deduplication issue" 警告
```

---

## 数据流图

```
客户走完支付的某一刻
      │
      ├──▶ 浏览器 Pixel (fbq)
      │     ├─ event_id = "ic_GRP-XXX"
      │     └─ 上报到 Meta（不可靠，可能被 ad-blocker 干掉）
      │
      └──▶ Next.js API (POST /api/submit-order)
            ├─ 验证 + 写 Firestore
            ├─ sendCapiEvent({ eventId: "ic_GRP-XXX", ... })
            │     └─ POST graph.facebook.com/v21.0/{pixelId}/events
            └─ return { ..., checkoutEventId: "ic_GRP-XXX" }
                                            │
Meta 收到两条 event_id 一致的事件 ─── 去重 ───▶ 只算 1 次（用服务器值）
```

---

## 数据质量 — 用户匹配字段

服务器端发送时已 SHA-256 哈希以下字段（依存在与否）：

| 字段 | 来源 | 优先级 |
|---|---|---|
| `em` (email) | 订单 `userEmail` | 高 |
| `ph` (phone) | 订单 `userPhone` → 自动转 60xxx 格式 | 高 |
| `external_id` | Firebase UID | 中 |
| `client_ip_address` | x-forwarded-for header | 高 |
| `client_user_agent` | UA header | 高 |
| `fbp`, `fbc` | _fbp, _fbc cookies | **关键**（决定是否能配对到广告点击）|

EMQ (Event Match Quality) 应该 ≥ 7.0 才算健康。Events Manager → Diagnostics 可看每个事件的 EMQ 评分。

---

## 故障排查

### "Server" 列没事件出现
- 检查 token 是否正确（去 Events Manager → Settings → Conversions API 重新看）
- 检查 dev server log，应该看到 `[CAPI] InitiateCheckout (ic_xxx) → 200` 或类似
- 如果看到 401/403 → token 错或权限不够，重新生成

### 出现 2 次但 Deduplication = "No match"
- 100% 是 event_id 没对上
- 检查 Network tab：`/api/submit-order` 响应应该有 `checkoutEventId`
- 检查 fbq 调用：浏览器 console 跑 `fbq.queue` 看最近事件，event_id 应该跟服务器一致

### EMQ 很低（< 5）
- 大概率 fbp/fbc cookie 没传
- 看 [src/lib/meta-capi.ts](../src/lib/meta-capi.ts) 的 `extractRequestContext` — 如果客户禁用 cookie 那也没办法
- 提高 EMQ：让用户登录后 email 一定有，phone 也有

### 客户在隐私模式下下单
- fbp/fbc 没有 → 匹配靠 IP + UA + email/phone hash
- EMQ 会低但仍然会上报，FB 会尽力匹配

---

## 回滚

如果出问题想立即关掉 CAPI（不影响下单）：

```bash
# 把 .env 里的 token 清空 → 服务器端会 silent skip
META_CAPI_ACCESS_TOKEN=
```

Pixel 浏览器端继续正常工作，只是少了服务器补偿。代码不需要改。

---

## 安全清单

- [x] `META_CAPI_ACCESS_TOKEN` **没有** `NEXT_PUBLIC_` 前缀（确认 server-side only）
- [x] token 不在代码里硬编码
- [x] CAPI 失败不阻塞下单流程（`void sendCapiEvent(...)` 不 await）
- [x] Email/phone 在发送前 SHA-256 哈希
- [x] 部署平台环境变量标记为 Secret

---

## 改动文件总览

```
新增:
  src/lib/meta-capi.ts                 ← CAPI 工具函数

修改:
  src/app/api/submit-order/route.ts    ← 加 InitiateCheckout, 返回 checkoutEventId
  src/app/api/confirm-order/route.ts   ← 加 Purchase, 返回 purchaseEventIds
  src/components/cart/CartDrawer.tsx   ← 用 eventID 去重 fbq 调用
  src/components/cart/CartSuccess.tsx  ← 移除冗余的 fbq Purchase
  .env.local                           ← 加 META_CAPI_* 三个变量
```
