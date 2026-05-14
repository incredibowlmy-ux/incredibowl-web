"use client";

import React from 'react';
import { HelpCircle, ArrowRight } from 'lucide-react';

export default function FaqHeroStrip() {
    return (
        <button
            type="button"
            onClick={() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })}
            className="lg:col-span-12 lg:row-start-2 mt-2 group flex items-center gap-3 w-full text-left px-4 md:px-5 py-3 bg-white/70 hover:bg-white border border-[#FF6B35]/20 hover:border-[#FF6B35]/40 rounded-full shadow-sm transition-colors"
            aria-label="跳到常见问题"
        >
            <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#FF6B35]/12 text-[#C84518]">
                <HelpCircle size={15} strokeWidth={2.5} />
            </span>
            <span className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2 text-[13px] md:text-[14px] leading-snug">
                <span className="font-extrabold text-[#1A2D23]">有店面吗？</span>
                {/* Mobile: condensed copy fits one line. Desktop: full sentence. */}
                <span className="text-[#1A2D23]/75 sm:hidden">
                    没有 · <span className="font-semibold text-[#1A2D23]">Pearl Suria</span> 私厨，外送 only
                </span>
                <span className="text-[#1A2D23]/75 hidden sm:inline">
                    没有 —— 我们是 <span className="font-semibold text-[#1A2D23]">Pearl Suria Residence</span> 的家庭私厨，只接外送。
                </span>
            </span>
            <span className="shrink-0 inline-flex items-center gap-1 text-[12px] font-bold text-[#FF6B35] group-hover:translate-x-0.5 transition-transform">
                <span className="hidden sm:inline">看更多</span>
                <ArrowRight size={14} strokeWidth={2.75} />
            </span>
        </button>
    );
}
