"use client";

import React, { useEffect } from 'react';
import { CheckCircle } from 'lucide-react';

interface CartSuccessProps {
    orderSuccess: string;
    cart: any[];
    userProfile: any;
    cartTotal: number;
}

export default function CartSuccess({ orderSuccess, cart, userProfile, cartTotal }: CartSuccessProps) {
    useEffect(() => {
        if (typeof window !== 'undefined' && (window as any).fbq) {
            (window as any).fbq('track', 'Purchase', { value: cartTotal, currency: 'MYR' });
        }
    }, [cartTotal]);

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
                        <span>
                            {orderSuccess.startsWith('GRP') ? '订单群组编号：' : '订单编号：'}
                            <span className="font-bold text-[#FF6B35]">#{orderSuccess.startsWith('GRP') ? orderSuccess : orderSuccess.slice(-6).toUpperCase()}</span>
                        </span>
                        {orderSuccess.startsWith('GRP') && (
                            <span className="text-[10px] font-bold text-[#FF6B35]/70 bg-[#FF6B35]/10 px-2 py-0.5 rounded-full mt-1">
                                你的订单已按送达日期自动拆分方便碗妈备餐
                            </span>
                        )}
                    </p>
                    <div className="bg-white rounded-2xl p-5 border border-[#E3EADA] text-left space-y-2">
                        <p className="text-sm">
                            <span className="font-bold">📅 配送安排：</span>
                            <span className="text-[#FF6B35] font-black">
                                {orderSuccess.startsWith('GRP')
                                    ? '多日配送 (已各自独立建单)'
                                    : `${cart[0]?.selectedDate || '未定'} ${cart[0]?.selectedTime?.includes('Lunch') ? '🌞午餐' : '🌙晚餐'}`}
                            </span>
                        </p>
                        <p className="text-sm"><span className="font-bold">📍 地址：</span>{userProfile?.address}</p>
                        <p className="text-sm"><span className="font-bold">💰 金额：</span><span className="text-[#FF6B35] font-black">RM {cartTotal.toFixed(2)}</span></p>
                        <p className="text-sm"><span className="font-bold">⭐ 获得积分：</span><span className="text-[#FF6B35] font-black">+{Math.floor(cartTotal)} 分 (核对后发放)</span></p>
                    </div>
                    <p className="text-sm font-bold text-[#FF6B35] animate-pulse">碗妈正在核对付款截图，请耐心等候 💬</p>
                    <p className="text-xs text-gray-400">核对成功后，积分将自动存入你的账户</p>
                </div>
            </div>
        </div>
    );
}
