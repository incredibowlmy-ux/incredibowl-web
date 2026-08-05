import { NextRequest } from 'next/server';
import { verifyAdmin, adminJson, corsPreflight } from '@/lib/adminApi';
import { weeklyMenu } from '@/data/weeklyMenu';
import type { PrepOrderItem } from '@/lib/prepIngredients';

/**
 * POST /api/admin/consume-stock   (admin Bearer token; CORS '*')
 *
 * Called by the dashboard AFTER a manual order is saved, to mirror the stock
 * side-effects that web checkout does automatically. Decrements BOTH layers:
 *   - dishStock (per-dish sell-out limit) — lenient, never blocks (admin override)
 *   - ingredientStock (raw inventory)     — best-effort, advisory only
 * Neither can fail the call in a way that matters — a manual order is already
 * saved by the time this runs; this only keeps the counts honest.
 *
 * Body: { items: PrepOrderItem[] }   — the saved order's items array
 *        (dish lines + "↳ "-prefixed or nested add-ons; same shape as orders).
 * Returns: { ok, dishDecremented:number[], note }
 */
export function OPTIONS() {
  return corsPreflight();
}

const isAddOn = (name: string) => /^↳/.test(name || '');
const menuByName = new Map(weeklyMenu.map(d => [d.name, d]));

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) return adminJson({ error: '未授权访问' }, 403);

  let items: PrepOrderItem[], release: boolean, orderId: string;
  /** 当初的实扣量（order.stockDeducted）。release 时按它精确回补，见上。 */
  let stockDeducted: Record<string, number> | undefined;
  try {
    const body = await req.json();
    items = Array.isArray(body?.items) ? body.items : [];
    release = body?.release === true; // true = credit back (order deleted)
    orderId = typeof body?.orderId === 'string' ? body.orderId : '';
    stockDeducted = body?.stockDeducted && typeof body.stockDeducted === 'object'
      ? body.stockDeducted : undefined;
  } catch {
    return adminJson({ error: '请求格式错误' }, 400);
  }
  if (!items.length) return adminJson({ error: 'items 为空' }, 400);

  try {
    const { getAdminDb } = await import('@/lib/firebase-admin');
    const db = getAdminDb();

    // Layer A — dish sell-out limit. Map dish lines → {dishId, qty} via menu name.
    const dishItems = items
      .filter(it => it?.name && !isAddOn(it.name) && (it.quantity || 0) > 0)
      .map(it => {
        const dish = menuByName.get(it.name);
        return dish ? { dishId: dish.id, qty: it.quantity || 0, name: it.name } : null;
      })
      .filter((x): x is { dishId: number; qty: number; name: string } => x !== null);

    if (release) {
      // Order deleted → credit BOTH layers back so the hard sell-out gate
      // doesn't keep blocking customers for portions that freed up.
      //
      // 2026-08-04：优先按调用方传来的 stockDeducted（当初的**实扣量**）回补。
      // 手动单走 lenient 扣减，库存见底时扣不满，按 items 的 qty 全额退会凭空
      // 印货（超卖方向）。没传就 fallback 到旧口径（纪元前/没记录的历史单）。
      const { releaseDishStock, deductedToItems } = await import('@/lib/stockUtils');
      const exact = deductedToItems(stockDeducted);
      const toRelease = exact.length ? exact : dishItems;
      let restored: Record<string, number> = {};
      try { restored = await releaseDishStock(db, toRelease); }
      catch (e) { console.error('[consume-stock] dish release failed:', e); }
      const { releaseIngredientStock } = await import('@/lib/ingredientStock');
      await releaseIngredientStock(db, items, { source: '删单回补', orderId: orderId || undefined });
      const portions = Object.values(restored).reduce((s, n) => s + n, 0);
      return adminJson({
        ok: true, released: true, restored, basis: exact.length ? 'stockDeducted' : 'items',
        note: portions > 0 ? `已回补 ${portions} 份限量菜 + 食材` : '已回补食材（无限量菜命中）',
      });
    }

    const { decrementDishStockLenient } = await import('@/lib/stockUtils');
    const dishDecremented = await decrementDishStockLenient(db, dishItems);

    // Layer B — raw ingredient inventory (best-effort, swallows errors).
    const { consumeIngredientStock } = await import('@/lib/ingredientStock');
    await consumeIngredientStock(db, items, { source: '手动单', orderId: orderId || undefined });

    const hitCount = Object.keys(dishDecremented).length;
    const portions = Object.values(dishDecremented).reduce((s, n) => s + n, 0);
    return adminJson({
      ok: true,
      // 实扣量映射 —— 调用方**必须**把它写进 order.stockDeducted，否则删单时
      // 只能按 qty 猜，见底扣不满的那部分会被凭空退回去。
      dishDecremented,
      note: hitCount
        ? `已扣减 ${hitCount} 道限量菜共 ${portions} 份 + 食材`
        : '已扣减食材（无限量菜命中）',
    });
  } catch (err) {
    console.error('[admin/consume-stock] failed:', err);
    const msg = err instanceof Error ? err.message : '扣减库存失败';
    return adminJson({ error: msg }, 500);
  }
}
