"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { User } from 'firebase/auth';
import { onAuthChange, getUserProfile } from '@/lib/auth';
import {
    ArrowLeft, Ticket, CheckCircle, Sparkles, AlertCircle, Loader2,
    CreditCard, Phone, Plus, Calendar, ShieldCheck, Clock, Tag,
} from 'lucide-react';
import { MEAL_VOUCHER_BUNDLES, TEST_MEAL_VOUCHER_BUNDLE, getBundle } from '@/data/mealVoucherConfig';
import type { MealVoucherBundle } from '@/data/mealVoucherConfig';

// ⚠️ 临时：仅这个邮箱能看到 RM1 测试套餐（验证 FPX→webhook 用）。测试完连同
// TEST_MEAL_VOUCHER_BUNDLE 一起删。
const TEST_BUNDLE_ADMIN_EMAIL = 'incredibowl.my@gmail.com';
import type { Locale } from '../member/dict';
import { MEAL_VOUCHERS_DICT } from './dict';
import LanguageSwitcher from '@/components/home/LanguageSwitcher';

export default function MealVouchersView({ locale }: { locale: Locale }) {
    const t = MEAL_VOUCHERS_DICT[locale];
    const homeHref = locale === 'en' ? '/en' : '/';
    const memberHref = locale === 'en' ? '/en/member' : '/member';

    // ZH bundle.label/highlight come from config; for EN we override with dict.
    const localiseBundleLabel = (bundle: MealVoucherBundle): string =>
        locale === 'en' ? t.bundleLabel(bundle.voucherCount) : bundle.label;
    const localiseHighlight = (raw?: string): string | undefined => {
        if (!raw) return undefined;
        if (locale === 'zh') return raw;
        if (raw === '人气之选') return t.bundleHighlightPopular;
        if (raw === '最划算') return t.bundleHighlightBestValue;
        return raw;
    };

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [selectedBundleId, setSelectedBundleId] = useState<MealVoucherBundle['id']>('10');
    const [paymentMethod, setPaymentMethod] = useState<'qr' | 'fpx' | ''>('');
    const [receiptUploaded, setReceiptUploaded] = useState(false);
    const [receiptUrl, setReceiptUrl] = useState('');
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [successPurchaseId, setSuccessPurchaseId] = useState<string | null>(null);
    const [pendingReview, setPendingReview] = useState(false);
    const [voucherCount, setVoucherCount] = useState(0);
    const [purchasedValidityDays, setPurchasedValidityDays] = useState(0);
    const [error, setError] = useState('');

    const [promoCode, setPromoCode] = useState('');
    const [promoApplied, setPromoApplied] = useState(false);
    const [promoDiscount, setPromoDiscount] = useState(0);
    const [promoError, setPromoError] = useState('');
    const [isCheckingPromo, setIsCheckingPromo] = useState(false);

    // Admin-only RM1 test bundle (FPX→webhook verification). Appended to the
    // visible list ONLY for the admin email; customers never see it.
    const isTestAdmin = currentUser?.email === TEST_BUNDLE_ADMIN_EMAIL;
    const visibleBundles = isTestAdmin
        ? [...MEAL_VOUCHER_BUNDLES, TEST_MEAL_VOUCHER_BUNDLE]
        : MEAL_VOUCHER_BUNDLES;
    // getBundle() resolves both public + the hidden test bundle, so a selected
    // '1' doesn't crash on a public-only lookup.
    const selectedBundle = getBundle(selectedBundleId) ?? MEAL_VOUCHER_BUNDLES[0];
    const cappedPromoDiscount = promoApplied
        ? Math.min(promoDiscount, Math.max(0, selectedBundle.price - 0.01))
        : 0;
    const finalPrice = Math.max(0.01, selectedBundle.price - cappedPromoDiscount);

    useEffect(() => {
        if (promoApplied) {
            setPromoApplied(false);
            setPromoDiscount(0);
            setPromoError(t.promoSwitchedBundle);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedBundleId]);

    const handleApplyPromo = async () => {
        const code = promoCode.trim().toUpperCase();
        if (!code) { setPromoError(t.promoEnterCode); return; }
        if (!currentUser) { setPromoError(t.promoLoginFirst); return; }
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
                setPromoError(data.error || t.promoInvalid);
                setPromoApplied(false); setPromoDiscount(0);
                return;
            }
            const discount = Number(data.discount) || 0;
            if (discount >= selectedBundle.price) {
                setPromoError(t.promoTooLargeForBundle);
                setPromoApplied(false); setPromoDiscount(0);
                return;
            }
            setPromoDiscount(discount);
            setPromoApplied(true);
            setPromoError('');
        } catch {
            setPromoError(t.promoVerifyFailed);
        } finally {
            setIsCheckingPromo(false);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthChange(async (user) => {
            setCurrentUser(user);
            setAuthChecked(true);
            if (user) {
                const profile = await getUserProfile(user.uid);
                setUserProfile(profile);
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if ((window as any).Razorpay) return;
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
        return () => { document.body.removeChild(script); };
    }, []);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        if (!file.type.startsWith('image/')) {
            alert(t.uploadInvalidType);
            return;
        }
        const MAX_BYTES = 5 * 1024 * 1024;
        if (file.size > MAX_BYTES) {
            alert(t.uploadTooLarge((file.size / 1024 / 1024).toFixed(1)));
            return;
        }
        if (!currentUser) {
            alert(t.uploadRequiresLogin);
            return;
        }
        setUploading(true);
        try {
            const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
            const { storage } = await import('@/lib/firebase');
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const storageRef = ref(storage, `receipts/${currentUser.uid}/voucher_${Date.now()}_${safeName}`);
            await uploadBytes(storageRef, file, { contentType: file.type });
            setReceiptUrl(await getDownloadURL(storageRef));
            setReceiptUploaded(true);
        } catch (err: any) {
            console.error('[Voucher receipt upload failed]', err);
            const code = err?.code || '';
            let msg = t.uploadGenericError;
            if (code === 'storage/unauthorized') msg = t.uploadUnauthorized;
            else if (code === 'storage/canceled') msg = t.uploadCanceled;
            else if (code === 'storage/retry-limit-exceeded') msg = t.uploadRetryLimit;
            else if (code === 'storage/quota-exceeded') msg = t.uploadQuotaExceeded;
            else if (err?.message) msg = t.uploadErrorWithMessage(err.message);
            alert(msg);
        }
        setUploading(false);
    };

    const handleBuy = async () => {
        if (!currentUser) { alert(t.loginToBuyVouchers); return; }
        if (!paymentMethod) { setError(t.errorSelectMethod); return; }
        if (paymentMethod === 'qr' && !receiptUploaded) {
            setError(t.errorUploadReceipt);
            return;
        }
        setError('');
        setSubmitting(true);

        try {
            const token = await currentUser.getIdToken();

            const createRes = await fetch('/api/meal-vouchers/create-purchase', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    bundleId: selectedBundle.id,
                    clientPrice: selectedBundle.price,
                    paymentMethod,
                    receiptUrl: paymentMethod === 'qr' ? receiptUrl : undefined,
                    voucherCode: promoApplied ? promoCode.trim().toUpperCase() : '',
                    clientFinalPrice: Number(finalPrice.toFixed(2)),
                }),
            });
            const createData = await createRes.json();
            if (!createRes.ok) throw new Error(createData.error || t.errorCreateFailed);

            const purchaseId: string = createData.purchaseId;

            if (paymentMethod === 'qr') {
                setSuccessPurchaseId(purchaseId);
                setPendingReview(true);
                setVoucherCount(selectedBundle.voucherCount);
                setPurchasedValidityDays(selectedBundle.validityDays);
                return;
            }

            await new Promise<void>((resolve, reject) => {
                let resolved = false;
                const options = {
                    key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                    amount: createData.amount,
                    currency: createData.currency,
                    order_id: createData.razorpayOrderId,
                    name: t.razorpayName,
                    description: t.razorpayDescription(selectedBundle.voucherCount, selectedBundle.validityDays),
                    handler: async (response: any) => {
                        resolved = true;
                        try {
                            const confirmRes = await fetch('/api/meal-vouchers/confirm-purchase', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({
                                    purchaseId,
                                    razorpayPaymentId: response.razorpay_payment_id,
                                    razorpayOrderId: response.razorpay_order_id,
                                    razorpaySignature: response.razorpay_signature,
                                }),
                            });
                            const confirmData = await confirmRes.json();
                            if (!confirmRes.ok) throw new Error(confirmData.error || t.errorConfirmFailed);
                            setSuccessPurchaseId(purchaseId);
                            setVoucherCount(confirmData.voucherCount || selectedBundle.voucherCount);
                            setPurchasedValidityDays(selectedBundle.validityDays);
                            resolve();
                        } catch (err: any) {
                            reject(err);
                        }
                    },
                    modal: {
                        ondismiss: () => {
                            setTimeout(() => { if (!resolved) reject(new Error(t.errorPaymentCancelled)); }, 1500);
                        },
                    },
                    prefill: {
                        name: userProfile?.displayName || currentUser.displayName || '',
                        email: currentUser.email || '',
                        contact: userProfile?.phone || '',
                    },
                    theme: { color: '#FF6B35' },
                };
                const rzp = new (window as any).Razorpay(options);
                rzp.open();
            });
        } catch (err: any) {
            if (err?.message !== t.errorPaymentCancelled) {
                setError(err?.message || t.errorBuyFailed);
            }
        } finally {
            setSubmitting(false);
        }
    };

    // Static, always-server-rendered SEO content. The purchase widget below is
    // auth-gated, so without this the prerendered HTML (and any non-JS crawler)
    // would see only a spinner. Rendered in the !authChecked and !currentUser
    // states — exactly the states a bot lands in — so /meal-vouchers can rank.
    const SeoIntro = () => (
        <section className="max-w-2xl mx-auto px-6 pt-10 pb-2">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-[#FF6B35] flex items-center justify-center text-white shrink-0">
                    <Ticket size={24} />
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-[#1A2D23] leading-tight">{t.seoHeading}</h1>
            </div>
            <p className="text-[15px] md:text-base text-[#1A2D23]/75 leading-relaxed mb-4">{t.seoLead}</p>
            <ul className="space-y-2 mb-4">
                {t.seoPoints.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-[14px] md:text-[15px] text-[#1A2D23]/80">
                        <CheckCircle size={18} className="text-[#FF6B35] shrink-0 mt-0.5" />
                        <span>{p}</span>
                    </li>
                ))}
            </ul>
            <p className="text-[14px] text-[#1A2D23]/70 leading-relaxed">{t.seoHow}</p>
        </section>
    );

    if (authChecked && !currentUser) {
        return (
            <div className="min-h-screen bg-[#FDFBF7] py-10">
                <SeoIntro />
                <div className="max-w-2xl mx-auto px-6 mt-4">
                    <div className="bg-white rounded-2xl border border-[#E3EADA] p-6 text-center space-y-4">
                        <p className="text-gray-500 text-sm">{t.loginRequired}</p>
                        <Link href={homeHref} className="inline-flex items-center gap-2 px-6 py-3 bg-[#1A2D23] text-white rounded-xl font-bold hover:bg-[#2A3D33] transition-colors">
                            <ArrowLeft size={16} /> {t.loginReturnHome}
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    if (!authChecked) {
        return (
            <div className="min-h-screen bg-[#FDFBF7] py-10">
                <SeoIntro />
                <div className="flex items-center justify-center py-10">
                    <div className="animate-spin w-8 h-8 border-4 border-[#FF6B35] border-t-transparent rounded-full"></div>
                </div>
            </div>
        );
    }

    if (successPurchaseId) {
        return (
            <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-[32px] p-8 shadow-2xl border border-[#E3EADA] text-center space-y-5">
                    {pendingReview ? (
                        <>
                            <div className="w-20 h-20 mx-auto bg-amber-50 rounded-full flex items-center justify-center">
                                <Clock className="w-10 h-10 text-amber-600" />
                            </div>
                            <h2 className="text-2xl font-black text-[#1A2D23]">{t.pendingReviewTitle}</h2>
                            <p className="text-sm text-gray-500 leading-relaxed">
                                {t.pendingReviewBody1}<br />
                                {t.pendingReviewBody2(voucherCount, purchasedValidityDays)}
                            </p>
                        </>
                    ) : (
                        <>
                            <div className="w-20 h-20 mx-auto bg-green-50 rounded-full flex items-center justify-center">
                                <CheckCircle className="w-10 h-10 text-green-600" />
                            </div>
                            <h2 className="text-2xl font-black text-[#1A2D23]">{t.successTitle}</h2>
                            <p className="text-sm text-gray-500 leading-relaxed">
                                {t.successBody(voucherCount, purchasedValidityDays)}
                            </p>
                        </>
                    )}

                    <div className="bg-[#FDFBF7] rounded-2xl p-4 text-left text-xs text-gray-500 space-y-1.5 border border-[#E3EADA]">
                        <p>{t.orderIdLabel}<span className="font-mono text-[#1A2D23]">{successPurchaseId.slice(-8).toUpperCase()}</span></p>
                        <p>{t.voucherCountLabel}<span className="font-bold text-[#1A2D23]">{voucherCount}</span></p>
                        <p>{t.validityLabel}<span className="font-bold text-[#1A2D23]">{t.validityDays(purchasedValidityDays)}</span></p>
                    </div>

                    <div className="flex gap-3">
                        <Link href={memberHref} className="flex-1 py-3 bg-[#1A2D23] text-white rounded-xl font-bold text-sm hover:bg-[#2A3D33] transition-colors">
                            {t.viewWallet}
                        </Link>
                        <Link href={homeHref} className="flex-1 py-3 bg-[#FF6B35] text-white rounded-xl font-bold text-sm hover:bg-[#E95D31] transition-colors">
                            {t.goOrder}
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FDFBF7]">
            {/* Header */}
            <header className="bg-gradient-to-br from-[#1A2D23] via-[#21352A] to-[#12221A] text-white pt-8 pb-12 px-4 shadow-2xl shadow-[#1A2D23]/10">
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <Link href={homeHref} className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl border border-white/10 text-white/90 text-sm font-bold transition-all active:scale-95">
                            <ArrowLeft size={16} /> {t.backHome}
                        </Link>
                        <LanguageSwitcher current={locale} />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-[#FF6B35] flex items-center justify-center shadow-xl shadow-[#FF6B35]/30">
                            <Ticket size={32} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight">{t.pageTitle}</h1>
                            <p className="text-white/60 text-sm font-bold mt-1">{t.subtitle}</p>
                        </div>
                    </div>
                    <div className="mt-6 grid grid-cols-3 gap-2">
                        <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
                            <ShieldCheck size={16} className="text-[#FF6B35] mb-1" />
                            <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider">{t.badgeAnyDishLabel}</p>
                            <p className="text-xs font-bold text-white">{t.badgeAnyDishValue}</p>
                        </div>
                        <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
                            <Calendar size={16} className="text-[#FF6B35] mb-1" />
                            <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider">{t.badgeValidityLabel}</p>
                            <p className="text-xs font-bold text-white">{t.badgeValidityValue}</p>
                        </div>
                        <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
                            <Sparkles size={16} className="text-[#FF6B35] mb-1" />
                            <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider">{t.badgeSavingsLabel}</p>
                            <p className="text-xs font-bold text-white">{t.badgeSavingsValue}</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-2xl mx-auto px-4 -mt-6 relative z-10 pb-12 space-y-6">
                {/* Bundle picker */}
                <section className="space-y-3">
                    {visibleBundles.map((bundle) => {
                        const isSelected = selectedBundleId === bundle.id;
                        const highlight = localiseHighlight(bundle.highlight);
                        return (
                            <button
                                key={bundle.id}
                                onClick={() => setSelectedBundleId(bundle.id)}
                                className={`w-full text-left bg-white rounded-3xl p-5 border-2 transition-all shadow-lg ${
                                    isSelected
                                        ? 'border-[#FF6B35] shadow-[#FF6B35]/15 scale-[1.01]'
                                        : 'border-[#E3EADA] hover:border-[#FF6B35]/40'
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors shrink-0 ${
                                        isSelected ? 'bg-[#FF6B35] text-white' : 'bg-[#FDFBF7] text-[#1A2D23]'
                                    }`}>
                                        <Ticket size={28} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <h3 className="text-lg font-black text-[#1A2D23]">{localiseBundleLabel(bundle)}</h3>
                                            {highlight && (
                                                <span className="px-2 py-0.5 bg-[#FF6B35]/10 text-[#FF6B35] text-[10px] font-black rounded-full uppercase tracking-wider">
                                                    {highlight}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 font-bold">
                                            {t.perVoucher(bundle.pricePerVoucher.toFixed(2))}
                                            {bundle.savings > 0 && (
                                                <span className="text-green-600 ml-2">
                                                    {t.savings(bundle.savings.toFixed(2), bundle.savingsPercent)}
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-[10px] text-gray-400 font-bold mt-0.5 flex items-center gap-1">
                                            <Clock size={10} /> {t.validityDays(bundle.validityDays)}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-2xl font-black text-[#FF6B35]">
                                            RM {bundle.price.toFixed(2)}
                                        </p>
                                        {bundle.savings > 0 && (
                                            <p className="text-[10px] text-gray-400 line-through">
                                                RM {bundle.faceValue.toFixed(2)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </section>

                {/* Promo code */}
                <section className="bg-white rounded-2xl p-5 shadow-md border border-[#E3EADA] space-y-2">
                    <h4 className="text-sm font-black text-[#1A2D23] flex items-center gap-2">
                        <Tag size={14} className="text-[#FF6B35]" /> {t.promoTitle}
                    </h4>
                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                            <input
                                type="text"
                                value={promoCode}
                                onChange={(e) => { setPromoCode(e.target.value); setPromoError(''); }}
                                placeholder={t.promoPlaceholder}
                                disabled={promoApplied}
                                className={`w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm font-medium outline-none transition-colors ${promoApplied ? 'bg-green-50 border-green-200 text-green-700' : 'bg-[#FDFBF7] border-[#E3EADA] focus:border-[#FF6B35]'}`}
                            />
                        </div>
                        {promoApplied ? (
                            <button
                                type="button"
                                onClick={() => { setPromoApplied(false); setPromoDiscount(0); setPromoCode(''); setPromoError(''); }}
                                className="px-3 py-2.5 rounded-xl text-xs font-bold text-red-500 border border-red-200 hover:bg-red-50 transition-colors"
                            >
                                {t.promoCancel}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleApplyPromo}
                                disabled={isCheckingPromo}
                                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-colors ${isCheckingPromo ? 'bg-gray-300 text-gray-400 cursor-not-allowed' : 'bg-[#1A2D23] text-white hover:bg-[#2A3D33]'}`}
                            >
                                {isCheckingPromo ? t.promoVerifying : t.promoApply}
                            </button>
                        )}
                    </div>
                    {promoError && <p className="text-[10px] text-red-500 font-medium pl-1">{promoError}</p>}
                    {promoApplied && (
                        <p className="text-[10px] text-green-600 font-bold pl-1 flex items-center gap-1">
                            <CheckCircle size={12} /> {t.promoApplied(cappedPromoDiscount.toFixed(2))}
                        </p>
                    )}

                    {/* Price summary */}
                    <div className="mt-3 pt-3 border-t border-[#E3EADA] space-y-1 text-xs">
                        <div className="flex justify-between text-gray-500">
                            <span>{t.summaryPrice}</span>
                            <span className={promoApplied ? 'line-through' : ''}>RM {selectedBundle.price.toFixed(2)}</span>
                        </div>
                        {promoApplied && (
                            <div className="flex justify-between text-green-600 font-bold">
                                <span>{t.summaryDiscount}</span>
                                <span>− RM {cappedPromoDiscount.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-black text-[#1A2D23] text-sm pt-1">
                            <span>{t.summaryTotal}</span>
                            <span className="text-[#FF6B35]">RM {finalPrice.toFixed(2)}</span>
                        </div>
                    </div>
                </section>

                {/* Rules */}
                <section className="bg-white/60 rounded-2xl p-5 border border-[#E3EADA]">
                    <h4 className="text-sm font-black text-[#1A2D23] mb-3 flex items-center gap-2">
                        <Sparkles size={14} className="text-[#FF6B35]" /> {t.rulesTitle}
                    </h4>
                    <ul className="space-y-2 text-xs text-gray-600 leading-relaxed">
                        <li className="flex items-start gap-2">
                            <span className="text-[#FF6B35] mt-0.5">•</span>
                            <span>{t.rule1}</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-[#FF6B35] mt-0.5">•</span>
                            <span>{t.rule2}</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-[#FF6B35] mt-0.5">•</span>
                            <span>{t.rule3}</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-[#FF6B35] mt-0.5">•</span>
                            <span>{t.rule4}</span>
                        </li>
                    </ul>
                </section>

                {/* Payment selector */}
                <section className="bg-white rounded-2xl p-5 shadow-md border border-[#E3EADA] space-y-4">
                    <div>
                        <h4 className="text-sm font-black text-[#1A2D23] mb-3">{t.chooseMethod}</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setPaymentMethod('qr')}
                                className={`py-3 rounded-xl border-2 font-bold text-xs flex justify-center items-center gap-2 transition-all ${
                                    paymentMethod === 'qr'
                                        ? 'border-[#FF6B35] bg-[#FF6B35]/5 text-[#FF6B35]'
                                        : 'border-gray-200 text-gray-400'
                                }`}
                            >
                                <Phone size={14} /> {t.methodQR}
                            </button>
                            <button
                                onClick={() => setPaymentMethod('fpx')}
                                className={`py-3 rounded-xl border-2 font-bold text-xs flex justify-center items-center gap-2 transition-all ${
                                    paymentMethod === 'fpx'
                                        ? 'border-[#FF6B35] bg-[#FF6B35]/5 text-[#FF6B35]'
                                        : 'border-gray-200 text-gray-400'
                                }`}
                            >
                                <CreditCard size={14} /> {t.methodFPX}
                            </button>
                        </div>
                    </div>

                    {paymentMethod === 'qr' && (
                        <div className="space-y-2 animate-in fade-in duration-300">
                            <div className="bg-white rounded-xl border border-[#E3EADA] p-2 max-w-[200px] mx-auto shadow-sm">
                                <Image src="/duitnow_qr.png" alt="DuitNow QR - INCREDIBOWL SERVICES" width={400} height={550} className="w-full h-auto rounded-lg" />
                            </div>
                            <div className="bg-[#F5F3EF] rounded-lg px-3 py-2 text-[10px] text-[#1A2D23]/60 space-y-0.5">
                                <p>{t.qrMerchantLabel}<strong className="text-[#1A2D23]">INCREDIBOWL SERVICES</strong></p>
                                <p>{t.qrAmountLabel}<strong className="text-[#1A2D23]">RM {finalPrice.toFixed(2)}</strong>{promoApplied && <span className="text-green-600">{t.qrAmountDiscountSuffix(cappedPromoDiscount.toFixed(2))}</span>}</p>
                                <p>{t.qrReviewNotice}</p>
                            </div>
                            {receiptUploaded && receiptUrl ? (
                                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-2">
                                    <div className="relative w-12 h-12">
                                        <Image src={receiptUrl} alt="Receipt" fill unoptimized className="rounded-lg object-cover border border-green-200" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-green-700 flex items-center gap-1"><CheckCircle size={12} /> {t.receiptUploaded}</p>
                                    </div>
                                    <label className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-[10px] font-bold cursor-pointer hover:bg-green-200">
                                        {t.receiptReplace}
                                        <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                                    </label>
                                </div>
                            ) : (
                                <label className={`w-full py-2.5 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors text-sm ${uploading ? 'bg-orange-50 border-orange-200' : 'bg-[#FDFBF7] border-[#E3EADA] hover:border-[#FF6B35]'}`}>
                                    {uploading ? (
                                        <><Loader2 size={16} className="text-[#FF6B35] animate-spin" /><span className="font-bold text-[#FF6B35] text-xs">{t.receiptUploading}</span></>
                                    ) : (
                                        <><Plus size={16} className="text-[#FF6B35]" /><span className="font-bold text-[#FF6B35] text-xs">{t.receiptUpload}</span></>
                                    )}
                                    <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
                                </label>
                            )}
                        </div>
                    )}

                    {paymentMethod === 'fpx' && (
                        <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 animate-in fade-in duration-300">
                            <p className="text-xs text-[#FF6B35] font-bold">{t.fpxSecureTitle}</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">{t.fpxBlurb(selectedBundle.voucherCount)}</p>
                        </div>
                    )}
                </section>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                        <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                        <p className="text-xs font-bold text-red-700">{error}</p>
                    </div>
                )}

                {/* Submit */}
                <button
                    onClick={handleBuy}
                    disabled={submitting || !paymentMethod || (paymentMethod === 'qr' && !receiptUploaded)}
                    className={`w-full py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition-all shadow-xl ${
                        submitting || !paymentMethod || (paymentMethod === 'qr' && !receiptUploaded)
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                            : 'bg-[#FF6B35] text-white hover:bg-[#E95D31] shadow-[#FF6B35]/20'
                    }`}
                >
                    {submitting ? (
                        <><Loader2 size={20} className="animate-spin" /> {t.submitButtonProcessing}</>
                    ) : (
                        <>
                            <Ticket size={20} />
                            {t.submitButton(finalPrice.toFixed(2))}
                        </>
                    )}
                </button>
            </main>
        </div>
    );
}
