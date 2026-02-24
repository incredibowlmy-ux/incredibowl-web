import React, { useState } from 'react';
import Image from 'next/image';
import { ShoppingBag, X, Plus, Minus, Trash2, Phone, Upload, CheckCircle, CreditCard, Sparkles, Utensils } from 'lucide-react';

// 这里我们暂时借用你原来的数据结构进行展示，实际应从 zustand store 获取
export default function CartDrawer({
    isOpen,
    onClose,
    cart,
    updateQuantity,
    removeFromCart,
    cartTotal,
    cartCount
}: any) {
    const [paymentMethod, setPaymentMethod] = useState<'qr' | 'razorpay'>('qr');
    const [receiptUploaded, setReceiptUploaded] = useState(false);

    if (!isOpen) return null;

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            // 模拟上传成功
            setTimeout(() => setReceiptUploaded(true), 800);
        }
    };

    const handleCheckout = () => {
        if (paymentMethod === 'qr' && !receiptUploaded) {
            alert("麻烦先 Upload 你的 Bank Receipt 哦，阿姨才能确定开火！");
            return;
        }
        alert("Payment Confirmed! 阿姨准时把温暖送到。");
    };

    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-[#5D4037]/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-[#FAF9F6] h-full shadow-2xl flex flex-col border-l border-[#B04A33]/20 animate-in slide-in-from-right duration-500">

                {/* 顶部标签 */}
                <div className="p-8 bg-white border-b border-[#B04A33]/10 flex justify-between items-center">
                    <h2 className="text-2xl font-black italic flex items-center gap-3 text-[#B04A33]">
                        <ShoppingBag /> 拎走温暖 ({cartCount})
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-[#FAF9F6] rounded-xl text-[#5D4037]">
                        <X size={24} />
                    </button>
                </div>

                {/* 购物车内容区 */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {cart.length === 0 ? (
                        <div className="text-center py-20 opacity-20 italic text-[#5D4037]">
                            <Utensils className="w-16 h-16 mx-auto mb-4" />
                            <p className="font-bold uppercase tracking-widest text-sm">还没有挑中心水的家味</p>
                        </div>
                    ) : (
                        cart.map((item: any, i: number) => (
                            <div key={item.cartItemId} className="bg-white rounded-3xl p-5 border border-[#B04A33]/5 shadow-sm flex gap-4 animate-in slide-in-from-bottom duration-500" style={{ animationDelay: `${i * 50}ms` }}>
                                <div className="w-16 h-16 rounded-2xl bg-[#FAF9F6] flex items-center justify-center text-3xl overflow-hidden relative">
                                    {item.image.startsWith('/') ? <Image src={item.image} alt={item.name} fill className="object-cover" /> : item.image}
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-black text-[#5D4037]">{item.name}</h4>
                                    <p className="text-[#B04A33] font-bold text-xl">RM {item.price.toFixed(2)}</p>
                                    <div className="flex items-center gap-3 mt-2">
                                        <button onClick={() => updateQuantity(item.cartItemId, -1)} className="w-6 h-6 rounded-md border border-[#B04A33]/10 flex items-center justify-center hover:bg-[#B04A33] hover:text-white transition-colors text-[#5D4037]"><Minus size={12} /></button>
                                        <span className="font-bold text-sm w-4 text-center text-[#5D4037]">{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.cartItemId, 1)} className="w-6 h-6 rounded-md border border-[#B04A33]/10 flex items-center justify-center hover:bg-[#B04A33] hover:text-white transition-colors text-[#5D4037]"><Plus size={12} /></button>
                                    </div>
                                </div>
                                <button onClick={() => removeFromCart(item.cartItemId)} className="text-[#D4A373]/30 hover:text-[#B04A33] transition-colors self-start"><Trash2 size={20} /></button>
                            </div>
                        ))
                    )}
                </div>

                {/* Checkout & Payment 区 */}
                {cart.length > 0 && (
                    <div className="p-8 bg-white border-t border-[#B04A33]/10 space-y-6 shadow-[0_-20px_40px_rgba(176,74,51,0.05)] text-[#5D4037]">
                        <div className="flex justify-between items-baseline mb-2">
                            <h3 className="text-lg font-bold italic opacity-40 uppercase tracking-widest">Grand Total</h3>
                            <p className="text-4xl font-black text-[#B04A33] italic text-right">RM {cartTotal.toFixed(2)}</p>
                        </div>

                        {/* 支付方式选择 */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <button
                                onClick={() => setPaymentMethod('qr')}
                                className={`py-3 rounded-xl border-2 font-bold text-sm flex justify-center items-center gap-2 transition-all ${paymentMethod === 'qr' ? 'border-[#B04A33] bg-[#B04A33]/5 text-[#B04A33]' : 'border-gray-100 text-gray-400'}`}
                            >
                                <Phone size={16} /> 户口扫码 (QR)
                            </button>
                            <button
                                onClick={() => setPaymentMethod('razorpay')}
                                className={`py-3 rounded-xl border-2 font-bold text-sm flex justify-center items-center gap-2 transition-all ${paymentMethod === 'razorpay' ? 'border-[#B04A33] bg-[#B04A33]/5 text-[#B04A33]' : 'border-gray-100 text-gray-400'}`}
                            >
                                <CreditCard size={16} /> FPX / Card
                            </button>
                        </div>

                        {/* QR Payment 逻辑 */}
                        {paymentMethod === 'qr' ? (
                            <div className="space-y-4 pt-4 border-t border-[#B04A33]/10 animate-in fade-in zoom-in duration-300">
                                <p className="text-sm font-black italic flex items-center gap-2">
                                    <Sparkles size={16} className="text-[#D4A373]" /> DuitNow / Bank QR
                                </p>
                                <div className="aspect-square w-48 mx-auto bg-white p-4 border-4 border-[#FAF9F6] rounded-2xl shadow-inner flex items-center justify-center relative">
                                    <div className="text-center font-black opacity-20 text-xs">BANK QR CODE <br />PLACEHOLDER</div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Image src="/logo_hd.png" alt="QR" width={48} height={48} className="rounded-full opacity-60 bg-white" />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <label className={`w-full py-4 border-2 border-dashed rounded-xl flex items-center justify-center gap-3 cursor-pointer transition-colors ${receiptUploaded ? 'bg-green-50 border-green-200' : 'bg-[#FAF9F6] border-[#D4A373]/30 hover:bg-[#D4A373]/5'}`}>
                                        {receiptUploaded ? (
                                            <>
                                                <CheckCircle size={20} className="text-green-500" />
                                                <span className="text-sm font-bold text-green-600">已上传凭证 / Uploaded</span>
                                            </>
                                        ) : (
                                            <>
                                                <Plus size={20} className="text-[#D4A373]" />
                                                <span className="text-sm font-bold text-[#D4A373]">上传付款截图 / Upload Receipt</span>
                                            </>
                                        )}
                                        <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                                    </label>
                                </div>
                            </div>
                        ) : (
                            <div className="pt-4 border-t border-[#B04A33]/10 text-center space-y-2 animate-in fade-in duration-300">
                                <p className="text-sm font-bold italic text-[#795548]">Powered by Razorpay / Curlec</p>
                                <p className="text-xs text-[#D4A373]">点击下方按钮将前往安全支付网关</p>
                            </div>
                        )}

                        <button
                            onClick={handleCheckout}
                            disabled={paymentMethod === 'qr' && !receiptUploaded}
                            className={`w-full py-5 rounded-2xl font-bold text-xl transition-all shadow-xl flex items-center justify-center gap-4 ${paymentMethod === 'qr' && !receiptUploaded ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' : 'bg-[#B04A33] text-white hover:bg-[#8D3421] shadow-[#B04A33]/20'}`}
                        >
                            <CheckCircle size={24} /> 确认下单 / Confirm Order →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
