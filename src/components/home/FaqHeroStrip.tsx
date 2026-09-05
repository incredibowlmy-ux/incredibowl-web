"use client";

import React from 'react';
import { HelpCircle, ArrowRight } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import { HOME_DICT } from './dict';

export default function FaqHeroStrip({ locale = 'zh' }: { locale?: Locale }) {
    const t = HOME_DICT[locale].faqHeroStrip;
    return (
        <button
            type="button"
            onClick={() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })}
            className="lg:hidden mt-2 group flex items-center gap-3 w-full text-left px-4 md:px-5 py-3 bg-white/70 hover:bg-white border border-primary/20 hover:border-primary/40 rounded-full shadow-sm transition-colors"
            aria-label={t.ariaLabel}
        >
            <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/12 text-[#C84518]">
                <HelpCircle size={15} strokeWidth={2.5} />
            </span>
            <span className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2 text-[13px] md:text-[14px] leading-snug">
                <span className="font-extrabold text-ink">{t.question}</span>
                {/* Mobile: condensed copy fits one line. Desktop: full sentence. */}
                <span className="text-ink/75 sm:hidden">
                    {t.mobileBefore}<span className="font-semibold text-ink">Pearl Suria</span>{t.mobileAfter}
                </span>
                <span className="text-ink/75 hidden sm:inline">
                    {t.desktopBefore}<span className="font-semibold text-ink">Pearl Suria Residence</span>{t.desktopAfter}
                </span>
            </span>
            <span className="shrink-0 inline-flex items-center gap-1 text-[12px] font-bold text-primary group-hover:translate-x-0.5 transition-transform">
                <span className="hidden sm:inline">{t.more}</span>
                <ArrowRight size={14} strokeWidth={2.75} />
            </span>
        </button>
    );
}
