"use client";

import { Star } from 'lucide-react';

export default function HeroTrustStrip() {
    const scrollToFeedback = () => document.getElementById('feedback')?.scrollIntoView({ behavior: 'smooth' });

    return (
        <div className="lg:col-span-12 lg:row-start-3 mt-2">
            <button
                type="button"
                onClick={scrollToFeedback}
                aria-label="查看 Google 评价与邻居好评"
                className="w-full bg-white/70 backdrop-blur rounded-2xl border border-[#E3EADA] px-4 md:px-6 py-3 md:py-3.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 hover:bg-white/90 hover:border-[#FF6B35]/30 transition-[background-color,border-color] duration-150 ease-out group"
            >
                {/* 5 stars + score */}
                <div className="flex items-center gap-1.5">
                    <span className="flex items-center gap-0.5" aria-hidden="true">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} size={14} className="text-amber-400 fill-amber-400" strokeWidth={0} />
                        ))}
                    </span>
                    <span className="text-[13px] font-black text-[#1A2D23] leading-none">5.0</span>
                </div>

                <span className="hidden sm:inline w-px h-4 bg-[#1A2D23]/15" aria-hidden="true" />

                {/* Google reviews count + small G logo */}
                <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#1A2D23]/80">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.37-.35-2.09s.13-1.43.35-2.09V7.07H2.18a10.97 10.97 0 0 0 0 9.86l3.66-2.84z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" fill="#EA4335"/>
                    </svg>
                    <span>5+ Google 评价</span>
                </span>

                <span className="hidden sm:inline w-px h-4 bg-[#1A2D23]/15" aria-hidden="true" />

                {/* Neighborhood chip */}
                <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1A2D23]/75">
                    <span>Pearl Point · Millerz · SkyVille · OUG <span className="opacity-70">邻居都在吃</span> 🍱</span>
                </span>
            </button>
        </div>
    );
}
