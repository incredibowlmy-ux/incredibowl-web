import { NextRequest, NextResponse } from 'next/server';
import { getDishShortName, getAddOnShortName } from '@/data/dishIngredients';
import { aggregateIngredients, isLunchOrder } from '@/lib/prepIngredients';
import { isCriticalNote, isAdminBookkeepingNote, isStaleFpxPending } from '@/lib/n8nNoteUtils';

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
  userAddress?: string;
  userPhone?: string;
  deliveryTime?: string;
  mealType?: 'lunch' | 'dinner' | null;
  isManual?: boolean;
  status?: string;
  paymentMethod?: 'qr' | 'fpx' | 'curlec' | 'voucher';
  /** Firestore Timestamp serialized — admin SDK returns this with _seconds/_nanoseconds. */
  createdAt?: { _seconds?: number; seconds?: number };
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
  userAddress: string;
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
      userAddress: (o.userAddress || '').trim(),
      deliveryTime: o.deliveryTime || '',
      mains,
    });
  }

  if (summaries.length === 0) {
    return { orders: [], ordersText: '无' };
  }

  // Card-per-order layout (table-like row borders for mobile). Each
  // order becomes a visually distinct block separated by ━━━ so BowlMama
  // can scan rows like she scans her notebook:
  //
  //   ━━━━━━━━━━━━━━━━━━━━
  //   #1  ·  12:00
  //   👤 KL Leong
  //   📍 316 Taman Desa
  //   🍱 1) 香煎金黄鸡扒饭 ×4
  //         + 白饭换糙米
  //
  // The leading row of ━ chars renders consistently in Telegram across
  // iOS / Android / web — better than <table> (Telegram HTML doesn't
  // support table tags) or <pre> (Chinese chars in monospace align badly).
  const sep = '━━━━━━━━━━━━━━━━━━━━';
  const lines: string[] = [];
  summaries.forEach((s, idx) => {
    if (idx > 0) lines.push('');
    lines.push(sep);
    const time = formatTime(s.deliveryTime);
    lines.push(`#${idx + 1}${time ? `  ·  ${time}` : ''}`);
    lines.push(`👤 ${s.userName}`);
    if (s.userAddress) {
      lines.push(`📍 ${s.userAddress}`);
    }
    s.mains.forEach((m, mIdx) => {
      const lead = mIdx === 0 ? '🍱 ' : '    ';
      lines.push(`${lead}${mIdx + 1}) ${m.name}${m.qty > 1 ? ` ×${m.qty}` : ''}`);
      for (const a of m.addOns) {
        lines.push(`       + ${a.name}${a.qty > 1 ? ` ×${a.qty}` : ''}`);
      }
    });
  });
  return { orders: summaries, ordersText: lines.join('\n') };
}

// Excel-style pivot matrix BowlMama can scan at a glance:
//   - rows = customers (one per order)
//   - cols = dishes (only those ordered today, sorted by popularity)
//   - cells = quantity (×N) or '·' placeholder
//   - last col = aggregated add-ons for that customer (comma-joined)
//
// Output is space-aligned monospace TEXT. Caller wraps in <pre> for
// Telegram so the alignment renders. Chinese characters count as 2 visual
// cells, ASCII as 1 — we measure visualWidth() and pad accordingly.
//
// Header style:
//   客户        鸡扒  山药  花肉  加料
//   KL Leong    ×4    ·     ·     糙米
//   Andrea      ·     ×1    ·     西兰花炒蛋
function visualWidth(s: string): number {
  let w = 0;
  for (const c of s) {
    const code = c.codePointAt(0) || 0;
    // CJK Unified Ideographs + Compat + Symbols + Fullwidth + Hangul ranges
    if ((code >= 0x4E00 && code <= 0x9FFF) ||
        (code >= 0x3400 && code <= 0x4DBF) ||
        (code >= 0xFF00 && code <= 0xFFEF) ||
        (code >= 0x3000 && code <= 0x303F) ||
        (code >= 0x2E80 && code <= 0x2FFF)) {
      w += 2;
    } else {
      w += 1;
    }
  }
  return w;
}
function padRight(s: string, w: number): string {
  return s + ' '.repeat(Math.max(0, w - visualWidth(s)));
}

function buildOrderMatrix(orders: FirestoreOrder[]): string {
  if (orders.length === 0) return '无';

  // Walk each order, accumulating dish counts (by shortName) and add-on
  // counts (also by shortName, so same add-on across multiple parent
  // dishes collapses into one "糙米×2" instead of "糙米, 糙米").
  type Row = { name: string; counts: Record<string, number>; addOns: Record<string, number> };
  const rows: Row[] = [];
  const dishTotals: Record<string, number> = {};

  for (const o of orders) {
    const counts: Record<string, number> = {};
    const addOnCounts: Record<string, number> = {};
    for (const it of o.items || []) {
      const qty = it.quantity || 0;
      if (qty <= 0) continue;
      if (isAddOnItem(it.name)) {
        const short = getAddOnShortName(stripAddOnPrefix(it.name));
        addOnCounts[short] = (addOnCounts[short] || 0) + qty;
      } else {
        const short = getDishShortName(it.name);
        counts[short] = (counts[short] || 0) + qty;
        dishTotals[short] = (dishTotals[short] || 0) + qty;
        for (const a of it.addOns || []) {
          const rawLabel = a.label || a.name || a.id || '加料';
          const aQty = a.quantity || 0;
          if (aQty > 0) {
            const short = getAddOnShortName(rawLabel);
            addOnCounts[short] = (addOnCounts[short] || 0) + aQty;
          }
        }
      }
    }
    rows.push({ name: o.userName || '客户', counts, addOns: addOnCounts });
  }

  // Dish columns sorted by total quantity desc (most-ordered first).
  const dishes = Object.keys(dishTotals).sort((a, b) => dishTotals[b] - dishTotals[a]);
  if (dishes.length === 0) return '无';

  // Render each row's add-ons as "name×N" tokens (×N suffix only when > 1),
  // joined by ", ". Empty addOns → '·' placeholder.
  const formatAddOns = (m: Record<string, number>): string => {
    const entries = Object.entries(m);
    if (entries.length === 0) return '·';
    return entries.map(([n, q]) => (q > 1 ? `${n}×${q}` : n)).join(', ');
  };
  const renderedAddOns: string[] = rows.map(r => formatAddOns(r.addOns));
  const hasAddOns = renderedAddOns.some(s => s !== '·');

  // Column widths. Dish cols min 4 visual cells (= 2 CJK or 4 ASCII).
  const nameW = Math.max(visualWidth('客户'), ...rows.map(r => visualWidth(r.name)));
  const dishW: Record<string, number> = {};
  for (const d of dishes) {
    const cellWidths = rows.map(r => visualWidth(r.counts[d] ? `×${r.counts[d]}` : '·'));
    dishW[d] = Math.max(visualWidth(d), 4, ...cellWidths);
  }
  const addOnW = hasAddOns
    ? Math.max(visualWidth('加料'), ...renderedAddOns.map(visualWidth))
    : 0;

  const headerCells: string[] = [padRight('客户', nameW)];
  for (const d of dishes) headerCells.push(padRight(d, dishW[d]));
  if (hasAddOns) headerCells.push(padRight('加料', addOnW));

  const rowLines = rows.map((r, idx) => {
    const cells: string[] = [padRight(r.name, nameW)];
    for (const d of dishes) {
      const c = r.counts[d];
      cells.push(padRight(c ? `×${c}` : '·', dishW[d]));
    }
    if (hasAddOns) cells.push(renderedAddOns[idx]);
    return cells.join('  ');
  });

  return [headerCells.join('  '), ...rowLines].join('\n');
}

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

    const nowMs = Date.now();
    const allOrders = snap.docs
      .map(d => d.data() as FirestoreOrder)
      .filter(o => o.status !== 'cancelled' && !isStaleFpxPending(o, nowMs));

    const lunchOrders = allOrders.filter(isLunchOrder);
    const dinnerOrders = allOrders.filter(o => !isLunchOrder(o));

    // Aggregate per-meal so BowlMama can prep lunch and dinner separately.
    // Total (allOrders) kept for the procurement-trip view, since she shops
    // once a day with the combined list.
    const lunchIngredients = aggregateIngredients(lunchOrders);
    const dinnerIngredients = aggregateIngredients(dinnerOrders);
    const totalIngredients = aggregateIngredients(allOrders);
    const lunchSummary = summarizeOrders(lunchOrders);
    const dinnerSummary = summarizeOrders(dinnerOrders);

    return NextResponse.json({
      date,
      totalOrders: allOrders.length,
      lunch: {
        ...aggregate(lunchOrders),
        orders: lunchSummary.orders,
        ordersText: lunchSummary.ordersText,
        matrixText: buildOrderMatrix(lunchOrders),
        ingredients: lunchIngredients.lines,
        ingredientText: lunchIngredients.text,
      },
      dinner: {
        ...aggregate(dinnerOrders),
        orders: dinnerSummary.orders,
        ordersText: dinnerSummary.ordersText,
        matrixText: buildOrderMatrix(dinnerOrders),
        ingredients: dinnerIngredients.lines,
        ingredientText: dinnerIngredients.text,
      },
      ...collectNotes(allOrders),
      // Top-level ingredients = all-day total (backward compat + procurement view)
      ingredients: totalIngredients.lines,
      ingredientText: totalIngredients.text,
    });
  } catch (err) {
    console.error('[n8n/daily-prep] fetch failed:', err);
    const msg = err instanceof Error ? err.message : 'Failed to fetch orders';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
