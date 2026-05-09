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
