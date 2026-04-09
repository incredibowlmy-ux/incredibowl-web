"use client";

import { Sparkles, Gift, MessageCircleHeart } from 'lucide-react';
import { OPENING_PROMO } from '@/data/promoConfig';

export default function PromoBanner() {
    return (
        <div className="lg:col-span-12 mt-4">
            <div className="relative bg-gradient-to-br from-[#1A2D23] via-[#243A2D] to-[#1A2D23] rounded-[32px] p-6 md:p-8 overflow-hidden border border-[#FF6B35]/15">
                {/* Decorative blurs */}
                <div className="w-48 h-48 bg-[#FF6B35] rounded-full blur-3xl opacity-15 absolute -top-16 -left-10 pointer-events-none" />
                <div className="w-48 h-48 bg-[#FF9B50] rounded-full blur-3xl opacity-10 absolute -bottom-16 -right-10 pointer-events-none" />

                <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-center">
                    {/* Left: Grand opening intro */}
                    <div className="md:col-span-5">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="px-2.5 py-1 rounded-md bg-[#FF6B35] text-white text-[11px] font-black tracking-widest animate-pulse shadow-lg shadow-[#FF6B35]/30">
                                新开张
                            </span>
                            <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">
                                限时优惠
                            </h3>
                        </div>
                        <p className="text-[#FF9B50] text-xs md:text-sm font-bold mb-2">
                            Grand Opening · Limited Time Offer
                        </p>
                        <p className="text-white/70 text-xs md:text-sm leading-relaxed mb-2">
                            新店开灶，双重福利感恩街坊！🎉<br />
                            首批顾客专属，错过等下次。
                        </p>
                        <p className="text-white/40 text-[11px] italic leading-relaxed">
                            Two welcome offers for our first neighbours — thanks for trusting us early.
                        </p>
                    </div>

                    {/* Right: Two perks */}
                    <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                        {/* Perk 1 */}
                        <div className="bg-white/[0.04] border border-[#FF6B35]/25 rounded-2xl p-4 md:p-5 backdrop-blur-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles size={16} className="text-[#FF9B50]" strokeWidth={2.5} />
                                <p className="text-[#FF9B50] font-black text-sm">福利一：尝鲜立减</p>
                            </div>
                            <p className="text-white/85 text-xs leading-snug mb-1">
                                即日起至 4月15日，每份餐点直接<span className="text-[#FF9B50] font-black">{OPENING_PROMO.label}</span>！
                            </p>
                            <p className="text-white/40 text-[11px] italic leading-snug flex items-start gap-1">
                                <Gift size={11} className="mt-0.5 shrink-0" />
                                <span>Welcome Discount · {OPENING_PROMO.label} off every bowl until Apr 15</span>
                            </p>
                        </div>

                        {/* Perk 2 */}
                        <div className="bg-white/[0.04] border border-[#FF6B35]/25 rounded-2xl p-4 md:p-5 backdrop-blur-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles size={16} className="text-[#FF9B50]" strokeWidth={2.5} />
                                <p className="text-[#FF9B50] font-black text-sm">福利二：好评返券</p>
                            </div>
                            <p className="text-white/85 text-xs leading-snug mb-1">
                                带图评价即送 <span className="text-[#FF9B50] font-black">RM 1 回购券</span>，下次抵扣！
                            </p>
                            <p className="text-white/40 text-[11px] italic leading-snug flex items-start gap-1">
                                <MessageCircleHeart size={11} className="mt-0.5 shrink-0" />
                                <span>Photo review reward · RM 1 voucher for your next order</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
