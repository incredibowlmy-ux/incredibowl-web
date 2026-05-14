"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { MapPin, ArrowRight, CalendarCheck, Star, Smartphone } from 'lucide-react';
import { weeklyMenu, MenuItem, dishImageAlt } from '@/data/weeklyMenu';
import { getPromoDiscount } from '@/data/promoConfig';

interface NextSpecial {
    dish: MenuItem;
    label: string;
    dateLine: string;
}

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

    const wdEn = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const monthEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    let label = "TODAY'S SPECIAL";
    if (diff === 1) label = "TOMORROW'S SPECIAL";
    else if (diff === 2) label = "DAY AFTER SPECIAL";

    const dateLine = `${monthEn[next.getMonth()]} ${next.getDate()} · ${wdEn[targetWd]}`;

    return { dish, label, dateLine };
}

export default function HeroSectionEN() {
    const [heroImgIdx, setHeroImgIdx] = useState(0);
    const [nextSpecial, setNextSpecial] = useState<NextSpecial | null>(null);

    useEffect(() => {
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
            <div className="lg:col-span-7 bg-[#E3EADA] rounded-[32px] p-8 md:p-12 relative overflow-hidden flex flex-col justify-end min-h-[460px]">
                <div className="absolute inset-0 pointer-events-none">
                    {weeklyMenu.map((dish, i) => (
                        heroImgIdx === i && (
                            <div key={dish.id} className="absolute inset-0 animate-fade-in">
                                <Image src={dish.image} alt="" fill className="object-cover object-right mix-blend-multiply opacity-[0.18]" priority={i === 0} />
                            </div>
                        )
                    ))}
                    <div className="absolute inset-0 bg-gradient-to-r from-[#E3EADA] from-30% via-[#E3EADA]/85 via-60% to-[#E3EADA]/40 z-10" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#E3EADA] via-[#E3EADA]/20 to-transparent z-10" />
                </div>

                <div className="relative z-20 max-w-xl lg:max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2 mb-6">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/70 backdrop-blur-md rounded-full text-xs font-bold text-[#1A2D23] shadow-sm">
                            <MapPin size={12} className="text-[#FF6B35]" />
                            <span>Old Klang Road home kitchen</span>
                            <span className="text-[#1A2D23]/40">·</span>
                            <span className="text-[#1A2D23]/70">Pearl Point</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => document.getElementById('feedback')?.scrollIntoView({ behavior: 'smooth' })}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FF6B35]/15 text-[#C84518] rounded-full text-xs font-bold shadow-sm hover:bg-[#FF6B35]/25 transition-colors active:scale-95"
                        >
                            <Star size={11} fill="currentColor" strokeWidth={0} />
                            <span>6+ neighbours love it</span>
                        </button>
                    </div>

                    <h1 className="text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight mb-2 text-[#1A2D23] drop-shadow-[0_1px_0_rgba(255,255,255,0.6)]">
                        Home-cooked taste,<br />
                        sourced fresh daily.
                    </h1>
                    <p lang="zh" className="text-base md:text-lg font-bold text-[#1A2D23]/65 tracking-wide mb-8">
                        家的味道，每天新鲜采购
                    </p>

                    <p className="text-2xl md:text-3xl font-black text-[#1A2D23]/95 leading-snug tracking-tight mb-3 max-w-md lg:max-w-xl">
                        At the market by <span className="text-[#FF6B35]">6 AM</span>,<br className="md:hidden" />
                        at your door by noon.
                    </p>
                    <p lang="zh" className="text-[13px] md:text-sm font-semibold text-[#1A2D23]/55 leading-relaxed mb-8 max-w-md lg:max-w-xl">
                        凌晨 6 点去巴刹，中午送到你手上
                    </p>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative inline-block group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-[#FF6B35]/60 to-[#FF9B50]/60 rounded-full blur-md opacity-70 group-hover:opacity-100 transition duration-500 animate-breathe" />
                            <button
                                type="button"
                                onClick={scrollToMenu}
                                className="relative inline-flex items-center gap-3 pl-7 pr-3 py-3 bg-[#FF6B35] hover:bg-[#E95D31] text-white rounded-full font-black text-base md:text-lg shadow-xl shadow-[#FF6B35]/30 transition-[transform,background-color,box-shadow] duration-200 ease-out transform group-hover:-translate-y-0.5 active:scale-[0.97] active:brightness-95"
                            >
                                <span className="tracking-tight">See Tomorrow&apos;s Menu</span>
                                <span className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-white flex items-center justify-center text-[#FF6B35] shadow-md">
                                    <ArrowRight size={20} strokeWidth={3} className="group-hover:translate-x-0.5 transition-transform" />
                                </span>
                            </button>
                        </div>

                        <a
                            href="https://wa.me/60103370197?text=Hi%20BowlMama!%20I%27d%20like%20to%20see%20today%27s%20menu."
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-transparent border-2 border-[#1A2D23]/15 hover:border-[#1A2D23]/35 hover:bg-white/40 text-[#1A2D23] rounded-full font-bold text-sm transition-[transform,border-color,background-color] duration-150 ease-out active:scale-[0.97]"
                        >
                            <svg viewBox="0 0 32 32" className="w-4 h-4 fill-[#25D366]" aria-hidden="true">
                                <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.638 3.41 4.673 4.34.616.287 2.035.888 2.722.888.817 0 2.15-.515 2.49-1.318.158-.386.216-.815.216-1.231 0-.817-.27-.99-.974-1.318-.388-.198-1.005-.43-1.477-.687zM16.205 28.997c-2.262 0-4.49-.617-6.418-1.792l-.46-.273-4.762 1.247 1.273-4.633-.302-.476a12.652 12.652 0 0 1-1.946-6.747c0-7 5.674-12.673 12.673-12.673 3.387 0 6.57 1.32 8.96 3.71a12.595 12.595 0 0 1 3.7 8.97c0 7.001-5.778 12.667-12.776 12.667zm10.79-23.461A14.864 14.864 0 0 0 16.207 1.205C7.965 1.205 1.252 7.918 1.236 16.16c0 2.64.69 5.215 2 7.49l-2.131 7.79 7.97-2.09a15.122 15.122 0 0 0 7.122 1.817h.014c8.244 0 15.07-6.713 15.07-14.957 0-3.998-1.65-7.752-4.487-10.575z"/>
                            </svg>
                            <span>Ask BowlMama on WhatsApp</span>
                        </a>
                    </div>

                    <div className="mt-5 max-w-md lg:max-w-xl">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] md:text-sm font-bold text-[#1A2D23]/75 lg:hidden">
                            <span>Order via web / WhatsApp</span>
                            <span className="text-[#FF6B35] font-black">→</span>
                            <span>Free within 2km</span>
                        </div>
                        <div className="hidden lg:flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-sm font-bold text-[#1A2D23]/75">
                            <span className="inline-flex items-center gap-1.5">
                                <Smartphone size={14} className="text-[#FF6B35] shrink-0" strokeWidth={2.5} />
                                Web / WhatsApp ordering
                            </span>
                            <span className="text-[#1A2D23]/25 select-none">·</span>
                            <span className="inline-flex items-center gap-1.5">
                                <MapPin size={14} className="text-[#FF6B35] shrink-0" strokeWidth={2.5} />
                                Free delivery within 2km
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tomorrow's Special card */}
            <div className="lg:col-span-5">
                <button
                    type="button"
                    onClick={scrollToMenu}
                    className="group w-full text-left bg-white rounded-[32px] overflow-hidden shadow-lg shadow-[#1A2D23]/5 border border-[#1A2D23]/5 hover:shadow-2xl hover:shadow-[#FF6B35]/10 hover:-translate-y-1 transition-[transform,box-shadow] duration-300 ease-out active:scale-[0.99] flex flex-col h-full min-h-[460px]"
                >
                    <div className="relative w-full h-56 md:h-64 lg:h-72 overflow-hidden bg-[#E3EADA]">
                        {nextSpecial && (
                            <Image
                                src={nextSpecial.dish.image}
                                alt={dishImageAlt(nextSpecial.dish, 'en')}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-500"
                                sizes="(min-width: 1024px) 33vw, 100vw"
                            />
                        )}
                        <div className="absolute top-4 left-4 z-10">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1A2D23] text-white rounded-full shadow-md">
                                <CalendarCheck size={13} strokeWidth={3} />
                                <span className="text-xs font-black tracking-wider uppercase">
                                    {nextSpecial?.label ?? "TOMORROW'S SPECIAL"}
                                </span>
                            </div>
                        </div>
                        {nextSpecial && (
                            <div className="absolute bottom-3 right-3 z-10">
                                <span className="inline-block px-2.5 py-1 bg-white/90 backdrop-blur-sm text-[#1A2D23] rounded-full text-xs font-black tracking-wide shadow-md">
                                    {nextSpecial.dateLine}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 p-6 md:p-7 flex flex-col">
                        <p className="text-xs font-black text-[#FF6B35] tracking-[0.2em] uppercase mb-2">
                            {nextSpecial?.label.replace("'S SPECIAL", "").toLowerCase().replace(/^./, c => c.toUpperCase()) ?? "Tomorrow"} pick
                        </p>
                        <h3 className="text-xl md:text-2xl font-black text-[#1A2D23] leading-tight mb-1">
                            {nextSpecial?.dish.nameEn ?? "BowlMama's Pick"}
                        </h3>
                        <p lang="zh" className="text-xs md:text-sm font-semibold text-[#1A2D23]/55 italic mb-4">
                            {nextSpecial?.dish.name ?? '招牌好菜'}
                        </p>

                        {nextSpecial && (
                            <div className="flex flex-wrap gap-1.5 mb-4">
                                {(nextSpecial.dish.tagsEn ?? nextSpecial.dish.tags).slice(0, 3).map((tag, i) => (
                                    <span key={i} className="px-2.5 py-1 bg-[#E3EADA] text-[#1A2D23]/85 rounded-full text-xs font-bold">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        {nextSpecial?.dish.descEn && (
                            <p className="hidden lg:block text-[13px] text-[#1A2D23]/65 leading-relaxed italic mb-5 line-clamp-3">
                                &ldquo;{nextSpecial.dish.descEn}&rdquo;
                            </p>
                        )}

                        <div className="mt-auto flex items-end justify-between pt-3 border-t border-[#1A2D23]/8 lg:hidden">
                            <p className="text-2xl md:text-3xl font-black text-[#FF6B35] tracking-tight leading-none">
                                RM {finalPrice.toFixed(2)}
                            </p>
                            <div className="w-11 h-11 rounded-full bg-[#1A2D23] flex items-center justify-center text-white group-hover:bg-[#FF6B35] group-hover:scale-110 transition-[transform,background-color] duration-300 ease-out shrink-0">
                                <ArrowRight size={18} strokeWidth={3} className="group-hover:translate-x-0.5 transition-transform" />
                            </div>
                        </div>

                        <div className="hidden lg:flex mt-auto flex-col gap-3.5 pt-3 border-t border-[#1A2D23]/8">
                            <p className="text-3xl font-black text-[#FF6B35] tracking-tight leading-none">
                                RM {finalPrice.toFixed(2)}
                            </p>
                            <span className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-[#1A2D23] group-hover:bg-[#243A2D] text-white rounded-xl text-[15px] font-black shadow-md shadow-[#1A2D23]/15 group-hover:shadow-lg group-hover:shadow-[#1A2D23]/25 transition-[background-color,box-shadow] duration-200 ease-out">
                                See tomorrow&apos;s special
                                <ArrowRight size={16} strokeWidth={3} className="group-hover:translate-x-0.5 transition-transform" />
                            </span>
                        </div>
                    </div>
                </button>
            </div>
        </>
    );
}
