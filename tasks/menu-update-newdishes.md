# 菜单更新 — 上新 2 道 + 退役鸡汤 + 周二双特餐架构解耦

> 状态：待老板最终拍板蛋白质 tag 后开工。生产环境有真实客户，改完按「push 前必须先验证」本地 tsc + dogfood 再 commit/push。

## 背景
老板在外部表格里设计了新菜单（截图为目标态）。代码真正数据源 = `src/data/weeklyMenu.ts`。
**核心障碍：** 特餐的 `id` 被当「星期几」用（周一=1…周五=5），靠 `id===weekday` 取当天特餐。周二要放两道 → id 撞车，必须先解耦。

## 改动清单

### 1. 架构解耦（地基，先做）
- [ ] `MenuItem` 加 `weekday?: number`（0–6，常驻菜不填）字段；`id` 回归纯唯一标识。
- [ ] 现有特餐 id 1–5 改成真正唯一 id，新增 `weekday` 对应原值。常驻 id 11–14 不变。
- [ ] 改 `src/lib/nextSpecial.ts`：所有 `d.id === wd` → `d.weekday === wd`；`isDishBlockedOn(wkly.id,…)` 改用稳定 key。
- [ ] 改 `src/components/home/MenuCarousel.tsx`：`menuDates[dish.id]`、排序、`tomorrowsId` 比对，全部从「按 id=星期」迁到「按 weekday」。
- [ ] 同步检查 `src/lib/dateUtils.ts`（menuDates 构建）、`MenuCarouselEN.tsx`、`src/app/en/*`、备餐聚合 `prepIngredients.ts`、`dishIngredients.ts`、`dishAliases.ts`、admin/dashboard 是否按 id=星期 取数。

### 2. 周二双特餐
- [ ] 新增「古早味姜葱鱼片饭」weekday=2，**设为周二主推**（Hero「明日特餐」周二展示它）。
- [ ] 「招牌原盅当归蒸鸡全腿」保留 weekday=2，降为周二第二道（卡片区照常出现）。
- [ ] `computeNextSpecial` 周二需返回「主推」那道 → 加 `isPrimary?: boolean`（或按数组顺序取第一道）。

### 3. 退役周五鸡汤（可见不可点 + 说明）
- [ ] 「金黄葱香煎鸡汤」去掉 weekday，加 `retired: true` + `retiredNote`（如「鸡汤暂别，敬请期待回归」）。
- [ ] MenuCarousel 复用现有 `isDisabled` 灰显态渲染退役菜：图灰、按钮禁用、文案显示 retiredNote。

### 4. 马铃薯炖花肉片周二不供应（可见不可点 + 说明）
- [ ] 常驻菜加 `excludeWeekday?: number`（=2）+ note「周二不供应」。
- [ ] 当配送日=周二时，该卡走灰显态、按钮「周二不供应」、不可加购。复用同一套 disabled 渲染。

### 5. 两道新菜数据
**古早味姜葱鱼片饭**（weekday=2，主推）
- nameEn: Grandma-Style Ginger-Scallion Fish Fillet
- price: **18.50**（老板拍板，覆盖截图的 19.90）
- image: PNG→webp（website-dish-main-no-text-v1.png）
- desc: 巴丁鱼片用姜丝葱段爆香，淋一勺绍兴酒提鲜，盖一颗**荷包蛋**——古早味的温柔。
- descEn: Patin fish fillet stir-fried with ginger and scallion, lifted by a splash of Shaoxing wine and crowned with a sunny-side-up egg — gentle, old-school comfort.
- tags: ["高蛋白 40g+", "古早味", "姜葱爆香", "荷包蛋", "鱼片嫩滑"]

**柠香香煎三文鱼饭**（weekday=5）
- nameEn: Lemon Pan-Seared Salmon
- price: 23.90；`voucherTopUp: 4`（餐券抵扣需补 RM4）
- image: PNG→webp（website-salmon-rice-bowl-no-text-v1.png）
- desc: 香煎三文鱼外焦里嫩，挤上柠檬清香，配西兰花、毛豆、玉米与樱桃番茄，清爽又满足。
- descEn: Pan-seared salmon, crisp outside and tender within, brightened with lemon and served with broccoli, edamame, corn and cherry tomato — light yet satisfying.
- tags: ["高蛋白 22g+", "香煎三文鱼", "柠香清爽", "Omega-3", "彩蔬均衡"]

### 6. 餐券补差价 voucherTopUp
- [ ] `MenuItem` 加 `voucherTopUp?: number`。
- [ ] 找到结账走券逻辑（CartDrawer + submit-order），用券抵扣时对带 voucherTopUp 的菜额外收该金额。
- [ ] 现状 mealVoucherConfig：1 券=1 菜任意，FACE_VALUE 18.50。三文鱼 23.90，券抵后补 4（≈ 当 19.90 算）。

## 蛋白质估算来源（USDA，按食材表克数，取保守下限做「+」标）
- 姜葱鱼片饭：巴丁鱼 250g×~14–15g/100g ≈35–37g + 荷包蛋 6g ≈ 41–43g → 标 40g+
- 三文鱼饭：三文鱼 熟70–100g×~22–25g/100g ≈17–25g + 毛豆/西兰花/玉米 ≈5.7g ≈ 22–31g → 用 70g 下限标 22g+

## 验证
- [ ] `npx tsc --noEmit` 通过
- [ ] dogfood：首页周一/周二/周五各看一遍 Hero + 卡片区（周二两道、周五三文鱼、鸡汤灰显、马铃薯周二灰显）
- [ ] EN 站同步检查
- [ ] 按「push 前必须先验证」：commit → push → 线上 smoke check

## Review（2026-06-08 完成）
**改了 10 个文件 + 2 张图**，tsc 通过、mock 全星期逻辑通过、localhost 中英文站实测通过。
- 数据：weeklyMenu.ts（解耦 id↔weekday、2 新菜、退役鸡汤、马铃薯 excludeWeekday、dishVoucherValue helper）
- 逻辑：nextSpecial.ts（pickSpecial 选主推）、dateUtils.ts（退役/排除/weekday 分支）
- 显示：MenuCarousel.tsx + MenuCarouselEN.tsx（菜数排除退役、移动端禁用说明、EN 翻译）
- 餐券：CartDrawer.tsx + submit-order/route.ts（按 voucherValue=价-topUp 双端一致）
- 备餐：dishIngredients.ts（2 道配方；三文鱼采购克数 TODO_CONFIRM）
- 图：public/ginger_scallion_fish.webp、public/lemon_salmon.webp（PNG→webp 800²）

**蛋白质**：用了老板给的真实值（鱼片 28g+ / 三文鱼 30g+），非我的 USDA 估算。
**待确认**：三文鱼每份采购生重（现按 120g 估，dishIngredients.ts 有 TODO_CONFIRM）。
**未做**：git commit/push（等老板拍板）。
