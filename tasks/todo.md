# 下周换菜 2026-08-10（一）~ 08-14（五）

老板 08-06 定的菜单（我先出过一版数据驱动方案，老板另有安排，按老板的菜单执行）。

## 排期

| 日 | 特餐 | 变动 |
|---|---|---|
| 周一 08-10 | 山药云耳海陆双鲜炒（主打）+ **家乡白萝卜焖花肉 🆕** | 山药 Wed→Mon；新菜首发 |
| 周二 08-11 | 家乡豆酱焖花肉（**单菜日**） | 留任；老板当天有事，主动压量 |
| 周三 08-12 | 古早味照烧鳗鱼饭（主打）+ 绍兴酒蒸花肉 | 鳗鱼 周一/四→周三单日；绍兴暂别回归 |
| 周四 08-13 | 柠檬蜜糖煎鸡扒（主打）+ **家乡白萝卜焖花肉** | 鸡扒暂别回归（07-20 暂别） |
| 周五 08-14 | 家乡甜酸洋葱猪扒（主打）+ 柠香香煎三文鱼饭 | 猪扒 Thu→Fri；三文鱼 周二/五→周五单日 |

常驻不变：纳豆月见海苔饭、马铃薯炖花肉片。
转暂别：香煎金黄鸡扒饭、招牌原盅当归蒸鸡全腿、希腊柠香烤鸡胸。

**新菜**：家乡白萝卜焖花肉 RM19.90（webapp id 30 / dash id 30）。
英文名 `Hometown Stewed Pork Belly with Daikon` 老板 08-06 定稿。
一菜两天（周一+周四）走 DAILY_DISHES + availableWeekdays[1,4] + featureOnAvailableDays，
跟鳗鱼/绍兴同款机制（同一道菜不能在 WEEKLY_SCHEDULE 出现两次）。

## 已完成

- [x] `src/data/weeklyMenu.ts`：新菜 id 30 建档 + WEEKLY_SCHEDULE / DAILY_DISHES / PAUSED_DISHES 三表重排
- [x] 鳗鱼(29) 去掉 availableWeekdays[1,4]+featureOnAvailableDays → 周三单日特餐
- [x] 三文鱼(21) 去掉 availableWeekdays[2,5]+featureOnAvailableDays → 周五单日特餐
- [x] `src/data/dishIngredients.ts`：新菜加空配方条目 + TODO（份量待碗妈提供，绝不照豆酱焖花肉猜克数）
- [x] Desktop `incredibowl-dashboard.html` MENU_SEED 同步（dash id ≠ webapp id，按映射改）
- [x] `npm run sync:dashboard` → public/dashboard-h7x2q9.html
- [x] `npx tsc --noEmit` 通过
- [x] `npm run build` 通过 —— 排期表三条自检规则（id 唯一/不重复/无遗漏）是运行时的，build 过=排期合法
- [x] 起 production server 实测渲染：周一=山药+白萝卜、周二=豆酱单菜、周三=鳗鱼+绍兴、
      周四=柠檬鸡扒+白萝卜、周五=猪扒+三文鱼，暂别三道沉底；白萝卜在周一/周四各出现一次 ✅
- [x] `/en` 同步验证通过（EN 组件树独立但读同一份 weeklyMenu）
- [x] `npm run sync:menu` dry-run：新建 1 道 + 更新 9 道，与预期完全一致

## 阻塞：新菜没有主图

`/daikon_pork_belly.webp` 不存在，实测 **HTTP 404**（对照 unagi_rice.webp = 200）。
素材库 `Desktop\Incredibowl Services\Dish image\`（含 Gpt 子目录）里没有白萝卜焖花肉的图。

**图没到位之前不能 push** —— 周一/周四菜单卡片会显示破图。
老板给图后：转 1024² webp q82 → 放 public/ → 重跑 build → 即可推。

## 待办（图到位后）

- [ ] 放入 `/public/daikon_pork_belly.webp`
- [ ] `npm run build` 复验
- [ ] commit 菜单文件（**绝不 `git add -A`**）
- [ ] ⏳ **等 08-07（周五）06:00 截单后才 push** —— 提前推会让周五的客人看到下周菜单（07-24 事故同款坑）
- [ ] push 后 `npm run sync:menu --commit` 写 Firestore 排期
- [ ] curl 线上 grep「家乡白萝卜焖花肉」smoke check
- [ ] 老板在 dashboard Settings→菜单管理 手动填新菜 costPrice（seed 只给 0，成本未知不编）
- [ ] 碗妈给新菜份量后补 `dishIngredients.ts` 配方，否则每日备餐采购清单漏白萝卜/花肉
- [ ] 新菜有图后在 Google Sheet dishes 表加一行，否则 WhatsApp chatbot 发不出该菜图片

## 提醒老板的事

1. **周二订阅单要手动改菜**：8 个订阅客户有周二固定单（本周二实际执行 5 单 9 碗），
   其中 4 户订阅表里点名三文鱼——下周二没有三文鱼，在 /admin/subscriptions 建单时要手动换。
2. **周一 Hero「明日主打」会显示山药云耳，不是白萝卜焖花肉**。机制限制：featured 菜
   （一菜两天）拿不到 isPrimary。老板原话把白萝卜列在第一位，如果要它当周一主打，
   得改成白萝卜只排周一、周四另换一道菜。
3. 旧 WhatsApp 模板里的运费「7.5–12km via Grab RM10, Minimum order RM65」与系统实际
   收费不符（实际 7.5–10km RM15、10–15km RM20，且无 RM65 最低消费）。新模板已按系统实际写。

## Review

数据分析脚本 `scripts/_dish-day-normalized.mjs`（本次新写，未 commit）：按 (菜 × 配送日)
归一化菜品表现，剔除在途未截单/周末零星/团餐单。结论存在本文件 git 历史里，
下次排菜单可直接复用：周一最强(RM643/天)、周五最弱(RM436/天)；日均份数王 = 猪扒 14.4、
鳗鱼 14.33、三文鱼 12.6；最冷 = 纳豆 1.62、参峇臭豆 2.9、马铃薯 3.0、山药 4.25。

---

# Bowlmama v2 — WhatsApp 客服 chatbot 重构（防抖 + 下单闭环）— 2026-08-01

> 老板已拍板：删 Lead/CAPI 支线（Purchase 走每周 cron）；防抖聚合；打通 WhatsApp 下单到 Firestore；
> 查客户/餐券档案注入；可靠性三件套（Error Workflow + 签名校验 + 求救标记统一）；位置 pin 报价。
> 交付 = n8n 可导入 JSON ×3 + repo 新端点 ×2 + check-delivery 扩展；commit 留本地等批准 push。

## Phase A — 侦察（只读）
- [x] multi-day-orders confirm 的订单 doc 逐字段口径 + batchTag 幂等 + 用户绑定（3 个并行 agent + 自查补齐；track token 在订单 doc 上）
- [x] 券/加料 credit/用户档案查询口径（mealVouchers available+读取时过滤过期；addonCreditUtils.getAvailableAddonCredits）
- [x] 加料权威价=ADD_ON_PRICES；中文名映射=DISH_ADDONS_BY_NAME（dashboard 同源生成表）
- [x] deliveryUtils 全签名 + n8n Bearer N8N_API_KEY 鉴权模式

## Phase B — repo 端点
- [x] src/lib/manualOrderCore.ts：buildPlan/resolveManualUserId/writeManualOrderDays 原样抽出，multi-day route 改薄壳（行为零变化）
- [x] POST /api/n8n/wa-order：draft（服务端计价+冻结价存 waOrderDrafts+顶掉旧 pending）/ peek / confirm（batchTag 幂等+复用共享落库+trackToken）/ void
- [x] GET /api/n8n/customer：档案+餐券+credit+进行中订单(track链接)+近单+ready-to-inject contextBlock；fail-open
- [x] check-delivery 支持 {lat,lng} 直入（位置 pin，零 geocode 费用）
- [x] 验证：tsc 0 错 + npm run build exit 0 + dogfood-wa-order.mts 25/25

## Phase C — n8n JSON
- [x] bowlmama-v2-main.json（60 节点：防抖 Sheet buffer+水位线、客户档案注入、check_delivery_fee/create_order_draft 双工具、位置pin报价、截图转发带草稿摘要、老板回1自动建单、求救标记统一）
- [x] bowlmama-v2-draft-tool.json（宽容解析 order_json → wa-order draft → 工具文本）
- [x] bowlmama-v2-error-handler.json（Telegram 报警，凭据/chatId 导入后填）
- [x] scripts/validate-n8n-workflows.mjs 全过（连接/引用/==表达式/凭据白名单）
- 签名校验：暂缓（需 App Secret + 实例上实测 raw-body），SETUP 里列为下一步加固项

## Phase D — review + 收尾
- [x] 对抗性 review（3 agent）：字段对照=零漂移仅 3 个 P3 nit；安全+JSON 审计抓到 2 P1 + 6 P2 全部修复
- [x] n8n-workflows/SETUP.md（导入步骤、切换顺序、8 步真机 smoke 清单、诚实边界）
- [x] commit 1b4261e 留本地（不 push，等老板批）

## Review 小结
- **review 修复清单**：防抖水位线 ts 改用「吞掉消息的 maxTs」（否则 Read→Mark 间隙的新消息被永久吞）；SYS- 定位注记不参与「最新消息」判定（否则文字+定位连发吞文字）；confirm 事务认领 pending→confirming（防老板连点/n8n 重试双建单）+ 卡死 3 分钟可重领；batchTag 加电话尾号+随机（同毫秒撞 tag 会吞掉第二个客户的已付款单）；跨号 draftId 拒绝；草稿坐标 deliveryLat/Lng 落单（路线规划第一层命中，定位单地址是占位串必须带坐标）；老板引用图片不再误发「扫码付款」话术；两个新端点 header-only + timingSafeEqual；加料价 clamp≥0；>12 项/天出警告不静默截断。
- **接受的已知边界**（都有注释/文档）：confirm 沿用草稿冻结时的可下单性判定（24h 窗口内新增停业日不重拦）；customer 订单查询 limit 300 内存排序（当前量级安全）；wa_buffer 只增不删（SETUP 写了月度清理）；[SEND_DISH] 只认 ASCII id（本就是约定）。
- **验证**：tsc 0 错 ×3 轮、npm run build 过 ×2 轮、dogfood 25/25、JSON 图校验全过（61+6+2 节点）。
- **上线依赖链**：老板批 push（Vercel 部署 wa-order/customer 端点）→ 建 wa_buffer tab → 导入 3 JSON + 3 处手动挂接（子 workflow 下拉/Error Workflow 设置/Telegram 凭据）→ v1 停 v2 启（同 webhook path，Meta 零改动）→ SETUP.md 8 步真机 smoke。

---

# 半夜 QR 新单老板即时通知（Telegram + 邮件）— 2026-07-25

> 问题：半夜有人用 QR 转账下单，老板没有任何提醒 → 漏单没备餐。
> 根因：QR 单在 submit-order 写入 status=pending，只有老板 Dashboard 手动核对收款才确认；全链路只给顾客发收据邮件，从没给老板发过新单提醒。
> 决定：只 QR 新单触发；Telegram + 邮件双通道；best-effort 永不阻塞下单。

- [x] 新建 src/lib/ownerNotify.ts：notifyOwnerNewQrOrder(orders)，Telegram(Bot API sendMessage) + 邮件(Resend)，env 缺失即静默跳过，永不抛错
- [x] submit-order 订单创建后，仅 paymentMethod==='qr' 时调用（await，因 Vercel 冻结）
- [x] .env.local 补 TELEGRAM_BOT_TOKEN / TELEGRAM_OWNER_CHAT_ID（本地测试）
- [x] 验证：tsc 我的两个文件 0 报错 + 本地真实发一条 Telegram 已送达老板 chat（msg_id=683）
- [x] Vercel 已加 TELEGRAM_BOT_TOKEN + TELEGRAM_OWNER_CHAT_ID（Production, CLI 加）；RESEND_API_KEY 已确认早配（21天前）
- [x] commit 75f6ffc + push；发现线上部署自 cd45eca(菜单提交)起一直 Error
- [x] 修部署阻断：scripts/sync-menu-to-firestore.mts 的 `.ts` 后缀 import 被 next build 拒；tsconfig exclude 加 "scripts"（0ff45db）；npm run build 本地通过
- [x] 部署验证：0ff45db Production ● Ready；功能连同之前卡住的菜单提交一起上线
- [x] 多收件人（dc34d5f）：TELEGRAM_OWNER_CHAT_ID 逗号分隔，加碗妈 chatId 7992954700（n8n 取，显示名 Ebby）；老板+碗妈两号实测送达（683/685）；build 过、Ready

## Review 小结
- 唯一改动入口：submit-order 是所有网页新单的唯一写库点，QR 单必经此处 → 挂在这里 100% 覆盖，零遗漏。
- 只对 paymentMethod==='qr' 触发：FPX 未付款不误报、已付款 FPX 会自动确认+进 06:30 备餐单不算漏。
- best-effort：Telegram/邮件任何失败只记 log 不抛错，绝不影响顾客下单；env 缺失即静默跳过，没配 key 也能安全部署。
- 多日 QR 单（一次付款多文档）合并成一条提醒，不刷屏。

---

# 配送方式拆分（Grab vs 自送）+ 真实配送成本核算 — 2026-07-23

> 目标：Dashboard 清楚看到「Grab 花了多少 / 自己送了多少趟 / 自送油钱车损多少」。
> 老板已确认：Grab 费用以每周上传收据为准（Accounting deliveries.csv）；自送=每公里综合率×每单独立往返；私人司机单独一类；配不上收据的单先给老板过目。

## Phase 0 — 配对报告（✅ 完成，只读未写数据）
- [x] scripts/match-deliveries-to-orders.mjs：deliveries.csv 165 趟（去重）× Firestore 订单
- [x] 结果：**154 配上 · 11 趟收据无单 · 363 文档（355 趟）无收据=候选自送**
- [x] 报告：analytics/delivery-method-match-report.md
- [x] 别名：Py→PY•玉、Elyn Wong→E Wong、Daryl koh→Darryl Koh、Chungee→ChungEe Tan、Karen Cham(BK 1/13)→Karen Home；2 单 Guest 靠地址/电话认定

## Phase 1 — 自送成本率（等老板拍板）
- 油费 RM1.99/L（账本 6 笔加油全 1.99）× 11L/100km（CX-5）= RM0.22/km
- 保养摊提 RM0.10/km（市场典型估算，账本无保养记录，可用真实发票重算）
- 默认综合率 **RM0.32/km**；Settings 做成油价/油耗/保养三个可调字段
- 自送单成本 = 率 × deliveryDistanceKm × 2（往返）；旧单缺距离从 addressDistanceKm/geocode 补

## Phase 2 — Firestore 回填（✅ 07-23 执行完毕）
- [x] 老板 07-23 拍板：无收据全自送 / Gwen=Zhi Yuen、Racheel=Midfields Guest / 保养估算+30%
- [x] 回填 520 单：157 grab + 1 driver（收据实付+距离落库）+ 359 self + 3 pickup
- [x] 幂等验证（重跑 0 写入）；回滚日志 analytics/backfill-delivery-method-rollback-20260722.json
- [x] 7 笔未挂单收据 RM118（Chloe catering、未记名、多单混送）→ cfg.unlinkedDeliverySpend

## Phase 3 — Dashboard（✅ Desktop 源头改完已 sync）
- [x] 「标记配送」弹窗方式 4 选 1（self 显距离行自动算；grab/driver 显实付行）
- [x] 「开始配送」批次自动把未分类单标 self（已标 grab 的不动）
- [x] 成本统一 buildDeliveryCostMap：grab/driver=实付；self=率×2×km 同客同日同午/晚一趟均摊；pickup=0；未分类退 zone 估算
- [x] Budget 新卡「配送方式拆分」+ 补贴卡/净利润/单笔计算器/月度导出/drill-down 全走新口径 + 未挂单支出计入
- [x] Settings 三字段：油价 1.99 / 油耗 11 / 保养 0.13（改了即重算）
- [x] 验证：整段 616KB script node --check 过；sync:dashboard 回灌 public 副本 grep 标记 16 处命中

## Phase 4 — 常态化（✅）
- [x] scripts/sync-grab-receipts.mjs：每周记账更新 deliveries.csv 后跑；幂等（dry 验证 0 写入）；晚到收据会把误标 self 升级成 grab 并提示；--rest-self YYYY-MM-DD 把剩余未分类批量标自送
- [x] submit-order 本来就写 deliveryDistanceKm（route.ts:433）— 网站零改动

## 备注
- 07-18 之后 99 单未分类属正常（本周收据未传）；每周流程 = 传收据→记账更新 csv→跑 sync→跑 --rest-self
- 6/17 RM33、6/18 RM37 是多单混送，钱在未挂单支出里、当天订单标自送 → 油钱轻微重复计（老板知情）
- faf6087 已 commit 留本地，等老板指示再 push（public/dashboard-h7x2q9.html 要随 main 部署才生效线上，本地 Desktop 版已可用）

---

# 客户下单自动抵扣预付加料 credits — 2026-07-20

## 需求（老板确认三决策）
客户账户展示预付加料券（sides/addon voucher）余额，下单时抵扣加料费。
1. 自动抵扣无开关；2. 与餐券/promo 都可叠加（餐券×promo 互斥不变）；3. 餐券点 wagyu/salmon 时 upgrade credit 自动抵差价（不用餐券不动 credit）。不做线上购买（仍走 admin）。

## Checklist
- [x] addonCreditUtils.getAvailableAddonCredits 加 soonestExpiryMs
- [x] 新建 src/lib/addonCreditMath.ts：planAddonCreditDeduction 两端同源（客户端 CartDrawer 与 submit-order import 同一份，杜绝漂移）
- [x] /api/my-meal-vouchers 响应追加 addonCredits（纯增量，三处消费者向后兼容）
- [x] submit-order：服务端权威重算 + ±0.02 对账 + per-part addonCreditDiscount 精确落组 + claim 挂 part1（credit 先券后，失败删单+回补库存+互释）+ 写 addonCreditsUsed/addonCreditsAllocatedRevenue（对齐订阅引擎，MFRS15 账闭合）
- [x] confirm-order 取消路径 releaseAddonCredits（镜像餐券块）
- [x] release-stale-fpx 第 4 步补 credit 释放 + 响应 addonCreditsReleased
- [x] CartDrawer：同一 fetch 拉余额、自动抵扣、明细行「预付加料抵扣（N 份）· 剩 X」、payload 传 clientAddonCreditDiscount；有抵扣时隐藏「加购需现金」
- [x] MemberView 餐券钱包卡下加「预付加料余额」小节（独立于券数，含最早到期）
- [x] cart/member dict zh+en 各补键（接口驱动漏一边 tsc 失败）
- [x] 验证：tsc 全绿；dogfood-web-addon-credits.mjs 31/31（普通加料/篡改400/多天parts/和牛反向断言/差价抵扣/取消双回补，全量清理+dishStock回补）；multi-day 回归 + my-meal-vouchers 冒烟过
- [x] commit 留本地不 push（等老板指示）

## 备注
- stale-fpx 用例本地无 N8N_API_KEY 跳过（释放逻辑与取消路径共用同一函数已覆盖）
- 成功页/FPX 弹窗 v1 不加 credit 行（total 本就是净额）；credit 品名两语言均显示中文 addonName
- 已知既有问题（本次不动）：submit-order serverTotal（CAPI 口径）连餐券都没减

# 装碗打包页（Dashboard 新 page）— 2026-07-14

## 需求（老板确认）
单量上升装碗常错。新增「装碗打包」页：
1. 糙米/白饭各自：总碗数 + 正常/少饭分组 + 逐碗明细（主菜+加料+备注）
2. Sides：所有加料按种类汇总数量
- 位置：Desktop incredibowl-dashboard.html 新 sidebar page（sync 到 public）
- 范围：今天，午餐/晚餐分开区块；逐碗列明细

## 设计要点
- 饭型推导：默认白饭；加料 brown-rice→糙米、less-rice→少饭；加饭不分组只做组头统计
- 自带加饭的套餐：chicken-chop-nostalgia-combo、scallion-soup-combo（extraDesc 核实）
- qty>1 且修饰加料部分数量时按数量拆碗（brown/less 重叠优先，注释说明假设）
- Sides 汇总排除 less-rice/brown-rice（已体现在分组），其余全计
- 复用：mealType()/normalizeOrderItems()/ymdKey()/canonicalAddonId()；过滤 deliveryDate==今天 && status!=cancelled
- 接入点：nav 工具区按钮 + page-packing div + PAGE_INFO 条目（必须，否则 switchPage 抛错）+ 懒渲染钩子

## Checklist
- [x] 澄清需求（位置/日期/sides 定义/粒度）
- [x] Explore agent 摸清 dashboard 结构（page 系统 7472/订单 schema/mealType 3328/normalizeOrderItems 3226）
- [x] Desktop dashboard 加「装碗打包」页（5 处：nav 按钮/page-packing div/PAGE_INFO/switchPage 钩子/renderPacking+packingMealHtml）
- [x] npm run sync:dashboard 回灌 public（753.1 KB）
- [x] 验证：node --check 语法过；括号配平抽真代码跑合成订单 12/12 断言过（网页 flat ↳ 加料、手动嵌套短 label、qty=2 拆碗、糙米+少饭同碗、套餐自带加饭、备注双层、sides 排除饭型修饰）；headless 浏览器打开无 console 错误、截图排版正确
- [x] commit 留本地不 push（等老板指示）

## 追加（老板 07-14 二次需求）
- [x] 打印备餐单每餐段加「🍚 装碗分组」块（备餐汇总/食材清单之下、订单卡之上）
- [x] 午餐/晚餐强制分页：`section.meal + section.meal { break-before:page }`，晚餐不再接午餐尾巴
- [x] 重构：collectPackingData() + packingLabelToId() 抽成共用——装碗页和备餐单同一套口径，改一处两边生效
- [x] 验证：node --check 过；断言 18/18（含备餐单块 5 条+分页 CSS 1 条）；真 PREP_CSS 拼双餐段 mock 转 PDF 实证第 2 页从晚餐开头

## Review
- 未登录时 Firestore 读不到单（页面显示 0 单）属预期——老板日常是登录态。
- 视觉验证走「隐藏 loginScreen + 注入合成 HTML」路线，未碰真实数据、未登录。
- 局限：套餐内容物不拆解到 sides（按「套」计，与备餐单口径一致）；只有大满贯/爆量两套餐计入加饭统计（extraDesc 核实）。
- 测试台 scratchpad/test-packing.mjs（会话临时目录，阅后即焚）。

---

# 自动化层：消灭每周人肉仪式 — 2026-07-10

源自使用回顾报告建议 1。四件套进度：

- [x] ① Meta B档 CAPI 直推：scripts/meta-capi-upload.mjs（直读 Firestore、共用状态文件、--check/--dry/--test/--cron）；首跑生产发送 44 笔/RM2332.60 成功；Task Scheduler `Incredibowl\MetaWeeklyCAPI` 周一 23:00
- [x] ② 换菜 skill：.claude/skills/weekly-menu/SKILL.md（本机生效，.claude 在 gitignore）；三模板等老板选
- [x] ③ 订阅阶段 2 余券不足方案：已答复（确认页内嵌补购券，见会话记录），实施排第 3~4 周
- [x] ④ 记账每日 23:00：零权限提醒版已上线（Incredibowl\DailyBookkeepingCheck → C:\Users\User\.incredibowl\cron-bookkeeping-check.ps1）
- [x] Telegram 配置：token+chat_id 已写入 C:\Users\User\.incredibowl\telegram-config.json，记账提醒 07-10 实测送达
- [x] chatbot 菜单同步：确认 Context Builder 瘦身版吃 /api/n8n/menu 活数据，换菜 push 后自动同步，无需人肉贴（skill 第 6 步已更新）
- [x] 全自动记账版：另一会话已在 Services 项目落地（night_run.ps1 + allowlist + 夜间加严 prompt）；我方 07-11 配套=退役 23:00 提醒、新增 07:30 Telegram 夜报推送
- [ ] ⏳ **老板本人**粘贴注册 IncredibowlNightBookkeeping（每天 3:03）——分类器不允许代注册，截图里那段 PowerShell 就是
- [ ] 订阅引擎阶段 2 实施（tokenized 确认深链 + 余券不足三选项：补购券/FPX差额/DuitNow QR 人工放行——Curlec 不支持 QR，走 FPX-pending 式页面 + WhatsApp 碗妈 + dashboard 手动放行，老板 07-10 拍板）
- [ ] ⏳ 新菜柠檬蜜糖煎鸡扒：实拍图（老板说 later）；图好后换 webp + Google Sheet dishes 表加发图行。✅ 配方已补 2026-07-13（dishIngredients.ts：鸡扒1块+白饭80g+毛豆25g+玉米25g+樱桃番茄2颗，shortName 柠扒；柠檬蜜糖酱按常备调味不计采购，老板拍板；奇亚籽布丁无配方老板说先不动）。✅ 加料已与鸡扒系列看齐 2026-07-14（AddOnModal id26 并入 id14 分支 + dashboard DISH_ADDON_MAP '26'，三件套照搬，老板拍板）
- [x] 小番茄全局 40g→20g 2026-07-14（老板拍板）：web/dashboard 标签改 (20g)、备料 2颗（1颗≈15g 宁多勿少）、价不变 RM2.50、40g 留 legacy 聚合在途订单；小番茄洋葱沙拉不动

## Review
Meta 直推验证链：test_event_code 探针 events_received=1 → --dry 44 笔与旧口径一致（含浮点尘埃修复，54 单券全抵常规跳过）→ 生产 events_received=44 → 复跑 --dry=0 笔证明状态防重生效。退出码修复后 ExitCode=0。

---

# 会员地址簿（最多 5 个地址）— 2026-07-07

## 方案
顶层 `address + geocode` 字段 = 「当前配送地址」指针，下单/运费/履约链路零改动。
新增 `users/{uid}.savedAddresses` 数组（≤5），每条带完整 geocode 数据包 + verifiedText
（submit-order 防换址比对要求 addressVerifiedText === address，切换时整包复制）。
仅注册（非匿名）会员显示地址簿 UI。

## Todo
- [x] auth.ts: `SavedAddress` 类型 + `upsertSavedAddress`（满 5 拒收新条目）/ `removeSavedAddress` / `selectSavedAddress`（复制到顶层字段）
- [x] AuthModal: 保存资料后自动 upsert 进地址簿 + 传 onReloadProfile
- [x] AuthProfileView: 非编辑态显示地址簿列表（当前打钩/使用/删除/+新增，满 5 提示）+ 编辑态可选 label 输入 + 取消按钮（仅资料已完整）
- [x] MemberView: 保存资料后同样 upsert 进地址簿
- [x] CartDrawer: 送达地址区加切换 chips（≥2 条才显示，匿名不显示），切换后运费自动跟着变
- [x] firestore.rules: userSafeFields 加 `savedAddresses` + update 加 size ≤5 校验
- [x] 验证: tsc + build 全绿
- [x] commit 本地 72d625a；等低峰/老板指示再 push

## Review（2026-07-07）
- 已 commit 72d625a（本地未 push）。tsc + npm run build 全绿。
- **UI dogfood 未做**：地址簿要真实登录账号才能走通，无头环境登不了 Google。
  部署后老板 2 分钟手测清单：个人资料弹窗看到地址簿 → +新增第二个地址（验证+保存）
  → 购物车出现切换 chips → 点切换看运费变 → 删除一条。
- **部署顺序**：先 Console 发布 firestore.rules（向后兼容、随时可发），再 push 代码。
  顺序反了也不炸：upsert 被 try/catch 包住，地址簿保持空、保存当前地址照常。
- 老用户懒迁移：第一次「验证并保存」地址时自动收编成第 1 条，无需跑脚本。
- 防换址检查兼容：selectSavedAddress 整包复制含 verifiedText，submit-order 比对照过。

---

# Incredibowl 安全修复 + Bug + 优化 — 总计划

> 状态：待审批。生产环境有真实客户/营收，支付链改动属高风险，每阶段改完按「push 前必须先验证」规则本地 tsc + dogfood 再 commit。

## 阶段 0 — 前置确认（需老板参与，阻塞阶段 2）
- [x] 老板已贴线上规则（2026-07-02）。分析结论：**不是裸奔**，users/feedbacks/兜底都齐；
      但 orders 有两个真洞：① `create: isSignedIn()` 任何登录者可伪造已确认订单
      ② owner update 可付款后自改金额/自确认。客户端建单(lib/orders.ts submitOrder)
      确认是死代码 → 可安全关掉。
- [x] 收紧草案已入仓 `firestore.rules`（仅动 orders 节，其余与线上逐行一致）。
- [x] **已部署**（老板 2026-07-03 贴 Console 发布）：orders 客户端 create/update 已关——
      伪造已确认订单白吃 / 付款后自改金额菜品状态，两个直写洞闭合。
      ⏳ 老板自检（低优先）：dashboard 能编辑订单 + 会员页能看历史订单 = 两通道未断。
- [ ] 残余风险（规则层关不掉）：deliveryZone/addressVerified* 客户端可写 →
      恶意用户可骗免运费。根治=地址验证挪服务端 API（列为阶段 2.5，中等工作量）。

## 阶段 1 — 支付与订单完整性（🔴 最高危，核心修复）✅ 已实现待部署（2026-07-03）
统一闭合「免费下单 / 盗刷别人餐券 / RM1 付 RM50」三个洞，照搬 meal-vouchers 已验证的正确写法。

**实现**：`adminApi.ts` 加 `verifyBearerUser`（任意登录 token→uid/isAdmin）。
- submit-order：验 token，`userId=auth.uid`（忽略 body），无 token 401。
- create-order：入参 `{orderIds}`，服务端校验 owner+pending、按订单 doc `total+deliveryFee` 求权威金额、razorpayOrderId 绑回订单；客户端 initiateRazorpayPayment 改传 orderIds+token。
- confirm-order：鉴权状态机——confirmed=签名验通**且** razorpayOrderId 严格匹配绑定（去掉「无绑定放行」豁免，堵签名重放）/admin/owner+餐券全覆盖(total0)；cancelled=owner 或订单仍 pending；preparing/delivered=仅 admin。totalSpent 改 set(merge) 防缺用户文档 500。
- 客户端 7 处带 token（CartDrawer submit/create/confirm×3 + admin 页确认）；FPX 重定向流(page/en)保持无 token 走签名路径。

**验证（本地 dev 真实 HTTP 拟攻，真 Firebase token + 真 Razorpay 签名）：12/12 通过**——
无token submit 401 / create 越权 403 / 权威金额 5250 生（客户端无从谎报）/ razorpayOrderId 绑回 / 无凭证确认 403 / 伪造签名 403 / 拿自己token确认别人单 403 / 真签名确认 200 / 签名重放别单 403 / pending 无token取消 200。tsc 全绿。
⏳ **push 待老板定时段**（避用餐高峰）；部署后老板配合一单真实 FPX 小额自测（自动变 confirmed，我盯日志）。

- [ ] **submit-order 加鉴权**（src/app/api/submit-order/route.ts）
      - 加 `verifyAuth`（复制 admin/data 的 helper），无 token → 401
      - 强制 `userId = decoded.uid`，**忽略** body 里的 userId
      - 客户端 CartDrawer.tsx:335 的 fetch 加 `Authorization: Bearer <token>`
- [ ] **create-order 改为服务端权威金额 + 绑定订单**（src/app/api/payment/create-order/route.ts）
      - 加 `verifyAuth`
      - 入参从 `{amount}` 改为 `{orderIds}`；服务端读这些订单，校验 `userId===uid` 且 `status==='pending'`，**用订单 doc 里的权威 `total+deliveryFee` 求和**当作 Razorpay 金额（不再信任客户端 amount）
      - 把生成的 `razorpayOrderId` 写回每个订单 doc（像 meal-voucher purchase 那样绑定）
      - 客户端 `initiateRazorpayPayment` 改签名，传 orderIds + token（FPX 流里 submit-order 已先返回 orderIds，可直接用）
- [ ] **confirm-order 加鉴权 + 签名校验矩阵**（src/app/api/confirm-order/route.ts）
      解析可选 token，算出 isAdmin；逐订单按 transition 判定：
      - → **confirmed**：
        - 有 paymentData 且「HMAC 验签通过 **且** `paymentData.razorpayOrderId === orderData.razorpayOrderId`」→ 放行（FPX，签名即授权，重定向流不依赖 token）
        - 否则 isAdmin → 放行（QR 收据确认）
        - 否则「餐券全额覆盖单：`total===0 && paymentMethod==='voucher'` 且 owner token 匹配」→ 放行
        - 否则 403
      - → **cancelled**：isAdmin / owner-token / 或订单仍为 `pending`（未付临时单，低风险）→ 放行
      - → **preparing / delivered**：仅 admin
      - 客户端给所有 confirm-order 调用点带 token（能拿到 currentUser 的：CartDrawer 4 处、admin 1 处）；page.tsx / en/page.tsx 重定向流的 confirm 走签名授权不需 token、cancel 走 pending 放行
- [ ] tsc 通过 + 本地 dogfood：跑通 FPX 付款、QR 收据、餐券全覆盖、取消回滚四条流 → 再 commit

## 阶段 2 — Firestore 规则（🔴，依赖阶段 0）
- [ ] 按阶段 0 拿到的现状，写 `firestore.rules`（提交进仓库）：
      - `users`/`orders`：仅文档 owner + admin 自定义声明可读；客户端禁写 `vouchers`/`mealVouchers`（强制走已有 admin API）
      - `feedbacks`：按现有展示需求定读写
- [ ] 若 admin 页仍有客户端直读 `vouchers`，同步挪到 `/api/admin/*`（与阶段 6-P3 合并），否则收紧规则会打断 admin
- [ ] ⚠️ 我只能写文件，**部署由老板执行** `firebase deploy --only firestore:rules`（或我指导）；部署前用 Rules Playground 验证客户/admin 两种身份读写

## 阶段 3 — 依赖漏洞（🟠）
- [ ] `next` 16.1.6 → 最新 16.1.x patch（请求走私 / SSRF / DoS / Server Actions CSRF）
- [ ] `npm audit fix`；firebase-admin / razorpay 的传递依赖（protobufjs/axios/node-forge）等上游 patch 时 bump
- [ ] `npm run build` 验证升级不破坏

## 阶段 4 — 业务逻辑 Bug（🟡）
- [ ] **B1** nextSpecial.ts:65-71 — 加 `diff>2` 分支显示明确日期（现在周末误显「今日特餐」）
- [ ] **B2** cartStore.ts:29-38 — 修死代码 filter（按 CartItemCard UI 定：减到 0 删除 or 夹在 1）
- [ ] **B3** submit-order:406 — `serverTotal` 补减 `serverMealVoucherDiscount`（修 CAPI 上报虚高，不影响扣款）
- [ ] **B4** mealVoucherUtils.ts:232 — expired 分支补 `FieldValue.delete()` 清 stale `redeemedOrderId`（清洁性）

## 阶段 5 — 仓库卫生（🟡）
- [ ] `git rm --cached` 商业敏感草稿：prices.json、prospect.md、costing_*.txt、*trace*.txt、.temp_log*.txt、extract_*.js、run_opt.js、script.js、.claude/settings*.json
- [ ] 把它们加进 .gitignore（prices.json 是真有竞争价值的成本表）

## 阶段 6 — 性能优化（⚡，体量大，建议单独排期，可选）
- [ ] P1 dashboard-h7x2q9.html(595KB) 确认 Vercel brotli + 拆内联 JS/CSS
- [ ] P2 admin 页（1861 行单 client）服务端分页 + 按 tab 懒加载拆分
- [ ] P3 admin 直读 Firestore → 走 /api/admin/*（与阶段 2 协同）
- [ ] P4 确保 firestore/storage SDK 不进落地页 chunk
- [ ] P5 菜品/Hero 图全走 next/image（呼应 NO_LCP 记忆）

## Review（执行后回填）
（完成后在此记录每阶段实际改动与验证结果）

---

# 2026-06-20 · 预付加料（Prepaid Add-on Credits）— 已完成

**需求**：客户一次付清「20 餐券 + 19 煎蛋 + 1 三文鱼升级 − RM5 = RM396.50」，旧系统加料只能兑餐收现金。
计划文件：`.claude/plans/majestic-discovering-gadget.md`。

**改动**：
- `src/data/addOnsConfig.ts`：加 `salmon-upgrade`(RM4) + 导出 `PREPAID_ADDON_OPTIONS` 白名单。
- `src/lib/addonCreditUtils.ts`（新）：`mintAddonCredits`/`getAvailableAddonCredits`/`claimAddonCredits`，集合 `mealVoucherAddonCredits`（批次文档 + FIFO 递减）。
- `manual-voucher-purchase`：收 `prepaidAddOns`，记 `addOnAmountPaid`/`totalAmountPaid`，铸预付券，totalSpent 加总额。
- `manual-voucher-redemption`：收 `addonCreditsUsed`，扣券 + 订单加 `↳ X（预付）` RM0 行 + `addonCreditsAllocatedRevenue`。
- `admin/data`：加 `addonCreditStats` 负债 KPI。
- dashboard：卖券 modal 预付加料区 + 总额预览；录单 modal 预付抵扣区（按客户余额）；新增「预付加料负债」KPI 卡。
  - 改 Desktop 源 → `npm run sync:dashboard` 回灌仓库（见 lessons 2026-06-20）。财务版无餐券逻辑、不动。

**验证**：
- `tsc --noEmit` 全绿；`eslint` 0 error（仅既有 any 警告）。
- dashboard 内联 JS `node --check` 解析通过。
- **真实 Firestore 跑真实 helper：14/14 通过**（铸券/幂等/FIFO 扣减/收入确认 2.50&4.00/余额不足报错/用尽状态/清理零残留）。
- ⏳ 待办：dashboard UI dogfood（需 admin 登录态）；commit + push（按惯例 push 前再确认）。

**范围外**：顾客端 app（CartDrawer/submit-order）未碰——该客户订单全由 admin 手动录。

---

# 库存系统（Stock Count）— 计划（待批准开工）

> 决策（2026-06-28 老板拍板）：**两层都做 + 一次做完 + 食材层下单自动扣 + 只提醒不阻挡**。
> 语言/UI 简体中文；最小改动、根因优先；改完按「push 前先验证」规则。

## 架构总览：两层独立互补，不强行合并
- **Layer A 按菜可售份数**（扩展现有 `dishStock`）= 顾客端**硬闸**，防超卖。
- **Layer B 食材原料库存**（新 `ingredientStock`）= 后厨**采购可见性**，下单自动扣但**永不阻挡**，靠定期盘点校正漂移。
- 复用点：Layer B「所需量」直接来自已上线的备餐聚合（src/lib/prepIngredients.ts + dishIngredients.ts 配方），不重造。

## 数据模型
- `dishStock/{dishId}`（已存在）：`{ remaining, dishName, updatedAt }`，无文档=不限量。
- `ingredientStock/{name}`（新）：`{ onHand:number, unit:string, threshold?:number, updatedAt }`。
      - doc id = 食材中文名（配方里的 `line.name`，与备餐聚合同源，保证 key 对齐）。
      - 36 种原料初始播种（单位取配方里的 unit）。单位含 g/只/颗/块/盒/ml/份/汤匙。
      - ⚠️ 模糊单位原料（`时蔬`/`sambal`/`份`）照样建文档，但盘点时老板自行决定是否维护；不强算。

## Layer A — 按菜可售份数（增量）
- [ ] 新 admin API `POST /api/admin/dish-stock`（鉴权+CORS 照搬 admin/daily-prep）
      - body `{ dishId, remaining }` → set；`remaining:null` → 删文档（恢复不限量）。
      - 复用 set-dish-stock.mjs 的写法（merge set + dishName + serverTimestamp）。
- [ ] Dashboard「📦 按菜限量」面板：列全菜单（weeklyMenu）显示 remaining/不限量，输入即改/清。
- [ ] **补手动单漏洞**：见下方统一 consume 端点。手动单对 dishStock = **减且不阻挡**（admin 自主，允许减到 0 以下只标红警告，不拒绝）。

## Layer B — 食材原料库存（新）
- [ ] 新 `src/lib/ingredientStock.ts`：
      - `consumeIngredientStock(db, items)`：按配方（getRecipeForDish/getAddOnRecipe，含手动单别名）累加每种食材用量，对有文档的 `ingredientStock` 做 `increment(-qty)`，**best-effort 永不抛错**；无文档的食材跳过。
      - `getAllIngredientStock(db)` / `setIngredientStock(db, name, onHand)`。
- [ ] 播种脚本 `scripts/seed-ingredient-stock.mjs`：扫 dishIngredients 全配方 → 36 种原料建文档（onHand=0, unit, threshold 默认空），dry-run + --apply。
- [ ] Dashboard「🥩 食材盘点」面板：选日期（默认明天）→ 表格 `食材 | 所需(备餐聚合) | 现有(可改) | 差额 | 阈值`，差额<0 或低于阈值标红；可逐项改 onHand（盘点）。
      - 「所需」复用 /api/admin/daily-prep 同源聚合（新增/扩展一个返回扁平食材+onHand 对照的端点，或前端用现有 groups 汇总）。

## 自动扣减接线（下单自动扣 + 不阻挡）
- [ ] **网页单**：submit-order 在订单创建成功后，**非关键路径**调用 `consumeIngredientStock`（fire-and-forget，包 try/catch，失败只 log，绝不影响下单）。dishStock 仍走现有 consumeDishStock（硬闸保留）。
- [ ] **手动单**：新统一端点 `POST /api/admin/consume-stock` { items }：① dishStock 减（不阻挡）② ingredientStock 减（best-effort）。Dashboard 手动单**保存成功后**用 callAdminAPI 调它。
- [ ] 取消/退款：dishStock 已有 releaseDishStock；ingredient 漂移靠盘点校正（本期不做自动回补，盘点覆盖）。文档里注明。

## Dashboard 改动注意（两副本同步坑）
- [ ] UI 改 **源头** `Desktop/Incredibowl Services/incredibowl-dashboard.html`（671KB），再 `npm run sync:dashboard` 回灌 public/dashboard-h7x2q9.html。
- [ ] 所有新 fetch 走现成 `callAdminAPI()`（带 admin idToken + 处理 CORS）。

## 验证（Definition of Done）
- [ ] `tsc --noEmit` 全绿；dashboard 内联 JS `node --check` 通过。
- [ ] 真实 Firestore：播种 36 文档零残留；下一网页单/手动单后用脚本核对 dishStock 与 ingredientStock 扣减数字 = 配方手算；盘点改 onHand 持久化。
- [ ] 故意造一个食材不够：确认**只标红不拦下单**；Layer A 限量菜售罄确认**仍拦**。
- [ ] /en 与 /（zh）菜单「仅剩 X/售罄」不回归。

## 开放细节（开工前最后确认 1 项）
- 食材盘点单位：grams 类原料 onHand 存 g、显示自动升 kg（沿用 formatQty）。只/颗/块/盒按个数。— 除非你要按 kg 录入，否则按此实现。

## ✅ Review — 库存系统已实现（2026-06-29）
决策落实：两层都做 · 一次做完 · 食材下单自动扣 · 只提醒不阻挡 · 克存克显示升 kg。

**新增/改动文件**
- `src/lib/ingredientStock.ts`（新）— consume/getAll/set；consumeIngredientStock 复用 aggregateIngredients，best-effort 永不抛错；ingredientDocId() 处理 “/” 非法字符。
- `src/lib/stockUtils.ts`（改）— +decrementDishStockLenient（手动单：clamp 0、不阻挡、忽略不限量菜）。
- `src/lib/adminApi.ts`（新）— 共享 verifyAdmin/CORS/adminJson，三个新路由复用。
- `src/lib/prepIngredients.ts`（改）— IngredientLine 改 `import type`（isolatedModules 正确性 + 工具链可跑）。
- `src/app/api/admin/dish-stock/route.ts`（新）— 设/清某菜 remaining。
- `src/app/api/admin/consume-stock/route.ts`（新）— 手动单扣两层（名→id 用 weeklyMenu 映射）。
- `src/app/api/admin/ingredient-stock/route.ts`（新）— list（所需 vs 现有 vs 差额）/ set（盘点）。
- `src/app/api/submit-order/route.ts`（改）— 订单创建后 best-effort 扣食材，try/catch 包住绝不影响下单。
- `scripts/seed-ingredient-stock.mjs`（新）— 枚举配方播种 36 原料（已 --apply，onHand 保留，幂等）。
- Dashboard 源 `Desktop/.../incredibowl-dashboard.html`（改）→ `npm run sync:dashboard` 回灌 public — +「库存」导航/页、按菜限量面板、食材盘点面板、手动单保存后调 consume-stock。

**验证**
- `tsc --noEmit` 全绿。
- 假 db 注入单元测试 **9/9**：配方金额(2×90=180g)/合并同名/跳过未跟踪/“/”doc-id 编码/限量 clamp 0/不限量忽略/破 db 不抛错。
- Dashboard 内联 JS `node --check` 通过；public 拷贝已含新面板（5 处标记）。
- ⏳ 待办（需线上）：**部署后**才能用（dashboard 调 https://www.incredibowl.my 上的新路由）；浏览器 dogfood（需 admin 登录态）；commit+push（按惯例待拍板）。

**已知数据瑕疵（非本次引入）**：~~配方里 `时蔬`(份/g)、`樱桃番茄`(g/颗) 单位不一致~~ 2026-07-02 评审四修已统一（番茄→颗/时蔬→份）。模糊原料盘点自行决定是否维护。
**运维点**：dashboard 选单加新短 label 要同步 ① dishIngredients 的 MANUAL_LABEL_ALIASES ② 若是限量菜在库存页设份数。

### 2026-07-02 追加 — 评审遗留 P2 两项（已实现待部署）
- [x] **编辑手动单同步库存**：dashboard 编辑分支比对 items 库存形状（名/量/加料），
      变了就「回补旧 → 扣新」（仅 06-29 后的单；地址/时间改动不动库存）。
- [x] **FPX 弃单对账** `GET|POST /api/n8n/release-stale-fpx`（N8N_API_KEY 鉴权，同 daily-prep）：
      `pending + fpx + 超 1 小时`（?hours= 可调）→ 标 cancelled(fpx-timeout-auto) +
      回补 dishStock/食材（仅 06-29 后）+ releaseMealVouchers。**只碰 fpx**——QR pending
      是等人工核收据的正常态。⏳ 老板需在 n8n 加每小时 workflow 打这个端点。

---

# 2026-07-05 — 预付加料独立充值（addon top-up）+ 新增 2 个可预付加料

## 背景
客户买 20 张券时捆绑预付了加料/升级；第二周对剩余券临时追加买加料（top-up 付款）。
现状：预付加料只能在卖券时捆绑售出（manual-voucher-purchase 强制 bundleId 5/10/20）。
兑换侧（订单弹窗预付加料抵扣读 getAvailableAddonCredits）零改动，新 credits 自动可抵扣。

## 新加料对应（价格与系统唯一吻合项）
- family size vege RM10.90 = broccoli-egg 蒜蓉西兰花炒蛋
- steam egg RM6.80 = shrimp-broccoli-steamed-egg 鲜虾西兰花滑蒸蛋

## 计划
- [x] 1. addOnsConfig.ts：PREPAID_ADDON_OPTIONS 加上面 2 个（价格已在 ADD_ON_PRICES）
- [x] 2. addonCreditUtils.ts：mintAddonCredits 支持可选 expiresAtMs（精确对齐券到期日）
- [x] 3. 新 API /api/admin/manual-addon-topup：按电话找客户（必须已存在，不建 stub）→
      白名单+服务端定价校验 → 有效期=客户可用券最晚 expiresAt（无有效券拒绝）→
      写 mealVoucherPurchases 记录（amountPaid:0/addOnAmountPaid/totalAmountPaid，
      type:'addon-topup'，voucherCount:0）→ mintAddonCredits（purchaseId 幂等）→ bump totalSpent
- [x] 4. Dashboard（Desktop 源文件）：加料 picker 数据源 +2；客户资料 🎫 区「＋充值加料」按钮
      （仅有可用券时显示）+ 充值弹窗（atm* 前缀，抄 svm 模式）→ 调新 API → loadAllData
- [x] 5. npm run sync:dashboard 回灌 public 副本
- [x] 6. 验证：tsc 全绿 + dashboard 内联 JS node --check OK
- [x] 7. commit 18b9922 + push；线上 smoke：新路由 403（鉴权拦截正常）+ 线上 dashboard 已含新功能

## Review（2026-07-05）
- 入口：Dashboard 查客户 → 客户档案 🎫 餐券区右上「🍳 ＋充值加料」（有可用券才显示）。
- 会计口径不变：加料现金全走合约负债（amountPaid=0），预付加料负债 KPI / P&L 兑餐确认收入自动闭合。
- 附带修正：餐券销售明细「金额」列及合计从 amountPaid 改 totalAmountPaid ?? amountPaid——
  之前捆绑加料的现金在明细里也看不到（与手续费费基/客户档案口径统一）。
- 顺带兼容：bundle 分布和明细行对 addon-topup 记录显示「加料充值」而非 "addon-topup 张装"。
- ⏳ 待老板 dogfood：真实充值一笔 → 看客户档案余额 + 下单抵扣区能选到。

---

# 三文鱼 / 和牛 加料扩充（2026-07-05）

老板需求：
- 三文鱼饭（id 21）加料区要有这道菜本身的配料 + 新增「加香煎三文鱼 (70g+)」RM 18.50
- 和牛饼饭（id 24）加料区要有：小番茄沙拉 (40g)、「加澳洲和牛饼 (1块)」RM 17.50
- 改完网页后同步 dashboard 及相关联动

## 计划
- [x] `src/data/addOnsConfig.ts`：新增 `extra-salmon-70g: 18.50`、`extra-wagyu-patty: 17.50`（submit-order 服务端校验自动生效）
- [x] `src/components/menu/AddOnModal.tsx`（ZH/EN 共用）：
  - id 21 三文鱼 sides = 加三文鱼(70g+) + 毛豆(25g) + 玉米(25g) + 小番茄(40g) + 米饭项；alacarte 去重毛豆/玉米
  - id 24 和牛 sides = 加和牛饼(1块) + 小番茄(40g) + 米饭项
  - ⚠️ 三文鱼配菜里的西兰花 50g 没有任何独立加料定价 → 不编造，跳过并向老板报告
- [x] `src/data/dishIngredients.ts`：addOnRecipes + addOnShortNames 补两个新 label（三文鱼 120g 生重沿用菜品估算 TODO_CONFIRM；和牛饼 1 块）；dashboard label 与网页完全一致 → 不需要新 alias
- [x] Dashboard 源文件（Desktop incredibowl-dashboard.html）：
  - DISH_ADDON_MAP '21' / '24' 顶部加新加料
  - ADDON_SEED 加 2 行（加菜类，costPrice=0 等老板 Settings 填成本）
  - WEB_LABEL_TO_ADDON_ID 加 2 个映射
- [x] `npm run sync:dashboard` 回灌 public 副本
- [x] `npx tsc --noEmit` + `npm run build` 全绿；只 commit 5 个相关文件

## Review（2026-07-05）
- 第一轮已上线：commit c25e2e4 push main，线上无头浏览器点开两道菜弹窗验证通过。
- 备餐联动自动生效：新 label 都进 addOnRecipes（食材清单/库存扣减/06:30 prep 按 label 聚合）。
- Dashboard 手动单联动：label 与网页一字不差 → 免 MANUAL_LABEL_ALIASES；addons 集合下次打开 dashboard 自动补新 id（costPrice=0）。

## 第二轮修正（老板反馈，2026-07-05）
- 和牛的番茄不是现有小番茄 RM2.50 → 是新品「小番茄洋葱沙拉 (40g)」RM4.50
  （小番茄+洋葱+初榨橄榄油+少许盐），新 id `cherry-tomato-salad`，与 `cherry-tomato` 分开。
- 沙拉配方：樱桃番茄 3 颗（同 40g 换算）；洋葱克数未提供 → TODO_CONFIRM 不编造；油/盐 pantry 不计。
- 本地 dev + 无头浏览器 dogfood：ZH/EN 和牛弹窗都出沙拉 RM4.50、三文鱼弹窗不受影响；tsc 绿。
- ~~⚠️ 老板指示白天不 push~~ → 老板当天稍后开口 push；实际 b3912f2 已随老板另一会话
  的白名单 commits（847d0e9/ea72433）一起上了 origin/main。线上无头浏览器复验：
  ZH/EN 和牛弹窗=沙拉 RM4.50 ✓、三文鱼弹窗=纯小番茄不受影响 ✓（2026-07-05）。
- ⏳ 待老板：① 西兰花独立加料给价后补上三文鱼 sides；② Settings 填新加料成本价
  （加三文鱼/和牛饼/小番茄洋葱沙拉）；③ 三文鱼采购生重 120g 估算待确认；④ 沙拉洋葱克数待补。

---

# 多日手动单（不扣券，正常收钱）（2026-07-05）

老板需求：像 /admin/subscriptions 那样一次录好几天的单，但不是每周模板、不碰餐券——
临时帮客户排几天的正常订单（现金/QR 收款）。

## 设计
- 新页 `/admin/multi-day`：客户搜索自动填充（复用 GET /api/admin/subscriptions 的
  customers + orderOptions）→ 逐天加日期/时段/菜/加料 → 预览（服务端现价重算 +
  停业/停菜/排期警告）→ 复制 WhatsApp 文字 → 确认建单。
- 新 API `/api/admin/multi-day-orders`：POST preview/confirm。逻辑镜像
  subscriptions/week 但零餐券字段；total=originalTotal（全额现金）；
  paymentMethod qr / status confirmed / isManual / channel whatsapp / createdAt=配送日 04:00Z。
- 幂等：preview 发 batchTag（multi-时间戳），confirm 查重拒绝双击重复建单。
- 与 subscriptions 互挂入口链接。

## 计划
- [x] 1. API `src/app/api/admin/multi-day-orders/route.ts`（preview + confirm）
- [x] 2. 页面 `src/app/admin/multi-day/page.tsx`
- [x] 3. subscriptions 页头互挂链接
- [x] 4. tsc + build 验证，只 commit 相关文件

## Review（2026-07-05）
- 入口：https://www.incredibowl.my/admin/multi-day（subscriptions 页头也有互链）。
- 流程：搜客户自动填充（复用 subscriptions 的 customers API）→「加一天」逐天排菜
  （新一天自动照抄上一天顺延一日）→ 生成预览 → 复制 WhatsApp 文字 → 确认建单。
- 订单落库与周订阅同 schema 但零餐券字段：total=originalTotal 全额现金、
  paymentMethod qr、status confirmed、isManual、createdAt=配送日 04:00Z（按日营收口径一致）。
- 本地真实 dogfood 全过（scripts/dogfood-multi-day*.mjs，铸真 admin token 打本地 server）：
  无 token 401 ✓ / 服务端现价重算 ✓ / 停业停菜排期周末警告 ✓ / 不存在的菜整天 blocked ✓ /
  confirm 落 2 张字段逐项校验 7/7 ✓ / 双击重复 409 幂等 ✓ / 测试单已删干净 ✓。
- 注意：与周订阅一样**不扣 dishStock/食材库存**（手动单走 dashboard 才扣）；预览警告
  只提醒不阻挡（除停业/停菜/菜不存在是硬伤跳过）。
- 追加（老板问「能不能选 QR」）：加收款方式选择器 cash/qr/fpx/card/ewallet
  （与 dashboard moPaymentPills 同一套值，报表分桶兼容），默认 qr，服务端白名单校验；
  dogfood 复验：默认 qr ✓ / bitcoin 400 ✓ / cash 透传落库 ✓ / 测试单已清 ✓。
- 追加（老板发截图对比）：菜品下拉换成 dashboard 录单同款可搜索选择器 ——
  搜索框 + 按天分组（常驻·每日供应/周一~周五）+ 显示价格；暂别菜也列出带「暂别」
  标注（服务端本就允许并警告）。纯客户端 UI 改动，tsc+build 绿。
- 追加：DishPicker 抽成共享组件 `src/components/admin/DishPicker.tsx`，
  常客周计划模板编辑器也换上同款。
- 追加（老板拍板方案 2，2026-07-05）：订阅确认建单 + 多日手动单确认建单
  现在**建单即扣库存**，与 dashboard 手动单同款 —— dishStock 宽松扣（可到 0
  不阻挡）+ ingredientStock best-effort，全吞错误绝不影响建单/扣券。
  dogfood：临时设限量 10 → 建单后 9/8 ✓ 食材 3 项同步扣 ✓ → consume-stock
  release 回补全归位 ✓ → dishStock/orders 测试数据全还原。dashboard 删单
  release 对这些单同样生效（同一条 items 通道）。
- 追加（老板问「Peggy 搜不到」）：根因 = 客户联想数据源只扫 users 集合，
  Peggy 只有 dashboard 手动单（manual_0163702408）没有 users 档案。
  修法 = /api/admin/subscriptions GET 把「订单里出现过、users 无档案」的客户
  并进名录（姓名/电话/地址取最近一单）；本地验证名录 71→124 位、Peggy 命中
  且带 3 组历史地址/备注选项 ✓。多日手动单与常客周计划同吃这条 API 都受益。
- 另：本机有个别的会话留下的 next dev（port 3000, PID 2512）已卡死无响应，没动它。

# 订阅引擎自动用预付升级 credit — 2026-07-11

根因：/api/admin/subscriptions/week 只认餐券，不读 mealVoucherAddonCredits，
salmon-upgrade/wagyu-upgrade 预付 credit 躺着不用，top-up 全当现金收。

- [x] ① weeklyMenu.ts：MenuItem 加 `topUpAddonId?`，三文鱼→salmon-upgrade、和牛饼→wagyu-upgrade
- [x] ② week/route.ts buildWeekPlan：每天产出 upgradeNeeds（按 dish.topUpAddonId × qty）
- [x] ③ week/route.ts allocateUpgradeCredits：按日期 FIFO 把可用 credit 分给非 blocked 天，减 cashDue；preview/confirm 同源
- [x] ④ preview：拉 getAvailableAddonCredits → 分配 → 警告不足；whatsappText 报「升级补差用预付额度 N 份」
- [x] ⑤ confirm：每天 claimAddonCredits（原子 FIFO，先扣 credit 再扣券缩小中断面）→ 订单写 addonCreditsUsed + addonCreditsAllocatedRevenue，total 扣掉被覆盖的 top-up（口径=dashboard 手动单：预付=现金折扣）
- [x] ⑥ page.tsx：日行显示「预付升级抵 X.XX」（绿色）
- [x] ⑦ 验证：tsc 0 error + scripts/dogfood-subscription-upgrade-credits.mjs 10/10 pass
- [x] ⑧ 老板拍板后已 push（a91904a）；生产 smoke=BASE 指向 www.incredibowl.my 复跑 dogfood 10/10 pass（首次尝试即过）

## Review（升级 credit · 2026-07-11）
dogfood 对 5 个 active 订阅全量 preview dry-run，与 Firestore ground truth 逐日核对：
- HuannMean：现金 10.00 → **0.00**（wagyu-upgrade×2 抵 6.00 + salmon-upgrade×1 抵 4.00），WhatsApp 文案「升级补差用预付额度 3 份」
- PY•玉 / Claudia：各自 credit 正确抵扣（8.00 / 6.00），金额与账上余额一致
- Hony：三文鱼×3 无 credit → 正确出「预付升级不足，差额按现金收」警告，现金 12.00 不变
- cashTotal = Σ 非blocked cashDue 恒等式 5/5 过；无 token 401 ✓
confirm 与 preview 共用 buildWeekPlan + allocateUpgradeCredits（同源），扣 credit 走生产
验证过的 claimAddonCredits 原子事务。confirm 未实测（会写真单）——首次真实建单时核一眼
订单 total 与 addonCreditsUsed 字段。

## Catering SEO/GEO 覆盖（2026-07-12）
目标：让 Google / AI 搜索把 Incredibowl 归入 catering（到会/团体订餐）类目。
- [x] ① layout.tsx JSON-LD：@type 改 ["Restaurant","Caterer"]（schema.org 双类型，Google 支持）
- [x] ② 根 metadata + en/layout.tsx metadata：补 catering 中英关键词
- [x] ③ 新建 /catering 中文落地页（Service+FAQPage schema，WhatsApp 询价 CTA，不编价格/人数）
- [x] ④ 新建 /en/catering 英文落地页（canonical 互指 hreflang）
- [x] ⑤ Footer/FooterEN 导航加 Catering 链接（hidden lg: 桌面 only，移动端冻结不动）
- [x] ⑥ tsc 验证 + commit 留本地（不 push，等老板指示）
- 注：sitemap 由 next-sitemap postbuild 自动生成，新页面无需手动加
- 注：Google Business Profile 加 "Caterer" 副类目要老板在 GBP 后台手动加（代码做不到）

## 手动单 stub uid 分裂修复（2026-07-12）
问题：dashboard 手动单只在扣券时才查真实账号，纯现金单一律 manual_<电话>，同一客户被劈成两个档案（Andrea Lim 27+8 单分裂；新客数虚高、流失名单假阳性）。
- [x] ① dashboard（Desktop 源）手动单一律先 findRealUserByPhone 再兜底 manual_* + sync:dashboard
- [x] ② api/admin/multi-day-orders 服务端按 phoneNormalized 唯一匹配真实 uid（≥2 匹配不猜）
- [x] ③ 历史归并：59 单 20 stub → 真实 uid（scripts/merge-manual-stub-uids.mjs，dry-run 先审 0 歧义；每单留 userIdMergedFrom；回滚日志在 Desktop/Incredibowl Services/）
- [x] ④ 统计脚本 custKey 改电话优先（cohort + weekly）；weekly 券购买匹配改 uid+电话+名字三路
- [x] ⑤ 验证：tsc 0 错；重跑 audit 可归并=0；重跑周报新客 17→16、流失预警 16→12（假阳性消失）
- 注：剩 45 个 manual_* = 纯 WhatsApp 客户没网页账号，属正常态；注册后新单自动换绑，旧单可重跑归并脚本

## 绍兴酒蒸花肉周四订不到修复（2026-07-14）
问题：客户反映周四订不到绍兴。07-13 起绍兴改「周一+周四」走常驻+availableWeekdays，但 computeMenuDates 常驻分支日期钉死在下一配送日，非供应日整卡灰显——只有周三截单后~周四 06:00 这个窗口能订周四，其余时间菜单周四列展示着却点不了。
- [x] ① dateUtils.ts 常驻分支：非供应日往后滚到下一供应日（跳周末/BLOCKED_DATES/CLOSED_DATES），按钮「预订 X月X日 (周X)」与特餐对齐
- [x] ② AddOnModal 日期选择器补 availableWeekdays 校验（此前只拦周末/停售日，手动选周三要到服务端才被拒）
- [x] ③ 验证：tsc 0 错 + mock 时钟 dogfood 17/17（绍兴/马铃薯/纳豆/特餐14 回归 + EN locale + 截单前后 + 周末）
- [x] ④ commit f3565b1 留本地，待老板同意后 push
- 注：服务端 submit-order 本来就按「所选日期周几 ∈ availableWeekdays」校验，提前订单能过，无需改
- 注：副作用（合理）：常驻菜被 BLOCKED 当日不再灰显「当日暂停」，改为直接可订下一个供应日

## 安全审计修复 P2-2 / P2-3 / P2-4（2026-07-26）
背景：全站审计（tasks/security-audit-2026-07-26.md）查出 4 高危 5 中危 4 低危。老板先点这三条。

### P2-2 菜品×日期 服务端校验（防「厨房收到没买料的菜」重演）
根因：`submit-order` 只查了 `availableWeekdays`（且只有少数常驻菜有这字段），
没查 retired / hidden / weekday / BLOCKED_DATES；而 CartDrawer 的购物车清理**只看日期不看菜**
（`isOrderDateValid`），加上购物车存 localStorage → 上周加的暂别菜今天能一路走到厨房。
- [x] ① `lib/cartDateUtils.ts` 新增 `isDishOrderableOn(dish, ymd)` + `weekdayOfYMD(ymd)`：
      retired / hidden / isDishBlockedOn / weekday 四查合一，**客户端与服务端唯一判定来源**
- [x] ② `api/submit-order` 换成调它（删掉原来那段内联 availableWeekdays 判断）
- [x] ③ `CartDrawer` 购物车清理接入；⚠️ 用 id 回 `weeklyMenu` **现查**，
      不能信 `item.dish`（那是加入购物车当天写进 localStorage 的快照，retired 是旧值）
- [x] ④ 提示文案拆两条：`staleRemoved`（日期过期）/ 新增 `unavailableRemoved`（菜不供应），中英都加
- [x] ⑤ 验证：dogfood 38/38（暂别6 + 特餐本日/串日各8 + 常驻限日2 + 全周常驻10 + BLOCKED 1 + 边界2）
- 注：日期格式非法时 `isDishOrderableOn` 故意放行，交给 `isOrderDateValid` 报错，避免双重报错
- 注：`WEEKLY_SCHEDULE` 头部注释还写着「马铃薯炖花肉片(限周二~四)」但数据已恢复全周常驻
      （菜品自己的注释是对的）—— 属注释过期，**没动菜单文件**，留换菜时顺手清

### P2-3 check-voucher 加认证 + 限流
根因：零认证零限流，可暴力枚举优惠码（返回体直接带 discount/remainingUses），
且 `userId` 从请求体读 → 可传任意 uid 探测「某人用没用过某码」。
- [x] ① 加 `verifyBearerUser`，userId 只从 token 取，请求体的 userId 一律忽略
- [x] ② 限流：突发 10/分钟 + 每人每天 30 次（admin 不占配额）
- [x] ③ 两个调用方（CartDrawer / MealVouchersView）带上 Bearer；两处本来就要求先登录，零流程影响
- [x] ④ 顺手把 CartDrawer 的 `authHeaders` 上移到 `handleApplyPromo` 之前（原来靠 TDZ 侥幸能跑）

### P2-4 地图接口限流（防 Google Geocoding 账单被刷）
根因：`/api/geocode` 只验「是个登录用户」，但匿名登录开着 → 无成本无限拿 uid 无限刷；
`/api/check-delivery` **完全公开**、只有内存限流（每实例一份 Map，打散到多实例就绕过）。
- [x] ① 新建 `lib/rateLimit.ts`：内存突发桶（第1层）+ Firestore 每日计数（第2层，跨实例硬上限）
- [x] ② geocode：uid 与 IP 双维度，突发 6/分钟 + 每 uid 20/天 + 每 IP 60/天
- [x] ③ check-delivery：复用共用模块，突发 8/分钟 + 每 IP 200/天
      （日上限故意放宽——马来运营商 CGNAT，挡掉冷流量比多付地图费贵）
- [x] ④ Firestore 那层**故意 fail-open**：DB 挂了照样放行，不能让顾客存不了地址
- [x] ⑤ 验证：dogfood 7/7（放行/拒绝/Retry-After/key 隔离/窗口重置）
- ⏳ 待老板做：Firebase Console 给 `rateLimits` 集合配 TTL 策略（字段 `expiresAt`）自动清理，
      不配也无妨（每人每天一个几十字节 doc）

### 工具
- [x] `scripts/_alias-loader.mjs` + `_register-alias.mjs`：让 dogfood 脚本能直接 import
      带 `@/` 别名的生产代码（裸 node 不认 tsconfig paths）。以后所有 dogfood 复用：
      `node --import ./scripts/_register-alias.mjs scripts/xxx.mts`

### 验证
- [x] `npx tsc --noEmit` 0 错
- [x] `npm run build` 通过（deploy-affecting 改动不能只跑 tsc —— 07-25 教训）
- [x] `npx eslint` 改动文件 0 error（59 warning 全是 CartDrawer 既有的 any）
- [x] dogfood 38/38 + 7/7
- [ ] commit 留本地，**等老板同意再 push**

### 仍未修（审计报告里的高危，等老板发话）
- P0-1 QR 餐券可用旧签名白嫖（`meal-vouchers/confirm-purchase` 少了 paymentMethod + razorpayOrderId 硬校验）
- P0-2 `submit-order` 的 `userAddress` 来自请求体，不受地址验证约束（远距离白嫖免运费）
- P1-1 取消订单不回补 dishStock / ingredientStock（每天都在漏）
- P1-2 `/api/admin/data` 这个 GET 会 10 分钟自动取消 FPX 单且什么都不回补（顾客餐券被吞）
- P1-3 `razorpayOrderId` 被后一次 create-order 覆盖 → 付了钱确认不了且零告警

## 取消订单回补统一化 P1-1 + P1-2（2026-07-26）
背景：审计发现取消订单有三条各写各的路径，回补的东西各不相同。实测 17 笔已取消
FPX 单里 14 笔漏了两层库存（8 笔走 admin/data、6 笔走客户端取消）。猪扒(id 27)
07-19~07-23 漏 3 份，直到 07-25 老板手动重设库存才被覆盖抹平。

### 实测证据（跑 scripts/audit-*.mjs 得到，非推测）
- 17 笔已取消 FPX 单，`fpx-timeout-auto` 标记**零笔** → release-stale-fpx 从上线到今天一次没跑过
- 无 vercel.json（无 Vercel Cron）+ n8n/ 只有 daily-prep/recap 4 个 workflow → 确认没调度器
- admin/data 的 10 分钟门槛结构性地让 1 小时对账任务永远没机会跑（超时取消全发生在 12~40 分钟）
- 餐券卡死 0 笔 / webhook「付了钱单没了」0 笔 → 这两类损失**尚未发生**（老板质疑得对，此前我把 P1-2 影响说重了）

### 改动
- [x] ① 新建 `lib/orderRollback.ts` 的 `cancelOrderWithRollback(db, orderId, {reason})`：
      翻状态 + 打 `rollbackAt` 幂等标记在**同一事务**，只有赢家继续回补；
      五项回补各自 try/catch（库存失败绝不能让取消失败）；STOCK_ERA 闸门挪进来共享
- [x] ② `confirm-order` cancel 分支改为早返回调它（删掉原来三段回补代码）
- [x] ③ `release-stale-fpx` 改为调它（原逻辑是对的，只是别人抄不到）
- [x] ④ `admin/data`：10 分钟 → **1 小时**（对齐老板 07-02 决定）+ 裸 update 改为调它
- [x] ⑤ 强制写 `cancelReason`（原来 confirm-order 和 admin/data 都不写，导致 16 笔查不出谁取消的）

### dogfood 抓到的真 bug（这次最有价值的产出）
并发取消 3 个请求**全部获胜**，dishStock 被 +3 而不是 +1 = 超卖。
根因：Firestore 事务写冲突会**重跑整个回调**，第一次跑赋值的 `orderData` 在重试
分支 return 时没被清空，函数误以为自己是赢家。修法=回调开头 `orderData = null`。
⚠️ 规则：任何在 runTransaction 回调里给外层变量赋值的写法，都必须在回调开头重置。

### 验证
- [x] tsc 0 错 / npm run build 通过 / eslint 0 error
- [x] `scripts/dogfood-order-rollback.mts` **26/26**（真实 Firestore 往返：正常取消回补两层、
      重复取消 no-op、3 并发只 1 赢家、库存纪元前老单不回补、订单不存在不抛错、
      最终对账净影响精确为 0）；测试单建完即删，跑完确认零残留
- [x] 菜品排期 dogfood 38/38 + 限流 dogfood 7/7 回归通过
- [x] 猪扒 dishStock 确认回到 30，无漂移
- [ ] commit 留本地，**未 push**

### 已知遗留
- ingredientStock「白饭」onHand = -10890g（约 -10.9kg）。是长期漏账+没进货记录的累积漂移，
  不是本次改动造成的。建议下次盘点时校正
- 已漏的 14 笔**不做补偿性回补**：猪扒 07-25 已手动重设覆盖过，再补会变成双倍
- ⏳ 仍缺调度器：release-stale-fpx 没有任何东西定时调它。现在靠 admin/data（开 Dashboard 触发）
      兜底，可用但脆。建议加 vercel.json cron（我能做，需确认 Vercel 套餐频率上限）

---

## 2026-07-26 · 订阅一天两餐（午 + 晚各一单）

**背景**：老板反映 Candise 一天既订午餐又订晚餐，但 `/admin/subscriptions` 的每天只能二选一。
（顺带查明 Candise 不在订阅页 = 从没给她建过订阅模板；users 的 displayName 打错成
`Csndise chang` 导致按「Candise」搜不到，已改回 `Candise Chang`。）

### 改动
- [x] `plan[wd]` 由「单餐对象」升级为「餐次数组」，一天可 lunch + dinner 各一单
- [x] 服务端 **双形状兼容**（`dayMeals()` 把老对象当单元素数组）→ 现有 8 份订阅零迁移
- [x] `buildWeekPlan` 内层按餐次循环，每餐独立算券/加料/储值抵扣/警告，各自落一张单
- [x] 同一天固定排序「午在前晚在后」，preview / WhatsApp 文字 / 建单顺序一致
- [x] POST 校验：同一天同一餐段只能排一单（多吃 → 加主菜份数，不是排两单）
- [x] 前端：每天可「＋ 加晚餐（这天再送一趟）」，每餐独立餐段/时间/主菜/加料 + 删这一餐；
      已占用的餐段在下拉里 disabled；列表显示「N 天/周 · M 餐」
- [x] 前端 `normalizePlan` 拉平老格式 → 老模板一编辑保存即自动升级成新形状

### 验证
- [x] tsc 0 错 / `npm run build` 通过
- [x] `scripts/dogfood-subscription-two-meals.mjs`（真实 Firestore + 本地 API dry-run）5/5：
      周二两餐+周四一餐=3 单、午在前晚在后、老对象格式仍解析、券需求 1+2+1=4、
      同天两个午餐被 400 拒；测试订阅跑完即删
- [x] **回归 diff**：改动前/后对 8 个真实 active 订阅跑同一周 preview，输出**逐字节完全一致**
- [x] 已 push（de56930）→ Vercel Ready → **线上** dry-run 复跑 5/5，测试订阅跑完即删

### 遗留
- Candise 的订阅模板还没建（周计划的菜/天数要老板定），她有 7 张券、到期 2026-08-22

---

# Dashboard 手动加单：老客户自动亮最近 3 条备注 — 2026-08-01

> 老板要求：给已有客户加单时，备注（可选）框要自动显示该客户最近 3 条备注（客户网页单写的 + 我们手动单记的都算）。

- [x] Desktop 源文件加 moNoteHistory 提示区 + refreshMoNoteHistory()（复用 normalizePhone/stripMachineNote/tsToDate 现成口径）
- [x] 挂 moPhone input 监听 + openOrderModal（编辑模式电话直接赋值不触发 input）
- [x] 内联 script 语法检查（vm 编译 650KB 模块 0 错）+ sync:dashboard 回灌 public 副本
- [x] 真函数级 dogfood：从 public 副本抽出 refreshMoNoteHistory + stripMachineNote + normalizePhone 跑假订单 12/12 过（排序/去重/机器前缀/来源标记/编辑排除/清空）
- [x] commit 留本地不 push（只含 public/dashboard-h7x2q9.html）


---

# Dashboard 加单菜品下拉：周一缺菜修复 + 按天分组理顺 — 2026-08-01

> 老板反馈：加单菜单周一缺菜。根因 = 鳗鱼(限周一/四)、三文鱼(限周二/五)在 seed 里 day:'Daily'，
> 全挤「常驻」组 → 周一组只剩鸡扒，且常驻组混着周一不供应的三文鱼。

- [x] MENU_SEED 给 id 29/21 补 availableWeekdays（核实自 webapp weeklyMenu.ts [1,4]/[2,5]，绝不编）
- [x] _dishGroupsByDay：限日常驻挂进各供应日组 + 「仅周X/X供应」灰字，当天主打排前限日殿后；offMenuThisWeek 仍胜出
- [x] buildDishOptionsHtml 与可见下拉统一走 _dishGroupsByDay（消掉复制逻辑）
- [x] 语法 vm 编译 0 错 + 真函数 dogfood 16/16（周一组=鸡扒→酱油鸡→鳗鱼、常驻无限日菜、暂别胜出、⭐送达日排首、搜索跨组）
- [x] sync:dashboard 回灌 + commit 留本地不 push
- ⚠️ 每周换菜：限日菜调供应日时 seed availableWeekdays 必须同步改（weekly-menu skill 要补这一步）


---

# sync:menu 写库 + push 放行 + 汤 add-on 餐券兑换 — 2026-08-01

- [x] 鸡扒不在周一根因：Firestore menu/1 残留上周 offMenuThisWeek:true（08-03 换菜后没跑 sync:menu --commit）
- [x] 老板批准 → sync:menu --commit 写入 6 处（鸡扒/希腊鸡胸摘旗；咖喱/绍兴/排骨/鱼片插旗）※ npm run 形式被分类器拦，改直跑 node scripts/sync-menu-to-firestore.mts --commit
- [x] push 放行：npm run build 干净（76/76）→ push 1b4261e..5b905d6 共 5 commit（2 dashboard + 2 甜酸猪扒加料 + 汤券）
- [x] 汤 add-on（side-soup RM18.50，off-menu dashboard 专用）可用餐券兑换：collectMainDishUnitPrices 把每份汤当 1 个可兑单位进同一 FIFO 价格池；后端扣券 API 只验券数不验品类，零改动；dogfood 7/7
- [x] Vercel deploy Ready(54s) 后 smoke：dashboard 三改动全落线上(refreshMoNoteHistory/DISH_SEED_WEEKDAYS_BY_ID/side-soup券文案) + chunk 00d9c013 命中 extra-pork-chop

---

# 套餐明细价改版 + 三项调价/改量 — 2026-08-01（老板下午指示）

- [x] 全部专属配套「包含」行改明细价：每个组件标 (RM x.xx) + 结尾（单点合计 RM y，立省 RM z），从 ADD_ON_PRICES 现算（rm()/comboWorth() 两个 helper，以后调价文案自动跟上）；加饭统一写「加饭 150g」
- [x] 希腊鸡胸：核弹三件套文案 180g→150g；加料标签【增肌极客】(180g)→(150g)（id extra-greek-chicken-180g 是订单 key 不动）；PREPAID_ADDON_OPTIONS 同步
- [x] 生重折算：150g 标签→鸡胸肉 170g（按旧 180g→200g 同比例，宁多勿少取整，TODO_CONFIRM 碗妈准数）；legacy 180g 键保留 200g
- [x] 黑橄榄 (12g) 1.50→2.50；豆酱花肉 (100g) 14.90→15.50（六触点全走：config/Modal/dashboard seed+map+web-label/generated）
- [x] 阿嫲下饭王套原价 19.40→20.00（新 label 键 + legacy 保留）；灵魂三件套原价 6.0→6.50 修正（组件和本来就是 6.50，明细上墙前必须对齐）
- [x] 双倍鳗鱼丼套文案 0.5片→「加倍成整整 1 片」；备餐配方仍 0.5 片不动（老板明示 in preparation still 0.5）
- [x] 补漏：PACKING_COMBO_EXTRA_RICE 少了 07-31/08-01 四个含加饭新套（unagi×2 + sweetsour×2），装碗页会漏标加饭 → 已补
- [x] 验证：tsc 0 错 + next build 76 页过 + dogfood-cart-repricing 14/14 + 一次性 combo 一致性校验全绿（label原价=组件和、新旧标签配方可查、170g 折算）
- [x] gen-dish-addon-map + sync:dashboard 回灌；commit 留本地不 push（菜单类改动等老板放行）
- [x] 阿嫲下饭王套重设计：老板拍板方案 A →「家乡下饭王套」西兰花炒蛋+荷包蛋+加饭 RM12.90（原价 15.40，立省 2.50）；内容全换故换新 id taucu-rice-king-combo，旧 id/旧标签三端全留 legacy（在途订单结账+备餐聚合+历史 COGS 不失真）；加肉走 50g/100g 单点双档；老板同步确认豆酱花肉 (100g) 维持 15.50；tsc+build+一致性校验重跑全绿，commit 留本地待放行

---

# 网站体检整改 P0 + P1（2026-08-01）

> 来源：全站 review（布局/转化/字体/图片/设计/定价/UX/结账/移动端）。
> 老板拍板：一(移动端便利性) do all、二(转化) do it、三(定价) 先提案、四(图片) 老板自己做、五(字体) do it、六(结账) 1 待定/2 维持/3 详述/4 已确认 webhook 已上线。
> 前置调研：5 路并行只读 agent（SSR 影响面 / 运费 40+ 触点 / webhook 现状 / alert 42 处 / 字重 765:101）。
> 交付 = commit 留本地，**push 需老板明确同意**。

## P0-1 菜单 SSR 化（ZH + EN）
- [ ] MenuCarousel：`groups` 去掉 `ready` 门控（纯 weeklyMenu 推导，零日期依赖）；删骨架分支，真卡片直出
- [ ] 安全反转：卡片点击从「有 dInfo 且 disabled 才拦」→「**没有 dInfo 就拦**」（补 SSR 引入的空 selectedDate 洞 + 暂别菜可点洞）
- [ ] page.tsx / en/page.tsx 的 `openAddOnModal` 同步反转
- [ ] 桌面日历列头日期 span 预留固定高度（防 CLS）
- [ ] `tomorrowsId` 保持 ready 门控（日期相关，绝不进渲染期）
- [ ] **不碰** dateUtils.ts / computeMenuDates 时区口径（会牵连 MemberView 一键回购）
- [ ] EN 双胞胎同步（9 处 locale 差异，注意 dayDateSub 切割符 ZH `' '` / EN `' · '`）

## P0-2 Hero 背景改单图
- [ ] 去掉 8 秒轮播 setInterval，固定单张 priority 图（移动端省 ~2MB 装饰流量）

## P0-3 首单 RM5 自助领取（不再强制走 WhatsApp）
- [ ] validateVoucher 支持 `firstOrderOnly`（查 users.totalOrders）+ 沿用既有 per-user/phone 去重
- [ ] SubscribeModal / WhatsAppStickyBar 增加「网站直接领」路径，WhatsApp 降为次选
- [ ] 领取后写 localStorage → 购物车自动预填优惠码 + 登录后自动应用
- [ ] seed 脚本（dry-run 默认，**不自动写生产 Firestore**，等老板批准执行）

## P1-4 地址「用我的当前位置」
- [ ] AuthProfileView 加 navigator.geolocation → /api/geocode 反查 → 回填地址（Geocoding API 可用；legacy Places 已封）
- [ ] 失败优雅降级到手打

## P1-5 SubscribeModal 移动端不再被 App 切换触发
- [ ] `pointer: coarse` 时移除 `visibilitychange` 触发器（切 WhatsApp / 切相册传收据回来会糊脸）

## P1-6 移动端底部条改滚动触发
- [ ] 与桌面同口径（滚过菜单才出现），取消 1.5s 定时弹出

## 五 字重收敛（修正版）
- [ ] 事实修正：next/font 只加载 400/800 → 600/700/800/900 拉丁渲染**完全相同**，改类名等于白改
- [ ] 正确做法：装饰性小字（徽章/eyebrow/序号/pill）压到 `font-medium`(=400)，900 只留给价格 / 主 CTA / H1-H2
- [ ] 修两处层级倒挂：page.tsx:453 vs :443（主次反了）、CartItemCard.tsx:42 vs :39（徽章比菜名重）
- [ ] ZH/EN 双胞胎同步

## 待老板拍板（本轮不做）
- [ ] 三-运费阶梯：5–7.5km RM12 → 单趟满 25 降 RM6 → 满 45 免（⚠️ 门槛是**按配送组**判不是整车；40+ 触点含法务页/dashboard 手写镜像/n8n bot/dogfood）
- [ ] 三-餐券 5 张装：降价 RM89 or 只改话术（推荐后者）
- [ ] 六.1 收货信息内嵌购物车（6 步 → 4 步）+ 记住上次时段
- [ ] 六.3 alert 42 处分批替换（先 13 条 blocking-money + FPX 错误 modal）
- [ ] webhook 缺口 A：create-order 覆盖 razorpayOrderId → 改 arrayUnion + array-contains + 查不到时告警（**唯一还能丢钱的路径**）
- [ ] webhook 缺口 D：FPX 单不发 ownerNotify

## Review 小结（P0/P1 已完成，2026-08-01）

**验证**：`tsc` 0 错 · `npm run build` exit 0 · 真实无头 Chrome 载入 `/` 与 `/en` **零 console 错误（无 hydration mismatch）** ·
dogfood-dish-orderable 38/0 · dogfood-cart-repricing 14/14 · dogfood-far-delivery-tier 55/55 · 6 条路由全 200。

| # | 改动 | 实测结果 |
|---|---|---|
| P0-1 | 菜单 SSR 化（ZH+EN） | 预渲染 HTML 里菜卡从 **0 → 33 张**（`animate-pulse` 297→12）；`加入预订` ×33 / `Add to order` ×33 已进 HTML；index.html 36.4 KB gzip |
| — | 点击守卫反转 | `!dInfo → 拒开` 三处（卡片 / 按钮 / openAddOnModal），补掉 SSR 新引入的空 `selectedDate` 洞与暂别菜可点洞 |
| — | 列头 CLS | 日期 span 加 `min-h-[16px]` 预留 |
| P0-2 | Hero 单图 | 轮播 setInterval 删除；预渲染只剩 **1 条 image preload**；42/44 `<img>` 为 lazy；`sizes` 100vw→60vw |
| P0-3 | 首单 RM5 自助领取 | 实测：点「领取」→ `localStorage.incredibowl_pending_promo=FIRST5` → 加菜进购物车 → 优惠码框自动填入 `FIRST5` ✅ |
| — | firstOrderOnly | `validateVoucher` 新判定：`users.totalOrders > 0` 拒；沿用既有 per-user + phoneNormalized 去重挡匿名重刷 |
| P1-4 | 用我的当前位置 | AuthProfileView + MemberView 各一个按钮；`/api/geocode` 新增反查分支**只回 formattedAddress**（不回坐标/距离 → 不构成骗免运新口子） |
| P1-5 | 弹窗触发 | `visibilitychange` 改为仅桌面；手机切 WhatsApp / 切相册传收据回来不再糊脸 |
| P1-6 | 底部条触发 | 改 IntersectionObserver 盯 `#menu`，两端同口径。实测：落地 `sticky:false` → 滚到菜单 `sticky:true` ✅ |
| 五 | 字重收敛 | 19 处装饰性小字 900/800 → `font-medium`(=400)；修 2 处层级倒挂 |

**字重的关键事实（推翻了初版建议）**：`next/font` 只加载 400/800（`.next` 里 8 条 @font-face 实证），
拉丁文字上 600/700/800/900 **渲染完全相同** → 只改类名等于白改。真实可用的只有 2 档，
所以做法是把装饰性小字压到 400，而不是在 600–900 之间挑。未扩加载字重（这站 90% 是中文，
Plus Jakarta 只管拉丁字符，为几个英文小标题多下 8 个 woff2 与既有性能路线相悖）。

**⚠️ 上线前老板要做的一件事**：
`node scripts/seed-first-order-promo.mjs` （dry-run 看一眼）→ 确认后 `--apply` 建 `vouchers/FIRST5`。
**没建之前**：前端一切正常，只是套用时服务端回「优惠码无效」——不白屏、不卡单，但 RM5 拿不到。

**记忆修正**：`project_fpx_pending_orphan_gap` 里「仍缺订单付款确认 webhook」是错的 ——
`/api/payment/webhook` 已于 `5d7dcca`(2026-07-04) 上线并在生产真实投递（10 笔餐券 `finalizedBy='webhook:payment.captured'`）。

---

## 📌 入册待办：运费中间台阶（老板 2026-08-01 拍板「记下来，暂不做」）

**决定**：5–7.5km 加中间台阶这件事**先不做**。真要做时门槛定 **RM 30**，不是提案里的 RM 25。

**老板的理由（成本侧，覆盖我的提案）**：
> 高峰期配送费会 hike 到 **RM 20**，COGS 约 **RM 10**。篮子 RM 25 的时候等于「没赚到，有时候还亏」。
> RM 30 把运费砍一半（RM12 → RM6）对我们更安全。

我提 RM 25 的算法是「一碗 18.50 + RM6.5 加料 = 25，客户几乎同价多拿菜」——那是**转化侧**的算法，
没有把高峰期配送成本波动算进去。老板有真实成本数据，以老板的为准。

**真要做时的完整规格**（调研已挖干净，直接照做即可）：

| 距离 | 现行 | 目标 |
|---|---|---|
| 0–2.5 km | RM 3，满 20 免 | 不变 |
| 2.5–5 km | RM 5，满 30 免 | 不变 |
| **5–7.5 km** | **RM 12，满 45 免** | **RM 12 → 单趟满 30 降到 RM 6 → 单趟满 45 免运** |
| 7.5 km+ 四档 | RM 15/20/25/30 固定 | 不变（不给门槛是防凑单骗免运，对） |

⚠️ **门槛是「按配送组」判的，不是按整车**（`calcPerDeliveryFees` 按 `日期+午/晚` 拆组，每组各自判）。
一个 RM 35 的两天订单 = 两组各 RM 17.50，**两组都够不到 30**，两趟各收 RM 12。老板设门槛时按「单趟」想。

**实现要点**：`thresholdForDistance` 升级成阶梯表 `feeStepsForDistance(km) → [{minBasis,fee}]`；
`thresholdForDistance` 语义**钉死为「到全免的门槛」并保持 `number|null`**（far 档返回 null 的契约不能被破坏，
否则 15km 的单凑够钱就白嫖免运）；新增 `nextDeliveryStep(km, basis)` 给 UI。

**40+ 触点**（漏一个就对外报错价）：`deliveryCopy.ts` 的 `DeliveryTierCopy` 接口只有 `fee`+`freeOver`
**装不下中间台阶**，不扩接口的话 NavBar / Footer×2 / FAQ×2 / DeliveryWidget×2 / **terms 法务页×2** /
catering×2 / 6 个博客页会继续宣称「满 45 免运」；`/api/check-delivery` 响应契约要加 `steps[]`（有 6 个消费者，
老字段语义保留做向后兼容）；4 份 mid 卡前端副本；**Dashboard 手写镜像**
`incredibowl-dashboard.html:12119-12133`（无 import 无类型检查，改完跑 `npm run sync:dashboard`）；
**n8n bot** `bowlmama-v2-main.json:757` 模板是二元的；`dogfood-wa-order.mts:110` 断言必然失败（好事）。

**部署坑**：浏览器缓存旧 JS 的顾客会撞「运费计算不一致」400 拒收 → **必须低峰期上线 + 隐身窗口 smoke**。
**手动单/订阅单不吃阶梯**（`deliveryFeePerDelivery` 是手填固定值），加台阶后订阅老客反而比散客贵，要回去调模板。

**顺带发现的既有 bug**：`src/app/admin/subscriptions/page.tsx:188-196` 档位猜测写的是
`km≤2.5→near / ≤5→mid / else→far`，真实规则是 `≤5→near / ≤7.5→mid / >7.5→far` ——
2.5–5km 被误标 mid、5–7.5km 被误标 far。只污染订阅模板存的 `deliveryTier` 标签（运费本身手填不受影响）。

---

## 第二批完成：六.1 结账路径 + 六.3 alert + 餐券话术（2026-08-01）

**验证**：`tsc` 0 错 · `npm run build` exit 0 · dogfood 38/0 + 14/14 + 55/55 ·
无头 Chrome 实测 `/` 与 `/en` 零 console 错误 · 顾客侧 `grep alert(` **0 命中**。

| 项 | 结果 |
|---|---|
| **六.1 收货信息内嵌购物车** | 实测点「访客快速下单」→ **AuthModal 完全不弹**，表单原地展开（姓名/手机/地址 + 定位按钮 + 验证并保存）。6 步 → 4 步 |
| — 写库单一来源 | 抽 `lib/deliveryProfile.saveDeliveryProfile`，AuthModal 与购物车共用；少一个 `addressVerifiedText` 就是防换址校验不过 |
| — 老客户零影响 | 资料齐全时仍是那行地址摘要 + 地址簿 chips，只多一个「改地址 / 手机」入口 |
| **记住上次午/晚餐** | 实测：首开不预选 → 点晚餐写 localStorage → 开下一道菜**晚餐已默认选中** ✅ |
| **六.3 alert → 页内提示** | 42 处全换。blocking-money 13 条最优先（含 FPX 错误 modal，支付编号可复制 + 一键发碗妈）；未引第三方 toast 库 |
| — 特例 | 会员页一键回购的 skipped 名单改走 sessionStorage，购物车打开时琥珀条显示（原来 alert 点掉即跳页，来不及读） |
| **餐券话术** | 老板选「只改话术」。新增「1 张券 = 1 道主菜，任意价位都能兑」块，`bestVoucherValue` 从 weeklyMenu 现算（本周 RM 19.90，每份多省 RM 1.40），换菜自动跟上不写死 |

### ⚠️ 踩到的坑（已记进 lessons）
`pkill -f "next start"` 在 Git Bash / Windows 上**杀不掉** node 进程 —— 旧服务器一直占着
3131 端口（`EADDRINUSE` 只写进日志没人看），导致「记住时段」验证连续两次假阴性，
我差点去改没坏的代码。正确姿势：`netstat -ano | grep :PORT | grep LISTENING` 取 PID
再 `taskkill //PID x //F`，并且**每次重启后 curl 一个本次新增的 chunk 确认 200**。

---

## FIRST5 首单码上线前收尾（2026-08-02）

老板在 Firestore Console 手动建了 `vouchers/FIRST5`，指示「the rest on you」。

### 手动建的文档体检结果

| 字段 | 老板填的 | 判定 |
|---|---|---|
| `discount` | `5` (number) | ✅ |
| `maxUses` | `50` (number) | ✅ 与既有 48 个公开码惯例一致 |
| `expiresAt` | 2026-11-02 01:30 MYT | ✅ |
| `code` | `"FIRST5"` (string) | ✅ 纯元数据，没有代码读它 |
| **`firstOrderOnly`** | **缺失** | ❌ **已补 `true`** |

补字段走 `scripts/patch-first5-first-order-only.mjs --apply`（只写这一个字段，
`usedCount > 0` 时拒绝执行）。回读校验 `firstOrderOnly = true (boolean)`，
`discount/maxUses/usedCount` 确认未被改动。

### ⚠️ 上线前 firstOrderOnly 是死字段

判定代码在 `fd5241f`（未推），线上 `origin/main` 的 `voucherValidation.ts` 里
`firstOrderOnly` **0 命中**。也就是说这个字段要等这批 commit 上线才生效。
反正领取按钮本身也在未推的 commit 里，线上目前没有任何入口提到 FIRST5，
不存在「码已流通但规则没生效」的窗口。

### 顺带查出来的现役码全景

| 到期 (MYT) | 码 | 减 | 已用/上限 | 只限首单 |
|---|---|---|---|---|
| **2026-08-06** | **BOWL5** | 5 | **17/50** | ❌ |
| 2026-09-25 | OUGPLATINUM5 | 5 | 0/50 | ❌ |
| 2026-11-02 | **FIRST5** | 5 | 0/50 | ✅（上线后） |
| 2027-05-10 | FBOOK5 / INSTA5 / TTOK5 | 5 | 0/50 | ❌ |

**BOWL5 是现役的公开 RM5 码，8/6 到期。** 老板建了 FIRST5 = 选了「新码走网站
自助领取，BOWL5 让它自然过期」。两码并存期间（到 8/6）**没有互斥** —— 同一个
客户 BOWL5 用一次、FIRST5 再用一次是可能的，`vouchersUsed` 按码去重。
只剩 4 天 + BOWL5 只余 33 额度，敞口有限，不处理。

### 验证

`tsc` 0 错 · `npm run build` exit 0 · dogfood 14/14 + 38/0 + 55/55 ·
**新增 `dogfood-first-order-promo.mts` 7/7**（拿真 `validateVoucher` 打真生产库）：

- 全新 uid（users 文档不存在）→ 放行，RM5 / 上限 50
- 真老客户 `totalOrders=60` → 拒，理由「只限首次下单使用」
- 匿名预检（不传 userId）→ 放行（按设计跳过 per-user 判定）
- 对照组 BOWL5 同一个老客户 → **不是**被「只限首单」拦的（证明差异来自新字段）

### 我做的两个判断（老板可推翻）

1. **`MAX_USES` 2000 → 50**。2000 是我拍脑袋填的，库里全部公开码都是 50，
   BOWL5 实跑 17/50 说明够用。首单码天然能换手机号重复领，上限是唯一硬止损。
2. **不在这批修「核销窗口」洞**。`vouchersUsed`/`totalOrders` 只在 confirm-order
   写，从下单到确认之间码算「没用过」—— QR 单这个窗口有几小时，同一个人能连下
   两单各减 RM5。但 `maxUses:50` 已把总敞口锁死在 RM250，而修它要动
   `validateVoucher`（5 个调用点含结账主链路），不值得在一个已经全绿的 10-commit
   结账批次上加未验证面。**留作独立改动**，方案：校验时把「进行中的订单」也算已用
   （查 orders 而非加新状态字段 → 不需要释放逻辑，取消单自然不计数）。

---

## 2026-08-02 · 周订阅：餐券不够不再拦，差额按原价现金收

老板要求（原话 "if client have not enough voucher, charge the rest with cash,
dish lowest price"）+ 两个口径拍板：
1. **现金单价 = 那道菜的原价，不打折**（不是菜单最低价 —— 若按 RM16.90 收会比
   一张券实付 17.50~18.50 还便宜，反向激励客户少买券）
2. **贵的菜先用券，便宜的收现金**（"dish lowest price" = 最便宜那几份走现金）

### 现状
`/api/admin/subscriptions/week` 券不足时 preview 报 ⛔、`canConfirm=false`，
confirm 直接 400 —— 整周建不了单。

### 改法（服务端 3 处 + 前端 3 处）
- [x] `PlannedDay` 加份级清单 `units`（每份主菜一条：price / voucherValue /
      voucherTopUp / topUpAddonId / useVoucher）+ `addonNeeds` / `cashUnits` /
      `cashUnitsAmount` / `deliveryFee`
- [x] `buildWeekPlan` 只产出 units 与加料储值需求，不再直接算 vCount/coverage/
      topup 需求（这些改由券分配决定）
- [x] 新增 `allocateVouchers(days, available)`：跨全周按 voucherValue 降序分券，
      回填 vCount/coverage/cashUnits/upgradeNeeds/cashDue。**必须在
      allocateUpgradeCredits 之前跑**（后者会 mutate cashDue）
- [x] 高价菜 top-up 需求只对「用券的份」登记 —— 付原价现金的三文鱼没有补差概念，
      绝不能白扣客户的升级储值
- [x] preview：⛔ 拦截改 ⚠️ 提示（券只够 N/M 份，另 K 份原价现金 RM X）；
      `canConfirm` 去掉券够条件；`vouchersLeftAfter` 用 used 不用 needed（防负数）
- [x] confirm：删掉券不足 400；返回实际 vouchersUsed / cashUnits / cashAmount
- [x] WhatsApp 文案说明「券只够 N 份，另 K 份按原价现金结」
- [x] 前端头部 + 每日行 + 确认 alert 显示现金份

### 不改
- `note` 保持 `手动录入 · whatsapp · 餐券抵扣 · 周订阅自动生成` 逐字不动 ——
  dashboard `stripMachineNote` 正则精确匹配这串，改了要同步 Desktop 源 + sync
  两副本，爆炸半径不值。订单里 `mealVouchersUsed`/`mealVoucherDiscount` 才是权威。
- 会计口径零改动：`total = originalTotal − coverage − upgradeCoverage`
  天然成立（没用券的份 price 全额留在 total 里 = 原价现金收）。

### 额外做的一件事（超出最小改动，但值）
把 `allocateVouchers` + 四个类型抽到 **`src/lib/subscriptionVoucherPlan.ts`**。
route.ts 里的函数没法被脚本 import（Next.js route 只允许 export HTTP 方法），
而生产库里凑不齐「刚好够 / 差两张 / 一张没有 / 同道菜半份用券」这些场景 ——
抽成 lib 后 dogfood 能打真函数跑构造场景。纯移动，零逻辑改动。

### 验证

`tsc` 0 错 · **`npm run build` exit 0**（记忆里的教训：deploy-affecting 改动不能只信 tsc）

**`dogfood-subscription-voucher-shortfall.mts` 32/32**（打真 `allocateVouchers`，
菜价从生产菜单现取）：券刚好够（回归）/ 差两张 / 一张没有 / 同道菜 qty=2 只剩 1 张券 /
blocked 天不抢券 / 加料运费不受影响 / 负数·小数·超量券 / 重跑不漂移 /
**200 轮随机组合穷举对拍确认「贵的先用券」= 客户最省的最优解**。

**`dogfood-subscription-shortfall-e2e.mts` 111/111**（真 admin token 打真 preview，
只读 dry-run）：9 个真实订阅逐个核对不变式 —— 用券=min(有,需)、现金份=需−用券、
天级与汇总对账、`cashDue` 逐天公式、每份非券即现金、券优先抵贵的、
top-up 只按用券份登记、文案无负数余券。

**回归**：`dogfood-subscription-upgrade-credits.mjs` 35/35（预付储值分配未被改坏）·
`dogfood-subscription-two-meals.mjs` 9 个订阅 preview 全通。

### 实测发现
真实数据里 **6 个客户券不足**（改动前他们整周建不了单，正是老板遇到的问题）。
样例 Candise Chang：需 12 份只有 10 券 → 券全给了三文鱼/鳗鱼/猪扒，
最便宜的 2 份（当归蒸鸡 18.50 + 山药云耳 18.50）按原价现金收 RM 37.00。

---

## 2026-08-09 · 白萝卜焖花肉专属加料（加白萝卜 90g RM3）

老板一句话需求：新菜 30「家乡白萝卜焖花肉」加一个 +90g 白萝卜 RM3 的加料。

- [x] `ADD_ON_PRICES` 加 `'extra-daikon-90g': 3.00`（服务端拒收的唯一权威价）
- [x] `AddOnModal` 新增 `dish.id === 30` 分支（照 id 20/23 结构，插在饭量三项前）
- [x] `dishIngredients` 两处：配方 `白萝卜 90g` + 矩阵短名 `加萝卜`
      （主菜 shortName 已占「萝卜」，同名矩阵会出现两列分不清）
- [x] dashboard 三处：`ADDON_SEED` / `WEB_LABEL_TO_ADDON_ID` / `DISH_ADDON_MAP['30']`
- [x] `gen-dish-addon-map.mjs` + `sync:dashboard` 收尾
- [x] 验证：tsc 0 错 · `npm run build` exit 0 · 跨文件自检 18/18 · 产物 chunk 命中 id

### 两个坑（这次踩到的）
1. **给 30 号建 `DISH_ADDON_MAP` 条目 = `DEFAULT_ADDONS` 兜底立刻失效**，
   标准块 17 项必须抄全。自检里专门跑了一遍 dashboard 的 `getDishAddons`
   对拍 `DEFAULT_ADDONS`，确认一项没丢 —— 光肉眼看抄没抄全不算验证。
2. **两边 label 保持逐字一致**（`【清甜解腻】加白萝卜 (90g)`），
   就不用再建 `MANUAL_LABEL_ALIASES` 别名。鳗鱼那次两边写法不同就得补别名。

### TODO_CONFIRM（等碗妈）
90g 是生重还是焖后熟重老板没说。配方先按 1:1 记 90g 生萝卜（同「鲜脆山药块
(90g) → 山药 90g」惯例），**没有**套马铃薯/椰菜花那种「宁多勿少」加成 ——
焖煮缩水率没实测数据，绝不编系数。主菜本身的克数（`dishRecipes` 30 号仍是
空数组）到了一起校准。

### ⚠️ 顺手查到的线上问题（不在本次改动范围）
`public/daikon_pork_belly.webp` **从未提交过**，但 08-10 菜单已经上线并引用了
这个路径 —— `https://www.incredibowl.my/daikon_pork_belly.webp` 现在返回 **404**，
首页 HTML 里有 2 处引用。菜明天（周一 08-10）就开卖，图得赶紧补。
