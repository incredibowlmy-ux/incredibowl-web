"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingBag, X, Plus, Minus, AlertCircle, Tag, CheckCircle, Sparkles, Utensils, CreditCard, Phone, Calendar, Ticket } from 'lucide-react';
import { onAuthChange, getUserProfile } from '@/lib/auth';
// updateOrderStatus moved to server-side /api/confirm-order
import { User } from 'firebase/auth';
import { isValidMyPhone } from '@/lib/cartUtils';
import {
    resolveDeliveryFee,
    resolveShortfallToFree,
    FREE_DELIVERY_THRESHOLD_RM,
    type DeliveryTier,
    type DeliveryZone,
} from '@/lib/deliveryUtils';
import { isOrderDateValid } from '@/lib/cartDateUtils';
import { getDishPrice } from '@/data/promoConfig';
import CartSuccess from './CartSuccess';
import CartItemCard from './CartItemCard';
import QRPaymentSection from './QRPaymentSection';

export default function CartDrawer({
    isOpen,
    onClose,
    cart,
    removeFromCart,
    cartTotal,
    cartCount,
    onAuthOpen,
    onClearCart,
    onEditItem
}: any) {
    const [paymentMethod, setPaymentMethod] = useState<'qr' | 'fpx' | ''>('');
    const [receiptUploaded, setReceiptUploaded] = useState(false);
    const [receiptUrl, setReceiptUrl] = useState('');
    const [uploading, setUploading] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [orderNote, setOrderNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
    const [promoCode, setPromoCode] = useState('');
    const [promoApplied, setPromoApplied] = useState(false);
    const [promoError, setPromoError] = useState('');
    const [promoDiscount, setPromoDiscount] = useState(0);
    const [isCheckingPromo, setIsCheckingPromo] = useState(false);
    const [staleNotice, setStaleNotice] = useState<string>('');
    // Meal voucher (餐券) redemption state
    const [availableMealVouchers, setAvailableMealVouchers] = useState(0);
    const [mealVouchersUsed, setMealVouchersUsed] = useState(0);

    // Auto-clean cart items whose selectedDate has rotted (e.g. customer left
    // the cart open overnight and the 6 AM cutoff passed). Also reset checkout
    // state so the user re-validates voucher + re-picks payment for the new
    // cart (the old voucher may have expired or already been redeemed).
    useEffect(() => {
        if (!isOpen) return;
        const stale = cart.filter((item: any) => !isOrderDateValid(item.selectedDate).ok);
        if (stale.length === 0) {
            setStaleNotice('');
            return;
        }
        stale.forEach((item: any) => removeFromCart(item.cartItemId));
        setPromoCode('');
        setPromoApplied(false);
        setPromoDiscount(0);
        setPromoError('');
        setPaymentMethod('');
        setReceiptUploaded(false);
        setReceiptUrl('');
        setMealVouchersUsed(0);
        setStaleNotice(`已自动移除 ${stale.length} 个过期项目（截单已过），请重新加入今日菜单`);
    }, [isOpen, cart, removeFromCart]);

    // ── Meal voucher math ──────────────────────────────────────
    // Each main dish serving in the cart = one redeemable "slot".
    // The discount applied = sum of the X most-expensive serving prices,
    // so the customer always gets the best deal. Add-ons are excluded.
    const mainDishUnitPrices: number[] = cart.flatMap((bundle: any) => {
        const unitPrice = getDishPrice(bundle?.dish?.price ?? 0);
        const totalUnits = (bundle?.dishQty || 1) * (bundle?.quantity || 1);
        return Array.from({ length: totalUnits }, () => unitPrice);
    });
    const totalMainDishCount = mainDishUnitPrices.length;
    const maxRedeemable = Math.min(totalMainDishCount, availableMealVouchers);
    const cappedMealVouchersUsed = Math.min(mealVouchersUsed, maxRedeemable);
    const sortedMainDishPricesDesc = [...mainDishUnitPrices].sort((a, b) => b - a);
    const mealVoucherDiscount = sortedMainDishPricesDesc
        .slice(0, cappedMealVouchersUsed)
        .reduce((sum, p) => sum + p, 0);

    // Promo code and meal vouchers are mutually exclusive per order.
    const promoLockedByVouchers = cappedMealVouchersUsed > 0;
    const vouchersLockedByPromo = promoApplied;

    // Auto-cap the slider when cart shrinks
    useEffect(() => {
        if (mealVouchersUsed > maxRedeemable) {
            setMealVouchersUsed(maxRedeemable);
        }
    }, [maxRedeemable, mealVouchersUsed]);

    const subtotalAfterDiscount = Math.max(0, cartTotal - promoDiscount - mealVoucherDiscount);
    // Free-delivery threshold basis: cartTotal − promoDiscount only.
    // Meal voucher does NOT count against the basis (2026-05-11 rule) —
    // prepaid voucher revenue is already booked, so redeeming a main dish
    // shouldn't bump the customer out of the free-delivery tier.
    const freeDeliveryBasis = Math.max(0, cartTotal - promoDiscount);
    const distanceKm: number | null = typeof userProfile?.addressDistanceKm === 'number'
        ? userProfile.addressDistanceKm
        : null;
    const userZone: DeliveryZone | null =
        userProfile?.deliveryZone === 'within2km' || userProfile?.deliveryZone === 'outside2km'
            ? userProfile.deliveryZone
            : null;
    const resolved = resolveDeliveryFee(distanceKm, userZone, freeDeliveryBasis);
    const deliveryTier: DeliveryTier | null = resolved?.tier ?? null;
    const deliveryFee = resolved?.fee ?? 0;
    const shortfallToFreeDelivery = resolveShortfallToFree(distanceKm, userZone, freeDeliveryBasis);
    const finalTotal = subtotalAfterDiscount + deliveryFee;

    // Meal vouchers fully covered the bill (no cash to collect). Skips the
    // payment method selector + Razorpay flow entirely; we just submit the
    // order and immediately confirm it since there's nothing to charge.
    const isFullyCoveredByVouchers = !!currentUser && cappedMealVouchersUsed > 0 && finalTotal <= 0;

    const handleApplyPromo = async () => {
        const code = promoCode.trim().toUpperCase();
        if (!code) return;
        if (!currentUser) { onAuthOpen(); return; }
        setIsCheckingPromo(true);
        setPromoError('');
        try {
            const res = await fetch('/api/check-voucher', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ voucherCode: code, userId: currentUser.uid }),
            });
            const data = await res.json();
            if (!res.ok) {
                setPromoError(data.error || '优惠码无效');
                setPromoApplied(false); setPromoDiscount(0);
                return;
            }
            setPromoDiscount(data.discount);
            setPromoApplied(true);
            setPromoError('');
        } catch (err) {
            setPromoError('验证失败，请稍后再试');
        } finally {
            setIsCheckingPromo(false);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthChange(async (user: User | null) => {
            setCurrentUser(user);
            if (user) { const profile = await getUserProfile(user.uid); setUserProfile(profile); }
            else setUserProfile(null);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
        return () => { document.body.removeChild(script); };
    }, []);

    const initiateRazorpayPayment = (amountMYR: number): Promise<{ razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }> => {
        return new Promise(async (resolve, reject) => {
            try {
                const res = await fetch('/api/payment/create-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: Math.round(amountMYR * 100) }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || '创建支付订单失败');
                let resolved = false;
                const options = {
                    key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                    amount: data.amount, currency: data.currency, order_id: data.orderId,
                    name: 'Incredibowl', description: '餐点预订',
                    callback_url: `${window.location.origin}/api/payment/fpx-callback`,
                    redirect: true,
                    handler: (response: any) => { resolved = true; resolve(response); },
                    modal: {
                        ondismiss: () => {
                            // Razorpay test mode may fire ondismiss BEFORE handler.
                            // Wait 1.5 s to give handler a chance to settle first.
                            setTimeout(() => { if (!resolved) reject(new Error('已取消支付')); }, 1500);
                        },
                    },
                    prefill: {
                        name: (userProfile?.displayName || currentUser?.displayName || ''),
                        email: (currentUser?.email || ''),
                        contact: (userProfile?.phone || ''),
                    },
                    theme: { color: '#FF6B35' },
                };
                const rzp = new (window as any).Razorpay(options);
                rzp.open();
            } catch (err) { reject(err); }
        });
    };

    useEffect(() => {
        const fetchProfile = async () => {
            if (isOpen && currentUser) { const profile = await getUserProfile(currentUser.uid); setUserProfile(profile); }
        };
        fetchProfile();
    }, [isOpen, currentUser]);

    // Refresh available meal voucher count whenever drawer opens or auth changes
    useEffect(() => {
        const fetchMealVouchers = async () => {
            if (!isOpen || !currentUser) {
                setAvailableMealVouchers(0);
                return;
            }
            try {
                const token = await currentUser.getIdToken();
                const res = await fetch('/api/my-meal-vouchers', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) return;
                const data = await res.json();
                setAvailableMealVouchers(data.availableCount || 0);
            } catch (e) {
                console.warn('Failed to load meal vouchers:', e);
            }
        };
        fetchMealVouchers();
    }, [isOpen, currentUser]);

    if (!isOpen) return null;

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];

        // Guard 1: must be image
        if (!file.type.startsWith('image/')) {
            alert('请上传图片文件（JPG / PNG）');
            return;
        }
        // Guard 2: max 5MB (must match Storage Rules size limit)
        const MAX_BYTES = 5 * 1024 * 1024;
        if (file.size > MAX_BYTES) {
            alert(`图片太大（${(file.size / 1024 / 1024).toFixed(1)}MB），请压缩后上传，最大 5MB`);
            return;
        }
        // Guard 3: must be authenticated (Storage Rules 通常要求 request.auth != null)
        if (!currentUser) {
            alert('请先登录再上传付款凭证');
            return;
        }

        setUploading(true);
        try {
            const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
            const { storage } = await import('@/lib/firebase');
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const storageRef = ref(storage, `receipts/${currentUser.uid}/${Date.now()}_${safeName}`);
            await uploadBytes(storageRef, file, { contentType: file.type });
            setReceiptUrl(await getDownloadURL(storageRef));
            setReceiptUploaded(true);
        } catch (err: any) {
            console.error('[Receipt upload failed]', err);
            const code = err?.code || '';
            let msg = '上传失败，请重试';
            if (code === 'storage/unauthorized') msg = '上传被拒绝（Storage 权限规则未授权）。请联系客服并截图发 WhatsApp。';
            else if (code === 'storage/canceled') msg = '上传被取消，请重试';
            else if (code === 'storage/retry-limit-exceeded') msg = '网络太慢，请换 Wi-Fi 重试';
            else if (code === 'storage/quota-exceeded') msg = '存储空间已满，请联系客服';
            else if (err?.message) msg = `上传失败：${err.message}`;
            alert(msg);
        }
        setUploading(false);
    };

    /** Submit order via server-side API for price validation */
    const submitOrderViaAPI = async (overridePaymentMethod?: 'qr' | 'fpx' | 'voucher') => {
        const cartBundles = cart.map((item: any) => ({
            dishId: item.dish.id,
            dishQty: item.dishQty,
            addOns: (item.addOns || []).map((a: any) => ({
                id: a.item.id,
                name: a.item.name,
                nameEn: a.item.nameEn || '',
                quantity: a.quantity,
                image: a.item.image || '',
            })),
            price: item.price,
            quantity: item.quantity,
            selectedDate: item.selectedDate,
            selectedTime: item.selectedTime,
            note: item.note || '',
        }));

        const res = await fetch('/api/submit-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser!.uid,
                userName: currentUser!.displayName || userProfile?.displayName || 'Guest',
                userEmail: currentUser!.email || '',
                userPhone: userProfile!.phone,
                userAddress: userProfile!.address,
                cartBundles,
                paymentMethod: overridePaymentMethod || paymentMethod,
                receiptUploaded,
                receiptUrl: receiptUrl || undefined,
                promoCode: promoApplied ? promoCode.trim().toUpperCase() : '',
                promoDiscount: promoApplied ? promoDiscount : 0,
                clientDeliveryFee: deliveryFee,
                orderNote: orderNote || '',
                mealVouchersUsed: cappedMealVouchersUsed,
                clientMealVoucherDiscount: mealVoucherDiscount,
            }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '提交订单失败');
        return data as {
            orderIds: string[];
            groupId: string | null;
            isMultiPart: boolean;
            serverTotal: number;
            checkoutEventId?: string;
        };
    };

    /**
     * Fire a Pixel browser event with an eventID so it dedupes against
     * the matching CAPI server event already fired by /api/* routes.
     * Wrapped in a guard for SSR + ad-blocker scenarios.
     */
    const trackPixel = (
        name: 'InitiateCheckout' | 'Purchase',
        params: { value: number; currency: string },
        eventID?: string,
    ) => {
        if (typeof window === 'undefined') return;
        const fbq = (window as any).fbq;
        if (typeof fbq !== 'function') return;
        if (eventID) {
            fbq('track', name, params, { eventID });
        } else {
            fbq('track', name, params);
        }
    };

    const handleCheckout = async () => {
        if (!currentUser) { onAuthOpen(); return; }
        if (!userProfile?.phone || !userProfile?.address) { onAuthOpen(); return; }
        if (!isValidMyPhone(userProfile.phone)) {
            alert("手机号码格式不正确，请到会员资料更新，例: 010-337 0197"); onAuthOpen(); return;
        }
        if (cart.length > 0 && cart.some((item: any) => !item.selectedDate)) {
            alert("部分菜品未选择配送日期，请移除后重试！"); return;
        }

        // Voucher-only flow: meal vouchers covered the entire bill (no cash).
        // Mirror FPX pattern but skip Razorpay: submit creates pending order(s),
        // then confirm flips to 'confirmed' inline. Vouchers are claimed atomically
        // server-side; if confirm fails, vouchers stay claimed but order pending —
        // admin can sort that rare case out.
        if (isFullyCoveredByVouchers) {
            setSubmitting(true);
            try {
                const result = await submitOrderViaAPI('voucher');
                trackPixel('InitiateCheckout', { value: 0, currency: 'MYR' }, result.checkoutEventId);
                const confirmRes = await fetch('/api/confirm-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderIds: result.orderIds, status: 'confirmed' }),
                });
                if (!confirmRes.ok) {
                    throw new Error((await confirmRes.json()).error || '订单确认失败');
                }
                setOrderSuccess(result.isMultiPart ? result.groupId! : result.orderIds[0]);
                setTimeout(() => {
                    onClearCart(); setOrderSuccess(null); setReceiptUploaded(false);
                    setReceiptUrl(''); setOrderNote(''); setPromoCode('');
                    setPromoApplied(false); setPromoDiscount(0); setMealVouchersUsed(0);
                    onClose();
                }, 4000);
            } catch (err: any) {
                alert(err.message || '下单失败，请重试');
            }
            setSubmitting(false);
            return;
        }

        if (paymentMethod === 'qr' && !receiptUploaded) { alert("请先上传付款截图！"); return; }

        if (paymentMethod === 'fpx') {
            // Step 1: Submit orders via server-side validated API as 'pending' BEFORE opening payment.
            setSubmitting(true);
            let orderIds: string[] = [];
            let isMultiPart = false;
            let groupId: string | null = null;
            let checkoutEventId: string | undefined;
            try {
                const result = await submitOrderViaAPI();
                orderIds = result.orderIds;
                isMultiPart = result.isMultiPart;
                groupId = result.groupId;
                checkoutEventId = result.checkoutEventId;
                // Fire browser-side InitiateCheckout (deduped against CAPI by eventID)
                trackPixel('InitiateCheckout', { value: finalTotal, currency: 'MYR' }, checkoutEventId);
            } catch (err: any) {
                alert(err.message || '建立订单失败，请重试');
                setSubmitting(false);
                return;
            }
            // Step 2: Save for FPX redirect recovery in page.tsx.
            const payloads = orderIds.map(() => ({ userId: currentUser!.uid, total: finalTotal / orderIds.length }));
            sessionStorage.setItem('fpx_pending_order', JSON.stringify({ orderIds, groupId, isMultiPart, payloads, createdAt: Date.now() }));
            setSubmitting(false);

            try {
                const paymentResult = await initiateRazorpayPayment(finalTotal);
                const verifyRes = await fetch('/api/payment/verify', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(paymentResult),
                });
                const verifyData = await verifyRes.json();
                if (!verifyData.verified) { alert('支付验证失败，请联系客服'); return; }
                setSubmitting(true);
                const payData = {
                    razorpayPaymentId: paymentResult.razorpay_payment_id,
                    razorpayOrderId: paymentResult.razorpay_order_id,
                    razorpaySignature: paymentResult.razorpay_signature,
                };
                // Step 3: Confirm all pending orders via server-side API.
                const confirmRes = await fetch('/api/confirm-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderIds, status: 'confirmed', paymentData: payData }),
                });
                if (!confirmRes.ok) throw new Error((await confirmRes.json()).error || '订单确认失败');
                const confirmData = await confirmRes.json().catch(() => ({}));
                // Fire browser-side Purchase per order (deduped against CAPI by eventID).
                // Server-side CAPI events have authoritative per-order values; the
                // value we pass here is approximate (split evenly) and gets
                // dropped by Meta's dedup in favor of the server value.
                const purchaseEventIds: Record<string, string> = confirmData?.purchaseEventIds || {};
                const eventIdList = Object.values(purchaseEventIds);
                if (eventIdList.length > 0) {
                    const valuePerOrder = finalTotal / eventIdList.length;
                    for (const eventId of eventIdList) {
                        trackPixel('Purchase', { value: valuePerOrder, currency: 'MYR' }, eventId);
                    }
                }
                sessionStorage.removeItem('fpx_pending_order');
                setOrderSuccess(isMultiPart ? groupId! : orderIds[0]);
                setTimeout(() => { onClearCart(); setOrderSuccess(null); setReceiptUploaded(false); setReceiptUrl(''); setOrderNote(''); setPromoCode(''); setPromoApplied(false); setPromoDiscount(0); setMealVouchersUsed(0); onClose(); }, 4000);
            } catch (err: any) {
                // Cancel pending orders on any payment failure (dismiss, network error, verification fail, etc.)
                await fetch('/api/confirm-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderIds, status: 'cancelled' }),
                }).catch(() => {});
                sessionStorage.removeItem('fpx_pending_order');
                if (err.message !== '已取消支付') {
                    alert(err.message || '支付失败，请重试');
                }
            }
            setSubmitting(false);
            return;
        }

        // QR flow — also uses server-side validated API.
        // Note: QR creates a 'pending' order (admin reviews receipt later),
        // so we fire InitiateCheckout here, NOT Purchase. Purchase will fire
        // server-side via CAPI when admin transitions the order to 'confirmed'.
        setSubmitting(true);
        try {
            const result = await submitOrderViaAPI();
            trackPixel('InitiateCheckout', { value: finalTotal, currency: 'MYR' }, result.checkoutEventId);
            setOrderSuccess(result.isMultiPart ? result.groupId! : result.orderIds[0]);
            setTimeout(() => { onClearCart(); setOrderSuccess(null); setReceiptUploaded(false); setReceiptUrl(''); setOrderNote(''); setPromoCode(''); setPromoApplied(false); setPromoDiscount(0); setMealVouchersUsed(0); onClose(); }, 4000);
        } catch (error: any) { alert(`下单失败: ${error.message}`); }
        setSubmitting(false);
    };

    if (orderSuccess) {
        return <CartSuccess orderSuccess={orderSuccess} cart={cart} userProfile={userProfile} cartTotal={cartTotal} />;
    }

    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-[#1A2D23]/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-[#FDFBF7] h-full shadow-2xl flex flex-col border-l border-[#E3EADA] animate-in slide-in-from-right duration-500">

                {/* Header */}
                <div className="p-6 bg-white border-b border-[#E3EADA] flex justify-between items-center">
                    <h2 className="text-xl font-black flex items-center gap-3 text-[#1A2D23]">
                        <ShoppingBag size={22} /> 我的订单 ({cartCount})
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400"><X size={22} /></button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto flex flex-col">
                    {staleNotice && (
                        <div className="mx-6 mt-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                            <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-xs font-bold text-amber-800 leading-relaxed">{staleNotice}</p>
                        </div>
                    )}
                    {/* Delivery address */}
                    {cart.length > 0 && (
                        <div className="px-6 py-4 bg-[#1A2D23]/5 border-b border-[#E3EADA] shrink-0">
                            <p className="flex justify-between items-center bg-white p-2 rounded-lg border border-[#E3EADA]/50 text-xs font-bold text-[#1A2D23]">
                                <span className="text-gray-500 font-medium shrink-0">📍 送达地址</span>
                                <span className="truncate ml-4 text-right">
                                    {userProfile?.address || <span className="text-red-500">尚未填写 (请在下方补充)</span>}
                                </span>
                            </p>
                        </div>
                    )}

                    {/* Cart items */}
                    <div className="flex-1 p-6 space-y-4">
                        {cart.length === 0 ? (
                            <div className="text-center py-20 text-[#1A2D23]">
                                <div className="mb-6 flex flex-col items-center justify-center">
                                    <div className="w-20 h-20 bg-[#FF6B35]/5 rounded-full flex items-center justify-center mb-4">
                                        <Utensils className="w-10 h-10 text-[#FF6B35]/60" />
                                    </div>
                                    <p className="font-bold text-lg mb-2 text-[#3B2A1A]">碗妈的锅已经热好了 🍳</p>
                                    <p className="text-sm font-medium text-[#8B7355] max-w-[200px] leading-relaxed mx-auto">快去选一道今天心仪的家常菜吧！</p>
                                </div>
                                <button onClick={() => { onClose(); setTimeout(() => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' }), 300); }}
                                    className="px-8 py-3.5 bg-[#FF6B35] text-white text-base font-black rounded-2xl flex items-center justify-center gap-2 mx-auto hover:bg-[#E95D31] transition-all shadow-lg shadow-[#FF6B35]/20 hover:-translate-y-1 active:scale-95">
                                    <ShoppingBag size={18} /> 去选餐
                                </button>

                                {/* Meal voucher CTA — empty cart push */}
                                <div className="mt-8 mx-auto max-w-[280px]">
                                    <Link
                                        href="/meal-vouchers"
                                        onClick={onClose}
                                        className="group block bg-gradient-to-br from-[#FFF3E0] via-white to-[#FFE9D5] border border-[#FFD6B0]/60 rounded-2xl p-4 hover:shadow-lg transition-all relative overflow-hidden"
                                    >
                                        <div className="absolute -top-6 -right-6 w-24 h-24 bg-[#FF6B35]/10 rounded-full blur-2xl pointer-events-none" />
                                        <div className="relative flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-[#FF6B35] text-white flex items-center justify-center shrink-0 shadow-md shadow-[#FF6B35]/30">
                                                <Ticket size={20} />
                                            </div>
                                            <div className="flex-1 text-left min-w-0">
                                                <p className="text-xs font-black text-[#1A2D23]">先囤券更划算</p>
                                                <p className="text-[10px] text-[#1A2D23]/60 font-bold leading-snug">
                                                    20 张装省 RM 37 · 60 天有效
                                                </p>
                                            </div>
                                            <span className="text-xs font-black text-[#FF6B35] group-hover:translate-x-1 transition-transform">→</span>
                                        </div>
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <>
                                <button onClick={() => { onClose(); setTimeout(() => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' }), 300); }}
                                    className="flex items-center justify-end gap-1.5 w-full py-1.5 text-[#FF6B35] text-xs font-black hover:text-[#E95D31] transition-colors">
                                    <Plus size={13} strokeWidth={2.5} /><span>继续添加别的菜</span>
                                </button>

                                {Object.entries(cart.reduce((acc: any, item: any) => {
                                    const key = `${item.selectedDate || '未定'}|${item.selectedTime || 'Lunch'}`;
                                    if (!acc[key]) acc[key] = { date: item.selectedDate || '未定', time: item.selectedTime || 'Lunch', items: [] };
                                    acc[key].items.push(item);
                                    return acc;
                                }, {})).sort().map(([key, group]: any) => {
                                    const d = new Date();
                                    const ymdToday = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                                    const dTom = new Date(); dTom.setDate(dTom.getDate() + 1);
                                    const ymdTom = `${dTom.getFullYear()}-${String(dTom.getMonth()+1).padStart(2,'0')}-${String(dTom.getDate()).padStart(2,'0')}`;
                                    
                                    let dateBadge = null;
                                    if (group.date === ymdToday) {
                                        dateBadge = <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-md font-bold shrink-0 ring-1 ring-green-500/20">今日配送</span>;
                                    } else if (group.date === ymdTom) {
                                        dateBadge = <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded-md font-bold shrink-0 ring-1 ring-blue-500/20">明日配送</span>;
                                    }

                                    return (
                                        <div key={key} className="space-y-3 mb-8">
                                            <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-[#FDFBF7] to-white rounded-lg border border-[#E3EADA]/50 shadow-sm overflow-hidden">
                                                <div className="w-6 h-6 rounded-md bg-[#1A2D23]/5 flex items-center justify-center shrink-0">
                                                    <Calendar size={14} className="text-[#1A2D23]" />
                                                </div>
                                                <span className="text-sm font-black text-[#1A2D23] truncate">{group.date}</span>
                                                <span className="text-[10px] bg-[#FF6B35]/10 text-[#FF6B35] px-2 py-1 rounded-md font-bold shrink-0">
                                                    {group.time.includes('Lunch') ? '🌞 午餐' : '🌙 晚餐'}
                                                </span>
                                                {dateBadge && <div className="ml-auto flex items-center">{dateBadge}</div>}
                                            </div>
                                            {group.items.map((item: any, i: number) => (
                                                <CartItemCard key={item.cartItemId} item={item} onRemove={removeFromCart} onEdit={onEditItem} animationDelay={i * 50} />
                                            ))}
                                        </div>
                                    );
                                })}
                            </>
                        )}

                        {/* Order note */}
                        {cart.length > 0 && (
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">备注 Note (可选)</label>
                                <textarea value={orderNote} onChange={(e) => setOrderNote(e.target.value)}
                                    placeholder="例：放 Lobby、Block A、Block B、交给 Security Guard…"
                                    rows={2} className="w-full mt-1 px-4 py-3 bg-white border border-[#E3EADA] rounded-xl text-sm outline-none focus:border-[#FF6B35] transition-colors resize-none" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Checkout panel */}
                {cart.length > 0 && (
                    <div className="bg-white border-t border-[#E3EADA] shadow-[0_-10px_30px_rgba(0,0,0,0.03)] max-h-[55vh] overflow-y-auto">
                        <div className="p-5 space-y-3">
                            {/* Promo */}
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <div className="flex-1 relative">
                                        <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                                        <input type="text" value={promoCode}
                                            onChange={(e) => { setPromoCode(e.target.value); setPromoError(''); }}
                                            placeholder={promoLockedByVouchers ? '使用餐券中（不可叠加）' : '输入优惠码 / Promo Code'}
                                            disabled={promoApplied || promoLockedByVouchers}
                                            className={`w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm font-medium outline-none transition-colors ${promoApplied ? 'bg-green-50 border-green-200 text-green-700' : promoLockedByVouchers ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#FDFBF7] border-[#E3EADA] focus:border-[#FF6B35]'}`} />
                                    </div>
                                    {promoApplied ? (
                                        <button onClick={() => { setPromoApplied(false); setPromoDiscount(0); setPromoCode(''); }}
                                            className="px-3 py-2.5 rounded-xl text-xs font-bold text-red-500 border border-red-200 hover:bg-red-50 transition-colors">取消</button>
                                    ) : (
                                        <button onClick={handleApplyPromo} disabled={isCheckingPromo || promoLockedByVouchers}
                                            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-colors ${isCheckingPromo || promoLockedByVouchers ? 'bg-gray-300 text-gray-400 cursor-not-allowed' : 'bg-[#1A2D23] text-white hover:bg-[#2A3D33]'}`}>
                                            {isCheckingPromo ? '验证中…' : '使用'}
                                        </button>
                                    )}
                                </div>
                                {promoError && <p className="text-[10px] text-red-500 font-medium pl-1">{promoError}</p>}
                                {promoApplied && <p className="text-[10px] text-green-600 font-bold pl-1 flex items-center gap-1"><CheckCircle size={12} /> 已减免 RM {promoDiscount.toFixed(2)}</p>}
                            </div>

                            {/* Meal Voucher (餐券) — only show if user has any in wallet */}
                            {currentUser && availableMealVouchers > 0 && totalMainDishCount > 0 && (
                                <div className="space-y-2">
                                    <div className={`relative bg-gradient-to-br from-[#FFF3E0] via-white to-[#FFE9D5] border border-[#FFD6B0]/60 rounded-xl p-3 transition-opacity ${vouchersLockedByPromo ? 'opacity-50' : ''}`}>
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-[#FF6B35]/10 flex items-center justify-center shrink-0">
                                                    <Ticket size={16} className="text-[#FF6B35]" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-black text-[#1A2D23] truncate">用餐券抵扣</p>
                                                    <p className="text-[10px] text-[#1A2D23]/50 font-bold truncate">
                                                        共 {availableMealVouchers} 张可用 · 最多抵 {maxRedeemable} 份主餐
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => setMealVouchersUsed(Math.max(0, cappedMealVouchersUsed - 1))}
                                                    disabled={vouchersLockedByPromo || cappedMealVouchersUsed <= 0}
                                                    className="w-7 h-7 rounded-lg bg-white border border-[#FFD6B0] text-[#FF6B35] flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#FF6B35] hover:text-white transition-colors"
                                                >
                                                    <Minus size={12} strokeWidth={3} />
                                                </button>
                                                <span className="w-7 text-center font-black text-base text-[#1A2D23]">
                                                    {cappedMealVouchersUsed}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setMealVouchersUsed(Math.min(maxRedeemable, cappedMealVouchersUsed + 1))}
                                                    disabled={vouchersLockedByPromo || cappedMealVouchersUsed >= maxRedeemable}
                                                    className="w-7 h-7 rounded-lg bg-white border border-[#FFD6B0] text-[#FF6B35] flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#FF6B35] hover:text-white transition-colors"
                                                >
                                                    <Plus size={12} strokeWidth={3} />
                                                </button>
                                            </div>
                                        </div>
                                        {cappedMealVouchersUsed > 0 && !vouchersLockedByPromo && (
                                            <p className="text-[10px] text-green-700 font-bold mt-2 flex items-center gap-1">
                                                <CheckCircle size={11} /> 已抵 {cappedMealVouchersUsed} 份主餐 · 减 RM {mealVoucherDiscount.toFixed(2)}<span className="lg:hidden">（加购需现金）</span>
                                            </p>
                                        )}
                                        {vouchersLockedByPromo && (
                                            <p className="text-[10px] text-amber-600 font-bold mt-2">
                                                ⚠️ 优惠码与餐券不可叠加；请先取消优惠码
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Subtotal + delivery fee breakdown */}
                            {currentUser && deliveryTier && (
                                <div className="space-y-1.5 pb-1 border-b border-gray-100">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">小计 {(promoApplied || cappedMealVouchersUsed > 0) && '（折后）'}</span>
                                        <span className="text-gray-700 font-bold">RM {subtotalAfterDiscount.toFixed(2)}</span>
                                    </div>
                                    {cappedMealVouchersUsed > 0 && (
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-500 flex items-center gap-1">
                                                <Ticket size={11} className="text-[#FF6B35]" />
                                                餐券抵扣（{cappedMealVouchersUsed} 份主餐）
                                            </span>
                                            <span className="text-green-600 font-bold">- RM {mealVoucherDiscount.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">
                                            配送费 {deliveryTier === 'free' && <span className="text-green-600 font-bold">· 免运区</span>}
                                            {deliveryTier === 'mid' && <span className="text-amber-600 font-bold">· 中距离 5–8km</span>}
                                            {deliveryTier === 'far' && <span className="text-orange-600 font-bold">· 远距离 8km+</span>}
                                        </span>
                                        <span className={`font-bold ${deliveryFee === 0 ? 'text-green-600' : 'text-gray-700'}`}>
                                            {deliveryFee === 0 ? '免费 🛵' : `+ RM ${deliveryFee.toFixed(2)}`}
                                        </span>
                                    </div>
                                    {shortfallToFreeDelivery > 0 && (
                                        <div className="px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-md">
                                            <p className="text-[11px] font-bold text-amber-700">
                                                💡 还差 <span className="text-[#FF6B35]">RM {shortfallToFreeDelivery.toFixed(2)}</span> 即可免运（满 RM {FREE_DELIVERY_THRESHOLD_RM} 免费 · 仅限 2-5km 距离）
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Total */}
                            <div className="flex justify-between items-baseline">
                                <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Total</span>
                                <div className="text-right">
                                    {(promoApplied || cappedMealVouchersUsed > 0) && (
                                        <span className="text-sm text-gray-400 line-through mr-2">RM {cartTotal.toFixed(2)}</span>
                                    )}
                                    <span className="text-3xl font-black text-[#FF6B35]">RM {finalTotal.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Points preview — based on food (subtotal after discount), not delivery fee */}
                            <div className="flex items-center gap-2 px-3 py-2 bg-[#E3EADA]/30 rounded-xl">
                                <Sparkles size={14} className="text-[#FF6B35]" />
                                <span className="text-xs font-bold text-[#1A2D23]/60">核对成功后可获 <span className="text-[#FF6B35]">+{Math.floor(subtotalAfterDiscount)}</span> 积分</span>
                            </div>

                            {/* Warnings */}
                            {!currentUser && (
                                <button onClick={onAuthOpen} className="w-full py-3 bg-[#FFF3E0] text-[#E65100] rounded-xl flex items-center justify-center gap-2 font-bold text-sm border border-[#FFE0B2]">
                                    <AlertCircle size={16} /> 请先登录再下单
                                </button>
                            )}
                            {currentUser && (!userProfile?.phone || !userProfile?.address) && (
                                <button onClick={onAuthOpen} className="w-full py-3 bg-[#FFF3E0] text-[#E65100] rounded-xl flex items-center justify-center gap-2 font-bold text-sm border border-[#FFE0B2]">
                                    <AlertCircle size={16} /> 请先补充手机号和地址
                                </button>
                            )}
                            {currentUser && userProfile?.address && !deliveryTier && (
                                <button onClick={onAuthOpen} className="w-full py-3 bg-[#FFF3E0] text-[#E65100] rounded-xl flex items-center justify-center gap-2 font-bold text-sm border border-[#FFE0B2]">
                                    <AlertCircle size={16} /> 请进入个人资料确认配送地址（验证配送范围）
                                </button>
                            )}

                            {/* Payment method selector — hidden when vouchers cover the bill */}
                            {!isFullyCoveredByVouchers && (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={() => setPaymentMethod('qr')}
                                            className={`py-3 rounded-xl border-2 font-bold text-xs flex justify-center items-center gap-2 transition-all ${paymentMethod === 'qr' ? 'border-[#FF6B35] bg-[#FF6B35]/5 text-[#FF6B35]' : 'border-gray-200 text-gray-400'}`}>
                                            <Phone size={14} /> DuitNow / QR
                                        </button>
                                        <button onClick={() => setPaymentMethod('fpx')}
                                            className={`py-3 rounded-xl border-2 font-bold text-xs flex justify-center items-center gap-2 transition-all ${paymentMethod === 'fpx' ? 'border-[#FF6B35] bg-[#FF6B35]/5 text-[#FF6B35]' : 'border-gray-200 text-gray-400'}`}>
                                            <CreditCard size={14} /> FPX / Card
                                        </button>
                                    </div>

                                    {paymentMethod === 'qr' && (
                                        <QRPaymentSection receiptUploaded={receiptUploaded} receiptUrl={receiptUrl} uploading={uploading} onUpload={handleUpload} />
                                    )}

                                    {paymentMethod === 'fpx' && (
                                        <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 animate-in fade-in duration-300">
                                            <p className="text-xs text-[#FF6B35] font-bold">🔒 安全在线支付</p>
                                            <p className="text-[11px] text-gray-500 mt-0.5">点击「确认下单」后将跳转至 Curlec 支付页面完成付款</p>
                                        </div>
                                    )}
                                </>
                            )}

                            {isFullyCoveredByVouchers && (
                                <div className="bg-green-50 border-2 border-green-200 rounded-2xl px-4 py-3.5 animate-in fade-in duration-300">
                                    <p className="text-sm font-black text-green-800 flex items-center gap-2">
                                        <CheckCircle size={18} />
                                        餐券已抵扣全部费用
                                    </p>
                                    <p className="text-[11px] text-green-700 font-bold mt-1 leading-relaxed">
                                        将使用 {cappedMealVouchersUsed} 张餐券，无需额外付款。点「确认下单」即可。
                                    </p>
                                </div>
                            )}

                            {/* Submit */}
                            <button onClick={handleCheckout}
                                disabled={submitting || !currentUser || !deliveryTier || (!isFullyCoveredByVouchers && (!paymentMethod || (paymentMethod === 'qr' && !receiptUploaded)))}
                                className={`w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-xl flex items-center justify-center gap-3 ${submitting || !currentUser || !deliveryTier || (!isFullyCoveredByVouchers && (!paymentMethod || (paymentMethod === 'qr' && !receiptUploaded)))
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                                    : 'bg-[#FF6B35] text-white hover:bg-[#E95D31] shadow-[#FF6B35]/20'}`}>
                                <CheckCircle size={22} />
                                {submitting ? '提交中...' : '确认下单 →'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
