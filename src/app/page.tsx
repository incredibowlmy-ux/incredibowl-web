"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const AuthModal = dynamic(() => import('@/components/auth/AuthModal'), { ssr: false });
const CartDrawer = dynamic(() => import('@/components/cart/CartDrawer'), { ssr: false });
const AddOnModal = dynamic(() => import('@/components/menu/AddOnModal'), { ssr: false });
const WhatsAppFloat = dynamic(() => import('@/components/home/WhatsAppFloat'), { ssr: false });
const SubscribeModal = dynamic(() => import('@/components/home/SubscribeModal'), { ssr: false });
const WhatsAppStickyBar = dynamic(() => import('@/components/home/WhatsAppStickyBar'), { ssr: false });
import NavBar from '@/components/home/NavBar';
import HeroSection from '@/components/home/HeroSection';
import FaqHeroStrip from '@/components/home/FaqHeroStrip';
import CutoffBanner from '@/components/home/CutoffBanner';
import HeroTrustStrip from '@/components/home/HeroTrustStrip';
import PromoBanner from '@/components/home/PromoBanner';
import DeliveryWidget from '@/components/home/DeliveryWidget';
import MenuCarousel from '@/components/home/MenuCarousel';
import AboutBowlMama from '@/components/home/AboutBowlMama';
import FaqSection from '@/components/home/FaqSection';
import FeedbackSection from '@/components/home/FeedbackSection';
import Footer from '@/components/home/Footer';
import { weeklyMenu, MenuItem } from '@/data/weeklyMenu';
import { AddOnSelection, CartBundle } from '@/types';
import { useCartStore } from '@/store/cartStore';
import { MenuDateInfo, computeMenuDates } from '@/lib/dateUtils';
import { calcCartTotal, calcCartCount } from '@/lib/cartUtils';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { useAuth } from '@/context/AuthContext';
import { CheckCircle, AlertCircle } from 'lucide-react';

export default function V4BentoLayout() {
    const { cart, addBundle, updateBundle, updateQuantity, removeFromCart, clearCart } = useCartStore();
    const { currentUser } = useAuth();
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [isAddOnOpen, setIsAddOnOpen] = useState(false);
    const [selectedDish, setSelectedDish] = useState<MenuItem | null>(null);
    const [editConfig, setEditConfig] = useState<any>(null);
    const [minDate, setMinDate] = useState<string>('');
    const [menuDates, setMenuDates] = useState<Record<number, MenuDateInfo>>({});
    const [fpxSuccess, setFpxSuccess] = useState<{
        id: string;
        items: { name: string; nameEn?: string; qty: number; date: string; addOns?: string[]; addOnsEn?: string[] }[];
        total: number | null;
        trackInfo?: { token: string; date: string; time: string }[];
    } | null>(null);
    const [dishStock, setDishStock] = useState<Record<string, number>>({});
    // FPX 回跳失败的页内弹窗，取代 alert()。
    //
    // 这三条是全站最伤的 alert：客户刚从银行 App 转完钱、心里最紧张的那一秒，
    // 吃到一个顶着「www.incredibowl.my 显示：」的系统灰框，还要他**手抄**里面
    // 那串支付编号 —— 系统弹窗里的文字选不中、复制不了。现在给可一键复制的
    // 编号 + 一键把编号发给碗妈的按钮。
    const [fpxError, setFpxError] = useState<{ msg: string; paymentId?: string } | null>(null);
    const [copiedPid, setCopiedPid] = useState(false);
    // 访客绑定 Google 的结果提示（原来也是 alert）
    const [linkNotice, setLinkNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

    // Live per-dish stock for limited dishes (e.g. petai) → menu「仅剩 X / 售罄」.
    useEffect(() => {
        let alive = true;
        fetch('/api/dish-stock')
            .then(r => (r.ok ? r.json() : {}))
            .then(d => { if (alive && d && typeof d === 'object') setDishStock(d as Record<string, number>); })
            .catch(() => {});
        return () => { alive = false; };
    }, []);

    // Auth state now comes from the app-wide AuthProvider (root layout), so it
    // survives navigation between pages instead of re-initializing per page.

    // Handle FPX payment redirect results and cancel orphan pending orders.
    //
    // URL shapes after redirect:
    //   A) ?fpx_ok=1 &fpx_pid=... &fpx_oid=... &fpx_sig=...  (success via callback)
    //   B) ?razorpay_payment_id=... &razorpay_order_id=... &razorpay_signature=...  (direct)
    //   C) ?fpx_error=...  (failure)
    //   D) No FPX params but sessionStorage has pending → payment failed silently
    useEffect(() => {
        const url = new URL(window.location.href);
        // localStorage, NOT sessionStorage: mobile FPX hops out to the bank
        // app/site and Android/iOS browsers routinely kill the original tab —
        // sessionStorage dies with it and the success modal never showed
        // (boss repro'd 2026-07-05, order #9KP8D8). localStorage survives the
        // round-trip. Keep reading legacy sessionStorage for payments started
        // before this deploy.
        const pendingStr = localStorage.getItem('fpx_pending_order') || sessionStorage.getItem('fpx_pending_order');

        // ── 英文客户转交给 /en ─────────────────────────────────
        // 这里是中文首页。银行回跳只会落在 fpx-callback 指定的路径上，一旦那个
        // locale query 丢了（Razorpay 是否在所有支付方式下都保留尚未实测），英文
        // 客户就会带着 fpx_ok 落在这一页，看到一屏中文成功弹窗。
        //
        // 快照是我们自己写的 localStorage，活过银行往返，比 URL 参数可靠：里面
        // locale==='en' 就把整串参数原样转交给 /en，由那边的英文流程接手。必须
        // 抢在下面任何一条分支之前 return —— 否则订单会被这一页先确认/取消掉，
        // 转过去的 /en 拿到的是一个已经处理完的 URL。
        const hasFpxParams = url.searchParams.has('fpx_ok')
            || url.searchParams.has('fpx_error')
            || url.searchParams.has('razorpay_payment_id');
        if (hasFpxParams && pendingStr) {
            try {
                if (JSON.parse(pendingStr).locale === 'en') {
                    window.location.replace(`/en${url.search}`);
                    return;
                }
            } catch { /* 快照坏了就当中文，照常往下走 */ }
        }

        const clearPendingStore = () => {
            localStorage.removeItem('fpx_pending_order');
            sessionStorage.removeItem('fpx_pending_order');
        };

        // Helper: cancel pending orders
        const cancelPending = () => {
            if (!pendingStr) return;
            try {
                const { orderIds } = JSON.parse(pendingStr);
                fetch('/api/confirm-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderIds, status: 'cancelled' }),
                }).catch(() => {});
            } catch (e) {
                console.error('FPX pending order cancel error:', e);
            }
            clearPendingStore();
        };

        // --- Error path: explicit FPX failure ---
        const fpxErr = url.searchParams.get('fpx_error');
        if (fpxErr) {
            url.searchParams.delete('fpx_error');
            window.history.replaceState({}, '', url.toString());
            cancelPending();
            setFpxError({ msg: 'FPX 支付未能完成，请重试或选择其他方式。' });
            return;
        }

        // --- Success path: verify signature and confirm ---
        const fpxOk = url.searchParams.get('fpx_ok');
        const pid = (fpxOk ? url.searchParams.get('fpx_pid') : url.searchParams.get('razorpay_payment_id'));
        const oid = (fpxOk ? url.searchParams.get('fpx_oid') : url.searchParams.get('razorpay_order_id'));
        const sig = (fpxOk ? url.searchParams.get('fpx_sig') : url.searchParams.get('razorpay_signature'));

        if (pid && oid && sig) {
            ['fpx_ok', 'fpx_pid', 'fpx_oid', 'fpx_sig',
                'razorpay_payment_id', 'razorpay_order_id', 'razorpay_signature']
                .forEach(k => url.searchParams.delete(k));
            window.history.replaceState({}, '', url.toString());

            if (!pendingStr) {
                // Snapshot lost anyway (e.g. payment finished in a different
                // browser context, like an in-app browser). The webhook
                // confirms the order server-side; here we just verify the
                // signature is genuine and show a generic success modal so
                // the customer isn't left staring at a silent homepage.
                fetch('/api/payment/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ razorpay_payment_id: pid, razorpay_order_id: oid, razorpay_signature: sig }),
                })
                    .then(r => r.json())
                    .then(v => {
                        if (v.verified) {
                            setFpxSuccess({ id: pid, items: [], total: null });
                            clearCart();
                        }
                    })
                    .catch(() => {});
                return;
            }
            clearPendingStore();

            try {
                const { orderIds, isMultiPart, groupId, summary } = JSON.parse(pendingStr);
                fetch('/api/payment/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ razorpay_payment_id: pid, razorpay_order_id: oid, razorpay_signature: sig }),
                })
                    .then(r => r.json())
                    .then(async (verifyData) => {
                        if (!verifyData.verified) {
                            setFpxError({ msg: '支付验证失败，请联系碗妈处理。', paymentId: pid });
                            return;
                        }
                        const payData = { razorpayPaymentId: pid, razorpayOrderId: oid, razorpaySignature: sig };
                        const confirmRes = await fetch('/api/confirm-order', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ orderIds, status: 'confirmed', paymentData: payData }),
                        });
                        if (!confirmRes.ok) throw new Error('订单确认失败');
                        // Fire Meta Pixel Purchase per order (deduped via eventID
                        // against the CAPI events fired server-side in confirm-order).
                        try {
                            const confirmData = await confirmRes.clone().json();
                            const purchaseEventIds: Record<string, string> = confirmData?.purchaseEventIds || {};
                            const fbq = typeof window !== 'undefined' ? (window as { fbq?: (...args: unknown[]) => void }).fbq : undefined;
                            if (fbq) {
                                const parsed = JSON.parse(pendingStr);
                                const payloads: Array<{ total?: number }> = Array.isArray(parsed?.payloads) ? parsed.payloads : [];
                                for (let i = 0; i < orderIds.length; i++) {
                                    const eventId = purchaseEventIds[orderIds[i]];
                                    if (!eventId) continue;
                                    const v = typeof payloads[i]?.total === 'number' ? payloads[i].total : 0;
                                    fbq('track', 'Purchase', { value: v, currency: 'MYR' }, { eventID: eventId });
                                }
                            }
                        } catch { /* tracking is best-effort */ }
                        const successId = isMultiPart ? groupId : orderIds[0];
                        // Persistent modal — closed only by user click. The old 5s
                        // auto-dismiss fired while customers were still returning
                        // from the bank redirect and was routinely missed.
                        setFpxSuccess({
                            id: successId,
                            items: Array.isArray(summary?.items) ? summary.items : [],
                            total: typeof summary?.total === 'number' ? summary.total : null,
                            trackInfo: Array.isArray(summary?.trackInfo) ? summary.trackInfo : [],
                        });
                        clearCart();
                    })
                    .catch((err) => {
                        console.error('FPX order confirmation failed:', err);
                        setFpxError({ msg: '订单确认失败，请联系碗妈处理。', paymentId: pid });
                    });
            } catch (e) {
                console.error('FPX pending order parse error:', e);
            }
            return;
        }

        // --- Fallback: no FPX URL params but pending order exists ---
        // Page loaded/refreshed without payment params. Could be:
        //   (a) user closed Razorpay mid-flow → safe to cancel
        //   (b) user pressed F5 / nav while Razorpay redirect was in flight → DON'T cancel
        // Guard with createdAt: only cancel pending older than 10 minutes (FPX
        // normally completes in <60s). Younger pendings get left alone — the
        // legitimate redirect path will pick them up on next load.
        if (pendingStr) {
            try {
                const { createdAt } = JSON.parse(pendingStr);
                const ageMs = typeof createdAt === 'number' ? Date.now() - createdAt : Infinity;
                if (ageMs > 10 * 60 * 1000) {
                    cancelPending();
                }
            } catch {
                cancelPending();
            }
        }
    }, []);

    useEffect(() => {
        const { menuDates: dates, minDate: min } = computeMenuDates(weeklyMenu);
        setMenuDates(dates);
        setMinDate(min);
    }, []);

    // Deep-link: ?prefill=tomorrow → auto-open AddOn modal for the next
    // upcoming special. Used by retargeting ads ("Tomorrow's menu: X") so a
    // returning visitor lands one tap from checkout instead of having to
    // scroll-then-tap-then-tap.
    //
    // Only fires once menuDates is populated so disabled-date guards apply.
    useEffect(() => {
        if (!Object.keys(menuDates).length) return;
        const params = new URLSearchParams(window.location.search);
        if (params.get('prefill') !== 'tomorrow') return;

        import('@/lib/nextSpecial').then(({ computeNextSpecial }) => {
            const { dish } = computeNextSpecial();
            const dInfo = menuDates[dish.id];
            if (dInfo?.disabled) return;
            setSelectedDish(dish);
            setIsAddOnOpen(true);
        });

        // Strip the param so a refresh doesn't re-open the modal.
        params.delete('prefill');
        const next = params.toString();
        window.history.replaceState({}, '', next ? `?${next}` : window.location.pathname);
    }, [menuDates]);

    // Deep-link: ?cart=open → open the cart drawer on arrival. Used by the
    // member-page one-tap reorder, which refills the cart (localStorage) then
    // redirects here so the customer lands straight on checkout.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('cart') !== 'open') return;
        setIsCartOpen(true);
        params.delete('cart');
        const next = params.toString();
        window.history.replaceState({}, '', next ? `?${next}` : window.location.pathname);
    }, []);

    const openAddOnModal = (dish: MenuItem) => {
        const dInfo = menuDates[dish.id];
        // No date info yet → refuse. The menu cards now ship in the prerendered
        // HTML (2026-08-01), so there is a window between hydration and the
        // computeMenuDates effect where dInfo is undefined. Opening the modal
        // then would hand it defaultDate=undefined / minDate='' → the bundle
        // lands in the cart with selectedDate:'' and /api/submit-order rejects
        // it as invalid_format. It would also bypass the retired/blocked check,
        // which lives entirely in menuDates. Default closed, unlock on data.
        if (!dInfo || dInfo.disabled) return;
        setSelectedDish(dish);
        setIsAddOnOpen(true);
    };

    const handleAddWithAddOns = (dish: MenuItem, addOns: AddOnSelection[], bundleTotalPrice: number, note: string, sDate: string, sTime: string, dishQty: number, editCartItemId?: string) => {
        if (editCartItemId) {
            updateBundle(editCartItemId, { dish, dishQty, addOns, price: bundleTotalPrice, note, selectedDate: sDate, selectedTime: sTime });
        } else {
            const cartItemId = `${dish.id}-${Date.now()}`;
            addBundle({ cartItemId, dish, dishQty, addOns, note, selectedDate: sDate, selectedTime: sTime, price: bundleTotalPrice, quantity: 1 });
        }
        setEditConfig(null);
        setIsCartOpen(true);
    };

    const handleEditCartItem = (bundle: CartBundle) => {
        setSelectedDish(bundle.dish);
        const initQuantities: Record<string, number> = {};
        bundle.addOns.forEach(a => { initQuantities[a.item.id] = a.quantity; });
        setEditConfig({ cartItemId: bundle.cartItemId, quantities: initQuantities, dishQty: bundle.dishQty, note: bundle.note, selectedDate: bundle.selectedDate, selectedTime: bundle.selectedTime });
        setIsCartOpen(false);
        setIsAddOnOpen(true);
    };

    const cartTotal = calcCartTotal(cart);
    const cartCount = calcCartCount(cart);

    return (
        <div className="min-h-screen bg-[#FDFBF7] text-[#1A2D23] font-sans">
            <NavBar
                currentUser={currentUser}
                cartCount={cartCount}
                cartTotal={cartTotal}
                onCartOpen={() => setIsCartOpen(true)}
                onAuthOpen={() => setIsAuthOpen(true)}
            />

            <main className="pt-32 pb-32 px-4 max-w-7xl lg:max-w-screen-2xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 auto-rows-min">
                    <CutoffBanner />
                    <HeroSection />
                    {/* Desktop declutters the above-the-fold stack: the trust strip
                        moves down to sit right before the menu (social proof at the
                        decision point), the FAQ teaser lives in the FAQ section, and
                        the promo banner re-renders after the menu (when the
                        "review → free side" pitch is actually relevant). Mobile keeps
                        the original order — mobile layout is frozen. */}
                    <div className="contents lg:hidden">
                        <HeroTrustStrip />
                    </div>
                    <DeliveryWidget />
                    <div className="contents lg:hidden">
                        <PromoBanner />
                    </div>
                    <FaqHeroStrip />
                    <div className="hidden lg:contents">
                        <HeroTrustStrip />
                    </div>
                    <ErrorBoundary>
                        <MenuCarousel menuDates={menuDates} onOpenAddOn={openAddOnModal} dishStock={dishStock} />
                    </ErrorBoundary>
                    <div className="hidden lg:contents">
                        <PromoBanner />
                    </div>
                    <ErrorBoundary>
                        <AboutBowlMama />
                    </ErrorBoundary>
                    <ErrorBoundary>
                        <FeedbackSection />
                    </ErrorBoundary>
                    <ErrorBoundary>
                        <FaqSection />
                    </ErrorBoundary>
                </div>
            </main>

            <Footer />

            <WhatsAppFloat />
            <WhatsAppStickyBar />
            <SubscribeModal />

            {isCartOpen && (
            <ErrorBoundary>
                <CartDrawer
                    isOpen={isCartOpen}
                    onClose={() => setIsCartOpen(false)}
                    cart={cart}
                    updateQuantity={updateQuantity}
                    removeFromCart={removeFromCart}
                    cartTotal={cartTotal}
                    cartCount={cartCount}
                    onAuthOpen={() => { setIsCartOpen(false); setIsAuthOpen(true); }}
                    onClearCart={clearCart}
                    onEditItem={handleEditCartItem}
                />
            </ErrorBoundary>
            )}
            <ErrorBoundary>
                <AuthModal
                    isOpen={isAuthOpen}
                    onClose={() => setIsAuthOpen(false)}
                    onProfileComplete={() => {
                        // 资料存齐 → 关弹窗；购物车有东西就直接送回结账
                        setIsAuthOpen(false);
                        if (cart.length > 0) setIsCartOpen(true);
                    }}
                />
            </ErrorBoundary>
            {/* FPX redirect success overlay */}
            {fpxSuccess && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setFpxSuccess(null)}>
                    <div className="bg-white rounded-3xl p-8 text-center max-w-sm mx-4 shadow-2xl animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle size={44} className="text-green-500" />
                        </div>
                        <h3 className="text-2xl font-black text-[#1A2D23] mb-2">FPX 支付成功！🎉</h3>
                        <p className="text-sm text-gray-500 mb-1">
                            订单编号：<span className="font-bold text-[#FF6B35]">#{fpxSuccess.id.startsWith('GRP') ? fpxSuccess.id : fpxSuccess.id.slice(-6).toUpperCase()}</span>
                        </p>
                        {fpxSuccess.items.length > 0 && (
                            <div className="mt-3 bg-gray-50 rounded-xl p-3 text-left text-sm text-gray-600 space-y-1">
                                {fpxSuccess.items.map((it, i) => (
                                    <div key={i} className="flex justify-between gap-3">
                                        <span>{it.name} ×{it.qty}{it.addOns?.length ? ` + ${it.addOns.join(' + ')}` : ''}</span>
                                        <span className="text-gray-400 whitespace-nowrap">{it.date}</span>
                                    </div>
                                ))}
                                {fpxSuccess.total != null && (
                                    <div className="flex justify-between border-t border-gray-200 pt-1.5 mt-1.5 font-bold text-[#1A2D23]">
                                        <span>已付总额</span>
                                        <span>RM {fpxSuccess.total.toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                        )}
                        <p className="text-xs text-gray-400 mt-3">订单已确认，感谢您的订购！</p>
                        {/* WhatsApp confirmation deep link — puts a copy of the
                            order in the customer's own chat (their receipt) and
                            opens the private-domain channel in one tap. */}
                        <a
                            href={`https://wa.me/60165119118?text=${encodeURIComponent([
                                '你好碗妈 👋 我刚在网站付款下单成功，想在 WhatsApp 接收订单确认：',
                                `📌 订单号：#${fpxSuccess.id.startsWith('GRP') ? fpxSuccess.id : fpxSuccess.id.slice(-6).toUpperCase()}`,
                                ...fpxSuccess.items.map(it => `🍛 ${it.name} ×${it.qty}${it.addOns?.length ? ` + ${it.addOns.join(' + ')}` : ''}（${it.date}）`),
                                ...(fpxSuccess.total != null ? [`💰 已付 RM ${fpxSuccess.total.toFixed(2)}`] : []),
                                ...(fpxSuccess.trackInfo || []).map(t =>
                                    `📍 跟踪订单${(fpxSuccess.trackInfo || []).length > 1 ? `（${t.date} ${t.time?.includes('Lunch') ? '午餐' : '晚餐'}）` : ''}：https://www.incredibowl.my/track/${t.token}`),
                            ].join('\n'))}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 block w-full py-2.5 bg-[#25D366] text-white rounded-xl text-xs font-black hover:bg-[#1EBE57] transition-colors"
                        >
                            📲 WhatsApp 接收订单确认
                        </a>
                        {(fpxSuccess.trackInfo || []).map(t => (
                            <a
                                key={t.token}
                                href={`/track/${t.token}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 block w-full py-2.5 bg-white border-2 border-[#FF6B35] text-[#FF6B35] rounded-xl text-xs font-medium hover:bg-[#FF6B35]/5 transition-colors"
                            >
                                📍 跟踪订单{(fpxSuccess.trackInfo || []).length > 1 ? `（${t.date} ${t.time?.includes('Lunch') ? '午餐' : '晚餐'}）` : ''}
                            </a>
                        ))}
                        {/* Guest → Google upgrade: link in place, SAME uid, order
                            history preserved. Only shown to anonymous guests. */}
                        {currentUser?.isAnonymous && (
                            <button
                                onClick={async () => {
                                    try {
                                        const { linkGuestToGoogle } = await import('@/lib/auth');
                                        await linkGuestToGoogle();
                                        setLinkNotice({ kind: 'ok', text: '✅ 已绑定 Google！订单记录已保存，下次可一键回购' });
                                    } catch (e: any) {
                                        setLinkNotice({ kind: 'err', text: e?.code === 'auth/credential-already-in-use'
                                            ? '这个 Google 账号已有会员记录，想合并两边订单请 WhatsApp 碗妈处理'
                                            : '绑定未完成，可稍后再试（订单不受影响）' });
                                    }
                                }}
                                className="mt-3 w-full py-2.5 bg-[#1A2D23] text-white rounded-xl text-xs font-bold hover:bg-[#2A3D33] transition-colors"
                            >
                                🔗 绑定 Google 保存订单记录（下次一键回购）
                            </button>
                        )}
                        {linkNotice && (
                            <p className={`mt-2 px-3 py-2 rounded-lg text-[11px] font-bold leading-relaxed text-left ${linkNotice.kind === 'ok'
                                ? 'bg-green-50 border border-green-200 text-green-800'
                                : 'bg-red-50 border border-red-200 text-red-700'}`}>
                                {linkNotice.text}
                            </p>
                        )}
                        {/* Meal voucher upsell — subtle, below the confirmation info */}
                        <Link
                            href="/meal-vouchers"
                            className="mt-4 block bg-[#FFF3E0]/60 border border-[#FFD6B0]/60 rounded-xl px-4 py-2.5 text-xs font-bold text-[#1A2D23]/70 hover:border-[#FF6B35]/50 hover:text-[#1A2D23] transition-colors"
                        >
                            喜欢碗妈的菜？<span className="text-[#FF6B35]">餐券包更划算 →</span>
                        </Link>
                        <button onClick={() => setFpxSuccess(null)} className="mt-4 px-6 py-2.5 bg-[#FF6B35] text-white rounded-xl text-sm font-bold hover:bg-[#E95D31] transition-colors">好的</button>
                    </div>
                </div>
            )}

            {/* FPX 失败弹窗 —— 与上面的成功弹窗对称。取代三条 alert：
                客户刚从银行页回来最慌的那一秒，不该吃一个顶着域名前缀、
                文字还选不中的系统灰框。支付编号可一键复制 + 一键发给碗妈。 */}
            {fpxError && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setFpxError(null)}>
                    <div className="bg-white rounded-3xl p-7 text-center max-w-sm mx-4 shadow-2xl animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertCircle size={36} className="text-red-500" />
                        </div>
                        <h3 className="text-xl font-black text-[#1A2D23] mb-2">{fpxError.msg}</h3>
                        {fpxError.paymentId ? (
                            <>
                                <p className="text-xs text-gray-500 leading-relaxed mb-3">
                                    钱可能已经扣了。把下面的支付编号发给碗妈，我们马上帮你查。
                                </p>
                                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 mb-3">
                                    <span className="text-[10px] font-medium text-gray-400 shrink-0">支付编号</span>
                                    <code className="flex-1 min-w-0 truncate text-[11px] font-bold text-[#1A2D23] text-left">{fpxError.paymentId}</code>
                                    <button
                                        type="button"
                                        onClick={() => { navigator.clipboard?.writeText(fpxError.paymentId!).then(() => { setCopiedPid(true); setTimeout(() => setCopiedPid(false), 2000); }).catch(() => {}); }}
                                        className="shrink-0 px-2.5 py-1 rounded-lg bg-[#1A2D23] text-white text-[10px] font-bold"
                                    >
                                        {copiedPid ? '已复制' : '复制'}
                                    </button>
                                </div>
                                <a
                                    href={`https://wa.me/60103370197?text=${encodeURIComponent(`你好碗妈 🙏 我刚下单付款出了问题：\n${fpxError.msg}\n支付编号：${fpxError.paymentId}`)}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="block w-full py-2.5 bg-[#25D366] text-white rounded-xl text-xs font-black hover:bg-[#1EBE57] transition-colors"
                                >
                                    📲 把这条发给碗妈处理
                                </a>
                            </>
                        ) : (
                            <p className="text-xs text-gray-500 leading-relaxed">没有扣款。可以重新下单，或换 DuitNow QR 付款。</p>
                        )}
                        <button onClick={() => setFpxError(null)} className="mt-4 px-6 py-2.5 bg-[#FF6B35] text-white rounded-xl text-sm font-bold hover:bg-[#E95D31] transition-colors">知道了</button>
                    </div>
                </div>
            )}

            {selectedDish && (
                <AddOnModal
                    isOpen={isAddOnOpen}
                    onClose={() => { setIsAddOnOpen(false); setEditConfig(null); }}
                    dish={selectedDish}
                    onAddToCart={handleAddWithAddOns}
                    defaultDate={menuDates[selectedDish.id]?.actualDate}
                    isDaily={selectedDish.day === 'Daily / 常驻'}
                    minDate={minDate}
                    dateLabel={menuDates[selectedDish.id]?.topTag}
                    initialConfig={editConfig}
                />
            )}
        </div>
    );
}
