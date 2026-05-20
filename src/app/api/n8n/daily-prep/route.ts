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

// Classify a delivery time string as lunch vs dinner.
//   1. explicit mealType field (set by manual orders from local dashboard) wins
//   2. "dinner"/"晚" keyword → dinner
//   3. "lunch"/"午"  keyword → lunch
//   4. HH:MM with hour >= 17 → dinner
//   5. anything else         → lunch (default for ambiguous / empty)
// KEEP IN SYNC with splitMealTime() in src/app/admin/page.tsx.
function isLunchOrder(o: { deliveryTime?: string; mealType?: 'lunch' | 'dinner' | null }): boolean {
  if (o.mealType === 'lunch') return true;
  if (o.mealType === 'dinner') return false;
  const t = (o.deliveryTime || '').toLowerCase();
  if (t.includes('dinner') || t.includes('晚')) return false;
  if (t.includes('lunch') || t.includes('午')) return true;
  const m = t.match(/(\d{1,2}):\d{2}/);
  if (m && parseInt(m[1], 10) >= 17) return false;
  return true;
}

// Orders come in two shapes:
//   (A) web cart: flat items[], add-ons are own rows with "↳ <name>" prefix
//   (B) local dashboard manual entry: items[i].addOns = [{id,label,price,quantity}]
//       — main dish stays a regular item, add-ons live in a nested array.
// We handle both: ↳-prefixed flat rows go into the add-on bucket, AND any
// nested addOns array on a main item also goes into the add-on bucket.
interface FirestoreOrderItemAddOn {
  id?: string;
  label?: string;
  name?: string;
  price?: number;
  quantity?: number;
}
interface FirestoreOrderItem {
  name: string;
  quantity: number;
  note?: string;
  addOns?: FirestoreOrderItemAddOn[];
}
interface FirestoreOrder {
  userName?: string;
  deliveryTime?: string;
  mealType?: 'lunch' | 'dinner' | null;
  isManual?: boolean;
  status?: string;
  items?: FirestoreOrderItem[];
  note?: string;
}

// Web cart flow stores add-ons as items with name prefix "↳ " so they
// appear indented under the main dish in admin views. We separate them
// here so BowlMama's brief surfaces customizations (糙米 / 少饭) as a
// distinct "加料" section instead of mixing into the main dish list.
const isAddOnItem = (name: string) => /^↳/.test(name);
const stripAddOnPrefix = (name: string) => name.replace(/^↳\s*/, '');

function aggregate(orders: FirestoreOrder[]): {
  count: number;
  mains: [string, number][];
  addOns: [string, number][];
  items: [string, number][];
  summaryText: string;
} {
  const mainCounts: Record<string, number> = {};
  const addOnCounts: Record<string, number> = {};
  for (const o of orders) {
    for (const it of o.items || []) {
      const qty = it.quantity || 0;
      if (isAddOnItem(it.name)) {
        // Web flat format: ↳-prefixed row is itself an add-on.
        const key = stripAddOnPrefix(it.name);
        addOnCounts[key] = (addOnCounts[key] || 0) + qty;
      } else {
        mainCounts[it.name] = (mainCounts[it.name] || 0) + qty;
        // Manual nested format: walk the addOns array attached to this main.
        for (const a of it.addOns || []) {
          const label = a.label || a.name || a.id || '加料';
          const aQty = a.quantity || 0;
          if (aQty > 0) {
            addOnCounts[label] = (addOnCounts[label] || 0) + aQty;
          }
        }
      }
    }
  }
  const mains = Object.entries(mainCounts).sort((a, b) => b[1] - a[1]);
  const addOns = Object.entries(addOnCounts).sort((a, b) => b[1] - a[1]);
  const fmt = (arr: [string, number][]) => arr.map(([n, q]) => `${n} ×${q}`).join('，');

  let summaryText: string;
  if (mains.length === 0 && addOns.length === 0) {
    summaryText = '无';
  } else {
    const mainPart = mains.length ? fmt(mains) : '';
    const addOnPart = addOns.length ? `${mains.length ? ' ｜' : ''}加料：${fmt(addOns)}` : '';
    summaryText = mainPart + addOnPart;
  }

  return {
    count: orders.length,
    mains,
    addOns,
    items: mains.concat(addOns), // backward-compat: combined list
    summaryText,
  };
}

// Drop admin bookkeeping markers like "手动录入 · whatsapp" so the
// WhatsApp brief to BowlMama only carries real cooking-relevant requests.
// If a customer requirement is ever co-mingled into the same note string
// it will also be dropped — that's a deliberate forcing function to keep
// admin tags and customer asks in separate fields.
const isAdminBookkeepingNote = (note: string) => /手动录入/.test(note);

function collectNotes(orders: FirestoreOrder[]): { notes: string[]; notesText: string } {
  const notes: string[] = [];
  for (const o of orders) {
    const who = o.userName || '客户';
    if (o.note && !isAdminBookkeepingNote(o.note)) {
      notes.push(`${who}：${o.note}`);
    }
    for (const it of o.items || []) {
      if (it.note && !isAdminBookkeepingNote(it.note)) {
        // Strip ↳ prefix so "Andrea（白饭换糙米）" reads cleaner than
        // "Andrea（↳ 白饭换糙米）" in case an add-on carries a note.
        notes.push(`${who}（${stripAddOnPrefix(it.name)}）：${it.note}`);
      }
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
