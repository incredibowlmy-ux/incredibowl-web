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
import {
  getRecipeForDish, getAddOnRecipe, resolveAddOnAlias, UNTRACKED_OK,
  NEW_CUSTOMER_GIFT_RECIPE, NEW_CUSTOMER_GIFT_SOURCE, expandComboLabel,
} from '@/data/dishIngredients';
import type { IngredientLine } from '@/data/dishIngredients';

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
  /**
   * 新客首单 → 这一单多备一份赠品（马铃薯煎蛋B）。
   *
   * ⚠️ 这是**备餐层派生**的标记，Firestore 的订单文档里没有这个字段 —— 调用方
   * 自己用 lib/newCustomerGift.loadNewCustomerFirstOrderIds() 算出来后打上。
   * 客人端一无所知（订单 items 没变），加料统计 / 库存扣减 / 营收也不受影响。
   * 注意 consumeIngredientStock 走的是 `{ items }`（不带这个标记），所以下单
   * 时不会自动扣赠品那份料 —— 靠老板每天盘点覆盖，与其它 best-effort 口径一致。
   */
  isNewCustomer?: boolean;
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
    // 新客赠品：一位新客一份，与他点了几碗无关。
    if (o.isNewCustomer) NEW_CUSTOMER_GIFT_RECIPE.forEach(line => bump(line, 1));
  }
  const lines = Array.from(counts.values()).sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  return { lines, text: lines.length === 0 ? '无' : lines.map(l => `${l.name} ${formatQty(l.qty, l.unit)}`).join('；') };
}

/**
 * Items in the orders that resolve to NO recipe (missing, or present but with
 * empty ingredients = "data not provided") — these silently contribute ZERO to
 * prep/stock aggregation, so surface them instead of hiding the gap.
 * Deliberately-untracked items (drinks, 少饭 — see UNTRACKED_OK) are skipped.
 * Returns [{ label, count }] sorted by count desc.
 */
export function collectUnrecipedLabels(orders: PrepOrder[]): { label: string; count: number }[] {
  const misses = new Map<string, number>();
  const bump = (label: string, qty: number) => {
    if (UNTRACKED_OK.has(label)) return;
    misses.set(label, (misses.get(label) || 0) + qty);
  };
  for (const o of orders) {
    for (const it of o.items || []) {
      const qty = it.quantity || 0;
      if (qty <= 0) continue;
      if (isAddOnItem(it.name)) {
        const label = stripAddOnPrefix(it.name);
        if (!getAddOnRecipe(label)) bump(label, qty);
      } else {
        const recipe = getRecipeForDish(it.name);
        if (!recipe || recipe.ingredients.length === 0) bump(it.name, qty);
        for (const a of it.addOns || []) {
          const label = a.label || a.name || a.id || '';
          const aQty = a.quantity || 0;
          if (!label || aQty <= 0) continue;
          if (!getAddOnRecipe(label)) bump(label, aQty);
        }
      }
    }
  }
  return [...misses.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

// ─── Per-dish view (dashboard 打印备餐单) ──────────────────────────────

// Universal staple — cooked as one rice batch, not per dish. Pulled out of every
// dish's line and shown as a single per-meal 白饭 total (NOT moved by cook-once,
// since rice is cooked fresh each meal even for cook-once dishes' plates).
const UNIVERSAL_STAPLE = '白饭';

// Source tag for the add-on ingredient bucket: FIRST resolve the manual-order
// short label to its web-cart twin (else the same add-on splits into two lines,
// e.g. "糙米 180g（换糙米）· 糙米 90g（白饭换糙米）"), THEN strip the marketing
// 【...】 prefix and (Xg) suffix so it reads short: "【增肌极客】加柠香烤鸡胸
// (180g)" → "加柠香烤鸡胸".
const cleanAddOnLabel = (s: string) => {
  const canonical = resolveAddOnAlias(s);
  return canonical.replace(/^【[^】]*】/, '').replace(/\s*\([^)]*\)\s*$/, '').trim() || canonical;
};

// 加料桶按「成品」聚合（老板 2026-08-18）：一个 unit = 厨房实际要做的一样东西
//（荷包蛋 / 蒜蓉西兰花炒蛋 / 加饭）。套餐**先拆成组成项再入桶**，所以套餐里的荷包蛋
// 和独立点的荷包蛋并成一行。备餐要回答的是「总共做几份什么」，不是「哪份来自哪个
// 套餐」—— 套餐名在食材清单的套餐展开行和装碗分组里另有交代。
interface AddOnUnitAgg { label: string; servings: number; lines: Map<string, Line> }

// Aggregate ingredients grouped PER MAIN DISH. Same ingredient across two dishes
// (马铃薯 in 炖肉 vs 烤鸡胸) stays separate — each dish carries its own line.
// 白饭 is pulled into a per-meal `rice` total. Add-ons group per finished unit
// (see AddOnUnitAgg) so each stays attributable to what the kitchen actually makes.
// 糙米 is ALSO a batch-cooked staple (rice-swap add-on) — it belongs next to
// 白饭（统一煮）on the prep sheet, not buried in the add-on string (boss 2026-07-03).
const BROWN_RICE_STAPLE = '糙米';

/**
 * 一个订单里的 add-on label → 备餐实际要做的成品清单。
 * 套餐拆成组成项（家乡下饭王套 → 蒜蓉西兰花炒蛋 / 荷包蛋 / 加饭）；非套餐原样一项。
 *
 * ⚠️ 只有**每一个**组成项都查得到配方才拆 —— 缺任何一项就整套回落到套餐自己那行
 * 手写配方（来源标签仍写套餐名）。宁可显示得粗一点，也绝不能因为拆开而漏食材。
 * 退役套餐没登记组成（见 COMBO_COMPONENTS 注释），走的就是这条回落路径。
 */
function prepUnits(label: string): { label: string; recipe: IngredientLine[] }[] {
  const parts = expandComboLabel(label);
  if (parts) {
    const units: { label: string; recipe: IngredientLine[] }[] = [];
    for (const p of parts) {
      const recipe = getAddOnRecipe(p);
      if (!recipe) { units.length = 0; break; }   // 缺一个组成项就放弃拆解，整套回落
      units.push({ label: cleanAddOnLabel(p), recipe });
    }
    if (units.length) return units;
  }
  const own = getAddOnRecipe(label);
  return own ? [{ label: cleanAddOnLabel(label), recipe: own }] : [];
}

function aggregateByDish(orders: PrepOrder[]): {
  mains: Map<string, { servings: number; lines: Map<string, Line> }>;
  addOns: Map<string, AddOnUnitAgg>;
  rice: number;
  brownRice: number;
} {
  const mains = new Map<string, { servings: number; lines: Map<string, Line> }>();
  const addOns = new Map<string, AddOnUnitAgg>();
  let rice = 0;
  let brownRice = 0;
  // 一份成品入桶：份数累加，食材按份数放大；白饭/糙米抽进「统一煮」的总量，
  // 所以「加饭」这一项最后只剩份数没有食材行 —— 那正是老板要的读法。
  const addUnit = (label: string, servings: number, recipe: IngredientLine[]) => {
    // 只出主食的项（加饭 / 换糙米）：份量照常进「白饭/糙米（统一煮）」的总量，但**不在
    // 加料行露面** —— 备餐单底部的装碗分组已经按饭型逐碗列过，加饭还有独立明细小节，
    // 加料行再列一次是同一件事说两遍（老板 2026-08-18）。
    const stapleOnly = recipe.length > 0
      && recipe.every(l => l.name === UNIVERSAL_STAPLE || l.name === BROWN_RICE_STAPLE);
    let cur: AddOnUnitAgg | undefined;
    if (!stapleOnly) {
      cur = addOns.get(label);
      if (!cur) { cur = { label, servings: 0, lines: new Map() }; addOns.set(label, cur); }
      cur.servings += servings;
    }
    for (const line of recipe) {
      const qty = line.qty * servings;
      if (line.name === UNIVERSAL_STAPLE) { rice += qty; continue; }
      if (line.name === BROWN_RICE_STAPLE) { brownRice += qty; continue; }
      if (!cur) continue;   // stapleOnly 按定义不该走到这，保险
      const key = `${line.name} ${line.unit}`;
      const hit = cur.lines.get(key);
      if (hit) hit.qty += qty;
      else cur.lines.set(key, { name: line.name, qty, unit: line.unit });
    }
  };
  for (const o of orders) {
    for (const it of o.items || []) {
      const qty = it.quantity || 0;
      if (qty <= 0) continue;
      if (isAddOnItem(it.name)) {
        for (const u of prepUnits(stripAddOnPrefix(it.name))) addUnit(u.label, qty, u.recipe);
      } else {
        const recipe = getRecipeForDish(it.name);
        if (recipe) {
          let g = mains.get(it.name);
          if (!g) { g = { servings: 0, lines: new Map() }; mains.set(it.name, g); }
          g.servings += qty;
          recipe.ingredients.forEach(l => {
            if (l.name === UNIVERSAL_STAPLE) { rice += l.qty * qty; return; }
            const key = `${l.name} ${l.unit}`;
            const cur = g!.lines.get(key);
            if (cur) cur.qty += l.qty * qty;
            else g!.lines.set(key, { name: l.name, qty: l.qty * qty, unit: l.unit });
          });
        }
        for (const a of it.addOns || []) {
          const label = a.label || a.name || a.id || '';
          const aQty = a.quantity || 0;
          if (!label || aQty <= 0) continue;
          for (const u of prepUnits(label)) addUnit(u.label, aQty, u.recipe);
        }
      }
    }
    // 新客赠品挂进「加料」桶，带自己的来源标签 —— 与客人真花钱加的料分得开，
    // 备餐单上读作「新客赠送·薯煎蛋B ×1（马铃薯 37.5g · …）」。
    if (o.isNewCustomer) addUnit(NEW_CUSTOMER_GIFT_SOURCE, 1, NEW_CUSTOMER_GIFT_RECIPE);
  }
  return { mains, addOns, rice, brownRice };
}

/**
 * 加料桶 → 一行文本，按成品排（份数多的在前）：
 *   「蒜蓉西兰花炒蛋 ×3（西兰花 600g · 鸡蛋(生) 9颗）· 荷包蛋 ×5（鸡蛋(生) 5颗）· 加饭 ×2」
 * 份数回答「要做几份」，括号里的克数回答「要称多少」（老板 2026-08-18 指定两个都要）。
 * 加饭这类只出主食的项食材行为空，就只印份数。
 */
function formatAddOns(addOns: Map<string, AddOnUnitAgg>): string {
  const tokens = [...addOns.values()]
    .sort((a, b) => b.servings - a.servings || a.label.localeCompare(b.label, 'zh'))
    .map(u => {
      const lines = [...u.lines.values()];
      // 「温泉蛋 ×2（温泉蛋 2颗）」这种同名同量的括号是纯噪音，省掉；
      // 「荷包蛋 ×5（鸡蛋(生) 5颗）」成品名≠生料名，那个括号有信息量，留着。
      const echo = lines.length === 1 && lines[0].name === u.label && lines[0].qty === u.servings;
      const text = echo ? '—' : formatLines(lines);
      return `${u.label} ×${u.servings}${text === '—' ? '' : `（${text}）`}`;
    });
  return tokens.length ? tokens.join(' · ') : '—';
}

export interface DishIngredientGroup {
  dish: string;
  servings: number;
  allDay: boolean;   // true when a cook-once dish rolled into lunch
  text: string;      // "鸡胸肉 1.2kg · 马铃薯 600g · ..." (白饭 excluded)
}
export interface MealIngredients {
  groups: DishIngredientGroup[];
  riceText: string;       // total 白饭 for the meal, '' when none
  brownRiceText: string;  // total 糙米 (rice-swap staple), '' when none — shown beside 白饭
  addOnText: string;
}

/**
 * Build per-dish ingredient lists for lunch + dinner, applying the cook-once
 * rule: COOK_ONCE_DISHES' dinner dish-ingredients merge into lunch and drop
 * from dinner. Order counts and 白饭 (per-meal rice batch) are NOT moved.
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
    lunch: { groups: toGroups(L.mains), riceText: L.rice > 0 ? formatQty(L.rice, 'g') : '', brownRiceText: L.brownRice > 0 ? formatQty(L.brownRice, 'g') : '', addOnText: formatAddOns(L.addOns) },
    dinner: { groups: toGroups(D.mains), riceText: D.rice > 0 ? formatQty(D.rice, 'g') : '', brownRiceText: D.brownRice > 0 ? formatQty(D.brownRice, 'g') : '', addOnText: formatAddOns(D.addOns) },
  };
}
