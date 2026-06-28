/**
 * Raw-ingredient inventory (五花肉 / 马铃薯 / 鸡全腿 …).
 *
 * Source of truth: Firestore collection `ingredientStock`, ONE doc per
 * ingredient (doc id = the ingredient's Chinese name, IDENTICAL to the
 * `name` field in a recipe IngredientLine — see src/data/dishIngredients.ts).
 * Shape: { onHand:number, unit:string, threshold?:number, updatedAt }.
 *
 * Units follow the recipe: grams stored as g (UI auto-promotes to kg ≥1000),
 * countables as 只/颗/块/盒/份. An ingredient WITHOUT a doc is simply not
 * tracked — consume skips it.
 *
 * DEDUCTION MODEL (decided 2026-06-28):
 *   - Every web + manual order auto-decrements on-hand via the recipe.
 *   - ADVISORY ONLY: a shortage NEVER blocks an order. Hard sell-out limits
 *     live in the per-dish layer (src/lib/stockUtils.ts `dishStock`). Drift
 *     from imperfect recipes / FPX-pending / refunds is corrected by the
 *     boss's daily 盘点 (overwriting on-hand in the dashboard).
 *   - So `consumeIngredientStock` is best-effort and SWALLOWS all errors — it
 *     must never be able to fail an order.
 *
 * Ingredient need + this deduction share the SAME aggregation as the daily
 * prep list (aggregateIngredients), so what's subtracted == what's cooked.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { aggregateIngredients, type PrepOrderItem } from './prepIngredients';

export interface IngredientStockItem {
  name: string;
  onHand: number;
  unit: string;
  threshold: number | null;
  updatedAt?: number | null;
}

/**
 * Firestore doc ids can't contain "/" (it's the path separator), but some
 * ingredient names do (e.g. "PD51/60 虾"). Encode it for the doc id; the real
 * name always lives in the `name` field as the source of truth. KEEP IN SYNC
 * with scripts/seed-ingredient-stock.mjs.
 */
export function ingredientDocId(name: string): string {
  return name.replace(/\//g, '__');
}

/** Read every tracked ingredient → { [name]: IngredientStockItem } (keyed by the real name field). */
export async function getAllIngredientStock(db: Firestore): Promise<Record<string, IngredientStockItem>> {
  const snap = await db.collection('ingredientStock').get();
  const out: Record<string, IngredientStockItem> = {};
  for (const d of snap.docs) {
    const x = d.data() || {};
    const name = typeof x.name === 'string' && x.name ? x.name : d.id;
    out[name] = {
      name,
      onHand: Number(x.onHand) || 0,
      unit: typeof x.unit === 'string' ? x.unit : '',
      threshold: typeof x.threshold === 'number' ? x.threshold : null,
      updatedAt: x.updatedAt?.toMillis?.() ?? null,
    };
  }
  return out;
}

/** Set on-hand (盘点) — and optionally unit/threshold — for one ingredient. */
export async function setIngredientStock(
  db: Firestore,
  name: string,
  onHand: number,
  opts?: { unit?: string; threshold?: number | null },
): Promise<void> {
  const payload: Record<string, unknown> = { name, onHand, updatedAt: FieldValue.serverTimestamp() };
  if (opts?.unit) payload.unit = opts.unit;
  if (opts && 'threshold' in opts) {
    payload.threshold = opts.threshold == null ? FieldValue.delete() : opts.threshold;
  }
  await db.collection('ingredientStock').doc(ingredientDocId(name)).set(payload, { merge: true });
}

/**
 * Best-effort decrement of on-hand for every ingredient an order consumes.
 * Reuses the prep aggregation (handles "↳ "-prefixed add-on rows + nested
 * addOns + the manual-label aliases) so it stays byte-identical to the cook
 * list. Only ingredients that already have a doc are touched. NEVER throws —
 * a failure here must not break checkout.
 */
export async function consumeIngredientStock(db: Firestore, items: PrepOrderItem[]): Promise<void> {
  try {
    const { lines } = aggregateIngredients([{ items }]);
    if (!lines.length) return;

    // Merge by name (doc id is name only) so a batch never writes the same doc
    // twice — Firestore rejects duplicate writes in one batch.
    const byName = new Map<string, number>();
    for (const l of lines) byName.set(l.name, (byName.get(l.name) || 0) + l.qty);

    const names = [...byName.keys()];
    const refs = names.map(n => db.collection('ingredientStock').doc(ingredientDocId(n)));
    const snaps = await db.getAll(...refs);

    const batch = db.batch();
    let touched = 0;
    snaps.forEach((snap, i) => {
      if (!snap.exists) return; // untracked ingredient — skip
      batch.update(refs[i], {
        onHand: FieldValue.increment(-(byName.get(names[i]) || 0)),
        updatedAt: FieldValue.serverTimestamp(),
      });
      touched++;
    });
    if (touched) await batch.commit();
  } catch (err) {
    // Advisory layer — log and move on; ordering must never fail on this.
    console.error('[consumeIngredientStock] best-effort decrement failed:', err);
  }
}
