import React from 'react';
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

                    <div className="max-w-[640px] lg:max-w-[720px] space-y-5 lg:space-y-6 text-[15px] md:text-[17px] lg:text-[19px] leading-[1.8] text-[#1A2D23]/85 font-medium">
                        <p>
                            BowlMama&apos;s kitchen started from a home.
                        </p>
                        <p>
                            I live in <span className="font-semibold text-[#1A2D23]">Pearl Suria Residence</span>, next to Pearl Point.
                            Every morning at <span className="font-bold text-[#FF6B35]">6 AM</span> I&apos;m at the wet market &mdash;
                            picking the freshest fish, the day&apos;s meat, vegetables still dripping with water.
                        </p>
                        <p>
                            I cook it at home, pack each box by hand.<br />
                            Then it goes to your door via <span className="font-semibold text-[#1A2D23]">Grab delivery</span>.
                        </p>
                        <p className="font-bold text-[#1A2D23]">
                            This isn&apos;t a retail shopfront business &mdash;<br />
                            it&apos;s a neighbour making lunch and dinner for you.
                        </p>
                        <p>
                            You won&apos;t see a shopfront with BowlMama&apos;s signboard on the street &mdash;<br />
                            but every box came from one pair of hands in a home kitchen.
                        </p>
                        <p>
                            If you miss the taste of home,<br />
                            <span className="font-semibold text-[#1A2D23]">order through the website</span> or <span className="font-semibold text-[#1A2D23]">WhatsApp</span> me &mdash; either works.
                        </p>
                    </div>

                    <div className="mt-8 lg:mt-10 flex items-center gap-2 text-[15px] md:text-[17px] lg:text-[19px] font-bold text-[#1A2D23]">
                        <span className="text-[#FF6B35]">&mdash;</span>
                        <span>BowlMama</span>
                    </div>
                </div>
            </div>
        </section>
    );
}
