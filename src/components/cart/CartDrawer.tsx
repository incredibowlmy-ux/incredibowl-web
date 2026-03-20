"use client";

import React, { useState, useEffect } from 'react';
import { ShoppingBag, X, Plus, AlertCircle, Tag, CheckCircle, Sparkles, Utensils, CreditCard, Phone, Calendar } from 'lucide-react';
import { onAuthChange, getUserProfile } from '@/lib/auth';
// updateOrderStatus moved to server-side /api/confirm-order
import { User } from 'firebase/auth';
import { isValidMyPhone } from '@/lib/cartUtils';
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

    const finalTotal = Math.max(0, cartTotal - promoDiscount);

    const handleApplyPromo = async () => {
        const code = promoCode.trim().toUpperCase();
        if (!code) return;
        setIsCheckingPromo(true);
        setPromoError('');
        try {
            const res = await fetch('/api/check-voucher', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ voucherCode: code }),
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

    const markVoucherUsed = async (code: string, uid: string) => {
        const res = await fetch('/api/use-voucher', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ voucherCode: code, userId: uid }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            console.warn('Failed to mark voucher used:', data.error);
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

    if (!isOpen) return null;

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setUploading(true);
        try {
            const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
            const { storage } = await import('@/lib/firebase');
            const storageRef = ref(storage, `receipts/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            setReceiptUrl(await getDownloadURL(storageRef));
            setReceiptUploaded(true);
        } catch { alert('上传失败，请重试'); }
        setUploading(false);
    };

    /** Submit order via server-side API for price validation */
    const submitOrderViaAPI = async () => {
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
                paymentMethod,
                receiptUploaded,
                receiptUrl: receiptUrl || undefined,
                promoCode: promoApplied ? promoCode.trim().toUpperCase() : '',
                promoDiscount: promoApplied ? promoDiscount : 0,
                orderNote: orderNote || '',
            }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '提交订单失败');
        return data as { orderIds: string[]; groupId: string | null; isMultiPart: boolean; serverTotal: number };
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
        if (paymentMethod === 'qr' && !receiptUploaded) { alert("请先上传付款截图！"); return; }

        if (paymentMethod === 'fpx') {
            // Step 1: Submit orders via server-side validated API as 'pending' BEFORE opening payment.
            setSubmitting(true);
            let orderIds: string[] = [];
            let isMultiPart = false;
            let groupId: string | null = null;
            try {
                const result = await submitOrderViaAPI();
                orderIds = result.orderIds;
                isMultiPart = result.isMultiPart;
                groupId = result.groupId;
            } catch (err: any) {
                alert(err.message || '建立订单失败，请重试');
                setSubmitting(false);
                return;
            }
            // Step 2: Save for FPX redirect recovery in page.tsx.
            const payloads = orderIds.map(() => ({ userId: currentUser!.uid, total: finalTotal / orderIds.length }));
            sessionStorage.setItem('fpx_pending_order', JSON.stringify({ orderIds, groupId, isMultiPart, payloads }));
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
                sessionStorage.removeItem('fpx_pending_order');
                setOrderSuccess(isMultiPart ? groupId! : orderIds[0]);
                setTimeout(() => { onClearCart(); setOrderSuccess(null); setReceiptUploaded(false); setReceiptUrl(''); setOrderNote(''); setPromoCode(''); setPromoApplied(false); setPromoDiscount(0); onClose(); }, 4000);
            } catch (err: any) {
                if (err.message === '已取消支付') {
                    await fetch('/api/confirm-order', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ orderIds, status: 'cancelled' }),
                    }).catch(() => {});
                    sessionStorage.removeItem('fpx_pending_order');
                } else {
                    alert(err.message || '支付失败，请重试');
                }
            }
            setSubmitting(false);
            return;
        }

        // QR flow — also uses server-side validated API
        setSubmitting(true);
        try {
            const result = await submitOrderViaAPI();
            setOrderSuccess(result.isMultiPart ? result.groupId! : result.orderIds[0]);
            setTimeout(() => { onClearCart(); setOrderSuccess(null); setReceiptUploaded(false); setReceiptUrl(''); setOrderNote(''); setPromoCode(''); setPromoApplied(false); setPromoDiscount(0); onClose(); }, 4000);
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
                                            placeholder="输入优惠码 / Promo Code" disabled={promoApplied}
                                            className={`w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm font-medium outline-none transition-colors ${promoApplied ? 'bg-green-50 border-green-200 text-green-700' : 'bg-[#FDFBF7] border-[#E3EADA] focus:border-[#FF6B35]'}`} />
                                    </div>
                                    {promoApplied ? (
                                        <button onClick={() => { setPromoApplied(false); setPromoDiscount(0); setPromoCode(''); }}
                                            className="px-3 py-2.5 rounded-xl text-xs font-bold text-red-500 border border-red-200 hover:bg-red-50 transition-colors">取消</button>
                                    ) : (
                                        <button onClick={handleApplyPromo} disabled={isCheckingPromo}
                                            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-colors ${isCheckingPromo ? 'bg-gray-300 text-gray-400 cursor-not-allowed' : 'bg-[#1A2D23] text-white hover:bg-[#2A3D33]'}`}>
                                            {isCheckingPromo ? '验证中…' : '使用'}
                                        </button>
                                    )}
                                </div>
                                {promoError && <p className="text-[10px] text-red-500 font-medium pl-1">{promoError}</p>}
                                {promoApplied && <p className="text-[10px] text-green-600 font-bold pl-1 flex items-center gap-1"><CheckCircle size={12} /> 已减免 RM {promoDiscount.toFixed(2)}</p>}
                            </div>

                            {/* Total */}
                            <div className="flex justify-between items-baseline">
                                <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Total</span>
                                <div className="text-right">
                                    {promoApplied && <span className="text-sm text-gray-400 line-through mr-2">RM {cartTotal.toFixed(2)}</span>}
                                    <span className="text-3xl font-black text-[#FF6B35]">RM {finalTotal.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Points preview */}
                            <div className="flex items-center gap-2 px-3 py-2 bg-[#E3EADA]/30 rounded-xl">
                                <Sparkles size={14} className="text-[#FF6B35]" />
                                <span className="text-xs font-bold text-[#1A2D23]/60">核对成功后可获 <span className="text-[#FF6B35]">+{Math.floor(finalTotal)}</span> 积分</span>
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

                            {/* Payment method selector */}
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

                            {/* Submit */}
                            <button onClick={handleCheckout}
                                disabled={submitting || !currentUser || !paymentMethod || (paymentMethod === 'qr' && !receiptUploaded)}
                                className={`w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-xl flex items-center justify-center gap-3 ${submitting || !currentUser || !paymentMethod || (paymentMethod === 'qr' && !receiptUploaded)
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
