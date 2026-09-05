"use client";

import { MessageCircleHeart, ArrowRight, Star, Salad, ExternalLink } from 'lucide-react';
import { GOOGLE_RATING_VALUE, GOOGLE_REVIEW_COUNT, GOOGLE_REVIEWS_URL } from '@/data/googleReviews';
import type { Locale } from '@/lib/locale';
import { HOME_DICT } from './dict';

export default function PromoBanner({ locale = 'zh' }: { locale?: Locale }) {
    const t = HOME_DICT[locale].promoBanner;
    const scrollToMenu = () => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' });
    const scrollToFeedback = () => document.getElementById('feedback')?.scrollIntoView({ behavior: 'smooth' });

    return (
        <div className="lg:col-span-12 mt-4">
            <div className="relative bg-gradient-to-br from-ink via-[#243A2D] to-ink rounded-[32px] p-6 md:p-8 overflow-hidden border border-primary/15 h-full">
                {/* Decorative blurs */}
                <div className="w-48 h-48 bg-primary rounded-full blur-3xl opacity-15 absolute -top-16 -left-10 pointer-events-none" />
                <div className="w-48 h-48 bg-[#FF9B50] rounded-full blur-3xl opacity-10 absolute -bottom-16 -right-10 pointer-events-none" />

                <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 lg:h-full lg:auto-rows-fr">
                    {/* Left: Appreciation intro — desktop uses flex-col + justify-between for 3-cluster distribution */}
                    <div className="md:col-span-5 lg:flex lg:flex-col lg:justify-between">
                        {/* Top cluster: badge + heading + intro */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="px-2.5 py-1 rounded-md bg-primary/20 text-[#FF9B50] text-xs font-medium tracking-widest border border-primary/30">
                                    {t.badge}
                                </span>
                                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                                    {t.heading}
                                </h2>
                            </div>
                            <p className="text-white/80 text-sm leading-relaxed">
                                {t.introLine1}<br />
                                {t.introLine2}
                            </p>
                        </div>

                        {/* Middle: RM5 voucher preview — desktop only, fills mid-column visual void */}
                        <div className="hidden lg:flex items-center gap-4 p-4 bg-gradient-to-br from-primary/12 via-primary/8 to-transparent border-2 border-dashed border-[#FF9B50]/40 rounded-2xl relative overflow-hidden">
                            {/* Decorative blur */}
                            <div className="absolute -top-8 -right-8 w-24 h-24 bg-primary rounded-full blur-2xl opacity-20 pointer-events-none" />

                            {/* Free side value badge */}
                            <div className="flex-shrink-0 flex flex-col items-center justify-center px-4 py-2.5 bg-primary/25 rounded-xl border border-primary/40 relative">
                                <Salad size={26} className="text-[#FF9B50]" strokeWidth={2.5} />
                                <span className="text-[11px] font-black text-[#FF9B50] leading-none tracking-wider mt-1.5">{t.free}</span>
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0 relative">
                                <p className="text-sm font-black text-white leading-tight">{t.freeSideTitle}</p>
                                <p className="text-[12px] text-white/75 leading-snug mt-1">{t.freeSideSub}</p>
                            </div>
                        </div>

                        {/* Bottom: secondary CTA — sits at column bottom via justify-between (trust signals moved to right sub-card) */}
                        <button
                            type="button"
                            onClick={scrollToFeedback}
                            className="hidden lg:inline-flex items-center gap-1.5 self-start text-[#FF9B50] hover:text-[#FFB770] text-sm font-bold underline-offset-4 hover:underline transition-colors group"
                        >
                            {/* 三个子节点（前缀 / 数字 / 后缀）——SSR 在文本节点之间插 <!-- -->，别合并 */}
                            <span>{t.readReviewsBefore}{GOOGLE_REVIEW_COUNT}{t.readReviewsAfter}</span>
                            <ArrowRight size={13} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform" />
                        </button>
                    </div>

                    {/* Right: Review reward offer — sub-card with 4-cluster lg:justify-between distribution */}
                    <div className="md:col-span-7 flex">
                        <div className="w-full h-full flex flex-col bg-white/[0.04] border border-primary/25 rounded-2xl p-5 md:p-6 backdrop-blur-sm lg:justify-between">
                            {/* Cluster A: header + description */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <MessageCircleHeart size={18} className="text-[#FF9B50]" strokeWidth={2.5} />
                                    <p className="text-[#FF9B50] font-black text-[15px]">{t.offerTitle}</p>
                                </div>
                                <p className="text-white/85 text-[15px] leading-relaxed">
                                    {t.shareBefore}<span className="text-[#FF9B50] font-black">{t.shareBold}</span>{t.shareAfter}
                                </p>
                            </div>

                            {/* Cluster B: trust signals — desktop only, validates the offer.
                                The rating + count link out to the real Google reviews so
                                customers can verify (credibility). */}
                            <div className="hidden lg:flex items-center gap-4 py-3 px-1">
                                <a
                                    href={GOOGLE_REVIEWS_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={t.googleTitle}
                                    className="group inline-flex items-center gap-4 rounded-md hover:opacity-90 transition-opacity"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <Star size={14} className="text-[#FF9B50] fill-[#FF9B50]" strokeWidth={0} />
                                        <span className="text-white font-black text-sm leading-none">{GOOGLE_RATING_VALUE}</span>
                                    </div>
                                    <span className="w-px h-4 bg-white/15" aria-hidden="true" />
                                    <div className="text-xs leading-none inline-flex items-center gap-1">
                                        <span className="text-white font-black">{GOOGLE_REVIEW_COUNT}+</span>
                                        <span className="text-white/70 font-medium">{t.googleReviews}</span>
                                        <ExternalLink size={11} className="text-white/40 group-hover:text-[#FF9B50] transition-colors" strokeWidth={2.5} />
                                    </div>
                                </a>
                                <span className="w-px h-4 bg-white/15" aria-hidden="true" />
                                <div className="text-xs leading-none">
                                    <span className="text-white font-black">100%</span>
                                    <span className="text-white/70 font-medium ml-1">{t.recommended}</span>
                                </div>
                            </div>

                            {/* Cluster C: how to claim — 3 steps (border-t on mobile only, desktop relies on flex spacing) */}
                            <div className="border-t border-white/10 pt-4 space-y-2.5 lg:border-t-0 lg:pt-0">
                                <p className="text-[11px] lg:text-[12px] font-medium text-white/55 lg:text-white/70 uppercase tracking-wider mb-2.5">{t.howToClaim}</p>
                                <div className="flex items-start gap-2.5">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-[#FF9B50] text-[11px] font-black flex items-center justify-center">1</span>
                                    <p className="text-[13px] text-white/75 leading-snug pt-0.5">{t.step1}</p>
                                </div>
                                <div className="flex items-start gap-2.5">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-[#FF9B50] text-[11px] font-black flex items-center justify-center">2</span>
                                    <p className="text-[13px] text-white/75 leading-snug pt-0.5">{t.step2}</p>
                                </div>
                                <div className="flex items-start gap-2.5">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-[#FF9B50] text-[11px] font-black flex items-center justify-center">3</span>
                                    <p className="text-[13px] text-white/75 leading-snug pt-0.5">{t.step3}</p>
                                </div>
                            </div>

                            {/* Cluster D: primary CTA — pinned to bottom via justify-between, mt-5 fallback for mobile */}
                            <button
                                type="button"
                                onClick={scrollToMenu}
                                className="mt-5 lg:mt-0 self-start lg:self-end inline-flex items-center gap-3 px-5 py-3 btn-primary shadow-md shadow-primary/20 transition-[background-color,transform,box-shadow] duration-150 ease-out active:scale-[0.97] active:brightness-95 group"
                            >
                                <div className="flex flex-col items-start">
                                    <span className="text-[15px] font-bold leading-tight">{t.ctaTitle}</span>
                                    <span className="text-[11px] lg:text-[12px] font-medium text-white/75 leading-tight">{t.ctaSub}</span>
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
