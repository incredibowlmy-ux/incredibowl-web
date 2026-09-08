# Dashboard 每周换菜（运行时生效）— 计划 2026-09-08

老板决定：方案 A（Firestore 运行时生效）；范围 = 排期 + hero + 常驻 + 暂别 + 限量 + 停业日 + 价格；
周文档 + 可提前编辑下周 + 可单日编辑；限量不分日期；撤菜撞已有订单只警告；dashboard = Desktop 本地 HTML。
优化项（销量提示/复制上周/食材检查/broadcast 生成/定时生效/hero 校验）全部留到主功能完成之后。

## 架构（一句话）
Firestore 成为菜单唯一来源；代码里的 weeklyMenu.ts / blockedDates.ts 降级为「快照 + 兜底」，
由 `npm run menu:snapshot` 从 Firestore 反向生成（保证 build 校验、预渲染 HTML、离线脚本、git 历史继续可用）。

### Firestore 集合
- `menuWeeks/{周一YYYY-MM-DD}`：`{ days:{1:[id..],2:[..],3,4,5}, daily:[id..], paused:[id..], updatedAt, updatedBy }`
  - 数组第一个 id = 当天 hero（沿用现有 isPrimary 语义）
  - 某日期查排期：取该周文档；没有 → 取最近一个更早的周文档（自动滚动）；都没有 → 代码快照
  - 单日编辑 = 只 update `days.N`
- `menuCatalog/{webappId}`：`{ price?, hidden?, updatedAt }`（只放会变的；名/图/描述/tags 留代码）
- `menuClosures/{YYYY-MM-DD}`：`{ reason:'soldout'|'holiday', dinnerOnly?:bool, blockedDishIds?:[..] }`
  （合并 CLOSURES / DINNER_CLOSED_DATES / BLOCKED_DATES 三张表）
- `dishStock` 不变（沿用现有限量 UI 与 API）

### 生效路径 / 性能
- 服务端 `src/lib/menuRuntime.ts`：读三集合 → 内存缓存 60s → `resolveMenu(ymd)` 输出与现在 `weeklyMenu` 同形状的数组
- 公开 `GET /api/menu`（CORS、fail-open 回代码快照）：客户端 hydration 后 fetch 一次（与现有 /api/dish-stock 同模式，**不用 Firestore Listen**）
- 首页预渲染 HTML 仍是静态快照；客户端拿到运行时菜单后按 menuDates 重算（日期字段照旧留客户端）
- 旧页面下单：`/api/submit-order` 用运行时菜单做 isDishOrderableOn + repriceCart → 不在菜单/价格不符一律拒收并提示刷新

## 阶段与勾选项

### Phase 0 数据层 + 迁移
- [ ] `src/lib/menuRuntime.ts`（server）：读取/缓存/resolveMenu(ymd)/resolveClosures；纯函数部分抽到 `src/lib/menuResolve.ts` 供客户端复用
- [ ] `scripts/menu-seed-firestore.mts`：把当前 WEEKLY_SCHEDULE/DAILY/PAUSED/价格/CLOSURES 一次性写进 Firestore（dry-run 默认，--commit 真写）
- [ ] `scripts/menu-snapshot.mts` + `npm run menu:snapshot`：Firestore → 重写 weeklyMenu.ts 三表 + 价格 + blockedDates.ts，再串 `sync:prices --fix` + `sync:dashboard`
- [ ] Firestore rules：三个新集合仅 admin 读写（前端走 API）

### Phase 1 API
- [ ] `GET /api/menu`（公开，60s 缓存，CORS）
- [ ] `GET/PUT /api/admin/menu-weeks/[monday]`（PUT 支持只传某一天）
- [ ] `PUT /api/admin/menu-catalog/[id]`（price/hidden；同时写 dashboard `menu.price` 保持两套 id 同步）
- [ ] `GET/PUT/DELETE /api/admin/menu-closures/[ymd]`
- [ ] `GET /api/admin/menu-conflicts?monday=..`：撤菜前查该周已有订单/订阅（只返回警告清单）
- [ ] 每次 admin 写入后清服务端缓存

### Phase 2 服务端消费方改吃运行时菜单
- [ ] submit-order / consume-stock / n8n/menu / n8n/customer / admin/subscriptions/week / meta/product-feed
- [ ] `isDishOrderableOn`、`cartDateUtils`、`cartRepricing`、`nextSpecial`、`dateUtils` 接受 menu/closures 参数（默认仍是快照，保证不传也能跑）
- [ ] repriceCart 的整体比对要忽略 weekday/day/isPrimary 这类按周推导字段（否则跨周必误判）

### Phase 3 客户端消费方
- [ ] `MenuRuntimeProvider` + `useRuntimeMenu()`：page.tsx / en/page.tsx 顶层 fetch `/api/menu` 一次
- [ ] MenuCarousel / HeroSection / CartDrawer / AddOnModal / SoldOutNotice / OrderClient / QuickOrderClient / MemberView / MealVouchersView / DishPicker / admin multi-day / waOrderResolve / manualOrderCore 改用 provider（HERO_BG 与 layout JSON-LD 继续用快照）
- [ ] /en 同步验证

### Phase 4 Dashboard 新页「菜单排期」
- [ ] 侧栏加 `menu` page；周选择（本周 / 下周 / +2）；5 列（周一~周五）+ 常驻 + 暂别
- [ ] 每列：多选菜品、拖动排序、⭐ 设 hero、单日保存；顶部「整周保存」
- [ ] 价格编辑（写 menuCatalog + menu）；停业日历（整天 / 只关晚市 / 单菜停某天）；限量直接链接现有库存 tab
- [ ] 保存前调 menu-conflicts：有已下单的菜被撤 → 黄色警告列出订单，仍允许保存
- [ ] 拆掉 dashboard 载入时「MENU_SEED → Firestore menu.day/active」回写；day/offMenuThisWeek 改由 menuWeeks 派生
- [ ] `npm run sync:dashboard` 回灌 public

### Phase 5 验证
- [ ] `npx tsc --noEmit`、`npm run build`、dashboard `node --check`
- [ ] dogfood-dish-orderable / dogfood-cart-repricing / 新增 dogfood-menu-resolve（跨周滚动、单日覆盖、无文档兜底）
- [ ] 本地 next start：改下周周二 → /api/menu 变、网页周二卡变、旧快照购物车提交被拒
- [ ] `menu:snapshot` 生成结果与 Firestore 一致、build 校验通过
- [ ] 更新 weekly-menu / add-new-dish skill：换菜改走 dashboard，skill 只剩新菜 + snapshot

### 不在本期
- 新菜上架（仍走 add-new-dish skill）、限量按日期、优化项六条
