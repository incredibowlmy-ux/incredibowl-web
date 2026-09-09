'use client';

/**
 * /o —— 碗妈 WhatsApp bot / 每周菜单群发 专用的极简下单页。
 *
 * 为什么不复用首页：v2 的 0 成交诊断里，新客要打字说清 6 样信息才能下单。这一页
 * 的存在就是把那 6 样压成「点一下」。首页有 hero / 轮播 / FAQ / 订阅弹窗，对
 * 一个从 WhatsApp 点进来、只想订那一道菜的人全是干扰。
 *
 * 刻意的设计约束：
 *   · 一屏能看完 —— 菜 + 数量 + 午/晚 + 一个结账按钮，没有导航没有别的菜
 *   · **不重写结账**。地址、支付、访客下单、优惠码、运费全部交给已经在跑的
 *     CartDrawer + /api/submit-order。这一页只负责「把购物车填好、把抽屉打开」。
 *     支付链路是全站风险最高的地方，为了一个落地页去复制它是愚蠢的。
 *   · 链接带了菜 = **购物车按链接重建**（不是追加）。客户点开必须看到碗妈报的
 *     那一单；而且 bot 先后发过两条不同链接时，追加会让客户不知不觉付两单的钱。
 *     想加菜直接在菜单上按 +，主动权留给客户。
 *
 * 2026-09-09 手机版重做（老板：「不体面、不专业」，客户九成用手机）：
 *   · 菜单**常驻可见**，每道菜卡片上直接 − n +，不再「加一道就把菜单收起来」
 *   · 已选的菜在菜单上方一张紧凑卡：菜名 × 份数 · 送达日 · 可删，多日送达说清楚
 *   · 大图（84px）、菜名 + 英文/一句描述、价格突出；没图/坏图回落到品牌占位，不再露 alt 字
 *   · 载入用骨架屏；底栏一个出口「去结账 · RM 合计」
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
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Plus, Minus, X, ShoppingBag } from 'lucide-react';
import { type MenuItem } from '@/data/weeklyMenu';
import { useMenuRuntime } from '@/lib/useMenuRuntime';
import { isDinnerClosedOn } from '@/data/blockedDates';
import { computeMenuDates, formatYMD, type MenuDateInfo } from '@/lib/dateUtils';
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
    forDate: (d: string) => `${d} 送达`,
    lunch: '午餐 11:00–13:00',
    dinner: '晚餐 17:30–20:00',
    empty: '选一道今天想吃的 👇',
    picked: '你的选择',
    promo: (rm: number) => `🎁 新朋友首单立减 RM${rm}，结账自动套用`,
    total: '合计',
    checkout: '去结账',
    portions: (n: number) => `${n} 份`,
    soldOutNote: '（今日不可点）',
    cutoff: '每天早上 6 点截单 · 当天现做当天送',
    unavailable: '这道菜今天不可点，帮你换成最近可点的日子了',
    missing: (names: string) => `不好意思，${names} 这天没排哦～下面是可以点的 👇`,
    missingUnnamed: '不好意思，这道菜这天没排哦～下面是可以点的 👇',
    multiDate: (n: number) => `这几道菜不在同一天做，会分 ${n} 天送达 —— 每道菜都在它的日子当天现做`,
    todayChip: '今天送',
    dayChip: (d: string) => `${d} 送`,
    groupHeader: (d: string) => d,
    groupSub: (n: number) => `${n} 道 · 当天现做`,
    pickHint: '碗妈每天只做当天排的菜，按送达日挑',
    imgAlt: '菜品图片',
  },
  en: {
    brand: "BowlMama's Kitchen",
    tagline: 'Market-fresh every morning, home-cooked to your door',
    chips: ['🌿 No MSG', '🍳 Cooked daily', '⏰ Orders close 6 AM'],
    forDate: (d: string) => `Delivery ${d}`,
    lunch: 'Lunch 11:00–13:00',
    dinner: 'Dinner 17:30–20:00',
    empty: 'Pick what you feel like today 👇',
    picked: 'Your picks',
    promo: (rm: number) => `🎁 RM${rm} off your first order — applied at checkout`,
    total: 'Total',
    checkout: 'Checkout',
    portions: (n: number) => `${n} ${n === 1 ? 'meal' : 'meals'}`,
    soldOutNote: '(unavailable today)',
    cutoff: 'Orders close 6:00 AM daily · cooked fresh and delivered same day',
    unavailable: 'That dish is not available today — moved to its next available date',
    missing: (names: string) => `Sorry, ${names} isn't on the menu that day. Here's what's available 👇`,
    missingUnnamed: "Sorry, that dish isn't on the menu that day. Here's what's available 👇",
    multiDate: (n: number) => `These dishes are cooked on ${n} different days, so they arrive separately — each one fresh on its own day`,
    todayChip: 'Today',
    dayChip: (d: string) => d,
    groupHeader: (d: string) => d,
    groupSub: (n: number) => `${n} ${n === 1 ? 'dish' : 'dishes'} · cooked fresh that day`,
    pickHint: 'BowlMama only cooks what is scheduled for the day. Pick by delivery day',
    imgAlt: 'dish photo',
  },
} as const;

interface Props { locale?: Locale }

/**
 * 菜品缩略图。
 *
 * ⚠️ weeklyMenu 的 `image` **不一定是路径** —— 这个仓库允许用 emoji 当占位图
 * （新菜还没拍照时就是这样）。直接丢给 next/image 会打出
 * `/_next/image?url=🍖` 然后 400。另外排期里的菜可能**引用了还没上传的图**
 * （2026-09-09 线上两道菜 404，卡片上露出一行 alt 字）—— onError 回落到品牌占位，
 * 客户永远看不到破图。
 */
function DishThumb({ dish, size }: { dish?: { image?: string; name?: string } | null; size: string }) {
  const src = dish?.image || '';
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [src]);
  if (src.startsWith('/') && !broken) {
    return <Image src={src} alt="" fill sizes={size} className="object-cover" onError={() => setBroken(true)} />;
  }
  // emoji 占位原样显示；路径坏了用淡化的 logo —— 比一个 emoji 更像「这家店的菜」，也不依赖手机有没有彩色 emoji 字体
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

export default function QuickOrderClient({ locale = 'zh' }: Props) {
  const t = DICT[locale];
  const { cart, addBundle, updateBundle, updateQuantity, removeFromCart, clearCart } = useCartStore();

  const [ready, setReady] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [meal, setMeal] = useState<'lunch' | 'dinner'>('lunch');
  const [notice, setNotice] = useState('');
  const [promoOn, setPromoOn] = useState(false);

  // 日期表：哪道菜哪天能点，全站唯一口径（首页 / 会员页复购用的是同一个函数）
  const { menu: weeklyMenu, version: menuVersion } = useMenuRuntime();
  const [dates, setDates] = useState<Record<number, MenuDateInfo>>({});
  useEffect(() => {
    const { menuDates } = computeMenuDates(weeklyMenu, locale);
    setDates(menuDates);
  }, [locale, weeklyMenu, menuVersion]);

  const orderable = useMemo(
    () => weeklyMenu.filter(d => !d.retired && !d.hidden && dates[d.id] && !dates[d.id].disabled),
    [dates, weeklyMenu],
  );

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

  // ── 预填 + 归因 + 优惠码（只跑一次，靠 query 串做幂等）────────
  useEffect(() => {
    if (Object.keys(dates).length === 0) return; // 等日期表算好，否则会填出 selectedDate:''
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

    if (wanted.length) {
      // 幂等：同一个链接刷新不重复填。换成别的链接（不同 query）会重新填。
      const guardKey = `incredibowl_o_prefilled:${search}`;
      let already = false;
      try { already = sessionStorage.getItem(guardKey) === '1'; } catch { /* 无痕模式 */ }

      if (!already) {
        const askedDate = params.get('date') || '';
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

        if (missing.length) {
          const named = missing.filter(Boolean);
          setNotice(named.length ? t.missing(named.join('、')) : t.missingUnnamed);
        } else if (moved) setNotice(t.unavailable);
        try { sessionStorage.setItem(guardKey, '1'); } catch { /* 无痕模式：最多重复填一次 */ }
      }
    }
    setReady(true);
  }, [dates, addBundle, clearCart, bundleFor, locale, t]);

  // 午/晚切换：整车统一（这一页刻意不支持一单里午晚混点 —— 那是首页的场景）
  const switchMeal = (next: 'lunch' | 'dinner') => {
    setMeal(next);
    useCartStore.getState().cart.forEach(b =>
      updateBundle(b.cartItemId, { selectedTime: slotOn(b.selectedDate, next === 'dinner') }));
  };

  /** 这道菜在购物车里对应的 bundle（同菜 + 它的可点日 + 当前午/晚）。 */
  const bundleOf = useCallback((dish: MenuItem) => {
    const info = dates[dish.id];
    if (!info?.actualDate) return undefined;
    const time = slotOn(info.actualDate, meal === 'dinner');
    return cart.find(b => b.dish?.id === dish.id && b.selectedDate === info.actualDate && b.selectedTime === time);
  }, [cart, dates, meal]);

  const addDish = (dish: MenuItem) => {
    const info = dates[dish.id];
    if (!info || info.disabled || !info.actualDate) return;
    const time = slotOn(info.actualDate, meal === 'dinner');
    const hit = bundleOf(dish);
    if (hit) {
      updateBundle(hit.cartItemId, {
        dishQty: (hit.dishQty || 1) + 1,
        price: getDishPrice(dish.price) * ((hit.dishQty || 1) + 1),
      });
    } else {
      addBundle(bundleFor(dish, 1, info.actualDate, time, cart.length));
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

  // 「明天 8月17日（周一）」而不是裸 YYYY-MM-DD —— 6 点截单最容易让人误会的
  // 就是「中午问，答案是明天」，日期必须一眼看懂。
  const fmtDate = useCallback((ymd: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
    const d = new Date(`${ymd}T00:00:00`);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
    if (locale === 'en') {
      const rel = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : '';
      const md = `${WD_EN_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_EN[d.getMonth()]}`;
      return rel ? `${rel}, ${md}` : md;
    }
    const rel = diff === 0 ? '今天 ' : diff === 1 ? '明天 ' : '';
    return `${rel}${d.getMonth() + 1}月${d.getDate()}日（周${WD_ZH[d.getDay()]}）`;
  }, [locale]);

  // ⚠️ 复购链接里的几道菜**可能落在不同配送日**（各自的最近可点日：常驻菜是明天，
  // 周三特餐就是周三）。CartDrawer 本来就支持拆成多单分日送，机制没问题 ——
  // 但页头只显示第一项的日期会让客户以为一起送。日期不一致时必须说清楚。
  const cartDates = useMemo(
    () => Array.from(new Set(cart.map(b => b.selectedDate).filter(Boolean))).sort(),
    [cart],
  );
  const multiDate = cartDates.length > 1;
  const activeDate = cartDates[0] || (orderable[0] ? dates[orderable[0].id]?.actualDate : '') || '';
  const dateLabel = useMemo(
    () => (multiDate ? t.multiDate(cartDates.length) : fmtDate(activeDate)),
    [multiDate, cartDates.length, activeDate, fmtDate, t],
  );

  // 碗妈每天只做当天排的菜（周三特餐就是周三）：菜单按送达日分组、每组一个日期
  // 标题；已选的菜永远带日期徽章。
  const todayYmd = useMemo(() => formatYMD(new Date()), []);
  const dayGroups = useMemo(() => {
    const byDate = new Map<string, MenuItem[]>();
    for (const d of orderable) {
      const ymd = dates[d.id]?.actualDate;
      if (!ymd) continue;
      if (!byDate.has(ymd)) byDate.set(ymd, []);
      byDate.get(ymd)!.push(d);
    }
    return Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [orderable, dates]);
  const cartSorted = useMemo(
    () => [...cart].sort((a, b) => (a.selectedDate || '').localeCompare(b.selectedDate || '')),
    [cart],
  );
  const DateChip = ({ ymd }: { ymd: string }) => {
    const isToday = ymd === todayYmd;
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
        isToday ? 'bg-[#EAF5EE] text-[#3B7A57]' : 'bg-[#FFF4E5] text-[#B4661E]'}`}>
        {isToday ? t.todayChip : t.dayChip(fmtDate(ymd))}
      </span>
    );
  };

  return (
    // 桌面端：整页收成手机宽的一栏居中（之前卡片横拉满屏，2000px 宽的白条像没做完）。
    // 移动端 max-w-lg 就是全宽。
    <div className="min-h-screen bg-[#FDFBF7] text-[#1A2D23] flex flex-col">
      {/* ── 头部：品牌 + 三个信任点，不放导航（这一页只有一个出口：结账）── */}
      <header className="w-full bg-gradient-to-b from-[#F3EEE2] to-[#FDFBF7]">
        <div className="max-w-lg mx-auto px-5 pt-6 pb-4">
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

      <main className="flex-1 w-full max-w-lg mx-auto px-5 pb-36">
        {/* 午/晚：等宽两半，一眼看到哪个亮着 */}
        <div className="grid grid-cols-2 rounded-2xl bg-[#E3EADA] p-1 mt-1">
          {(['lunch', 'dinner'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => switchMeal(m)}
              aria-pressed={meal === m}
              className={`py-2.5 rounded-xl text-[13.5px] font-bold transition ${
                meal === m ? 'bg-white text-[#1A2D23] shadow-[0_1px_4px_rgba(0,0,0,0.08)]' : 'text-[#7A8A7E]'
              }`}
            >
              {m === 'lunch' ? t.lunch : t.dinner}
            </button>
          ))}
        </div>

        {ready && promoOn && (
          <p className="mt-3 text-[12.5px] font-semibold text-[#3B7A57] bg-[#EAF5EE] rounded-xl px-3 py-2">
            {t.promo(FIRST_ORDER_PROMO_RM)}
          </p>
        )}

        {notice && (
          <p className="mt-3 text-[12.5px] text-[#B4661E] bg-[#FFF4E5] rounded-xl px-3 py-2">{notice}</p>
        )}

        {/* 骨架屏：三张灰卡，别让客户盯着「载入中…」 */}
        {!ready && (
          <div className="mt-5 space-y-3 animate-pulse" aria-hidden>
            <div className="h-4 w-40 rounded bg-[#EFE9DD]" />
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
              <p className="text-[12px] text-[#6B6B6B]">{multiDate ? '' : t.forDate(dateLabel)}</p>
            </div>
            {multiDate && (
              <p className="mx-4 mb-1 text-[12px] text-[#B4661E] bg-[#FFF4E5] rounded-lg px-2.5 py-1.5">{dateLabel}</p>
            )}
            <ul className="divide-y divide-[#F1ECE2]">
              {cartSorted.map(b => (
                <li key={b.cartItemId} className="flex items-center gap-2 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold leading-snug truncate">
                      {locale === 'en' ? b.dish?.nameEn : b.dish?.name}
                    </p>
                    <p className="text-[12px] text-[#8A8A8A] mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>RM{(getDishPrice(b.dish?.price ?? 0) * (b.dishQty || 1)).toFixed(2)}</span>
                      {b.selectedDate && <DateChip ymd={b.selectedDate} />}
                    </p>
                  </div>
                  <div className="flex items-center rounded-full border border-[#E5DFD3] bg-[#FDFBF7]">
                    <button type="button" aria-label="minus" onClick={() => stepQty(b.cartItemId, -1)}
                      className="w-8 h-8 flex items-center justify-center text-[#6B6B6B]">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[14px] font-bold w-5 text-center tabular-nums">{b.dishQty || 1}</span>
                    <button type="button" aria-label="plus" onClick={() => stepQty(b.cartItemId, 1)}
                      className="w-8 h-8 flex items-center justify-center text-[#B4661E]">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button type="button" aria-label="remove" onClick={() => removeFromCart(b.cartItemId)}
                    className="w-8 h-8 flex items-center justify-center text-[#C4C4C4]">
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 菜单：常驻可见，按送达日分组，卡片上直接加减 */}
        {ready && (
          <div className="mt-5">
            <p className="text-[13.5px] font-bold">{cart.length === 0 ? t.empty : t.pickHint}</p>
            {cart.length === 0 && <p className="text-[12px] text-[#8A8A8A] mt-0.5">{t.pickHint}</p>}
            {dayGroups.map(([ymd, dishes]) => {
              const isToday = ymd === todayYmd;
              return (
                <section key={ymd} className="mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-bold ${
                      isToday ? 'bg-[#3B7A57] text-white' : 'bg-[#B4661E] text-white'}`}>
                      {t.groupHeader(fmtDate(ymd))}
                    </span>
                    <span className="text-[11.5px] text-[#8A8A8A]">{t.groupSub(dishes.length)}</span>
                  </div>
                  <ul className="space-y-2.5">
                    {dishes.map(d => {
                      const hit = bundleOf(d);
                      const qty = hit ? (hit.dishQty || 1) : 0;
                      const sub = locale === 'en' ? (d.descEn || '') : (d.nameEn || d.desc || '');
                      return (
                        <li key={d.id} className={`flex gap-3 items-center bg-white rounded-2xl p-2.5 pr-3 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition ${
                          qty ? 'ring-1 ring-[#E8C9A6]' : ''}`}>
                          <button type="button" onClick={() => addDish(d)} aria-label={locale === 'en' ? d.nameEn : d.name}
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
                                <button type="button" onClick={() => addDish(d)} aria-label="add"
                                  className="w-9 h-9 rounded-full bg-[#B4661E] text-white flex items-center justify-center shadow-[0_2px_6px_rgba(180,102,30,0.35)] active:scale-95 transition">
                                  <Plus className="w-4 h-4" strokeWidth={2.5} />
                                </button>
                              ) : (
                                <div className="flex items-center rounded-full bg-[#B4661E] text-white">
                                  <button type="button" aria-label="minus" onClick={() => hit && stepQty(hit.cartItemId, -1)}
                                    className="w-9 h-9 flex items-center justify-center">
                                    <Minus className="w-4 h-4" strokeWidth={2.5} />
                                  </button>
                                  <span className="text-[14px] font-bold w-5 text-center tabular-nums">{qty}</span>
                                  <button type="button" aria-label="plus" onClick={() => addDish(d)}
                                    className="w-9 h-9 flex items-center justify-center">
                                    <Plus className="w-4 h-4" strokeWidth={2.5} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
            <p className="mt-6 text-[11.5px] text-[#A5A5A5] text-center">{t.cutoff}</p>
          </div>
        )}
      </main>

      {/* ── 固定底栏：全页唯一的出口 ─────────────────── */}
      {ready && cart.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-[#EFE9DD] px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-4 max-w-lg mx-auto">
            <div className="min-w-0">
              <p className="text-[11px] text-[#8A8A8A]">{t.total} · {t.portions(count)}</p>
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
