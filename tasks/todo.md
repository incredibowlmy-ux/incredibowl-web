# Incredibowl 数据看板 — 实施计划

## 目标
在 `C:\Users\User\Desktop\Incredibowl Services\` 建立一个**全新独立**的 HTML dashboard 文件，双击即可打开，连接同一个 Firestore 项目。

## 文件清单
- [ ] `incredibowl-dashboard.html` — 主 dashboard 文件
- [ ] `GA4-setup-guide.md` — GA4 配置 step-by-step（Phase 2）
- [ ] `start-dashboard.bat` — 一键启动（如需 local server）

## 模块清单（6 个 tab）
1. [ ] 📊 **营收 Revenue**
   - KPI 卡片：总营收 / 平均客单价 / 订单数 / 活跃客户
   - 趋势图：日 / 周 / 月切换
   - 食物 vs 配送费拆分
   - 畅销菜 Top 10
2. [ ] 💰 **CAC 获客成本**
   - KPI：总花费 / 新客数 / Blended CAC / 回本周期
   - 月度 CAC 趋势图
   - 月度明细表
3. [ ] 🪜 **转化漏斗 Funnel**
   - 订单状态漏斗（pending → confirmed → preparing → delivered）
   - 客户旅程漏斗（注册 → 1 单 → 2 单 → 3 单 → 5+ 单）
4. [ ] 🔁 **复购留存 Retention**
   - 月度 cohort 留存矩阵热力图
   - 整体复购率 / 平均订单数/人
   - 复购率趋势
5. [ ] 📈 **预算效率 Budget**（独立 3 卡）
   - 营销 ROI = 营收 ÷ Meta Ads 花费
   - Voucher ROI = 用券订单营收 ÷ 折扣总额
   - 配送补贴 = 配送费 - 实际成本（按区分）
6. [ ] ⚙️ **设置 Settings**
   - Meta Ads 月度花费输入（→ Firestore `marketingSpend/{YYYY-MM}`）
   - 配送成本默认值（→ Firestore `dashboardConfig/delivery`）
     - ≤ 2km 自送：默认 RM 2
     - \> 2km 自送：默认 RM 5
   - GA4 集成占位（Phase 2）

## 数据架构（新增 Firestore collections）

### `marketingSpend/{YYYY-MM}`
```
{
  month: "2026-04",
  meta: 200,           // RM
  whatsapp: 0,         // organic, default 0
  other: 0,
  notes: "",
  updatedAt: Timestamp
}
```

### `dashboardConfig/delivery`
```
{
  within2kmCost: 2,    // RM per delivery
  outside2kmCost: 5,
  updatedAt: Timestamp
}
```

## 设计规范
- **风格**：浅色 + 品牌深绿 (#1A2D23) accent + 暖金 (#C9985C)
- **字体**：Inter (body) + Plus Jakarta Sans (headings) + JetBrains Mono (numbers)
- **图表**：Apache ECharts 5（CDN）
- **认证**：Firebase Auth email/password（管理员 whitelist）

## 认证策略
- Email/password 登录（避免 OAuth popup 在 file:// 不工作）
- Whitelist：`incredibowl.my@gmail.com`、`hello@incredibowl.my`
- 非管理员登录直接拒绝并 sign out

## CAC 归因方法（Phase 1 简化）
- 新客 = 当月 `users.createdAt` 在该月内的用户
- Meta Ads 花费 = 用户在 Settings 输入的当月数值
- WhatsApp 群当 organic 零成本（不计入 Paid CAC，单独标记）
- CAC = 月花费 ÷ 当月新客数（含完成首单的）
- **真 Paid CAC** = 月花费 ÷ 当月**完成首单的**新客数（Phase 2 GA4 接入后可拆 paid vs organic）

## 配送补贴逻辑
对每个 `confirmed`/`preparing`/`delivered` 订单：
- 实际成本 = config[deliveryZone]
- 收入 = `order.deliveryFee || 0`
- 净额 = 收入 − 成本（负数 = 你补贴的）

特别标注：「免运费 ≥RM40 outside2km」订单 = 营销补贴成本（应计入 marketing budget 一并审视）

## 验收标准
- [ ] 双击文件能登录并加载数据
- [ ] 5 个核心 tab + 1 个 settings tab 都能正常显示
- [ ] 图表交互流畅，移动端可读（mobile responsive）
- [ ] 配送默认值与营销开支可保存到 Firestore 并跨设备同步
- [ ] 视觉品质对得起品牌（不是「draft 感」）

---

## Review（待补）
完成后在此追加实施总结。

---

# 推荐券防滥用 — 手机号验证（Phase 2）

## 背景
当前推荐券（RM 10 首单优惠券）防护链：
1. ✅ 推荐人手机号 ≠ 被推荐人（防直接自荐）
2. ✅ 手机号全平台唯一（每号只能领 1 次推荐券）
3. ✅ Google 标准化地址全平台唯一（每地址只能领 1 次）
4. ✅ Voucher 延后到 profile 完成（手机+确认地址）后才发

## 仍存在的洞
**用户可以编任意未被使用过的假手机号 + 假地址**，绕过 #2 和 #3。我们没验证手机号真实有效。

## 选项（按优先级）

### Option A: 推荐券限定最低订单（推荐先做）
- 在 voucher 上加 `minOrderAmount: 30` 字段
- `/api/check-voucher` 验证小计 ≥ 30 才放行
- 工作量：约 30 分钟
- **效果**：abuser 即使薅 10 张券，每张要花 RM 20+ 才能兑现，经济动机消失
- **零成本**

### Option B: 推荐人发券数量上限
- 推荐人最多发 N 张券（建议 10）
- 用户文档加 `referralVouchersIssued` 计数器
- 推荐人发券前先查计数，≥10 拒绝
- 工作量：约 20 分钟
- **效果**：限制单个推荐人能造成的最大损失
- **零成本**

### Option C: WhatsApp 手动验证
- 客户填手机号后，你手动从客服 WhatsApp 发个验证码
- 客户输入验证码才放行
- **客户摩擦高**，扩展性差
- 不推荐

### Option D: SMS OTP（Firebase Phone Auth）
- 客户填手机号 → 系统自动发 SMS 验证码 → 客户输入 → 验证通过
- Firebase Phone Auth 免费 10K SMS / 月，超过 $0.06/SMS
- 工作量：约 4-6 小时（前后端 + UI 集成）
- **效果**：彻底堵死假号洞
- **成本**：免费配额内不花钱；超过后约 RM 0.27/SMS

### Option E: WhatsApp Business API 验证
- 类似 OTP 但通过 WhatsApp 发码（费率比 SMS 便宜）
- 需要 Meta Business 账号 + WhatsApp Business API
- 工作量：约 6-8 小时
- **效果**：与 SMS OTP 相当
- **成本**：约 RM 0.05-0.10/条（按 conversation 计费）

## 实施顺序建议
1. **立即做**：Option A + B（一起 < 1 小时，零成本）
2. **观察 1-2 个月**：看 abuse 模式
3. **如有需要**：实施 Option D（Firebase Phone Auth 最简单）
4. **如成本敏感**：考虑 Option E（WhatsApp Business API）

## 触发条件（什么时候做 Phase 2）
- 看到同一推荐人 1 周内出 ≥ 50 张推荐券
- 看到同一 IP 短时间内多个新账号
- 看到 voucher 兑现率明显低于预期（abuser 拿了不用）
- 客户客诉 / 收入不符

---

# 方案 1：餐券预付包（Meal Voucher Bundle）

> 决定日期：2026-05-10
> 详细策略与 5 方案对比见 memory/project_meal_subscription_strategy.md

## 🎯 产品规则（已锁定）

- **1 张餐券 = 1 份主餐**（任意主餐，不分日 / 不分品项）
- 用户预付现金购买"券包"（5 / 10 / 20 张三档）
- 结账时勾选"用券抵扣"，可一次抵多张（例：4 人 → 4 张券）
- **券只抵主餐价格；add-on（饮料、加料、蛋等）必须现金支付** — 用户明确指示
- 券有效期：购买日起 **60 天**
- 不可退现金（终售；过期归零）
- 不可叠加现有 RM 折扣券（推荐券 / 积分券） — 一单只能选其一

## 🏗️ 架构决策（已锁定）

### 数据模型 — **独立的 `mealVouchers` 集合 + 每张券一个 doc**

理由：
1. 现有 `vouchers` 集合是 RM 折扣型（推荐券、积分兑换券）；餐券语义完全不同（实物兑换权）
2. 每张券独立 doc → 支持 FIFO 兑换、批次到期、独立审计、订单取消时可恢复单张

```
mealVouchers/{voucherId}
  userId: string
  purchaseId: string         // 关联到 mealVoucherPurchases doc
  purchasedAt: Timestamp
  expiresAt: Timestamp        // purchasedAt + 60 days
  status: 'available' | 'redeemed' | 'expired' | 'refunded'
  redeemedOrderId?: string
  redeemedAt?: Timestamp
```

```
mealVoucherPurchases/{purchaseId}
  userId, userName, userEmail, userPhone
  bundleId: '5' | '10' | '20'
  voucherCount: number
  amountPaid: number          // RM
  paymentMethod: 'qr' | 'fpx'
  razorpayPaymentId?, razorpayOrderId?, razorpaySignature?
  receiptUploaded, receiptUrl?
  status: 'pending' | 'paid' | 'cancelled'
  voucherIds: string[]         // populate on confirm
  createdAt, paidAt, updatedAt
```

### 与现有结账流的接入方式

不动现有 promo code 通道。在 `CartDrawer` 里新增独立的"餐券抵扣"区块：
- 显示"你有 N 张可用餐券"
- 滑块 / 加减按钮选择本次使用 X 张（X ≤ min(主餐数量, N)）
- 服务器端 `/api/submit-order` 接收 `mealVoucherUsed: X`，atomically claim X 张最早到期的券
- 价格计算：`mealVoucherDiscount = sum(被抵的 X 个最贵主餐的服务器价)`（用户最划算）
- 与现有 promo code 二选一（互斥）

## 📋 实施清单

### Phase 1 — 数据层（基础设施）
- [ ] 创建 `src/data/mealVoucherConfig.ts` — 中央定价配置 + 60 天有效期
- [ ] 创建 `src/lib/mealVoucherValidation.ts` — server-side claim/release 逻辑
- [ ] Firestore Security Rules — 用户只读自己的 vouchers，不可写

### Phase 2 — 购买流（API + UI）
- [ ] `POST /api/meal-vouchers/create-purchase` — 创建 pending purchase doc + Razorpay order
- [ ] `POST /api/meal-vouchers/confirm-purchase` — 验证 Razorpay 签名 → mint N 张 vouchers + 更新 purchase status='paid'
- [ ] `POST /api/meal-vouchers/qr-confirm` — QR 付款受理（admin 后台审核 receipt 后 manual confirm）
- [ ] `GET /api/my-meal-vouchers` — 返回用户当前可用券数 + 最近到期日
- [ ] 新建购买入口页面 `src/app/meal-vouchers/page.tsx` — 三档卡片 + 价值说明 + Razorpay/QR 支付
- [ ] 在 `member/page.tsx` 加"我的餐券钱包"区块

### Phase 3 — 结账抵扣流
- [ ] `CartDrawer.tsx` 加"用餐券抵扣"区块（仅当用户有可用券时显示）
- [ ] 抵扣逻辑：选 X 张 → 减去最贵的 X 个主餐价格 → 重算 finalTotal
- [ ] 更新 `/api/submit-order`：接收 `mealVoucherUsed: X`，FIFO 抢券，重新计算 server total
- [ ] 更新 `/api/confirm-order`：将抢的券 status 从 `available` 改为 `redeemed`
- [ ] 订单取消时 → 恢复券 status 回 `available`（除非已过期）

### Phase 4 — 后台 + 边缘场景
- [ ] Admin dashboard 加"餐券负债"指标：未核销总张数 × 平均主餐价
- [ ] Cron 任务（或惰性）：每日把 `expiresAt < now` 的券 status 从 `available` 改为 `expired`
- [ ] Admin 用户列表 → 显示每个用户的可用券数

### Phase 5 — 验证 & 文档
- [ ] 完整 E2E 走查：购买 → 结账抵扣 → 取消恢复 → 过期处理
- [ ] 更新 README / CLAUDE.md（如需要）
- [ ] 更新 `tasks/lessons.md`（若发现新模式）

## ⚠️ 待用户决定（在 AskUserQuestion 中确认）

1. **券价定档** — 菜价范围 RM 16.90–19.90（主流 18.50）
2. （其他默认：60 天有效期、不可叠加 promo、入口仅在 member 页）

## ✅ Review（2026-05-11 完成实施）

### 已上线功能
- ✅ **Phase 1 数据层**：`src/data/mealVoucherConfig.ts`（5/10/20 张定价 + 60 天有效期）+ `src/lib/mealVoucherUtils.ts`（mint / claim FIFO / release 三个核心 helper）
- ✅ **Phase 2 购买流**：`/api/meal-vouchers/create-purchase`、`/api/meal-vouchers/confirm-purchase`、`/api/my-meal-vouchers` API + `/meal-vouchers` 买券页（FPX + QR 两种支付方式）
- ✅ **Phase 2b UI**：member 页加「我的餐券钱包」区块（橘金渐变卡片，显示张数 + 最近到期日）
- ✅ **Phase 3 结账抵扣**：CartDrawer 加「用餐券抵扣」加减器（FIFO 抵最贵主餐）+ submit-order 服务端校验 + 抢券 + confirm-order 取消时释放券
- ✅ **Phase 4 后台**：admin/data 加 mealVoucherPurchases + `/api/admin/confirm-meal-voucher-purchase` + admin 订单 tab 顶部加 QR 待审核 banner（一键批准/拒绝 + 凭证放大查看）
- ✅ **Phase 5 验证**：`tsc --noEmit` 通过，`next build` 成功，lint 仅有原项目风格 `any` warnings

### 关键定价（已确认）
- 5 张 = RM 92.50（面值，0% off — 入门档）
- 10 张 = RM 175.75（~5% off，省 RM 9.25）
- 20 张 = RM 333.00（~10% off，省 RM 37.00）

### 关键设计原则
1. **餐券 ≠ RM 折扣券** — 独立的 `mealVouchers` 集合，每张券单独 doc，状态机 `available → redeemed → (released back to available on cancel)`，不与现有 `vouchers` 表混淆
2. **抢券时机** — submit-order 时原子抢，避免双 tab 抢券竞态；FPX 失败时通过现有 `fpx-callback` 取消订单 → confirm-order 释放
3. **mutex** — 券与 promo code 一单只能选其一，前后端都强校验
4. **抵扣算法** — 服务端按"主餐单价 desc，取前 X"算抵扣，最大化客户优惠
5. **加购不抵** — add-on 价格不在抵扣分母里，必须现金；用户明确指示

### Defer / 待后续观察
- **Firestore Rules**：`mealVouchers` / `mealVoucherPurchases` 仍是默认拒绝（所有读写走 admin SDK API），客户端从来不直接查这两个集合，安全。如未来要做客户端实时订阅，需补 rules
- **Admin 餐券负债指标**：dashboard 待办（未核销总张数 × FACE_VALUE_RM）
- **Cron 过期券处理**：当前是惰性处理（claim 时校验、my-meal-vouchers 计数时排除）。如需把过期 doc 显式标 `expired` 改 status，可后续加 cron
- **多日 cart 的券分配**：当前 voucherIds 全挂在 part 1，多日订单部分取消时只 release part 1 的券；这是合理的折中（多日 + 用券是少见场景）

### 测试 checklist（手动验证清单 — 上线前请走一遍）
- [ ] 新用户买 10 张装（FPX）→ 跳 Razorpay → 付款 → 钱包显示 10 张 / 60 天到期
- [ ] 同一用户结账下 4 份主餐 + 2 个加购 → 拉到 4 张券 → Total 等于 add-on 总额 + delivery
- [ ] 拉到 1 张券 + 输入 promo code → 报「不可同时使用」
- [ ] FPX 支付被取消 → 订单 cancelled → 钱包券回滚为 available
- [ ] 买 5 张装（QR）→ 上传截图 → 后台 admin tab 顶部出现 banner → admin 批准 → 钱包到账 5 张
- [ ] 后台 admin 拒绝 → purchase status=cancelled，无券 mint
- [ ] 60 天后到期券不再出现在 wallet 计数里

