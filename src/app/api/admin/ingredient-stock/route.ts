import { NextRequest } from 'next/server';
import { verifyAdmin, adminJson, corsPreflight } from '@/lib/adminApi';
import { aggregateIngredients, type PrepOrder } from '@/lib/prepIngredients';

/**
 * POST /api/admin/ingredient-stock   (admin Bearer token; CORS '*')
 *
 * Powers the dashboard「🥩 食材盘点」panel.
 *
 *   { action: 'list', date }                 → every tracked ingredient with its
 *                                              on-hand + the amount NEEDED for
 *                                              `date`'s active orders (same
 *                                              aggregation as the prep list),
 *                                              and the shortfall.
 *   { action: 'set', name, onHand, threshold? } → 盘点: overwrite on-hand
 *                                              (and optional low-stock threshold).
 *
 * On-hand units follow the recipe (g stored raw; UI promotes to kg). NEEDED is
 * advisory — short ingredients are flagged, never block ordering.
 */
export function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) return adminJson({ error: '未授权访问' }, 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return adminJson({ error: '请求格式错误' }, 400);
  }
  const action = String(body?.action || '').trim();

  try {
    const { getAdminDb } = await import('@/lib/firebase-admin');
    const db = getAdminDb();
    const { getAllIngredientStock, setIngredientStock } = await import('@/lib/ingredientStock');

    if (action === 'set') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const onHand = Number(body.onHand);
      if (!name) return adminJson({ error: '缺少食材名' }, 400);
      if (!Number.isFinite(onHand) || onHand < 0) return adminJson({ error: 'onHand 必须为非负数' }, 400);
      const hasThreshold = 'threshold' in body;
      const threshold = body.threshold == null ? null : Number(body.threshold);
      if (hasThreshold && threshold !== null && (!Number.isFinite(threshold) || threshold < 0)) {
        return adminJson({ error: 'threshold 必须为非负数或 null' }, 400);
      }
      await setIngredientStock(db, name, onHand, hasThreshold ? { threshold } : undefined);
      return adminJson({ ok: true, name, onHand });
    }

    if (action === 'list') {
      const date = typeof body.date === 'string' ? body.date.trim() : '';
      const stock = await getAllIngredientStock(db);

      // Amount needed for the date's active orders (same roll-up as prep list).
      const needed = new Map<string, number>();
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const snap = await db.collection('orders').where('deliveryDate', '==', date).get();
        const orders = snap.docs.map(d => d.data() as PrepOrder).filter(o => o.status !== 'cancelled');
        const { lines } = aggregateIngredients(orders);
        for (const l of lines) needed.set(l.name, (needed.get(l.name) || 0) + l.qty);
      }

      // Union of tracked ingredients + anything needed but not yet tracked.
      const names = new Set<string>([...Object.keys(stock), ...needed.keys()]);
      const ingredients = [...names].sort((a, b) => a.localeCompare(b, 'zh')).map(name => {
        const s = stock[name];
        const need = needed.get(name) || 0;
        const onHand = s?.onHand ?? 0;
        return {
          name,
          unit: s?.unit ?? '',
          onHand,
          threshold: s?.threshold ?? null,
          needed: need,
          shortfall: Math.max(0, need - onHand),
          tracked: !!s,
          low: s?.threshold != null && onHand <= s.threshold,
        };
      });
      return adminJson({ date: date || null, ingredients });
    }

    return adminJson({ error: '未知 action（list | set）' }, 400);
  } catch (err) {
    console.error('[admin/ingredient-stock] failed:', err);
    const msg = err instanceof Error ? err.message : '食材库存操作失败';
    return adminJson({ error: msg }, 500);
  }
}
