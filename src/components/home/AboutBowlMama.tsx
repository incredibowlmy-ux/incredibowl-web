import React from 'react';
import Image from 'next/image';
import { Home } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import { HOME_DICT } from './dict';

// 正文是带 <span>/<br /> 的多行 JSX，JSX 的换行折叠规则让它没法安全地搬成纯字符串，
// 所以两种语言的段落各自逐字保留在这里（dict.ts 只放标题 / 签名 / 图片说明这些纯字符串）。
const BODY: Record<Locale, React.ReactNode> = {
    zh: (
        <>
            <p>
                碗妈的厨房，是从一个家开始的。
            </p>
            <p>
                我住在 Pearl Point 隔壁的 <span className="font-semibold text-ink">Pearl Suria Residence</span>，
                每天凌晨 <span className="font-bold text-primary">6 点</span>去巴刹挑食材 ——
                新鲜的鱼、当天的肉、还在滴水的蔬菜。
            </p>
            <p>
                回家亲手煮、亲手装盒。<br />
                装好之后，通过 <span className="font-semibold text-ink">Grab delivery</span> 送到你家门口。
            </p>
            <p className="font-bold text-ink">
                这不是开店面的零售生意，<br />
                是一个邻居为你做的午餐和晚餐。
            </p>
            <p>
                你不会在街上看到挂着碗妈招牌的店面 ——<br />
                但每一盒饭，都是从一双手煮出来的。
            </p>
            <p>
                如果你也想念家里的味道，<br />
                <span className="font-semibold text-ink">网页下单</span>或 <span className="font-semibold text-ink">WhatsApp</span> 告诉我都可以。
            </p>
        </>
    ),
    en: (
        <>
            <p>
                It all started in a home kitchen.
            </p>
            <p>
                I live in <span className="font-semibold text-ink">Pearl Suria Residence</span>, right next door to Pearl Point.
                Every morning at <span className="font-bold text-primary">6 AM</span> I&apos;m at the wet market &mdash;
                picking the freshest fish, the day&apos;s meat, and vegetables still cool from the morning rinse.
            </p>
            <p>
                Everything is cooked at home and packed by hand.<br />
                From my door, <span className="font-semibold text-ink">Grab</span> takes it straight to yours.
            </p>
            <p className="font-bold text-ink">
                This isn&apos;t a restaurant. No shopfront, no dine-in &mdash;<br />
                just a neighbour cooking lunch and dinner for you.
            </p>
            <p>
                That&apos;s why you won&apos;t spot a BowlMama signboard anywhere on the street.<br />
                But every box you open was cooked and packed by one person, in one kitchen, that same morning.
            </p>
            <p>
                Miss the taste of home? <span className="font-semibold text-ink">Order on the website</span> or drop me a message on <span className="font-semibold text-ink">WhatsApp</span> &mdash; whichever&apos;s easier.
            </p>
        </>
    ),
};

export default function AboutBowlMama({ locale = 'zh' }: { locale?: Locale }) {
    const t = HOME_DICT[locale].aboutBowlMama;
    // 历史漂移：正文行高 zh leading-[1.85]、en leading-[1.8]。C1 零 diff 合并原样保留。
    const bodyLeading = locale === 'en' ? 'leading-[1.8]' : 'leading-[1.85]';
    return (
        <section
            id="about"
            aria-labelledby="about-heading"
            className="lg:col-span-12 mt-4 scroll-mt-32"
        >
            <div className="relative bg-gradient-to-br from-[#FFF8F0] via-paper to-[#FFF1E5] rounded-[32px] border border-primary/15 shadow-sm overflow-hidden">
                {/* Decorative quote mark */}
                <div
                    aria-hidden="true"
                    className="absolute top-4 right-6 lg:top-6 lg:right-10 select-none pointer-events-none font-serif text-[120px] lg:text-[200px] leading-none text-primary/10"
                >
                    &ldquo;
                </div>

                <div className="relative px-6 md:px-10 lg:px-14 py-10 md:py-12 lg:py-16">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-6 lg:mb-8">
                        <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-primary/12 flex items-center justify-center shrink-0">
                            <Home size={20} className="text-primary lg:hidden" strokeWidth={2.5} />
                            <Home size={24} className="text-primary hidden lg:block" strokeWidth={2.5} />
                        </div>
                        <h2
                            id="about-heading"
                            className="text-[26px] md:text-[32px] lg:text-[40px] font-extrabold tracking-tight text-ink leading-tight"
                        >
                            {t.heading}
                        </h2>
                    </div>

                    {/* Desktop: 2-col grid for body + photo. Mobile: text first, photo below. */}
                    <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-10 xl:gap-14 lg:items-start">
                        {/* Body — storytelling, generous spacing */}
                        <div className={`max-w-[640px] lg:max-w-none space-y-5 lg:space-y-6 text-[15px] md:text-[17px] lg:text-[17px] ${bodyLeading} text-ink/85 font-medium`}>
                            {BODY[locale]}

                            {/* Signature */}
                            <div className="!mt-8 lg:!mt-10 flex items-center gap-2 text-[15px] md:text-[17px] lg:text-[17px] font-bold text-ink">
                                <span className="text-primary">{t.signatureDash}</span>
                                <span>{t.signatureName}</span>
                            </div>
                        </div>

                        {/* Photo: pasar evidence — real shot of veggies + price boards
                            Mobile: stacked below text; Desktop: column on the right. */}
                        <figure className="mt-8 lg:mt-0">
                            <div className="relative aspect-[4/5] rounded-2xl overflow-hidden shadow-md border border-primary/10">
                                <Image
                                    src="/pasar-bowlmama.jpg"
                                    alt={t.photoAlt}
                                    fill
                                    sizes="(min-width: 1024px) 360px, 100vw"
                                    loading="lazy"
                                    className="object-cover"
                                />
                            </div>
                            <figcaption className="mt-2 text-[12px] lg:text-[13px] text-ink/55 italic text-center">
                                {t.photoCaption}
                            </figcaption>
                        </figure>
                    </div>
                </div>
            </div>
        </section>
    );
}
