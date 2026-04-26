"use client";

import { MessageCircleHeart, ArrowRight } from 'lucide-react';

export default function PromoBanner() {
    const scrollToMenu = () => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' });

    return (
        <div className="lg:col-span-12 mt-4">
            <div className="relative bg-gradient-to-br from-[#1A2D23] via-[#243A2D] to-[#1A2D23] rounded-[32px] p-6 md:p-8 overflow-hidden border border-[#FF6B35]/15">
                {/* Decorative blurs */}
                <div className="w-48 h-48 bg-[#FF6B35] rounded-full blur-3xl opacity-15 absolute -top-16 -left-10 pointer-events-none" />
                <div className="w-48 h-48 bg-[#FF9B50] rounded-full blur-3xl opacity-10 absolute -bottom-16 -right-10 pointer-events-none" />

                <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-center">
                    {/* Left: Appreciation intro — simplified to 4 levels */}
                    <div className="md:col-span-5">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="px-2.5 py-1 rounded-md bg-[#FF6B35]/20 text-[#FF9B50] text-xs font-black tracking-widest border border-[#FF6B35]/30">
                                新开张
                            </span>
                            <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">
                                感恩折扣
                            </h3>
                        </div>
                        <p className="text-white/80 text-sm leading-relaxed">
                            新店开灶，感谢街坊支持 🎉<br />
                            你的声音很重要 — 评价送 RM3 回购券
                        </p>
                        <p className="text-white/55 text-[13px] italic leading-relaxed mt-1.5">
                            Your voice matters — review for RM3 voucher
                        </p>
                    </div>

                    {/* Right: Review reward offer — sub-card */}
                    <div className="md:col-span-7 flex items-center">
                        <div className="w-full bg-white/[0.04] border border-[#FF6B35]/25 rounded-2xl p-5 md:p-6 backdrop-blur-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <MessageCircleHeart size={18} className="text-[#FF9B50]" strokeWidth={2.5} />
                                <p className="text-[#FF9B50] font-black text-[15px]">好评返券</p>
                            </div>
                            <p className="text-white/85 text-[15px] leading-relaxed mb-4">
                                分享你的评价（带图更好），送你 <span className="text-[#FF9B50] font-black">RM 3 回购券</span>。
                            </p>

                            {/* CTA → scroll to menu */}
                            <button
                                type="button"
                                onClick={scrollToMenu}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FF6B35] hover:bg-[#E95D31] text-white text-[15px] font-bold rounded-full shadow-md shadow-[#FF6B35]/20 transition-all active:scale-95 group"
                            >
                                <span>下单后即可获得资格</span>
                                <ArrowRight size={14} strokeWidth={3} className="group-hover:translate-x-0.5 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
