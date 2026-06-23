"use client";

import React, { useState } from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';

interface FaqItem {
    q: string;
    a: React.ReactNode;
    /** Plain-text answer for the FAQPage JSON-LD. MUST mirror `a` — Google requires
     *  the structured answer to match the answer visible on the page. */
    aText: string;
}

const FAQS: FaqItem[] = [
    {
        q: '你们有店面吗？我可以过来吃吗？',
        aText: '没有店面哦 —— 碗妈是家庭式私厨，只接外送。我们从 Pearl Point 隔壁的 Pearl Suria Residence 家里，煮好之后送到你家。',
        a: (
            <>
                没有店面哦 —— 碗妈是<span className="font-bold text-[#1A2D23]">家庭式私厨，只接外送</span>。<br />
                我们从 Pearl Point 隔壁的 <span className="font-semibold text-[#1A2D23]">Pearl Suria Residence</span> 家里，煮好之后送到你家。
            </>
        ),
    },
    {
        q: '你们煮饭的地方在哪？',
        aText: '在 Pearl Point 隔壁的 Pearl Suria Residence 家里厨房。不接受 walk-in，也不开放参观（家里地方小，不方便招待）。',
        a: (
            <>
                在 Pearl Point 隔壁的 <span className="font-semibold text-[#1A2D23]">Pearl Suria Residence</span> 家里厨房。<br />
                不接受 walk-in，也不开放参观（家里地方小，不方便招待 🙏）。
            </>
        ),
    },
    {
        q: '我家附近能送吗？',
        aText: '主要送 Pearl Point / Millerz / OUG / Old Klang Road / Bangsar 一带：2.5km 内 RM 3（满 RM 20 免运）；2.5–5km RM 5（满 RM 30 免运）；5–7.5km RM 12（满 RM 45 免运）；7.5km 以外暂不配送，公司订餐请 WhatsApp 询价。不确定家里在不在范围内？注册账号 + 填写地址，系统会自动核对位置，告诉你能不能送、运费多少。',
        a: (
            <>
                主要送 <span className="font-semibold text-[#1A2D23]">Pearl Point / Millerz / OUG / Old Klang Road / Bangsar</span> 一带：
                <ul className="mt-2 space-y-1 text-[14px] md:text-[15px] lg:text-[16px]">
                    <li>• 2.5km 内 —— <span className="font-semibold">RM 3</span>（满 RM 20 <span className="text-green-600 font-bold">免运</span>）</li>
                    <li>• 2.5–5km —— <span className="font-semibold">RM 5</span>（满 RM 30 <span className="text-green-600 font-bold">免运</span>）</li>
                    <li>• 5–7.5km —— <span className="font-semibold">RM 12</span>（满 RM 45 <span className="text-green-600 font-bold">免运</span>）</li>
                    <li>• 7.5km 以外 —— 暂不配送，公司订餐请 WhatsApp 询价</li>
                </ul>
                <p className="mt-3">
                    不确定家里在不在范围内？<span className="font-bold text-[#1A2D23]">注册账号 + 填写地址</span>，
                    系统会自动核对位置，告诉你能不能送、运费多少。
                </p>
            </>
        ),
    },
    {
        q: '一定要提前下单吗？',
        aText: '是的 —— 每天早上 06:00 截单（06:00 前下单当日配送）。碗妈需要提前去巴刹采购、提前煮，不会有现成的放在冰箱里。想吃明天的，今天晚上就要下单。',
        a: (
            <>
                是的 —— 每天早上 <span className="font-bold text-[#FF6B35]">06:00 截单</span>（06:00 前下单当日配送）。<br />
                碗妈需要提前去巴刹采购、提前煮，不会有&ldquo;现成的&rdquo;放在冰箱里。<br />
                想吃明天的，今天晚上就要下单 😊
            </>
        ),
    },
];

// FAQPage structured data, generated from the same FAQS array that renders the
// visible Q&A — so the schema can never drift from what's on the page. Lets
// Google show FAQ rich results and gives AI answer engines clean Q&A pairs.
const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map(item => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.aText },
    })),
};

export default function FaqSection() {
    // First Q open by default; user can toggle. Tracks open indexes.
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
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
            />
            <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
                {/* Header */}
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
                            常见问题
                        </h2>
                        <p className="text-[13px] lg:text-base text-[#1A2D23]/65 font-medium leading-relaxed mt-0.5 lg:mt-1">
                            邻居都在问
                        </p>
                    </div>
                </div>

                {/* Q&A list */}
                <ul className="divide-y divide-gray-100">
                    {FAQS.map((item, i) => {
                        const isOpen = openIdx.has(i);
                        return (
                            <li key={i}>
                                <button
                                    type="button"
                                    onClick={() => toggle(i)}
                                    aria-expanded={isOpen}
                                    aria-controls={`faq-panel-${i}`}
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
                                        id={`faq-panel-${i}`}
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
