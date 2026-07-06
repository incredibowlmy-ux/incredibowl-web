# 配送实时跟踪系统 — 实施计划

> 状态：待老板确认后动工。
> 需求（老板 2026-07-06 确认）：客户免登录打开跟踪页，只看到 ① 订单状态时间轴 ② 司机在路上的实时位置地图。
> **不显示**队列位置/第几站/前面几单。约 8 单一趟批量配送。
> 成本：RM 0/月（现有 Firebase 免费额度 + Leaflet/OSM 免费地图，不用 Google Routes）。

## 设计决策（基于代码摸底）

1. **跟踪凭证 `trackToken`**：订单 doc ID 虽然是 20 位随机不可猜，但它同时是鉴权主体
   （confirm-order 等接口拿它当身份），不能放进 WhatsApp 明文链接。
   → submit-order 建单时生成独立 `trackToken`（16 位随机 base62）写入订单 doc，
   只用于跟踪查询，泄露也只能看状态+司机位置。
2. **客户端读取走服务端 API 轮询，不改 firestore.rules**：
   现规则 orders 只许本人读，匿名跟踪页读不了。开公共读规则风险大，
   → 新公开路由 `GET /api/track?token=xxx`（Admin SDK 读，只返回白名单字段），
   页面每 10 秒轮询。8 客户 × 90 分钟 ≈ 每趟 4,300 次函数调用 + ~8,600 Firestore 读/天，
   远在免费额度内（50k 读/天）。
3. **司机位置存独立集合 `deliveryBatches/{batchId}`**，不写订单 doc：
   `{ date, slot, orderIds[], status: 'active'|'completed', driverLoc: {lat,lng,ts}, startedAt, completedAt }`
   GPS 每 8-10 秒更新同一个 doc（90 分钟 ≈ 600 写/趟，免费额度 20k 写/天）。
   规则层不用动（catch-all admin-only 已覆盖，全部经 Admin SDK API 读写）。
4. **订单状态加 `delivering`（配送中）**：现有 union 是
   pending|confirmed|preparing|delivered|cancelled，缺「已出发」。
   改 `orders.ts:12` union + `confirm-order/route.ts:57` 白名单（admin only）+ Dashboard 状态标签/pill。
5. **地图 Leaflet + OpenStreetMap**：repo 现在零地图依赖，Leaflet 最轻（~42KB）、免费、无需信用卡。
   只在 /track 页动态加载，不影响首页性能。
   目的地标记：跟踪 API 顺带读 user doc 的 addressLat/Lng（已有字段）返回，地图显示「您的位置」+ 司机位置两个点。
6. **司机端 = 手机网页 `/driver`**，不做 App：admin 邮箱登录 gate，
   `navigator.geolocation.watchPosition` 节流 8-10 秒 → `POST /api/admin/driver-location`（Bearer admin）。
   页面同时列出本批订单，每单一个「✅ 已送达」大按钮 + 底部「结束配送」。
7. **不用 Google Routes API**：客户端不显示队列/ETA-per-stop，老板自己决定开车顺序，路线优化整个砍掉。
8. **Dashboard 双副本纪律**：所有 dashboard 改动改 Desktop 源
   （`C:\Users\User\Desktop\Incredibowl Services\incredibowl-dashboard.html`）再 `npm run sync:dashboard`。

## 客户看到的页面（/track/[token]）

- 顶部：订单号（后 6 位）+ 配送日期/时段
- 状态时间轴：已确认 → 备餐中 → 配送中 → 已送达（当前步高亮；cancelled 显示已取消）
- 状态为「配送中」时：出现地图卡片，司机图标实时移动 + 「您的位置」标记 + 「司机正在路上 🛵」
- 已送达：地图收起，显示「已送达，请享用！」
- 免登录，WhatsApp 链接直达；ZH 为主 + 关键字段小字 EN（不做独立 /en/track 树）

## 入口（客户怎么打开）

1. WhatsApp 确认消息末尾加一行「📍 跟踪订单: https://www.incredibowl.my/track/<token>」
   - `CartSuccess.tsx:25-32`（ZH 主流程）
   - `page.tsx:431-436`（ZH FPX 成功弹窗）
   - `en/page.tsx:419-423`（EN FPX 成功弹窗，英文文案）
   - 多日订单：每单一行各自链接
2. FPX/QR 成功弹窗本身加「跟踪订单」按钮
3. （后续可选）会员页订单列表加跟踪入口

## 阶段 1 — 状态时间轴跟踪页（先上线，立即有价值）

- [ ] `submit-order/route.ts`：生成 `trackToken` 写入订单，响应体返回（供 WA 链接用）
- [ ] `orders.ts`：OrderStatus 加 `'delivering'`；OrderData 加 `trackToken?`、`batchId?`
- [ ] 新路由 `GET /api/track?token=`：按 trackToken 查订单（需 Firestore 单字段索引，
      Admin SDK 查询自动可用），返回白名单：{orderNo(后6位), status, deliveryDate, deliveryTime,
      items 菜名+数量, batch 司机位置(阶段2), destLat/Lng}。查无此 token → 404
- [ ] 新页面 `src/app/track/[token]/page.tsx` + `TrackClient.tsx`
      （repo 首个动态路由；照 order/page.tsx 的 server wrapper + Client 拆分；noindex）
- [ ] 3 处 WhatsApp 消息 + 成功弹窗加跟踪链接（ZH×2 + EN×1）
- [ ] `confirm-order/route.ts:57`：status 白名单加 `delivering`（admin only）
- [ ] Dashboard（Desktop 源）：状态下拉/标签/pill 加「配送中 delivering」→ sync:dashboard
- [ ] 验证：tsc + 本地 dogfood 下单 → 拿链接开跟踪页 → dashboard 改状态 → 页面 10 秒内跟着变

## 阶段 2 — 批次配送 + 司机 GPS 地图

- [ ] 新集合 `deliveryBatches`（结构见上）
- [ ] `POST /api/admin/delivery-batch`（verifyAdmin）：
      - action=start：入参 orderIds[] → 建 batch doc、订单批量 set {status:'delivering', batchId}、
        给缺 trackToken 的手动单补发 token → 返回 batchId
      - action=complete：batch 标记 completed、清 driverLoc
- [ ] `POST /api/admin/driver-location`（verifyAdmin）：{batchId, lat, lng} → 更新 batch.driverLoc
- [ ] `POST /api/admin/deliver-order`（verifyAdmin）：{orderId} → status='delivered'；
      batch 内全部送达 → 自动 complete
- [ ] 司机页 `/driver`：admin 登录 gate → 显示当前 active batch 订单列表（地址+电话+WhatsApp 快捷键）
      → watchPosition 节流上报 → 每单「✅ 已送达」→「结束配送」
      （屏幕保持常亮 wakeLock，页面切后台 GPS 会停的局限写清楚给老板）
- [ ] Dashboard（Desktop 源）topbar（~:1217 按钮群）加「🛵 开始配送」按钮：
      弹窗列今天该时段 confirmed/preparing 订单，勾选（默认全选）→ callAdminAPI 建批次
      → 显示「在手机打开 incredibowl.my/driver」→ sync:dashboard
- [ ] /track 页：status=delivering 且 batch 有 driverLoc → 动态加载 Leaflet 地图
      （npm i leaflet；OSM 瓦片；司机 marker + 目的地 marker；10 秒轮询平移）
- [ ] 验证：本地模拟一批 3 单 → driver 页假坐标上报 → 3 个跟踪页各自只见自己状态+司机点
      → 逐单送达 → 批次自动完结；tsc 全绿

## 明确不做（防 scope creep）

- ❌ 队列位置/第几站/前面几单（老板明确不要）
- ❌ Google Routes 路线优化 / 逐站 ETA
- ❌ 司机 App / 推送通知
- ❌ firestore.rules 改动（全走 Admin SDK API）
- ❌ 独立 /en/track 组件树

## 风险与局限（提前说清）

- 司机页锁屏/切后台，浏览器会停 GPS 上报 → 地图上司机点会冻结（状态时间轴不受影响）。
  缓解：wakeLock + 老板把手机架在车上保持亮屏。这是网页方案 vs 原生 App 的固有差距。
- OSM 免费瓦片有公平使用政策，你们的量级完全没问题；将来若流量大 10 倍再换付费瓦片源。
- 跟踪链接不过期：送达后页面永远显示「已送达」。token 只暴露状态+送餐当时司机位置，风险可接受。

## 部署纪律

- 遵守「push 前必须先验证」：tsc + 本地 dogfood 全过才 commit。
- 阶段 1、阶段 2 分开 commit、分开部署；避开用餐高峰 push，push 后线上 smoke check。
