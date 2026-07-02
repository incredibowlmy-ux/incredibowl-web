import { NextRequest } from 'next/server';
import { verifyAdminEmail, adminJson, corsPreflight } from '@/lib/adminApi';
import { aggregateIngredients, type PrepOrder } from '@/lib/prepIngredients';

/**
 * POST /api/admin/ingredient-stock   (admin Bearer token; CORS '*')
 *
 * Powers the dashboard「🥩 食材盘点」panel.
 *
 *   { action: 'list', date }                    → every tracked ingredient + its
 *                                                 on-hand + NEEDED for `date` + shortfall.
 *   { action: 'add', name, delta, note? }       → 进货: ADD delta to on-hand
 *                                                 (never overwrites) + log receive.
 *   { action: 'set', name, onHand, threshold? } → 盘点校正: overwrite on-hand
 *                                                 (+ optional threshold) + log adjust.
 *   { action: 'ledger', name, limit? }          → recent movements for one ingredient.
 *   { action: 'matrix', startDate, days }       → forward burn-down projection.
 *
 * On-hand units follow the recipe (g stored raw; UI promotes to kg). NEEDED is
 * advisory — short ingredients are flagged, never block ordering.
 */
export function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: NextRequest) {
  const adminEmail = await verifyAdminEmail(req);
  if (!adminEmail) return adminJson({ error: '未授权访问' }, 403);

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
    const { getAllIngredientStock, setIngredientStock, addIngredientStock, getIngredientLedger } = await import('@/lib/ingredientStock');

    if (action === 'add') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const delta = Number(body.delta);
      const note = typeof body.note === 'string' ? body.note.trim() : '';
      if (!name) return adminJson({ error: '缺少食材名' }, 400);
      if (!Number.isFinite(delta) || delta <= 0) return adminJson({ error: '进货数量必须为正数' }, 400);
      const onHand = await addIngredientStock(db, name, delta, { note: note || undefined, by: adminEmail });
      return adminJson({ ok: true, name, delta, onHand });
    }

    if (action === 'ledger') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) return adminJson({ error: '缺少食材名' }, 400);
      const limit = Number(body.limit) || 30;
      const entries = await getIngredientLedger(db, name, limit);
      return adminJson({ name, entries });
    }

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
      await setIngredientStock(db, name, onHand, { by: adminEmail, ...(hasThreshold ? { threshold } : {}) });
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

    if (action === 'matrix') {
      // Forward burn-down: starting from current on-hand, subtract each day's
      // orders across a horizon, exposing the running balance per ingredient
      // per day and the day each runs out (if no restock).
      const startDate = typeof body.startDate === 'string' ? body.startDate.trim() : '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return adminJson({ error: 'startDate 格式应为 YYYY-MM-DD' }, 400);
      const days = Math.min(31, Math.max(1, Math.floor(Number(body.days) || 7)));

      // Date list (UTC math on the Y/M/D parts → no server-TZ drift).
      const [y, m, d0] = startDate.split('-').map(Number);
      const dates: string[] = [];
      for (let i = 0; i < days; i++) dates.push(new Date(Date.UTC(y, m - 1, d0 + i)).toISOString().slice(0, 10));
      const endDate = dates[dates.length - 1];

      const stock = await getAllIngredientStock(db);
      // deliveryDate is an ISO string → lexicographic range == chronological range.
      const snap = await db.collection('orders')
        .where('deliveryDate', '>=', startDate).where('deliveryDate', '<=', endDate).get();
      const orders = snap.docs.map(x => x.data() as PrepOrder).filter(o => o.status !== 'cancelled');

      const byDate = new Map<string, PrepOrder[]>();
      for (const o of orders) {
        const dd = (o as { deliveryDate?: string }).deliveryDate || '';
        if (!byDate.has(dd)) byDate.set(dd, []);
        byDate.get(dd)!.push(o);
      }

      const unitByName = new Map<string, string>();
      const neededByDate = dates.map(dt => {
        const { lines } = aggregateIngredients(byDate.get(dt) || []);
        const mp = new Map<string, number>();
        for (const l of lines) { mp.set(l.name, (mp.get(l.name) || 0) + l.qty); if (!unitByName.has(l.name)) unitByName.set(l.name, l.unit); }
        return mp;
      });

      const names = new Set<string>();
      neededByDate.forEach(mp => mp.forEach((_, n) => names.add(n)));

      const ingredients = [...names].map(name => {
        const s = stock[name];
        const onHand = s?.onHand ?? 0;
        const unit = s?.unit || unitByName.get(name) || '';
        const perDay = neededByDate.map(mp => mp.get(name) || 0);
        const running: number[] = [];
        let bal = onHand, runoutIndex = -1;
        for (let i = 0; i < perDay.length; i++) { bal -= perDay[i]; running.push(bal); if (runoutIndex < 0 && bal < 0) runoutIndex = i; }
        return { name, unit, onHand, tracked: !!s, perDay, running, runoutIndex, totalNeeded: perDay.reduce((a, b) => a + b, 0) };
      })
        .filter(x => x.totalNeeded > 0)
        .sort((a, b) => (a.runoutIndex < 0 ? 999 : a.runoutIndex) - (b.runoutIndex < 0 ? 999 : b.runoutIndex) || a.name.localeCompare(b.name, 'zh'));

      return adminJson({ startDate, dates, ingredients });
    }

    return adminJson({ error: '未知 action（list | add | set | ledger | matrix）' }, 400);
  } catch (err) {
    console.error('[admin/ingredient-stock] failed:', err);
    const msg = err instanceof Error ? err.message : '食材库存操作失败';
    return adminJson({ error: msg }, 500);
  }
}
