# 菜品成本重建 + 空读 re-seed 护栏（2026-09-17）

起因：2026-09-15 22:57 dashboard 读到 menu/addons 空集合 → 整体 re-seed →
27 道菜 + 77 加料的 costPrice 全部清零；PITR 关闭无法恢复。
详见 memory `project_dish_cost_data_wiped_20260915`。

## A. 重建成本数据（来源 = 老板的 Costing v5 + 配方）

- [x] A1 零依赖读 xlsx（`scripts/lib/xlsx.mjs`，只用内置 zlib，不落临时目录）
- [x] A2 抽 Ingredient Costing 的「True Cost/Unit 实际单价」91 项
      · 行号与锁定的 MAP 逐行核名通过；用它重跑 `_review-all-combos.mts`，
        10 个套餐毛利 60–78% 与 09-05 那次逐项吻合 → 抽取口径验证通过
- [x] A3 抽 Dish Costing 的 15 张子表（14 个 🥣 区块，其中姜葱鱼片饭区块里藏着
      第二张没标题的「三文鱼饭」表），剔除包装/餐具行
- [x] A4 交叉验证：老板自己那行毛利率（含包装）与我算的逐道吻合
      （希腊 62.45%、三文鱼 63.14%、姜葱 65.10% 全部对上）
- [x] A5 版本选择 = 版本 A（基础做法列）。C/D/E 多是「2 只腿 / 3 只腿」叠加列，
      对 RM18.50 的菜算出 RM16~22，明显不是在卖的那份 → 只认 A，并留自洽校验兜底
- [x] A6 dry-run 全表 + 与旧 v4A 表的两个锚点对照（#5 7.43→7.32、#12 6.73→5.72）
- [x] A7 写 Firestore：主菜 15 道，回滚日志 `scripts/logs/restore-cost-prices-*.json`
- [x] A8 加料 60 个（`addOnRecipes` × 真单价，**边际口径**）
- [x] A9 12 道菜 + 17 个加料无可靠来源 → 一律不写数字，列成待补清单

## B. 焊掉「空读 → 整体 re-seed」这条毁数据路径

- [x] B1 seed/建档永不写 `costPrice`（连 MENU_SEED 字面量里的 `costPrice: 0` 都剥掉），
      且全部改 `{merge:true}` —— menu 与 addons 两处
- [x] B2 localStorage 绊线 `ib_collection_seen_counts`：记住本机见过的最大文档数；
      本次读到 0 而历史见过 >0 → 跳过 seed + 跳过全部 migration + 弹红字告警
- [x] B3 改 Desktop 源 → `npm run sync:dashboard` 回灌 public/
- [x] B4 验证：`node --check`（module）过 866KB 内联 script；vm 抠真实分支跑 4 用例全过
      （① 全新机器该 seed ② 见过数据又读到 0 不 seed 且报警 ③ 正常读记计数
       ④ 读报错不误报「被清空」——④ 第一版没过，已修）
- [x] B5 只 commit 本地，不 push

## Review

**根因链（有时间戳证据）**
1. 09-05 `6e5febf` 把 `MENU_COSTS_FROM_EXCEL` 清空（该文件 sync 到 public/ 公网可下载，
   写真实成本=公开毛利）。设计前提：成本价只活在 Firestore。
2. 但 dashboard 的 auto-seed 分支用 `setDoc()` 不带 merge、且写 `costPrice: 0`。
3. 09-15 22:57 menu/addons 在服务端为空（谁清空的查不出，仓库内无任何脚本会删这两个
   集合、PowerShell 历史无 `firestore:delete`、09-15 无脚本运行痕迹）→ auto-seed 整体重建
   → 成本全成 0。`_err` 哨兵只挡「读报错」，挡不住「读成功但真的空」。
4. PITR = DISABLED、保留期 1 小时、free tier 无定时备份 → Firestore 侧捞不回来。

**落地结果**
- 主菜 15/27、加料 60/77 已恢复，毛利率 63.8%~75.3%
- 那条毁数据路径已焊死：就算再被清空一次，成本价也不会被覆盖，而且会看到红字告警
- 恢复本身现在是一条可重放的命令：`npx tsx scripts/restore-cost-prices.mts [--commit]`
  （老板补完成本表里缺的菜，直接重跑即可；幂等，dry-run 复现已写入值逐道相同）

**待老板拍板**
1. 12 道菜成本表里没有区块（#25 咖喱、#26 柠檬蜜糖鸡扒、#27 甜酸猪扒、#28 豆酱排骨、
   #29 鳗鱼、#30 白萝卜焖花肉、#32 蜜糖三文鱼、#33 芝麻蜜汁鸡扒、#34 葱油鸡腿、
   #35 蚝油姜蒜鱼片、#36 土豆焖五花、#37 和牛片）。
   其中几道有「同款可参考」：#26/#33 结构同 #1 鸡扒饭(6.56)、#32 同 #21 三文鱼(8.60)。
   但换了酱汁就不是同一个成本，我不替他填。
2. **小番茄按颗还是按克**：老板表里自己不一致 —— 鸡扒饭区块记 40g/2颗（20g一颗）、
   三文鱼区块记 20g/2颗（10g一颗）。定了才能给 cherry-tomato 系列加料算成本。
3. **三文鱼单位**：成本表按 pcs 计价 RM6，配方写 120g。若 1 pcs = 120g 就能给
   `extra-salmon-70g` 算成本，但这是单点推断，要他确认。
4. 要不要**开 Firestore PITR**（付费）。现在成本类数据只有一份，没有第二次机会。
5. `public/dashboard-h7x2q9.html` 这次 sync 夹带了**不是我做的**改动（收件箱 UI 改版、
   侧栏可滚动、手机单栏）—— HEAD 里 0 处、Desktop 源里 15 处，是别的 session / 老板
   自己改在 Desktop 上一直没回灌的。会话开始时该文件就已是 M 状态。push 前请先确认
   那批 UI 改动是想上线的。
