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
  try {
    const body = await req.json();
    items = Array.isArray(body?.items) ? body.items : [];
    release = body?.release === true; // true = credit back (order deleted)
    orderId = typeof body?.orderId === 'string' ? body.orderId : '';
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
      const { releaseDishStock } = await import('@/lib/stockUtils');
      try { await releaseDishStock(db, dishItems); } catch (e) { console.error('[consume-stock] dish release failed:', e); }
      const { releaseIngredientStock } = await import('@/lib/ingredientStock');
      await releaseIngredientStock(db, items, { source: '删单回补', orderId: orderId || undefined });
      return adminJson({ ok: true, released: true, note: '已回补限量菜份数 + 食材' });
    }

    const { decrementDishStockLenient } = await import('@/lib/stockUtils');
    const dishDecremented = await decrementDishStockLenient(db, dishItems);

    // Layer B — raw ingredient inventory (best-effort, swallows errors).
    const { consumeIngredientStock } = await import('@/lib/ingredientStock');
    await consumeIngredientStock(db, items, { source: '手动单', orderId: orderId || undefined });

    return adminJson({
      ok: true,
      dishDecremented,
      note: dishDecremented.length
        ? `已扣减 ${dishDecremented.length} 道限量菜库存 + 食材`
        : '已扣减食材（无限量菜命中）',
    });
  } catch (err) {
    console.error('[admin/consume-stock] failed:', err);
    const msg = err instanceof Error ? err.message : '扣减库存失败';
    return adminJson({ error: msg }, 500);
  }
}
