# /admin/multi-day 主菜特批价（2026-09-06）

老板要求：多日手动单页面能调主菜单价。

## 方案
照 /admin/subscriptions 加料「特批价」的先例：
- [x] 页面：每道主菜 qty 旁加 RM 单价框，默认目录价；与目录价不一致转琥珀色 + 「特批 ↺」一键恢复；换菜自动清回目录价
- [x] 服务端 `buildPlan` 新增 `opts.allowPriceOverride`，只在 multi-day-orders 路由打开；wa-order（碗妈 bot）默认关闭，AI 报价永远不信
- [x] 覆盖时 items[].price = 特批价、items[].listPrice = 目录价（条件写入，Firestore 不收 undefined），originalTotal / cashDue 跟着特批价算
- [x] 预览警告「「X」特批价 RM a（目录价 RM b）」；无效值（负数/非数字）回落目录价并警告
- [x] 预览行显示 `菜名×n@RM价`

## 验证
- [x] `tsc --noEmit` 0 错
- [x] eslint 三个文件 0 error（17 warning 全为既有 `any`）
- [x] `scripts/_dogfood-price-override.mts`：覆盖 / 等于目录价 / 负数 / 未填 四种情况，ON 与 OFF 两种模式 originalTotal 与 listPrice 逐项对上 → PASS
- [ ] `next build`（见会话结论）
- [ ] 线上 /admin/multi-day 实际点一遍（需老板 Google 登录，本地没做）

## 未做（按要求只动主菜价）
- 加料价在这一页仍是目录价固定；subscriptions 页已有加料特批，需要的话照搬 20 行
