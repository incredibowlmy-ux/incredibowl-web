import { NextRequest } from 'next/server';
import { verifyAdmin, adminJson, corsPreflight } from '@/lib/adminApi';

/**
 * POST /api/admin/dish-stock   (admin Bearer token; CORS '*' for the dashboard)
 *
 * Set or clear the per-dish sell-out limit (Firestore `dishStock`). This is the
 * UI-driven equivalent of scripts/set-dish-stock.mjs.
 *
 * Body:
 *   { dishId, remaining }          → set remaining (creates the doc)
 *   { dishId, remaining: null }    → DELETE the doc (dish becomes unlimited)
 *   { dishName }                   → optional label stored alongside
 *
 * The public GET /api/dish-stock already serves the remaining map to the menu;
 * this route only mutates.
 */
export function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) return adminJson({ error: '未授权访问' }, 403);

  let dishId: number, remaining: number | null, dishName: string;
  try {
    const body = await req.json();
    dishId = Number(body?.dishId);
    remaining = body?.remaining === null ? null : Number(body?.remaining);
    dishName = typeof body?.dishName === 'string' ? body.dishName.trim() : '';
  } catch {
    return adminJson({ error: '请求格式错误' }, 400);
  }
  if (!Number.isFinite(dishId)) return adminJson({ error: 'dishId 无效' }, 400);
  if (remaining !== null && (!Number.isFinite(remaining) || remaining < 0)) {
    return adminJson({ error: 'remaining 必须为非负整数或 null' }, 400);
  }

  try {
    const { getAdminDb } = await import('@/lib/firebase-admin');
    const db = getAdminDb();
    const ref = db.collection('dishStock').doc(String(dishId));

    if (remaining === null) {
      await ref.delete();
      return adminJson({ ok: true, dishId, remaining: null, unlimited: true });
    }

    const { FieldValue } = await import('firebase-admin/firestore');
    const payload: Record<string, unknown> = {
      remaining: Math.floor(remaining),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (dishName) payload.dishName = dishName;
    await ref.set(payload, { merge: true });
    return adminJson({ ok: true, dishId, remaining: Math.floor(remaining) });
  } catch (err) {
    console.error('[admin/dish-stock] failed:', err);
    const msg = err instanceof Error ? err.message : '设置库存失败';
    return adminJson({ error: msg }, 500);
  }
}
