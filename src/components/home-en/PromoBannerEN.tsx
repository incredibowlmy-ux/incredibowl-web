"use client";

import { MessageCircleHeart, ArrowRight, Star, Ticket } from 'lucide-react';

export default function PromoBannerEN() {
    const scrollToMenu = () => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' });
    const scrollToFeedback = () => document.getElementById('feedback')?.scrollIntoView({ behavior: 'smooth' });

    return (
        <div className="lg:col-span-7 lg:col-start-6 lg:row-start-4 mt-4">
            <div className="relative bg-gradient-to-br from-[#1A2D23] via-[#243A2D] to-[#1A2D23] rounded-[32px] p-6 md:p-8 overflow-hidden border border-[#FF6B35]/15 h-full">
                <div className="w-48 h-48 bg-[#FF6B35] rounded-full blur-3xl opacity-15 absolute -top-16 -left-10 pointer-events-none" />
                <div className="w-48 h-48 bg-[#FF9B50] rounded-full blur-3xl opacity-10 absolute -bottom-16 -right-10 pointer-events-none" />

                <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 lg:h-full lg:auto-rows-fr">
                    <div className="md:col-span-5 lg:flex lg:flex-col lg:justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="px-2.5 py-1 rounded-md bg-[#FF6B35]/20 text-[#FF9B50] text-xs font-black tracking-widest border border-[#FF6B35]/30">
                                    NEW OPENING
                                </span>
                                <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">
                                    Thank-you discount
                                </h3>
                            </div>
                            <p className="text-white/80 text-sm leading-relaxed">
                                Just opened, thank you to the neighbourhood 🎉<br />
                                Your voice matters — leave a review for an RM3 voucher
                            </p>
                        </div>

                        <div className="hidden lg:flex items-center gap-4 p-4 bg-gradient-to-br from-[#FF6B35]/12 via-[#FF6B35]/8 to-transparent border-2 border-dashed border-[#FF9B50]/40 rounded-2xl relative overflow-hidden">
                            <div className="absolute -top-8 -right-8 w-24 h-24 bg-[#FF6B35] rounded-full blur-2xl opacity-20 pointer-events-none" />
                            <div className="absolute top-2.5 right-3">
                                <Ticket size={14} className="text-[#FF9B50]/45" strokeWidth={2.5} />
                            </div>
                            <div className="flex-shrink-0 flex items-baseline gap-1 px-3.5 py-2.5 bg-[#FF6B35]/25 rounded-xl border border-[#FF6B35]/40 relative">
                                <span className="text-[11px] font-black text-[#FF9B50] leading-none tracking-wider">RM</span>
                                <span className="text-[34px] font-black text-[#FF9B50] leading-none tracking-tighter">3</span>
                            </div>
                            <div className="flex-1 min-w-0 relative">
                                <p className="text-sm font-black text-white leading-tight">Voucher</p>
                                <p className="text-[11px] text-white/60 leading-snug mt-1">Valid 30 days · Auto-issued</p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={scrollToFeedback}
                            className="hidden lg:inline-flex items-center gap-1.5 self-start text-[#FF9B50] hover:text-[#FFB770] text-sm font-bold underline-offset-4 hover:underline transition-colors group"
                        >
                            <span>Read 5+ neighbour reviews</span>
                            <ArrowRight size={13} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform" />
                        </button>
                    </div>

                    <div className="md:col-span-7 flex">
                        <div className="w-full h-full flex flex-col bg-white/[0.04] border border-[#FF6B35]/25 rounded-2xl p-5 md:p-6 backdrop-blur-sm lg:justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <MessageCircleHeart size={18} className="text-[#FF9B50]" strokeWidth={2.5} />
                                    <p className="text-[#FF9B50] font-black text-[15px]">Review-for-voucher</p>
                                </div>
                                <p className="text-white/85 text-[15px] leading-relaxed">
                                    Share your honest review, get an <span className="text-[#FF9B50] font-black">RM 3 voucher</span>.
                                </p>
                            </div>

                            <div className="hidden lg:flex items-center gap-4 py-3 px-1">
                                <div className="flex items-center gap-1.5">
                                    <Star size={14} className="text-[#FF9B50] fill-[#FF9B50]" strokeWidth={0} />
                                    <span className="text-white font-black text-sm leading-none">5.0</span>
                                </div>
                                <span className="w-px h-4 bg-white/15" aria-hidden="true" />
                                <div className="text-xs leading-none">
                                    <span className="text-white font-black">5+</span>
                                    <span className="text-white/55 font-medium ml-1">Google reviews</span>
                                </div>
                                <span className="w-px h-4 bg-white/15" aria-hidden="true" />
                                <div className="text-xs leading-none">
                                    <span className="text-white font-black">100%</span>
                                    <span className="text-white/55 font-medium ml-1">neighbour-recommended</span>
                                </div>
                            </div>

                            <div className="border-t border-white/10 pt-4 space-y-2.5 lg:border-t-0 lg:pt-0">
                                <p className="text-[11px] font-black text-white/55 uppercase tracking-wider mb-2.5">How to claim</p>
                                <div className="flex items-start gap-2.5">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#FF6B35]/20 text-[#FF9B50] text-[11px] font-black flex items-center justify-center">1</span>
                                    <p className="text-[13px] text-white/75 leading-snug pt-0.5">Order and enjoy</p>
                                </div>
                                <div className="flex items-start gap-2.5">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#FF6B35]/20 text-[#FF9B50] text-[11px] font-black flex items-center justify-center">2</span>
                                    <p className="text-[13px] text-white/75 leading-snug pt-0.5">Leave a Google / Facebook review (photos welcome)</p>
                                </div>
                                <div className="flex items-start gap-2.5">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#FF6B35]/20 text-[#FF9B50] text-[11px] font-black flex items-center justify-center">3</span>
                                    <p className="text-[13px] text-white/75 leading-snug pt-0.5">WhatsApp BowlMama a screenshot to claim</p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={scrollToMenu}
                                className="mt-5 lg:mt-0 self-start lg:self-end inline-flex items-center gap-3 px-5 py-3 bg-[#FF6B35] hover:bg-[#E95D31] text-white rounded-full shadow-md shadow-[#FF6B35]/20 transition-[background-color,transform,box-shadow] duration-150 ease-out active:scale-[0.97] active:brightness-95 group"
                            >
                                <div className="flex flex-col items-start">
                                    <span className="text-[15px] font-bold leading-tight">Order now</span>
                                    <span className="text-[11px] font-medium text-white/75 leading-tight">Earn RM 3 voucher</span>
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
