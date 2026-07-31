/**
 * Centralized add-on pricing — shared between frontend (AddOnModal)
 * and server-side validation (submit-order API).
 *
 * Keys are add-on item IDs (must match the IDs used in AddOnModal).
 */

export interface AddOnPriceDef {
  id: string;
  price: number;
}

/** Flat map of every possible add-on ID → price */
export const ADD_ON_PRICES: Record<string, number> = {
  // ─── Default sides ─────────────────────────
  'sunny-egg': 2.50,
  'potato-egg': 3.50,
  'less-rice': 0.00,
  'extra-rice': 2.00,
  'brown-rice': 2.00,

  // ─── A la carte ────────────────────────────
  'onsen-egg': 3.00,

  // ─── Natto Rice (id:6) specials ────────────
  'natto-super-combo': 5.00,
  'natto-side': 7.90,  // 2026-07-16 老板调价 4.90 → 7.90
  'onsen-egg-side': 3.00,
  'nori': 2.00,
  'soy-sauce': 1.50,

  // ─── Chicken Chop (now daily, id:14) specials ──────────
  'extra-chicken-chop': 10.90,
  'chicken-chop-nostalgia-combo': 12.90,
  'edamame': 2.00,
  'corn': 2.00,
  'cherry-tomato': 2.50,
  'extra-edamame-side': 2.50,
  'extra-corn-side': 2.50,

  // ─── Default a la carte ────────────────────
  'extra-edamame': 2.50,
  'extra-corn': 2.50,
  'broccoli-egg': 10.90,
  // 新 add-on 2026-06-29：鲜虾西兰花滑蒸蛋。已进系统 + dashboard 可选；
  // 暂未加入 AddOnModal（网站购物车看不到），等上线时再加 UI。价格先登记以备校验。
  'shrimp-broccoli-steamed-egg': 6.80,

  // ─── Prepaid-only upgrades (not shown on customer menu; used by
  //     prepaid add-on credits — see PREPAID_ADDON_OPTIONS below) ──
  // 2026-07-26：三文鱼饭涨到 24.90 → voucherTopUp 5，升级券售价同步 4.00 → 5.00
  // （1 张升级券 = 覆盖 1 份 top-up 全额，售价低于 top-up 就每份漏 RM1）。
  'salmon-upgrade': 5.00,
  'wagyu-upgrade': 3.00,
  // 2026-07-27：照烧鳗鱼饭 (id 29) 开通预付升级池，voucherTopUp=5 → 售价 5.00
  'unagi-upgrade': 5.00,

  // ─── A la carte variants (natto menu) ──────
  'sunny-egg-alacarte': 2.50,
  'potato-egg-alacarte': 3.50,

  // ─── Surf & Turf (id:12) specials ──────────
  'surf-turf-super-combo': 11.40,
  'extra-prawns': 7.00,
  'extra-chicken-breast': 4.50,
  'extra-fungus': 2.50,
  'extra-yam': 4.00,

  // ─── Lemon Salmon (id:21) specials ─────────
  'extra-salmon-70g': 18.50,

  // ─── Aussie Wagyu Patty Don (id:24) specials ───
  'extra-wagyu-patty': 17.50,
  // 小番茄 + 洋葱沙拉，拌初榨橄榄油 + 少许盐（老板 2026-07-05 给价）。
  // 与 'cherry-tomato'（纯小番茄 RM2.50）是两个不同商品，别合并。
  'cherry-tomato-salad': 4.50,

  // ─── Angelica Chicken (Tuesday special, id:2) specials ─────
  'extra-herbal-leg-1': 16.50,

  // ─── Soy Sauce Chicken (now Monday special, id:1) specials ────
  'extra-soy-leg-1': 16.50,

  // ─── Greek Lemon Chicken (id:3) specials ───
  'greek-protein-bomb-combo': 15.90,
  'extra-greek-chicken-180g': 11.90,
  'extra-aus-potato-80g': 3.50,
  'extra-cauliflower-80g': 3.00,
  'extra-black-olive-12g': 1.50,

  // ─── Ginger-Scallion Fish Fillet (id:20) specials ──
  'extra-fish-120g': 13.90,

  // ─── Shaoxing Wine Steamed Pork Belly (id:4) specials ──
  'extra-shaoxing-pork-100g': 14.90,
  'extra-shaoxing-pork-50g': 7.90,   // 2026-07-16 双档策略：低门槛档
  'shaoxing-pork-combo': 15.90,      // 酒香干饭套：花肉100g+荷包蛋+加饭（原价 19.40）

  // ─── Homestyle Japanese Curry Rice (id:25) specials ──
  'extra-curry-chicken-50g': 4.50,
  'curry-trio-combo': 7.90,          // 咖喱控三件套：鸡丁50g+温泉蛋+加饭（原价 9.50）

  // ─── Hometown Taucu Braised Pork Belly (id:23) specials ──
  'extra-taucu-pork-100g': 14.90,
  'extra-taucu-pork-50g': 7.90,      // 2026-07-16 双档策略：低门槛档
  'taucu-pork-combo': 15.90,         // 阿嫲下饭王套：花肉100g+荷包蛋+加饭（原价 19.40）

  // ─── Scallion Chicken Soup (id:5) specials ──
  'scallion-soup-combo': 12.90,
  'extra-scallion-chop-side': 10.90,

  // ─── Potato Pork Belly Stew (now daily, id:13) specials ──
  'pork-potato-duo-combo': 13.40,
  'extra-potato': 3.50,
  'extra-pork-belly': 11.90,
};

/**
 * Look up the server-authoritative price for an add-on.
 * Returns undefined if the add-on ID is unknown.
 */
export function getAddOnPrice(addOnId: string): number | undefined {
  return ADD_ON_PRICES[addOnId];
}

/**
 * Whitelist of add-ons that can be PREPAID as part of a meal-voucher bundle
 * sale (e.g. "20 meals + 19 sunny eggs prepaid"). The admin dashboard's
 * prepaid-addon picker renders from this list, and the server validates every
 * prepaid addonId against it. Names here are server-authoritative — the client
 * never gets to decide the display name or price (price always comes from
 * ADD_ON_PRICES). Keep this list small and intentional.
 */
export interface PrepaidAddonOption {
  id: string;
  name: string;
}

export const PREPAID_ADDON_OPTIONS: PrepaidAddonOption[] = [
  { id: 'sunny-egg', name: '荷包蛋' },
  { id: 'onsen-egg', name: '温泉蛋' },
  { id: 'potato-egg', name: '马铃薯煎蛋' },
  { id: 'salmon-upgrade', name: '三文鱼升级' },
  { id: 'wagyu-upgrade', name: '和牛饭升级' },
  { id: 'unagi-upgrade', name: '鳗鱼饭升级' },
  { id: 'broccoli-egg', name: '蒜蓉西兰花炒蛋' },
  { id: 'shrimp-broccoli-steamed-egg', name: '鲜虾西兰花滑蒸蛋' },
  { id: 'extra-rice', name: '加饭' },
  { id: 'brown-rice', name: '白饭换糙米' },
  { id: 'extra-greek-chicken-180g', name: '加柠香烤鸡胸 (180g)' },
  { id: 'extra-salmon-70g', name: '加香煎三文鱼 (70g+)' },
  { id: 'extra-wagyu-patty', name: '加澳洲和牛饼 (1块)' },
];

/** Fast lookup: is this add-on id allowed to be prepaid? */
export function getPrepaidAddonOption(addOnId: string): PrepaidAddonOption | undefined {
  return PREPAID_ADDON_OPTIONS.find((o) => o.id === addOnId);
}
