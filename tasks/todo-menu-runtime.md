# Dashboard 每周换菜（运行时生效）— 2026-09-08 执行记录

老板决定：方案 A（Firestore 运行时生效）；范围 = 排期 + hero + 常驻 + 暂别 + 限量 + 停业日 + 价格；
周文档 + 可提前编辑下周 + 可单日编辑；限量不分日期；撤菜撞已有订单只警告；dashboard = Desktop 本地 HTML。
优化项全部留到主功能完成之后。

## 架构（一句话）
Firestore 成为菜单唯一来源；代码里的 weeklyMenu.ts / blockedDates.ts 降级为「快照 + 兜底」，
由 `npm run menu:snapshot` 从 Firestore 反向生成。详见 `.claude/skills/weekly-menu/SKILL.md`。

## 阶段与勾选项

### Phase 0 数据层 + 迁移
- [x] `src/lib/menuRuntimeStore.ts` / `menuResolve.ts` / `menuRuntime.server.ts` / `useMenuRuntime.ts`
- [x] `weeklyMenu.ts` 推导层抽成 `buildMenu(week,{strict,overrides})`，三表导出 + `MENU_SNAPSHOT_WEEK`
- [x] `blockedDates.ts` helper 读运行时（firestore 模式只看 Firestore）
- [x] `scripts/menu-seed-firestore.mts`（`--week-only` 只写周文档）→ 已 `--commit` 灌入 2026-09-07 周 + 停业日
- [x] `scripts/menu-snapshot.mts` + `npm run menu:snapshot`（实跑往返：23 条 strict 过、diff 只有注释）
- [x] Firestore rules：新集合落在既有「未列出集合仅 admin」兜底规则，无需改

### Phase 1 API
- [x] `GET /api/menu`（公开、CORS、s-maxage 30、fail-open）
- [x] `POST /api/admin/menu-config`：get / saveWeek / saveDay / conflicts / setDish / setClosure / deleteClosure
- [x] 撤菜冲突：按周查 orders（deliveryDate 范围、非 cancelled、items[].name 命中且新排期不可下单）→ 只警告
- [x] 保存后 invalidate + 镜像 `menu.day` / `offMenuThisWeek`（替代手动 sync:menu）

### Phase 2 服务端消费方
- [x] submit-order（每个 bundle 按 selectedDate 取所属周）/ consume-stock 不变（按名）/ n8n menu / n8n customer / subscriptions week / product-feed / manualOrderCore（multi-day-orders、wa-order 入口先 load）
- [x] repriceCart 不传 menu 时按每项日期取所属周

### Phase 3 客户端消费方
- [x] page / en page（menuDates 按运行时菜单重算）、MenuCarousel、HeroSection、CartDrawer、SoldOutNotice、OrderClient、QuickOrderClient、MemberView、DishPicker、admin multi-day、nextSpecial、cartStore（运行时到位后二次刷价）
- [ ] MealVouchersView「最高兑换价值」仍按代码快照算（只影响文案里的折扣 %，换菜后跑 snapshot 即追平）

### Phase 4 Dashboard「菜单排期」页
- [x] 侧栏 `menu` + PAGE_INFO + `#page-menu` 容器 + switchPage 分支 + 模块 JS（末尾）
- [x] 本周/下周/下下周切换；周一~周五 5 列 + 常驻 + 暂别 + 未排期池；下拉加菜、↑↓、⭐设主打、✕移出；只保存某天 / 保存整周 / 复制上周 / 撤销
- [x] 冲突黄框；价格 + 未上架表；停业日卡（整天售罄/放假、只关晚市、单菜停售）；库存页入口
- [x] 拆掉 MENU_SEED→`menu.day` 回写；`_dishGroupsByDay` 改 `m.day` 优先
- [x] `npm run sync:dashboard` 回灌 public；模块 `node --check` 过；vm 假数据测 26 条过

### Phase 5 验证
- [x] `npx tsc --noEmit` / `npm run build`（新路由出现在 build 输出）/ `npm run dogfood` 29 个全过（含新 dogfood-menu-resolve 32 条）
- [x] 本地 `next start`：seed 前 `/api/menu` 回 snapshot、首页/EN 200 且预渲染含菜名；seed 后 `source:firestore`、product-feed 正常；admin 路由无 token 403 / OPTIONS 204
- [x] 更新 weekly-menu / add-new-dish skill；写记忆 `project_menu_runtime_firestore`
- [ ] **待 push 后**：老板在 dashboard 实机走一遍（保存 → 1 分钟后 curl /api/menu 与首页对照）；旧页面购物车提交被拒的提示文案实测

## Review
- 分支 `feat/menu-runtime`，6 个 commit，未 push（需老板批准；本批含菜单相关改动，按规矩低峰推）。
- 部署顺序无坑：Firestore 已 seed，代码上线那一刻 `source` 直接切 firestore，内容与代码快照完全一致。
- dashboard 的「菜单排期」页调 `www.incredibowl.my/api/admin/menu-config`，**push 部署前打开会报 404**。
- 风险点：合成周里同一道菜若两周排在不同 weekday，首页只显示日期更早的那次（形状限制，已在 dogfood 覆盖）。

## 不在本期（老板：主功能完成后再做）
- 选菜显示近 4 周销量 / 上次出现周；食材够不够检查；broadcast 自动生成；排定生效时间；hero 无图校验；限量按日期

# 第二期：优化 + 菜品分析（2026-09-08 老板「do all」）

## 计划
- [x] O1 菜品分析 API `POST /api/admin/dish-analytics`（口径沿用 pair-opportunity.mjs：cancelled/stale-FPX OUT、↳=加料、价值=现金+券×18.5）
      每菜：份数/单数/价值/近4周/近8周/按周几分布/最佳周几/上次供应/毛利（menu.costPrice）；同单配对（共同天归一转化率）；同天搭档（当天两道特餐→当天碗数均值）
- [x] O2 dashboard 新页「菜品分析」：畅销榜、周几热力表、配对好/坏榜、菜单工程四象限（人气×毛利）、时间范围切换
- [x] O3 排期页选菜/行内显示「近4周 N 份 · 上次 M/D · 最佳周几」
- [x] O4 食材检查：按近 8 周每供应日均量 × 配方 → 对照 ingredientStock → 保存前/按钮显示缺口（advisory）
- [x] O5 broadcast 生成：按老板模板（英文主体+双语菜名），加料/运费从 addOnsConfig/deliveryCopy 单一来源，新菜=从未售出过
- [x] O6 排定生效时间：menuWeeks.scheduled {at, week}，resolver 到点自动用；dashboard 保存时可填生效时间
- [x] O7 hero 校验：主打必须有实拍图且未 hidden（API 400 + dashboard 提示）
- [ ] 验证：tsc/build/dogfood/vm 测/本地 next start；sync:dashboard；commit
- [x] 验证：tsc 过；menuResolve dogfood +4 条排定断言、broadcast dogfood 31 条、dashboard v2 vm 测 30 条全过；`node --check` 过；sync:dashboard 已回灌
      （build / 全量 dogfood 结果见下方 Review 补充）

## 第二期 Review
- O1 菜品分析改在 **dashboard 浏览器内存**算（state.orders 是全量订单，helper 齐全），没建 API；口径与 weekly-sales-snapshot / pair-opportunity 脚本对齐。
- 「同天搭档」是按当天实际售出最多的两道非常驻菜推断（历史排期没存档），报表上已注明。
- 食材预测的需求量由 dashboard 算（近 8 周每供应日均量，没卖过的用中位数）→ API 乘配方对照 ingredientStock；dashboard 里的 id 是 menu id，喂 API 前按菜名回 MS.catalog 换成网站 id（vm 测抓到的坑）。
- Broadcast 的「新菜」= 上周文档没排过的菜 ∪ 从未卖过的菜；文案生成后老板仍可在 textarea 改。
- 排定生效挂在 menuWeeks 文档 `scheduled` 字段，saveDay 用 merge 不会误删；服务端 30s 缓存 + 缓存 key 带「到点指纹」。

# 第三期（2026-09-08 老板「do it」）：回头率 / 自动起稿 / 流失预警 / 加料曝光实验
- [x] P6a submit-order 加料行写 addOnId（向后兼容）
- [x] P6b MenuItem/DishOverride 加 recommendedAddOns + recommendedSince；setDish 支持；/api/menu 带出
- [x] P6c AddOnModal「常一起点」badge + 置顶
- [x] P1 分析页：30 天回头率 / 再点率两列 + 留客榜 + 基准线
- [x] P6d 分析页：每菜最常一起点前三加料 + 「推送推荐到网站」+ 推送前后渗透率对比
- [x] P5 分析页：客户预警三名单（上周活跃本周没来 / 高价值沉默 / 持券静默或将过期）+ wa.me + 档案抽屉
- [x] P2 排期页：✨ 自动起稿（规则透明、每道菜一句理由，只生成草稿）
- [ ] 验证：tsc / build / dogfood / vm 测 / 本地 next start；sync:dashboard；commit

## 第三期 Review
- 回头率只算 D 距今 ≥30 天的记录；客户识别复用 dashboard `customerKey`（电话优先）。
- 加料归因只归因**单菜订单**（同 weekly-sales-snapshot 口径），多菜单进 unattributed；优先读 `addOnId`，旧单走 label 表。
- 客户预警三名单口径 = weekly-customer-analysis（A）/ four-week-retro（B，价值门槛 RM80 改按近 28 天）/ weekly-report-build（C 持券静默 >14 天或 ≤14 天到期）；dashboard 留存页/客户页的两套旧定义未动。
- 自动起稿只生成草稿；候选用尽（有图的非常驻菜不够 10 道）后面的天留空由老板补。副菜挑选带「同蛋白 −0.3」。
- 推送推荐写 `menuCatalog.recommendedAddOns` + `recommendedSince`；AddOnModal 置顶 + 标签；实验读数 = 推送前 8 周 vs 推送后（按 createdAt）。
- 验证：tsc 过；vm 测第三期 30 条 + 第二期 30 条全过；`node --check` 过；sync:dashboard 已回灌；build / 全量 dogfood 结果见 commit 后补记。
