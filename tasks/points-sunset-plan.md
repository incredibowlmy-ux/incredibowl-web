# 积分系统下线计划 (Points System Sunset)

**决策日期：** 2026-05-17
**目标：** 用餐券预付包（5/10/20）取代积分制度。所有现有积分余额一次性转成永久 RM voucher。

---

## 决策摘要

| 项目 | 决策 |
|------|------|
| 何时停止赚取 | **立即**（避免余额漂移） |
| 推荐奖励 | 从 50 积分 → **RM 5 voucher**（推荐人收） |
| 取整规则 | `Math.ceil(points / 10)` — 永远向上，绝不亏客户。例：237 分→RM 24, 222 分→RM 23 |
| Code 格式 | `LP[NAME][RM]` — 例：`LPALICE24`（全英文，无重名，无需后缀） |
| Voucher 期限 | **永久**（不设 `expiresAt`） |
| 最低消费 | 无 |
| 适用菜品 | 全部 |
| 排除账户 | Tommy（admin）+ 任何 admin/test 账户 |

---

## Phase 1 — 现在（发 WhatsApp 之前必须完成）

### 代码改动
- [x] `src/app/api/confirm-order/route.ts:94` — 移除 `points: FieldValue.increment(...)`（停止订单返积分）
- [x] `src/app/api/confirm-order/route.ts:122-131` — 推荐人 50 积分 → mint RM 5 voucher（transaction-safe，永久有效）
- [x] `src/app/member/MemberView.tsx` — 兑换按钮禁用 + 通知文案「积分已转换为永久 voucher，请查 WhatsApp」
- [x] `src/app/member/dict.ts` — 新增 ZH + EN 通知文案

### 报告（admin 只读工具 — 2026-05-18 改版）
**改版原因**：老板要逐个判断、自己手动 WhatsApp + 自己手动建 voucher。工具改成纯报告，**不自动写 Firestore**。

- [x] API 路由 `src/app/api/admin/migrate-points/route.ts`（POST，admin email 守卫）— 只读，返回所有 points>0 客户 + 建议 RM + 建议 code + 现成 WhatsApp 文案
- [x] Admin UI `src/app/admin/migrate-points/page.tsx` — 报告表 + 每行「复制 WhatsApp」按钮 + 导出 CSV/JSON
- [x] `users.points` 字段**不会**被修改（保留余额做审计）
- [ ] **老板执行**（每次需要时都可重复跑）：
  - 步骤 1：访问 https://www.incredibowl.my/admin/migrate-points（admin email 登录）
  - 步骤 2：看报告表，每行有姓名 / 电话 / 积分 / 建议 RM / 建议 code（`LP[NAME][RM]`）
  - 步骤 3：要给客户 voucher → 到 `/admin` Vouchers tab 用 custom voucher 表单**手动创建**这个 code（discount = 报告里的 RM）
  - 步骤 4：回到本页点「复制 WhatsApp」→ 贴到客户 WhatsApp 发出去
  - 步骤 5：客户结账时输入 code，存在的就生效

---

## Phase 2 — 5月31日（积分系统正式下线那天）

### UI 清理（ZH + EN 都要改）
- [ ] `src/components/auth/AuthProfileView.tsx` — 移除个人页积分显示 + 推荐码积分文案（line ~125, 132, 261）
- [ ] `src/components/auth/AuthModal.tsx:266` — 移除注册框底部「赚积分」宣传
- [ ] `src/app/member/MemberView.tsx`：
  - 移除「我的积分」区块（progress bar、redeem 按钮、阈值文案）
  - 移除「推荐统计」中的 `pointsEarned` 卡片（line ~849）— 改成显示推荐 voucher 数量
- [ ] `src/app/member/dict.ts` — 删除 ZH + EN 的积分相关 keys：`myPoints`、`pointsNeedMore`、`pointsThresholdReached`、`redeemNow`、`redeeming`、`redeemSuccess`、`redeemFailed`、`pointsAfterRedeem`、`pointsThresholdSubtitle`、`pointsEarned` 等
- [ ] 检查 `src/app/page.tsx` / landing page 是否有「下单赚积分」之类的营销文案，全部移除

### Backend 清理
- [ ] 删除 `src/app/api/redeem-points/route.ts`（整个文件）
- [ ] 删除 `src/app/api/admin/migrate-points/route.ts`（一次性迁移 endpoint，跑完就删）
- [ ] 删除 `src/app/admin/migrate-points/page.tsx`（对应的 admin UI 页面）
- [ ] `src/app/api/confirm-order/route.ts` — 删除 Phase 1 留下的「已移除积分赚取」注释，让代码彻底干净
- [ ] 检查 `src/app/admin/page.tsx` 是否还显示积分余额列，移除
- [ ] 检查 `src/lib/orders.ts` / firestore schema 注释是否还提到 `points`，更新

### 数据
- [ ] 用 Firestore console 跑一次 query 确认 `users.points` 全部 ≤ 0（Phase 1 应该已经归零）
- [ ] **不要**删 `users.points` 字段（保留审计），但确认没人读它了
- [ ] **不要**删旧的 `vouchers` doc（POINTS-XXX、LP-XXX）— 客户还要用

### 验证
- [ ] 跑 `next build` 确认没有死代码导致 import 错误
- [ ] 浏览器测一遍：注册 / 下单 / member 页 / admin 页，确认完全没有积分字眼
- [ ] WhatsApp 客户通知「积分系统已下线，所有 voucher 仍然永久有效」（可选，看 5/31 当天情况）

---

## 不在范围内 (Out of Scope)
- ❌ 不动 `mealVouchers` 集合（餐券预付包系统独立运行）
- ❌ 不动旧的 referral voucher 流程（新客户首次注册的 RM 10 voucher 保留）
- ❌ 不删 `users.points` 字段（审计需要）

## 相关文件参考
- `src/lib/voucherValidation.ts:88` — 已确认：voucher 没有 `expiresAt` 字段时会跳过过期检查 → 永久 voucher 原生支持
- `src/app/api/admin/update-voucher/route.ts` — 可作为参考，了解 voucher 管理端 API
