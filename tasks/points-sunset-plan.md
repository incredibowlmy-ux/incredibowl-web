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

## Phase 2 — 2026-05-18 完成（提前于原计划 5/31 执行）

### UI 清理 ✅
- [x] `src/components/auth/AuthProfileView.tsx` — 移除「我的积分」dashboard；推荐码 hint「双方各获 50 积分」改成「永久 RM 5 voucher」；Sparkles 图标 import 移除
- [x] `src/components/auth/AuthModal.tsx` — 注册框底部宣传「RM 1 = 1 积分 · 推荐好友获 50 积分 · 100 积分兑 RM10」改成「🎁 推荐好友 · 双方各得永久 RM 5 voucher」；Sparkles import 移除
- [x] `src/app/member/MemberView.tsx`：
  - 整张「我的积分」卡片删除（progress bar、sunset 通知、计算逻辑）
  - 「推荐统计」从 3 列改 2 列（删 `pointsEarned`）
  - referBonusPoints 改成「永久 RM 5 voucher」/「a permanent RM 5 voucher」
- [x] `src/app/member/dict.ts` — 删除 ZH + EN 的所有积分 keys（`myPoints`、`pointsNeedMore`、`pointsThresholdReached`、`pointsThresholdSubtitle`、`redeemNow`、`redeeming`、`pointsAfterRedeem`、`redeemSuccess`、`yourCode`、`copyCode`、`pasteCodeHint`、`redeemFailed`、`statPointsEarned`、`pointsSunsetTitle/Body/Timeline/Cta`）；只保留 `copied`（推荐码分享按钮还在用）
- [x] `src/app/page.tsx` + `src/app/en/page.tsx` — FPX 成功弹窗「积分将在配送后自动发放」/「Points will be issued after delivery」整行删除
- [x] `src/components/home/NavBar.tsx` + `src/components/home-en/NavBarEN.tsx` — 会员入口 tooltip「积分与订单」改成「订单与 voucher」/「orders & vouchers」

### Backend 清理 ✅
- [x] 删除整个 `src/app/api/redeem-points/route.ts` + 文件夹
- [x] `src/app/api/confirm-order/route.ts` — 删除过渡注释，POST 注释更新成 referrer voucher 描述
- [x] `src/app/api/my-vouchers/route.ts` — 永久 voucher 支持（之前的 bugfix）

### 保留（不删）
- ✅ `users.points` Firestore 字段（审计保留，没人读了但不删）
- ✅ 旧的 `vouchers` doc（POINTS-XXX、LP-XXX、REFBONUS-XXX）— 客户还要用
- ✅ `src/app/api/admin/migrate-points/route.ts` + `src/app/admin/migrate-points/page.tsx` — 你还在用来查客户积分 → WhatsApp（短期内保留，等所有人 WhatsApp 完再删）
- ✅ `voucherLabelPoints` / `voucherLabelPointsMigration` / `voucherLabelReferrerBonus` 等 dict keys — 显示历史 voucher 标签时还在用
- ✅ confirm-order 里推荐人 mint RM 5 voucher 的逻辑（替代了 50 积分奖励）

### 待办
- [ ] 老板用完 `/admin/migrate-points` 后告诉我，我把这个工具也删掉
- [ ] （可选）跑 `next build` 验证生产环境编译无 import 错误

---

## 不在范围内 (Out of Scope)
- ❌ 不动 `mealVouchers` 集合（餐券预付包系统独立运行）
- ❌ 不动旧的 referral voucher 流程（新客户首次注册的 RM 10 voucher 保留）
- ❌ 不删 `users.points` 字段（审计需要）

## 相关文件参考
- `src/lib/voucherValidation.ts:88` — 已确认：voucher 没有 `expiresAt` 字段时会跳过过期检查 → 永久 voucher 原生支持
- `src/app/api/admin/update-voucher/route.ts` — 可作为参考，了解 voucher 管理端 API
