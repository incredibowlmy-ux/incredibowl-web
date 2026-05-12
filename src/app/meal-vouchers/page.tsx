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
import { MEAL_VOUCHER_BUNDLES, MEAL_VOUCHER_VALIDITY_DAYS } from '@/data/mealVoucherConfig';
import type { MealVoucherBundle } from '@/data/mealVoucherConfig';

export default function MealVoucherShopPage() {
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
    const [error, setError] = useState('');

    // Promo code (RM discount voucher) — same system as checkout drawer
    const [promoCode, setPromoCode] = useState('');
    const [promoApplied, setPromoApplied] = useState(false);
    const [promoDiscount, setPromoDiscount] = useState(0);
    const [promoError, setPromoError] = useState('');
    const [isCheckingPromo, setIsCheckingPromo] = useState(false);

    const selectedBundle = MEAL_VOUCHER_BUNDLES.find(b => b.id === selectedBundleId)!;
    // Cap discount so we never charge RM 0 (skips Razorpay min-amount issues
    // and avoids "free meal-voucher pack" abuse). Floor at RM 0.01.
    const cappedPromoDiscount = promoApplied
        ? Math.min(promoDiscount, Math.max(0, selectedBundle.price - 0.01))
        : 0;
    const finalPrice = Math.max(0.01, selectedBundle.price - cappedPromoDiscount);

    // Switching bundle invalidates the discount (the cap depends on bundle price);
    // re-apply the code if you want it on a different pack.
    useEffect(() => {
        if (promoApplied) {
            setPromoApplied(false);
            setPromoDiscount(0);
            setPromoError('已切换组合，请重新使用优惠码');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedBundleId]);

    const handleApplyPromo = async () => {
        const code = promoCode.trim().toUpperCase();
        if (!code) { setPromoError('请输入优惠码'); return; }
        if (!currentUser) { setPromoError('请先登录'); return; }
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
            const discount = Number(data.discount) || 0;
            if (discount >= selectedBundle.price) {
                // Edge case: RM 5 discount on a RM 5 pack — would drive amount to 0.
                setPromoError('此优惠码金额≥组合价，请选更大的组合或换码');
                setPromoApplied(false); setPromoDiscount(0);
                return;
            }
            setPromoDiscount(discount);
            setPromoApplied(true);
            setPromoError('');
        } catch {
            setPromoError('验证失败，请稍后再试');
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

    // Razorpay loader
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
            alert('请上传图片文件（JPG / PNG）');
            return;
        }
        const MAX_BYTES = 5 * 1024 * 1024;
        if (file.size > MAX_BYTES) {
            alert(`图片太大（${(file.size / 1024 / 1024).toFixed(1)}MB），请压缩后上传，最大 5MB`);
            return;
        }
        if (!currentUser) {
            alert('请先登录再上传付款凭证');
            return;
        }
        setUploading(true);
        try {
            const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
            const { storage } = await import('@/lib/firebase');
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            // Reuse the existing `receipts/{uid}/...` path that already has
            // working Storage Rules (food orders use it). Prefix `voucher_`
            // so admin can tell apart food receipts from voucher purchase
            // receipts when browsing storage. No Firebase Console change needed.
            const storageRef = ref(storage, `receipts/${currentUser.uid}/voucher_${Date.now()}_${safeName}`);
            await uploadBytes(storageRef, file, { contentType: file.type });
            setReceiptUrl(await getDownloadURL(storageRef));
            setReceiptUploaded(true);
        } catch (err: any) {
            console.error('[Voucher receipt upload failed]', err);
            const code = err?.code || '';
            let msg = '上传失败，请重试';
            if (code === 'storage/unauthorized') msg = '上传被拒绝（Storage 权限规则未授权）。请刷新页面重试，仍失败请 WhatsApp 010-337 0197';
            else if (code === 'storage/canceled') msg = '上传被取消，请重试';
            else if (code === 'storage/retry-limit-exceeded') msg = '网络太慢，请换 Wi-Fi 重试';
            else if (code === 'storage/quota-exceeded') msg = '存储空间已满，请联系客服';
            else if (err?.message) msg = `上传失败：${err.message}`;
            alert(msg);
        }
        setUploading(false);
    };

    const handleBuy = async () => {
        if (!currentUser) { alert('请先登录'); return; }
        if (!paymentMethod) { setError('请选择付款方式'); return; }
        if (paymentMethod === 'qr' && !receiptUploaded) {
            setError('请先上传付款截图');
            return;
        }
        setError('');
        setSubmitting(true);

        try {
            const token = await currentUser.getIdToken();

            // ── 1. Create purchase doc ──────────────────────────
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
            if (!createRes.ok) throw new Error(createData.error || '创建订单失败');

            const purchaseId: string = createData.purchaseId;

            // ── 2a. QR flow → done; admin will confirm later ────
            if (paymentMethod === 'qr') {
                setSuccessPurchaseId(purchaseId);
                setPendingReview(true);
                setVoucherCount(selectedBundle.voucherCount);
                return;
            }

            // ── 2b. FPX flow → open Razorpay ────────────────────
            await new Promise<void>((resolve, reject) => {
                let resolved = false;
                const options = {
                    key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                    amount: createData.amount,
                    currency: createData.currency,
                    order_id: createData.razorpayOrderId,
                    name: 'Incredibowl 餐券包',
                    description: `${selectedBundle.voucherCount} 张餐券（${MEAL_VOUCHER_VALIDITY_DAYS} 天有效）`,
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
                            if (!confirmRes.ok) throw new Error(confirmData.error || '确认失败');
                            setSuccessPurchaseId(purchaseId);
                            setVoucherCount(confirmData.voucherCount || selectedBundle.voucherCount);
                            resolve();
                        } catch (err: any) {
                            reject(err);
                        }
                    },
                    modal: {
                        ondismiss: () => {
                            // Wait briefly; Razorpay sometimes fires ondismiss before handler
                            setTimeout(() => { if (!resolved) reject(new Error('已取消支付')); }, 1500);
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
            if (err?.message !== '已取消支付') {
                setError(err?.message || '购买失败，请重试');
            }
        } finally {
            setSubmitting(false);
        }
    };

    // ─────────────────── Not logged in ───────────────────
    if (authChecked && !currentUser) {
        return (
            <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4">
                <div className="text-center space-y-4 max-w-sm">
                    <div className="text-6xl">🎟️</div>
                    <h1 className="text-2xl font-black text-[#1A2D23]">餐券预付包</h1>
                    <p className="text-gray-500 text-sm">请先在首页登录后再购买餐券</p>
                    <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-[#1A2D23] text-white rounded-xl font-bold hover:bg-[#2A3D33] transition-colors">
                        <ArrowLeft size={16} /> 返回首页登录
                    </Link>
                </div>
            </div>
        );
    }

    if (!authChecked) {
        return (
            <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-[#FF6B35] border-t-transparent rounded-full"></div>
            </div>
        );
    }

    // ─────────────────── Success state ───────────────────
    if (successPurchaseId) {
        return (
            <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-[32px] p-8 shadow-2xl border border-[#E3EADA] text-center space-y-5">
                    {pendingReview ? (
                        <>
                            <div className="w-20 h-20 mx-auto bg-amber-50 rounded-full flex items-center justify-center">
                                <Clock className="w-10 h-10 text-amber-600" />
                            </div>
                            <h2 className="text-2xl font-black text-[#1A2D23]">付款已收到，等待核对</h2>
                            <p className="text-sm text-gray-500 leading-relaxed">
                                我们会在 24 小时内核对你的付款凭证。<br />
                                核对通过后，<span className="text-[#FF6B35] font-bold">{voucherCount} 张餐券</span>即刻到账，{MEAL_VOUCHER_VALIDITY_DAYS} 天有效。
                            </p>
                        </>
                    ) : (
                        <>
                            <div className="w-20 h-20 mx-auto bg-green-50 rounded-full flex items-center justify-center">
                                <CheckCircle className="w-10 h-10 text-green-600" />
                            </div>
                            <h2 className="text-2xl font-black text-[#1A2D23]">购买成功 🎉</h2>
                            <p className="text-sm text-gray-500 leading-relaxed">
                                <span className="text-[#FF6B35] font-bold text-xl">{voucherCount} 张餐券</span>已到账，
                                可在结账时一键抵扣主餐。<br />
                                有效期：{MEAL_VOUCHER_VALIDITY_DAYS} 天
                            </p>
                        </>
                    )}

                    <div className="bg-[#FDFBF7] rounded-2xl p-4 text-left text-xs text-gray-500 space-y-1.5 border border-[#E3EADA]">
                        <p>📌 订单号：<span className="font-mono text-[#1A2D23]">{successPurchaseId.slice(-8).toUpperCase()}</span></p>
                        <p>🎟️ 张数：<span className="font-bold text-[#1A2D23]">{voucherCount}</span></p>
                        <p>⏰ 有效期：<span className="font-bold text-[#1A2D23]">{MEAL_VOUCHER_VALIDITY_DAYS} 天</span></p>
                    </div>

                    <div className="flex gap-3">
                        <Link href="/member" className="flex-1 py-3 bg-[#1A2D23] text-white rounded-xl font-bold text-sm hover:bg-[#2A3D33] transition-colors">
                            查看钱包
                        </Link>
                        <Link href="/" className="flex-1 py-3 bg-[#FF6B35] text-white rounded-xl font-bold text-sm hover:bg-[#E95D31] transition-colors">
                            去点餐
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // ─────────────────── Main shop UI ───────────────────
    return (
        <div className="min-h-screen bg-[#FDFBF7]">
            {/* Header */}
            <header className="bg-gradient-to-br from-[#1A2D23] via-[#21352A] to-[#12221A] text-white pt-8 pb-12 px-4 shadow-2xl shadow-[#1A2D23]/10">
                <div className="max-w-2xl mx-auto">
                    <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl border border-white/10 text-white/90 text-sm font-bold transition-all active:scale-95 mb-6">
                        <ArrowLeft size={16} /> 返回首页
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-[#FF6B35] flex items-center justify-center shadow-xl shadow-[#FF6B35]/30">
                            <Ticket size={32} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight">餐券预付包</h1>
                            <p className="text-white/60 text-sm font-bold mt-1">Meal Voucher Bundles · 一次买，慢慢吃</p>
                        </div>
                    </div>
                    <div className="mt-6 grid grid-cols-3 gap-2">
                        <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
                            <ShieldCheck size={16} className="text-[#FF6B35] mb-1" />
                            <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider">放心买</p>
                            <p className="text-xs font-bold text-white">不限菜品</p>
                        </div>
                        <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
                            <Calendar size={16} className="text-[#FF6B35] mb-1" />
                            <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider">有效期</p>
                            <p className="text-xs font-bold text-white">{MEAL_VOUCHER_VALIDITY_DAYS} 天</p>
                        </div>
                        <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
                            <Sparkles size={16} className="text-[#FF6B35] mb-1" />
                            <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider">最高省</p>
                            <p className="text-xs font-bold text-white">RM 37</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-2xl mx-auto px-4 -mt-6 relative z-10 pb-12 space-y-6">
                {/* Bundle picker */}
                <section className="space-y-3">
                    {MEAL_VOUCHER_BUNDLES.map((bundle) => {
                        const isSelected = selectedBundleId === bundle.id;
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
                                            <h3 className="text-lg font-black text-[#1A2D23]">{bundle.label}</h3>
                                            {bundle.highlight && (
                                                <span className="px-2 py-0.5 bg-[#FF6B35]/10 text-[#FF6B35] text-[10px] font-black rounded-full uppercase tracking-wider">
                                                    {bundle.highlight}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 font-bold">
                                            单券 RM {bundle.pricePerVoucher.toFixed(2)}
                                            {bundle.savings > 0 && (
                                                <span className="text-green-600 ml-2">
                                                    省 RM {bundle.savings.toFixed(2)}（{bundle.savingsPercent}%）
                                                </span>
                                            )}
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

                {/* Promo code — same UX as checkout drawer */}
                <section className="bg-white rounded-2xl p-5 shadow-md border border-[#E3EADA] space-y-2">
                    <h4 className="text-sm font-black text-[#1A2D23] flex items-center gap-2">
                        <Tag size={14} className="text-[#FF6B35]" /> 优惠码 / Promo Code
                    </h4>
                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                            <input
                                type="text"
                                value={promoCode}
                                onChange={(e) => { setPromoCode(e.target.value); setPromoError(''); }}
                                placeholder="输入优惠码 / Promo Code"
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
                                取消
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleApplyPromo}
                                disabled={isCheckingPromo}
                                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-colors ${isCheckingPromo ? 'bg-gray-300 text-gray-400 cursor-not-allowed' : 'bg-[#1A2D23] text-white hover:bg-[#2A3D33]'}`}
                            >
                                {isCheckingPromo ? '验证中…' : '使用'}
                            </button>
                        )}
                    </div>
                    {promoError && <p className="text-[10px] text-red-500 font-medium pl-1">{promoError}</p>}
                    {promoApplied && (
                        <p className="text-[10px] text-green-600 font-bold pl-1 flex items-center gap-1">
                            <CheckCircle size={12} /> 已减免 RM {cappedPromoDiscount.toFixed(2)}
                        </p>
                    )}

                    {/* Price summary */}
                    <div className="mt-3 pt-3 border-t border-[#E3EADA] space-y-1 text-xs">
                        <div className="flex justify-between text-gray-500">
                            <span>组合价</span>
                            <span className={promoApplied ? 'line-through' : ''}>RM {selectedBundle.price.toFixed(2)}</span>
                        </div>
                        {promoApplied && (
                            <div className="flex justify-between text-green-600 font-bold">
                                <span>优惠减免</span>
                                <span>− RM {cappedPromoDiscount.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-black text-[#1A2D23] text-sm pt-1">
                            <span>实付</span>
                            <span className="text-[#FF6B35]">RM {finalPrice.toFixed(2)}</span>
                        </div>
                    </div>
                </section>

                {/* Rules */}
                <section className="bg-white/60 rounded-2xl p-5 border border-[#E3EADA]">
                    <h4 className="text-sm font-black text-[#1A2D23] mb-3 flex items-center gap-2">
                        <Sparkles size={14} className="text-[#FF6B35]" /> 使用规则
                    </h4>
                    <ul className="space-y-2 text-xs text-gray-600 leading-relaxed">
                        <li className="flex items-start gap-2">
                            <span className="text-[#FF6B35] mt-0.5">•</span>
                            <span><strong className="text-[#1A2D23]">1 张餐券 = 1 份主餐</strong>（任意菜品 RM 16.90–19.90 都能抵；多张券同时使用时，优先抵最贵的主餐，最划算）</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-[#FF6B35] mt-0.5">•</span>
                            <span><strong className="text-[#1A2D23]">加购项（饮料、加料、蛋等）</strong>不在抵扣范围内，需现金支付</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-[#FF6B35] mt-0.5">•</span>
                            <span>有效期 {MEAL_VOUCHER_VALIDITY_DAYS} 天，过期归零；不可叠加 RM 折扣券（推荐券 / 积分券）</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-[#FF6B35] mt-0.5">•</span>
                            <span>预付现金购买，不支持现金退款</span>
                        </li>
                    </ul>
                </section>

                {/* Payment selector */}
                <section className="bg-white rounded-2xl p-5 shadow-md border border-[#E3EADA] space-y-4">
                    <div>
                        <h4 className="text-sm font-black text-[#1A2D23] mb-3">选择付款方式</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setPaymentMethod('qr')}
                                className={`py-3 rounded-xl border-2 font-bold text-xs flex justify-center items-center gap-2 transition-all ${
                                    paymentMethod === 'qr'
                                        ? 'border-[#FF6B35] bg-[#FF6B35]/5 text-[#FF6B35]'
                                        : 'border-gray-200 text-gray-400'
                                }`}
                            >
                                <Phone size={14} /> DuitNow / QR
                            </button>
                            <button
                                onClick={() => setPaymentMethod('fpx')}
                                className={`py-3 rounded-xl border-2 font-bold text-xs flex justify-center items-center gap-2 transition-all ${
                                    paymentMethod === 'fpx'
                                        ? 'border-[#FF6B35] bg-[#FF6B35]/5 text-[#FF6B35]'
                                        : 'border-gray-200 text-gray-400'
                                }`}
                            >
                                <CreditCard size={14} /> FPX / Card
                            </button>
                        </div>
                    </div>

                    {paymentMethod === 'qr' && (
                        <div className="space-y-2 animate-in fade-in duration-300">
                            <div className="bg-white rounded-xl border border-[#E3EADA] p-2 max-w-[200px] mx-auto shadow-sm">
                                <Image src="/duitnow_qr.png" alt="DuitNow QR - INCREDIBOWL SERVICES" width={400} height={550} className="w-full h-auto rounded-lg" />
                            </div>
                            <div className="bg-[#F5F3EF] rounded-lg px-3 py-2 text-[10px] text-[#1A2D23]/60 space-y-0.5">
                                <p>✅ 商户：<strong className="text-[#1A2D23]">INCREDIBOWL SERVICES</strong></p>
                                <p>✅ 转账金额：<strong className="text-[#1A2D23]">RM {finalPrice.toFixed(2)}</strong>{promoApplied && <span className="text-green-600"> （已折 RM {cappedPromoDiscount.toFixed(2)}）</span>}</p>
                                <p>✅ 我们将在 24 小时内核对并发餐券到你的钱包</p>
                            </div>
                            {receiptUploaded && receiptUrl ? (
                                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-2">
                                    <div className="relative w-12 h-12">
                                        <Image src={receiptUrl} alt="Receipt" fill unoptimized className="rounded-lg object-cover border border-green-200" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-green-700 flex items-center gap-1"><CheckCircle size={12} /> 凭证已上传</p>
                                    </div>
                                    <label className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-[10px] font-bold cursor-pointer hover:bg-green-200">
                                        换图
                                        <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                                    </label>
                                </div>
                            ) : (
                                <label className={`w-full py-2.5 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors text-sm ${uploading ? 'bg-orange-50 border-orange-200' : 'bg-[#FDFBF7] border-[#E3EADA] hover:border-[#FF6B35]'}`}>
                                    {uploading ? (
                                        <><Loader2 size={16} className="text-[#FF6B35] animate-spin" /><span className="font-bold text-[#FF6B35] text-xs">上传中...</span></>
                                    ) : (
                                        <><Plus size={16} className="text-[#FF6B35]" /><span className="font-bold text-[#FF6B35] text-xs">上传付款截图</span></>
                                    )}
                                    <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
                                </label>
                            )}
                        </div>
                    )}

                    {paymentMethod === 'fpx' && (
                        <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 animate-in fade-in duration-300">
                            <p className="text-xs text-[#FF6B35] font-bold">🔒 安全在线支付</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">点击「立即购买」后将跳转至 Curlec 支付页面，付款成功后 {selectedBundle.voucherCount} 张餐券即刻到账</p>
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
                        <><Loader2 size={20} className="animate-spin" /> 处理中...</>
                    ) : (
                        <>
                            <Ticket size={20} />
                            立即购买 · RM {finalPrice.toFixed(2)}
                        </>
                    )}
                </button>
            </main>
        </div>
    );
}
