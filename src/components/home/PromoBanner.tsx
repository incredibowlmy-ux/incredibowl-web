"use client";

import { MessageCircleHeart, ArrowRight, Star, Ticket } from 'lucide-react';

export default function PromoBanner() {
    const scrollToMenu = () => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' });
    const scrollToFeedback = () => document.getElementById('feedback')?.scrollIntoView({ behavior: 'smooth' });

    return (
        <div className="lg:col-span-7 lg:col-start-6 lg:row-start-4 mt-4">
            <div className="relative bg-gradient-to-br from-[#1A2D23] via-[#243A2D] to-[#1A2D23] rounded-[32px] p-6 md:p-8 overflow-hidden border border-[#FF6B35]/15 h-full">
                {/* Decorative blurs */}
                <div className="w-48 h-48 bg-[#FF6B35] rounded-full blur-3xl opacity-15 absolute -top-16 -left-10 pointer-events-none" />
                <div className="w-48 h-48 bg-[#FF9B50] rounded-full blur-3xl opacity-10 absolute -bottom-16 -right-10 pointer-events-none" />

                <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 lg:h-full lg:auto-rows-fr">
                    {/* Left: Appreciation intro — desktop uses flex-col + justify-between for 3-cluster distribution */}
                    <div className="md:col-span-5 lg:flex lg:flex-col lg:justify-between">
                        {/* Top cluster: badge + heading + intro */}
                        <div>
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
                                你的声音很重要 — 评价送 RM5 回购券
                            </p>
                        </div>

                        {/* Middle: RM5 voucher preview — desktop only, fills mid-column visual void */}
                        <div className="hidden lg:flex items-center gap-4 p-4 bg-gradient-to-br from-[#FF6B35]/12 via-[#FF6B35]/8 to-transparent border-2 border-dashed border-[#FF9B50]/40 rounded-2xl relative overflow-hidden">
                            {/* Decorative blur */}
                            <div className="absolute -top-8 -right-8 w-24 h-24 bg-[#FF6B35] rounded-full blur-2xl opacity-20 pointer-events-none" />
                            {/* Ticket corner mark */}
                            <div className="absolute top-2.5 right-3">
                                <Ticket size={14} className="text-[#FF9B50]/45" strokeWidth={2.5} />
                            </div>

                            {/* RM 5 value badge */}
                            <div className="flex-shrink-0 flex items-baseline gap-1 px-3.5 py-2.5 bg-[#FF6B35]/25 rounded-xl border border-[#FF6B35]/40 relative">
                                <span className="text-[11px] font-black text-[#FF9B50] leading-none tracking-wider">RM</span>
                                <span className="text-[34px] font-black text-[#FF9B50] leading-none tracking-tighter">5</span>
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0 relative">
                                <p className="text-sm font-black text-white leading-tight">回购券 / Voucher</p>
                                <p className="text-[11px] text-white/60 leading-snug mt-1">30 天内可用 · 自动发放</p>
                            </div>
                        </div>

                        {/* Bottom: secondary CTA — sits at column bottom via justify-between (trust signals moved to right sub-card) */}
                        <button
                            type="button"
                            onClick={scrollToFeedback}
                            className="hidden lg:inline-flex items-center gap-1.5 self-start text-[#FF9B50] hover:text-[#FFB770] text-sm font-bold underline-offset-4 hover:underline transition-colors group"
                        >
                            <span>看 5+ 邻居怎么说</span>
                            <ArrowRight size={13} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform" />
                        </button>
                    </div>

                    {/* Right: Review reward offer — sub-card with 4-cluster lg:justify-between distribution */}
                    <div className="md:col-span-7 flex">
                        <div className="w-full h-full flex flex-col bg-white/[0.04] border border-[#FF6B35]/25 rounded-2xl p-5 md:p-6 backdrop-blur-sm lg:justify-between">
                            {/* Cluster A: header + description */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <MessageCircleHeart size={18} className="text-[#FF9B50]" strokeWidth={2.5} />
                                    <p className="text-[#FF9B50] font-black text-[15px]">好评返券</p>
                                </div>
                                <p className="text-white/85 text-[15px] leading-relaxed">
                                    分享你的评价，送你 <span className="text-[#FF9B50] font-black">RM 5 回购券</span>。
                                </p>
                            </div>

                            {/* Cluster B: trust signals — desktop only, validates the offer */}
                            <div className="hidden lg:flex items-center gap-4 py-3 px-1">
                                <div className="flex items-center gap-1.5">
                                    <Star size={14} className="text-[#FF9B50] fill-[#FF9B50]" strokeWidth={0} />
                                    <span className="text-white font-black text-sm leading-none">5.0</span>
                                </div>
                                <span className="w-px h-4 bg-white/15" aria-hidden="true" />
                                <div className="text-xs leading-none">
                                    <span className="text-white font-black">5+</span>
                                    <span className="text-white/55 font-medium ml-1">Google 评价</span>
                                </div>
                                <span className="w-px h-4 bg-white/15" aria-hidden="true" />
                                <div className="text-xs leading-none">
                                    <span className="text-white font-black">100%</span>
                                    <span className="text-white/55 font-medium ml-1">邻居推荐</span>
                                </div>
                            </div>

                            {/* Cluster C: how to claim — 3 steps (border-t on mobile only, desktop relies on flex spacing) */}
                            <div className="border-t border-white/10 pt-4 space-y-2.5 lg:border-t-0 lg:pt-0">
                                <p className="text-[11px] font-black text-white/55 uppercase tracking-wider mb-2.5">如何获得</p>
                                <div className="flex items-start gap-2.5">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#FF6B35]/20 text-[#FF9B50] text-[11px] font-black flex items-center justify-center">1</span>
                                    <p className="text-[13px] text-white/75 leading-snug pt-0.5">下单并享用</p>
                                </div>
                                <div className="flex items-start gap-2.5">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#FF6B35]/20 text-[#FF9B50] text-[11px] font-black flex items-center justify-center">2</span>
                                    <p className="text-[13px] text-white/75 leading-snug pt-0.5">在 Google / Facebook 留评价（带图更好）</p>
                                </div>
                                <div className="flex items-start gap-2.5">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#FF6B35]/20 text-[#FF9B50] text-[11px] font-black flex items-center justify-center">3</span>
                                    <p className="text-[13px] text-white/75 leading-snug pt-0.5">截图发 WhatsApp 给碗妈领券</p>
                                </div>
                            </div>

                            {/* Cluster D: primary CTA — pinned to bottom via justify-between, mt-5 fallback for mobile */}
                            <button
                                type="button"
                                onClick={scrollToMenu}
                                className="mt-5 lg:mt-0 self-start lg:self-end inline-flex items-center gap-3 px-5 py-3 bg-[#FF6B35] hover:bg-[#E95D31] text-white rounded-full shadow-md shadow-[#FF6B35]/20 transition-[background-color,transform,box-shadow] duration-150 ease-out active:scale-[0.97] active:brightness-95 group"
                            >
                                <div className="flex flex-col items-start">
                                    <span className="text-[15px] font-bold leading-tight">立即下单</span>
                                    <span className="text-[11px] font-medium text-white/75 leading-tight">赚 RM5 回购券</span>
                                </div>
                                <ArrowRight size={14} strokeWidth={3} className="group-hover:translate-x-0.5 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
