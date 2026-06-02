/**
 * Shared daily-prep ingredient aggregation.
 *
 * Single source of truth for turning a day's orders into a procurement / cook
 * list. Used by:
 *   - /api/n8n/daily-prep   (cron → Telegram brief)  — flat list via aggregateIngredients()
 *   - /api/admin/daily-prep (dashboard 打印备餐单)     — per-dish + cook-once via buildDailyPrepIngredients()
 *
 * Recipe data lives in src/data/dishIngredients.ts — edit there to add/adjust a
 * dish's ingredients; both consumers pick it up automatically.
 */
import { getRecipeForDish, getAddOnRecipe, IngredientLine } from '@/data/dishIngredients';

export interface PrepOrderItemAddOn {
  id?: string;
  label?: string;
  name?: string;
  price?: number;
  quantity?: number;
}
export interface PrepOrderItem {
  name: string;
  quantity: number;
  note?: string;
  addOns?: PrepOrderItemAddOn[];
}
export interface PrepOrder {
  deliveryTime?: string;
  mealType?: 'lunch' | 'dinner' | null;
  items?: PrepOrderItem[];
  status?: string;
}

type Line = { name: string; qty: number; unit: string };

// Dishes the boss batch-cooks ONCE per day. Their whole-day (lunch + dinner)
// ingredient need is rolled into the LUNCH prep list and omitted from dinner,
// so the cook list matches "make one pot in the morning". Plating counts
// (备餐汇总) are unaffected — those still show per-meal portions.
// Add dishes here as the boss confirms which are cook-once.
export const COOK_ONCE_DISHES = new Set<string>(['马铃薯炖花肉片']);

// Web cart stores add-ons as flat rows prefixed with "↳ "; manual orders nest
// them in items[i].addOns. Both feed the same ingredient buckets.
const isAddOnItem = (name: string) => /^↳/.test(name);
const stripAddOnPrefix = (name: string) => name.replace(/^↳\s*/, '');

// Weight units auto-promote to kg / L over 1000 so the magnitude reads faster.
function formatQty(qty: number, unit: string): string {
  if (unit === 'g' && qty >= 1000) return `${(qty / 1000).toFixed(qty % 1000 === 0 ? 0 : 2)}kg`;
  if (unit === 'ml' && qty >= 1000) return `${(qty / 1000).toFixed(qty % 1000 === 0 ? 0 : 2)}L`;
  const rounded = Number(qty.toFixed(2));
  const str = Number.isInteger(rounded) ? String(rounded) : rounded.toString();
  return `${str}${unit}`;
}
function formatLines(lines: Line[]): string {
  return lines.length ? lines.map(l => `${l.name} ${formatQty(l.qty, l.unit)}`).join(' · ') : '—';
}

// Classify a delivery time as lunch vs dinner.
//   1. explicit mealType field (manual orders) wins
//   2. "dinner"/"晚" → dinner, "lunch"/"午" → lunch
//   3. HH:MM with hour >= 17 → dinner
//   4. anything else → lunch (default for ambiguous / empty)
// KEEP IN SYNC with mealType() in the dashboard + splitMealTime() in admin/page.tsx.
export function isLunchOrder(o: { deliveryTime?: string; mealType?: 'lunch' | 'dinner' | null }): boolean {
  if (o.mealType === 'lunch') return true;
  if (o.mealType === 'dinner') return false;
  const t = (o.deliveryTime || '').toLowerCase();
  if (t.includes('dinner') || t.includes('晚')) return false;
  if (t.includes('lunch') || t.includes('午')) return true;
  const m = t.match(/(\d{1,2}):\d{2}/);
  if (m && parseInt(m[1], 10) >= 17) return false;
  return true;
}

/**
 * Flat all-ingredients roll-up (legacy, used by the n8n Telegram brief).
 * Merges every ingredient across all dishes + add-ons into one list.
 */
export function aggregateIngredients(orders: PrepOrder[]): { lines: Line[]; text: string } {
  const counts = new Map<string, Line>();
  const bump = (line: IngredientLine, mult: number) => {
    const key = `${line.name} ${line.unit}`;
    const cur = counts.get(key);
    if (cur) cur.qty += line.qty * mult;
    else counts.set(key, { name: line.name, qty: line.qty * mult, unit: line.unit });
  };
  for (const o of orders) {
    for (const it of o.items || []) {
      const qty = it.quantity || 0;
      if (qty <= 0) continue;
      if (isAddOnItem(it.name)) {
        const recipe = getAddOnRecipe(stripAddOnPrefix(it.name));
        if (recipe) recipe.forEach(line => bump(line, qty));
      } else {
        const dishRecipe = getRecipeForDish(it.name);
        if (dishRecipe) dishRecipe.ingredients.forEach(line => bump(line, qty));
        for (const a of it.addOns || []) {
          const label = a.label || a.name || a.id || '';
          const aQty = a.quantity || 0;
          if (!label || aQty <= 0) continue;
          const addOnRecipe = getAddOnRecipe(label);
          if (addOnRecipe) addOnRecipe.forEach(line => bump(line, aQty));
        }
      }
    }
  }
  const lines = Array.from(counts.values()).sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  return { lines, text: lines.length === 0 ? '无' : lines.map(l => `${l.name} ${formatQty(l.qty, l.unit)}`).join('；') };
}

// ─── Per-dish view (dashboard 打印备餐单) ──────────────────────────────

// Aggregate ingredients grouped PER MAIN DISH, with add-ons collapsed into one
// combined bucket. Same ingredient across two dishes (e.g. 马铃薯 in 炖肉 vs
// 烤鸡胸) stays separate — each dish carries its own line.
function aggregateByDish(orders: PrepOrder[]): {
  mains: Map<string, { servings: number; lines: Map<string, Line> }>;
  addOns: Map<string, Line>;
} {
  const mains = new Map<string, { servings: number; lines: Map<string, Line> }>();
  const addOns = new Map<string, Line>();
  const bumpInto = (map: Map<string, Line>, line: IngredientLine, mult: number) => {
    const key = `${line.name} ${line.unit}`;
    const cur = map.get(key);
    if (cur) cur.qty += line.qty * mult;
    else map.set(key, { name: line.name, qty: line.qty * mult, unit: line.unit });
  };
  for (const o of orders) {
    for (const it of o.items || []) {
      const qty = it.quantity || 0;
      if (qty <= 0) continue;
      if (isAddOnItem(it.name)) {
        const r = getAddOnRecipe(stripAddOnPrefix(it.name));
        if (r) r.forEach(l => bumpInto(addOns, l, qty));
      } else {
        const recipe = getRecipeForDish(it.name);
        if (recipe) {
          let g = mains.get(it.name);
          if (!g) { g = { servings: 0, lines: new Map() }; mains.set(it.name, g); }
          g.servings += qty;
          recipe.ingredients.forEach(l => bumpInto(g.lines, l, qty));
        }
        for (const a of it.addOns || []) {
          const label = a.label || a.name || a.id || '';
          const aQty = a.quantity || 0;
          if (!label || aQty <= 0) continue;
          const ar = getAddOnRecipe(label);
          if (ar) ar.forEach(l => bumpInto(addOns, l, aQty));
        }
      }
    }
  }
  return { mains, addOns };
}

export interface DishIngredientGroup {
  dish: string;
  servings: number;
  allDay: boolean;   // true when a cook-once dish rolled into lunch
  text: string;      // "鸡胸肉 1.2kg · 马铃薯 600g · ..."
}
export interface MealIngredients {
  groups: DishIngredientGroup[];
  addOnText: string;
}

/**
 * Build per-dish ingredient lists for lunch + dinner, applying the cook-once
 * rule: COOK_ONCE_DISHES' dinner ingredients merge into lunch and drop from
 * dinner. Order counts are NOT moved — only the ingredient roll-up.
 */
export function buildDailyPrepIngredients(lunchOrders: PrepOrder[], dinnerOrders: PrepOrder[]): {
  lunch: MealIngredients;
  dinner: MealIngredients;
} {
  const L = aggregateByDish(lunchOrders);
  const D = aggregateByDish(dinnerOrders);

  for (const dish of COOK_ONCE_DISHES) {
    const dg = D.mains.get(dish);
    if (!dg) continue;
    let lg = L.mains.get(dish);
    if (!lg) { lg = { servings: 0, lines: new Map() }; L.mains.set(dish, lg); }
    lg.servings += dg.servings;
    dg.lines.forEach((line, key) => {
      const cur = lg!.lines.get(key);
      if (cur) cur.qty += line.qty;
      else lg!.lines.set(key, { ...line });
    });
    D.mains.delete(dish);
  }

  const toGroups = (m: Map<string, { servings: number; lines: Map<string, Line> }>): DishIngredientGroup[] =>
    [...m.entries()]
      .sort((a, b) => b[1].servings - a[1].servings)
      .map(([dish, g]) => ({
        dish,
        servings: g.servings,
        allDay: COOK_ONCE_DISHES.has(dish),
        text: formatLines([...g.lines.values()]),
      }));

  return {
    lunch: { groups: toGroups(L.mains), addOnText: formatLines([...L.addOns.values()]) },
    dinner: { groups: toGroups(D.mains), addOnText: formatLines([...D.addOns.values()]) },
  };
}
