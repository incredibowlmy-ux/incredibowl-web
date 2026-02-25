"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { ShoppingBag, X, Plus, Minus, Trash2, Phone, CheckCircle, CreditCard, Sparkles, Utensils, AlertCircle } from 'lucide-react';
import { onAuthChange, getUserProfile } from '@/lib/auth';
import { submitOrder } from '@/lib/orders';
import { User } from 'firebase/auth';

export default function CartDrawer({
    isOpen,
    onClose,
    cart,
    updateQuantity,
    removeFromCart,
    cartTotal,
    cartCount,
    selectedDate,
    selectedTime,
    onAuthOpen,
    onClearCart
}: any) {
    const [paymentMethod, setPaymentMethod] = useState<'qr' | 'fpx'>('qr');
    const [receiptUploaded, setReceiptUploaded] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [orderNote, setOrderNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

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

    if (!isOpen) return null;

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setTimeout(() => setReceiptUploaded(true), 500);
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
        if (!selectedDate) {
            alert("请先选择配送日期！");
            return;
        }

        // Check receipt for QR payment
        if (paymentMethod === 'qr' && !receiptUploaded) {
            alert("请先上传付款截图！");
            return;
        }

        setSubmitting(true);

        try {
            const orderId = await submitOrder({
                userId: currentUser.uid,
                userName: currentUser.displayName || userProfile?.displayName || 'Guest',
                userEmail: currentUser.email || '',
                userPhone: userProfile.phone,
                userAddress: userProfile.address,
                items: cart.map((item: any) => ({
                    name: item.name,
                    nameEn: item.nameEn || '',
                    price: item.price,
                    quantity: item.quantity,
                    image: item.image || '',
                })),
                total: cartTotal,
                deliveryDate: selectedDate,
                deliveryTime: selectedTime || 'Lunch (11:00 AM - 1:00 PM)',
                paymentMethod: paymentMethod,
                receiptUploaded: receiptUploaded,
                status: 'pending',
                note: orderNote,
            });

            setOrderSuccess(orderId);

            // Clear cart after 3 seconds
            setTimeout(() => {
                onClearCart();
                setOrderSuccess(null);
                setReceiptUploaded(false);
                setOrderNote('');
                onClose();
            }, 4000);

        } catch (error: any) {
            alert(`下单失败: ${error.message}`);
        }

        setSubmitting(false);
    };

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
                        <p className="text-gray-500">
                            订单编号：<span className="font-bold text-[#FF6B35]">#{orderSuccess.slice(-6).toUpperCase()}</span>
                        </p>
                        <div className="bg-white rounded-2xl p-5 border border-[#E3EADA] text-left space-y-2">
                            <p className="text-sm"><span className="font-bold">📅 配送日期：</span>{selectedDate}</p>
                            <p className="text-sm"><span className="font-bold">⏰ 时段：</span>{selectedTime}</p>
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
                {cart.length > 0 && (
                    <div className="px-6 py-3 bg-[#E3EADA]/30 border-b border-[#E3EADA]/50 flex items-center gap-4 text-xs">
                        <span className="font-bold text-[#1A2D23]">📅 {selectedDate || '未选日期'}</span>
                        <span className="text-gray-300">|</span>
                        <span className="font-bold text-[#1A2D23]">⏰ {selectedTime || 'Lunch'}</span>
                    </div>
                )}

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {cart.length === 0 ? (
                        <div className="text-center py-20 opacity-20 text-[#1A2D23]">
                            <Utensils className="w-16 h-16 mx-auto mb-4" />
                            <p className="font-bold uppercase tracking-widest text-sm">还没有选中的菜品</p>
                        </div>
                    ) : (
                        cart.map((item: any, i: number) => (
                            <div key={item.cartItemId || item.id} className="bg-white rounded-2xl p-4 border border-[#E3EADA]/50 shadow-sm flex gap-4 animate-in slide-in-from-bottom duration-300" style={{ animationDelay: `${i * 50}ms` }}>
                                <div className="w-14 h-14 rounded-xl bg-[#FDFBF7] flex items-center justify-center text-2xl overflow-hidden relative shrink-0">
                                    {item.image?.startsWith('/') ? <Image src={item.image} alt={item.name} fill className="object-cover" /> : item.image}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-[#1A2D23] text-sm truncate">{item.name}</h4>
                                    <p className="text-[#FF6B35] font-black text-lg">RM {item.price.toFixed(2)}</p>
                                    <div className="flex items-center gap-3 mt-1">
                                        <button onClick={() => updateQuantity(item.cartItemId || item.id, -1)} className="w-7 h-7 rounded-lg border border-[#E3EADA] flex items-center justify-center hover:bg-[#FF6B35] hover:text-white hover:border-[#FF6B35] transition-colors"><Minus size={14} /></button>
                                        <span className="font-black text-sm w-4 text-center">{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.cartItemId || item.id, 1)} className="w-7 h-7 rounded-lg border border-[#E3EADA] flex items-center justify-center hover:bg-[#FF6B35] hover:text-white hover:border-[#FF6B35] transition-colors"><Plus size={14} /></button>
                                    </div>
                                </div>
                                <button onClick={() => removeFromCart(item.cartItemId || item.id)} className="text-gray-300 hover:text-red-400 transition-colors self-start"><Trash2 size={18} /></button>
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

                {/* Checkout Section */}
                {cart.length > 0 && (
                    <div className="p-6 bg-white border-t border-[#E3EADA] space-y-4 shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
                        {/* Total */}
                        <div className="flex justify-between items-baseline">
                            <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Total</span>
                            <span className="text-3xl font-black text-[#FF6B35]">RM {cartTotal.toFixed(2)}</span>
                        </div>

                        {/* Points preview */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-[#E3EADA]/30 rounded-xl">
                            <Sparkles size={14} className="text-[#FF6B35]" />
                            <span className="text-xs font-bold text-[#1A2D23]/60">核对成功后可获 <span className="text-[#FF6B35]">+{Math.floor(cartTotal)}</span> 积分</span>
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
                                onClick={() => setPaymentMethod('fpx')}
                                className={`py-3 rounded-xl border-2 font-bold text-xs flex justify-center items-center gap-2 transition-all ${paymentMethod === 'fpx' ? 'border-[#FF6B35] bg-[#FF6B35]/5 text-[#FF6B35]' : 'border-gray-200 text-gray-400'}`}
                            >
                                <CreditCard size={14} /> FPX / Card
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
                                <label className={`w-full py-2.5 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors text-sm ${receiptUploaded ? 'bg-green-50 border-green-200' : 'bg-[#FDFBF7] border-[#E3EADA] hover:border-[#FF6B35]'}`}>
                                    {receiptUploaded ? (
                                        <><CheckCircle size={16} className="text-green-500" /><span className="font-bold text-green-600 text-xs">已上传凭证 ✓</span></>
                                    ) : (
                                        <><Plus size={16} className="text-[#FF6B35]" /><span className="font-bold text-[#FF6B35] text-xs">上传付款截图</span></>
                                    )}
                                    <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                                </label>
                            </div>
                        )}

                        {paymentMethod === 'fpx' && (
                            <div className="text-center py-3 animate-in fade-in duration-300">
                                <p className="text-xs text-gray-400">即将支持 FPX 在线支付</p>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            onClick={handleCheckout}
                            disabled={submitting || !currentUser || (paymentMethod === 'qr' && !receiptUploaded)}
                            className={`w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-xl flex items-center justify-center gap-3 ${submitting || !currentUser || (paymentMethod === 'qr' && !receiptUploaded)
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                                : 'bg-[#FF6B35] text-white hover:bg-[#E95D31] shadow-[#FF6B35]/20'
                                }`}
                        >
                            <CheckCircle size={22} />
                            {submitting ? '提交中...' : '确认下单 →'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
