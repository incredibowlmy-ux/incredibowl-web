/**
 * 打包耗材（碗）—— 跟食材一样进 ingredientStock 层，下单自动扣、只提醒不阻挡。
 *
 * 老板 2026-09-06 定的规则：
 *   · 每份主菜 1 个 1000ml 碗
 *   · 每份蒜蓉西兰花炒蛋（单点或套餐里带的）1 个 750ml 碗
 *   · 其他加料（汤、蛋、加饭…）不另用碗
 *   · 纸袋（2026-09-07）：每单至少 1 个，1 袋装 4 碗（不分大小），碗数 ÷4 向上取整
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
export const BOWLS_PER_BAG = 4;

export const PACKAGING_ITEMS: PackagingItem[] = [
  { name: BOWL_1000, unit: '个' },
  { name: BOWL_750, unit: '个' },
  { name: PAPER_BAG, unit: '个' },
];

/** 用 750ml 碗的加料成品 label（网页 label 空间，与 addOnRecipes / COMBO_COMPONENTS 同源）。 */
export const BOWL_750_ADDON_LABEL = '蒜蓉西兰花炒蛋';
