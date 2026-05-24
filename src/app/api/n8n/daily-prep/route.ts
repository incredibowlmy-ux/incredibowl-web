import { NextRequest, NextResponse } from 'next/server';
import { getRecipeForDish, getAddOnRecipe, IngredientLine } from '@/data/dishIngredients';

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

// Build per-order detail for the "BowlMama 早安" Telegram message. Pairs
// each main dish with its own add-ons (instead of the all-day aggregate
// view summaryText produces) so BowlMama can pack each box without
// cross-referencing the cart UI.
//
// Add-on attribution:
//   - Web cart flow: ↳-prefixed items are siblings of the main they
//     attach to AND appear directly after it in items[]. We track the
//     "current main" and append ↳ rows to it as we walk the array.
//   - Manual entry: addOns is a real nested array on the main item.
//
// Delivery time: stripped of "Lunch "/"Dinner "/"午 "/"晚 " prefix because
// the meal section header already conveys lunch/dinner.
//
// Output ordersText contains embedded newlines (one block per order) —
// only safe to feed into a Telegram message body, NOT into a WhatsApp
// template parameter slot. WA workflow uses summaryText (single line)
// instead.
interface OrderMain {
  name: string;
  qty: number;
  addOns: { name: string; qty: number }[];
}
interface OrderSummary {
  userName: string;
  deliveryTime: string;
  mains: OrderMain[];
}
function summarizeOrders(orders: FirestoreOrder[]): {
  orders: OrderSummary[];
  ordersText: string;
} {
  const formatTime = (t: string) =>
    t.replace(/^(lunch|dinner)\s*/i, '').replace(/^(午|晚)\s*/, '').trim();

  const summaries: OrderSummary[] = [];
  for (const o of orders) {
    const mains: OrderMain[] = [];
    let current: OrderMain | null = null;
    for (const it of o.items || []) {
      const qty = it.quantity || 0;
      if (qty <= 0) continue;
      if (isAddOnItem(it.name)) {
        // Web flat format — append to most recent main. If a ↳ row arrives
        // before any main (shouldn't happen but defensive), silently drop
        // rather than throw — daily-prep brief should never 500.
        if (current) {
          current.addOns.push({ name: stripAddOnPrefix(it.name), qty });
        }
      } else {
        current = { name: it.name, qty, addOns: [] };
        for (const a of it.addOns || []) {
          const label = a.label || a.name || a.id || '加料';
          const aQty = a.quantity || 0;
          if (aQty > 0) current.addOns.push({ name: label, qty: aQty });
        }
        mains.push(current);
      }
    }
    summaries.push({
      userName: o.userName || '客户',
      deliveryTime: o.deliveryTime || '',
      mains,
    });
  }

  if (summaries.length === 0) {
    return { orders: [], ordersText: '无' };
  }

  const lines: string[] = [];
  summaries.forEach((s, idx) => {
    const time = formatTime(s.deliveryTime);
    lines.push(`${idx + 1}. ${s.userName}${time ? ` · ${time}` : ''}`);
    for (const m of s.mains) {
      lines.push(`   • ${m.name}${m.qty > 1 ? ` ×${m.qty}` : ''}`);
      for (const a of m.addOns) {
        lines.push(`     + ${a.name}${a.qty > 1 ? ` ×${a.qty}` : ''}`);
      }
    }
    if (idx < summaries.length - 1) lines.push('');
  });
  return { orders: summaries, ordersText: lines.join('\n') };
}

// Aggregate raw ingredient quantities across all of today's orders, so
// BowlMama gets a procurement list ("鸡胸肉 1.2kg；蛋 7 颗") instead of
// having to mentally multiply each dish × portion × add-on adjustments.
//
// Returns a single all-day list (not split by lunch/dinner) because
// procurement happens once a day — the dish-level summaryText already
// gives the meal split, this is the buy-once-cook-twice view.
//
// Resilient to missing recipes: dishes without a recipe entry in
// dishIngredients.ts are silently skipped. Adding a recipe later
// automatically picks up retroactively — no migration needed.
//
// Units: groups by (name, unit) tuple. Same ingredient with two units
// (e.g. "鸡胸肉 g" vs "鸡胸肉 块") stays separate intentionally — both
// reflect how BowlMama actually procures.
//
// Output formatting: weight-style units (g / ml) auto-convert to kg / L
// once over 1000, because "1.2kg" reads faster than "1200g" on a phone.
function aggregateIngredients(orders: FirestoreOrder[]): {
  lines: { name: string; qty: number; unit: string }[];
  text: string;
} {
  // Key by `${name} ${unit}` so duplicate ingredient names with
  // different units don't collide.
  const counts = new Map<string, { name: string; qty: number; unit: string }>();
  const bump = (line: IngredientLine, multiplier: number) => {
    const key = `${line.name} ${line.unit}`;
    const cur = counts.get(key);
    if (cur) cur.qty += line.qty * multiplier;
    else counts.set(key, { name: line.name, qty: line.qty * multiplier, unit: line.unit });
  };

  for (const o of orders) {
    for (const it of o.items || []) {
      const qty = it.quantity || 0;
      if (qty <= 0) continue;
      if (isAddOnItem(it.name)) {
        const recipe = getAddOnRecipe(stripAddOnPrefix(it.name));
        if (recipe) recipe.forEach(line => bump(line, qty));
      } else {
        const dishRecipe = getRecipeForDish(it.name);
        if (dishRecipe) dishRecipe.ingredients.forEach(line => bump(line, qty));
        // Nested add-ons on the same row (manual order schema)
        for (const a of it.addOns || []) {
          const label = a.label || a.name || a.id || '';
          const aQty = a.quantity || 0;
          if (!label || aQty <= 0) continue;
          const addOnRecipe = getAddOnRecipe(label);
          if (addOnRecipe) addOnRecipe.forEach(line => bump(line, aQty));
        }
      }
    }
  }

  // Format each line. Weight units auto-promote to kg / L over 1000 so
  // BowlMama's eye lands on the magnitude faster.
  const formatQty = (qty: number, unit: string): string => {
    if (unit === 'g' && qty >= 1000) return `${(qty / 1000).toFixed(qty % 1000 === 0 ? 0 : 2)}kg`;
    if (unit === 'ml' && qty >= 1000) return `${(qty / 1000).toFixed(qty % 1000 === 0 ? 0 : 2)}L`;
    // Drop trailing .00 for cleaner display
    const rounded = Number(qty.toFixed(2));
    const str = Number.isInteger(rounded) ? String(rounded) : rounded.toString();
    return `${str}${unit}`;
  };

  const lines = Array.from(counts.values())
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  const text = lines.length === 0
    ? '无'
    : lines.map(l => `${l.name} ${formatQty(l.qty, l.unit)}`).join('；');

  return { lines, text };
}

// Drop admin bookkeeping markers like "手动录入 · whatsapp" so the
// WhatsApp brief to BowlMama only carries real cooking-relevant requests.
// If a customer requirement is ever co-mingled into the same note string
// it will also be dropped — that's a deliberate forcing function to keep
// admin tags and customer asks in separate fields.
const isAdminBookkeepingNote = (note: string) => /手动录入/.test(note);

// Notes a missed instruction would actually hurt the customer: allergies,
// hard "don't" constraints, vegetarian / dietary, urgency. Keep this list
// tight — every false-positive trains BowlMama to ignore the ⚠️ flag.
// Anything matching here gets surfaced FIRST in notesText with a ⚠️
// prefix so it survives a glance-read on a phone.
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

function collectNotes(orders: FirestoreOrder[]): {
  notes: string[];
  notesText: string;
  criticalNotes: string[];
  regularNotes: string[];
} {
  const criticalNotes: string[] = [];
  const regularNotes: string[] = [];
  const push = (line: string, body: string) => {
    (isCriticalNote(body) ? criticalNotes : regularNotes).push(line);
  };
  for (const o of orders) {
    const who = o.userName || '客户';
    if (o.note && !isAdminBookkeepingNote(o.note)) {
      push(`${who}：${o.note}`, o.note);
    }
    for (const it of o.items || []) {
      if (it.note && !isAdminBookkeepingNote(it.note)) {
        // Strip ↳ prefix so "Andrea（白饭换糙米）" reads cleaner than
        // "Andrea（↳ 白饭换糙米）" in case an add-on carries a note.
        push(`${who}（${stripAddOnPrefix(it.name)}）：${it.note}`, it.note);
      }
    }
  }
  // Critical first, each prefixed ⚠️ so a quick scan of the phone notification
  // catches allergy / dietary constraints without expanding the message.
  const criticalLines = criticalNotes.map(n => `⚠️ ${n}`);
  const notes = [...criticalLines, ...regularNotes];
  return {
    notes,
    notesText: notes.length ? notes.join('；') : '无',
    criticalNotes,
    regularNotes,
  };
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

    const ingredients = aggregateIngredients(allOrders);
    const lunchSummary = summarizeOrders(lunchOrders);
    const dinnerSummary = summarizeOrders(dinnerOrders);

    return NextResponse.json({
      date,
      totalOrders: allOrders.length,
      lunch: {
        ...aggregate(lunchOrders),
        orders: lunchSummary.orders,
        ordersText: lunchSummary.ordersText,
      },
      dinner: {
        ...aggregate(dinnerOrders),
        orders: dinnerSummary.orders,
        ordersText: dinnerSummary.ordersText,
      },
      ...collectNotes(allOrders),
      ingredients: ingredients.lines,
      ingredientText: ingredients.text,
    });
  } catch (err) {
    console.error('[n8n/daily-prep] fetch failed:', err);
    const msg = err instanceof Error ? err.message : 'Failed to fetch orders';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
