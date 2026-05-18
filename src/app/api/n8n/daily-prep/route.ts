import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/n8n/daily-prep
 *
 * Read-only kitchen prep summary for the day, designed to be polled by
 * an external automation (n8n cron at 06:30 KL → WhatsApp template push
 * to BowlMama). Auth is a static bearer key from env, NOT Firebase auth,
 * because the caller is a headless workflow not a logged-in human.
 *
 * Query / headers:
 *   - Authorization: Bearer <N8N_API_KEY>   (preferred)
 *     OR
 *   - ?key=<N8N_API_KEY>                   (fallback for tools that
 *                                             can't set headers)
 *   - ?date=YYYY-MM-DD  (optional; defaults to TODAY in Asia/Kuala_Lumpur)
 *
 * Response:
 *   {
 *     date: "2026-05-18",
 *     totalOrders: 12,
 *     lunch:  { count, items: [[name,qty]...], summaryText },
 *     dinner: { count, items: [[name,qty]...], summaryText },
 *     notes: ["王太太：不要香菜", ...],
 *     notesText: "王太太：不要香菜；陈先生：少辣"
 *   }
 *
 * summaryText / notesText are pre-formatted so n8n only needs to drop
 * them into template variables — no JS munging required downstream.
 */

let adminDb: FirebaseFirestore.Firestore | null = null;
async function getDb() {
  if (adminDb) return adminDb;
  const { getAdminDb } = await import('@/lib/firebase-admin');
  adminDb = getAdminDb();
  return adminDb;
}

function todayInKL(): string {
  // en-CA locale returns YYYY-MM-DD; timeZone option does the offset for us.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function isLunchOrder(o: { deliveryTime?: string }): boolean {
  // Mirror admin/page.tsx splitMealTime: anything not explicitly dinner
  // counts as lunch (covers missing field, legacy orders, "Lunch 12pm",
  // "午餐", etc).
  const t = (o.deliveryTime || '').toLowerCase();
  return !t.includes('dinner') && !t.includes('晚');
}

interface FirestoreOrder {
  userName?: string;
  deliveryTime?: string;
  status?: string;
  items?: { name: string; quantity: number; note?: string }[];
  note?: string;
}

function aggregate(orders: FirestoreOrder[]): {
  count: number;
  items: [string, number][];
  summaryText: string;
} {
  const counts: Record<string, number> = {};
  for (const o of orders) {
    for (const it of o.items || []) {
      counts[it.name] = (counts[it.name] || 0) + (it.quantity || 0);
    }
  }
  const items = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const summaryText = items.length
    ? items.map(([name, qty]) => `• ${name} x${qty}`).join('\n')
    : '无';
  return { count: orders.length, items, summaryText };
}

function collectNotes(orders: FirestoreOrder[]): { notes: string[]; notesText: string } {
  const notes: string[] = [];
  for (const o of orders) {
    const who = o.userName || '客户';
    if (o.note) notes.push(`${who}：${o.note}`);
    for (const it of o.items || []) {
      if (it.note) notes.push(`${who}（${it.name}）：${it.note}`);
    }
  }
  return { notes, notesText: notes.length ? notes.join('；') : '无' };
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
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : todayInKL();

  // ── Fetch orders for that delivery date ────────────────────
  try {
    const db = await getDb();
    const snap = await db
      .collection('orders')
      .where('deliveryDate', '==', date)
      .get();

    const allOrders = snap.docs
      .map(d => d.data() as FirestoreOrder)
      .filter(o => o.status !== 'cancelled');

    const lunchOrders = allOrders.filter(isLunchOrder);
    const dinnerOrders = allOrders.filter(o => !isLunchOrder(o));

    return NextResponse.json({
      date,
      totalOrders: allOrders.length,
      lunch: aggregate(lunchOrders),
      dinner: aggregate(dinnerOrders),
      ...collectNotes(allOrders),
    });
  } catch (err) {
    console.error('[n8n/daily-prep] fetch failed:', err);
    const msg = err instanceof Error ? err.message : 'Failed to fetch orders';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
