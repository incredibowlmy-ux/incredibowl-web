import { NextRequest, NextResponse } from 'next/server';
import { weeklyMenu, MenuItem, dishVoucherValue } from '@/data/weeklyMenu';
import { isDishBlockedOn, isDateClosed } from '@/data/blockedDates';
import { dishRecipes } from '@/data/dishIngredients';
import { COVERAGE_AREAS } from '@/lib/deliveryCopy';
import { PAYMENT_METHODS, PAYMENT_METHODS_EN, PAYMENT_TEXT_ZH, PAYMENT_TEXT_EN } from '@/lib/paymentCopy';
import {
  MEAL_VOUCHER_BUNDLES, FACE_VALUE_RM, bundleRedeemSavings, formatPercent,
} from '@/data/mealVoucherConfig';

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

const WD_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** English mirror of menuLine —— 客流是中英混，bot 的英文剧本直接引用这一段。 */
function menuLineEn(
  dish: MenuItem,
  kind: 'staple' | 'special',
  wd: number,
  remaining: number | undefined,
): string {
  const prefix = kind === 'staple' ? '·' : `· ${WD_EN[wd]} special: `;
  const low = typeof remaining === 'number' && remaining > 0 && remaining <= 5
    ? ` (only ${remaining} left today)` : '';
  return `${prefix}${kind === 'staple' ? ' ' : ''}${dish.nameEn} RM${dish.price.toFixed(2)}${low}`;
}

/**
 * 逐道菜的成分名单（给 bot 回答「有没有猪肉 / 有蛋吗」）。
 *
 * ⚠️ 数据源 dishIngredients.ts 是**采购表**，文件头明写「跳过盐/胡椒/食用油/大蒜」，
 * 也不追踪交叉污染。所以它能支持「结构性成分」问答（有没有猪肉/牛肉/蛋/海鲜——
 * 宗教与口味回避），**绝不能当过敏原声明用**（花生/麸质/坚果一律要人工确认）。
 * 这条边界同时写进 API 返回的 ingredients_note 和 bot 的 system prompt，
 * 让它跟着数据一起走，而不是只活在某个人的记忆里。
 */
const RECIPE_BY_NAME = new Map(dishRecipes.map(r => [r.name, r]));
function ingredientNames(dish: MenuItem): string[] {
  const r = RECIPE_BY_NAME.get(dish.name);
  if (!r || !r.ingredients.length) return [];
  return r.ingredients.map(i => i.name);
}

const INGREDIENTS_NOTE =
  '这份成分表来自厨房采购单，只列主要食材（盐/胡椒/食用油/蒜等常备调料未列出），'
  + '也没有追踪交叉污染。可以用来回答「有没有猪肉/牛肉/蛋/海鲜」这类问题；'
  + '客户一提「过敏」两个字，一律 [求救老板]，绝不自行判断能不能吃。';

/** 碗妈 bot 发给客户的一键下单链接。ref=wa 用于归因，lead 由 n8n 拼上去。 */
const ORDER_BASE = 'https://www.incredibowl.my/o';
function orderUrl(dishId: number | null, locale: 'zh' | 'en'): string {
  const path = locale === 'en' ? 'https://www.incredibowl.my/en/o' : ORDER_BASE;
  const qs = dishId === null ? 'ref=wa' : `d=${dishId}&ref=wa`;
  return `${path}?${qs}`;
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

  // 配送情境文案：中英必须**同源同语义**。曾经英文侧硬编码「Orders close 6:00 AM
  // daily」而中文走这里的情境判断 —— 结果周末的英文客户被告知截单时间，却不知道
  // 要等到周一。凡是会被 bot 原样念给客户的句子，两种语言都在这里生成。
  let deliveryContext: string;
  let deliveryContextEn: string;
  if (isWeekendOrder) {
    deliveryContext = `今天是周末,碗妈休息。下单后${dayName}送达。`;
    deliveryContextEn = `It's the weekend — BowlMama rests. Order now and it arrives ${WD_EN[wd]}.`;
  } else if (isAfterCutoff || daysAhead > 0) {
    deliveryContext = `已过早上6点截单,下单${dayName}配送。`;
    deliveryContextEn = `Today's 6:00 AM cut-off has passed — order now for ${WD_EN[wd]} delivery.`;
  } else {
    deliveryContext = `还没截单,下单今天就能送到。`;
    deliveryContextEn = `Still before the 6:00 AM cut-off — order now and it arrives today.`;
  }
  if (closedSkipped) {
    deliveryContext += `（${closedSkipped} 当天暂停接单,已顺延。）`;
    deliveryContextEn += ` (We're closed on ${closedSkipped}, so it rolls forward.)`;
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

  // ── 短版：**只有能点的菜**，给 bot 的新客第一条消息用 ────────
  // 长版 today_menu 尾部会挂「暂别中」（现在有 10 道）——那对一个刚点进来、
  // 只想知道"今天能吃什么"的新客是纯噪音，一屏刷满全是吃不到的菜名。
  // 客服问答仍然用长版（客户问「XX 还有吗」要答得出来）。
  const shortLines: string[] = [];
  for (const d of orderableStaples) shortLines.push(menuLine(d, 'staple', wd, remainingOf(d)));
  for (const d of orderableSpecials) shortLines.push(menuLine(d, 'special', wd, remainingOf(d)));
  const todayMenuShort = shortLines.join('\n');

  // ── 英文版菜单块（客流中英混，bot 按客户语言二选一）──────
  const linesEn: string[] = ['Available every day:'];
  for (const d of orderableStaples) linesEn.push(menuLineEn(d, 'staple', wd, remainingOf(d)));
  for (const d of orderableSpecials) linesEn.push(menuLineEn(d, 'special', wd, remainingOf(d)));
  if (soldOut.length) {
    linesEn.push(`Sold out today: ${soldOut.map(d => d.nameEn).join(', ')}`);
  }
  const todayMenuEn = linesEn.join('\n');
  const shortLinesEn: string[] = [];
  for (const d of orderableStaples) shortLinesEn.push(menuLineEn(d, 'staple', wd, remainingOf(d)));
  for (const d of orderableSpecials) shortLinesEn.push(menuLineEn(d, 'special', wd, remainingOf(d)));
  const todayMenuShortEn = shortLinesEn.join('\n');

  const dishJson = (d: MenuItem, kind: 'staple' | 'special') => ({
    id: d.id,
    name: d.name,
    nameEn: d.nameEn,
    price: d.price,
    voucherTopUp: d.voucherTopUp ?? 0,
    kind,
    remaining: remainingOf(d) ?? null, // null = unlimited
    soldOut: isSoldOut(d),
    // 一键下单链接：bot 直接发，不用自己拼 URL（拼错就是死链）
    orderUrl: orderUrl(d.id, 'zh'),
    orderUrlEn: orderUrl(d.id, 'en'),
    // 主要食材（边界见 ingredients_note）
    ingredients: ingredientNames(d),
  });

  // ── 包伙食（餐券预付包）——— bot 要能介绍并卖 ─────────────
  //
  // ⚠️ 折扣率**必须现算，绝不写死**。一张券真正的价值是「最多能兑掉多少钱的菜」，
  // 换菜之后这个数会变；写死的百分比某天就变成谎话。算法与 /meal-vouchers 页
  // 逐字同源（bestVoucherValue → bundleRedeemSavings），换菜自动跟上。
  // 同时口径必须是「**最高**省 X%」—— 只在兑最贵那道可兑主菜时成立。
  const bestVoucherValue = Math.max(
    FACE_VALUE_RM,
    ...live.map(d => dishVoucherValue(d.price, d)),
  );
  const voucherBundles = MEAL_VOUCHER_BUNDLES.map(b => {
    const s = bundleRedeemSavings(b, bestVoucherValue);
    return {
      id: b.id,
      count: b.voucherCount,
      price: b.price,
      pricePerVoucher: b.pricePerVoucher,
      validityDays: b.validityDays,
      highlight: b.highlight ?? '',
      maxSavePercent: formatPercent(s.percent),
      maxSaveTotal: s.total,
    };
  });
  const voucherPitch = voucherBundles
    .map(b => `· ${b.count} 张 RM${b.price.toFixed(2)}（每餐 RM${b.pricePerVoucher.toFixed(2)}，${b.validityDays} 天内用完${b.highlight ? `，${b.highlight}` : ''}）`)
    .join('\n');

  return NextResponse.json(
    {
      generated_at: new Date().toISOString(),
      // 配送覆盖区域（bot 之前只会说「Pearl Suria 一带」，答不了「送 OUG 吗」）
      coverage_areas: COVERAGE_AREAS,
      coverage_text: COVERAGE_AREAS.join(' · '),
      // 成分问答的数据边界，跟着数据一起走
      ingredients_note: INGREDIENTS_NOTE,
      // 付款方式（v4：之前只活在 v1 提示词里，v3 漏了；现在单一来源 src/lib/paymentCopy.ts）
      payment_methods: PAYMENT_METHODS,
      payment_methods_en: PAYMENT_METHODS_EN,
      payment_text: PAYMENT_TEXT_ZH,
      payment_text_en: PAYMENT_TEXT_EN,
      // 包伙食
      meal_packages: {
        name: '包伙食（餐券预付包）',
        bundles: voucherBundles,
        pitch_block: voucherPitch,
        max_save_percent: formatPercent(Math.max(0, ...voucherBundles.map(b => Number(b.maxSavePercent)))),
        buy_url: 'https://www.incredibowl.my/meal-vouchers',
        buy_url_en: 'https://www.incredibowl.my/en/meal-vouchers',
        rules: [
          '1 张券 = 1 份主餐，加料仍要现金另付',
          '餐券单不能再叠 RM 折扣码（含新客 RM5），系统会拒收——两者只能二选一',
          '折扣是「最高」值，兑越贵的菜省越多，兑便宜的菜省得少',
        ],
      },
      delivery: {
        date: deliveryDate,
        weekday: wd,
        days_ahead: daysAhead,
        is_after_cutoff: isAfterCutoff,
      },
      delivery_label: deliveryLabel,
      delivery_label_en: relative
        ? `${daysAhead === 0 ? 'today' : daysAhead === 1 ? 'tomorrow' : 'the day after'} ${WD_EN[wd]}`
        : WD_EN[wd],
      delivery_context: deliveryContext,
      delivery_context_en: deliveryContextEn,
      today_menu: todayMenu,
      today_menu_en: todayMenuEn,
      // 短版 = 只有能点的菜（新客第一条消息用）。长版留给客服问答。
      today_menu_short: todayMenuShort,
      today_menu_short_en: todayMenuShortEn,
      // 通用下单入口（没指定菜时用）—— 落在极简下单页，不是首页
      order_url: orderUrl(null, 'zh'),
      order_url_en: orderUrl(null, 'en'),
      dishes: [
        ...staples.map(d => dishJson(d, 'staple')),
        ...specials.map(d => dishJson(d, 'special')),
      ],
      paused_dishes: paused.map(d => ({ id: d.id, name: d.name, note: d.unavailableNote ?? '暂别中' })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
