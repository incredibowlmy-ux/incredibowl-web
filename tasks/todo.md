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
