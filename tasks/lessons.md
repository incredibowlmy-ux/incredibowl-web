# Lessons learned

## 2026-07-17 — 告诉老板「可以用 X 方式找到」前，要把那条查找路径本身跑一遍，不能只验证数据在不在

**现象：** 老板问访客单在不在本地 dashboard。我验证了数据层（16 笔访客单全在 `state.orders`）就下结论「在，按电话找即可」。老板回来说按电话也搜不到——一查，dashboard 的「客户查询」面板把候选电话 `normalizePhone`（剥 60/前导 0）但查询词不归一化，输入 `0163628625` 对 `163628625` 永远子串失配。数据确实在，我推荐的那条**查找路径**是断的。

**根因：** 把「数据存在」等同于「用户找得到」。搜索/过滤/匹配逻辑也是行为的一部分，我没有模拟老板的真实操作（在搜索框输入带 0 的完整号码）走一遍。

**给自己的规则：**
1. 回答「怎么找到 X」类问题时，**用真实存储值 + 用户真实输入习惯把匹配函数模拟跑一遍**（本次用 node 脚本模拟三处 matcher × 6 种输入写法），命中了才说「可以这样找」。
2. 两侧归一化要对称：一侧 `normalizePhone` 另一侧原样，是这类搜索 bug 的固定形态；review 任何 `A.includes(B)` 匹配时先问「A、B 是不是同一套归一化」。

## 2026-07-11 — 记忆里的「人名/事实」引用前要过一遍时效核验，尤其是被老板纠正过的

**现象：** 给老板解释转化追踪分工时写了「WhatsApp 聊天单 = Carmen 确认时上报」。Carmen 是 5 月 18 日规划笔记里的名字，老板 5 月 28 日就纠正过「its actually Ebby, 不是 Carmen」——纠正进了对话，但 5-18 那条记忆没改，我 7 月直接引用了过时名字，老板反问「who is Carmen?」。

**根因：** 记忆是时点快照。我只在「代码类记忆」上养成了先验证再引用的习惯，「人名/业务事实类记忆」直接照抄了。

**给自己的规则：**
1. 引用记忆里的**人名、电话、负责人、业务安排**前，先想一下这条记忆的日期和之后有没有被纠正过；拿不准就不写具体名字（写「你们确认时」即可）。
2. 老板每次纠正事实（人名/价格/规则），除了记 lessons，**必须同步改掉所有提到旧值的记忆文件**——当天就改，不留地雷。

## 2026-07-07 — 修映射 bug 时要把「整行 mapping」对照权威口径逐字段验，不能只修报错的那个字段

**现象：** 客户 WhatsApp 确认消息菜名 undefined，我修好了 `name`（`it.name`→`it.dish.name`）还顺手加了加料显示，验证、上线。当天第二个客户 #EOX4IF 又暴露同一行 mapping 的另一个字段错：`qty: it.quantity` 漏乘 `dishQty`——三文鱼 5 份显示 ×1（RM 138 对两行 ×1，客户一眼看出不对）。两个 bug 同一处快照、同一次能修完，我只修了被报告的那个。

**根因：** 我把「验证」做成了「验证我改的字段对不对」，没有把快照整行 mapping 对照**权威生产者**（/api/submit-order 写 Firestore 的口径：菜 = `dishQty × quantity`、加料 = `quantity × bundle数`）逐字段核对。CartBundle 有 `dishQty` 和 `quantity` 两个数量字段，语义只有服务端写库代码说了算。

**给自己的规则：**
1. 修任何「A 结构 → B 展示/快照」的字段映射 bug 时，**逐字段对照该数据的权威写入方**（通常是服务端 API），把整行 mapping 全部核一遍再收工，不要只修用户报告的那个字段。
2. 同一数据有两个近义字段（`dishQty`/`quantity`、`total`/`originalTotal`）时，先 grep 服务端怎么用，**照抄服务端公式**，别猜哪个是「数量」。
3. 验证时用**极端真单**（多份数、多 bundle、带加料）当测试数据，×1 的默认路径测不出乘法漏项。

## 2026-06-30 — 改盈亏算法前先问清「钱怎么收/货怎么送」的真实业务，别拿 schema 自己脑补

**现象：** 老板让查 voucher 订单计算器的净利。我「发现」两个 bug 并改了：①`deliveryFee` 字段被当成 stale 虚高，改成用 `total` 反推运费；②多拼单按 `÷totalParts` 摊薄配送成本。老板当场打回：**Kelly 那 RM12 运费是真收的、银行到账了;多拼单每个 part 是不同送达日、每趟车成本都真实发生、顾客也都付了运费。** 两个修复全部基于错误假设,已全部回退。

**根因(两个想当然的前提都错):**
1. **「`total` 含运费」是错的。** 实测 Kelly 单 `total=18.5=originalTotal`、`deliveryFee=12` —— 运费**不在 `total` 里**,是单独收取的真实营收。我拿 `total − 菜品` 反推运费 ⇒ 把真实运费算成 0。
2. **「多拼单=一趟车」是错的。** 实测 Jo Anne 拼单 part1/2/3 送达日 = `6-29 / 6-30 / 7-01`,**三天三趟独立配送**,每趟都真实烧一份 RM10 跑腿费。我 `÷parts` ⇒ 把真实成本凭空抹掉(那「省下的 RM122」根本不存在,是真金白银的配送支出)。

**给自己的规则:**
1. 动任何**钱的算法**(营收/成本/盈亏)前,**先问老板真实业务流**:这笔钱怎么收的?到账没?这趟货怎么送的?一单几趟?**别用 Firestore 字段关系自己脑补会计口径。** 字段对不上 ≠ 字段错,很可能是我不懂业务。
2. `total`/`deliveryFee`/`isMultiPart` 这类字段的**语义要跟老板确认**,不要假设它符合「常规电商」直觉(此项目运费独立收、拼单是多日套餐)。
3. 我标「bug」并能自圆其说时,**先停下来求证**(给老板看具体单 + 我的假设),再改代码。这次自洽的模拟反而让我更自信地错下去。详见 [[project_dish_costing]] 配送成本是真实最大利润项,绝不能用算法假装它消失。


## 2026-06-29 — dashboard 加点成本对照表别用「带价格后缀的整串」精确匹配

**现象：** 老板在 dashboard 成本卡片里找不到「古早味大满贯三件套 (原价 RM 15.40)」，它被列进「还没填成本的加点」却又点不进去填。查后发现网页加点标签里嵌了划线原价 `(原价 RM x.xx)`，而 dashboard 的 `WEB_LABEL_TO_ADDON_ID` 用**整串精确匹配**——这道套餐原价从 14.40 涨到 15.40，标签一变匹配就断，加点退回用长标签当 id、成本算 RM 0。同类漂移当时还有「薯肉双拼满足套」「爆量满足三件套」两道（13.40/14.40→15.40），另有 `broccoli-egg` 网页有但表里漏登记。

**根因：** add-on display label 里塞了易变的价格数字，却拿整串去做 key。这和 [prep label alias drift]、EN 双副本漂移、dashboard 双副本同源——**把会变的展示文案当稳定标识符**。

**给自己的规则：**
1. 凡是「展示标签 → 稳定 id」的映射，**匹配键必须剥掉易变装饰**（价格 `(原价 RM …)`、克数、`【…】`前缀）。本次加 `lookupAddonId()`：先精确、失败则剥 `(原价 RM …)` 后缀按基础名匹配（基础名唯一所以安全），两个查表点都改走它。以后调价不会再断。
2. 加新网页加点（AddOnModal.tsx）后，**同步**在 dashboard `WEB_LABEL_TO_ADDON_ID` 显式登记一条，别只靠 `state.addons` 名字兜底。
3. 排查这类「找不到/算 RM0」先 diff 网页 AddOnModal 的 `name` 串 vs dashboard 对照表，逐条对基础名+id，不要只看眼前那一道。

## 2026-06-28 — 订单/份数统计别用眼睛手动加总，一律让脚本程序化 sum

**现象：** 老板问 petai 卖了多少、是否盈利。我先跑 `count-petai.mjs`（它只 print 不 sum），自己**手动把列表加总报了 29 份**。后来写脚本程序化 `reduce` 才发现真实是 **30 份**，当场更正。

**根因：** 把一长串 `×qty` 行用肉眼加总，极易错 1~2；而且 `count-petai.mjs` 的 `TODAY`/`STOCK` 是写死的旧值，delivered/upcoming 切分也已过期，更助长误判。

**给自己的规则：**
1. 任何「卖了多少份 / 多少单 / 多少钱」的问题，**必须脚本里 `reduce` 求和并打印合计**，绝不口算加总订单行。
2. 引用现成只读脚本前先看它有没有写死的日期/库存常量（`TODAY`/`STOCK`），过期就别信它的切分结论，只信原始行 + 自己重算的合计。
3. 报数前自检：份数总和 = 各付款方式分组之和，对不上就是算错。

## 2026-06-21 — EN 版别复制日期/特餐逻辑，也别用静态映射「反查翻译」中文串

**现象：** 老板发现英文版 `/en`：① Hero「Tomorrow's Special」显示的是**已退役的酱油鸡全腿**（应是周一主推鸡扒饭）；② 菜单卡按钮和日期标签是中文（`预订 6月22日 (周一)`、`6月22日 周一 · Mon`）。

**根因（两个，本质同源——EN 组件树各自为政）：**
1. `HeroSectionEN.tsx` **自带一份** `computeNextSpecial`,还停留在旧逻辑 `d.id === targetWd`（把 `id` 当星期几）。但 `weeklyMenu` 早已改成 `id=唯一标识、weekday=供应日`,周一 `find(id===1)` 命中的正是退役的酱油鸡(id 1)。共享版 `lib/nextSpecial.ts` 用 `weekday===wd && !retired && isPrimary` 是对的——ZH Hero 用共享版所以没事，只有 EN Hero 用了坏副本。**两份副本漂移**,和 dashboard 双副本一个性质。
2. `dateUtils.computeMenuDates` 只产中文串,`MenuCarouselEN` 靠 `translateTopTag/translateBtnText` 两张**静态映射表**反查英文。带日期的串（`预订 6月22日…`）永远命中不了 map → 原样漏出中文。

**给自己的规则：**
1. **日期/特餐这类逻辑只能有一份**——一律 import `@/lib/nextSpecial`、`@/lib/dateUtils`。看到组件里有本地 `computeNextSpecial`/`computeMenuDates` 副本,立即视为 bug 合并掉。
2. **多语言要在数据源头按 locale 产出**,不要在下游用映射表「把中文翻回英文」。给共享函数加 `locale` 参数（默认 `'zh'` 保护 ZH 零影响），EN 调用处传 `'en'`。带动态内容（日期/克数/价格）的串尤其不能靠反查。
3. `src/app/en/*` + `src/components/home-en/*` 是**独立组件树**;任何在 ZH 侧改的「日期/供应日/特餐挑选/退役」逻辑,必须同步检查 EN 侧是否也走了共享 lib。
4. 改完用 `next dev` + browse 实测 `/en`（不能只测 `/`）——客户端 `useEffect` 算的值只有真浏览器能看到。

## 2026-06-20 — dashboard 改 UI 前先确认 sync 方向：Desktop 才是源头

**现象：** 做「预付加料」功能要改 dashboard，我直接编辑了仓库内的 `public/dashboard-h7x2q9.html`。
后来才发现有 `scripts/sync-dashboard.mjs`（`npm run sync:dashboard`），它的方向是
**Desktop `incredibowl-dashboard.html` → 仓库 `public/`**（并注入 noindex meta）。
也就是说 **Desktop 那份是源头（source of truth），`public/` 是它的派生拷贝**。
我改的是派生拷贝——下次任何人跑 sync，我的改动会被 Desktop 旧版**整个覆盖丢失**。

**根因：** 记忆里只记了「dashboard 有两个副本要同步」，没记清楚**哪份是源头、用什么工具同步**。
我凭「仓库文件 = 真源码」的惯性直接改了仓库。

**给自己的规则：**
1. 改任何 dashboard HTML 前，先 `Read scripts/sync-dashboard.mjs` 确认 **DEFAULT_SRC（源）和 DST（目标）方向**。
2. 源头是 **Desktop `C:/Users/User/Desktop/Incredibowl Services/incredibowl-dashboard.html`**；
   `public/dashboard-h7x2q9.html` = 源头 + 注入的 2 行 noindex meta。
3. 正确流程：**改 Desktop 源 → `npm run sync:dashboard` 回灌仓库**。
   若已误改仓库拷贝：把仓库版（去掉那 2 行 meta）写回 Desktop，再 sync 回灌，使工具链一致。
4. 财务版 `Accounting/finance-dashboard-*.html` 是独立小文件（~9KB，无餐券逻辑），不在 sync 链内，按需单独处理。

## 2026-06-08 — 写菜品文案别凭想象定配料，照图核对

**现象：** 给「古早味姜葱鱼片饭」写描述时，我把那颗蛋写成「月见蛋」（生蛋黄拌饭式），沿用了纳豆饭的叫法。老板更正：是**荷包蛋（煎蛋）**。回看产品图，蛋白已凝固、明显是煎过的荷包蛋。

**根因：** 写文案时偷懒套用了别道菜的措辞，没逐一对照这道菜的实拍图/食材表确认配料形态。

**给自己的规则：**
- 写任何菜品 desc / tag 前，**逐项对照该菜的实拍图 + 食材表**，配料名称（蛋的做法、肉的部位、菜的种类）要跟图一致，别套用模板或近似菜的叫法。
- 荷包蛋（sunny-side-up，蛋白凝固）≠ 月见蛋（tsukimi，生蛋黄）。中餐家常饭上盖的煎蛋默认是荷包蛋。
- 文案属于「面向用户的描述」，错配料等同 [诚实原则] 里的编造——宁可问也别想当然。


## 2026-06-02 — scratch 工作区会冲掉未提交改动，改完立刻 commit

**现象：** 在 `.gemini/antigravity/scratch/incredibowl-web` 改了 dashboard 文件 7 处，Edit 全部成功、Grep 当场能搜到。但稍后跑 `git status` 发现该文件「干净」、改动全没了；HEAD 从 `a79f6d6` 跳到 `ac1798a`（工作区在我编辑后做了一次 git 同步/拉新提交，把未提交的工作树改动冲掉）。todo.md 侥幸幸存，dashboard 被覆盖。

**根因：** 这个 scratch 路径不是稳定工作区，会被外部同步/reset。未提交（uncommitted）的工作树改动随时可能蒸发。

**给自己的规则：**
- 在 `scratch/` 路径下，**每完成一组逻辑改动就立刻 `git add && git commit`**，别攒着等用户说 push。
- push/验证前先 `git diff --stat <file>` 确认 git 真的看到改动；只靠 Edit 返回成功 + Grep 搜到**不够**（工具的文件视图可能比 git 工作区滞后或被回退）。
- 如果发现改动消失：别慌，重做后**立即提交**抢在下一次同步前锁住。


## 2026-05-11 — Discount mechanisms must handle the zero-total edge case

**Bug:** Customer with 5+ meal vouchers redeems 5 main dishes in free-delivery zone → cart total = RM 0.00, but UI still required them to select QR/FPX and upload a receipt. "确认下单" button was permanently disabled because it required `paymentMethod` to be set.

**Root cause:** The checkout flow was built assuming there's always cash to collect. When the discount fully covered the bill, none of the existing code paths handled "no payment needed."

**Rule for myself:** When introducing ANY new discount mechanism (vouchers, promo codes, loyalty points, refer-a-friend credits, etc.), explicitly enumerate the boundary cases:
- finalTotal = 0 → no cash flow path needs to exist (skip payment selector, skip receipt upload, skip Razorpay)
- finalTotal < 0 → impossible by `Math.max(0, ...)` but worth a server-side guard
- finalTotal between 0 and 1 → Razorpay will reject (min 100 paise / 1 INR equivalent), so still needs the no-cash branch

**Pattern to apply:** Add a computed `isFullyCovered = total <= 0 && discount > 0` and short-circuit the payment ceremony. Don't try to bend the existing QR/FPX flow to accept zero-amount transactions.

## 2026-05-18 — 配送费定价要把竞争位放在防亏前面

**事件：** 老板让我分析配送费规则。我用 Lalamove 单订单成本算出"0-2.5km 满 RM 20 免运是套利漏洞"，建议把门槛提高到 RM 28/RM 35。老板回："2. that is not competative at all." —— 他完全对。

**根本错误：** 我把配送费当 P&L line item 优化，而不是当 marketing / acquisition cost。在 Hometaste RM 2 全场、Grab RM 2-7 的市场，把"防套利"放在第一位等于让自己退出竞争。配送费规则的首要目的是**让客户选你**，而不是**让每单不亏**。

**应用规则：** 给食品/外送业务做定价建议时，先问：
1. 直接竞品（同类型，同地区）的对外价格是多少？这设定了**消费者锚点**
2. 我们的护城河是什么？（邻里关系、新鲜度、本地化）—— **不是价格**
3. 配送费是当 acquisition cost（争客户）还是 retention cost（订阅）？两种角色定价逻辑完全不同
4. 单订单经济学是约束（不能亏太多就破产），不是目标。目标是 LTV × 客户数

**反模式（这次犯的）：** 计算 Lalamove RM 7 / 单 vs 客户付 RM 5 → 提门槛"防亏" → 结果对竞争对手送上市场份额。

**正确模式：** 把配送费亏损（RM 2-4/单）当 CAC 看 → 算 LTV（食物毛利 × 复购次数）能不能覆盖 → 用订阅/餐券锁定高频客户把亏损摊薄。

## 2026-07-21 — 客户端明细要点名具体项目，不要只给数量

**事件：** 预付加料券上线后老板试用，一次指出两处同类问题：购物车卡片「加购 1 项」不知道加购了什么；抵扣行「预付加料抵扣（1 份）」不知道抵的是哪样。改成「加购：加饭 ×1」「加料券已抵：加饭 ×1 · 剩 11 份」。

**根本原因：** 我按工程视角展示了聚合数字（count），但客户视角关心的是**具体是什么**——数字对账是系统的事，点名才是给人看的。

**应用规则：** 任何面向客户的行项目（加购、抵扣、优惠、赠品），默认**点名 + 数量**（「加饭 ×1、荷包蛋 ×2」），不是只报 N 项/N 份。术语也要口语化：客户词汇是「加料券」不是「预付加料 credit」。写完 UI 文案自问：一个不懂系统的顾客看这行，能不能不点开任何东西就知道发生了什么？

**核对清单：** 任何"建议提高门槛 / 提高费用"的建议出口前，先 grep 同地区直接竞品的对外价格，确认我没把自己推到市场之外。

## 2026-06-01 — 写累积型文档前必须先 Read，且不能在同一批 Read+Write

**错误：** 要往 `tasks/todo.md` 和 `tasks/lessons.md` 追加内容时直接用 Write，导致整文件被覆盖，
抹掉了历史记录（todo 的 dashboard/推荐券/餐券/菜单计划；lessons 的前 3 条）。更糟的是第二次
把 Read 和 Write 放在**同一个 tool 批次**里，Write 在我看到 Read 结果之前就执行了，重犯一次。

**根因：** ① 把 Write 当「追加」用（Write 是全量覆盖）；② 对依赖前一步结果的操作做了并行批处理。

**规则：**
1. 对 `tasks/todo.md`、`tasks/lessons.md`、`CLAUDE.md`、`README` 等累积型文档，动手前先 Read 全文，
   再「原文 + 新内容」整体 Write；优先用 **Edit 精确插入/追加**，避免全量 Write。
2. **有依赖关系的 Read→Write 绝不放同一批**：必须先拿到 Read 结果，再决定 Write 内容。

## 2026-06-27 — 品牌吉祥物叫「碗妈」(BowlMama)，别打成「碑妈」

**错误：** 在 AskUserQuestion 选项文案里把「碗妈」误写成「碑妈」，被老板当场纠正。

**根因：** 形近字手滑；「碗」(wǎn, bowl) 才是品牌核心意象（Incredibowl = 碗），「碑」是错字。

**规则：** 所有面向用户的文案/选项/提交信息里，品牌人设固定是 **碗妈 / BowlMama**。
产出前扫一遍专有名词：碗妈、Incredibowl、Pearl Suria Residence、Old Klang Road —— 别手滑。

## 2026-07-05 — 老板说的加料名字≠系统现有 id；白天不 push 菜单改动

**错误 1：** 老板要求和牛加「cherry tomato salad 40g」（没给价），我看到现有 `cherry-tomato`
「爽脆多汁小番茄 (40g)」份量一样，就自动映射过去用了 RM2.50。实际是**新品**：小番茄+洋葱沙拉
拌初榨橄榄油+盐，RM4.50 —— 是不同的商品、不同的价、不同的配方。

**根因：** 名字相似 + 份量相同 ≠ 同一商品。老板没给价的项目，我用「找了个像的现有项」来填空，
本质上还是编造（把 RM4.50 的商品按 RM2.50 卖了）。

**规则 1：** 老板报菜/加料时，凡是**没给价**或描述与现有项不完全一致的（多了「salad/沙拉」
「combo」等词），一律先当新品处理并在交付说明里明确「我沿用了 XX 的价/映射到 XX，若是新品请给价」
——第一轮我在报告里写了这个假设所以老板能当场纠正，这个「显式声明假设」的动作要保持。

**错误 2：** 白天直接 push 菜单/加料改动上生产。老板担心客户正在下单时页面/价格变化。

**规则 2：** 菜单、加料、价格类改动默认**白天不 push**（营业时段客户在下单）；commit 留本地，
等老板开口或过截单/低峰时段再 push。与每周换菜「过 06:00 截单后 push」同一逻辑，适用面更广。

## 2026-07-07 — 新功能入口不能藏在「先有数据」后面（地址簿空簿看不到 +新增）

**错误：** 地址簿区块写成 `savedAddresses.length > 0` 才渲染，而上线时所有账号的簿都是空的
（懒迁移设计成「重新保存地址时才收编」）——结果老板上线后第一件事就是「我看不到 +新增地址」。
入口和数据互相等对方，死锁。

**根因：** 设计懒迁移时只想了数据层（何时写入），没走一遍**首次使用者的 UI 路径**：
空状态下用户靠什么发现并启动这个功能？dogfood 清单里写了「新增→切换→删除」，
却默认了入口可见这个前提。

**规则：**
1. 任何依赖用户数据的新功能，**空状态（0 条数据）必须是第一个设计和自查的画面**：
   入口在哪、引导文案是什么、第一条数据怎么产生。
2. 懒迁移触发点选「用户打开相关页面时」优先于「用户下次做某操作时」——后者可能永远不发生。
3. 无法真机 dogfood（要登录）时，至少在脑内按「新用户/老用户/匿名 × 空数据/有数据」
   过一遍矩阵，把每格看到的画面写进交付说明。

## 2026-07-12 Meta 目录排查：对照实验一次只能变一个变量
- 症状：feed 抓取 10 条全 invalid。我第一轮实验同时换了「目录 + CSV 引号」两个变量，成功后误判根因是引号；push 修复后依旧全 invalid，多烧了一轮 push 审批。
- 规则：定位外部黑盒（Meta/第三方 API）问题时，每个实验只允许一个变量差异；写结论前自问「成功组和失败组之间还有哪些没对齐的差异」。
- 另记：Meta upload session 的 invalid/error 计数是异步结算的，会话刚结束时显示 0，约 1 分钟后才出真实数字——别用第一眼的计数下结论。

## 2026-07-13 成本表整理
- **教训**：用户说「Google Sheet 里的文件」，我直接从 Drive 连接器拉内容，结果拿到的是**过期快照**（肉类单价修复前的旧数据），差点把老板已修好的错误当成新发现。中途用户补充文件其实在本地 `Desktop\Incredibowl Services\Costing`。
- **规则**：动手前先查本地（额外工作目录、Desktop 业务文件夹）有没有同名/同主题文件；本地文件的 mtime 和内容永远优先于 Drive 连接器的文本快照。Drive `read_file_content` 对 xlsx 是缓存文本，不保证与最新二进制同步。
- **教训（同日追加）**：帮老板「整理」他天天用的文件时，我按工程师直觉把 19 张表重构成主表+长表+自动汇总，老板反馈 very hard to check 整个否掉。他要的是**保持他熟悉的版式，只做他点名的那一个改动**（14 张菜表并成 1 张）。
- **规则**：整理/优化用户的工作文件前，先问或先按「最小改动」做——版式=用户的肌肉记忆，重构自动化收益抵不过他重新学一遍的成本。给建议可以，动结构要他点头。
- **教训（07-14 菜名消失事故）**：exceljs 里合并单元格的「从属格」写 value 会**穿透到主格**。我清 Min/Max 列（Q/R）时，凡是 A:R 整行合并的标题/备注行，等于把主格文字整个清空 → 老板发现每道菜名不见了。
- **规则**：①动 xlsx 单元格前先查该行是否在 merge 范围内，合并行只动主格；②清列优先用「隐藏列」而不是逐格置空；③自检不能只看样式（fill/字体），必须断言**用户肉眼看的内容**（标题文字非空、关键值正确）后才报完成。

## 2026-07-14 加料储值抵扣扩展
- **教训**：给周订阅加「加料储值自动抵扣」时，顺手想把 multi-day 页的加料也存 id（纯数据一致性、无功能变化），被老板当场否决。
- **规则**：只改完成需求必须的文件。「顺手保持一致」「future-proof」类改动不做——要做先单独问一句。范围外的 nice-to-have = 老板 review 负担。

## 2026-07-24 换菜：部分排期更新的正确姿势
- 老板说「只改周一/其余待定」时，常驻限日菜（availableWeekdays）的其他供应日**不能顺手砍掉**——那也是「其余天」的一部分，要单独确认。
- 涉及「本周还在卖、下周要变」的菜（如周五特餐、限周五常驻菜），标准解法 = **两段 commit**：第1段只含不碰当周剩余营业日的改动（可立即 push），第2段含冲突日改动（过截单后 push `git push`），第1段单独推用 `git push origin <sha1>:main`。过渡期给受影响菜挂过渡 availableWeekdays（如 [1,4,5]）保住在售日。

## 2026-07-24 事故：并行 session push 把「延后上线」commit 连带推上线
- 现象：菜单第2段（周五改动）commit 留在本地 main 等截单后推，另一个 session 改 dashboard 后 `git push`，整串祖先 commit 一起上线，明天的周五菜单被下周菜单覆盖（幸零客损，止血 revert 53b7462）。
- 规则：**「要延后 push 的改动」绝不能提前 commit 在 main 上**。并行 session 随时可能 push，`push <sha>:main` 只保护自己不保护别人。正确做法 = 延后改动放独立分支（或干脆不提前 commit，到点再改），main 上永远只放「随时可上线」的 commit。
- push 前必跑 `git log origin/main..main --oneline` 看清会带上哪些 commit。

## 2026-07-25 账号合并后 dashboard 按电话找错账号
- 现象：Joaana 合并后（匿名壳留档带 mergedInto），dashboard 手动开单输电话永远命中 0 券的匿名壳——`state.users` 按文档 ID 序，`.find()` 取第一个匹配。客户档案页（buildCustomerProfile）当时修了「未合并优先」，但手动开单的 findRealUserByPhone/findUserDocByPhone 两个入口漏了。
- 规则：**改「按电话/名字匹配用户」的语义时，grep 全部匹配入口一次改齐**（`phoneNormalized ===`、`normalizePhone(u.phone)` 都要搜），别只修当下报障的那条路。同电话多文档是账号合并后的常态，所有查找入口统一模式：`candidates.find(u => !u.mergedInto) || candidates[0]`。

## 2026-07-25 追加：同一查找语义要跨「前端+服务端」两层查
- 昨天修「按电话找用户跳过 mergedInto」只 grep 了 dashboard HTML，今天老板真开单时服务端 API 又用自己的 `.limit(1)` 按电话解析了一次 → 同 bug 第二层爆发（扣券报可用 0 张）。服务端扫出 6 处同款，最危险的是「卖餐券」find-or-create 会把新券铸回匿名壳。
- 规则：修「解析/匹配」类语义 bug 时，**入口清单必须覆盖所有执行层**：dashboard 前端、src/app/api 服务端、脚本（scripts/*.mjs 有同样按电话查的也要过一眼）。dashboard 显示对≠提交对——凡是「前端算一遍、服务端再算一遍」的值，两边都要对齐；能传已解析结果（userId）就直传，别让服务端重新猜。

## 客户端「可下单」校验必须回源现查，别信购物车快照（2026-07-26）
**教训**：CartBundle 把整个 `dish: MenuItem` 存进 localStorage。那是**加入购物车当天**的
快照——菜后来被标 retired、换了 weekday、被 BLOCKED，快照里全是旧值。
用 `item.dish.retired` 判断等于没判断。
**规则**：任何「这道菜现在还能不能点」的判断，一律 `weeklyMenu` 按 `item.dish.id` 现查；
购物车里的 dish 只用来显示名字/图片/价格快照。

## 「同一条业务规则两端各写一遍」= 迟早漂移，必须抽共用函数（2026-07-26）
**教训**：菜品可下单性以前散在三处——CartDrawer 只查日期、submit-order 只查
availableWeekdays、AddOnModal 查 blocked+weekend。结果暂别菜从缝里溜进厨房。
**规则**：客户端和服务端都要跑的判断，写进 `src/lib/` 一个纯函数，两端 import 同一个。
已有先例：`addonCreditMath.planAddonCreditDeduction`（预付加料）、
`cartDateUtils.isOrderDateValid`（日期）、新增 `cartDateUtils.isDishOrderableOn`（菜品×日期）。
加新规则时先问：这条规则客户端也要判吗？要 → 进 lib，不要在路由里内联。

## Vercel 上内存限流不是硬上限（2026-07-26）
**教训**：`check-delivery` 原本只有内存 Map 限流。每个 serverless 实例各有一份，
攻击者把请求打散到多实例就绕过了——对「上游要花钱」的接口（Google Geocoding
≈USD 5/1000 次）等于没防。
**规则**：接口背后是付费上游 → 内存桶（挡单点狂点）+ Firestore 日计数（跨实例硬上限）
两层都要，见 `src/lib/rateLimit.ts`。Firestore 那层 fail-open：DB 挂了宁可放行，
不能让顾客存不了地址。

## dogfood 脚本要 import 生产代码，先注册 @/ 别名 loader（2026-07-26）
裸 node 不认 tsconfig 的 `@/` paths（Node 24 原生 strip-types 只解决 .ts 后缀）。
跑法：`node --import ./scripts/_register-alias.mjs scripts/xxx.mts`

## runTransaction 回调里给外层变量赋值，必须在回调开头重置（2026-07-26）
**事故：** `cancelOrderWithRollback` 用「事务里翻状态 + 把 orderData 赋给外层变量，
外层据此判断自己是不是赢家」来做幂等。3 个并发取消**全部判定为赢家**，dishStock
被加了 3 次 → 超卖。
**根因：** Firestore 事务遇到写冲突会**重跑整个回调**。第一次跑读到 pending、给
orderData 赋了值、提交时输了；重试时读到 cancelled 走 return —— 但上一轮的
orderData 还留在外层变量里。
**规则：** 事务回调是**可能跑多次**的纯函数，不能假设只跑一次。任何在回调里给外层
变量赋值的写法，回调**第一行**就要把它重置。更稳的做法是用 runTransaction 的返回值
传结果，别写外层变量。
**附带教训：** 这个 bug 是 dogfood 的并发用例抓到的，不是 review 看出来的。涉及
increment / 幂等 / 状态机的改动，**必须写并发用例**（Promise.all 同时打 3 次），
单线程顺序测试永远测不出来。

## 老板质疑我的结论时，先用数据核实，别急着辩护（2026-07-26）
老板问「取消订单不是会退餐券吗」——我原本在审计报告里把 P1-2 写成「顾客餐券被吞
= 顾客的钱没了」。写只读审计脚本一查：**0 张卡住的券**，老板是对的。真实情况是
餐券确实会退（走 confirm-order），漏的是两层库存；而且 admin/data 那条路要「FPX +
用了餐券 + 挂超 10 分钟」三个条件同时满足才踩得到，至今没撞上。
**规则：** 报告安全问题分「代码上可能」和「实际已发生」两档，别混为一谈。能查数据
的一律先查（写只读脚本，几分钟的事），拿不到数据就明说「机制上存在，未验证是否发生过」。
夸大严重性会让老板对后续的真问题也打折扣。

## 「有折扣但没扣券」先分单再定性，别一眼当泄漏（2026-07-26）
查 Zowi3 白送两碗时全库扫「有 `mealVoucherDiscount` 但无 `claimedMealVoucherIds`」
命中 23 单。**其中 20 单是网页多天分单（`isMultiPart`），券挂在 part 1，
兄弟单只记折扣标记，完全正常** —— 按 `groupId` 汇总张数一对就知道。真漏只有 3 单。
**规则：** 涉及 `mealVoucherDiscount` / `addonCreditsDiscount` 的对账，
永远先按 `groupId` 聚合再判断，per-doc 看必然误报一大片。

## 判断「API 跑没跑过」用副作用顺序，比猜字段顺序硬（2026-07-26）
一开始靠 Firestore 字段写入顺序（更新时新字段追加在尾部）推断建单路径，
推到一半发现几种解释都自洽，属于猜。**真正的证据是副作用顺序**：
`manual-voucher-redemption` 路由里扣券(step 3) → 扣 credit(step 4) → 写订单(step 5)，
若 step 5 失败必然留下 `redeemedOrderId` 指向该单的券，且前端 catch 会 `deleteDoc`
回滚。实际「没有任何券指向这单 + 订单还在」→ **API 从未运行过**，唯一解。
**规则：** 定位「某条代码路径有没有跑过」，找它必然留下的**跨集合副作用**做判据，
别靠字段顺序 / 时间戳这类间接痕迹推。推不出来就老实说不确定。

## 一个动作两条岔路时，检查「守卫是不是只装在其中一条」（2026-07-26）
Dashboard 手动单保存分新增 / 编辑两支：新增那支调扣券 API 且失败回滚，
编辑那支只 `updateDoc`，扣券整块在 `else` 里 → 编辑时写了账面折扣但券池不动。
UI 注释已经写明「编辑不该改券」，**但输入框只重置成 0 没 disable**，形同虚设。
**规则：** 见到 `if (editing) {...} else {...}` 这类分叉，逐条列出「写库前必须做的
校验 / 副作用」，确认每条岔路都覆盖。**注释里写的约束必须有代码强制**，
只靠重置默认值不算强制。

## 改菜价 = 全体旧购物车立刻失效，必须有客户端刷价（2026-07-27）
餐券客户结账被「价格验证失败: 柠香香煎三文鱼饭 服务器 RM24.90, 客户端 RM23.90」挡死。
根因不是 bug 而是**快照过期**：`CartBundle` 整个存 localStorage，`dish` 和 `price`
都是加入购物车那天的值；07-26 的 2f50b8c 把三文鱼调到 24.90，客户几天前加的车
还停在 23.90，服务端按现价重算就对不上（这条校验同时是防篡改闸门，不能放宽容差）。
**规则：**
1. 改 `weeklyMenu.ts` 的 `price` / `voucherTopUp` / 或 `addOnsConfig.ts` 的加料价，
   等于让**所有存量购物车**当场作废 —— 与「换菜」是两类风险，别混为一谈。
2. 客户端唯一刷价入口 = `src/lib/cartRepricing.ts`，在 `cartStore` 的 persist
   `merge` 里跑（页面加载 rehydrate 那一刻）。它的公式必须与
   `/api/submit-order` 逐字一致（`getDishPrice` + `ADD_ON_PRICES`），
   改了服务端算法要同步改它，回归跑 `scripts/dogfood-cart-repricing.mts`。
3. 服务端拒收文案要给客户能执行的下一步（「请刷新页面」），
   别甩「价格验证失败 / 服务器计算 X 客户端提交 Y」这种开发者黑话。
4. 调价当天有客户报下不了单 → 先问「购物车是不是放了几天」，别急着查支付链。

## 新菜上线必须同时建 dishIngredients 配方，否则备餐清单静默算 0（2026-07-30）
豆酱焖排骨 07-25 上线时只改了 `weeklyMenu.ts` + dashboard `MENU_SEED`，**没建
`dishIngredients.ts` 配方条目**。`aggregateIngredients` 对无配方的菜是
`if (dishRecipe)` 直接跳过 → 那道菜在碗妈 06:30 备餐清单里贡献 **0 食材**，
双层库存也不扣。周五 8 单排骨全程没进过采购汇总。
唯一的告警出口 `collectUnrecipedLabels` 只挂在 `/api/admin/ingredient-stock`
（Dashboard「库存」tab advisory），**备餐清单本身不会提示**，所以是纯静默。
**规则：**
1. 新菜上架的 checklist 是**三处**不是两处：图 + `weeklyMenu.ts` + dashboard
   `MENU_SEED` + **`dishIngredients.ts` 配方**。没有份量数据就先建条目、
   `ingredients` 里放已知的（白饭 80g 全表统一），未知的挂 `TODO_CONFIRM`
   注释 —— 建了条目才有东西可补，空着=静默 0。
2. 老板说「克数和别的一样」不能直接照抄某道菜：全表唯一统一的只有
   **白饭 80g 生米**；主料每道差异极大（三文鱼 120g / 希腊鸡胸 200g /
   咖喱鸡胸 60g / 五花肉 140g / 鸡扒·猪扒·和牛饼按「块」/ 鸡全腿按「只」）。
   要逐项问，别推断。
3. 遇到「这道菜的配菜是特别份量」→ 另立 SKU（如「马铃薯煎蛋B」按「份」计），
   **不要为了拆成马铃薯 Xg + 蛋 X 颗而编克数**。
4. 验证方式：用 `node --import ./scripts/_register-alias.mjs` 跑一段
   `aggregateIngredients([{items:[{name:'新菜',quantity:2}]}])`，
   确认输出有料且 `collectUnrecipedLabels` 返回 `[]`。

## 换菜「跨周推送」要先算下一个配送日，别只看今天星期几（2026-07-30）
`WEEKLY_SCHEDULE` 是按 **weekday** 索引的，不是按日期 —— 所以周五 07-31 和
周五 08-07 共用同一个槽位，**没法在一次部署里让两个周五显示不同菜**。
周四 19:00 推「下周菜单」= 周五客人当场看到下周的菜（本周真正要卖的那两道
变灰不可点），而厨房备的是本周的料。这就是 07-24 事故的机制根因。
**规则：**
1. Push 菜单前先算：`now > 今天 06:00` → 下一个配送日 = 明天（周五则跳到周一）。
   **下一个配送日落在哪一周，决定了现在能不能推。**
2. 本周还有营业日没过截单 → 下周菜单只能 commit 留本地，等最后一个截单
   （周五 06:00）过了再推。要临时改本周某一天 → 拆成**两段 commit**
   （第1段=只改那一天，先推；第2段=下周整周，到点再推），别用 revert 来回折腾。
3. 拆段时 `git reset HEAD~1` 重排比「revert + replay」干净 —— 前提是那个
   commit 还没 push。push 前务必 `git log origin/main..main` 确认。

## 新增/改价「加料·套餐」要走六个触点，漏一个就出事（2026-07-31）
一次改动里同时上了 5 个新加料/套餐 + 2 次改价，逐个数下来触点是**六处**，
散落在两个 repo 里（web repo + Desktop dashboard），漏任何一个的具体后果：

| # | 位置 | 漏了会怎样 |
|---|---|---|
| 1 | `src/data/addOnsConfig.ts` `ADD_ON_PRICES` | 服务端权威价。漏＝submit-order 校验不过，客人看到「价格验证失败」付不了款 |
| 2 | `src/components/menu/AddOnModal.tsx` | 网站显示。套餐的 `titleEn` 里**也嵌着价格**，改价要一起改 |
| 3 | Desktop dashboard `ADDON_SEED` | canonical 价，登录时自动 merge 回写 Firestore `addons`。漏＝dashboard 显示旧价（**但老板不用去 Settings 手改，seed 会自动刷**） |
| 4 | Desktop dashboard `DISH_ADDON_MAP['<dashboard 菜 id>']` | 手动录单选不到。⚠️ dashboard 菜 id ≠ webapp 菜 id（如 dashboard 14 = webapp 1），照菜名核对 |
| 5 | Desktop dashboard `WEB_LABEL_TO_ADDON_ID` | 成本归因查不到 id → 该加料成本算 0 |
| 6 | `src/data/dishIngredients.ts` 三处：`addOnRecipes` + `addOnShortNames` + `MANUAL_LABEL_ALIASES` | **静默算 0 食材**（2026-07-25 豆酱焖排骨那个坑）。网页长标签和 dashboard 短标签是两个 key，都要能查到 |

收尾两条命令缺一不可：`node scripts/gen-dish-addon-map.mjs`（重生成
`dishAddonMap.generated.ts`，喂 /admin/multi-day 与 /admin/subscriptions 的加料下拉）
→ `npm run sync:dashboard`（Desktop → public 副本）。
**不用管的：** `cartRepricing` 读 `ADD_ON_PRICES` 自动刷旧购物车（跑
`dogfood-cart-repricing.mts` 验证）；`PREPAID_ADDON_OPTIONS` 只在这个加料要能预付时才动。
**验证方式：** 一次跑完网页长标签 + dashboard 短标签两套写法的
`aggregateIngredients`，`collectUnrecipedLabels` 必须返回 `[]`。

## 老板给的单位口径要复述确认，"pcs" 不等于「整份」（2026-07-31）
老板发「i bought unagi for RM5.225/pcs」，我按字面当成**整片**进价，半片算
RM2.61，据此定加料价 RM7.90。他更正：**5.225 就是半片的价**（整片 10.45）——
成本口径错一倍，售价直接少收一半。同一轮里「马铃薯煎蛋B 1 份」我也曾按
加料版整份估成本 RM1.46，实际是 1/4 份 = RM0.36，高估 4 倍。
**规则：**
1. 拿到任何采购单价，先**用菜里的实际用量复述一遍**再定价：
   「RM5.225/pcs → 主菜每份用 0.5 pcs，也就是每碗鳗鱼成本 RM2.61，对吗？」
   —— 老板一眼就能看出口径错没错，比事后改价便宜得多。
2. 中英混写的单位（pcs / 片 / 份 / 块）在「半份」场景一律有歧义，别自己选一个。
3. 拆分/合成的自校验：拆完拿整数份量回算一遍。这次 4 碗鳗鱼饭聚合出
   「马铃薯 150g + 鸡蛋 2 颗」＝正好一整份煎蛋切四块，口径自洽才敢提交。

## 手动补 credit/记录时价格必须查 ADD_ON_PRICES 现价，别抄旧文档（2026-08-01）
给 Zowi3 手动新建 salmon-upgrade credit 时，我抄了她**旧 credit 里的 RM4**
（那批是涨价前买的，unitPriceRM 是历史快照），而 addOnsConfig.ts 的
`ADD_ON_PRICES` 现价是 RM5。结果凭空造出 RM1「差额」还让老板定夺，
实际上按现价算收款刚好对平——错误的输入制造了不存在的问题。
**规则：**
1. Firestore 里的 `unitPriceRM`/`unitAllocatedRM` 是**购买时点的历史快照**，
   永远不能当现价用。
2. 任何手动建 credit / 补记录 / 算差额，价格一律先 grep
   `src/data/addOnsConfig.ts` 的 `ADD_ON_PRICES`（拒收层唯一权威）再动手。
3. 发现「差额」先怀疑自己的输入数据过时，复核完源头价再上报老板。

---

## 2026-08-01 · Windows/Git Bash 上 `pkill` 杀不掉 next start → 验证假阴性

**症状**：改完「记住上次午/晚餐」，无头浏览器实测 localStorage 死活不写。
源码对、tsc 过、build 过、连打包产物里都 grep 到了 `localStorage.setItem(k,t)`，
但线上就是不生效。差点去改一段根本没坏的代码。

**根因**：`pkill -f "next start"` 在 Git Bash 里匹配不到实际的 `node.exe` 进程，
旧服务器从没被杀掉。新起的 `next start` 撞 `EADDRINUSE` 直接退出——错误只进了
重定向的日志文件，终端上一片安静，`curl /` 照样 200（旧服务器在应答）。
于是**我一直在测上一次构建的产物**。

**决定性证据**：`curl` 本次构建新产生的 chunk → **404**。文件在 `.next/` 里躺着，
服务器却不认，说明服务器和磁盘上的 build 不是同一份。

**规则（下次照做）**：
1. Windows 上停服务器不要用 `pkill`。用：
   `PID=$(netstat -ano | grep ":3131" | grep LISTENING | awk '{print $5}' | head -1); taskkill //PID $PID //F`
2. 启动后**必须**验证服务器是新的，两种任选其一：
   - `head -3 <启动日志>` 看有没有 `EADDRINUSE`
   - `curl -o /dev/null -w "%{http_code}" <本次新增的 chunk 路径>` 必须 200
3. 更普遍的教训：**当「源码对、构建产物里也对、但运行时不对」时，先怀疑跑的
   不是这份构建**，而不是怀疑代码。验证链条上任何一环没确认过，就不算验证过。
