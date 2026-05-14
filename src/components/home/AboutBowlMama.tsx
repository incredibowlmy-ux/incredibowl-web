import React from 'react';
import Image from 'next/image';
import { Home } from 'lucide-react';

export default function AboutBowlMama() {
    return (
        <section
            id="about"
            aria-labelledby="about-heading"
            className="lg:col-span-12 mt-4 scroll-mt-32"
        >
            <div className="relative bg-gradient-to-br from-[#FFF8F0] via-[#FDFBF7] to-[#FFF1E5] rounded-[32px] border border-[#FF6B35]/15 shadow-sm overflow-hidden">
                {/* Decorative quote mark */}
                <div
                    aria-hidden="true"
                    className="absolute top-4 right-6 lg:top-6 lg:right-10 select-none pointer-events-none font-serif text-[120px] lg:text-[200px] leading-none text-[#FF6B35]/10"
                >
                    &ldquo;
                </div>

                <div className="relative px-6 md:px-10 lg:px-14 py-10 md:py-12 lg:py-16">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-6 lg:mb-8">
                        <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-[#FF6B35]/12 flex items-center justify-center shrink-0">
                            <Home size={20} className="text-[#FF6B35] lg:hidden" strokeWidth={2.5} />
                            <Home size={24} className="text-[#FF6B35] hidden lg:block" strokeWidth={2.5} />
                        </div>
                        <h2
                            id="about-heading"
                            className="text-[26px] md:text-[32px] lg:text-[44px] font-extrabold tracking-tight text-[#1A2D23] leading-tight"
                        >
                            关于碗妈
                        </h2>
                    </div>

                    {/* Desktop: 2-col grid for body + photo. Mobile: text first, photo below. */}
                    <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-10 xl:gap-14 lg:items-start">
                        {/* Body — storytelling, generous spacing */}
                        <div className="max-w-[640px] lg:max-w-none space-y-5 lg:space-y-6 text-[15px] md:text-[17px] lg:text-[19px] leading-[1.85] text-[#1A2D23]/85 font-medium">
                            <p>
                                碗妈的厨房，是从一个家开始的。
                            </p>
                            <p>
                                我住在 Pearl Point 隔壁的 <span className="font-semibold text-[#1A2D23]">Pearl Suria Residence</span>，
                                每天凌晨 <span className="font-bold text-[#FF6B35]">6 点</span>去巴刹挑食材 ——
                                新鲜的鱼、当天的肉、还在滴水的蔬菜。
                            </p>
                            <p>
                                回家亲手煮、亲手装盒。<br />
                                装好之后，通过 <span className="font-semibold text-[#1A2D23]">Grab delivery</span> 送到你家门口。
                            </p>
                            <p className="font-bold text-[#1A2D23]">
                                这不是开店面的零售生意，<br />
                                是一个邻居为你做的午餐和晚餐。
                            </p>
                            <p>
                                你不会在街上看到挂着碗妈招牌的店面 ——<br />
                                但每一盒饭，都是从一双手煮出来的。
                            </p>
                            <p>
                                如果你也想念家里的味道，<br />
                                <span className="font-semibold text-[#1A2D23]">网页下单</span>或 <span className="font-semibold text-[#1A2D23]">WhatsApp</span> 告诉我都可以。
                            </p>

                            {/* Signature */}
                            <div className="!mt-8 lg:!mt-10 flex items-center gap-2 text-[15px] md:text-[17px] lg:text-[19px] font-bold text-[#1A2D23]">
                                <span className="text-[#FF6B35]">——</span>
                                <span>碗妈</span>
                            </div>
                        </div>

                        {/* Photo: pasar evidence — real shot of veggies + price boards
                            Mobile: stacked below text; Desktop: column on the right. */}
                        <figure className="mt-8 lg:mt-0">
                            <div className="relative aspect-[4/5] rounded-2xl overflow-hidden shadow-md border border-[#FF6B35]/10">
                                <Image
                                    src="/pasar-bowlmama.jpg"
                                    alt="碗妈每天凌晨 6 点到巴刹挑食材"
                                    fill
                                    sizes="(min-width: 1024px) 360px, 100vw"
                                    loading="lazy"
                                    className="object-cover"
                                />
                            </div>
                            <figcaption className="mt-2 text-[12px] lg:text-[13px] text-[#1A2D23]/55 italic text-center">
                                凌晨 6 点的巴刹，手挑番茄 · RM 3.60 / 600g
                            </figcaption>
                        </figure>
                    </div>
                </div>
            </div>
        </section>
    );
}
