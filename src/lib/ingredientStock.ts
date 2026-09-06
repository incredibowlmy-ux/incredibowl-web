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
 * prep list (aggregateIngredients), so what's subtracted == what's cooked —
 * plus packaging bowls (packagingLines) via aggregateStockNeeds.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { aggregateStockNeeds, type PrepOrderItem } from './prepIngredients';

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
//   release = 删单回补（把已扣的加回去，+）
//   convert = 厨房加工（原料 − / 成品 +，一次操作在两个食材上各记一条）
export type MovementType = 'receive' | 'adjust' | 'consume' | 'release' | 'convert';

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

/**
 * Threshold-only save — deliberately does NOT touch onHand. The dashboard's
 * threshold button previously sent a stale onHand along, silently reverting
 * counts consumed since page load; this path makes that impossible. No ledger
 * entry (thresholds aren't stock movements).
 */
export async function setIngredientThreshold(db: Firestore, name: string, threshold: number | null): Promise<void> {
  await db.collection('ingredientStock').doc(ingredientDocId(name)).set({
    name,
    threshold: threshold == null ? FieldValue.delete() : threshold,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

/**
 * 厨房加工 (convert): 一次操作同时动两个食材 —— 原料扣 inputQty、成品加
 * outputQty，各写一条 `convert` 流水互相指认（note 写清对方是谁）。
 *
 * 与 receive/adjust 的区别：这不是买货也不是重数，是「把 A 变成 B」，所以
 * 必须在**同一个事务**里成对发生 —— 否则中途失败会凭空造出或吃掉库存。
 *
 * 原料不足**不阻止**（与本层 advisory 的一贯口径一致：老板可能先做了、
 * 进货还没补录），但把 shortOfInput 返回出去让 dashboard 明确提示。
 */
export async function convertIngredientStock(
  db: Firestore,
  args: { from: string; to: string; inputQty: number; outputQty: number; by?: string; note?: string },
): Promise<{ fromAfter: number; toAfter: number; shortOfInput: boolean }> {
  const { from, to, inputQty, outputQty } = args;
  const fromRef = db.collection('ingredientStock').doc(ingredientDocId(from));
  const toRef = db.collection('ingredientStock').doc(ingredientDocId(to));
  let fromAfter = 0, toAfter = 0, shortOfInput = false;

  await db.runTransaction(async (tx) => {
    const [fs_, ts_] = await Promise.all([tx.get(fromRef), tx.get(toRef)]);
    const fromBefore = fs_.exists ? (Number(fs_.data()?.onHand) || 0) : 0;
    const toBefore = ts_.exists ? (Number(ts_.data()?.onHand) || 0) : 0;
    const fromUnit = String(fs_.data()?.unit || '') || '颗';
    const toUnit = String(ts_.data()?.unit || '') || fromUnit;

    fromAfter = fromBefore - inputQty;
    toAfter = toBefore + outputQty;
    shortOfInput = fromBefore < inputQty;

    tx.set(fromRef, { name: from, onHand: fromAfter, unit: fromUnit, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(toRef, { name: to, onHand: toAfter, unit: toUnit, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    writeLog(tx, fromRef, {
      type: 'convert', delta: -inputQty, after: fromAfter, unit: fromUnit,
      note: args.note || `加工成 ${to} ${outputQty}`, by: args.by ?? null,
    });
    writeLog(tx, toRef, {
      type: 'convert', delta: outputQty, after: toAfter, unit: toUnit,
      note: args.note || `用 ${from} ${inputQty} 做`, by: args.by ?? null,
    });
  });

  return { fromAfter, toAfter, shortOfInput };
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
): Promise<IngredientMovementResult> {
  return applyOrderMovement(db, items, -1, 'consume', ctx);
}

/**
 * Inverse of consume — credits back what a DELETED order had auto-deducted
 * (both layers stay honest when the admin removes a mistaken order). Same
 * best-effort/never-throws contract; logs `release` movements.
 */
export async function releaseIngredientStock(
  db: Firestore,
  items: PrepOrderItem[],
  ctx?: { orderId?: string; source?: string },
): Promise<IngredientMovementResult> {
  return applyOrderMovement(db, items, +1, 'release', ctx);
}

/**
 * 结果对象。契约仍是 **NEVER THROWS** —— 但失败会从返回值里**说出来**，
 * 调用方必须看它才知道到底补没补成（外层 try/catch 结构上永远不会命中，
 * 以前 orderRollback 就因此无条件记 released.ingredientStock = true，
 * batch 提交失败时三重静默：没日志行、没 failure 标记、没订单文档）。
 */
export interface IngredientMovementResult {
  ok: boolean;
  /** 实际写了几个食材文档（0 = 这单没有可追踪的原料，属正常）。 */
  touched: number;
  error?: string;
}

async function applyOrderMovement(
  db: Firestore,
  items: PrepOrderItem[],
  sign: 1 | -1,
  type: 'consume' | 'release',
  ctx?: { orderId?: string; source?: string },
): Promise<IngredientMovementResult> {
  try {
    const lines = aggregateStockNeeds([{ items }]);
    if (!lines.length) return { ok: true, touched: 0 };

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
      const delta = sign * (byName.get(names[i]) || 0);
      const before = Number(snap.data()?.onHand) || 0;
      batch.update(refs[i], {
        onHand: FieldValue.increment(delta),
        updatedAt: FieldValue.serverTimestamp(),
      });
      writeLog(batch, refs[i], {
        type, delta, after: before + delta,
        unit: String(snap.data()?.unit || unitByName.get(names[i]) || ''),
        note: ctx?.source ?? 'order', orderId: ctx?.orderId ?? null,
      });
      touched++;
    });
    if (touched) await batch.commit();
    return { ok: true, touched };
  } catch (err) {
    // Advisory layer — log and move on; ordering must never fail on this.
    // 契约不变（NEVER THROWS），但 2026-08-04 起把失败**返回**出去：以前
    // 调用方的 try/catch 结构上永远不可能命中，于是 orderRollback 无条件
    // 记 `released.ingredientStock = true` —— batch 提交失败时没日志行、
    // 没 failure 标记、（硬删场景下）连订单文档都不剩，三重静默。
    console.error(`[${type}IngredientStock] best-effort movement failed:`, err);
    return { ok: false, touched: 0, error: err instanceof Error ? err.message : String(err) };
  }
}
