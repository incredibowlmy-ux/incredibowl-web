'use client';

/**
 * /o —— 碗妈 WhatsApp bot / 每周菜单群发 专用的极简下单页。
 *
 * 为什么不复用首页：v2 的 0 成交诊断里，新客要打字说清 6 样信息才能下单。这一页
 * 的存在就是把那 6 样压成「点一下」。首页有 hero / 轮播 / FAQ / 订阅弹窗，对
 * 一个从 WhatsApp 点进来、只想订那一道菜的人全是干扰。
 *
 * 刻意的设计约束：
 *   · **不重写结账**。地址、支付、访客下单、优惠码、运费全部交给已经在跑的
 *     CartDrawer + /api/submit-order。这一页只负责「把购物车填好、把抽屉打开」。
 *     支付链路是全站风险最高的地方，为了一个落地页去复制它是愚蠢的。
 *   · 链接带了菜 = **购物车按链接重建**（不是追加）。客户点开必须看到碗妈报的
 *     那一单；而且 bot 先后发过两条不同链接时，追加会让客户不知不觉付两单的钱。
 *     想加菜直接在菜单上按 +，主动权留给客户。
 *
 * 2026-09-09 改成「先选送达日，再看那天的菜」（外卖预订 app 的标准结构）：
 *   · 之前按「每道菜最近能点的那天」分组，常驻菜只出现在「明天」那组，客户以为
 *     周五没纳豆 —— 老板一眼看出来。现在：横滑日期条（只列能点的日子）→ 那天的
 *     ⭐ 当日精选 + 🍚 每天都有，每道菜卡片上直接 − n +
 *   · 哪天有什么菜 = menuForDate + isDishOrderableOn，和结账 / submit-order 同一个
 *     函数，不会「页面能点、下单被拒」
 *   · 默认落点：群发链接（src=wa_weekly）→ 下周一；bot 单菜深链 → 那道菜的日子；
 *     其余 → 最近能点的一天。日期条不点也能下单，不多一步
 *   · 一单可跨天（CartDrawer 本来就分天送），已选卡上每道菜带送达日
 *
 * URL 参数（bot 拼，客户不会手输）：
 *   d=30            单道菜的 id
 *   q=2             份数（配合 d）
 *   items=30x2,31x1 多道菜
 *   meal=lunch|dinner
 *   date=YYYY-MM-DD 指定配送日（不合法/不可点则回落到该菜的最近可点日）
 *   promo=FIRST5    优惠码（默认就是 FIRST5，新客立减 RM5）
 *   ref=wa          归因来源
 *   lead=<token>    lead 点击回传用的不可枚举 token
 *   src=wa_weekly   每周群发来的：默认落在下周一
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Plus, Minus, X, ShoppingBag } from 'lucide-react';
import { type MenuItem } from '@/data/weeklyMenu';
import { useMenuRuntime } from '@/lib/useMenuRuntime';
import { menuForDate } from '@/lib/menuResolve';
import { isDinnerClosedOn, isDateClosed } from '@/data/blockedDates';
import { computeMenuDates, formatYMD, type MenuDateInfo } from '@/lib/dateUtils';
import { isDishOrderableOn, todayInMY, past6AmCutoffMY, weekdayOfYMD } from '@/lib/cartDateUtils';
import { getDishPrice } from '@/data/promoConfig';
import { useCartStore } from '@/store/cartStore';
import { calcCartTotal, calcCartCount } from '@/lib/cartUtils';
import { claimFirstOrderPromo, FIRST_ORDER_PROMO_RM } from '@/lib/firstOrderPromo';
import { setOrderAttribution } from '@/lib/orderAttribution';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

const CartDrawer = dynamic(() => import('@/components/cart/CartDrawer'), { ssr: false });
const AuthModal = dynamic(() => import('@/components/auth/AuthModal'), { ssr: false });

const LUNCH = 'Lunch (11AM-1PM)';
const DINNER = 'Dinner (5PM-8PM)';
/** 日期条最多列几天（≈ 一周半的营业日，够群发「下周」落点又不至于滑不到头）。 */
const MAX_DAYS = 8;

// 只送午餐的日子（blockedDates.DINNER_CLOSED_DATES）按天回落到午餐。这一页
// 的午/晚是整车开关，但每个 bundle 各带各的日期 —— 不按天判就会把晚市单塞进
// 购物车，客户一路填到付款才被 submit-order 拒收。
const slotOn = (date: string, wantDinner: boolean) =>
  (wantDinner && !isDinnerClosedOn(date) ? DINNER : LUNCH);

const WD_ZH = ['日', '一', '二', '三', '四', '五', '六'];
const WD_EN_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Locale = 'zh' | 'en';

const DICT = {
  zh: {
    brand: '碗妈的厨房',
    tagline: '每天巴刹现采，家的味道送到你楼下',
    chips: ['🌿 不放味精', '🍳 每天现做', '⏰ 早上 6 点截单'],
    pickDay: '选送达日',
    today: '今天',
    tomorrow: '明天',
    wd: (d: number) => `周${WD_ZH[d]}`,
    lunch: '午餐 11:00–13:00',
    dinner: '晚餐 17:30–20:00',
    specials: (d: string) => `⭐ ${d}精选`,
    daily: '🍚 每天都有',
    noMenu: '这天碗妈还没排菜，先看看别的日子 👆',
    picked: '你的选择',
    promo: (rm: number) => `🎁 新朋友首单立减 RM${rm}，结账自动套用`,
    total: '合计',
    checkout: '去结账',
    portions: (n: number) => `${n} 份`,
    cutoff: '每天早上 6 点截单 · 当天现做当天送',
    unavailable: '这道菜今天不可点，帮你换成最近可点的日子了',
    missing: (names: string) => `不好意思，${names} 这天没排哦～下面是可以点的 👇`,
    missingUnnamed: '不好意思，这道菜这天没排哦～下面是可以点的 👇',
    multiDate: (n: number) => `分 ${n} 天送达，每道菜都在它的日子当天现做`,
    dayChip: (d: string) => `${d} 送`,
  },
  en: {
    brand: "BowlMama's Kitchen",
    tagline: 'Market-fresh every morning, home-cooked to your door',
    chips: ['🌿 No MSG', '🍳 Cooked daily', '⏰ Orders close 6 AM'],
    pickDay: 'Delivery day',
    today: 'Today',
    tomorrow: 'Tmrw',
    wd: (d: number) => WD_EN_SHORT[d],
    lunch: 'Lunch 11:00–13:00',
    dinner: 'Dinner 17:30–20:00',
    specials: (d: string) => `⭐ ${d} specials`,
    daily: '🍚 Every day',
    noMenu: 'Nothing scheduled for this day yet — try another day 👆',
    picked: 'Your picks',
    promo: (rm: number) => `🎁 RM${rm} off your first order — applied at checkout`,
    total: 'Total',
    checkout: 'Checkout',
    portions: (n: number) => `${n} ${n === 1 ? 'meal' : 'meals'}`,
    cutoff: 'Orders close 6:00 AM daily · cooked fresh and delivered same day',
    unavailable: 'That dish is not available today — moved to its next available date',
    missing: (names: string) => `Sorry, ${names} isn't on the menu that day. Here's what's available 👇`,
    missingUnnamed: "Sorry, that dish isn't on the menu that day. Here's what's available 👇",
    multiDate: (n: number) => `Arrives on ${n} different days — each dish cooked fresh on its own day`,
    dayChip: (d: string) => d,
  },
} as const;

interface Props { locale?: Locale }

/**
 * 菜品缩略图。
 *
 * ⚠️ weeklyMenu 的 `image` **不一定是路径** —— 这个仓库允许用 emoji 当占位图
 * （新菜还没拍照时就是这样）。直接丢给 next/image 会打出
 * `/_next/image?url=🍖` 然后 400。另外排期里的菜可能**引用了还没上传的图**
 * （2026-09-09 线上两道菜 404，卡片上露出一行 alt 字）—— onError 回落到淡化 logo，
 * 客户永远看不到破图。
 */
function DishThumb({ dish, size }: { dish?: { image?: string; name?: string } | null; size: string }) {
  const src = dish?.image || '';
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [src]);
  if (src.startsWith('/') && !broken) {
    return <Image src={src} alt="" fill sizes={size} className="object-cover" onError={() => setBroken(true)} />;
  }
  if (src && !src.startsWith('/')) {
    return <div className="w-full h-full flex items-center justify-center text-[28px] bg-gradient-to-br from-[#EEF3E6] to-[#E3EADA]" aria-hidden>{src}</div>;
  }
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#EEF3E6] to-[#E3EADA]" aria-hidden>
      <div className="relative w-1/2 h-1/2 opacity-60">
        <Image src="/logo.webp" alt="" fill sizes="42px" className="object-contain" />
      </div>
    </div>
  );
}

/** `items=30x2,31x1` / `d=30&q=2` → [{id, qty}]，非法输入静默丢弃。 */
function parseRequestedItems(params: URLSearchParams): { id: number; qty: number }[] {
  const out: { id: number; qty: number }[] = [];
  const push = (rawId: unknown, rawQty: unknown) => {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) return;
    const q = Math.floor(Number(rawQty));
    out.push({ id, qty: Number.isFinite(q) && q > 0 ? Math.min(q, 50) : 1 });
  };
  const items = params.get('items');
  if (items) {
    for (const chunk of items.split(',')) {
      const [idPart, qtyPart] = chunk.split(/x/i);
      push(idPart, qtyPart);
    }
  }
  if (params.get('d')) push(params.get('d'), params.get('q'));
  return out;
}

const addDaysYmd = (ymd: string, n: number) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
};

/**
 * 日期条：从「最近能点的一天」起，往后数 MAX_DAYS 个营业日（跳周末、跳停业日）。
 * 「最近能点」= 06:00 截单前是今天，过了是明天 —— 和 isOrderDateValid 同一条线。
 */
function orderableDays(): string[] {
  const start = addDaysYmd(todayInMY(), past6AmCutoffMY() ? 1 : 0);
  const out: string[] = [];
  for (let i = 0; i < 21 && out.length < MAX_DAYS; i++) {
    const ymd = addDaysYmd(start, i);
    const wd = weekdayOfYMD(ymd);
    if (wd === 0 || wd === 6 || isDateClosed(ymd)) continue;
    out.push(ymd);
  }
  return out;
}

/** 当日精选 = 这周排在这个 weekday 的菜 / 限日常驻菜；其余 = 每天都有。 */
const isSpecial = (d: MenuItem) => typeof d.weekday === 'number' || !!(d.availableWeekdays && d.availableWeekdays.length);

export default function QuickOrderClient({ locale = 'zh' }: Props) {
  const t = DICT[locale];
  const { cart, addBundle, updateBundle, updateQuantity, removeFromCart, clearCart } = useCartStore();

  const [ready, setReady] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [meal, setMeal] = useState<'lunch' | 'dinner'>('lunch');
  const [notice, setNotice] = useState('');
  const [promoOn, setPromoOn] = useState(false);
  const [day, setDay] = useState('');

  // 运行时排期（Firestore 权威）：version 变了日期表 / 每天的菜都重算
  const { menu: weeklyMenu, version: menuVersion } = useMenuRuntime();
  const days = useMemo(() => orderableDays(), []);
  const [dates, setDates] = useState<Record<number, MenuDateInfo>>({});
  useEffect(() => {
    const { menuDates } = computeMenuDates(weeklyMenu, locale);
    setDates(menuDates);
  }, [locale, weeklyMenu, menuVersion]);

  /** 某天能点的菜（和结账 / submit-order 同一个判定）。 */
  const dishesOn = useCallback((ymd: string) => {
    void menuVersion; // 运行时数据更新时重算
    return menuForDate(ymd).filter(d => !d.hidden && !d.retired && isDishOrderableOn(d, ymd).ok);
  }, [menuVersion]);
  const dayMenu = useMemo(() => (day ? dishesOn(day) : []), [day, dishesOn]);
  const specials = dayMenu.filter(isSpecial);
  const dailies = dayMenu.filter(d => !isSpecial(d));

  const bundleFor = useCallback((dish: MenuItem, qty: number, date: string, time: string, seq: number) => ({
    cartItemId: `${dish.id}-${Date.now()}-${seq}`,
    dish,
    dishQty: qty,
    addOns: [],
    selectedDate: date,
    selectedTime: time,
    // 与 cartRepricing / submit-order 完全一致的算法：getDishPrice × 份数
    price: getDishPrice(dish.price) * qty,
    quantity: 1,
  }), []);

  // ── 预填 + 归因 + 优惠码 + 默认落点（只跑一次，靠 query 串做幂等）────────
  useEffect(() => {
    if (Object.keys(dates).length === 0 || !days.length) return; // 等日期表算好，否则会填出 selectedDate:''
    const params = new URLSearchParams(window.location.search);
    const search = window.location.search;

    // 归因：来源 + lead token，结账时随订单一起落库
    const ref = params.get('ref') || '';
    const leadToken = params.get('lead') || '';
    if (ref || leadToken) setOrderAttribution({ ref, leadToken });

    // 点击回传：告诉后台「这个 lead 真的点了链接」→ 停掉后续追单 + 回答
    // 「客户到底肯不肯点链接」这个全案最大的未验证假设。失败完全静默。
    if (leadToken) {
      fetch('/api/wa-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: leadToken }),
        keepalive: true,
      }).catch(() => { /* 埋点失败绝不打扰客户 */ });
    }

    // 优惠码：默认 FIRST5。服务端 firstOrderOnly + 手机号跨账号去重会兜住老客，
    // 这里填错最坏是结账时提示码无效，不会错扣钱。
    const promo = (params.get('promo') || '').trim().toUpperCase();
    if (promo !== 'NONE') {
      claimFirstOrderPromo();
      setPromoOn(true);
    }

    const wanted = parseRequestedItems(params);
    const askedMeal = (params.get('meal') || '').toLowerCase();
    const wantDinner = askedMeal === 'dinner';
    if (askedMeal === 'dinner' || askedMeal === 'lunch') setMeal(wantDinner ? 'dinner' : 'lunch');

    // 默认落点：群发来的看下周一（列表里有才跳，没排下周就落最近一天）；带日期参数且能点就用它
    let landing = days[0];
    const askedDate = params.get('date') || '';
    if (askedDate && days.includes(askedDate)) landing = askedDate;
    else if ((params.get('src') || '').startsWith('wa_weekly')) {
      const nextMon = days.find(d => weekdayOfYMD(d) === 1 && d > days[0]);
      if (nextMon) landing = nextMon;
    }

    if (wanted.length) {
      // 幂等：同一个链接刷新不重复填。换成别的链接（不同 query）会重新填。
      const guardKey = `incredibowl_o_prefilled:${search}`;
      let already = false;
      try { already = sessionStorage.getItem(guardKey) === '1'; } catch { /* 无痕模式 */ }

      if (!already) {
        let moved = false;
        const built: ReturnType<typeof bundleFor>[] = [];
        const missing: string[] = [];

        wanted.forEach((w, i) => {
          const dish = weeklyMenu.find(d => d.id === w.id && !d.retired && !d.hidden);
          const info = dish ? dates[dish.id] : undefined;
          if (!dish || !info || info.disabled || !info.actualDate) {
            // 认得出名字才报名字。认不出（已下架/id 拼错）只说「有一道菜」——
            // 把内部 dish id 甩给客户看是最没意义的一种"透明"。
            if (dish) missing.push(locale === 'en' ? dish.nameEn : dish.name);
            else missing.push('');
            return;
          }
          // 指定日期只在「那天正好就是这道菜的可点日」时采用，否则回落 —— 绝不
          // 把一个卖不了的日期塞进购物车（submit-order 会直接拒收）
          const date = askedDate && askedDate === info.actualDate ? askedDate : info.actualDate;
          if (askedDate && date !== askedDate) moved = true;
          built.push(bundleFor(dish, w.qty, date, slotOn(date, wantDinner), i));
        });

        // ⚠️ 链接携带菜品时 = **替换**购物车，不是追加。两个理由：
        //  1) 客户点开必须看到碗妈报的那一单，不能混进上一次浏览的残留
        //  2) bot 先后发过两条不同链接时，追加会让客户不知不觉付两单的钱
        // 菜单上的 + 仍然可以自己加，主动权在客户手上。
        clearCart();
        built.forEach(b => addBundle(b));
        // 深链的菜落在哪天，日期条就跳到哪天
        if (built[0] && days.includes(built[0].selectedDate)) landing = built[0].selectedDate;

        if (missing.length) {
          const named = missing.filter(Boolean);
          setNotice(named.length ? t.missing(named.join('、')) : t.missingUnnamed);
        } else if (moved) setNotice(t.unavailable);
        try { sessionStorage.setItem(guardKey, '1'); } catch { /* 无痕模式：最多重复填一次 */ }
      } else {
        // 同一链接刷新：购物车已经是那一单，日期条照样跳到它的日子
        const first = [...useCartStore.getState().cart].map(b => b.selectedDate).filter(d => days.includes(d)).sort()[0];
        if (first) landing = first;
      }
    }
    setDay(landing);
    setReady(true);
  }, [dates, days, addBundle, clearCart, bundleFor, locale, t, weeklyMenu]);

  // 选中的日期 chip 滚进视野
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    chipRefs.current[day]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [day]);

  // 午/晚切换：整车统一（这一页刻意不支持一单里午晚混点 —— 那是首页的场景）
  const switchMeal = (next: 'lunch' | 'dinner') => {
    setMeal(next);
    useCartStore.getState().cart.forEach(b =>
      updateBundle(b.cartItemId, { selectedTime: slotOn(b.selectedDate, next === 'dinner') }));
  };

  /** 这道菜在「选中的那天 + 当前午/晚」对应的购物车 bundle。 */
  const bundleOf = useCallback((dish: MenuItem, ymd: string) => {
    const time = slotOn(ymd, meal === 'dinner');
    return cart.find(b => b.dish?.id === dish.id && b.selectedDate === ymd && b.selectedTime === time);
  }, [cart, meal]);

  const addDish = (dish: MenuItem, ymd: string) => {
    if (!isDishOrderableOn(dish, ymd).ok) return;
    const time = slotOn(ymd, meal === 'dinner');
    const hit = bundleOf(dish, ymd);
    if (hit) {
      updateBundle(hit.cartItemId, {
        dishQty: (hit.dishQty || 1) + 1,
        price: getDishPrice(dish.price) * ((hit.dishQty || 1) + 1),
      });
    } else {
      addBundle(bundleFor(dish, 1, ymd, time, cart.length));
    }
  };

  const stepQty = (cartItemId: string, delta: number) => {
    const b = cart.find(x => x.cartItemId === cartItemId);
    if (!b) return;
    const next = (b.dishQty || 1) + delta;
    if (next < 1) { removeFromCart(cartItemId); return; }
    updateBundle(cartItemId, { dishQty: next, price: getDishPrice(b.dish?.price ?? 0) * next });
  };

  const total = calcCartTotal(cart);
  const count = calcCartCount(cart);
  const countOn = useCallback((ymd: string) => cart.filter(b => b.selectedDate === ymd).reduce((s, b) => s + (b.dishQty || 1), 0), [cart]);

  const todayYmd = useMemo(() => formatYMD(new Date()), []);
  const tomorrowYmd = useMemo(() => addDaysYmd(todayYmd, 1), [todayYmd]);
  /** 「明天 9月10日（周四）」而不是裸 YYYY-MM-DD —— 6 点截单最容易让人误会的就是「中午问，答案是明天」。 */
  const fmtDate = useCallback((ymd: string) => {
    const wd = weekdayOfYMD(ymd);
    if (wd === null) return '';
    const [, m, d] = ymd.split('-').map(Number);
    const rel = ymd === todayYmd ? t.today : ymd === tomorrowYmd ? t.tomorrow : '';
    if (locale === 'en') {
      const md = `${WD_EN_SHORT[wd]} ${d} ${MONTH_EN[m - 1]}`;
      return rel ? `${rel}, ${md}` : md;
    }
    return `${rel ? rel + ' ' : ''}${m}月${d}日（周${WD_ZH[wd]}）`;
  }, [locale, t, todayYmd, tomorrowYmd]);
  /** 日期条上的两行：上「明天 / 周五」，下「10/9」。 */
  const chipLabel = useCallback((ymd: string) => {
    const wd = weekdayOfYMD(ymd) ?? 0;
    const [, m, d] = ymd.split('-').map(Number);
    const top = ymd === todayYmd ? t.today : ymd === tomorrowYmd ? t.tomorrow : t.wd(wd);
    const bottom = locale === 'en' ? `${d} ${MONTH_EN[m - 1]}` : `${m}/${d}`;
    return { top, bottom, wd };
  }, [locale, t, todayYmd, tomorrowYmd]);

  const cartDates = useMemo(
    () => Array.from(new Set(cart.map(b => b.selectedDate).filter(Boolean))).sort(),
    [cart],
  );
  const multiDate = cartDates.length > 1;
  const cartSorted = useMemo(
    () => [...cart].sort((a, b) => (a.selectedDate || '').localeCompare(b.selectedDate || '')),
    [cart],
  );
  const DateChip = ({ ymd }: { ymd: string }) => (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
      ymd === todayYmd ? 'bg-[#EAF5EE] text-[#3B7A57]' : 'bg-[#FFF4E5] text-[#B4661E]'}`}>
      {t.dayChip(fmtDate(ymd))}
    </span>
  );

  const DishCard = ({ d }: { d: MenuItem }) => {
    const hit = bundleOf(d, day);
    const qty = hit ? (hit.dishQty || 1) : 0;
    const sub = locale === 'en' ? (d.descEn || '') : (d.nameEn || d.desc || '');
    return (
      <li className={`flex gap-3 items-center bg-white rounded-2xl p-2.5 pr-3 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition ${qty ? 'ring-1 ring-[#E8C9A6]' : ''}`}>
        <button type="button" onClick={() => addDish(d, day)} aria-label={locale === 'en' ? d.nameEn : d.name}
          className="relative w-[84px] h-[84px] rounded-xl overflow-hidden shrink-0 bg-[#E3EADA] active:scale-[0.98] transition">
          <DishThumb dish={d} size="84px" />
        </button>
        <div className="flex-1 min-w-0 self-stretch flex flex-col justify-between py-0.5">
          <div className="min-w-0">
            <p className="text-[15px] font-bold leading-snug line-clamp-2">{locale === 'en' ? d.nameEn : d.name}</p>
            {sub && <p className="text-[12px] text-[#8A8A8A] mt-0.5 truncate">{sub}</p>}
          </div>
          <div className="flex items-center justify-between gap-2 mt-1.5">
            <p className="text-[14.5px] font-extrabold text-[#B4661E] tabular-nums">RM{getDishPrice(d.price).toFixed(2)}</p>
            {qty === 0 ? (
              <button type="button" onClick={() => addDish(d, day)} aria-label="add"
                className="w-9 h-9 rounded-full bg-[#B4661E] text-white flex items-center justify-center shadow-[0_2px_6px_rgba(180,102,30,0.35)] active:scale-95 transition">
                <Plus className="w-4 h-4" strokeWidth={2.5} />
              </button>
            ) : (
              <div className="flex items-center rounded-full bg-[#B4661E] text-white">
                <button type="button" aria-label="minus" onClick={() => hit && stepQty(hit.cartItemId, -1)} className="w-9 h-9 flex items-center justify-center">
                  <Minus className="w-4 h-4" strokeWidth={2.5} />
                </button>
                <span className="text-[14px] font-bold w-5 text-center tabular-nums">{qty}</span>
                <button type="button" aria-label="plus" onClick={() => addDish(d, day)} className="w-9 h-9 flex items-center justify-center">
                  <Plus className="w-4 h-4" strokeWidth={2.5} />
                </button>
              </div>
            )}
          </div>
        </div>
      </li>
    );
  };

  return (
    // 桌面端：整页收成手机宽的一栏居中。移动端 max-w-lg 就是全宽。
    <div className="min-h-screen bg-[#FDFBF7] text-[#1A2D23] flex flex-col">
      {/* ── 头部：品牌 + 三个信任点，不放导航（这一页只有一个出口：结账）── */}
      <header className="w-full bg-gradient-to-b from-[#F3EEE2] to-[#FDFBF7]">
        <div className="max-w-lg mx-auto px-5 pt-6 pb-3">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-full overflow-hidden shrink-0 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] ring-2 ring-white">
              <Image src="/logo.webp" alt="" fill sizes="48px" className="object-cover" priority />
            </div>
            <div className="min-w-0">
              <p className="text-[17px] font-extrabold tracking-tight leading-tight">{t.brand}</p>
              <p className="text-[12.5px] text-[#6B6B6B] mt-0.5 leading-snug">{t.tagline}</p>
            </div>
          </div>
          <ul className="flex flex-wrap gap-1.5 mt-3">
            {t.chips.map(c => (
              <li key={c} className="text-[11.5px] font-semibold text-[#3B5A47] bg-white/80 border border-[#E5DFD3] rounded-full px-2.5 py-1">{c}</li>
            ))}
          </ul>
        </div>
      </header>

      {/* ── 日期条：粘在顶上，横滑 ── */}
      <div className="sticky top-0 z-10 bg-[#FDFBF7]/95 backdrop-blur border-b border-[#EFE9DD]">
        <div className="max-w-lg mx-auto">
          <p className="px-5 pt-2 text-[11.5px] font-semibold text-[#8A8A8A]">{t.pickDay}</p>
          <div className="flex gap-2 overflow-x-auto px-5 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(ready ? days : []).map(ymd => {
              const { top, bottom, wd } = chipLabel(ymd);
              const on = ymd === day;
              const n = countOn(ymd);
              const isMon = wd === 1 && ymd !== days[0];
              return (
                <button key={ymd} type="button" onClick={() => setDay(ymd)} aria-pressed={on}
                  ref={el => { chipRefs.current[ymd] = el; }}
                  className={`relative shrink-0 min-w-[64px] px-3 py-1.5 rounded-2xl border text-center transition ${
                    on ? 'bg-[#3B7A57] border-[#3B7A57] text-white shadow-[0_3px_10px_rgba(59,122,87,0.3)]'
                       : 'bg-white border-[#E5DFD3] text-[#1A2D23]'} ${isMon && !on ? 'ml-2' : ''}`}>
                  <span className={`block text-[11px] font-semibold ${on ? 'text-white/85' : 'text-[#8A8A8A]'}`}>{top}</span>
                  <span className="block text-[14px] font-extrabold leading-tight tabular-nums">{bottom}</span>
                  {n > 0 && (
                    <span className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10.5px] font-bold flex items-center justify-center ${
                      on ? 'bg-white text-[#3B7A57]' : 'bg-[#B4661E] text-white'}`}>{n}</span>
                  )}
                </button>
              );
            })}
            {!ready && [0, 1, 2, 3, 4].map(i => <div key={i} className="shrink-0 w-[68px] h-[46px] rounded-2xl bg-[#EFE9DD] animate-pulse" />)}
          </div>
        </div>
      </div>

      <main className="flex-1 w-full max-w-lg mx-auto px-5 pb-36">
        {/* 午/晚：等宽两半，一眼看到哪个亮着 */}
        <div className="grid grid-cols-2 rounded-2xl bg-[#E3EADA] p-1 mt-3">
          {(['lunch', 'dinner'] as const).map(m => (
            <button key={m} type="button" onClick={() => switchMeal(m)} aria-pressed={meal === m}
              className={`py-2.5 rounded-xl text-[13.5px] font-bold transition ${
                meal === m ? 'bg-white text-[#1A2D23] shadow-[0_1px_4px_rgba(0,0,0,0.08)]' : 'text-[#7A8A7E]'}`}>
              {m === 'lunch' ? t.lunch : t.dinner}
            </button>
          ))}
        </div>

        {ready && promoOn && (
          <p className="mt-3 text-[12.5px] font-semibold text-[#3B7A57] bg-[#EAF5EE] rounded-xl px-3 py-2">{t.promo(FIRST_ORDER_PROMO_RM)}</p>
        )}
        {notice && <p className="mt-3 text-[12.5px] text-[#B4661E] bg-[#FFF4E5] rounded-xl px-3 py-2">{notice}</p>}

        {/* 骨架屏 */}
        {!ready && (
          <div className="mt-5 space-y-3 animate-pulse" aria-hidden>
            <div className="h-4 w-32 rounded bg-[#EFE9DD]" />
            {[0, 1, 2].map(i => (
              <div key={i} className="flex gap-3 bg-white rounded-2xl p-3">
                <div className="w-[84px] h-[84px] rounded-xl bg-[#EFE9DD]" />
                <div className="flex-1 pt-1 space-y-2">
                  <div className="h-4 w-3/5 rounded bg-[#EFE9DD]" />
                  <div className="h-3 w-4/5 rounded bg-[#F4F0E7]" />
                  <div className="h-4 w-16 rounded bg-[#EFE9DD]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 已选：紧凑一张卡，菜名 × 份数 · 送达日 · 可删 */}
        {ready && cart.length > 0 && (
          <section className="mt-4 bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="flex items-baseline justify-between px-4 pt-3 pb-1">
              <h2 className="text-[13px] font-bold">{t.picked}</h2>
              {multiDate && <p className="text-[11.5px] text-[#B4661E]">{t.multiDate(cartDates.length)}</p>}
            </div>
            <ul className="divide-y divide-[#F1ECE2]">
              {cartSorted.map(b => (
                <li key={b.cartItemId} className="flex items-center gap-2 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold leading-snug truncate">{locale === 'en' ? b.dish?.nameEn : b.dish?.name}</p>
                    <p className="text-[12px] text-[#8A8A8A] mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>RM{(getDishPrice(b.dish?.price ?? 0) * (b.dishQty || 1)).toFixed(2)}</span>
                      {b.selectedDate && <DateChip ymd={b.selectedDate} />}
                    </p>
                  </div>
                  <div className="flex items-center rounded-full border border-[#E5DFD3] bg-[#FDFBF7]">
                    <button type="button" aria-label="minus" onClick={() => stepQty(b.cartItemId, -1)} className="w-8 h-8 flex items-center justify-center text-[#6B6B6B]">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[14px] font-bold w-5 text-center tabular-nums">{b.dishQty || 1}</span>
                    <button type="button" aria-label="plus" onClick={() => stepQty(b.cartItemId, 1)} className="w-8 h-8 flex items-center justify-center text-[#B4661E]">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button type="button" aria-label="remove" onClick={() => removeFromCart(b.cartItemId)} className="w-8 h-8 flex items-center justify-center text-[#C4C4C4]">
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 那天的菜：⭐ 当日精选 → 🍚 每天都有 */}
        {ready && day && (
          <div className="mt-5">
            {dayMenu.length === 0 && (
              <p className="text-[13px] text-[#8A8A8A] bg-white rounded-2xl px-4 py-6 text-center">{t.noMenu}</p>
            )}
            {specials.length > 0 && (
              <section>
                <h2 className="text-[13.5px] font-bold mb-2">{t.specials(locale === 'en' ? WD_EN_SHORT[weekdayOfYMD(day) ?? 0] : `周${WD_ZH[weekdayOfYMD(day) ?? 0]}`)}</h2>
                <ul className="space-y-2.5">{specials.map(d => <DishCard key={d.id} d={d} />)}</ul>
              </section>
            )}
            {dailies.length > 0 && (
              <section className={specials.length ? 'mt-5' : ''}>
                <h2 className="text-[13.5px] font-bold mb-2">{t.daily}</h2>
                <ul className="space-y-2.5">{dailies.map(d => <DishCard key={d.id} d={d} />)}</ul>
              </section>
            )}
            <p className="mt-6 text-[11.5px] text-[#A5A5A5] text-center">{t.cutoff}</p>
          </div>
        )}
      </main>

      {/* ── 固定底栏：全页唯一的出口 ─────────────────── */}
      {ready && cart.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-[#EFE9DD] px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-4 max-w-lg mx-auto">
            <div className="min-w-0">
              <p className="text-[11px] text-[#8A8A8A]">{t.total} · {t.portions(count)}{!multiDate && cartDates[0] ? ` · ${t.dayChip(fmtDate(cartDates[0]))}` : ''}</p>
              <p className="text-[20px] font-extrabold leading-tight tabular-nums">RM{total.toFixed(2)}</p>
            </div>
            <button type="button" onClick={() => setIsCartOpen(true)}
              className="flex-1 bg-[#B4661E] text-white rounded-full py-3.5 font-bold text-[15px] flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(180,102,30,0.35)] active:scale-[0.99] transition">
              <ShoppingBag className="w-4 h-4" />
              {t.checkout}
            </button>
          </div>
        </div>
      )}

      {/* 结账全部交给已经在跑的抽屉 —— 地址/支付/访客/优惠码/运费一行都不重写 */}
      {isCartOpen && (
        <ErrorBoundary>
          <CartDrawer
            isOpen={isCartOpen}
            onClose={() => setIsCartOpen(false)}
            cart={cart}
            updateQuantity={updateQuantity}
            removeFromCart={removeFromCart}
            cartTotal={total}
            cartCount={count}
            onAuthOpen={() => { setIsCartOpen(false); setIsAuthOpen(true); }}
            onClearCart={clearCart}
            onEditItem={undefined}
            locale={locale}
          />
        </ErrorBoundary>
      )}
      <ErrorBoundary>
        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          onProfileComplete={() => { setIsAuthOpen(false); setIsCartOpen(true); }}
          locale={locale}
        />
      </ErrorBoundary>
    </div>
  );
}
