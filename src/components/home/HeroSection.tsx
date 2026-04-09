"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { MapPin, ArrowRight, CalendarCheck } from 'lucide-react';
import { weeklyMenu, MenuItem } from '@/data/weeklyMenu';
import { getPromoDiscount } from '@/data/promoConfig';

interface NextSpecial {
    dish: MenuItem;
    labelZh: string;
    labelEn: string;
    dateLine: string;
}

/**
 * Compute the next available special dish based on the 06:00 cutoff.
 * Skips weekends. Falls back to the signature daily dish (id 13) if no
 * weekly special exists for the next available weekday (e.g., Tuesday).
 */
function computeNextSpecial(): NextSpecial {
    const now = new Date();
    const isPastCutoff = now.getHours() >= 6;

    const next = new Date(now);
    next.setDate(now.getDate() + (isPastCutoff ? 1 : 0));
    if (next.getDay() === 6) next.setDate(next.getDate() + 2);
    else if (next.getDay() === 0) next.setDate(next.getDate() + 1);

    const targetWd = next.getDay();
    const weeklySpecial = weeklyMenu.find(d => d.day !== 'Daily / 常驻' && d.id === targetWd);
    const fallback = weeklyMenu.find(d => d.id === 13) ?? weeklyMenu[0];
    const dish = weeklySpecial ?? fallback;

    const nowMid = new Date(now).setHours(0, 0, 0, 0);
    const nextMid = new Date(next).setHours(0, 0, 0, 0);
    const diff = Math.round((nextMid - nowMid) / 86400000);

    const wdCn = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const wdEn = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    let labelZh = '今日特餐';
    let labelEn = "TODAY'S SPECIAL";
    if (diff === 1) { labelZh = '明日特餐'; labelEn = "TOMORROW'S SPECIAL"; }
    else if (diff === 2) { labelZh = '后日特餐'; labelEn = "DAY AFTER SPECIAL"; }

    const dateLine = `${next.getMonth() + 1}月${next.getDate()}日 · ${wdCn[targetWd]} / ${wdEn[targetWd]}`;

    return { dish, labelZh, labelEn, dateLine };
}

export default function HeroSection() {
    const [heroImgIdx, setHeroImgIdx] = useState(0);
    const [nextSpecial, setNextSpecial] = useState<NextSpecial | null>(null);

    useEffect(() => {
        // Compute on client to avoid SSR hydration mismatch (uses new Date())
        setNextSpecial(computeNextSpecial());
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            setHeroImgIdx(prev => (prev + 1) % weeklyMenu.length);
        }, 8000);
        return () => clearInterval(timer);
    }, []);

    const scrollToMenu = () => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' });

    const discount = getPromoDiscount();
    const finalPrice = nextSpecial ? nextSpecial.dish.price - discount : 0;

    return (
        <>
            {/* Hero Bento 1: Brand Statement + Primary CTA */}
            <div className="lg:col-span-8 bg-[#E3EADA] rounded-[32px] p-8 md:p-12 relative overflow-hidden flex flex-col justify-end min-h-[460px]">
                {/* Rotating Background Images — pushed to right side, much dimmer */}
                <div className="absolute inset-0 pointer-events-none">
                    {weeklyMenu.map((dish, i) => (
                        heroImgIdx === i && (
                            <div key={dish.id} className="absolute inset-0 animate-fade-in">
                                <Image src={dish.image} alt="" fill className="object-cover object-right mix-blend-multiply opacity-[0.18]" priority={i === 0} />
                            </div>
                        )
                    ))}
                    {/* Strong left-side scrim so text area is always readable */}
                    <div className="absolute inset-0 bg-gradient-to-r from-[#E3EADA] from-30% via-[#E3EADA]/85 via-60% to-[#E3EADA]/40 z-10" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#E3EADA] via-[#E3EADA]/20 to-transparent z-10" />
                </div>

                <div className="relative z-20 max-w-xl">
                    {/* Location badge */}
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/70 backdrop-blur-md rounded-full text-xs font-bold mb-6 text-[#1A2D23] shadow-sm">
                        <MapPin size={12} className="text-[#FF6B35]" />
                        <span>Old Klang Road 邻里私房菜</span>
                        <span className="text-[#1A2D23]/40">·</span>
                        <span className="text-[#1A2D23]/70">Pearl Point Kitchen</span>
                    </div>

                    {/* Main title — Chinese big, English subtitle */}
                    <h2 className="text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight mb-2 text-[#1A2D23] drop-shadow-[0_1px_0_rgba(255,255,255,0.6)]">
                        家的味道，<br />
                        每天新鲜采购。
                    </h2>
                    <p className="text-base md:text-lg font-bold text-[#1A2D23]/65 tracking-wide mb-6">
                        Home-cooked Taste, Sourced Fresh Daily.
                    </p>

                    {/* Quote */}
                    <p className="text-lg md:text-xl font-semibold text-[#1A2D23]/85 leading-snug mb-1 max-w-md">
                        忙碌的你，值得一碗认真煮的饭。
                    </p>
                    <p className="text-base md:text-lg font-medium text-[#1A2D23]/70 leading-snug mb-3 max-w-md">
                        凌晨 6 点去巴刹，中午送到你手上。
                    </p>
                    <p className="text-sm md:text-base font-semibold text-[#1A2D23]/55 italic leading-snug mb-1 max-w-md">
                        You hustle. We feed you right.
                    </p>
                    <p className="text-xs md:text-sm font-medium text-[#1A2D23]/45 italic leading-snug mb-8 max-w-md">
                        At the market by 6am. At your door by noon.
                    </p>

                    {/* Primary CTA — prominent orange */}
                    <div className="relative inline-block group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-[#FF6B35]/60 to-[#FF9B50]/60 rounded-full blur-md opacity-70 group-hover:opacity-100 transition duration-500 animate-breathe" />
                        <button
                            type="button"
                            onClick={scrollToMenu}
                            className="relative inline-flex items-center gap-3 pl-7 pr-3 py-3 bg-[#FF6B35] hover:bg-[#E95D31] text-white rounded-full font-black text-base md:text-lg shadow-xl shadow-[#FF6B35]/30 transition-all duration-300 transform group-hover:-translate-y-0.5"
                        >
                            <span className="tracking-tight">立即查看菜单</span>
                            <span className="hidden md:inline text-sm font-bold text-white/80">· View Menu</span>
                            <span className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-white flex items-center justify-center text-[#FF6B35] shadow-md">
                                <ArrowRight size={20} strokeWidth={3} className="group-hover:translate-x-0.5 transition-transform" />
                            </span>
                        </button>
                    </div>

                    {/* How-to-order flow — bilingual, scannable */}
                    <div className="mt-5 max-w-md">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] md:text-sm font-bold text-[#1A2D23]/75">
                            <span>网页 / WhatsApp 下单</span>
                            <span className="text-[#FF6B35] font-black">→</span>
                            <span>2km 免运费</span>
                            <span className="text-[#FF6B35] font-black">→</span>
                            <span>中午送达</span>
                        </div>
                        <p className="text-[11px] md:text-xs font-medium text-[#1A2D23]/45 italic mt-1.5 leading-snug">
                            Order via web or WhatsApp · Free delivery within 2km · Arrives by noon
                        </p>
                    </div>
                </div>
            </div>

            {/* Hero Bento 2: Tomorrow's Special preview */}
            <div className="lg:col-span-4">
                <button
                    type="button"
                    onClick={scrollToMenu}
                    className="group w-full text-left bg-white rounded-[32px] overflow-hidden shadow-lg shadow-[#1A2D23]/5 border border-[#1A2D23]/5 hover:shadow-2xl hover:shadow-[#FF6B35]/10 hover:-translate-y-1 transition-all duration-300 flex flex-col h-full min-h-[460px]"
                >
                    {/* Image area */}
                    <div className="relative w-full h-56 md:h-64 overflow-hidden bg-[#E3EADA]">
                        {nextSpecial && (
                            <Image
                                src={nextSpecial.dish.image}
                                alt={nextSpecial.dish.name}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-500"
                                sizes="(min-width: 1024px) 33vw, 100vw"
                            />
                        )}
                        {/* Top label */}
                        <div className="absolute top-4 left-4 z-10">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FF6B35] text-white rounded-full shadow-lg shadow-[#FF6B35]/30">
                                <CalendarCheck size={13} strokeWidth={3} />
                                <span className="text-[11px] font-black tracking-wider uppercase">
                                    {nextSpecial?.labelEn ?? "TOMORROW'S SPECIAL"}
                                </span>
                            </div>
                        </div>
                        {/* Date pill bottom-right */}
                        {nextSpecial && (
                            <div className="absolute bottom-3 right-3 z-10">
                                <span className="inline-block px-2.5 py-1 bg-white/90 backdrop-blur-sm text-[#1A2D23] rounded-full text-[10px] font-black tracking-wide shadow-md">
                                    {nextSpecial.dateLine}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Content area */}
                    <div className="flex-1 p-6 md:p-7 flex flex-col">
                        <p className="text-[10px] font-black text-[#FF6B35] tracking-[0.2em] uppercase mb-2">
                            {nextSpecial?.labelZh ?? '明日特餐'}
                        </p>
                        <h3 className="text-xl md:text-2xl font-black text-[#1A2D23] leading-tight mb-1">
                            {nextSpecial?.dish.name ?? '招牌好菜'}
                        </h3>
                        <p className="text-xs md:text-sm font-semibold text-[#1A2D23]/55 italic mb-4">
                            {nextSpecial?.dish.nameEn ?? "BowlMama's Pick"}
                        </p>

                        {/* Tags */}
                        {nextSpecial && (
                            <div className="flex flex-wrap gap-1.5 mb-5">
                                {nextSpecial.dish.tags.slice(0, 3).map((tag, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-[#E3EADA] text-[#1A2D23]/75 rounded-full text-[10px] font-bold">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Price + arrow */}
                        <div className="mt-auto flex items-end justify-between pt-3 border-t border-[#1A2D23]/8">
                            <p className="text-2xl md:text-3xl font-black text-[#FF6B35] tracking-tight leading-none">
                                <span className="text-xs md:text-sm font-black text-[#1A2D23]/50 tracking-wider mr-1.5 align-middle">FROM</span>
                                RM {finalPrice.toFixed(2)}
                            </p>
                            <div className="w-11 h-11 rounded-full bg-[#1A2D23] flex items-center justify-center text-white group-hover:bg-[#FF6B35] group-hover:scale-110 transition-all duration-300 shrink-0">
                                <ArrowRight size={18} strokeWidth={3} className="group-hover:translate-x-0.5 transition-transform" />
                            </div>
                        </div>
                    </div>
                </button>
            </div>
        </>
    );
}
