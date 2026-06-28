/**
 * Per-dish stock limits (e.g. petai 参峇臭豆 — limited perishable ingredient).
 *
 * Source of truth: Firestore collection `dishStock`, ONE doc per limited dish
 * (doc id = String(dishId)) with `{ remaining, dishName, updatedAt }`. A dish
 * WITHOUT a doc is unlimited (never blocked). Set/reset via
 * scripts/set-dish-stock.mjs (admin updates `remaining` on restock).
 *
 * Web checkout reserves stock at submit (atomic decrement; rejects if short).
 * NOTE: manual/dashboard orders bypass /api/submit-order, so they do NOT
 * auto-decrement — the admin adjusts `remaining` for those. Abandoned pending
 * web orders hold their reserved stock until the admin resets (safe side: we
 * never oversell; we may briefly under-show availability).
 *
 * Pure server use — firebase-admin Firestore.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';

export interface DishStockItem {
  dishId: number;
  qty: number;
  name?: string;
}

/** Read every limited dish's remaining count → { [dishIdString]: remaining }. */
export async function getAllDishStock(db: Firestore): Promise<Record<string, number>> {
  const snap = await db.collection('dishStock').get();
  const out: Record<string, number> = {};
  for (const d of snap.docs) {
    const r = Number(d.data()?.remaining);
    if (Number.isFinite(r)) out[d.id] = r;
  }
  return out;
}

function aggregate(items: DishStockItem[]): Map<number, { qty: number; name: string }> {
  const m = new Map<number, { qty: number; name: string }>();
  for (const it of items || []) {
    if (!it || !Number.isFinite(it.dishId) || !(it.qty > 0)) continue;
    const cur = m.get(it.dishId);
    if (cur) cur.qty += it.qty;
    else m.set(it.dishId, { qty: it.qty, name: it.name || String(it.dishId) });
  }
  return m;
}

/**
 * Atomically reserve stock for any limited dishes in `items`. Dishes without a
 * `dishStock` doc are unlimited and ignored. Throws (with a customer-facing
 * message) if any limited dish has insufficient remaining — caller maps to 400.
 */
export async function consumeDishStock(db: Firestore, items: DishStockItem[]): Promise<void> {
  const wanted = aggregate(items);
  if (wanted.size === 0) return;
  const ids = [...wanted.keys()];
  const refs = ids.map(id => db.collection('dishStock').doc(String(id)));

  await db.runTransaction(async (tx) => {
    const snaps = await Promise.all(refs.map(r => tx.get(r)));
    // Verify all before mutating any.
    for (let i = 0; i < ids.length; i++) {
      if (!snaps[i].exists) continue; // unlimited
      const { qty, name } = wanted.get(ids[i])!;
      const remaining = Number(snaps[i].data()?.remaining) || 0;
      if (remaining < qty) {
        throw new Error(
          remaining <= 0
            ? `「${name}」已售罄，无法下单`
            : `「${name}」仅剩 ${remaining} 份，无法下单 ${qty} 份`,
        );
      }
    }
    for (let i = 0; i < ids.length; i++) {
      if (!snaps[i].exists) continue;
      const { qty } = wanted.get(ids[i])!;
      tx.update(refs[i], { remaining: FieldValue.increment(-qty), updatedAt: FieldValue.serverTimestamp() });
    }
  });
}

/**
 * Lenient decrement for MANUAL (dashboard) orders — admin is in control, so it
 * does NOT block on shortage (unlike consumeDishStock for web checkout). Only
 * touches dishes that already have a `dishStock` doc; clamps at 0 so the menu
 * never shows a negative "仅剩". Best-effort: per-dish failures are swallowed.
 * Returns the dishIds whose remaining actually changed.
 */
export async function decrementDishStockLenient(db: Firestore, items: DishStockItem[]): Promise<number[]> {
  const wanted = aggregate(items);
  if (wanted.size === 0) return [];
  const changed: number[] = [];
  for (const [id, { qty }] of wanted) {
    const ref = db.collection('dishStock').doc(String(id));
    try {
      const did = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return false; // unlimited — not tracked
        const remaining = Number(snap.data()?.remaining) || 0;
        tx.update(ref, { remaining: Math.max(0, remaining - qty), updatedAt: FieldValue.serverTimestamp() });
        return true;
      });
      if (did) changed.push(id);
    } catch (err) {
      console.error(`[decrementDishStockLenient] dish ${id} failed:`, err);
    }
  }
  return changed;
}

/** Best-effort release (rollback) — increments remaining back for limited dishes. */
export async function releaseDishStock(db: Firestore, items: DishStockItem[]): Promise<void> {
  const wanted = aggregate(items);
  if (wanted.size === 0) return;
  for (const [id, { qty }] of wanted) {
    const ref = db.collection('dishStock').doc(String(id));
    const snap = await ref.get();
    if (!snap.exists) continue;
    await ref.update({ remaining: FieldValue.increment(qty), updatedAt: FieldValue.serverTimestamp() });
  }
}
