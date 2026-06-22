"use client";

import React, { useState, useEffect } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import dynamic from 'next/dynamic';

const AuthModal = dynamic(() => import('@/components/auth/AuthModal'), { ssr: false });
const CartDrawer = dynamic(() => import('@/components/cart/CartDrawer'), { ssr: false });
const AddOnModal = dynamic(() => import('@/components/menu/AddOnModal'), { ssr: false });
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
import { CheckCircle } from 'lucide-react';

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
    const [fpxSuccessId, setFpxSuccessId] = useState<string | null>(null);
    const [dishStock, setDishStock] = useState<Record<string, number>>({});

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
        const pendingStr = sessionStorage.getItem('fpx_pending_order');

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
            sessionStorage.removeItem('fpx_pending_order');
        };

        const fpxErr = url.searchParams.get('fpx_error');
        if (fpxErr) {
            url.searchParams.delete('fpx_error');
            window.history.replaceState({}, '', url.toString());
            cancelPending();
            alert('FPX payment did not complete. Please retry or use another method.');
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

            if (!pendingStr) return;
            sessionStorage.removeItem('fpx_pending_order');

            try {
                const { orderIds, isMultiPart, groupId } = JSON.parse(pendingStr);
                fetch('/api/payment/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ razorpay_payment_id: pid, razorpay_order_id: oid, razorpay_signature: sig }),
                })
                    .then(r => r.json())
                    .then(async (verifyData) => {
                        if (!verifyData.verified) {
                            alert('Payment verification failed. Please contact us with payment ID: ' + pid);
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
                        setFpxSuccessId(successId);
                        clearCart();
                        setTimeout(() => setFpxSuccessId(null), 5000);
                    })
                    .catch((err) => {
                        console.error('FPX order confirmation failed:', err);
                        alert('Order confirmation failed. Please contact us with payment ID: ' + pid);
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

    const openAddOnModal = (dish: MenuItem) => {
        const dInfo = menuDates[dish.id];
        if (dInfo && dInfo.disabled) return;
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
            <style jsx global>{`
                h1, h2, h3, h4, h5, h6 { font-family: 'Plus Jakarta Sans', "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif; }
                body { font-family: 'Plus Jakarta Sans', "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .menu-carousel-padding {
                    padding-left: calc(50% - 150px);
                    padding-right: calc(50% - 150px);
                    scroll-padding-inline: calc(50% - 150px);
                }
                @media (min-width: 768px) {
                    .menu-carousel-padding {
                        padding-left: calc(50% - 180px);
                        padding-right: calc(50% - 180px);
                        scroll-padding-inline: calc(50% - 180px);
                    }
                }
            `}</style>

            <NavBarEN
                currentUser={currentUser}
                cartCount={cartCount}
                cartTotal={cartTotal}
                onCartOpen={() => setIsCartOpen(true)}
                onAuthOpen={() => setIsAuthOpen(true)}
            />

            <main className="pt-32 pb-32 px-4 max-w-7xl lg:max-w-screen-2xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 auto-rows-min">
                    <CutoffBannerEN />
                    <HeroSectionEN />
                    <HeroTrustStripEN />
                    <DeliveryWidgetEN />
                    <PromoBannerEN />
                    <FaqHeroStripEN />
                    <ErrorBoundary>
                        <MenuCarouselEN menuDates={menuDates} onOpenAddOn={openAddOnModal} dishStock={dishStock} />
                    </ErrorBoundary>
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
                />
            </ErrorBoundary>
            )}
            <ErrorBoundary>
                <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
            </ErrorBoundary>

            {fpxSuccessId && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setFpxSuccessId(null)}>
                    <div className="bg-white rounded-3xl p-8 text-center max-w-sm mx-4 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle size={44} className="text-green-500" />
                        </div>
                        <h3 className="text-2xl font-black text-[#1A2D23] mb-2">FPX payment successful! 🎉</h3>
                        <p className="text-sm text-gray-500 mb-1">
                            Order ID: <span className="font-bold text-[#FF6B35]">#{fpxSuccessId.startsWith('GRP') ? fpxSuccessId : fpxSuccessId.slice(-6).toUpperCase()}</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-2">Order confirmed, thank you!</p>
                        <button onClick={() => setFpxSuccessId(null)} className="mt-5 px-6 py-2.5 bg-[#FF6B35] text-white rounded-xl text-sm font-bold hover:bg-[#E95D31] transition-colors">OK</button>
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
