"use client";

import React, { useState } from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';

interface FaqItem {
    q: string;
    a: React.ReactNode;
}

const FAQS: FaqItem[] = [
    {
        q: 'Do you have a shopfront? Can I come and dine in?',
        a: (
            <>
                No shopfront &mdash; BowlMama is a <span className="font-bold text-[#1A2D23]">home-based private kitchen, delivery only</span>.<br />
                We cook from a home near Pearl Point and bring it to your door.
            </>
        ),
    },
    {
        q: 'Where do you cook?',
        a: (
            <>
                From a home kitchen near Pearl Point.<br />
                No walk-ins, no visits (the place is small &mdash; sorry, we can&apos;t host 🙏).
            </>
        ),
    },
    {
        q: 'Do you deliver to my area?',
        a: (
            <>
                Mainly <span className="font-semibold text-[#1A2D23]">Pearl Point / Millerz / OUG / Old Klang Road / Bangsar</span>:
                <ul className="mt-2 space-y-1 text-[14px] md:text-[15px] lg:text-[16px]">
                    <li>• Within 2km &mdash; <span className="text-green-600 font-bold">always free</span></li>
                    <li>• 2–5km &mdash; <span className="font-semibold">free over RM 20</span></li>
                    <li>• 5–8km &mdash; <span className="font-semibold">RM 5 over RM 40</span> (RM 15 under RM 40)</li>
                    <li>• 8–10km &mdash; <span className="font-semibold">RM 15 over RM 40</span> (RM 25 under RM 40)</li>
                </ul>
                <p className="mt-3">
                    Not sure if you&apos;re in range? <span className="font-bold text-[#1A2D23]">Register an account and add your address</span> &mdash;
                    the system will instantly check your location and tell you whether we deliver and the fee.
                </p>
            </>
        ),
    },
    {
        q: 'Do I have to pre-order?',
        a: (
            <>
                Yes &mdash; daily cutoff is <span className="font-bold text-[#FF6B35]">06:00</span> (order before 06:00 for same-day delivery).<br />
                BowlMama needs time to shop at the wet market and cook fresh &mdash; there&apos;s nothing pre-made sitting in a fridge.<br />
                Want tomorrow&apos;s meal? Order tonight 😊
            </>
        ),
    },
];

export default function FaqSectionEN() {
    const [openIdx, setOpenIdx] = useState<Set<number>>(new Set([0]));

    const toggle = (i: number) => {
        setOpenIdx(prev => {
            const next = new Set(prev);
            if (next.has(i)) next.delete(i);
            else next.add(i);
            return next;
        });
    };

    return (
        <section
            id="faq"
            aria-labelledby="faq-heading"
            className="lg:col-span-12 mt-4 scroll-mt-32"
        >
            <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
                <div className="bg-[#E3EADA] px-6 md:px-10 lg:px-14 py-6 lg:py-8 flex items-center gap-3">
                    <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-white/60 flex items-center justify-center shrink-0">
                        <HelpCircle size={20} className="text-[#1A2D23] lg:hidden" strokeWidth={2.5} />
                        <HelpCircle size={24} className="text-[#1A2D23] hidden lg:block" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h2
                            id="faq-heading"
                            className="text-[22px] md:text-[28px] lg:text-[40px] font-extrabold tracking-tight text-[#1A2D23] leading-tight"
                        >
                            FAQ
                        </h2>
                        <p className="text-[13px] lg:text-base text-[#1A2D23]/65 font-medium leading-relaxed mt-0.5 lg:mt-1">
                            What neighbours often ask
                        </p>
                    </div>
                </div>

                <ul className="divide-y divide-gray-100">
                    {FAQS.map((item, i) => {
                        const isOpen = openIdx.has(i);
                        return (
                            <li key={i}>
                                <button
                                    type="button"
                                    onClick={() => toggle(i)}
                                    aria-expanded={isOpen}
                                    aria-controls={`faq-panel-en-${i}`}
                                    className="w-full flex items-center justify-between gap-4 text-left px-6 md:px-10 lg:px-14 py-5 lg:py-6 hover:bg-[#FDFBF7] transition-colors active:bg-[#E3EADA]/40"
                                >
                                    <span className="flex items-start gap-3 flex-1 min-w-0">
                                        <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-[#FF6B35]/12 text-[#C84518] font-black text-[13px] lg:text-sm">
                                            Q
                                        </span>
                                        <span className="text-[15px] md:text-[17px] lg:text-[19px] font-extrabold text-[#1A2D23] leading-snug">
                                            {item.q}
                                        </span>
                                    </span>
                                    <ChevronDown
                                        size={20}
                                        strokeWidth={2.5}
                                        className={`shrink-0 text-[#1A2D23]/50 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                                    />
                                </button>
                                {isOpen && (
                                    <div
                                        id={`faq-panel-en-${i}`}
                                        className="px-6 md:px-10 lg:px-14 pb-6 lg:pb-7 -mt-1"
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-green-100 text-green-700 font-black text-[13px] lg:text-sm">
                                                A
                                            </span>
                                            <div className="text-[14px] md:text-[16px] lg:text-[17px] leading-[1.75] text-[#1A2D23]/85 font-medium">
                                                {item.a}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>
        </section>
    );
}
