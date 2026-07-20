import { NextRequest, NextResponse } from 'next/server';
import { weeklyMenu } from '@/data/weeklyMenu';
import type { PrepOrderItem } from '@/lib/prepIngredients';

/**
 * POST/GET /api/n8n/release-stale-fpx — hourly reconciliation (n8n cron).
 *
 * FPX checkout redirects to the bank; if the customer never comes back the
 * order sits in `pending` forever while holding: reserved dishStock (hard
 * sell-out gate!), auto-deducted ingredients, and any claimed meal vouchers.
 * This job cancels FPX orders still pending after a cutoff and credits it all
 * back. Decided 2026-07-02 (boss): cutoff = 1 hour.
 *
 * ONLY paymentMethod === 'fpx' is touched — QR orders legitimately stay
 * pending for hours awaiting manual receipt confirmation, and voucher-paid
 * orders confirm instantly. A legit FPX callback lands in minutes, so 1 h is
 * generous; the raced case (callback after our cancel) is accepted drift the
 * daily 盘点 corrects.
 *
 * Auth: Authorization: Bearer <N8N_API_KEY> or ?key=  (same as daily-prep).
 * Optional ?hours= overrides the cutoff (min 0.5).
 * Stock credit only for stock-era orders (created ≥ 2026-06-29); vouchers
 * release for any age (claiming predates the stock system).
 */

const STOCK_ERA_MS = Date.parse('2026-06-28T16:00:00Z'); // 2026-06-29 00:00 MYT

let adminDb: FirebaseFirestore.Firestore | null = null;
async function getDb() {
  if (adminDb) return adminDb;
  const { getAdminDb } = await import('@/lib/firebase-admin');
  adminDb = getAdminDb();
  return adminDb;
}

function authorized(req: NextRequest): boolean {
  const expected = process.env.N8N_API_KEY;
  if (!expected) return false;
  const header = req.headers.get('Authorization');
  if (header === `Bearer ${expected}`) return true;
  return new URL(req.url).searchParams.get('key') === expected;
}

const menuByName = new Map(weeklyMenu.map(d => [d.name, d]));
const isAddOnRow = (name: string) => /^↳/.test(name || '');

async function run(req: NextRequest): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ error: '未授权' }, { status: 403 });
  }
  const hoursParam = Number(new URL(req.url).searchParams.get('hours'));
  const hours = Number.isFinite(hoursParam) && hoursParam >= 0.5 ? hoursParam : 1;
  const cutoffMs = Date.now() - hours * 3600_000;

  try {
    const db = await getDb();
    // Equality-only query (no composite index needed); age-filter in code.
    const snap = await db.collection('orders')
      .where('status', '==', 'pending')
      .where('paymentMethod', '==', 'fpx')
      .get();

    const { releaseDishStock } = await import('@/lib/stockUtils');
    const { releaseIngredientStock } = await import('@/lib/ingredientStock');
    const { releaseMealVouchers } = await import('@/lib/mealVoucherUtils');
    const { releaseAddonCredits } = await import('@/lib/addonCreditUtils');
    const { FieldValue } = await import('firebase-admin/firestore');

    const cancelled: string[] = [];
    let vouchersReleased = 0;
    let addonCreditsReleased = 0;

    for (const doc of snap.docs) {
      const o = doc.data();
      const createdMs = o.createdAt?.toMillis?.() ?? 0;
      if (!createdMs || createdMs > cutoffMs) continue; // too young / no timestamp

      // 1. Cancel first — if this write fails we touch nothing else.
      await doc.ref.update({
        status: 'cancelled',
        cancelReason: `fpx-timeout-auto(${hours}h)`,
        updatedAt: FieldValue.serverTimestamp(),
      });
      cancelled.push(doc.id);

      // 2. Credit stock back (stock-era orders only — older never deducted).
      const items: PrepOrderItem[] = Array.isArray(o.items) ? o.items : [];
      if (createdMs >= STOCK_ERA_MS && items.length) {
        const dishItems = items
          .filter(it => it?.name && !isAddOnRow(it.name) && (it.quantity || 0) > 0)
          .map(it => {
            const dish = menuByName.get(it.name);
            return dish ? { dishId: dish.id, qty: it.quantity || 0, name: it.name } : null;
          })
          .filter((x): x is { dishId: number; qty: number; name: string } => x !== null);
        try { await releaseDishStock(db, dishItems); } catch (e) { console.error('[release-stale-fpx] dish release failed:', doc.id, e); }
        await releaseIngredientStock(db, items, { orderId: doc.id, source: 'FPX超时回补' });
      }

      // 3. Release claimed meal vouchers (attached to part 1 of a group).
      const voucherIds: string[] = Array.isArray(o.claimedMealVoucherIds) ? o.claimedMealVoucherIds : [];
      if (voucherIds.length) {
        try {
          await releaseMealVouchers(db, voucherIds);
          vouchersReleased += voucherIds.length;
        } catch (e) { console.error('[release-stale-fpx] voucher release failed:', doc.id, e); }
      }

      // 4. Release prepaid add-on credits (attached to part 1 of a group).
      const addonLines: Array<{ addonId: string; count: number }> =
        Array.isArray(o.addonCreditsUsed) ? o.addonCreditsUsed : [];
      if (addonLines.length && o.userId) {
        try {
          await releaseAddonCredits(db, o.userId, addonLines, doc.id);
          addonCreditsReleased += addonLines.reduce((s, l) => s + (Number(l.count) || 0), 0);
        } catch (e) { console.error('[release-stale-fpx] addon credit release failed:', doc.id, e); }
      }
    }

    return NextResponse.json({
      ok: true,
      hours,
      scannedPendingFpx: snap.size,
      cancelledCount: cancelled.length,
      cancelledOrderIds: cancelled,
      vouchersReleased,
      addonCreditsReleased,
    });
  } catch (err) {
    console.error('[release-stale-fpx] failed:', err);
    const msg = err instanceof Error ? err.message : '对账失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) { return run(req); }
export async function GET(req: NextRequest) { return run(req); }
