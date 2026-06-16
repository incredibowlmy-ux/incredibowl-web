# 订单确认消息自动化

## 背景 / 痛点
老板每次收到付款后，手动打一条格式化的 WhatsApp 确认消息发给客户（又长又容易算错）。
两种下单渠道：① 网站（QR / Curlec）② WhatsApp（多为 QR）。

## 决策（已和老板对齐）
- 保留个人 DuitNow / 转账 → 收款没有系统信号 → 「收到钱自动发」做不到 → **人工看截图把关保留**。
- 真正能自动化的是「**手打确认消息**」这件苦差。
- WA 接法（官方 / 非官方）暂不决定 → phase 3 先停。

## Phase 1（本次）：dashboard「一键确认消息」按钮
最近订单每张卡片加一个按钮：点了 → 用订单数据生成那条格式消息 → 生成 `wa.me/<电话>?text=...` 一键发 + 复制到剪贴板。
覆盖网站订单 + 手录订单。免费、零审批、零封号风险。

### 任务
- [x] 读 orders.ts 确认字段（name=中文 / nameEn=英文 / items / addOns 两种存法 / total / deliveryFee / deliveryDate / deliveryTime / mealType / userPhone / userAddress）
- [x] 读 dashboard 卡片渲染 + 委托点击 + 确认两份副本结构一致
- [x] 写 `buildConfirmMessage(order)` + `waPhone()`（电话归一化 0→60）
- [x] 卡片加 `.confirm-msg-btn`（网站单 + 手录单都加）
- [x] 委托点击：生成消息 → 开 wa.me + 复制剪贴板 + toast
- [x] WhatsApp 绿 hover 样式
- [x] 两份副本同步改（public/dashboard-h7x2q9.html + Desktop/Incredibowl Services/incredibowl-dashboard.html，各 6 处标记一致）
- [x] node 测试断言生成结果 = 老板示例消息（逐字一致 + 电话归一化全过）

## Phase 2（下一步，依赖 phase 1）：n8n 自动录单
WA 订单 → n8n → Claude 解析 → POST `/api/n8n/create-order`（找/建客户 + 写 pending 订单）→ dashboard 自动显示 → 老板扫一眼复核 → 点 phase 1 按钮发确认。人工复核保留。本次不做。

## Phase 3（更远）：真全自动收款触发
换网关动态 QR + 支付 webhook（顺手补 FPX pending 洞）→ 线上电子钱包付款可「收到钱自动发」。依赖老板愿意换网关 QR。

## Review
- 改动：每张订单卡片左侧加 🟢 聊天气泡按钮 → 点了用订单数据生成那条确认消息 → 开 `wa.me/<电话>` 预填消息 + 复制到剪贴板 + toast。
- 兼容两种加料存法（网站单的 `↳` 拍平行 / 手录单的嵌套 `it.addOns`）；中英双名「English 中文」；餐券/优惠折扣行按需出现；免运显示 FREE 🎉。
- 客户实付 = `total`（已扣餐券/优惠）+ `deliveryFee`。
- 落款人 = 文件里 `CONFIRM_SENDER='Wei Ting'` 常量，换人改一处即可。
- 验证：`node scripts/test-confirm-message.mjs` → 生成结果与老板示例**逐字一致**；电话归一化 5 例全过。
- 风险：低。纯前端、复用现有按钮/委托点击套路；clipboard 在 file:// 可能被拦但已 try/catch，wa.me 仍正常开。
- 未做（按老板决定）：phase 2 n8n 自动录单、phase 3 网关 QR 自动收款触发。
- 待老板拍板：落款人是否固定 Wei Ting；`deliveryTime` 线上存的是 slot（如 "12:00 PM"）还是 "Lunch"，影响「Delivery at …」那行显示——发前可在 WhatsApp 里改。
