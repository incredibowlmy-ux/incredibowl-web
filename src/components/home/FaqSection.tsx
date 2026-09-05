"use client";

import React, { useState } from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';
import { DELIVERY_TIER_COPY, DELIVERY_TIER_COPY_FAR, COVERAGE_AREAS, freeOverPhraseZh, BEYOND_DELIVERY_NOTE_ZH } from '@/lib/deliveryCopy';
import type { Locale } from '@/lib/locale';
import { HOME_DICT } from './dict';

interface FaqItem {
    q: string;
    a: React.ReactNode;
    /** Plain-text answer for the FAQPage JSON-LD. MUST mirror `a` — Google requires
     *  the structured answer to match the answer visible on the page.
     *  ⚠️ 目前只有 zh 条目带它：原 FaqSectionEN 没做 FAQPage JSON-LD（/en 的 HTML 里没有
     *  那段 <script>），C1 零 diff 合并原样保留。给 en 五条补上 aText，JSON-LD 就会自动出现。 */
    aText?: string;
}

// 问答正文是带 <span>/<br /> 的多行 JSX，JSX 的换行折叠规则让它没法安全搬成纯字符串，
// 所以两种语言各自逐字保留在这里；dict.ts 只放标题两句。
const FAQS: Record<Locale, FaqItem[]> = {
    zh: [
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
            aText: `主要送 ${COVERAGE_AREAS.join(' / ')} 一带：${DELIVERY_TIER_COPY.map((t) => `${t.rangeZh} RM ${t.fee}（${freeOverPhraseZh(t)}）`).join('；')}；${BEYOND_DELIVERY_NOTE_ZH}。不确定家里在不在范围内？注册账号 + 填写地址，系统会自动核对位置，告诉你能不能送、运费多少。`,
            a: (
                <>
                    主要送 <span className="font-semibold text-[#1A2D23]">{COVERAGE_AREAS.join(' / ')}</span> 一带：
                    <ul className="mt-2 space-y-1 text-[14px] md:text-[15px] lg:text-[16px]">
                        {DELIVERY_TIER_COPY.map((t) => (
                            <li key={t.rangeZh}>• {t.rangeZh} —— <span className="font-semibold">RM {t.fee}</span>（
                                {t.freeOver === null
                                    ? <span className="text-gray-500 font-bold">固定运费，不设免运</span>
                                    : <>满 RM {t.freeOver} <span className="text-green-600 font-bold">免运</span></>}
                                ）</li>
                        ))}
                        {DELIVERY_TIER_COPY_FAR.map((t) => (
                            <li key={t.rangeZh}>• {t.rangeZh} —— <span className="font-semibold">RM {t.fee}</span>（<span className="text-gray-500 font-bold">固定 · Grab 配送</span>）</li>
                        ))}
                        <li>• 25km 以外 —— 暂不配送，公司团餐请 WhatsApp 询价</li>
                    </ul>
                    <p className="mt-2 text-[13px] text-[#1A2D23]/60">
                        7.5km 以上由 Grab 配送，运费按距离固定收取、<span className="font-semibold">不设免运门槛</span>（订单多大都一样）。
                    </p>
                    <p className="mt-3">
                        不确定家里在不在范围内？<span className="font-bold text-[#1A2D23]">注册账号 + 填写地址</span>，
                        系统会自动核对位置，告诉你能不能送、运费多少。
                    </p>
                </>
            ),
        },
        {
            q: '碗妈的菜健康吗？',
            aText: '碗妈做的是健康取向的中式家常菜：全程不加味精，每天凌晨去巴刹挑当天的鱼、肉和蔬菜，当天现煮现送。菜单上每道菜都标注蛋白质克数（不少主菜高蛋白 30g+），方便你按需求搭配。',
            a: (
                <>
                    碗妈做的是<span className="font-bold text-[#1A2D23]">健康取向的中式家常菜</span>：全程<span className="font-bold text-[#1A2D23]">不加味精</span>，
                    每天凌晨去巴刹挑当天的鱼、肉和蔬菜，当天现煮现送。<br />
                    菜单上每道菜都标注<span className="font-bold text-[#1A2D23]">蛋白质克数</span>（不少主菜高蛋白 30g+），方便你按需求搭配。
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
    ],
    en: [
        {
            q: 'Do you have a shopfront? Can I come and dine in?',
            a: (
                <>
                    No shopfront &mdash; BowlMama is a <span className="font-bold text-[#1A2D23]">home-based private kitchen, delivery only</span>.<br />
                    We cook from a home in <span className="font-semibold text-[#1A2D23]">Pearl Suria Residence</span> (next to Pearl Point) and bring it to your door.
                </>
            ),
        },
        {
            q: 'Where do you cook?',
            a: (
                <>
                    A home kitchen in <span className="font-semibold text-[#1A2D23]">Pearl Suria Residence</span> (next to Pearl Point).<br />
                    No walk-ins, no visits (the place is small &mdash; sorry, we can&apos;t host 🙏).
                </>
            ),
        },
        {
            q: 'Do you deliver to my area?',
            a: (
                <>
                    Mainly <span className="font-semibold text-[#1A2D23]">{COVERAGE_AREAS.join(' / ')}</span>:
                    <ul className="mt-2 space-y-1 text-[14px] md:text-[15px] lg:text-[16px]">
                        {DELIVERY_TIER_COPY.map((t) => (
                            <li key={t.rangeEn}>• {t.rangeEn} &mdash; <span className="font-semibold">RM {t.fee}</span> (
                                {t.freeOver === null
                                    ? <span className="text-gray-500 font-bold">flat rate, no free-delivery threshold</span>
                                    : <span className="text-green-600 font-bold">free over RM {t.freeOver}</span>}
                                )</li>
                        ))}
                        {DELIVERY_TIER_COPY_FAR.map((t) => (
                            <li key={t.rangeEn}>• {t.rangeEn} &mdash; <span className="font-semibold">RM {t.fee}</span> (<span className="text-gray-500 font-bold">flat · via Grab</span>)</li>
                        ))}
                        <li>• Beyond 25km &mdash; not delivered. WhatsApp us for catering quotes.</li>
                    </ul>
                    <p className="mt-2 text-[13px] text-[#1A2D23]/60">
                        Beyond 7.5km we deliver via Grab at a flat fee by distance &mdash; <span className="font-semibold">no free-delivery threshold</span>, whatever your basket size.
                    </p>
                    <p className="mt-3">
                        Not sure if you&apos;re in range? <span className="font-bold text-[#1A2D23]">Register an account and add your address</span> &mdash;
                        the system will instantly check your location and tell you whether we deliver and the fee.
                    </p>
                </>
            ),
        },
        {
            q: 'Is the food healthy?',
            a: (
                <>
                    BowlMama cooks <span className="font-bold text-[#1A2D23]">healthy-leaning Chinese home food</span>: <span className="font-bold text-[#1A2D23]">no MSG</span>, ever &mdash;
                    ingredients are picked fresh at the wet market every morning and cooked the same day.<br />
                    Every dish on the menu lists its <span className="font-bold text-[#1A2D23]">protein grams</span> (many mains are 30g+ protein), so you can plan your meals.
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
    ],
};

// FAQPage structured data, generated from the same FAQS array that renders the
// visible Q&A — so the schema can never drift from what's on the page. Lets
// Google show FAQ rich results and gives AI answer engines clean Q&A pairs.
// 只在该语言全部条目都带 aText 时生成（见 FaqItem.aText 的说明）。
const buildFaqJsonLd = (items: FaqItem[]) =>
    items.every((item) => item.aText)
        ? {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: items.map(item => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: { "@type": "Answer", text: item.aText },
            })),
        }
        : null;
const FAQ_JSON_LD: Record<Locale, ReturnType<typeof buildFaqJsonLd>> = {
    zh: buildFaqJsonLd(FAQS.zh),
    en: buildFaqJsonLd(FAQS.en),
};

export default function FaqSection({ locale = 'zh' }: { locale?: Locale }) {
    const t = HOME_DICT[locale].faqSection;
    const faqs = FAQS[locale];
    const faqJsonLd = FAQ_JSON_LD[locale];
    // 两个首页各自的面板 id（EN 历史上带 -en 段）；aria-controls 跟着走。
    const panelId = (i: number) => (locale === 'en' ? `faq-panel-en-${i}` : `faq-panel-${i}`);
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
            {faqJsonLd && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
                />
            )}
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
                            {t.heading}
                        </h2>
                        <p className="text-[13px] lg:text-base text-[#1A2D23]/65 font-medium leading-relaxed mt-0.5 lg:mt-1">
                            {t.sub}
                        </p>
                    </div>
                </div>

                {/* Q&A list */}
                <ul className="divide-y divide-gray-100">
                    {faqs.map((item, i) => {
                        const isOpen = openIdx.has(i);
                        return (
                            <li key={i}>
                                <button
                                    type="button"
                                    onClick={() => toggle(i)}
                                    aria-expanded={isOpen}
                                    aria-controls={panelId(i)}
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
                                        id={panelId(i)}
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
