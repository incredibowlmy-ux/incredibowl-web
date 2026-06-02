/**
 * Shared daily-prep ingredient aggregation.
 *
 * Single source of truth for turning a day's orders into a procurement-ready
 * ingredient roll-up ("鸡全腿 ×5；糙米 540g"). Used by BOTH:
 *   - /api/n8n/daily-prep      (cron → Telegram brief for BowlMama)
 *   - /api/admin/daily-prep    (dashboard "打印备餐单" ingredient section)
 *
 * Recipe data itself lives in src/data/dishIngredients.ts — edit there to
 * add/adjust a dish's ingredients; both consumers pick it up automatically.
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

// Web cart stores add-ons as flat rows prefixed with "↳ "; manual orders nest
// them in items[i].addOns. Both feed the same ingredient buckets.
const isAddOnItem = (name: string) => /^↳/.test(name);
const stripAddOnPrefix = (name: string) => name.replace(/^↳\s*/, '');

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
 * Aggregate raw ingredient quantities across the given orders.
 *
 * Resilient to missing recipes: dishes/add-ons without an entry in
 * dishIngredients.ts are silently skipped (they still count in the dish
 * summary, just absent from this roll-up). Groups by (name, unit); weight
 * units auto-promote to kg / L over 1000 for faster reading on a phone.
 */
export function aggregateIngredients(orders: PrepOrder[]): {
  lines: { name: string; qty: number; unit: string }[];
  text: string;
} {
  const counts = new Map<string, { name: string; qty: number; unit: string }>();
  const bump = (line: IngredientLine, multiplier: number) => {
    const key = `${line.name} ${line.unit}`;
    const cur = counts.get(key);
    if (cur) cur.qty += line.qty * multiplier;
    else counts.set(key, { name: line.name, qty: line.qty * multiplier, unit: line.unit });
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

  const formatQty = (qty: number, unit: string): string => {
    if (unit === 'g' && qty >= 1000) return `${(qty / 1000).toFixed(qty % 1000 === 0 ? 0 : 2)}kg`;
    if (unit === 'ml' && qty >= 1000) return `${(qty / 1000).toFixed(qty % 1000 === 0 ? 0 : 2)}L`;
    const rounded = Number(qty.toFixed(2));
    const str = Number.isInteger(rounded) ? String(rounded) : rounded.toString();
    return `${str}${unit}`;
  };

  const lines = Array.from(counts.values()).sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  const text = lines.length === 0 ? '无' : lines.map(l => `${l.name} ${formatQty(l.qty, l.unit)}`).join('；');
  return { lines, text };
}
