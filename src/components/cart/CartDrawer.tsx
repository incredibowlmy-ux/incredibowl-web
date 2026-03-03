"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { ShoppingBag, X, Plus, Minus, Trash2, Phone, CheckCircle, CreditCard, Sparkles, Utensils, AlertCircle, Tag, Loader2, Calendar, Shield } from 'lucide-react';
import { onAuthChange, getUserProfile } from '@/lib/auth';
import { submitOrder, updateOrderStatus } from '@/lib/orders';
import { User } from 'firebase/auth';

// Declare Razorpay on window
declare global {
    interface Window {
        Razorpay: any;
    }
}

export default function CartDrawer({
    isOpen,
    onClose,
    cart,
    updateQuantity,
    removeFromCart,
    cartTotal,
    cartCount,
    onAuthOpen,
    onClearCart,
    onEditItem
}: any) {
    const [paymentMethod, setPaymentMethod] = useState<'qr' | 'curlec' | ''>('');
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
    const [razorpayLoaded, setRazorpayLoaded] = useState(false);

    // Load Razorpay checkout script
    useEffect(() => {
        if (typeof window !== 'undefined' && !window.Razorpay) {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.async = true;
            script.onload = () => setRazorpayLoaded(true);
            script.onerror = () => console.error('Failed to load Razorpay script');
            document.body.appendChild(script);
        } else if (window.Razorpay) {
            setRazorpayLoaded(true);
        }
    }, []);

    const handleApplyPromo = () => {
        const code = promoCode.trim().toUpperCase();
        if (!code) return;
        if (code.startsWith('IB-') || code.startsWith('POINTS') || code === 'INCREDIBOWL10') {
            setPromoDiscount(10);
            setPromoApplied(true);
            setPromoError('');
        } else {
            setPromoError('优惠码无效，请检查后重试');
            setPromoApplied(false);
            setPromoDiscount(0);
        }
    };

    const finalTotal = Math.max(0, cartTotal - promoDiscount);

    useEffect(() => {
        const unsubscribe = onAuthChange(async (user: User | null) => {
            setCurrentUser(user);
            if (user) {
                const profile = await getUserProfile(user.uid);
                setUserProfile(profile);
            } else {
                setUserProfile(null);
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const fetchProfile = async () => {
            if (isOpen && currentUser) {
                const profile = await getUserProfile(currentUser.uid);
                setUserProfile(profile);
            }
        };
        fetchProfile();
    }, [isOpen, currentUser]);



    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setUploading(true);
        try {
            const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
            const { storage } = await import('@/lib/firebase');
            const fileName = `receipts/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, fileName);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            setReceiptUrl(url);
            setReceiptUploaded(true);
        } catch (error) {
            alert('上传失败，请重试');
        }
        setUploading(false);
    };

    // Helper: build order groups from cart
    const buildOrderGroups = useCallback(() => {
        const grouped = cart.reduce((acc: any, item: any) => {
            const key = `${item.selectedDate || '未定'}|${item.selectedTime || 'Lunch'}`;
            if (!acc[key]) {
                acc[key] = {
                    date: item.selectedDate || '未定',
                    time: item.selectedTime || 'Lunch',
                    items: [],
                    subtotal: 0
                };
            }
            acc[key].items.push(item);
            acc[key].subtotal += (item.price * item.quantity);
            return acc;
        }, {});
        return Object.values(grouped) as any[];
    }, [cart]);

    // Helper: submit orders to Firebase
    const submitAllOrders = async (payMethod: 'qr' | 'curlec', razorpayData?: { paymentId: string; orderId: string; signature: string }) => {
        const groups = buildOrderGroups();
        const isMultiPart = groups.length > 1;
        const groupId = `GRP-${Date.now().toString(36).toUpperCase()}`;

        let remainingPromo = promoDiscount;

        const orderTotals: number[] = [];

        const submitPromises = groups.map((group, index) => {
            let currentPromo = 0;
            if (promoApplied && promoDiscount > 0) {
                if (index === groups.length - 1) {
                    currentPromo = Number(remainingPromo.toFixed(2));
                } else {
                    currentPromo = Number(((group.subtotal / cartTotal) * promoDiscount).toFixed(2));
                    remainingPromo -= currentPromo;
                }
            }

            const currentFinal = Math.max(0, group.subtotal - currentPromo);
            orderTotals.push(currentFinal);

            return submitOrder({
                userId: currentUser!.uid,
                userName: currentUser!.displayName || userProfile?.displayName || 'Guest',
                userEmail: currentUser!.email || '',
                userPhone: userProfile.phone,
                userAddress: userProfile.address,
                items: group.items.flatMap((bundle: any) => {
                    const arr = [];
                    arr.push({
                        name: bundle.dish.name,
                        nameEn: bundle.dish.nameEn || '',
                        price: bundle.dish.price,
                        quantity: bundle.dishQty * bundle.quantity,
                        image: bundle.dish.image || '',
                    });
                    if (bundle.addOns) {
                        bundle.addOns.forEach((a: any) => {
                            arr.push({
                                name: `↳ ${a.item.name}`,
                                nameEn: a.item.nameEn || '',
                                price: a.item.price,
                                quantity: a.quantity * bundle.quantity,
                                image: a.item.image || '',
                            });
                        });
                    }
                    return arr;
                }),
                total: currentFinal,
                originalTotal: group.subtotal,
                promoCode: promoApplied ? promoCode.trim().toUpperCase() : '',
                promoDiscount: currentPromo,
                deliveryDate: group.date,
                deliveryTime: group.time,
                paymentMethod: payMethod,
                receiptUploaded: payMethod === 'qr' ? receiptUploaded : false,
                receiptUrl: payMethod === 'qr' ? receiptUrl : '',
                ...(razorpayData?.paymentId ? { razorpayPaymentId: razorpayData.paymentId } : {}),
                ...(razorpayData?.orderId ? { razorpayOrderId: razorpayData.orderId } : {}),
                ...(razorpayData?.signature ? { razorpaySignature: razorpayData.signature } : {}),
                status: payMethod === 'curlec' ? 'confirmed' : 'pending',
                note: orderNote || '',
                isMultiPart,
                ...(isMultiPart ? { partIndex: index + 1 } : {}),
                ...(isMultiPart ? { totalParts: groups.length } : {}),
                ...(isMultiPart ? { groupId: groupId } : {}),
            });
        });

        const orderIds = await Promise.all(submitPromises);

        // Auto-award points for Curlec payments (since payment is already verified)
        if (payMethod === 'curlec') {
            const pointPromises = orderIds.map((orderId, index) =>
                updateOrderStatus(orderId, 'confirmed', {
                    userId: currentUser!.uid,
                    total: orderTotals[index],
                })
            );
            await Promise.all(pointPromises);
        }

        return { orderIds, isMultiPart, groupId };
    };

    // Process payment after Razorpay handler fires
    const processPaymentResult = async (razorpayResponse: any) => {
        try {
            // Step 3: Verify payment signature on server
            const verifyRes = await fetch('/api/payment/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    razorpay_order_id: razorpayResponse.razorpay_order_id,
                    razorpay_payment_id: razorpayResponse.razorpay_payment_id,
                    razorpay_signature: razorpayResponse.razorpay_signature,
                }),
            });

            const verifyData = await verifyRes.json();

            if (verifyData.verified) {
                // Step 4: Submit order to Firebase
                const result = await submitAllOrders('curlec', {
                    paymentId: razorpayResponse.razorpay_payment_id,
                    orderId: razorpayResponse.razorpay_order_id,
                    signature: razorpayResponse.razorpay_signature,
                });

                setOrderSuccess(result.isMultiPart ? result.groupId : result.orderIds[0]);

                setTimeout(() => {
                    onClearCart();
                    setOrderSuccess(null);
                    setReceiptUploaded(false);
                    setReceiptUrl('');
                    setOrderNote('');
                    setPromoCode('');
                    setPromoApplied(false);
                    setPromoDiscount(0);
                    onClose();
                }, 5000);
            } else {
                alert('❌ 支付验证失败，请联系客服。您的付款不会被扣除。');
            }
        } catch (verifyError: any) {
            console.error('Payment verification error:', verifyError);
            alert(`❌ 支付验证出错: ${verifyError.message}\n请联系客服确认订单状态。`);
        }
        setSubmitting(false);
    };

    // Handle Curlec/Razorpay online payment
    const handleCurlecPayment = async () => {
        if (!razorpayLoaded || !window.Razorpay) {
            alert('支付模块加载中，请稍后重试...');
            return;
        }

        setSubmitting(true);

        try {
            // Step 1: Create order on server
            const amountInSen = Math.round(finalTotal * 100); // convert RM to sen
            const res = await fetch('/api/payment/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: amountInSen,
                    currency: 'MYR',
                    receipt: `incredibowl_${Date.now()}`,
                    notes: {
                        customerName: currentUser!.displayName || 'Guest',
                        customerEmail: currentUser!.email || '',
                        customerPhone: userProfile?.phone || '',
                    }
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || '创建支付订单失败');
            }

            const orderData = await res.json();

            // Step 2: Open Razorpay checkout modal
            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                amount: orderData.amount,
                currency: orderData.currency,
                name: 'Incredibowl',
                description: `${cart.length} 道菜品 · 新鲜无味精`,
                order_id: orderData.orderId,
                prefill: {
                    name: currentUser!.displayName || 'Guest',
                    email: currentUser!.email || '',
                    contact: userProfile?.phone || '',
                },
                theme: {
                    color: '#FF6B35',
                },
                // Use synchronous handler - Razorpay doesn't await async handlers
                handler: function (response: any) {
                    // Use setTimeout to break out of Razorpay's context
                    setTimeout(() => processPaymentResult(response), 100);
                },
                modal: {
                    ondismiss: function () {
                        setSubmitting(false);
                    },
                },
            };

            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (response: any) {
                alert(`❌ 支付失败: ${response.error.description}\n请重试或选择其他支付方式。`);
                setSubmitting(false);
            });
            rzp.open();

        } catch (error: any) {
            alert(`支付出错: ${error.message}`);
            setSubmitting(false);
        }
    };

    const handleCheckout = async () => {
        // Check login
        if (!currentUser) {
            onAuthOpen();
            return;
        }

        // Check profile completeness
        if (!userProfile?.phone || !userProfile?.address) {
            onAuthOpen();
            return;
        }

        // Check date selected
        if (cart.length > 0 && cart.some((item: any) => !item.selectedDate)) {
            alert("部分菜品未选择配送日期，请移除后重试！");
            return;
        }

        // Curlec online payment flow
        if (paymentMethod === 'curlec') {
            await handleCurlecPayment();
            return;
        }

        // QR payment flow (existing)
        if (paymentMethod === 'qr' && !receiptUploaded) {
            alert("请先上传付款截图！");
            return;
        }

        setSubmitting(true);

        try {
            const result = await submitAllOrders('qr');

            setOrderSuccess(result.isMultiPart ? result.groupId : result.orderIds[0]);

            setTimeout(() => {
                onClearCart();
                setOrderSuccess(null);
                setReceiptUploaded(false);
                setReceiptUrl('');
                setOrderNote('');
                setPromoCode('');
                setPromoApplied(false);
                setPromoDiscount(0);
                onClose();
            }, 4000);

        } catch (error: any) {
            alert(`下单失败: ${error.message}`);
        }

        setSubmitting(false);
    };

    if (!isOpen && !orderSuccess) return null;

    // Order success view
    if (orderSuccess) {
        return (
            <div className="fixed inset-0 z-[100] flex justify-end">
                <div className="absolute inset-0 bg-[#1A2D23]/60 backdrop-blur-sm" />
                <div className="relative w-full max-w-md bg-[#FDFBF7] h-full shadow-2xl flex flex-col items-center justify-center border-l border-[#E3EADA]">
                    <div className="text-center space-y-6 p-8 animate-in zoom-in-95 duration-500">
                        <div className="w-24 h-24 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle size={48} className="text-green-500" />
                        </div>
                        <h2 className="text-3xl font-black text-[#1A2D23]">订单已提交！🍛</h2>
                        <p className="text-gray-500 flex flex-col items-center gap-1">
                            <span>{orderSuccess.startsWith('GRP') ? '订单群组编号：' : '订单编号：'}<span className="font-bold text-[#FF6B35]">#{orderSuccess.startsWith('GRP') ? orderSuccess : orderSuccess.slice(-6).toUpperCase()}</span></span>
                            {orderSuccess.startsWith('GRP') && <span className="text-[10px] font-bold text-[#FF6B35]/70 bg-[#FF6B35]/10 px-2 py-0.5 rounded-full mt-1">你的订单已按送达日期自动拆分方便阿姨备餐</span>}
                        </p>
                        <div className="bg-white rounded-2xl p-5 border border-[#E3EADA] text-left space-y-2">
                            <p className="text-sm"><span className="font-bold">📅 配送安排：</span><span className="text-[#FF6B35] font-black">{orderSuccess.startsWith('GRP') ? '多日配送 (已各自独立建单)' : `${cart[0]?.selectedDate || '未定'} ${cart[0]?.selectedTime?.includes('Lunch') ? '🌞午餐' : '🌙晚餐'}`}</span></p>
                            <p className="text-sm"><span className="font-bold">📍 地址：</span>{userProfile?.address}</p>
                            <p className="text-sm"><span className="font-bold">💰 金额：</span><span className="text-[#FF6B35] font-black">RM {cartTotal.toFixed(2)}</span></p>
                            <p className="text-sm"><span className="font-bold">⭐ 获得积分：</span><span className="text-[#FF6B35] font-black">+{Math.floor(cartTotal)} 分 (核对后发放)</span></p>
                        </div>
                        <p className="text-sm font-bold text-[#FF6B35] animate-pulse">阿姨正在核对付款截图，请耐心等候 💬</p>
                        <p className="text-xs text-gray-400">核对成功后，积分将自动存入你的账户</p>
                    </div>
                </div>
            </div>
        );
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
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
                        <X size={22} />
                    </button>
                </div>

                {/* Delivery Info */}
                {/* Scrollable Middle Area: Delivery Info + Cart Items */}
                <div className="flex-1 overflow-y-auto flex flex-col">
                    {/* Delivery Info */}
                    {cart.length > 0 && (
                        <div className="px-6 py-4 bg-[#1A2D23]/5 border-b border-[#E3EADA] flex flex-col gap-2 shrink-0">
                            <div className="text-xs font-bold text-[#1A2D23] flex flex-col gap-2">
                                <p className="flex justify-between items-center bg-white p-2 rounded-lg border border-[#E3EADA]/50">
                                    <span className="text-gray-500 font-medium shrink-0">📍 送达地址</span>
                                    <span className="truncate ml-4 text-right">{userProfile?.address ? userProfile.address : <span className="text-red-500">尚未填写 (请在下方补充)</span>}</span>
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Cart Items */}
                    <div className="flex-1 p-6 space-y-4">
                        {cart.length === 0 ? (
                            <div className="text-center py-20 opacity-20 text-[#1A2D23]">
                                <Utensils className="w-16 h-16 mx-auto mb-4" />
                                <p className="font-bold uppercase tracking-widest text-sm">还没有选中的菜品</p>
                            </div>
                        ) : (
                            Object.entries(cart.reduce((acc: any, item: any) => {
                                const key = `${item.selectedDate || '未定'}|${item.selectedTime || 'Lunch'}`;
                                if (!acc[key]) acc[key] = { date: item.selectedDate || '未定', time: item.selectedTime || 'Lunch', items: [] };
                                acc[key].items.push(item);
                                return acc;
                            }, {})).sort().map(([key, group]: any) => (
                                <div key={key} className="space-y-3 mb-8">
                                    <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-[#FDFBF7] to-white rounded-lg border border-[#E3EADA]/50 shadow-sm">
                                        <div className="w-6 h-6 rounded-md bg-[#1A2D23]/5 flex items-center justify-center">
                                            <Calendar size={14} className="text-[#1A2D23]" />
                                        </div>
                                        <span className="text-sm font-black text-[#1A2D23]">{group.date}</span>
                                        <span className="text-[10px] bg-[#FF6B35]/10 text-[#FF6B35] px-2 py-1 rounded-md font-bold">{group.time.includes('Lunch') ? '🌞 午餐' : '🌙 晚餐'}</span>
                                    </div>
                                    {group.items.map((item: any, i: number) => (
                                        <div key={item.cartItemId} className="bg-white rounded-[24px] p-4 border border-[#E3EADA]/80 shadow-sm flex flex-col animate-in slide-in-from-bottom duration-300 relative group" style={{ animationDelay: `${i * 50}ms` }}>

                                            {/* Clickable Area for Editing */}
                                            {onEditItem && (
                                                <button
                                                    onClick={() => onEditItem(item)}
                                                    className="absolute inset-0 w-full h-full z-0 rounded-[24px] hover:bg-[#1A2D23]/[0.02] transition-colors"
                                                    aria-label="Edit Item"
                                                />
                                            )}

                                            {/* Top Row: Image & Title */}
                                            <div className="flex gap-4 items-center relative z-20">
                                                <div className="w-16 h-16 rounded-2xl bg-[#FDFBF7] flex items-center justify-center text-3xl overflow-hidden relative shrink-0 shadow-inner border border-[#E3EADA]/30">
                                                    {item.dish.image?.startsWith('/') ? <Image src={item.dish.image} alt={item.dish.name} fill className="object-cover" /> : item.dish.image}
                                                </div>
                                                <div className="flex-1 min-w-0 pr-8">
                                                    <div className="flex flex-col">
                                                        <h4 className="font-bold text-[#1A2D23] text-[15px] leading-snug truncate">
                                                            {item.dish.name}
                                                            {item.dishQty > 1 && <span className="ml-2 text-[10px] bg-[#1A2D23]/5 text-[#1A2D23] px-1.5 py-0.5 rounded font-bold inline-block relative -top-0.5">x{item.dishQty}</span>}
                                                        </h4>
                                                        {(item.addOns?.length > 0 || item.note) && (
                                                            <p className="text-[11px] text-gray-400 font-medium mt-0.5 flex flex-wrap gap-x-2">
                                                                {item.addOns?.length > 0 && <span>加购 {item.addOns.reduce((sum: number, a: any) => sum + a.quantity, 0)} 项</span>}
                                                                {item.note && <span>📝 备注</span>}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <p className="text-[#FF6B35] font-black text-lg mt-1 relative z-20 w-fit">RM {(item.price * item.quantity).toFixed(2)}</p>
                                                </div>
                                                <button onClick={() => removeFromCart(item.cartItemId)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors absolute top-0 right-0 z-20">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            {/* Action Row: Edit helper & Quantity */}
                                            <div className="flex items-center justify-between mt-3 px-1 relative z-20">
                                                {onEditItem ? (
                                                    <button onClick={() => onEditItem(item)} className="px-3 py-1.5 bg-gray-50 text-gray-400 text-[11px] font-bold rounded-lg hover:bg-gray-100 hover:text-gray-600 transition-all border border-gray-100">
                                                        Edit
                                                    </button>
                                                ) : <div />}

                                                <div className="flex items-center gap-2 bg-white border border-[#E3EADA] rounded-xl p-1 shadow-sm relative z-20">
                                                    <button onClick={() => updateQuantity(item.cartItemId, -1)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-[#F5F3EF] hover:text-[#1A2D23] transition-colors"><Minus size={14} /></button>
                                                    <span className="font-black text-sm w-5 text-center text-[#1A2D23]">{item.quantity}</span>
                                                    <button onClick={() => updateQuantity(item.cartItemId, 1)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-[#F5F3EF] hover:text-[#1A2D23] transition-colors"><Plus size={14} /></button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))
                        )}

                        {/* Order Note */}
                        {cart.length > 0 && (
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">备注 Note (可选)</label>
                                <textarea
                                    value={orderNote}
                                    onChange={(e) => setOrderNote(e.target.value)}
                                    placeholder="例：少辣、不要葱…"
                                    rows={2}
                                    className="w-full mt-1 px-4 py-3 bg-white border border-[#E3EADA] rounded-xl text-sm outline-none focus:border-[#FF6B35] transition-colors resize-none"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Checkout Section - Scrollable */}
                {cart.length > 0 && (
                    <div className="bg-white border-t border-[#E3EADA] shadow-[0_-10px_30px_rgba(0,0,0,0.03)] max-h-[55vh] overflow-y-auto">
                        <div className="p-5 space-y-3">
                            {/* Promo Code */}
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <div className="flex-1 relative">
                                        <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                                        <input
                                            type="text"
                                            value={promoCode}
                                            onChange={(e) => { setPromoCode(e.target.value); setPromoError(''); }}
                                            placeholder="输入优惠码 / Promo Code"
                                            disabled={promoApplied}
                                            className={`w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm font-medium outline-none transition-colors ${promoApplied ? 'bg-green-50 border-green-200 text-green-700' : 'bg-[#FDFBF7] border-[#E3EADA] focus:border-[#FF6B35]'
                                                }`}
                                        />
                                    </div>
                                    {promoApplied ? (
                                        <button onClick={() => { setPromoApplied(false); setPromoDiscount(0); setPromoCode(''); }} className="px-3 py-2.5 rounded-xl text-xs font-bold text-red-500 border border-red-200 hover:bg-red-50 transition-colors">取消</button>
                                    ) : (
                                        <button onClick={handleApplyPromo} className="px-4 py-2.5 bg-[#1A2D23] text-white rounded-xl text-xs font-bold hover:bg-[#2A3D33] transition-colors">使用</button>
                                    )}
                                </div>
                                {promoError && <p className="text-[10px] text-red-500 font-medium pl-1">{promoError}</p>}
                                {promoApplied && <p className="text-[10px] text-green-600 font-bold pl-1 flex items-center gap-1"><CheckCircle size={12} /> 已减免 RM {promoDiscount.toFixed(2)}</p>}
                            </div>

                            {/* Total */}
                            <div className="flex justify-between items-baseline">
                                <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Total</span>
                                <div className="text-right">
                                    {promoApplied && (
                                        <span className="text-sm text-gray-400 line-through mr-2">RM {cartTotal.toFixed(2)}</span>
                                    )}
                                    <span className="text-3xl font-black text-[#FF6B35]">RM {finalTotal.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Points preview */}
                            <div className="flex items-center gap-2 px-3 py-2 bg-[#E3EADA]/30 rounded-xl">
                                <Sparkles size={14} className="text-[#FF6B35]" />
                                <span className="text-xs font-bold text-[#1A2D23]/60">核对成功后可获 <span className="text-[#FF6B35]">+{Math.floor(finalTotal)}</span> 积分</span>
                            </div>

                            {/* Login Warning */}
                            {!currentUser && (
                                <button onClick={onAuthOpen} className="w-full py-3 bg-[#FFF3E0] text-[#E65100] rounded-xl flex items-center justify-center gap-2 font-bold text-sm border border-[#FFE0B2]">
                                    <AlertCircle size={16} /> 请先登录再下单
                                </button>
                            )}

                            {/* Profile Warning */}
                            {currentUser && (!userProfile?.phone || !userProfile?.address) && (
                                <button onClick={onAuthOpen} className="w-full py-3 bg-[#FFF3E0] text-[#E65100] rounded-xl flex items-center justify-center gap-2 font-bold text-sm border border-[#FFE0B2]">
                                    <AlertCircle size={16} /> 请先补充手机号和地址
                                </button>
                            )}

                            {/* Payment Methods */}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setPaymentMethod('qr')}
                                    className={`py-3 rounded-xl border-2 font-bold text-xs flex justify-center items-center gap-2 transition-all ${paymentMethod === 'qr' ? 'border-[#FF6B35] bg-[#FF6B35]/5 text-[#FF6B35]' : 'border-gray-200 text-gray-400'}`}
                                >
                                    <Phone size={14} /> DuitNow / QR
                                </button>
                                <button
                                    onClick={() => setPaymentMethod('curlec')}
                                    className={`py-3 rounded-xl border-2 font-bold text-xs flex justify-center items-center gap-2 transition-all ${paymentMethod === 'curlec' ? 'border-[#FF6B35] bg-[#FF6B35]/5 text-[#FF6B35]' : 'border-gray-200 text-gray-400'}`}
                                >
                                    <CreditCard size={14} /> 在线支付
                                </button>
                            </div>

                            {/* QR Upload */}
                            {paymentMethod === 'qr' && (
                                <div className="space-y-2 animate-in fade-in duration-300">
                                    {/* DuitNow QR Code - Compact */}
                                    <div className="bg-white rounded-xl border border-[#E3EADA] p-2 max-w-[200px] mx-auto shadow-sm">
                                        <Image src="/duitnow_qr.png" alt="DuitNow QR - INCREDIBOWL SERVICES" width={400} height={550} className="w-full h-auto rounded-lg" />
                                    </div>

                                    {/* Merchant Info - Compact */}
                                    <div className="bg-[#F5F3EF] rounded-lg px-3 py-2 text-[10px] text-[#1A2D23]/60 space-y-0.5">
                                        <p>✅ 商户：<strong className="text-[#1A2D23]">INCREDIBOWL SERVICES</strong></p>
                                        <p>✅ 合作银行：<strong className="text-[#1A2D23]">Hong Leong Bank</strong></p>
                                        <p>✅ 支持所有银行 & e-Wallet（TnG, SPay, MAE, Boost 等）</p>
                                    </div>

                                    {/* Upload Receipt */}
                                    {receiptUploaded && receiptUrl ? (
                                        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-2">
                                            <img src={receiptUrl} alt="Receipt" className="w-12 h-12 rounded-lg object-cover border border-green-200" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-green-700 flex items-center gap-1"><CheckCircle size={12} /> 凭证已上传</p>
                                                <p className="text-[10px] text-green-600/60 truncate">点击重新上传</p>
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

                            {paymentMethod === 'curlec' && (
                                <div className="space-y-2 animate-in fade-in duration-300">
                                    <div className="bg-gradient-to-r from-[#F5F3EF] to-white rounded-xl px-4 py-3 border border-[#E3EADA]/50">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Shield size={14} className="text-green-500" />
                                            <span className="text-[11px] font-bold text-[#1A2D23]">安全在线支付 · Curlec by Razorpay</span>
                                        </div>
                                        <div className="text-[10px] text-gray-400 space-y-0.5">
                                            <p>✅ 支持 FPX 线上银行转账（所有本地银行）</p>
                                            <p>✅ 支持 Visa / Mastercard 信用卡 & 借记卡</p>
                                            <p>✅ 付款成功后订单自动确认，无需等待核对</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                onClick={handleCheckout}
                                disabled={submitting || !currentUser || !paymentMethod || (paymentMethod === 'qr' && !receiptUploaded) || (paymentMethod === 'curlec' && !razorpayLoaded)}
                                className={`w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-xl flex items-center justify-center gap-3 ${submitting || !currentUser || !paymentMethod || (paymentMethod === 'qr' && !receiptUploaded) || (paymentMethod === 'curlec' && !razorpayLoaded)
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                                    : 'bg-[#FF6B35] text-white hover:bg-[#E95D31] shadow-[#FF6B35]/20'
                                    }`}
                            >
                                <CheckCircle size={22} />
                                {submitting ? '处理中...' : paymentMethod === 'curlec' ? `安全支付 RM ${finalTotal.toFixed(2)} →` : '确认下单 →'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
