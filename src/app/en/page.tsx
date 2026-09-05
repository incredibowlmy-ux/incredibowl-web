"use client";

import React, { useState, useEffect } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import dynamic from 'next/dynamic';

const AuthModal = dynamic(() => import('@/components/auth/AuthModal'), { ssr: false });
const CartDrawer = dynamic(() => import('@/components/cart/CartDrawer'), { ssr: false });
const AddOnModal = dynamic(() => import('@/components/menu/AddOnModal'), { ssr: false });
// FPX 回跳的成功 / 失败弹窗（2026-09-05 F3：以前两个首页各写一套硬编码 overlay）
const CartSuccess = dynamic(() => import('@/components/cart/CartSuccess'), { ssr: false });
const PaymentErrorModal = dynamic(() => import('@/components/cart/PaymentErrorModal'), { ssr: false });
const WhatsAppFloatEN = dynamic(() => import('@/components/home-en/WhatsAppFloatEN'), { ssr: false });
const SubscribeModalEN = dynamic(() => import('@/components/home-en/SubscribeModalEN'), { ssr: false });
const WhatsAppStickyBarEN = dynamic(() => import('@/components/home-en/WhatsAppStickyBarEN'), { ssr: false });

import NavBarEN from '@/components/home-en/NavBarEN';
import HeroSectionEN from '@/components/home-en/HeroSectionEN';
import FaqHeroStripEN from '@/components/home-en/FaqHeroStripEN';
import CutoffBannerEN from '@/components/home-en/CutoffBannerEN';
import HeroTrustStripEN from '@/components/home-en/HeroTrustStripEN';
import PromoBannerEN from '@/components/home-en/PromoBannerEN';
import DeliveryWidgetEN from '@/components/home-en/DeliveryWidgetEN';
import MenuCarouselEN from '@/components/home-en/MenuCarouselEN';
import AboutBowlMamaEN from '@/components/home-en/AboutBowlMamaEN';
import FaqSectionEN from '@/components/home-en/FaqSectionEN';
import FeedbackSectionEN from '@/components/home-en/FeedbackSectionEN';
import FooterEN from '@/components/home-en/FooterEN';

import { weeklyMenu, MenuItem } from '@/data/weeklyMenu';
import { AddOnSelection, CartBundle } from '@/types';
import { useCartStore } from '@/store/cartStore';
import { MenuDateInfo, computeMenuDates } from '@/lib/dateUtils';
import { calcCartTotal, calcCartCount } from '@/lib/cartUtils';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import type { PaymentErrorInfo } from '@/components/cart/PaymentErrorModal';

export default function EnglishHome() {
    const { cart, addBundle, updateBundle, updateQuantity, removeFromCart, clearCart } = useCartStore();
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [isAddOnOpen, setIsAddOnOpen] = useState(false);
    const [selectedDish, setSelectedDish] = useState<MenuItem | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // FPX failure modal replacing three alert() calls — mirrors src/app/page.tsx.
    // The customer has just come back from their bank app; a system dialog
    // stamped with the domain, whose payment ID they cannot even select to copy,
    // is the worst possible thing to show them at that moment.
    const [fpxError, setFpxError] = useState<PaymentErrorInfo | null>(null);

    // Live per-dish stock for limited dishes (e.g. petai) → menu "X left / Sold out".
    useEffect(() => {
        let alive = true;
        fetch('/api/dish-stock')
            .then(r => (r.ok ? r.json() : {}))
            .then(d => { if (alive && d && typeof d === 'object') setDishStock(d as Record<string, number>); })
            .catch(() => {});
        return () => { alive = false; };
    }, []);

    // Override <html lang> to en-MY for screen readers (root layout sets zh-MY by default)
    useEffect(() => {
        const prev = document.documentElement.lang;
        document.documentElement.lang = 'en-MY';
        return () => { document.documentElement.lang = prev; };
    }, []);

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;
        import('@/lib/auth').then(({ onAuthChange }) => {
            unsubscribe = onAuthChange((user) => setCurrentUser(user));
        });
        return () => unsubscribe?.();
    }, []);

    // FPX redirect handling — same as zh page
    useEffect(() => {
        const url = new URL(window.location.href);
        // localStorage, NOT sessionStorage — mobile FPX kills the original tab
        // during the bank hop and sessionStorage dies with it (see zh page).
        const pendingStr = localStorage.getItem('fpx_pending_order') || sessionStorage.getItem('fpx_pending_order');
        const clearPendingStore = () => {
            localStorage.removeItem('fpx_pending_order');
            sessionStorage.removeItem('fpx_pending_order');
        };

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

        const fpxErr = url.searchParams.get('fpx_error');
        if (fpxErr) {
            url.searchParams.delete('fpx_error');
            window.history.replaceState({}, '', url.toString());
            cancelPending();
            setFpxError({ kind: 'fpxNotCompleted' });
            return;
        }

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
                // Snapshot lost (payment finished in a different browser
                // context). Webhook confirms server-side; verify the signature
                // and show a generic success modal.
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
                        if (!confirmRes.ok) throw new Error('Order confirmation failed');
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

        // Guard with createdAt: only cancel pending orders older than 10 min.
        // A fresh pending may belong to an in-flight Razorpay redirect — don't
        // kill it just because the page was refreshed.
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
        const { menuDates: dates, minDate: min } = computeMenuDates(weeklyMenu, 'en');
        setMenuDates(dates);
        setMinDate(min);
    }, []);

    // Deep-link: ?prefill=tomorrow → auto-open AddOn modal for the next
    // upcoming special. Used by retargeting ads on the EN locale.
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
        // No date info yet → refuse. Mirrors src/app/page.tsx — see the comment
        // there for why the guard is inverted now that cards are prerendered.
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
        <div className="min-h-screen bg-[#FDFBF7] text-[#1A2D23] font-sans" lang="en-MY">
            <NavBarEN
                currentUser={currentUser}
                cartCount={cartCount}
                cartTotal={cartTotal}
                onCartOpen={() => setIsCartOpen(true)}
                onAuthOpen={() => setIsAuthOpen(true)}
            />

            <main id="main" className="pt-32 pb-32 px-4 max-w-7xl lg:max-w-screen-2xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 auto-rows-min">
                    <CutoffBannerEN />
                    <HeroSectionEN />
                    {/* Desktop declutter mirrors the ZH homepage: trust strip moves
                        down to sit right before the menu (social proof at the decision
                        point), FAQ teaser hidden at lg, promo banner re-rendered after
                        the menu. Mobile keeps the original order — mobile is frozen. */}
                    <div className="contents lg:hidden">
                        <HeroTrustStripEN />
                    </div>
                    <DeliveryWidgetEN />
                    <div className="hidden lg:contents">
                        <HeroTrustStripEN />
                    </div>
                    <ErrorBoundary>
                        <MenuCarouselEN menuDates={menuDates} onOpenAddOn={openAddOnModal} dishStock={dishStock} />
                    </ErrorBoundary>
                    {/* 2026-09-05: on mobile the promo banner and FAQ teaser move BELOW
                        the menu. Measured on the ZH twin: tapping the hero CTA landed the
                        menu heading at scrollY≈2575 (4th screen) — a new customer had to
                        scroll past the fee table, the review-for-a-free-side pitch and
                        "do you have a shopfront" before seeing any food.
                        Desktop order is unchanged. */}
                    <div className="contents lg:hidden">
                        <PromoBannerEN />
                    </div>
                    <FaqHeroStripEN />
                    <div className="hidden lg:contents">
                        <PromoBannerEN />
                    </div>
                    <ErrorBoundary>
                        <AboutBowlMamaEN />
                    </ErrorBoundary>
                    <ErrorBoundary>
                        <FeedbackSectionEN />
                    </ErrorBoundary>
                    <ErrorBoundary>
                        <FaqSectionEN />
                    </ErrorBoundary>
                </div>
            </main>

            <FooterEN />

            <WhatsAppFloatEN />
            <WhatsAppStickyBarEN />
            <SubscribeModalEN />

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
                    locale="en"
                />
            </ErrorBoundary>
            )}
            <ErrorBoundary>
                <AuthModal
                    isOpen={isAuthOpen}
                    onClose={() => setIsAuthOpen(false)}
                    locale="en"
                    onProfileComplete={() => {
                        // Profile complete → close modal; send back to checkout if cart has items
                        setIsAuthOpen(false);
                        if (cart.length > 0) setIsCartOpen(true);
                    }}
                />
            </ErrorBoundary>

            {/* FPX 回跳成功 → 与 QR 下单同一个成功页（CartSuccess，fpx 模式） */}
            {fpxSuccess && (
                <CartSuccess
                    locale="en"
                    fpx={{ items: fpxSuccess.items, total: fpxSuccess.total }}
                    orderSuccess={{ id: fpxSuccess.id, items: [], total: fpxSuccess.total ?? 0, trackInfo: fpxSuccess.trackInfo }}
                    currentUser={currentUser}
                    onDone={() => setFpxSuccess(null)}
                />
            )}
            {fpxError && (
                <PaymentErrorModal locale="en" error={fpxError} onClose={() => setFpxError(null)} />
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
                    locale="en"
                    initialConfig={editConfig}
                />
            )}
        </div>
    );
}
