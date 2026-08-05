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

/**
 * 实际扣减量：dishId(string) → 真正从 `remaining` 里减掉的份数。
 *
 * 为什么不能用订单 items 的 qty 反推（2026-08-04）：
 *   `decrementDishStockLenient` 在库存见底时 clamp 到 0，**实扣量 < qty**，
 *   而 `releaseDishStock` 按传入 qty 全额 increment 回去。限量菜 remaining=1、
 *   手动单开 3 份 → 实扣 1、退 3 → 凭空多出 2 份，网站会答应做不出来的菜
 *   （超卖方向，比少卖严重）。旧版 lenient 只返回 dishId 列表，实扣量在那一刻
 *   就丢了，事后无法还原。现在把它带出来，由建单方写进 order.stockDeducted，
 *   取消/删除时按它精确回补。
 */
export type DishStockDeducted = Record<string, number>;

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
export async function consumeDishStock(db: Firestore, items: DishStockItem[]): Promise<DishStockDeducted> {
  const wanted = aggregate(items);
  const deducted: DishStockDeducted = {};
  if (wanted.size === 0) return deducted;
  const ids = [...wanted.keys()];
  const refs = ids.map(id => db.collection('dishStock').doc(String(id)));

  await db.runTransaction(async (tx) => {
    // 事务可能整体重跑 —— 每轮清空，否则重试会把实扣量记成两倍。
    for (const k of Object.keys(deducted)) delete deducted[k];
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
      // 严格扣减不 clamp（不够就 throw），所以实扣量恒等于 qty。
      deducted[String(ids[i])] = qty;
    }
  });
  return deducted;
}

/**
 * Lenient decrement for MANUAL (dashboard) orders — admin is in control, so it
 * does NOT block on shortage (unlike consumeDishStock for web checkout). Only
 * touches dishes that already have a `dishStock` doc; clamps at 0 so the menu
 * never shows a negative "仅剩". Best-effort: per-dish failures are swallowed.
 * Returns the dishIds whose remaining actually changed.
 */
export async function decrementDishStockLenient(db: Firestore, items: DishStockItem[]): Promise<DishStockDeducted> {
  const wanted = aggregate(items);
  const deducted: DishStockDeducted = {};
  if (wanted.size === 0) return deducted;
  for (const [id, { qty }] of wanted) {
    const ref = db.collection('dishStock').doc(String(id));
    try {
      const actual = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return 0; // unlimited — not tracked
        const remaining = Number(snap.data()?.remaining) || 0;
        const next = Math.max(0, remaining - qty);
        // 见底时扣不满：真实扣减量是 remaining−next，不是 qty。回补必须按这个数。
        tx.update(ref, { remaining: next, updatedAt: FieldValue.serverTimestamp() });
        return remaining - next;
      });
      if (actual > 0) deducted[String(id)] = (deducted[String(id)] || 0) + actual;
    } catch (err) {
      console.error(`[decrementDishStockLenient] dish ${id} failed:`, err);
    }
  }
  return deducted;
}

/**
 * Best-effort release (rollback) — increments remaining back for limited dishes.
 * 返回**真正 increment 回去的量**（没有 dishStock 文档的菜 = 不限量，不计）。
 * 调用方拿它报数，别再拿 items 的 qty 当回补量报给用户（绝大多数菜不限量，
 * 那个数字基本都是错的）。
 */
export async function releaseDishStock(db: Firestore, items: DishStockItem[]): Promise<DishStockDeducted> {
  const wanted = aggregate(items);
  const restored: DishStockDeducted = {};
  if (wanted.size === 0) return restored;
  for (const [id, { qty }] of wanted) {
    const ref = db.collection('dishStock').doc(String(id));
    const snap = await ref.get();
    if (!snap.exists) continue;
    await ref.update({ remaining: FieldValue.increment(qty), updatedAt: FieldValue.serverTimestamp() });
    restored[String(id)] = (restored[String(id)] || 0) + qty;
  }
  return restored;
}

/**
 * 把 order.stockDeducted 记录还原成 releaseDishStock 能吃的 items。
 * 有这份记录就按它精确回补（实扣多少退多少）；没有的话调用方才 fallback
 * 到「按订单 items 的 qty 推算」的旧口径（历史单）。
 */
export function deductedToItems(deducted: DishStockDeducted | undefined | null): DishStockItem[] {
  if (!deducted || typeof deducted !== 'object') return [];
  const out: DishStockItem[] = [];
  for (const [id, qty] of Object.entries(deducted)) {
    const dishId = Number(id);
    const n = Number(qty);
    if (Number.isFinite(dishId) && n > 0) out.push({ dishId, qty: n });
  }
  return out;
}
