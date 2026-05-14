"use client";

import React from 'react';
import { HelpCircle, ArrowRight } from 'lucide-react';

export default function FaqHeroStripEN() {
    return (
        <button
            type="button"
            onClick={() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })}
            className="lg:col-span-12 mt-2 group flex items-center gap-3 w-full text-left px-4 md:px-5 py-3 bg-white/70 hover:bg-white border border-[#FF6B35]/20 hover:border-[#FF6B35]/40 rounded-full shadow-sm transition-colors"
            aria-label="Jump to FAQ"
        >
            <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#FF6B35]/12 text-[#C84518]">
                <HelpCircle size={15} strokeWidth={2.5} />
            </span>
            <span className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2 text-[13px] md:text-[14px] leading-snug">
                <span className="font-extrabold text-[#1A2D23]">Got a shopfront?</span>
                <span className="text-[#1A2D23]/75">
                    No &mdash; we&apos;re a home kitchen in <span className="font-semibold text-[#1A2D23]">Pearl Suria Residence</span>, delivery only.
                </span>
            </span>
            <span className="shrink-0 inline-flex items-center gap-1 text-[12px] font-bold text-[#FF6B35] group-hover:translate-x-0.5 transition-transform">
                <span className="hidden sm:inline">More</span>
                <ArrowRight size={14} strokeWidth={2.75} />
            </span>
        </button>
    );
}
