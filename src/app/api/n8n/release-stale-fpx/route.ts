import { NextRequest, NextResponse } from 'next/server';

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

    // 取消 + 四项回补全部走共用实现（confirm-order / admin/data 同一个函数）。
    // 原来这里的逻辑是对的，只是别人抄不到 —— 现在抽走了，三条路不可能再漂移。
    const { cancelOrderWithRollback } = await import('@/lib/orderRollback');

    const cancelled: string[] = [];
    let vouchersReleased = 0;
    let addonCreditsReleased = 0;

    for (const doc of snap.docs) {
      const o = doc.data();
      const createdMs = o.createdAt?.toMillis?.() ?? 0;
      if (!createdMs || createdMs > cutoffMs) continue; // too young / no timestamp

      // STOCK_ERA 闸门已挪进 cancelOrderWithRollback（三条路共享同一条规则）。
      const r = await cancelOrderWithRollback(db, doc.id, {
        reason: `fpx-timeout-auto(${hours}h)`,
      });
      if (!r.cancelled) continue; // 已被别的路径取消过 —— 不重复计数
      cancelled.push(doc.id);
      vouchersReleased += r.released.mealVouchers;
      addonCreditsReleased += r.released.addonCredits;
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
