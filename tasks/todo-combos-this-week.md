# 本周菜单全部补齐两档套餐 — 2026-09-22

## 线上本周（Firestore menuWeeks/2026-09-21，老板 09-18 设定）
| 日 | 菜 | 现有套餐 |
|---|---|---|
| 周一 | #29 照烧鳗鱼 | ✅ 两档 |
| 周一 | #12 山药云耳 | 一档（海陆澎湃三件套） |
| 周二 | #3 希腊鸡胸 | 一档（蛋白质核弹三件套） |
| 周二 | **#35 蚝油姜蒜鱼片** | ❌ 无 |
| 周三 | #28 豆酱排骨 | ✅ 两档 |
| 周三 | #21 柠香三文鱼 | ✅ 两档 |
| 周四 | #14 金黄鸡扒 | 一档（古早味下饭套） |
| 周四 | **#36 土豆焖五花肉** | ❌ 无 |
| 周五 | **#34 葱油鸡腿** | ❌ 无 |
| 周五 | **#38 柚香三文鱼** | ❌ 无 |
| 常驻 | #11 纳豆 / #13 马铃薯炖花肉片 | 一档 |
| 不在本周 | #37 和牛片（hidden）、#22 参峇（暂别） | ❌ 无 |

## 沿用 09-21 规则
- A 档「下饭套」= 西兰花炒蛋 + 荷包蛋 + 加饭，RM12.90（原价 15.40）
- 碗里没菜 → 第二档「干饭套」= 荷包蛋 + 加饭 + 毛豆，RM5.90（原价 7.00）
- 碗里已有西兰花/配菜 → 第二档 C 档 = 马铃薯煎蛋 + 荷包蛋 + 加饭，RM7.00（原价 8.50）

## 方案草案（等老板拍板）
- #38 柚香三文鱼 → 直接共用三文鱼下饭套 / 三文鱼干饭套（同 #21/#32，不新增 id）
- #34 葱油鸡腿（碗里有西兰花）→ 葱油下饭套 12.90 + 葱油鸡干饭套 C 档 7.00
- #35 蚝油鱼片（无菜无蛋）→ 蒜香下饭套 12.90 + 鱼片干饭套 5.90
- #22 参峇（无菜无蛋）→ 参峇下饭套 12.90 + 参峇干饭套 5.90
- #36 / #37 碗里已有马铃薯 → 待定（见问题）
- #14 金黄鸡扒 → 挂上 #33 已有的鸡扒干饭套（C 档，同 id）；#26 同碗一起挂

## 老板拍板（09-22 01:3x）
- #34 #35 #22 #38 照规则两档；#36 #37 下饭套 + 干饭套（毛豆，避开马铃薯）
- #14/#26 补挂鸡扒干饭套；#12 #3 在原三件套之外补下饭套；#11 #13 不动

## 步骤（每新增套餐 id 的六个触点）
- [x] addOnsConfig.ts ADD_ON_PRICES 登记 12 个新 id
- [x] dishCombos.ts 逐菜配置（鸡扒干饭套抽成 CHICKEN_CHOP_RICE_ITEM 共用）
- [x] dishIngredients.ts addOnRecipes / addOnShortNames / MANUAL_LABEL_ALIASES / COMBO_COMPONENTS
- [x] Desktop dashboard：ADDON_SEED / COMBO_CONTENTS / WEB_LABEL_TO_ADDON_ID / PACKING_COMBO_EXTRA_RICE / DISH_ADDON_MAP
      （改动写成锚点替换脚本，已在 origin/main 的 public 底版上试跑成功，push 时可重放）
- [x] gen-dish-addon-map → sync:dashboard
- [x] 验证
- [ ] 本地浏览器目视弹窗
- [ ] 老板审文案 → 同意后低峰 push（本地 main 与 origin 分叉，要 cherry-pick + dashboard 按锚点重放）

## 验证结果（2026-09-22 01:4x）
- tsc 0 错；npm run build 通过
- dogfood-dish-combos 404/0（原 308）；dogfood-combo-components 44/0（原 32）；dogfood-dashboard-egg-map 8/0
- sync:dashboard 价格全部一致；dashboard 内联脚本 node --check 通过
- 15 个套餐短标签 → 长标签 → 配方全部可解析
- dishAddonMap.generated 只多了本次的套餐，无夹带
