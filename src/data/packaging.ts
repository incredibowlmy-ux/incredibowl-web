/**
 * 打包耗材（碗）—— 跟食材一样进 ingredientStock 层，下单自动扣、只提醒不阻挡。
 *
 * 老板 2026-09-06 定的规则：
 *   · 每份主菜 1 个 1000ml 碗
 *   · 每份蒜蓉西兰花炒蛋（单点或套餐里带的）1 个 750ml 碗
 *   · 其他加料（汤、蛋、加饭…）不另用碗
 *   · 纸袋（2026-09-07）：每单至少 1 个，1 袋装 4 碗（不分大小），碗数 ÷4 向上取整
 *   · 餐具套装 叉+勺+筷（2026-09-09）：每份主菜 1 套（与 1000ml 碗同数）；三样一起用一起扣，
 *     建一个文档
 *   · 150mm 餐盒（2026-09-09）：分隔菜和饭、放进 750ml/1000ml 碗。不是每道主菜都用——
 *     老板点名的 TRAY_DISH_NAMES 每份 1 个；「西兰花炒蛋 + 蛋 + 加饭」的下饭套家族
 *     每套 1 个（单点西兰花炒蛋没饭，不用）。⚠️ 新菜上架要问老板用不用餐盒，用就加进名单
 *
 * 这个文件故意零依赖：seed-ingredient-stock.mjs 用 node strip-types 直接 import，
 * 带依赖的模块会因为无扩展名 import 解析不了。碗的「怎么数」在
 * src/lib/prepIngredients.ts `packagingLines`，这里只放主数据。
 */

export interface PackagingItem {
  name: string;
  unit: string;
}

export const BOWL_1000 = '1000ml 打包碗';
export const BOWL_750 = '750ml 打包碗';
export const PAPER_BAG = '纸袋';
export const CUTLERY_SET = '餐具套装（叉勺筷）';
export const FOOD_TRAY = '150mm 餐盒';
export const BOWLS_PER_BAG = 4;

export const PACKAGING_ITEMS: PackagingItem[] = [
  { name: BOWL_1000, unit: '个' },
  { name: BOWL_750, unit: '个' },
  { name: PAPER_BAG, unit: '个' },
  { name: CUTLERY_SET, unit: '套' },
  { name: FOOD_TRAY, unit: '个' },
];

/**
 * 用 150mm 餐盒的主菜（老板 2026-09-09 点名，按 weeklyMenu 菜名逐字匹配）。
 * dogfood-packaging.mts 会校验每个名字都还在 weeklyMenu 里，改菜名会被抓到。
 */
export const TRAY_DISH_NAMES: ReadonlySet<string> = new Set([
  '招牌原盅当归蒸鸡全腿',   // id 2
  '绍兴酒蒸花肉',           // id 4
  '山药云耳海陆双鲜炒',     // id 12
  '马铃薯炖花肉片',         // id 13
  '古早味姜葱鱼片饭',       // id 20
  '家乡豆酱焖花肉',         // id 23
  '家常日式咖喱饭',         // id 25
  '家乡甜酸洋葱猪扒',       // id 27
  '豆酱焖排骨',             // id 28
  '家乡白萝卜焖花肉',       // id 30
  '古早味卤三层肉豆腐蛋',   // id 31
]);

/** 用 750ml 碗的加料成品 label（网页 label 空间，与 addOnRecipes / COMBO_COMPONENTS 同源）。 */
export const BOWL_750_ADDON_LABEL = '蒜蓉西兰花炒蛋';
/** 套餐拆开后同时含它和西兰花炒蛋 → 这套用 1 个 150mm 餐盒（饭和蛋要分开装）。 */
export const TRAY_COMBO_RICE_LABEL = '加饭';
