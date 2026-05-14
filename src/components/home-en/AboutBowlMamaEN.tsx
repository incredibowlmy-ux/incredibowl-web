import React from 'react';
import Image from 'next/image';
import { Home } from 'lucide-react';

export default function AboutBowlMamaEN() {
    return (
        <section
            id="about"
            aria-labelledby="about-heading"
            className="lg:col-span-12 mt-4 scroll-mt-32"
        >
            <div className="relative bg-gradient-to-br from-[#FFF8F0] via-[#FDFBF7] to-[#FFF1E5] rounded-[32px] border border-[#FF6B35]/15 shadow-sm overflow-hidden">
                <div
                    aria-hidden="true"
                    className="absolute top-4 right-6 lg:top-6 lg:right-10 select-none pointer-events-none font-serif text-[120px] lg:text-[200px] leading-none text-[#FF6B35]/10"
                >
                    &ldquo;
                </div>

                <div className="relative px-6 md:px-10 lg:px-14 py-10 md:py-12 lg:py-16">
                    <div className="flex items-center gap-3 mb-6 lg:mb-8">
                        <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-[#FF6B35]/12 flex items-center justify-center shrink-0">
                            <Home size={20} className="text-[#FF6B35] lg:hidden" strokeWidth={2.5} />
                            <Home size={24} className="text-[#FF6B35] hidden lg:block" strokeWidth={2.5} />
                        </div>
                        <h2
                            id="about-heading"
                            className="text-[26px] md:text-[32px] lg:text-[44px] font-extrabold tracking-tight text-[#1A2D23] leading-tight"
                        >
                            About BowlMama
                        </h2>
                    </div>

                    {/* Desktop: 2-col grid for body + photo. Mobile: text first, photo below. */}
                    <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-10 xl:gap-14 lg:items-start">
                        <div className="max-w-[640px] lg:max-w-none space-y-5 lg:space-y-6 text-[15px] md:text-[17px] lg:text-[19px] leading-[1.8] text-[#1A2D23]/85 font-medium">
                            <p>
                                It all started in a home kitchen.
                            </p>
                            <p>
                                I live in <span className="font-semibold text-[#1A2D23]">Pearl Suria Residence</span>, right next door to Pearl Point.
                                Every morning at <span className="font-bold text-[#FF6B35]">6 AM</span> I&apos;m at the wet market &mdash;
                                picking the freshest fish, the day&apos;s meat, and vegetables still cool from the morning rinse.
                            </p>
                            <p>
                                Everything is cooked at home and packed by hand.<br />
                                From my door, <span className="font-semibold text-[#1A2D23]">Grab</span> takes it straight to yours.
                            </p>
                            <p className="font-bold text-[#1A2D23]">
                                This isn&apos;t a restaurant. No shopfront, no dine-in &mdash;<br />
                                just a neighbour cooking lunch and dinner for you.
                            </p>
                            <p>
                                That&apos;s why you won&apos;t spot a BowlMama signboard anywhere on the street.<br />
                                But every box you open was cooked and packed by one person, in one kitchen, that same morning.
                            </p>
                            <p>
                                Miss the taste of home? <span className="font-semibold text-[#1A2D23]">Order on the website</span> or drop me a message on <span className="font-semibold text-[#1A2D23]">WhatsApp</span> &mdash; whichever&apos;s easier.
                            </p>

                            <div className="!mt-8 lg:!mt-10 flex items-center gap-2 text-[15px] md:text-[17px] lg:text-[19px] font-bold text-[#1A2D23]">
                                <span className="text-[#FF6B35]">&mdash;</span>
                                <span>BowlMama</span>
                            </div>
                        </div>

                        <figure className="mt-8 lg:mt-0">
                            <div className="relative aspect-[4/5] rounded-2xl overflow-hidden shadow-md border border-[#FF6B35]/10">
                                <Image
                                    src="/pasar-bowlmama.jpg"
                                    alt="BowlMama picks produce at the wet market at 6 AM"
                                    fill
                                    sizes="(min-width: 1024px) 360px, 100vw"
                                    loading="lazy"
                                    className="object-cover"
                                />
                            </div>
                            <figcaption className="mt-2 text-[12px] lg:text-[13px] text-[#1A2D23]/55 italic text-center">
                                6 AM at the wet market &mdash; picking tomatoes by hand
                            </figcaption>
                        </figure>
                    </div>
                </div>
            </div>
        </section>
    );
}
