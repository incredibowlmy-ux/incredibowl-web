import { NextRequest, NextResponse } from 'next/server';
import { FACE_VALUE_RM } from '@/data/mealVoucherConfig';

/**
 * GET /api/n8n/daily-recap
 *
 * Read-only end-of-day owner brief, designed to be polled by an external
 * automation (n8n cron at 21:00 KL → WhatsApp template push to incredibowl
 * owner). Same auth pattern as /api/n8n/daily-prep.
 *
 * Returns: today's order KPIs + voucher sales + customer mix + tomorrow's
 * order preview with critical-note count. All numeric fields are RM.
 *
 * "Today" / "tomorrow" are KL-local calendar days, NOT 24h windows from
 * call time, so a 21:00 cron and a 23:00 manual hit see the same day.
 *
 * Query / headers:
 *   - Authorization: Bearer <N8N_API_KEY>   (preferred)
 *     OR
 *   - ?key=<N8N_API_KEY>                   (fallback)
 *   - ?date=YYYY-MM-DD  (optional; defaults to TODAY in KL)
 */

let adminDb: FirebaseFirestore.Firestore | null = null;
async function getDb() {
  if (adminDb) return adminDb;
  const { getAdminDb } = await import('@/lib/firebase-admin');
  adminDb = getAdminDb();
  return adminDb;
}

function todayInKL(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function shiftDate(dateStr: string, days: number): string {
  // dateStr is YYYY-MM-DD interpreted as KL-local; +08:00 anchor avoids
  // UTC midnight rollover off-by-one when shifting near month boundaries.
  const base = Date.parse(`${dateStr}T00:00:00+08:00`);
  const shifted = new Date(base + days * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(shifted);
}

function dayBoundsKL(dateStr: string): { startMs: number; endMs: number } {
  const startMs = Date.parse(`${dateStr}T00:00:00+08:00`);
  return { startMs, endMs: startMs + 86_400_000 };
}

// KEEP IN SYNC with isLunchOrder() in src/app/api/n8n/daily-prep/route.ts.
interface OrderShape {
  userId?: string;
  userName?: string;
  deliveryDate?: string;
  deliveryTime?: string;
  deliveryFee?: number;
  mealType?: 'lunch' | 'dinner' | null;
  status?: string;
  total?: number;
  mealVouchersUsed?: number;
  mealVoucherAllocatedRevenue?: number;
  items?: { name: string; quantity?: number; note?: string; addOns?: unknown[] }[];
  note?: string;
}
function isLunchOrder(o: OrderShape): boolean {
  if (o.mealType === 'lunch') return true;
  if (o.mealType === 'dinner') return false;
  const t = (o.deliveryTime || '').toLowerCase();
  if (t.includes('dinner') || t.includes('晚')) return false;
  if (t.includes('lunch') || t.includes('午')) return true;
  const m = t.match(/(\d{1,2}):\d{2}/);
  if (m && parseInt(m[1], 10) >= 17) return false;
  return true;
}

// KEEP IN SYNC with CRITICAL_NOTE_PATTERNS in
// src/app/api/n8n/daily-prep/route.ts.
const CRITICAL_NOTE_PATTERNS = [
  /过敏|敏感|allergy|allergic/i,
  /不要|不能|不吃|别加|别放|别用/,
  /无糖|无油|无盐|无麻|走油|少油/,
  /素食|全素|蛋奶素|vegan|vegetarian/i,
  /戒口|忌口|禁忌/,
  /婴儿|宝宝|孕妇/,
  /急|赶时间|提前|urgent|asap/i,
];
const isCriticalNote = (note: string) =>
  CRITICAL_NOTE_PATTERNS.some(rx => rx.test(note));
const isAdminBookkeepingNote = (note: string) => /手动录入/.test(note);

function collectCriticalNotes(orders: OrderShape[]): string[] {
  const out: string[] = [];
  for (const o of orders) {
    const who = o.userName || '客户';
    if (o.note && !isAdminBookkeepingNote(o.note) && isCriticalNote(o.note)) {
      out.push(`${who}：${o.note}`);
    }
    for (const it of o.items || []) {
      if (it.note && !isAdminBookkeepingNote(it.note) && isCriticalNote(it.note)) {
        out.push(`${who}（${it.name.replace(/^↳\s*/, '')}）：${it.note}`);
      }
    }
  }
  return out;
}

// WhatsApp template parameters reject newlines, tabs, and 5+ consecutive
// spaces (#132018). Match the scrub the prep endpoint does.
function scrubForTemplate(s: string): string {
  return String(s)
    .replace(/\n/g, ' / ')
    .replace(/\t/g, ' ')
    .replace(/\s{5,}/g, '    ')
    .trim();
}

interface VoucherPurchaseShape {
  status?: string;
  paidAt?: { toMillis?: () => number; _seconds?: number; seconds?: number };
  amountPaid?: number;
  voucherCount?: number;
  userId?: string;
  userName?: string;
}

function tsToMs(ts: VoucherPurchaseShape['paidAt']): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  const sec = ts._seconds ?? ts.seconds ?? 0;
  return sec * 1000;
}

export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────
  const expected = process.env.N8N_API_KEY;
  if (!expected) {
    return NextResponse.json(
      { error: 'N8N_API_KEY not configured on server' },
      { status: 500 },
    );
  }
  const url = new URL(req.url);
  const headerKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const queryKey = url.searchParams.get('key');
  const supplied = headerKey || queryKey;
  if (!supplied || supplied !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Date ──────────────────────────────────────────────────
  const dateParam = url.searchParams.get('date');
  const today = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : todayInKL();
  const tomorrow = shiftDate(today, 1);

  try {
    const db = await getDb();

    // Pull a single full snapshot of orders. The orders collection is
    // small (~thousands lifetime) so one scan beats stitching multiple
    // indexed queries for today/tomorrow/first-order-per-user.
    const [ordersSnap, mvpSnap] = await Promise.all([
      db.collection('orders').get(),
      db.collection('mealVoucherPurchases').where('status', '==', 'paid').get(),
    ]);

    const allOrders: OrderShape[] = ordersSnap.docs.map(d => d.data() as OrderShape);
    const validOrders = allOrders.filter(o => o.status !== 'cancelled');

    const todayOrders = validOrders.filter(o => o.deliveryDate === today);
    const tomorrowOrders = validOrders.filter(o => o.deliveryDate === tomorrow);
    const cancelledToday = allOrders.filter(
      o => o.deliveryDate === today && o.status === 'cancelled',
    );

    // ── Today: KPIs ───────────────────────────────────────────
    const lunchCount = todayOrders.filter(isLunchOrder).length;
    const dinnerCount = todayOrders.length - lunchCount;

    const cashRevenueRM = todayOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const deliveryRevenueRM = todayOrders.reduce((s, o) => s + (Number(o.deliveryFee) || 0), 0);
    const mfrs15RevenueRM = todayOrders.reduce(
      (s, o) => s + (Number(o.total) || 0) + (Number(o.mealVoucherAllocatedRevenue) || 0),
      0,
    );

    const vouchersUsedCount = todayOrders.reduce(
      (s, o) => s + (Number(o.mealVouchersUsed) || 0),
      0,
    );
    const vouchersUsedFaceValueRM = Number((vouchersUsedCount * FACE_VALUE_RM).toFixed(2));

    const todayUserIds = new Set(todayOrders.map(o => o.userId).filter(Boolean) as string[]);
    const uniqueCustomerCount = todayUserIds.size;

    // New customer = a userId whose earliest delivered (non-cancelled)
    // order has deliveryDate == today. Uses the full snapshot above.
    const firstDeliveryByUser = new Map<string, string>();
    for (const o of validOrders) {
      if (!o.userId || !o.deliveryDate) continue;
      const prev = firstDeliveryByUser.get(o.userId);
      if (!prev || o.deliveryDate < prev) firstDeliveryByUser.set(o.userId, o.deliveryDate);
    }
    const newCustomerNames: string[] = [];
    for (const uid of todayUserIds) {
      if (firstDeliveryByUser.get(uid) === today) {
        const order = todayOrders.find(o => o.userId === uid);
        if (order?.userName) newCustomerNames.push(order.userName);
      }
    }

    // ── Today: voucher sales (NEW cash inflow, NOT a redemption) ────
    const { startMs, endMs } = dayBoundsKL(today);
    const todayVoucherPurchases = mvpSnap.docs
      .map(d => d.data() as VoucherPurchaseShape)
      .filter(p => {
        const ms = tsToMs(p.paidAt);
        return ms >= startMs && ms < endMs;
      });
    const voucherSalesCount = todayVoucherPurchases.length;
    const voucherSalesCashRM = Number(
      todayVoucherPurchases.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0).toFixed(2),
    );
    const voucherSalesNewVouchersIssued = todayVoucherPurchases.reduce(
      (s, p) => s + (Number(p.voucherCount) || 0),
      0,
    );

    // ── Tomorrow preview ────────────────────────────────────────
    const tomorrowLunch = tomorrowOrders.filter(isLunchOrder).length;
    const tomorrowDinner = tomorrowOrders.length - tomorrowLunch;
    const tomorrowCriticalNotes = collectCriticalNotes(tomorrowOrders);

    // ── Pre-formatted single-line summary strings ───────────────
    // WhatsApp template variables can't contain newlines/tabs/5+ spaces,
    // so we ship ready-to-drop strings the n8n Code node won't need to
    // re-format.
    const fmtRM = (n: number) => `RM ${n.toFixed(2)}`;
    const todaySummary = scrubForTemplate(
      `📦 ${todayOrders.length} 单（午 ${lunchCount} / 晚 ${dinnerCount}）` +
        ` ｜现金 ${fmtRM(cashRevenueRM + deliveryRevenueRM)}` +
        (vouchersUsedCount > 0 ? ` ｜餐券抵 ${vouchersUsedCount} 张` : '') +
        (cancelledToday.length > 0 ? ` ｜取消 ${cancelledToday.length}` : ''),
    );
    const voucherSalesSummary = voucherSalesCount > 0
      ? scrubForTemplate(
          `💳 卖出 ${voucherSalesCount} 笔 ${voucherSalesNewVouchersIssued} 张` +
            ` ｜收 ${fmtRM(voucherSalesCashRM)}`,
        )
      : '无';
    const customerSummary = scrubForTemplate(
      `👥 ${uniqueCustomerCount} 位` +
        (newCustomerNames.length > 0
          ? ` ｜🌟 新客 ${newCustomerNames.length}：${newCustomerNames.join('、')}`
          : ''),
    );
    const tomorrowSummary = scrubForTemplate(
      tomorrowOrders.length === 0
        ? `📅 ${tomorrow}：暂无订单`
        : `📅 ${tomorrow}：${tomorrowOrders.length} 单（午 ${tomorrowLunch} / 晚 ${tomorrowDinner})` +
            (tomorrowCriticalNotes.length > 0 ? ` ｜⚠️ 关键备注 ${tomorrowCriticalNotes.length} 条` : ''),
    );

    return NextResponse.json({
      today,
      tomorrow,
      // — today KPIs
      orderCount: todayOrders.length,
      lunchCount,
      dinnerCount,
      cancelledCount: cancelledToday.length,
      cashRevenueRM: Number(cashRevenueRM.toFixed(2)),
      deliveryRevenueRM: Number(deliveryRevenueRM.toFixed(2)),
      mfrs15RevenueRM: Number(mfrs15RevenueRM.toFixed(2)),
      vouchersUsedCount,
      vouchersUsedFaceValueRM,
      // — voucher sales today (cash inflow, not redemption)
      voucherSalesCount,
      voucherSalesCashRM,
      voucherSalesNewVouchersIssued,
      // — customers
      uniqueCustomerCount,
      newCustomerCount: newCustomerNames.length,
      newCustomerNames,
      // — tomorrow preview
      tomorrowOrderCount: tomorrowOrders.length,
      tomorrowLunchCount: tomorrowLunch,
      tomorrowDinnerCount: tomorrowDinner,
      tomorrowCriticalNoteCount: tomorrowCriticalNotes.length,
      tomorrowCriticalNotes,
      tomorrowCriticalNotesText: tomorrowCriticalNotes.length
        ? scrubForTemplate(tomorrowCriticalNotes.map(n => `⚠️ ${n}`).join('；'))
        : '无',
      // — pre-formatted summary strings (drop straight into template params)
      todaySummary,
      voucherSalesSummary,
      customerSummary,
      tomorrowSummary,
    });
  } catch (err) {
    console.error('[n8n/daily-recap] fetch failed:', err);
    const msg = err instanceof Error ? err.message : 'Failed to fetch recap';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
