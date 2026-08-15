'use client';

/**
 * /o —— 碗妈 WhatsApp bot 专用的极简下单页。
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
 *     想加菜有「再加一道」，主动权留给客户。
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
import { Plus, Minus, X, ShoppingBag, Loader2 } from 'lucide-react';
import { weeklyMenu, type MenuItem } from '@/data/weeklyMenu';
import { computeMenuDates, type MenuDateInfo } from '@/lib/dateUtils';
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

const WD_ZH = ['日', '一', '二', '三', '四', '五', '六'];
const WD_EN_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Locale = 'zh' | 'en';

const DICT = {
  zh: {
    brand: '碗妈的厨房',
    tagline: '每天巴刹现采 · 不放味精 · 送到你楼下',
    forDate: (d: string) => `${d} 送达`,
    lunch: '午餐 11:00–13:00',
    dinner: '晚餐 17:30–20:00',
    empty: '选一道今天想吃的 👇',
    addMore: '＋ 再加一道',
    hideMore: '收起',
    promo: (rm: number) => `🎁 新朋友首单立减 RM${rm}，结账自动套用`,
    total: '合计',
    checkout: '去结账',
    loading: '载入中…',
    soldOutNote: '（今日不可点）',
    cutoff: '每天早上 6 点截单',
    unavailable: '这道菜今天不可点，帮你换成最近可点的日子了',
    missing: (names: string) => `不好意思，${names} 这天没排哦～下面是可以点的 👇`,
    missingUnnamed: '不好意思，这道菜这天没排哦～下面是可以点的 👇',
    multiDate: (n: number) => `分 ${n} 天送达（每道菜按它能做的日子排）`,
  },
  en: {
    brand: "BowlMama's Kitchen",
    tagline: 'Market-fresh daily · No MSG · Delivered to your door',
    forDate: (d: string) => `Delivery ${d}`,
    lunch: 'Lunch 11:00–13:00',
    dinner: 'Dinner 17:30–20:00',
    empty: 'Pick what you feel like today 👇',
    addMore: '＋ Add another',
    hideMore: 'Hide',
    promo: (rm: number) => `🎁 RM${rm} off your first order — applied at checkout`,
    total: 'Total',
    checkout: 'Checkout',
    loading: 'Loading…',
    soldOutNote: '(unavailable today)',
    cutoff: 'Orders close 6:00 AM daily',
    unavailable: 'That dish is not available today — moved to its next available date',
    missing: (names: string) => `Sorry, ${names} isn't on the menu that day. Here's what's available 👇`,
    missingUnnamed: "Sorry, that dish isn't on the menu that day. Here's what's available 👇",
    multiDate: (n: number) => `Delivered across ${n} days (each dish on the day it's cooked)`,
  },
} as const;

interface Props { locale?: Locale }

/**
 * 菜品缩略图。
 *
 * ⚠️ weeklyMenu 的 `image` **不一定是路径** —— 这个仓库允许用 emoji 当占位图
 * （新菜还没拍照时就是这样）。直接丢给 next/image 会打出
 * `/_next/image?url=🍖` 然后 400。首页 MenuCarousel 和 CartItemCard 早就有
 * `startsWith('/')` 守卫，这里补齐，别让 /o 成为唯一会炸的那一页。
 */
function DishThumb({ dish, size }: { dish?: { image?: string; name?: string } | null; size: string }) {
  const src = dish?.image || '';
  if (src.startsWith('/')) {
    return <Image src={src} alt={dish?.name || ''} fill sizes={size} className="object-cover" />;
  }
  return <div className="w-full h-full flex items-center justify-center text-2xl">{src}</div>;
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
  const [showPicker, setShowPicker] = useState(false);
  const [meal, setMeal] = useState<'lunch' | 'dinner'>('lunch');
  const [notice, setNotice] = useState('');
  const [promoOn, setPromoOn] = useState(false);

  // 日期表：哪道菜哪天能点，全站唯一口径（首页 / 会员页复购用的是同一个函数）
  const [dates, setDates] = useState<Record<number, MenuDateInfo>>({});
  useEffect(() => {
    const { menuDates } = computeMenuDates(weeklyMenu, locale);
    setDates(menuDates);
  }, [locale]);

  const orderable = useMemo(
    () => weeklyMenu.filter(d => !d.retired && !d.hidden && dates[d.id] && !dates[d.id].disabled),
    [dates],
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
    const time = wantDinner ? DINNER : LUNCH;

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
          built.push(bundleFor(dish, w.qty, date, time, i));
        });

        // ⚠️ 链接携带菜品时 = **替换**购物车，不是追加。两个理由：
        //  1) 客户点开必须看到碗妈报的那一单，不能混进上一次浏览的残留
        //  2) bot 先后发过两条不同链接时，追加会让客户不知不觉付两单的钱
        // 「再加一道」按钮仍然可以自己加，主动权在客户手上。
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
    const time = next === 'dinner' ? DINNER : LUNCH;
    useCartStore.getState().cart.forEach(b => updateBundle(b.cartItemId, { selectedTime: time }));
  };

  const addDish = (dish: MenuItem) => {
    const info = dates[dish.id];
    if (!info || info.disabled || !info.actualDate) return;
    const time = meal === 'dinner' ? DINNER : LUNCH;
    const hit = cart.find(b => b.dish?.id === dish.id && b.selectedDate === info.actualDate && b.selectedTime === time);
    if (hit) {
      updateBundle(hit.cartItemId, {
        dishQty: (hit.dishQty || 1) + 1,
        price: getDishPrice(dish.price) * ((hit.dishQty || 1) + 1),
      });
    } else {
      addBundle(bundleFor(dish, 1, info.actualDate, time, cart.length));
    }
    setShowPicker(false);
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
      const rel = diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : '';
      const md = `${WD_EN_SHORT[d.getDay()]} ${MONTH_EN[d.getMonth()]} ${d.getDate()}`;
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

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2B2B2B] flex flex-col">
      {/* ── 头部：极简，不放导航（这一页只有一个出口：结账）── */}
      <header className="px-5 pt-6 pb-4">
        <p className="text-[15px] font-bold tracking-tight">{t.brand} 🍲</p>
        <p className="text-[12px] text-[#8A8A8A] mt-0.5">{t.tagline}</p>
      </header>

      <main className="flex-1 px-5 pb-40">
        {/* 配送日 + 午/晚 */}
        <div className="mb-4">
          {dateLabel && (
            // 多日那句自带完整语义，不能再被 forDate() 包一层（会读成「分 2 天送达 送达」）
            <p className="text-[13px] text-[#6B6B6B] mb-2">{multiDate ? dateLabel : t.forDate(dateLabel)}</p>
          )}
          <div className="inline-flex rounded-full bg-[#F0EBE1] p-1">
            {(['lunch', 'dinner'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => switchMeal(m)}
                className={`px-4 py-2 rounded-full text-[13px] font-semibold transition ${
                  meal === m ? 'bg-white text-[#2B2B2B] shadow-sm' : 'text-[#8A8A8A]'
                }`}
              >
                {m === 'lunch' ? t.lunch : t.dinner}
              </button>
            ))}
          </div>
        </div>

        {notice && (
          <p className="mb-3 text-[12px] text-[#B4661E] bg-[#FFF4E5] rounded-xl px-3 py-2">{notice}</p>
        )}

        {!ready && (
          <p className="flex items-center gap-2 text-[13px] text-[#8A8A8A] py-8">
            <Loader2 className="w-4 h-4 animate-spin" /> {t.loading}
          </p>
        )}

        {/* 购物车内容 */}
        {ready && cart.length > 0 && (
          <ul className="space-y-3">
            {cart.map(b => (
              <li key={b.cartItemId} className="flex gap-3 bg-white rounded-2xl p-3 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-[#F0EBE1]">
                  <DishThumb dish={b.dish} size="80px" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold leading-snug truncate">
                    {locale === 'en' ? b.dish?.nameEn : b.dish?.name}
                  </p>
                  <p className="text-[13px] text-[#8A8A8A] mt-0.5">
                    RM{getDishPrice(b.dish?.price ?? 0).toFixed(2)}
                    {multiDate && b.selectedDate && (
                      <span className="ml-2 text-[#B4661E]">{fmtDate(b.selectedDate)}</span>
                    )}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <button type="button" aria-label="minus" onClick={() => stepQty(b.cartItemId, -1)}
                      className="w-8 h-8 rounded-full border border-[#E5DFD3] flex items-center justify-center">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[14px] font-semibold w-5 text-center">{b.dishQty || 1}</span>
                    <button type="button" aria-label="plus" onClick={() => stepQty(b.cartItemId, 1)}
                      className="w-8 h-8 rounded-full border border-[#E5DFD3] flex items-center justify-center">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" aria-label="remove" onClick={() => removeFromCart(b.cartItemId)}
                      className="ml-auto text-[#C4C4C4]">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* 空车 / 加菜：直接铺当天可点的菜，不用再跳首页 */}
        {ready && (cart.length === 0 || showPicker) && (
          <div className={cart.length === 0 ? '' : 'mt-4'}>
            {cart.length === 0 && <p className="text-[13px] text-[#6B6B6B] mb-3">{t.empty}</p>}
            <ul className="space-y-2">
              {orderable.map(d => (
                <li key={d.id}>
                  <button type="button" onClick={() => addDish(d)}
                    className="w-full flex gap-3 items-center bg-white rounded-2xl p-3 text-left shadow-[0_1px_3px_rgba(0,0,0,0.05)] active:scale-[0.99] transition">
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-[#F0EBE1]">
                      <DishThumb dish={d} size="56px" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold truncate">{locale === 'en' ? d.nameEn : d.name}</p>
                      <p className="text-[13px] text-[#8A8A8A]">RM{getDishPrice(d.price).toFixed(2)}</p>
                    </div>
                    <Plus className="w-4 h-4 text-[#B4661E]" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {ready && cart.length > 0 && (
          <button type="button" onClick={() => setShowPicker(v => !v)}
            className="mt-4 text-[13px] font-semibold text-[#B4661E]">
            {showPicker ? t.hideMore : t.addMore}
          </button>
        )}

        {ready && promoOn && (
          <p className="mt-5 text-[12px] text-[#3B7A57] bg-[#EAF5EE] rounded-xl px-3 py-2">
            {t.promo(FIRST_ORDER_PROMO_RM)}
          </p>
        )}
        <p className="mt-3 text-[11px] text-[#A5A5A5]">{t.cutoff}</p>
      </main>

      {/* ── 固定底栏：全页唯一的出口 ─────────────────── */}
      {ready && cart.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-[#EFE9DD] px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-4 max-w-lg mx-auto">
            <div className="min-w-0">
              <p className="text-[11px] text-[#8A8A8A]">{t.total}</p>
              <p className="text-[18px] font-bold leading-tight">RM{total.toFixed(2)}</p>
            </div>
            <button type="button" onClick={() => setIsCartOpen(true)}
              className="flex-1 bg-[#B4661E] text-white rounded-full py-3.5 font-bold text-[15px] flex items-center justify-center gap-2 active:scale-[0.99] transition">
              <ShoppingBag className="w-4 h-4" />
              {t.checkout}{count > 0 ? ` (${count})` : ''}
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
