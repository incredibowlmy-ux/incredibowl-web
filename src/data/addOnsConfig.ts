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
  'onsen-egg': 3.50,
  'chia-pudding': 6.90,

  // ─── Premium tea ───────────────────────────
  'longjing-ice': 3.80,
  'longjing-warm': 3.80,
  'tieguanyin-ice': 3.80,
  'tieguanyin-warm': 3.80,
  'shuixian-ice': 3.80,
  'shuixian-warm': 3.80,

  // ─── Natto Rice (id:6) specials ────────────
  'natto-super-combo': 5.00,
  'natto-side': 4.90,
  'onsen-egg-side': 2.50,
  'nori': 2.00,
  'soy-sauce': 1.50,

  // ─── Chicken Chop (id:1) specials ──────────
  'extra-chicken-chop': 9.90,
  'chicken-chop-nostalgia-combo': 12.40,
  'edamame': 2.00,
  'corn': 2.00,
  'cherry-tomato': 2.50,

  // ─── A la carte variants (natto menu) ──────
  'sunny-egg-alacarte': 2.50,
  'potato-egg-alacarte': 3.50,

  // ─── Surf & Turf (id:12) specials ──────────
  'surf-turf-super-combo': 11.40,
  'extra-prawns': 7.00,
  'extra-chicken-breast': 4.50,
  'extra-fungus': 2.50,
  'extra-yam': 4.00,

  // ─── Angelica Chicken (id:13) specials ─────
  'extra-herbal-leg-1': 11.90,
  'extra-herbal-leg-2': 21.90,
  'extra-herbal-leg-3': 31.40,

  // ─── Greek Lemon Chicken (id:3) specials ───
  'greek-protein-bomb-combo': 15.90,
  'extra-greek-chicken-180g': 11.90,
  'extra-aus-potato-80g': 3.50,
  'extra-cauliflower-80g': 3.00,
  'extra-black-olive-12g': 1.50,

  // ─── Scallion Chicken Soup (id:5) specials ──
  'scallion-soup-combo': 12.40,
  'extra-scallion-chop-side': 9.90,

  // ─── Potato Pork Belly Stew (id:4) specials ──
  'pork-potato-duo-combo': 11.40,
  'extra-potato': 3.50,
  'extra-pork-belly': 9.90,
};

/**
 * Look up the server-authoritative price for an add-on.
 * Returns undefined if the add-on ID is unknown.
 */
export function getAddOnPrice(addOnId: string): number | undefined {
  return ADD_ON_PRICES[addOnId];
}
