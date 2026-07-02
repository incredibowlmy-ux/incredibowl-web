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

// ─── Movement ledger ────────────────────────────────────────────────
// Every stock change writes an entry to the `log` SUB-collection under the
// ingredient doc (ingredientStock/{docId}/log). A subcollection keeps the query
// per-ingredient with a single-field orderBy — no composite index needed.
//   receive = 进货（买货入库，+）
//   adjust  = 盘点校正（实物重数，覆盖，delta = new − old）
//   consume = 下单消耗（自动，−）
export type MovementType = 'receive' | 'adjust' | 'consume';

export interface LedgerEntry {
  type: MovementType;
  delta: number;   // signed change to on-hand
  after: number;   // on-hand after this movement
  unit: string;
  note: string | null;   // source tag / free note
  orderId: string | null;
  by: string | null;     // admin email for manual moves
  at: number | null;     // millis
}

interface LogFields {
  type: MovementType; delta: number; after: number; unit: string;
  note?: string | null; orderId?: string | null; by?: string | null;
}
// Write one ledger entry via a transaction/batch writer (tx.set / batch.set).
function writeLog(
  writer: { set: (ref: FirebaseFirestore.DocumentReference, data: Record<string, unknown>) => unknown },
  ingredientRef: FirebaseFirestore.DocumentReference,
  e: LogFields,
): void {
  writer.set(ingredientRef.collection('log').doc(), {
    type: e.type, delta: e.delta, after: e.after, unit: e.unit || '',
    note: e.note ?? null, orderId: e.orderId ?? null, by: e.by ?? null,
    at: FieldValue.serverTimestamp(),
  });
}

/**
 * 进货 (receive): ADD `delta` to on-hand — never overwrites, so it can't wipe
 * the running count or already-consumed accounting. Logs a `receive` movement.
 * Returns the new on-hand.
 */
export async function addIngredientStock(
  db: Firestore,
  name: string,
  delta: number,
  opts?: { unit?: string; note?: string; by?: string },
): Promise<number> {
  const ref = db.collection('ingredientStock').doc(ingredientDocId(name));
  let after = 0;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const before = snap.exists ? (Number(snap.data()?.onHand) || 0) : 0;
    after = before + delta;
    const unit = opts?.unit || (snap.exists ? String(snap.data()?.unit || '') : '') || '';
    tx.set(ref, { name, onHand: after, unit, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    writeLog(tx, ref, { type: 'receive', delta, after, unit, note: opts?.note ?? null, by: opts?.by ?? null });
  });
  return after;
}

/**
 * 盘点校正 (adjust): OVERWRITE on-hand to `onHand` (physical recount). Logs an
 * `adjust` movement (delta = new − old) only when the count actually changes,
 * so a threshold-only save doesn't create a noise entry.
 */
export async function setIngredientStock(
  db: Firestore,
  name: string,
  onHand: number,
  opts?: { unit?: string; threshold?: number | null; note?: string; by?: string },
): Promise<void> {
  const ref = db.collection('ingredientStock').doc(ingredientDocId(name));
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const before = snap.exists ? (Number(snap.data()?.onHand) || 0) : 0;
    const unit = opts?.unit || (snap.exists ? String(snap.data()?.unit || '') : '') || '';
    const payload: Record<string, unknown> = { name, onHand, updatedAt: FieldValue.serverTimestamp() };
    if (opts?.unit) payload.unit = opts.unit;
    if (opts && 'threshold' in opts) {
      payload.threshold = opts.threshold == null ? FieldValue.delete() : opts.threshold;
    }
    tx.set(ref, payload, { merge: true });
    if (onHand !== before) {
      writeLog(tx, ref, { type: 'adjust', delta: onHand - before, after: onHand, unit, note: opts?.note ?? null, by: opts?.by ?? null });
    }
  });
}

/** Recent movements for one ingredient, newest first (single-field orderBy → auto index). */
export async function getIngredientLedger(db: Firestore, name: string, limit = 30): Promise<LedgerEntry[]> {
  const ref = db.collection('ingredientStock').doc(ingredientDocId(name));
  const snap = await ref.collection('log').orderBy('at', 'desc').limit(Math.min(200, Math.max(1, limit))).get();
  return snap.docs.map(d => {
    const x = d.data() || {};
    return {
      type: (x.type as MovementType) || 'adjust',
      delta: Number(x.delta) || 0,
      after: Number(x.after) || 0,
      unit: typeof x.unit === 'string' ? x.unit : '',
      note: x.note ?? null,
      orderId: x.orderId ?? null,
      by: x.by ?? null,
      at: x.at?.toMillis?.() ?? null,
    };
  });
}

/**
 * Best-effort decrement of on-hand for every ingredient an order consumes, and
 * a `consume` ledger entry per ingredient (same batch, so no extra round trips).
 * Reuses the prep aggregation (handles "↳ "-prefixed add-on rows + nested
 * addOns + the manual-label aliases) so it stays byte-identical to the cook
 * list. Only ingredients that already have a doc are touched. NEVER throws —
 * a failure here must not break checkout.
 */
export async function consumeIngredientStock(
  db: Firestore,
  items: PrepOrderItem[],
  ctx?: { orderId?: string; source?: string },
): Promise<void> {
  try {
    const { lines } = aggregateIngredients([{ items }]);
    if (!lines.length) return;

    // Merge by name (doc id is name only) so a batch never writes the same doc
    // twice — Firestore rejects duplicate writes in one batch.
    const byName = new Map<string, number>();
    const unitByName = new Map<string, string>();
    for (const l of lines) {
      byName.set(l.name, (byName.get(l.name) || 0) + l.qty);
      if (!unitByName.has(l.name)) unitByName.set(l.name, l.unit);
    }

    const names = [...byName.keys()];
    const refs = names.map(n => db.collection('ingredientStock').doc(ingredientDocId(n)));
    const snaps = await db.getAll(...refs);

    const batch = db.batch();
    let touched = 0;
    snaps.forEach((snap, i) => {
      if (!snap.exists) return; // untracked ingredient — skip
      const qty = byName.get(names[i]) || 0;
      const before = Number(snap.data()?.onHand) || 0;
      batch.update(refs[i], {
        onHand: FieldValue.increment(-qty),
        updatedAt: FieldValue.serverTimestamp(),
      });
      writeLog(batch, refs[i], {
        type: 'consume', delta: -qty, after: before - qty,
        unit: String(snap.data()?.unit || unitByName.get(names[i]) || ''),
        note: ctx?.source ?? 'order', orderId: ctx?.orderId ?? null,
      });
      touched++;
    });
    if (touched) await batch.commit();
  } catch (err) {
    // Advisory layer — log and move on; ordering must never fail on this.
    console.error('[consumeIngredientStock] best-effort decrement failed:', err);
  }
}
