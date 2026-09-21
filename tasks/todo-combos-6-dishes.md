# 6 道在售主菜补齐两档套餐 — 2026-09-21

## 老板拍板（09-21 对话）
- 范围：只做在售 6 道 #1 #24 #28 #30 #32 #33；hidden #34–38、暂别 #22 不做
- 每道两档；三文鱼不沿用旧套，#21 两个旧套（柠香双蛋白套 / 三色加倍套）一起换成新套
- 文案我写初稿，老板改；commit 留本地，老板同意后低峰 push
- #30/#28/#32/#21/#33 的第二档用 C 档：马铃薯煎蛋＋荷包蛋＋加饭，原价 8.50 → **RM7.00**
- #28 碗里有西兰花 50g（与 #30 同口径，无其他配菜）→ 补进配方

## 方案
| 菜 | A 档 | 第二档 |
|---|---|---|
| #1 酱油鸡 | 酱香下饭套 12.90（西兰花炒蛋+荷包蛋+加饭，原价 15.40） | 酱油鸡干饭套 5.90（荷包蛋+加饭+毛豆，原价 7.00） |
| #24 和牛饼 | 和牛下饭套 13.90（西兰花炒蛋+马铃薯煎蛋+加饭，原价 16.90；碗里已有温泉蛋） | 和牛干饭套 5.90（温泉蛋+加饭+毛豆，原价 7.50） |
| #28 排骨 | 排骨下饭套 12.90（标准） | 排骨干饭套 7.00（C） |
| #30 白萝卜 | 萝卜下饭套 12.90（标准） | 萝卜干饭套 7.00（C） |
| #32 + #21 三文鱼 | 三文鱼下饭套 12.90（标准，共用一个 id） | 三文鱼干饭套 7.00（C） |
| #33 芝麻鸡扒 | 复用现有古早味下饭套（同 id，不动 #14/#26） | 鸡扒干饭套 7.00（C） |

## 步骤
- [x] web：ADD_ON_PRICES 登记 11 个新 id；#21 两个旧 id 留 legacy（三色加倍套卖过 2 次）
- [x] web：dishCombos.ts 6 道菜配置 + #21 换套
- [x] web：dishIngredients.ts addOnRecipes / addOnShortNames / MANUAL_LABEL_ALIASES / COMBO_COMPONENTS；#28 配方补西兰花 50g
- [x] Desktop dashboard：ADDON_SEED / COMBO_CONTENTS / WEB_LABEL_TO_ADDON_ID / PACKING_COMBO_EXTRA_RICE / DISH_ADDON_MAP
- [x] gen-dish-addon-map → sync:dashboard
- [x] 验证：tsc、dogfood-dish-combos、dogfood-combo-components、npm run build
- [ ] 本地浏览器目视弹窗
- [ ] 文案给老板审 → commit 本地 → 等老板同意再 push

## 验证结果（2026-09-21 晚）
- tsc 0 错（先前 .next 残留的 wa-media 类型报错随 build 重建消失，源码无关）
- npm run build 通过
- dogfood-dish-combos 308/0、dogfood-combo-components 32/0
- sync:dashboard 价格检查全部一致；dashboard 内联脚本 node --check 通过
- 12 个套餐长/短标签全部解析到配方；#28 配方 = 排骨 180g + 西兰花 50g + 白饭 80g
- 未做：浏览器里目视弹窗
