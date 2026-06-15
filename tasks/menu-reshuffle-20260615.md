# 菜单整周重排 + 新增周四菜 (2026-06-15)

## 背景
老板给出新菜单，相比线上是一次几乎整周的特餐重排 + 1 道全新周四菜。

## 已确认的决定
- [x] Mon 两道特餐，Hero 主打 = 香煎金黄鸡扒饭 (id14)
- [x] Wed 两道特餐，Hero 主打 = 古早味姜葱鱼片饭 (id20)
- [x] 退役菜（酱油鸡 id1 / 鸡汤 id5）保持灰显不变
- [x] 周四新菜图片稍后补 → 先 emoji 🍲 占位 + 补图片守卫
- [x] 中文/英文菜名沿用库内现有写法（避免牵连备餐配方表 + 历史订单）

## 重排映射
| 菜 (id) | 旧 weekday | 新 weekday | isPrimary |
|---|---|---|---|
| 香煎金黄鸡扒饭 (14) | 常驻 | 周一(1) | ✓ |
| 绍兴酒蒸花肉 (4) | 周四(4) | 周一(1) | — |
| 希腊柠香烤鸡胸 (3) | 周三(3) | 周二(2) | — |
| 古早味姜葱鱼片饭 (20) | 周二(2) | 周三(3) | ✓ |
| 招牌当归蒸鸡 (2) | 周二(2) | 周三(3) | — |
| 家乡豆酱焖花肉 (新23) | — | 周四(4) | — |
| 柠香三文鱼 (21) | 周五(5) | 周五(5) 不变 | — |

## 任务清单
- [ ] 1. weeklyMenu.ts：重排 day/weekday/isPrimary + 新增 id23 + 整理顺序(常驻→周一至五→退役) + 更新注释
- [ ] 2. dishIngredients.ts：新增「家乡豆酱焖花肉」配方桩 (shortName 豆酱, ingredients 空)
- [ ] 3. HeroSection.tsx：背景轮播 + 明日特餐大图加 startsWith('/') 图片守卫
- [ ] 4. HeroSectionEN.tsx：同上两处守卫
- [ ] 5. layout.tsx：JSON-LD image 字段加守卫（非路径则省略）
- [ ] 6. blockedDates.ts：更新 id4 注释（周四→周一）
- [ ] 7. 验证：npx tsc --noEmit + 本地 dogfood 确认 Hero/菜单渲染正常
- [ ] 不动 /order 广告落地页（独立 DISHES 静态列表，不属于周菜单）
- [ ] 不 push（等老板验收 + 补图后再说）

## Review (已完成 2026-06-15)
- weeklyMenu.ts：整周重排 + 新增 id23 家乡豆酱焖花肉(🍲 占位) + 顺序整理(常驻→周一至五→退役) ✓
- dishIngredients.ts：新增「家乡豆酱焖花肉」配方桩(shortName 豆酱) ✓
- HeroSection.tsx / HeroSectionEN.tsx：背景轮播 + 明日特餐大图 加 startsWith('/') 守卫 ✓
- layout.tsx：JSON-LD image 非路径则省略 ✓
- MemberView.tsx：resolveDishImage 只接受真实路径(否则回退 emoji 缩略图)，防订单历史 next/image 崩 ✓
- blockedDates.ts：更新 id4 注释(周四→周一) ✓
- 验证：`npx tsc --noEmit` 通过；`npm run build` 通过(首页 / 与 /en 静态预渲染无报错)

### 图片消费处审计(确保 🍲 emoji 不进 next/image)
MenuCarousel/EN、AddOnModal 菜品头图、CartItemCard 均已自带守卫；HeroSection×2、layout JSON-LD、MemberView 本次补齐；
AddOnModal 加料缩略图用的是加料配置图(非菜品图)不受影响；/order 广告页用独立 DISHES 静态列表，未触碰。

### 待办(交回老板)
- 周四菜实拍图：拿到后把 weeklyMenu.ts id23 的 `image: "🍲"` 换成 `/xxx.webp`(放 public/) 一行即可
- 周四菜蛋白克数等营养标签：碗妈给数据后补进 tags + dishIngredients 配方
- 简介初稿待老板审定
- 未 push(等老板验收 + 补图)
