"use client";

import React, { useState, useEffect } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import dynamic from 'next/dynamic';

const AuthModal = dynamic(() => import('@/components/auth/AuthModal'), { ssr: false });
const CartDrawer = dynamic(() => import('@/components/cart/CartDrawer'), { ssr: false });
const AddOnModal = dynamic(() => import('@/components/menu/AddOnModal'), { ssr: false });
import NavBar from '@/components/home/NavBar';
import HeroSection from '@/components/home/HeroSection';
import DeliveryWidget from '@/components/home/DeliveryWidget';
import MenuCarousel from '@/components/home/MenuCarousel';
import FeedbackSection from '@/components/home/FeedbackSection';
import Footer from '@/components/home/Footer';
import { weeklyMenu, MenuItem } from '@/data/weeklyMenu';
import { AddOnSelection, CartBundle } from '@/types';
import { useCartStore } from '@/store/cartStore';
import { MenuDateInfo, computeMenuDates } from '@/lib/dateUtils';
import { calcCartTotal, calcCartCount } from '@/lib/cartUtils';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { CheckCircle } from 'lucide-react';

export default function V4BentoLayout() {
    const { cart, addBundle, updateBundle, updateQuantity, removeFromCart, clearCart } = useCartStore();
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [isAddOnOpen, setIsAddOnOpen] = useState(false);
    const [selectedDish, setSelectedDish] = useState<MenuItem | null>(null);
    const [editConfig, setEditConfig] = useState<any>(null);
    const [minDate, setMinDate] = useState<string>('');
    const [menuDates, setMenuDates] = useState<Record<number, MenuDateInfo>>({});
    const [fpxSuccessId, setFpxSuccessId] = useState<string | null>(null);

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;
        import('@/lib/auth').then(({ onAuthChange }) => {
            unsubscribe = onAuthChange((user) => setCurrentUser(user));
        });
        return () => unsubscribe?.();
    }, []);

    // Auto-cancel stale FPX pending orders (>10 min old, user likely closed browser/bank page)
    useEffect(() => {
        const pendingStr = sessionStorage.getItem('fpx_pending_order');
        if (!pendingStr) return;
        try {
            const pending = JSON.parse(pendingStr);
            const age = Date.now() - (pending.createdAt || 0);
            if (pending.createdAt && age > 10 * 60 * 1000) {
                fetch('/api/confirm-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderIds: pending.orderIds, status: 'cancelled' }),
                }).catch(() => {});
                sessionStorage.removeItem('fpx_pending_order');
            }
        } catch { /* ignore */ }
    }, []);

    // Detect return from FPX bank redirect and confirm pending orders.
    //
    // Two possible URL shapes after redirect:
    //   A) Via /api/payment/fpx-callback (future callback_url):
    //      ?fpx_ok=1 &fpx_pid=PAY_xxx &fpx_oid=ORD_xxx &fpx_sig=<signature>
    //   B) Direct Razorpay redirect (no callback_url set):
    //      ?razorpay_payment_id=PAY_xxx &razorpay_order_id=ORD_xxx &razorpay_signature=<sig>
    //
    // In both cases: verify signature → updateOrderStatus(pending → confirmed).
    useEffect(() => {
        const url = new URL(window.location.href);

        // --- Error path ---
        const fpxErr = url.searchParams.get('fpx_error');
        if (fpxErr) {
            url.searchParams.delete('fpx_error');
            window.history.replaceState({}, '', url.toString());

            const pendingStr = sessionStorage.getItem('fpx_pending_order');
            if (pendingStr) {
                try {
                    const { orderIds } = JSON.parse(pendingStr);
                    // Cancel orphan pending orders on FPX error
                    fetch('/api/confirm-order', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ orderIds, status: 'cancelled' }),
                    }).catch(() => { });
                } catch (e) {
                    console.error('FPX pending order parse error during cancellation:', e);
                }
            }

            sessionStorage.removeItem('fpx_pending_order');
            alert('FPX 支付未能完成，请重试或选择其他方式。');
            return;
        }

        // --- Path A: via fpx-callback ---
        const fpxOk = url.searchParams.get('fpx_ok');
        const fpxPid = url.searchParams.get('fpx_pid');
        const fpxOid = url.searchParams.get('fpx_oid');
        const fpxSig = url.searchParams.get('fpx_sig');

        // --- Path B: direct Razorpay redirect ---
        const rzpPid = url.searchParams.get('razorpay_payment_id');
        const rzpOid = url.searchParams.get('razorpay_order_id');
        const rzpSig = url.searchParams.get('razorpay_signature');

        const pid = (fpxOk && fpxPid) ? fpxPid : rzpPid;
        const oid = (fpxOk && fpxOid) ? fpxOid : rzpOid;
        const sig = (fpxOk && fpxSig) ? fpxSig : rzpSig;

        if (!pid || !oid || !sig) return;

        // Clean URL
        ['fpx_ok', 'fpx_pid', 'fpx_oid', 'fpx_sig',
            'razorpay_payment_id', 'razorpay_order_id', 'razorpay_signature']
            .forEach(k => url.searchParams.delete(k));
        window.history.replaceState({}, '', url.toString());

        const pendingStr = sessionStorage.getItem('fpx_pending_order');
        if (!pendingStr) return;
        sessionStorage.removeItem('fpx_pending_order');

        try {
            const { orderIds, isMultiPart, groupId, payloads } = JSON.parse(pendingStr);
            // Verify signature server-side before confirming
            fetch('/api/payment/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ razorpay_payment_id: pid, razorpay_order_id: oid, razorpay_signature: sig }),
            })
                .then(r => r.json())
                .then(async (verifyData) => {
                    if (!verifyData.verified) {
                        alert('支付验证失败，请联系客服并提供支付编号：' + pid);
                        return;
                    }
                    const payData = { razorpayPaymentId: pid, razorpayOrderId: oid, razorpaySignature: sig };
                    const confirmRes = await fetch('/api/confirm-order', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ orderIds, status: 'confirmed', paymentData: payData }),
                    });
                    if (!confirmRes.ok) throw new Error('订单确认失败');
                    const successId = isMultiPart ? groupId : orderIds[0];
                    setFpxSuccessId(successId);
                    clearCart();
                    setTimeout(() => setFpxSuccessId(null), 5000);
                })
                .catch((err) => {
                    console.error('FPX order confirmation failed:', err);
                    alert('订单确认失败，请联系客服并提供支付编号：' + pid);
                });
        } catch (e) {
            console.error('FPX pending order parse error:', e);
        }
    }, []);

    useEffect(() => {
        const { menuDates: dates, minDate: min } = computeMenuDates(weeklyMenu);
        setMenuDates(dates);
        setMinDate(min);
    }, []);

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
        <div className="min-h-screen bg-[#FDFBF7] text-[#1A2D23] font-sans">
            <style jsx global>{`

                h1, h2, h3, h4, h5, h6 { font-family: 'Plus Jakarta Sans', 'Noto Sans SC', sans-serif; }
                body { font-family: 'Plus Jakarta Sans', 'Noto Sans SC', sans-serif; }
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

            <NavBar
                currentUser={currentUser}
                cartCount={cartCount}
                onCartOpen={() => setIsCartOpen(true)}
                onAuthOpen={() => setIsAuthOpen(true)}
            />

            <main className="pt-32 pb-32 px-4 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 auto-rows-min">
                    <HeroSection />
                    <DeliveryWidget />
                    <ErrorBoundary>
                        <MenuCarousel menuDates={menuDates} onOpenAddOn={openAddOnModal} />
                    </ErrorBoundary>
                    <ErrorBoundary>
                        <FeedbackSection />
                    </ErrorBoundary>
                </div>
            </main>

            <Footer />

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
            {/* FPX redirect success overlay */}
            {fpxSuccessId && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setFpxSuccessId(null)}>
                    <div className="bg-white rounded-3xl p-8 text-center max-w-sm mx-4 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle size={44} className="text-green-500" />
                        </div>
                        <h3 className="text-2xl font-black text-[#1A2D23] mb-2">FPX 支付成功！🎉</h3>
                        <p className="text-sm text-gray-500 mb-1">
                            订单编号：<span className="font-bold text-[#FF6B35]">#{fpxSuccessId.startsWith('GRP') ? fpxSuccessId : fpxSuccessId.slice(-6).toUpperCase()}</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-2">订单已确认，感谢您的订购！<br />积分将在配送后自动发放。</p>
                        <button onClick={() => setFpxSuccessId(null)} className="mt-5 px-6 py-2.5 bg-[#FF6B35] text-white rounded-xl text-sm font-bold hover:bg-[#E95D31] transition-colors">好的</button>
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
