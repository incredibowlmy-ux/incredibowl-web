"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingBag, X, Plus, Minus, AlertCircle, Tag, CheckCircle, Utensils, CreditCard, Phone, Calendar, Ticket } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
// updateOrderStatus moved to server-side /api/confirm-order
import { isValidMyPhone } from '@/lib/cartUtils';
import {
    calcPerDeliveryFees,
    resolveShortfallToFree,
    thresholdForDistance,
    FREE_DELIVERY_THRESHOLD_NEAR_RM,
    FREE_DELIVERY_THRESHOLD_MID_RM,
    type DeliveryTier,
    type DeliveryZone,
} from '@/lib/deliveryUtils';
import { isOrderDateValid, isDishOrderableOn } from '@/lib/cartDateUtils';
import { getDishPrice } from '@/data/promoConfig';
import { dishVoucherValue, weeklyMenu } from '@/data/weeklyMenu';
import { planAddonCreditDeduction } from '@/lib/addonCreditMath';
import CartSuccess from './CartSuccess';
import CartItemCard from './CartItemCard';
import QRPaymentSection from './QRPaymentSection';
import { CART_DICT } from './dict';

export default function CartDrawer({
    isOpen,
    onClose,
    cart,
    removeFromCart,
    cartTotal,
    cartCount,
    onAuthOpen,
    onClearCart,
    onEditItem,
    locale = 'zh'
}: any) {
    // 渲染层文案字典（zh 值与旧字面量逐字一致）。订单 payload 永远不经过它。
    const t = CART_DICT[(locale === 'en' ? 'en' : 'zh') as 'zh' | 'en'].drawer;
    // Auth + profile (address/phone) come from the app-wide AuthProvider, which
    // survives page navigation — so reopening the cart after visiting another
    // page shows the saved address/phone instantly, no refresh needed.
    const { currentUser, userProfile, refreshProfile } = useAuth();
    const [paymentMethod, setPaymentMethod] = useState<'qr' | 'fpx' | ''>('');
    const [receiptUploaded, setReceiptUploaded] = useState(false);
    const [receiptUrl, setReceiptUrl] = useState('');
    const [uploading, setUploading] = useState(false);
    const [orderNote, setOrderNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [guestLoading, setGuestLoading] = useState(false);

    // 访客快速下单：静默建匿名账号（零注册），随即打开资料表单补手机+地址
    // （AuthModal 对已登录用户直接进 profile 视图）。Anonymous provider 未启用
    // 时优雅回退到 Google 登录。
    const handleGuestCheckout = async () => {
        setGuestLoading(true);
        try {
            const { signInAsGuest } = await import('@/lib/auth');
            await signInAsGuest();
            onAuthOpen();
        } catch (e) {
            console.error('[guest] anonymous sign-in failed:', e);
            alert(t.guestUnavailable);
            onAuthOpen();
        } finally {
            setGuestLoading(false);
        }
    };
    const [orderSuccess, setOrderSuccess] = useState<{ id: string; items: any[]; total: number; trackInfo?: { token: string; date: string; time: string }[]; voucherUsed?: boolean } | null>(null);
    const [promoCode, setPromoCode] = useState('');
    const [promoApplied, setPromoApplied] = useState(false);
    const [promoError, setPromoError] = useState('');
    const [promoDiscount, setPromoDiscount] = useState(0);
    const [isCheckingPromo, setIsCheckingPromo] = useState(false);
    const [staleNotice, setStaleNotice] = useState<string>('');
    // Meal voucher (餐券) redemption state
    const [availableMealVouchers, setAvailableMealVouchers] = useState(0);
    const [mealVouchersUsed, setMealVouchersUsed] = useState(0);
    // Prepaid add-on credits (预付加料) — auto-applied, no toggle
    const [addonCredits, setAddonCredits] = useState<Array<{ addonId: string; addonName: string; remaining: number }>>([]);

    // ── 地址簿快速切换 ──────────────────────────────────────
    // savedAddresses 来自 users/{uid}（AuthProvider 提供），每条自带 geocode
    // 数据包；切换只是把那条复制成顶层「当前地址」，运费推导（distanceKm/
    // deliveryZone 都读 userProfile）随 refreshProfile 自动更新。
    const savedAddresses: any[] = Array.isArray(userProfile?.savedAddresses) ? userProfile.savedAddresses : [];
    const [switchingAddress, setSwitchingAddress] = useState('');   // 切换中的条目 id
    const handleSwitchAddress = async (entry: any) => {
        if (switchingAddress || !currentUser) return;
        setSwitchingAddress(entry.id);
        try {
            const { selectSavedAddress } = await import('@/lib/auth');
            await selectSavedAddress(currentUser.uid, entry);
            await refreshProfile();
        } catch (e) {
            console.error('[cart] 切换地址失败', e);
        } finally {
            setSwitchingAddress('');
        }
    };

    // Auto-clean cart items that can no longer be ordered. Two independent
    // causes, reported separately because the fix differs for the customer:
    //   ① 日期烂了 —— 购物车开着过夜、6AM 截单已过。
    //   ② 菜不卖了 —— 上周加的菜本周已暂别 / 改了排期 / 当天被停售。
    //
    // ② 是 2026-07 那次事故的根因：旧版只查 ①，一道 PAUSED 的菜能一路走到
    // 厨房。判定走 isDishOrderableOn（与 /api/submit-order 同一个函数）。
    //
    // ⚠️ 必须用 id 回 weeklyMenu 现查：item.dish 是加入购物车那天写进
    // localStorage 的快照，里面的 retired/weekday 是旧值，信它等于没查。
    useEffect(() => {
        if (!isOpen) return;
        const menuById = new Map(weeklyMenu.map(d => [d.id, d]));
        const dateStale: any[] = [];
        const unavailable: any[] = [];
        for (const item of cart as any[]) {
            if (!isOrderDateValid(item.selectedDate).ok) { dateStale.push(item); continue; }
            const live = menuById.get(item.dish?.id);
            // 菜已从目录整个删掉 → 同样清掉，否则结账时才报「菜品不存在」
            if (!live || !isDishOrderableOn(live, item.selectedDate).ok) unavailable.push(item);
        }
        if (dateStale.length === 0 && unavailable.length === 0) {
            setStaleNotice('');
            return;
        }
        [...dateStale, ...unavailable].forEach((item: any) => removeFromCart(item.cartItemId));
        // 重置结账状态：优惠券可能已过期/被用掉，支付方式也要重选。
        setPromoCode('');
        setPromoApplied(false);
        setPromoDiscount(0);
        setPromoError('');
        setPaymentMethod('');
        setReceiptUploaded(false);
        setReceiptUrl('');
        setMealVouchersUsed(0);
        const notices: string[] = [];
        if (dateStale.length) notices.push(t.staleRemoved(dateStale.length));
        if (unavailable.length) notices.push(t.unavailableRemoved(unavailable.length));
        setStaleNotice(notices.join('；'));
    }, [isOpen, cart, removeFromCart]);

    // ── Meal voucher math ──────────────────────────────────────
    // Each main dish serving in the cart = one redeemable "slot".
    // The discount applied = sum of the X most-expensive serving prices,
    // so the customer always gets the best deal. Add-ons are excluded.
    // Each serving's voucher VALUE = unit price minus any per-dish top-up (e.g.
    // premium salmon: one voucher covers RM 19.90, customer still pays RM 4 cash).
    // Best deal first → cover the highest-VALUE servings. Mirrored server-side.
    const mainDishVoucherValues: number[] = cart.flatMap((bundle: any) => {
        const unitPrice = getDishPrice(bundle?.dish?.price ?? 0);
        const value = dishVoucherValue(unitPrice, bundle?.dish ?? {});
        const totalUnits = (bundle?.dishQty || 1) * (bundle?.quantity || 1);
        return Array.from({ length: totalUnits }, () => value);
    });
    const totalMainDishCount = mainDishVoucherValues.length;
    const maxRedeemable = Math.min(totalMainDishCount, availableMealVouchers);
    const cappedMealVouchersUsed = Math.min(mealVouchersUsed, maxRedeemable);
    const mealVoucherDiscount = [...mainDishVoucherValues]
        .sort((a, b) => b - a)
        .slice(0, cappedMealVouchersUsed)
        .reduce((sum, v) => sum + v, 0);

    // Promo code and meal vouchers are mutually exclusive per order.
    const promoLockedByVouchers = cappedMealVouchersUsed > 0;
    const vouchersLockedByPromo = promoApplied;

    // ── Prepaid add-on credit auto-deduction ───────────────────
    // Same planAddonCreditDeduction the server runs in /api/submit-order
    // (shared module addonCreditMath.ts — one source, two ends); the server
    // recomputes with its own balances and reconciles our number ±0.02.
    // Credits stack with meal vouchers AND promo codes.
    const addonCreditPlan = planAddonCreditDeduction(
        cart.map((bundle: any) => ({
            groupKey: `${bundle.selectedDate || '未定'}|${bundle.selectedTime || 'Lunch'}`,
            voucherValue: dishVoucherValue(getDishPrice(bundle?.dish?.price ?? 0), bundle?.dish ?? {}),
            topUpAddonId: bundle?.dish?.topUpAddonId,
            topUpRM: bundle?.dish?.voucherTopUp ?? 0,
            units: (bundle?.dishQty || 1) * (bundle?.quantity || 1),
            addOns: (bundle?.addOns || []).map((a: any) => ({
                id: a.item?.id || '',
                totalQty: (a.quantity || 0) * (bundle?.quantity || 1),
            })),
        })),
        cappedMealVouchersUsed,
        new Map(addonCredits.map(c => [c.addonId, c.remaining])),
    );
    const addonCreditDiscount = addonCreditPlan.totalDiscount;
    const addonCreditsRemainingAfter = Math.max(0,
        addonCredits.reduce((s, c) => s + c.remaining, 0) - addonCreditPlan.unitsUsed);
    // 抵扣行点名：加饭 ×1、荷包蛋 ×2（EN 优先购物车加料自带的 nameEn；
    // upgrade credit 不在购物车里，回退 credit 文档的中文 addonName）
    const addonCreditLineNames = addonCreditPlan.lines.map(l => {
        let name = addonCredits.find(c => c.addonId === l.addonId)?.addonName || l.addonId;
        if (locale === 'en') {
            for (const b of cart) {
                const hit = (b.addOns || []).find((a: any) => a.item?.id === l.addonId && a.item?.nameEn);
                if (hit) { name = hit.item.nameEn; break; }
            }
        }
        return `${name} ×${l.count}`;
    }).join(locale === 'en' ? ', ' : '、');

    // Auto-cap the slider when cart shrinks
    useEffect(() => {
        if (mealVouchersUsed > maxRedeemable) {
            setMealVouchersUsed(maxRedeemable);
        }
    }, [maxRedeemable, mealVouchersUsed]);

    const subtotalAfterDiscount = Math.max(0, cartTotal - promoDiscount - mealVoucherDiscount - addonCreditDiscount);
    const distanceKm: number | null = typeof userProfile?.addressDistanceKm === 'number'
        ? userProfile.addressDistanceKm
        : null;
    const userZone: DeliveryZone | null =
        userProfile?.deliveryZone === 'within2km' || userProfile?.deliveryZone === 'outside2km'
            ? userProfile.deliveryZone
            : null;
    // Existing-customer grandfathering: createdAt comes from Firestore as
    // { seconds, nanoseconds }. Convert to epoch ms; null for guest flow.
    const customerCreatedAtMs: number | null =
        typeof userProfile?.createdAt?.seconds === 'number'
            ? userProfile.createdAt.seconds * 1000
            : null;
    // Each (date + lunch/dinner) group is a separate delivery (one kitchen
    // trip) and pays its own fee. Group the cart in the SAME order the server
    // does (cart array order → insertion order), so the per-group fees match
    // and the server's anti-tamper check passes. Meal voucher does NOT count
    // against the basis (2026-05-11 rule) — calcPerDeliveryFees uses
    // cartTotal − promoDiscount only.
    const deliveryGroups = (() => {
        const grouped: Record<string, { date: string; time: string; subtotal: number }> = {};
        for (const item of cart) {
            const date = item.selectedDate || t.dateTbd;
            const time = item.selectedTime || 'Lunch';
            const key = `${date}|${time}`;
            if (!grouped[key]) grouped[key] = { date, time, subtotal: 0 };
            grouped[key].subtotal += (item.price || 0) * (item.quantity || 1);
        }
        return Object.values(grouped);
    })();
    const perDelivery = calcPerDeliveryFees(
        deliveryGroups.map(g => g.subtotal),
        cartTotal,
        promoDiscount,
        distanceKm,
        userZone,
        customerCreatedAtMs,
    );
    const deliveryTier: DeliveryTier | null = perDelivery.tier;
    const deliveryFee = perDelivery.total;
    // Per-delivery breakdown (fee + shortfall-to-free) for the multi-day UI.
    const deliveryBreakdown = deliveryGroups.map((g, i) => ({
        date: g.date,
        time: g.time,
        fee: perDelivery.fees[i] ?? 0,
        shortfall: resolveShortfallToFree(distanceKm, userZone, perDelivery.bases[i] ?? 0, customerCreatedAtMs),
    }));
    const isMultiDelivery = deliveryGroups.length > 1;
    // Single-delivery shortfall (existing UX). For multi-delivery we render the
    // per-group breakdown instead.
    const shortfallToFreeDelivery = deliveryBreakdown.length === 1 ? deliveryBreakdown[0].shortfall : 0;
    const finalTotal = subtotalAfterDiscount + deliveryFee;

    // Meal vouchers fully covered the bill (no cash to collect). Skips the
    // payment method selector + Razorpay flow entirely; we just submit the
    // order and immediately confirm it since there's nothing to charge.
    const isFullyCoveredByVouchers = !!currentUser && cappedMealVouchersUsed > 0 && finalTotal <= 0;

    /** Auth header for the payment-chain APIs — they verify the token's uid. */
    const authHeaders = async (): Promise<Record<string, string>> => {
        const token = await currentUser!.getIdToken();
        return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    };

    const handleApplyPromo = async () => {
        const code = promoCode.trim().toUpperCase();
        if (!code) return;
        if (!currentUser) { onAuthOpen(); return; }
        setIsCheckingPromo(true);
        setPromoError('');
        try {
            // userId 不再放请求体 —— 服务端只认 token 里的 uid
            const res = await fetch('/api/check-voucher', {
                method: 'POST',
                headers: await authHeaders(),
                body: JSON.stringify({ voucherCode: code }),
            });
            const data = await res.json();
            if (!res.ok) {
                setPromoError(data.error || t.promoInvalid);
                setPromoApplied(false); setPromoDiscount(0);
                return;
            }
            setPromoDiscount(data.discount);
            setPromoApplied(true);
            setPromoError('');
        } catch (err) {
            setPromoError(t.promoCheckFailed);
        } finally {
            setIsCheckingPromo(false);
        }
    };

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
        return () => { document.body.removeChild(script); };
    }, []);

    // Server derives the authoritative amount from the pending order docs and
    // binds the Razorpay order id back onto them — the client no longer sends
    // an amount at all (it could lie).
    const initiateRazorpayPayment = (orderIdsToPay: string[]): Promise<{ razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }> => {
        return new Promise(async (resolve, reject) => {
            try {
                const res = await fetch('/api/payment/create-order', {
                    method: 'POST',
                    headers: await authHeaders(),
                    body: JSON.stringify({ orderIds: orderIdsToPay }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || t.createPaymentFailed);
                let resolved = false;
                const options = {
                    key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                    amount: data.amount, currency: data.currency, order_id: data.orderId,
                    name: 'Incredibowl', description: t.razorpayDescription,
                    callback_url: `${window.location.origin}/api/payment/fpx-callback`,
                    redirect: true,
                    handler: (response: any) => { resolved = true; resolve(response); },
                    modal: {
                        ondismiss: () => {
                            // Razorpay test mode may fire ondismiss BEFORE handler.
                            // Wait 1.5 s to give handler a chance to settle first.
                            setTimeout(() => { if (!resolved) reject(new Error(t.paymentCancelled)); }, 1500);
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

    // Background-refresh the authoritative profile when the cart opens (picks up
    // a freshly edited address/distance). The cached profile already renders
    // instantly via AuthProvider, so this never blocks the UI.
    useEffect(() => {
        if (isOpen && currentUser) refreshProfile();
    }, [isOpen, currentUser, refreshProfile]);

    // Refresh available meal voucher count whenever drawer opens or auth changes
    useEffect(() => {
        const fetchMealVouchers = async () => {
            if (!isOpen || !currentUser) {
                setAvailableMealVouchers(0);
                setAddonCredits([]);
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
                setAddonCredits(Array.isArray(data.addonCredits) ? data.addonCredits : []);
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
            alert(t.uploadImageOnly);
            return;
        }
        // Guard 2: max 5MB (must match Storage Rules size limit)
        const MAX_BYTES = 5 * 1024 * 1024;
        if (file.size > MAX_BYTES) {
            alert(t.uploadTooLarge((file.size / 1024 / 1024).toFixed(1)));
            return;
        }
        // Guard 3: must be authenticated (Storage Rules 通常要求 request.auth != null)
        if (!currentUser) {
            alert(t.loginBeforeUpload);
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
            let msg = t.uploadFailedRetry;
            if (code === 'storage/unauthorized') msg = t.uploadUnauthorized;
            else if (code === 'storage/canceled') msg = t.uploadCancelled;
            else if (code === 'storage/retry-limit-exceeded') msg = t.uploadSlowNetwork;
            else if (code === 'storage/quota-exceeded') msg = t.uploadQuota;
            else if (err?.message) msg = t.uploadFailedWithMsg(err.message);
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
            headers: await authHeaders(),
            body: JSON.stringify({
                // userId omitted on purpose — the server takes it from the token
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
                clientAddonCreditDiscount: addonCreditDiscount,
            }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t.submitOrderFailed);
        return data as {
            orderIds: string[];
            groupId: string | null;
            isMultiPart: boolean;
            serverTotal: number;
            checkoutEventId?: string;
            trackInfo?: { token: string; date: string; time: string }[];
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
            alert(t.invalidPhone); onAuthOpen(); return;
        }
        if (cart.length > 0 && cart.some((item: any) => !item.selectedDate)) {
            alert(t.missingDate); return;
        }

        // Voucher-only flow: meal vouchers covered the entire bill (no cash).
        // Mirror FPX pattern but skip Razorpay: submit creates pending order(s),
        // then confirm flips to 'confirmed'. If confirm fails, we MUST roll back
        // by cancelling the pending order — this triggers releaseMealVouchers
        // server-side so the customer's vouchers aren't lost in limbo.
        if (isFullyCoveredByVouchers) {
            setSubmitting(true);
            let voucherOrderIds: string[] = [];
            try {
                const result = await submitOrderViaAPI('voucher');
                voucherOrderIds = result.orderIds;
                trackPixel('InitiateCheckout', { value: 0, currency: 'MYR' }, result.checkoutEventId);
                const confirmRes = await fetch('/api/confirm-order', {
                    method: 'POST',
                    headers: await authHeaders(), // owner token — voucher-covered confirm path
                    body: JSON.stringify({ orderIds: result.orderIds, status: 'confirmed' }),
                });
                if (!confirmRes.ok) {
                    throw new Error((await confirmRes.json()).error || t.confirmFailed);
                }
                showOrderSuccess(result.isMultiPart ? result.groupId! : result.orderIds[0], result.trackInfo);
            } catch (err: any) {
                // Rollback: if submit succeeded but confirm failed, cancel the
                // pending order so claimed vouchers get released back to the user.
                if (voucherOrderIds.length > 0) {
                    await fetch('/api/confirm-order', {
                        method: 'POST',
                        headers: await authHeaders().catch(() => ({ 'Content-Type': 'application/json' })),
                        body: JSON.stringify({ orderIds: voucherOrderIds, status: 'cancelled' }),
                    }).catch(() => {});
                }
                alert(err.message || t.placeOrderFailed);
            }
            setSubmitting(false);
            return;
        }

        if (paymentMethod === 'qr' && !receiptUploaded) { alert(t.uploadReceiptFirstAlert); return; }

        if (paymentMethod === 'fpx') {
            // Step 1: Submit orders via server-side validated API as 'pending' BEFORE opening payment.
            setSubmitting(true);
            let orderIds: string[] = [];
            let isMultiPart = false;
            let groupId: string | null = null;
            let checkoutEventId: string | undefined;
            let trackInfo: { token: string; date: string; time: string }[] | undefined;
            try {
                const result = await submitOrderViaAPI();
                orderIds = result.orderIds;
                isMultiPart = result.isMultiPart;
                groupId = result.groupId;
                checkoutEventId = result.checkoutEventId;
                trackInfo = result.trackInfo;
                // Fire browser-side InitiateCheckout (deduped against CAPI by eventID)
                trackPixel('InitiateCheckout', { value: finalTotal, currency: 'MYR' }, checkoutEventId);
            } catch (err: any) {
                alert(err.message || t.createOrderFailed);
                setSubmitting(false);
                return;
            }
            // Step 2: Save for FPX redirect recovery in page.tsx.
            const payloads = orderIds.map(() => ({ userId: currentUser!.uid, total: finalTotal / orderIds.length }));
            // Cart snapshot for the post-redirect success modal (page.tsx / en/page.tsx)
            // — the cart itself is cleared by then, so the modal reads this instead.
            const summary = {
                // Cart entries are CartBundle — the dish name lives on it.dish,
                // not on the bundle itself (was it.name → "undefined" in the
                // post-FPX success modal / WhatsApp prefill).
                items: cart.map((it: any) => {
                    const sel = (it.addOns || []).filter((a: any) => a?.item?.name);
                    // 份数 = dishQty × quantity，加料 = quantity × bundle 数 —
                    // 与 /api/submit-order 写进 Firestore 的 items[].quantity 一致
                    // （只读 it.quantity 会把「1 个 bundle 点 5 份」显示成 ×1）。
                    const bundles = it.quantity || 1;
                    const aQty = (a: any) => a.quantity * bundles;
                    return {
                        name: it.dish?.name || '',
                        nameEn: it.dish?.nameEn || it.dish?.name || '',
                        qty: (it.dishQty || 1) * bundles,
                        date: it.selectedDate || '',
                        addOns: sel.map((a: any) => `${a.item.name}${aQty(a) > 1 ? `×${aQty(a)}` : ''}`),
                        addOnsEn: sel.map((a: any) => `${a.item.nameEn || a.item.name}${aQty(a) > 1 ? `×${aQty(a)}` : ''}`),
                    };
                }),
                total: finalTotal,
                trackInfo: trackInfo || [],
            };
            // localStorage（不是 sessionStorage）：手机 FPX 跳银行时浏览器常把
            // 原标签页杀掉，sessionStorage 随之丢失 → 跳回后成功弹窗渲染不出
            // （2026-07-05 老板手机实测复现）。localStorage 能活过这趟往返。
            localStorage.setItem('fpx_pending_order', JSON.stringify({ orderIds, groupId, isMultiPart, payloads, summary, createdAt: Date.now() }));
            setSubmitting(false);

            try {
                const paymentResult = await initiateRazorpayPayment(orderIds);
                const verifyRes = await fetch('/api/payment/verify', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(paymentResult),
                });
                const verifyData = await verifyRes.json();
                if (!verifyData.verified) { alert(t.verifyFailed); return; }
                setSubmitting(true);
                const payData = {
                    razorpayPaymentId: paymentResult.razorpay_payment_id,
                    razorpayOrderId: paymentResult.razorpay_order_id,
                    razorpaySignature: paymentResult.razorpay_signature,
                };
                // Step 3: Confirm all pending orders via server-side API.
                // Signature in payData is the primary authorization; token is
                // belt-and-braces when the session is still alive.
                const confirmRes = await fetch('/api/confirm-order', {
                    method: 'POST',
                    headers: await authHeaders().catch(() => ({ 'Content-Type': 'application/json' })),
                    body: JSON.stringify({ orderIds, status: 'confirmed', paymentData: payData }),
                });
                if (!confirmRes.ok) throw new Error((await confirmRes.json()).error || t.confirmFailed);
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
                localStorage.removeItem('fpx_pending_order');
                showOrderSuccess(isMultiPart ? groupId! : orderIds[0], trackInfo);
            } catch (err: any) {
                // Cancel pending orders on any payment failure (dismiss, network error, verification fail, etc.)
                // Pending orders may also be cancelled without a token (server pending-rule).
                await fetch('/api/confirm-order', {
                    method: 'POST',
                    headers: await authHeaders().catch(() => ({ 'Content-Type': 'application/json' })),
                    body: JSON.stringify({ orderIds, status: 'cancelled' }),
                }).catch(() => {});
                localStorage.removeItem('fpx_pending_order');
                if (err.message !== t.paymentCancelled) {
                    alert(err.message || t.payFailed);
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
            showOrderSuccess(result.isMultiPart ? result.groupId! : result.orderIds[0], result.trackInfo);
        } catch (error: any) { alert(t.qrSubmitFailed(error.message)); }
        setSubmitting(false);
    };

    /** Show the success screen. Cart + form state are cleared IMMEDIATELY
     *  (so a closed tab can't resurrect already-ordered items into a double
     *  order), while the snapshot inside orderSuccess keeps the summary on
     *  screen until the customer dismisses it — no more 4 s auto-close that
     *  cut off reading / the WhatsApp confirmation tap. */
    const showOrderSuccess = (id: string, trackInfo?: { token: string; date: string; time: string }[]) => {
        // Capture voucher usage BEFORE the reset below zeroes mealVouchersUsed —
        // CartSuccess uses it to show the balance recap even at a depleted wallet.
        setOrderSuccess({ id, items: [...cart], total: cartTotal, trackInfo, voucherUsed: mealVouchersUsed > 0 });
        onClearCart(); setReceiptUploaded(false); setReceiptUrl('');
        setOrderNote(''); setPromoCode(''); setPromoApplied(false);
        setPromoDiscount(0); setMealVouchersUsed(0);
    };

    if (orderSuccess) {
        return <CartSuccess orderSuccess={orderSuccess} userProfile={userProfile} locale={locale} currentUser={currentUser} voucherUsed={orderSuccess.voucherUsed} onDone={() => { setOrderSuccess(null); onClose(); }} />;
    }

    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-[#1A2D23]/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-[#FDFBF7] h-full shadow-2xl flex flex-col border-l border-[#E3EADA] animate-in slide-in-from-right duration-500">

                {/* Header */}
                <div className="p-6 bg-white border-b border-[#E3EADA] flex justify-between items-center">
                    <h2 className="text-xl font-black flex items-center gap-3 text-[#1A2D23]">
                        <ShoppingBag size={22} /> {t.title} ({cartCount})
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
                                <span className="text-gray-500 font-medium shrink-0">{t.deliveryAddress}</span>
                                <span className="truncate ml-4 text-right">
                                    {userProfile?.address || <span className="text-red-500">{t.addressMissing}</span>}
                                </span>
                            </p>
                            {/* 地址簿快速切换：注册会员存了 ≥2 个地址才显示。切换 =
                                整包复制到顶层字段（含 verifiedText，防换址检查照过），
                                refreshProfile 后运费/免运门槛自动按新距离重算。 */}
                            {savedAddresses.length >= 2 && !currentUser?.isAnonymous && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {savedAddresses.map((entry: any) => {
                                        const isCurrent = (entry?.address || '').trim() === (userProfile?.address || '').trim();
                                        return (
                                            <button key={entry.id}
                                                onClick={() => handleSwitchAddress(entry)}
                                                disabled={!!switchingAddress || isCurrent}
                                                className={`px-2.5 py-1 rounded-full text-[10px] font-black border transition-all disabled:cursor-default ${isCurrent
                                                    ? 'bg-[#FF6B35] text-white border-[#FF6B35]'
                                                    : 'bg-white text-[#1A2D23] border-[#E3EADA] hover:border-[#FF6B35] disabled:opacity-50'}`}>
                                                {switchingAddress === entry.id ? t.switching : (entry.label || `${(entry.address || '').slice(0, 14)}…`)}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
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
                                    <p className="font-bold text-lg mb-2 text-[#3B2A1A]">{t.emptyTitle}</p>
                                    <p className="text-sm font-medium text-[#8B7355] max-w-[200px] leading-relaxed mx-auto">{t.emptySubtitle}</p>
                                </div>
                                <button onClick={() => { onClose(); setTimeout(() => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' }), 300); }}
                                    className="px-8 py-3.5 bg-[#FF6B35] text-white text-base font-black rounded-2xl flex items-center justify-center gap-2 mx-auto hover:bg-[#E95D31] transition-all shadow-lg shadow-[#FF6B35]/20 hover:-translate-y-1 active:scale-95">
                                    <ShoppingBag size={18} /> {t.goPickFood}
                                </button>

                                {/* Meal voucher CTA — empty cart push */}
                                <div className="mt-8 mx-auto max-w-[280px]">
                                    <Link
                                        href={locale === 'en' ? '/en/meal-vouchers' : '/meal-vouchers'}
                                        onClick={onClose}
                                        className="group block bg-gradient-to-br from-[#FFF3E0] via-white to-[#FFE9D5] border border-[#FFD6B0]/60 rounded-2xl p-4 hover:shadow-lg transition-all relative overflow-hidden"
                                    >
                                        <div className="absolute -top-6 -right-6 w-24 h-24 bg-[#FF6B35]/10 rounded-full blur-2xl pointer-events-none" />
                                        <div className="relative flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-[#FF6B35] text-white flex items-center justify-center shrink-0 shadow-md shadow-[#FF6B35]/30">
                                                <Ticket size={20} />
                                            </div>
                                            <div className="flex-1 text-left min-w-0">
                                                <p className="text-xs font-black text-[#1A2D23]">{t.voucherCtaTitle}</p>
                                                <p className="text-[10px] text-[#1A2D23]/60 font-bold leading-snug">
                                                    {t.voucherCtaSub}
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
                                    <Plus size={13} strokeWidth={2.5} /><span>{t.addMore}</span>
                                </button>

                                {Object.entries(cart.reduce((acc: any, item: any) => {
                                    const key = `${item.selectedDate || t.dateTbd}|${item.selectedTime || 'Lunch'}`;
                                    if (!acc[key]) acc[key] = { date: item.selectedDate || t.dateTbd, time: item.selectedTime || 'Lunch', items: [] };
                                    acc[key].items.push(item);
                                    return acc;
                                }, {})).sort().map(([key, group]: any) => {
                                    const d = new Date();
                                    const ymdToday = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                                    const dTom = new Date(); dTom.setDate(dTom.getDate() + 1);
                                    const ymdTom = `${dTom.getFullYear()}-${String(dTom.getMonth()+1).padStart(2,'0')}-${String(dTom.getDate()).padStart(2,'0')}`;
                                    
                                    let dateBadge = null;
                                    if (group.date === ymdToday) {
                                        dateBadge = <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-md font-bold shrink-0 ring-1 ring-green-500/20">{t.todayDelivery}</span>;
                                    } else if (group.date === ymdTom) {
                                        dateBadge = <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded-md font-bold shrink-0 ring-1 ring-blue-500/20">{t.tomorrowDelivery}</span>;
                                    }

                                    return (
                                        <div key={key} className="space-y-3 mb-8">
                                            <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-[#FDFBF7] to-white rounded-lg border border-[#E3EADA]/50 shadow-sm overflow-hidden">
                                                <div className="w-6 h-6 rounded-md bg-[#1A2D23]/5 flex items-center justify-center shrink-0">
                                                    <Calendar size={14} className="text-[#1A2D23]" />
                                                </div>
                                                <span className="text-sm font-black text-[#1A2D23] truncate">{group.date}</span>
                                                <span className="text-[10px] bg-[#FF6B35]/10 text-[#FF6B35] px-2 py-1 rounded-md font-bold shrink-0">
                                                    {group.time.includes('Lunch') ? t.lunchBadge : t.dinnerBadge}
                                                </span>
                                                {dateBadge && <div className="ml-auto flex items-center">{dateBadge}</div>}
                                            </div>
                                            {group.items.map((item: any, i: number) => (
                                                <CartItemCard key={item.cartItemId} item={item} onRemove={removeFromCart} onEdit={onEditItem} animationDelay={i * 50} locale={locale} />
                                            ))}
                                        </div>
                                    );
                                })}
                            </>
                        )}

                        {/* Order note */}
                        {cart.length > 0 && (
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t.noteLabel}</label>
                                <textarea value={orderNote} onChange={(e) => setOrderNote(e.target.value)}
                                    placeholder={t.notePlaceholder}
                                    rows={2} className="w-full mt-1 px-4 py-3 bg-white border border-[#E3EADA] rounded-xl text-sm outline-none focus:border-[#FF6B35] transition-colors resize-none" />
                            </div>
                        )}
                    </div>

                    {/* Checkout sections — flow in the SAME scroll as the items.
                        (Was a second independently-scrolling max-h-55vh panel stacked
                        below, which read as "two separate pieces" on mobile — boss
                        feedback 2026-07-05. Only the slim total+CTA bar stays fixed.) */}
                    {cart.length > 0 && (
                        <div className="px-5 pt-4 pb-6 border-t border-dashed border-[#E3EADA] space-y-3">
                            {/* Promo */}
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <div className="flex-1 relative">
                                        <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                                        <input type="text" value={promoCode}
                                            onChange={(e) => { setPromoCode(e.target.value); setPromoError(''); }}
                                            placeholder={promoLockedByVouchers ? t.promoPlaceholderLocked : t.promoPlaceholder}
                                            disabled={promoApplied || promoLockedByVouchers}
                                            className={`w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm font-medium outline-none transition-colors ${promoApplied ? 'bg-green-50 border-green-200 text-green-700' : promoLockedByVouchers ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#FDFBF7] border-[#E3EADA] focus:border-[#FF6B35]'}`} />
                                    </div>
                                    {promoApplied ? (
                                        <button onClick={() => { setPromoApplied(false); setPromoDiscount(0); setPromoCode(''); }}
                                            className="px-3 py-2.5 rounded-xl text-xs font-bold text-red-500 border border-red-200 hover:bg-red-50 transition-colors">{t.cancel}</button>
                                    ) : (
                                        <button onClick={handleApplyPromo} disabled={isCheckingPromo || promoLockedByVouchers}
                                            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-colors ${isCheckingPromo || promoLockedByVouchers ? 'bg-gray-300 text-gray-400 cursor-not-allowed' : 'bg-[#1A2D23] text-white hover:bg-[#2A3D33]'}`}>
                                            {isCheckingPromo ? t.checking : t.apply}
                                        </button>
                                    )}
                                </div>
                                {promoError && <p className="text-[10px] text-red-500 font-medium pl-1">{promoError}</p>}
                                {promoApplied && <p className="text-[10px] text-green-600 font-bold pl-1 flex items-center gap-1"><CheckCircle size={12} /> {t.promoSaved(promoDiscount.toFixed(2))}</p>}
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
                                                    <p className="text-xs font-black text-[#1A2D23] truncate">{t.voucherRedeemTitle}</p>
                                                    <p className="text-[10px] text-[#1A2D23]/50 font-bold truncate">
                                                        {t.voucherRedeemSub(availableMealVouchers, maxRedeemable)}
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
                                                <CheckCircle size={11} /> {t.voucherRedeemed(cappedMealVouchersUsed, mealVoucherDiscount.toFixed(2))}{addonCreditDiscount === 0 && <span className="lg:hidden">{t.voucherAddonCash}</span>}
                                            </p>
                                        )}
                                        {vouchersLockedByPromo && (
                                            <p className="text-[10px] text-amber-600 font-bold mt-2">
                                                {t.voucherPromoConflict}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Meal voucher upsell — subtle one-liner near the subtotal; hidden
                                once the user already owns vouchers (the redemption card above
                                takes over the exposure job). */}
                            {availableMealVouchers === 0 && (
                                <Link
                                    href={locale === 'en' ? '/en/meal-vouchers' : '/meal-vouchers'}
                                    onClick={onClose}
                                    className="group flex items-center gap-1.5 px-1 text-[11px] font-bold text-[#1A2D23]/50 hover:text-[#FF6B35] transition-colors"
                                >
                                    <Ticket size={12} className="text-[#FF6B35]/70 shrink-0" />
                                    <span>{t.voucherUpsell} <span className="inline-block group-hover:translate-x-0.5 transition-transform">→</span></span>
                                </Link>
                            )}

                            {/* Subtotal + delivery fee breakdown */}
                            {currentUser && deliveryTier && (
                                <div className="space-y-1.5 pb-1 border-b border-gray-100">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">{t.subtotal} {(promoApplied || cappedMealVouchersUsed > 0 || addonCreditDiscount > 0) && t.discounted}</span>
                                        <span className="text-gray-700 font-bold">RM {subtotalAfterDiscount.toFixed(2)}</span>
                                    </div>
                                    {cappedMealVouchersUsed > 0 && (
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-500 flex items-center gap-1">
                                                <Ticket size={11} className="text-[#FF6B35]" />
                                                {t.voucherDeduct(cappedMealVouchersUsed)}
                                            </span>
                                            <span className="text-green-600 font-bold">- RM {mealVoucherDiscount.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {addonCreditDiscount > 0 && (
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-500 flex items-center gap-1">
                                                <Ticket size={11} className="text-[#FF6B35]" />
                                                {t.addonCreditDeduct(addonCreditLineNames)}
                                                <span className="text-gray-400">{t.addonCreditRemaining(addonCreditsRemainingAfter)}</span>
                                            </span>
                                            <span className="text-green-600 font-bold">- RM {addonCreditDiscount.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">
                                            {t.deliveryFee} {deliveryTier === 'free' && <span className="text-green-600 font-bold">{t.freeZone}</span>}
                                            {deliveryTier === 'mid' && <span className="text-amber-600 font-bold">{t.midZone}</span>}
                                            {isMultiDelivery && <span className="text-gray-400">{t.trips(deliveryGroups.length)}</span>}
                                        </span>
                                        <span className={`font-bold ${deliveryFee === 0 ? 'text-green-600' : 'text-gray-700'}`}>
                                            {deliveryFee === 0 ? t.free : `+ RM ${deliveryFee.toFixed(2)}`}
                                        </span>
                                    </div>
                                    {/* Multi-day: each delivery is a separate trip charged on its own
                                        basis — show the per-trip breakdown so the customer understands
                                        why the total isn't a single combined fee. */}
                                    {isMultiDelivery && (
                                        <div className="px-2.5 py-1.5 bg-gray-50 border border-gray-100 rounded-md space-y-1">
                                            {deliveryBreakdown.map((d, i) => {
                                                const dateLabel = /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date.slice(5) : d.date;
                                                const timeLabel = t.mealWord(d.time);
                                                return (
                                                    <div key={i} className="flex justify-between items-center text-[11px]">
                                                        <span className="text-gray-500">
                                                            🛵 {dateLabel} {timeLabel}
                                                            {d.shortfall > 0 && (
                                                                <span className="text-amber-600">{t.shortfallInline(d.shortfall.toFixed(2))}</span>
                                                            )}
                                                        </span>
                                                        <span className={`font-bold ${d.fee === 0 ? 'text-green-600' : 'text-gray-600'}`}>
                                                            {d.fee === 0 ? t.freeShort : `+ RM ${d.fee.toFixed(2)}`}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {!isMultiDelivery && shortfallToFreeDelivery > 0 && (
                                        <div className="px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-md">
                                            <p className="text-[11px] font-bold text-amber-700">
                                                💡 {t.stillNeed} <span className="text-[#FF6B35]">RM {shortfallToFreeDelivery.toFixed(2)}</span>
                                                {deliveryTier === 'near' && <>{t.toFree} <span className="text-gray-400">{t.freeOver(distanceKm !== null ? thresholdForDistance(distanceKm) : FREE_DELIVERY_THRESHOLD_NEAR_RM)}</span></>}
                                                {deliveryTier === 'mid' && <>{t.toFree} <span className="text-gray-400">{t.freeOver(FREE_DELIVERY_THRESHOLD_MID_RM)}</span></>}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Total + auth warnings live in the fixed bottom bar below */}

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
                                        <QRPaymentSection receiptUploaded={receiptUploaded} receiptUrl={receiptUrl} uploading={uploading} onUpload={handleUpload} locale={locale} />
                                    )}

                                    {paymentMethod === 'fpx' && (
                                        <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 animate-in fade-in duration-300">
                                            <p className="text-xs text-[#FF6B35] font-bold">{t.securePayment}</p>
                                            <p className="text-[11px] text-gray-500 mt-0.5">{t.fpxRedirectNote}</p>
                                        </div>
                                    )}
                                </>
                            )}

                            {isFullyCoveredByVouchers && (
                                <div className="bg-green-50 border-2 border-green-200 rounded-2xl px-4 py-3.5 animate-in fade-in duration-300">
                                    <p className="text-sm font-black text-green-800 flex items-center gap-2">
                                        <CheckCircle size={18} />
                                        {t.voucherCovered}
                                    </p>
                                    <p className="text-[11px] text-green-700 font-bold mt-1 leading-relaxed">
                                        {t.voucherCoveredSub(cappedMealVouchersUsed)}
                                    </p>
                                </div>
                            )}

                        </div>
                    )}
                </div>

                {/* Slim fixed checkout bar — the ONLY pinned piece: blocking warning
                    (when any) + total + CTA. pb covers the iPhone home-indicator
                    safe area so the button never sits under the gesture bar. */}
                {cart.length > 0 && (
                    <div className="shrink-0 bg-white border-t border-[#E3EADA] px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(0,0,0,0.06)] space-y-2.5">
                        {!currentUser && (
                            <div className="space-y-1.5">
                                {/* 访客为主 CTA（转化优先），登录为次选 —— 强制注册是
                                    弃单头号原因，手机+地址反正配送必须要。 */}
                                <button onClick={handleGuestCheckout} disabled={guestLoading}
                                    className="w-full py-3 bg-[#1A2D23] text-white rounded-xl flex items-center justify-center gap-2 font-bold text-sm hover:bg-[#2A3D33] transition-colors disabled:opacity-60">
                                    ⚡ {guestLoading ? t.guestEntering : t.guestCheckout}
                                </button>
                                <button onClick={onAuthOpen} className="w-full py-2 text-[#1A2D23]/60 hover:text-[#1A2D23] rounded-xl flex items-center justify-center gap-1.5 font-bold text-xs transition-colors">
                                    {t.haveAccount}
                                </button>
                            </div>
                        )}
                        {currentUser && (!userProfile?.phone || !userProfile?.address) && (
                            <button onClick={onAuthOpen} className="w-full py-2.5 bg-[#FFF3E0] text-[#E65100] rounded-xl flex items-center justify-center gap-2 font-bold text-xs border border-[#FFE0B2]">
                                <AlertCircle size={14} /> {t.fillPhoneAddress}
                            </button>
                        )}
                        {currentUser && userProfile?.address && !deliveryTier && (
                            <button onClick={onAuthOpen} className="w-full py-2.5 bg-[#FFF3E0] text-[#E65100] rounded-xl flex items-center justify-center gap-2 font-bold text-xs border border-[#FFE0B2]">
                                <AlertCircle size={14} /> {t.confirmAddress}
                            </button>
                        )}
                        <div className="flex justify-between items-baseline">
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total</span>
                            <div className="text-right">
                                {(promoApplied || cappedMealVouchersUsed > 0 || addonCreditDiscount > 0) && (
                                    <span className="text-sm text-gray-400 line-through mr-2">RM {cartTotal.toFixed(2)}</span>
                                )}
                                <span className="text-2xl font-black text-[#FF6B35]">RM {finalTotal.toFixed(2)}</span>
                            </div>
                        </div>
                        <button onClick={handleCheckout}
                            disabled={submitting || !currentUser || !deliveryTier || (!isFullyCoveredByVouchers && (!paymentMethod || (paymentMethod === 'qr' && !receiptUploaded)))}
                            className={`w-full py-3.5 rounded-2xl font-bold text-base transition-all shadow-xl flex items-center justify-center gap-2.5 ${submitting || !currentUser || !deliveryTier || (!isFullyCoveredByVouchers && (!paymentMethod || (paymentMethod === 'qr' && !receiptUploaded)))
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                                : 'bg-[#FF6B35] text-white hover:bg-[#E95D31] shadow-[#FF6B35]/20'}`}>
                            <CheckCircle size={20} />
                            {submitting ? t.submitting
                                : (currentUser && deliveryTier && !isFullyCoveredByVouchers && !paymentMethod) ? t.choosePayment
                                : (currentUser && deliveryTier && !isFullyCoveredByVouchers && paymentMethod === 'qr' && !receiptUploaded) ? t.uploadFirst
                                : t.confirmOrder}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
