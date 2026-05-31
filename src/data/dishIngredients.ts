/**
 * Dish → ingredient mapping table for daily prep ingredient aggregation.
 *
 * Used by /api/n8n/daily-prep to turn the order list ("希腊柠香烤鸡胸 ×5") into
 * a procurement-ready ingredient summary ("鸡胸肉 1.2kg；鸡蛋(生) 7颗；糙米 540g")
 * so BowlMama gets a shop-this-list instead of a math problem.
 *
 * Conventions:
 *   - Match `name` exactly to MenuItem.name in src/data/weeklyMenu.ts and the
 *     add-on label in src/components/menu/AddOnModal.tsx — the aggregator
 *     looks dishes up by display name (not id), because the order schema
 *     stores display names not IDs.
 *   - One IngredientLine = one ingredient × per-serving qty (raw / procurement
 *     weight, not cooked). Quantity is per ONE serving of the dish.
 *   - Mix units freely (g / ml / 颗 / 只 / 块 / 包 / 盒 / 把 / 份). The
 *     aggregator groups by (name, unit) so "鸡胸肉 g" and "鸡胸肉 块" stay
 *     separate — pick the unit BowlMama actually uses at procurement time.
 *   - Skip pantry staples (盐 / 胡椒 / 食用油 / 大蒜) — they're always there,
 *     listing them just adds noise. Soy sauce listed when it's portion-
 *     controlled per dish.
 *   - Add-ons use the LABEL shown in the cart (e.g. "白饭换糙米 (180g)") not
 *     the internal addOn ID, because the order schema's items[] stores
 *     label-format rows ("↳ <label>"). For manual orders (local dashboard)
 *     a shorter label is used (e.g. "换糙米"), so each add-on appears under
 *     BOTH keys in addOnRecipes.
 *
 * To add/edit a recipe: just edit this file. No migration, no schema change.
 * Empty `ingredients: []` means "data not yet provided" — the aggregator
 * will silently skip it (dish still counts in dish summary, just absent
 * from ingredient roll-up).
 */

export interface IngredientLine {
  /** Procurement / kitchen-facing ingredient name, e.g. "鸡胸肉", "鸡全腿", "糙米", "蛋" */
  name: string;
  /** Per-serving raw quantity */
  qty: number;
  /** Match the unit BowlMama uses at market (g / ml / 颗 / 只 / 块 / 包 / 盒 / 把 / 份) */
  unit: string;
}

export interface DishRecipe {
  /** Exact match to MenuItem.name in weeklyMenu.ts */
  name: string;
  /**
   * 2-character display name used in the daily-prep order matrix
   * (Telegram <pre> grid). Keeping it 2 CJK chars = 4 visual cells
   * keeps the matrix narrow enough to fit on mobile without horizontal
   * scrolling. Optional — falls back to the first 2 chars of `name`.
   */
  shortName?: string;
  ingredients: IngredientLine[];
}

/**
 * Per-dish raw-ingredient breakdown (per ONE serving).
 * Filled from BowlMama's portion data on 2026-05-25.
 */
export const dishRecipes: DishRecipe[] = [
  {
    name: '纳豆月见海苔饭',
    shortName: '纳豆',
    ingredients: [
      { name: '纳豆', qty: 1, unit: '盒' },
      { name: '温泉蛋', qty: 2, unit: '颗' },
      { name: '海苔', qty: 3, unit: 'g' },
      { name: '白饭', qty: 80, unit: 'g' },
      { name: '酱油', qty: 20, unit: 'ml' },
    ],
  },
  {
    name: '山药云耳海陆双鲜炒',
    shortName: '山药',
    ingredients: [
      { name: '山药', qty: 100, unit: 'g' },
      { name: '云耳', qty: 4, unit: 'g' },
      { name: '虾', qty: 4, unit: '只' },
      { name: '鸡胸肉', qty: 65, unit: 'g' },
      { name: '白饭', qty: 80, unit: 'g' },
      { name: '荷包蛋', qty: 1, unit: '颗' },
      { name: '葱', qty: 1, unit: 'g' },
    ],
  },
  {
    name: '阿嫲古早味酱油鸡全腿',
    shortName: '酱鸡',
    ingredients: [
      { name: '鸡全腿', qty: 1, unit: '只' },
      { name: '白饭', qty: 80, unit: 'g' },
      { name: '时蔬', qty: 1, unit: '份' },
    ],
  },
  {
    name: '香煎金黄鸡扒饭',
    shortName: '鸡扒',
    ingredients: [
      { name: '鸡扒', qty: 1, unit: '块' },
      { name: '白饭', qty: 80, unit: 'g' },
      { name: '毛豆', qty: 40, unit: 'g' },
      { name: '玉米粒', qty: 40, unit: 'g' },
      { name: '时蔬', qty: 50, unit: 'g' },
    ],
  },
  {
    name: '招牌原盅当归蒸鸡全腿',
    shortName: '归鸡',
    ingredients: [
      { name: '鸡全腿', qty: 1, unit: '只' },
      { name: '当归', qty: 3, unit: 'g' },
      { name: '白饭', qty: 80, unit: 'g' },
      { name: '时蔬', qty: 50, unit: 'g' },
    ],
  },
  {
    name: '希腊柠香烤鸡胸',
    shortName: '希胸',
    ingredients: [
      { name: '鸡胸肉', qty: 200, unit: 'g' },
      // TODO_CONFIRM: 柠檬 user wrote "1/5g" — interpreted as 5g.
      // If meant 15g (typo) or 1/5 颗, update here.
      { name: '柠檬', qty: 5, unit: 'g' },
      { name: '马铃薯', qty: 100, unit: 'g' },
      { name: '椰菜花', qty: 100, unit: 'g' },
      { name: '黑橄榄', qty: 10, unit: 'g' },
      { name: '白饭', qty: 80, unit: 'g' },
    ],
  },
  {
    name: '马铃薯炖花肉片',
    shortName: '花肉',
    ingredients: [
      { name: '五花肉', qty: 125, unit: 'g' },
      { name: '马铃薯', qty: 100, unit: 'g' },
      { name: '白饭', qty: 80, unit: 'g' },
      { name: '黄洋葱', qty: 80, unit: 'g' },
      { name: '葱', qty: 2, unit: 'g' },
    ],
  },
  {
    name: '绍兴酒蒸花肉',
    shortName: '绍肉',
    // 仅列生鲜采购项（与本表惯例一致）。完整配方另含绍兴酒/麻油/鱼露/蚝油/糖/
    // 白胡椒等瓶装常备调味品，按惯例不计入每日采购汇总。
    // 五花肉用「顶级无皮五花肉」独立 SKU（与马铃薯那道的「五花肉」分开采购）。
    // 白饭存 80g 生米采购重（碗妈表给的 180g 是熟饭，约合 80g 生米，对齐其他菜）。
    ingredients: [
      { name: '顶级无皮五花肉', qty: 90, unit: 'g' },
      { name: '西兰花', qty: 50, unit: 'g' },
      { name: '白饭', qty: 80, unit: 'g' },
      { name: '姜', qty: 10, unit: 'g' },
      { name: '葱', qty: 5, unit: 'g' },
    ],
  },
  {
    name: '金黄葱香煎鸡汤',
    shortName: '葱汤',
    ingredients: [
      { name: '鸡扒', qty: 1, unit: '块' },
      { name: '白饭', qty: 80, unit: 'g' },
      { name: '荷包蛋', qty: 1, unit: '颗' },
      { name: '葱', qty: 40, unit: 'g' },
      { name: '时蔬', qty: 50, unit: 'g' },
    ],
  },
];

/**
 * Add-on label → ingredient delta. Keyed by BOTH the full AddOnModal name
 * (e.g. "白饭换糙米 (180g)" — used by web cart) and the short manual-order
 * label (e.g. "换糙米" — used by local dashboard), so the aggregator picks
 * up add-ons regardless of order channel.
 *
 * Swap-style add-ons (换糙米, 少饭) intentionally only ADD their own
 * ingredient — they do NOT subtract the base 白饭, because BowlMama plans
 * her base rice batch separately and treats the swap column as
 * "additionally prep this for the swap customers".
 */
export const addOnRecipes: Record<string, IngredientLine[]> = {
  // ─── Rice swaps ────────────────────────────────────────────
  '白饭换糙米 (180g)': [{ name: '糙米', qty: 90, unit: 'g' }],
  '换糙米': [{ name: '糙米', qty: 90, unit: 'g' }],
  '加饭 (150g)': [{ name: '白饭', qty: 150, unit: 'g' }],
  '加饭': [{ name: '白饭', qty: 150, unit: 'g' }],
  // 少饭 / less-rice intentionally absent — it's a subtraction, not addition

  // ─── Egg add-ons ───────────────────────────────────────────
  // 三种蛋分桶（备餐时知道要做几个荷包/温泉/拌饭用生蛋）：
  //   荷包蛋 = sunny-side-up，单独煎好放上桌
  //   温泉蛋 = onsen 低温慢煮，单独做好放上桌
  //   鸡蛋(生) = 打散用于炒（蒜蓉西兰花炒蛋 add-on）
  '荷包蛋': [{ name: '荷包蛋', qty: 1, unit: '颗' }],
  '温泉蛋': [{ name: '温泉蛋', qty: 1, unit: '颗' }],

  // ─── Broccoli egg side ────────────────────────────────────
  '蒜蓉西兰花炒蛋': [
    { name: '西兰花', qty: 200, unit: 'g' },
    { name: '鸡蛋(生)', qty: 3, unit: '颗' },
  ],

  // ─── Generic sides (40g format) ───────────────────────────
  '清甜水煮毛豆仁 (40g)': [{ name: '毛豆', qty: 40, unit: 'g' }],
  '金黄甜玉米 (40g)': [{ name: '玉米', qty: 40, unit: 'g' }],
  '爽脆多汁小番茄 (40g)': [{ name: '樱桃番茄', qty: 40, unit: 'g' }],

  // ─── Natto menu add-ons ────────────────────────────────────
  '健康发酵纳豆': [{ name: '纳豆', qty: 1, unit: '盒' }],
  '海苔': [{ name: '海苔', qty: 3, unit: 'g' }],
  '秘制日本酱油': [{ name: '酱油', qty: 20, unit: 'ml' }],

  // ─── Surf & Turf add-ons ───────────────────────────────────
  '鲜甜大虾仁 (4只)': [{ name: '虾', qty: 4, unit: '只' }],
  '嫩炒鸡丁 (50g)': [{ name: '鸡胸肉', qty: 65, unit: 'g' }],
  '脆爽云耳 (20g)': [{ name: '云耳', qty: 20, unit: 'g' }],
  '鲜脆山药块 (90g)': [{ name: '山药', qty: 90, unit: 'g' }],

  // ─── Chicken Chop add-on ───────────────────────────────────
  '加香煎金鸡扒 (150g)': [{ name: '鸡扒', qty: 1, unit: '块' }],

  // ─── Greek Lemon Chicken add-ons ──────────────────────────
  '【增肌极客】加柠香烤鸡胸 (180g)': [{ name: '鸡胸肉', qty: 200, unit: 'g' }],
  '【优质碳水】加马铃薯 (90g)': [{ name: '马铃薯', qty: 100, unit: 'g' }],
  '【抗氧高纤】加脆甜椰菜花 (80g)': [{ name: '椰菜花', qty: 100, unit: 'g' }],
  '【地中海风味】加提鲜黑橄榄 (12g)': [{ name: '黑橄榄', qty: 12, unit: 'g' }],

  // ─── Chicken Leg specials (Tuesday / Wednesday) ────────────
  '【犒劳自己】多加一只暖胃全鸡腿': [{ name: '鸡全腿', qty: 1, unit: '只' }],
  '【犒劳自己】多加一只酱油全鸡腿': [{ name: '鸡全腿', qty: 1, unit: '只' }],

  // ─── Scallion Chicken Soup add-on ─────────────────────────
  '【收工犒劳】多加一只葱香煎鸡扒': [{ name: '鸡扒', qty: 1, unit: '块' }],

  // ─── Pork Belly Stew add-ons ──────────────────────────────
  '【绵密软糯】加马铃薯 (90g)': [{ name: '马铃薯', qty: 100, unit: 'g' }],
  '【浓香入味】加花肉片 (70g)': [{ name: '五花肉', qty: 125, unit: 'g' }],

  // ─── TODO_RECIPE (data not provided yet) ───────────────────
  // '马铃薯煎蛋' (potato-egg / potato-egg-alacarte)
  // Combo add-ons (super-combo / nostalgia-combo / protein-bomb-combo / etc.):
  //   if BowlMama wants ingredient breakdown for these, list each combo's
  //   contents below — but they're rare enough that skipping is fine.
};

// ─── Lookup helpers ──────────────────────────────

const recipeByName = new Map<string, DishRecipe>(
  dishRecipes.map(r => [r.name, r]),
);

export function getRecipeForDish(dishName: string): DishRecipe | undefined {
  return recipeByName.get(dishName);
}

export function getAddOnRecipe(label: string): IngredientLine[] | undefined {
  return addOnRecipes[label];
}

/**
 * Look up the 2-char display name for the daily-prep order matrix.
 * Falls back to the first 2 chars of the full name if no shortName
 * configured — so a new dish added to weeklyMenu.ts before its recipe
 * lands here still renders in the grid (just less prettily).
 */
export function getDishShortName(dishName: string): string {
  const recipe = recipeByName.get(dishName);
  if (recipe?.shortName) return recipe.shortName;
  // Best-effort fallback: first 2 CJK chars
  const chars = Array.from(dishName);
  return chars.slice(0, 2).join('') || dishName;
}
