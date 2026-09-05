"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const AuthModal = dynamic(() => import('@/components/auth/AuthModal'), { ssr: false });
const CartDrawer = dynamic(() => import('@/components/cart/CartDrawer'), { ssr: false });
const AddOnModal = dynamic(() => import('@/components/menu/AddOnModal'), { ssr: false });
// FPX 回跳的成功 / 失败弹窗（2026-09-05 F3：以前两个首页各写一套硬编码 overlay）
const CartSuccess = dynamic(() => import('@/components/cart/CartSuccess'), { ssr: false });
const PaymentErrorModal = dynamic(() => import('@/components/cart/PaymentErrorModal'), { ssr: false });
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
import type { PaymentErrorInfo } from '@/components/cart/PaymentErrorModal';

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
    const [fpxError, setFpxError] = useState<PaymentErrorInfo | null>(null);
    // 访客绑定 Google 的结果提示（原来也是 alert）

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
                const snap = JSON.parse(pendingStr);
                const { orderIds } = snap;
                // 持有凭证：银行跳回来时没有 session，confirm-order 2026-09-05 起要求
                // 无 token 的取消出示 trackToken（否则任何人拿到 orderId 就能烧掉
                // 别人的库存和餐券）。token 就在我们自己写的快照里。
                const holderTokens = (snap?.summary?.trackInfo || [])
                    .map((t: { token?: string }) => t?.token)
                    .filter(Boolean);
                fetch('/api/confirm-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderIds, status: 'cancelled', holderTokens }),
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
            setFpxError({ kind: 'fpxNotCompleted' });
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
                            setFpxError({ kind: 'verifyFailed', paymentId: pid });
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
                        setFpxError({ kind: 'confirmFailed', paymentId: pid });
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

            <main id="main" className="pt-32 pb-32 px-4 max-w-7xl lg:max-w-screen-2xl mx-auto">
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
                    <div className="hidden lg:contents">
                        <HeroTrustStrip />
                    </div>
                    <ErrorBoundary>
                        <MenuCarousel menuDates={menuDates} onOpenAddOn={openAddOnModal} dishStock={dishStock} />
                    </ErrorBoundary>
                    {/* 2026-09-05：移动端把「感恩折扣」和 FAQ 引导条挪到菜单**之后**。
                        实测点 Hero 主按钮后菜单标题落在 scrollY≈2575（第 4 屏）——
                        新客要先翻过运费表 + 好评送小菜 + 有没有店面，才看得到菜。
                        桌面端顺序原样不动。 */}
                    <div className="contents lg:hidden">
                        <PromoBanner />
                    </div>
                    <FaqHeroStrip />
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
            {/* FPX 回跳成功 → 与 QR 下单同一个成功页（CartSuccess，fpx 模式） */}
            {fpxSuccess && (
                <CartSuccess
                    locale="zh"
                    fpx={{ items: fpxSuccess.items, total: fpxSuccess.total }}
                    orderSuccess={{ id: fpxSuccess.id, items: [], total: fpxSuccess.total ?? 0, trackInfo: fpxSuccess.trackInfo }}
                    currentUser={currentUser}
                    onDone={() => setFpxSuccess(null)}
                />
            )}
            {fpxError && (
                <PaymentErrorModal locale="zh" error={fpxError} onClose={() => setFpxError(null)} />
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
