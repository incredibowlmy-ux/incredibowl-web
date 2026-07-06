import { NextRequest, NextResponse } from 'next/server';
import { weeklyMenu, MenuItem } from '@/data/weeklyMenu';
import { isDishBlockedOn, isDateClosed } from '@/data/blockedDates';

/**
 * GET /api/n8n/menu
 *
 * Live "what can be ordered right now" feed for the WhatsApp chatbot
 * (n8n Context Builder). Single source of truth — derives everything from
 * weeklyMenu.ts + blockedDates.ts + Firestore dishStock, so the bot can
 * never drift from the website again (menu rotation, paused dishes,
 * sold-out stock, whole-day closures all flow through automatically).
 *
 * Returns ready-to-inject strings (today_menu / delivery_label /
 * delivery_context — same shapes the bot prompt already uses) plus a
 * structured `dishes` array for programmatic use.
 *
 * Delivery-date logic mirrors computeNextSpecial() in src/lib/nextSpecial.ts:
 * 06:00 MYT cutoff, weekends roll to Monday, CLOSED_DATES roll forward.
 *
 * Auth (same pattern as /api/n8n/daily-recap):
 *   - Authorization: Bearer <N8N_API_KEY>   (preferred)
 *     OR ?key=<N8N_API_KEY>                (fallback)
 */

let adminDb: FirebaseFirestore.Firestore | null = null;
async function getDb() {
  if (adminDb) return adminDb;
  const { getAdminDb } = await import('@/lib/firebase-admin');
  adminDb = getAdminDb();
  return adminDb;
}

const WD_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** YYYY-MM-DD from a MYT-shifted Date (read via UTC getters). */
function ymdUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Skip Sat/Sun forward to Monday (mutates and returns d). */
function skipWeekend(d: Date): Date {
  if (d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 2);
  else if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/** Tags worth surfacing inline on a menu line (spice / fatty-cut warnings). */
function warningSuffix(dish: MenuItem): string {
  const warn = dish.tags?.filter(t => /辣|偏肥|petai|臭豆/i.test(t)) ?? [];
  return warn.length ? `（${warn.join('·')}）` : '';
}

function menuLine(
  dish: MenuItem,
  kind: 'staple' | 'special',
  wd: number,
  remaining: number | undefined,
): string {
  const prefix = kind === 'staple' ? '·' : `· ${WD_CN[wd]}特餐：`;
  const topUp = dish.voucherTopUp ? `（餐券抵扣需补 RM${dish.voucherTopUp}）` : '';
  const low = typeof remaining === 'number' && remaining > 0 && remaining <= 5
    ? `（今日仅剩 ${remaining} 份）` : '';
  const body = `${dish.name} ${dish.nameEn} RM${dish.price.toFixed(2)}`;
  return kind === 'staple'
    ? `${prefix} ${body}${topUp}${warningSuffix(dish)}${low}`
    : `${prefix}${body}${topUp}${warningSuffix(dish)}${low}`;
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
  const suppliedKey = headerKey || url.searchParams.get('key');
  if (!suppliedKey || suppliedKey !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Delivery date (mirrors computeNextSpecial: MYT wall-clock via +8h shift) ──
  const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;
  const now = new Date(Date.now() + MYT_OFFSET_MS);
  const isAfterCutoff = now.getUTCHours() >= 6;
  const isWeekendOrder = now.getUTCDay() === 0 || now.getUTCDay() === 6;

  const next = new Date(now);
  next.setUTCDate(now.getUTCDate() + (isAfterCutoff ? 1 : 0));
  skipWeekend(next);

  // Whole-day closures (售罄/临时停) roll forward to the next open weekday.
  let closedSkipped: string | null = null;
  let skipSafety = 14;
  while (skipSafety-- > 0 && isDateClosed(ymdUTC(next))) {
    closedSkipped = ymdUTC(next);
    next.setUTCDate(next.getUTCDate() + 1);
    skipWeekend(next);
  }

  const wd = next.getUTCDay();
  const deliveryDate = ymdUTC(next);
  const dayName = WD_CN[wd];
  const dateStr = `${next.getUTCMonth() + 1}月${next.getUTCDate()}日`;

  const nowMid = new Date(now).setUTCHours(0, 0, 0, 0);
  const nextMid = new Date(next).setUTCHours(0, 0, 0, 0);
  const daysAhead = Math.round((nextMid - nowMid) / 86_400_000);
  const relative = daysAhead === 0 ? '今天' : daysAhead === 1 ? '明天' : daysAhead === 2 ? '后天' : '';
  const deliveryLabel = relative ? `${relative} ${dateStr}（${dayName}）` : `${dateStr}（${dayName}）`;

  let deliveryContext: string;
  if (isWeekendOrder) {
    deliveryContext = `今天是周末,碗妈休息。下单后${dayName}送达。`;
  } else if (isAfterCutoff || daysAhead > 0) {
    deliveryContext = `已过早上6点截单,下单${dayName}配送。`;
  } else {
    deliveryContext = `还没截单,下单今天就能送到。`;
  }
  if (closedSkipped) {
    deliveryContext += `（${closedSkipped} 当天暂停接单,已顺延。）`;
  }

  // ── Dish stock (fail-open: stock read error never blanks the menu) ──
  let stock: Record<string, number> = {};
  try {
    const db = await getDb();
    const { getAllDishStock } = await import('@/lib/stockUtils');
    stock = await getAllDishStock(db);
  } catch (err) {
    console.error('n8n/menu dish-stock read error (fail-open):', err);
  }
  const remainingOf = (d: MenuItem): number | undefined => stock[String(d.id)];
  const isSoldOut = (d: MenuItem) => remainingOf(d) === 0;

  // ── Orderable dishes on the delivery date ──
  const live = weeklyMenu.filter(d => !d.retired && !d.hidden);
  const staples = live.filter(d =>
    d.day === 'Daily / 常驻'
    && (!d.availableWeekdays || d.availableWeekdays.includes(wd))
    && !isDishBlockedOn(d.id, deliveryDate),
  );
  const specials = live.filter(d =>
    d.weekday === wd && !isDishBlockedOn(d.id, deliveryDate),
  );

  const orderableStaples = staples.filter(d => !isSoldOut(d));
  const orderableSpecials = specials.filter(d => !isSoldOut(d));
  const soldOut = [...staples, ...specials].filter(isSoldOut);
  const paused = weeklyMenu.filter(d => d.retired);

  // ── Ready-to-inject text block (same shape the bot prompt already uses) ──
  const lines: string[] = ['常驻菜（每天可点）：'];
  for (const d of orderableStaples) lines.push(menuLine(d, 'staple', wd, remainingOf(d)));
  for (const d of orderableSpecials) lines.push(menuLine(d, 'special', wd, remainingOf(d)));
  if (soldOut.length) {
    lines.push(`今日售罄（不可点）：${soldOut.map(d => d.name).join('、')}`);
  }
  // NOTE: today_menu is quoted VERBATIM to customers in the bot's greeting
  // template — every line here must be customer-safe (no AI instructions).
  if (paused.length) {
    lines.push(`暂别中（会回归哦）：${paused.map(d => d.name).join('、')}`);
  }
  const todayMenu = lines.join('\n');

  const dishJson = (d: MenuItem, kind: 'staple' | 'special') => ({
    id: d.id,
    name: d.name,
    nameEn: d.nameEn,
    price: d.price,
    voucherTopUp: d.voucherTopUp ?? 0,
    kind,
    remaining: remainingOf(d) ?? null, // null = unlimited
    soldOut: isSoldOut(d),
  });

  return NextResponse.json(
    {
      generated_at: new Date().toISOString(),
      delivery: {
        date: deliveryDate,
        weekday: wd,
        days_ahead: daysAhead,
        is_after_cutoff: isAfterCutoff,
      },
      delivery_label: deliveryLabel,
      delivery_context: deliveryContext,
      today_menu: todayMenu,
      dishes: [
        ...staples.map(d => dishJson(d, 'staple')),
        ...specials.map(d => dishJson(d, 'special')),
      ],
      paused_dishes: paused.map(d => ({ id: d.id, name: d.name, note: d.unavailableNote ?? '暂别中' })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
