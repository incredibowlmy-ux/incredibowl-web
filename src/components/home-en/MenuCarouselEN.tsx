"use client";

import React, { useMemo } from 'react';
import Image from 'next/image';
import { ShoppingBag, Sparkles, Phone } from 'lucide-react';
import { weeklyMenu, MenuItem, dishImageAlt } from '@/data/weeklyMenu';
import { MenuDateInfo } from '@/lib/dateUtils';
import { computeNextSpecial } from '@/lib/nextSpecial';
import SkeletonBlock from '@/components/ui/SkeletonBlock';
import SoldOutNotice from '@/components/home/SoldOutNotice';

interface MenuCarouselENProps {
    menuDates: Record<number, MenuDateInfo>;
    onOpenAddOn: (dish: MenuItem) => void;
    /** dishId(string) → remaining stock for limited dishes; absent = unlimited. */
    dishStock?: Record<string, number>;
}

const WD_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Per-weekday number badge (Mon=1 … Fri=5). Replaces the 🗓 calendar emoji,
// which renders as a generic "1" box on Windows and looked identical every day.
const WD_EMOJI = ['', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];

export default function MenuCarouselEN({ menuDates, onOpenAddOn, dishStock = {} }: MenuCarouselENProps) {
    const ready = Object.keys(menuDates).length > 0;

    const tomorrowsId = useMemo(() => (ready ? computeNextSpecial().dish.id : null), [ready]);

    // Group into the weekly-rotation story: Mon→Fri specials (one band per day),
    // then always-available daily dishes, then retired/paused at the very bottom.
    // Built ONLY client-side (ready === true) so SSR/first paint keeps the flat
    // skeleton and hydration matches (NO_LCP-safe guard, mirrors the ZH carousel).
    const groups = useMemo(() => {
        if (!ready) return null;
        const active = weeklyMenu.filter(d => !d.retired);
        const daily = active.filter(d => d.weekday == null);
        const days = [1, 2, 3, 4, 5]
            .map(wd => ({
                wd,
                dishes: active
                    .filter(d => d.weekday === wd)
                    .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0)),
            }))
            .filter(g => g.dishes.length > 0);
        const retired = weeklyMenu.filter(d => d.retired);
        return { daily, days, retired };
    }, [ready]);

    // ── Section header (spans the full row in both grids) ──
    const sectionHeader = (key: string, title: string, dateSub: string | null, highlight: boolean, size: 'sm' | 'lg') => (
        <div
            key={key}
            className={`${size === 'sm' ? 'col-span-2 mt-3 first:mt-1 px-1' : 'col-span-full mt-5 first:mt-0 px-1'} flex items-baseline gap-2`}
        >
            <h3 className={`font-extrabold leading-none ${size === 'sm' ? 'text-[16px]' : 'text-[24px]'} ${highlight ? 'text-[#FF6B35]' : 'text-[#1A2D23]'}`}>
                {title}
            </h3>
            {dateSub && <span className={`font-bold text-gray-400 ${size === 'sm' ? 'text-[11px]' : 'text-[14px]'}`}>{dateSub}</span>}
            {highlight && (
                <span className={`ml-auto inline-flex items-center gap-1 font-black text-[#FF6B35] bg-[#FF6B35]/12 rounded-full ${size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-[12px] px-2.5 py-1'}`}>
                    ✨ Up next
                </span>
            )}
        </div>
    );

    // ── MOBILE card (compact, 2-col) ──
    const renderMobileCard = (dish: MenuItem) => {
        const dInfo = menuDates[dish.id];
        const stockLeft = dishStock[String(dish.id)];
        const isLimited = typeof stockLeft === 'number';
        const isSoldOut = isLimited && stockLeft <= 0;
        const isDisabled = !!dInfo?.disabled || isSoldOut;
        const isTomorrow = dish.id === tomorrowsId && !isDisabled;
        return (
            <div
                key={dish.id}
                onClick={() => !isDisabled && onOpenAddOn(dish)}
                className={`bg-white rounded-2xl p-3 border flex flex-col transition-[transform,box-shadow,border-color,opacity] duration-200 ease-out ${
                    isDisabled
                        ? 'opacity-50 border-gray-100 cursor-not-allowed'
                        : isTomorrow
                            ? 'border-[#FF6B35]/40 shadow-md shadow-[#FF6B35]/15 cursor-pointer active:scale-[0.98]'
                            : 'border-gray-100 cursor-pointer active:scale-[0.98]'
                }`}
            >
                <div className="flex justify-between items-start mb-2 gap-1">
                    <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold truncate ${
                        isTomorrow
                            ? 'bg-[#FF6B35]/15 text-[#FF6B35]'
                            : 'bg-[#FDFBF7] text-gray-500'
                    }`}>
                        {isTomorrow ? '✨ Tomorrow' : (dInfo ? dInfo.topTag.split(' · ')[0] : dish.day)}
                    </div>
                    <p className="font-extrabold text-[13px] leading-none text-[#FF6B35] shrink-0">
                        RM{dish.price.toFixed(2)}
                    </p>
                </div>

                <div className={`aspect-square w-full rounded-xl bg-[#FDFBF7] mb-2 relative overflow-hidden ${isDisabled ? 'grayscale' : ''}`}>
                    {isLimited && stockLeft <= 10 && (
                        <span className={`absolute top-1.5 left-1.5 z-10 px-2 py-1 rounded-md text-[12px] font-extrabold shadow-md ${isSoldOut ? 'bg-gray-800/90 text-white' : 'bg-[#FF6B35] text-white'}`}>
                            {isSoldOut ? 'Sold out' : `${stockLeft} left`}
                        </span>
                    )}
                    {dish.image.startsWith('/') ? (
                        <Image
                            src={dish.image}
                            alt={dishImageAlt(dish, 'en')}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 25vw"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-5xl">{dish.image}</div>
                    )}
                </div>

                <h3 className="font-extrabold text-[14px] leading-tight mb-1.5 text-[#1A2D23] line-clamp-2 min-h-[34px]">
                    {dish.nameEn}
                </h3>

                <div className="flex flex-wrap gap-1 mb-2.5 min-h-[18px] overflow-hidden max-h-[18px]">
                    {(dish.tagsEn ?? dish.tags).slice(0, 2).map(tag => (
                        <span key={tag} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#E3EADA]/70 text-[#1A2D23] truncate max-w-full">
                            {tag}
                        </span>
                    ))}
                </div>

                <div className="mt-auto">
                    <button
                        onClick={(e) => { e.stopPropagation(); if (!isDisabled) onOpenAddOn(dish); }}
                        disabled={isDisabled}
                        className={`w-full py-2 rounded-lg font-bold text-[12px] flex justify-center items-center gap-1 transition-colors ${
                            isDisabled
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : isTomorrow
                                    ? 'bg-[#FF6B35] hover:bg-[#E95D31] text-white shadow-sm shadow-[#FF6B35]/30'
                                    : 'bg-[#FF6B35]/10 text-[#FF6B35] hover:bg-[#FF6B35] hover:text-white'
                        }`}
                    >
                        {!isDisabled && <ShoppingBag size={12} />}
                        <span className="truncate">
                            {isDisabled
                                ? (isSoldOut ? 'Sold out' : 'Closed')
                                : isTomorrow
                                    ? 'Order tmrw'
                                    : 'Add to order'}
                        </span>
                    </button>
                </div>
            </div>
        );
    };

    // ── DESKTOP card (large, 3–4 col) ──
    const renderDesktopCard = (dish: MenuItem) => {
        const dInfo = menuDates[dish.id];
        const stockLeft = dishStock[String(dish.id)];
        const isLimited = typeof stockLeft === 'number';
        const isSoldOut = isLimited && stockLeft <= 0;
        const isDisabled = !!dInfo?.disabled || isSoldOut;
        return (
            <div
                key={dish.id}
                onClick={() => !isDisabled && onOpenAddOn(dish)}
                className={`group bg-white rounded-3xl p-5 border border-gray-100 transition-[transform,box-shadow,border-color,opacity] duration-300 ease-out flex flex-col ${
                    isDisabled
                        ? 'opacity-50 cursor-not-allowed'
                        : 'cursor-pointer hover:shadow-xl hover:shadow-[#1A2D23]/5 hover:-translate-y-1 hover:border-[#FF6B35]/20 active:scale-[0.99]'
                }`}
            >
                <div className="flex justify-between items-start mb-4">
                    <div className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#FDFBF7] text-gray-500">
                        {dInfo ? dInfo.topTag : dish.day}
                    </div>
                    <p className="font-extrabold text-[20px] leading-none text-[#FF6B35]">
                        RM {dish.price.toFixed(2)}
                    </p>
                </div>

                <div className={`aspect-square w-full rounded-2xl bg-[#FDFBF7] flex items-center justify-center text-6xl mb-4 relative overflow-hidden ${isDisabled ? 'grayscale' : ''}`}>
                    {isLimited && stockLeft <= 10 && (
                        <span className={`absolute top-2.5 left-2.5 z-10 px-2.5 py-1 rounded-md text-[14px] font-extrabold shadow-md ${isSoldOut ? 'bg-gray-800/90 text-white' : 'bg-[#FF6B35] text-white'}`}>
                            {isSoldOut ? 'Sold out' : `${stockLeft} left`}
                        </span>
                    )}
                    {dish.image.startsWith('/') ? (
                        <Image
                            src={dish.image}
                            alt={dishImageAlt(dish, 'en')}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                            sizes="(min-width: 1280px) 25vw, 33vw"
                        />
                    ) : (
                        dish.image
                    )}
                </div>

                <h3 className="font-extrabold text-[22px] leading-tight mb-1 text-[#1A2D23]">{dish.nameEn}</h3>
                <h4 lang="zh" className="text-[15px] font-medium mb-3 leading-relaxed text-gray-400">{dish.name}</h4>

                <div className="flex flex-wrap gap-1.5 mb-5">
                    {(dish.tagsEn ?? dish.tags).map(tag => (
                        <span key={tag} className="text-[13px] font-bold px-2.5 py-1 rounded-md bg-[#E3EADA]/70 text-[#1A2D23]">
                            {tag}
                        </span>
                    ))}
                </div>

                <div className="mt-auto">
                    <button
                        onClick={(e) => { e.stopPropagation(); if (!isDisabled) onOpenAddOn(dish); }}
                        disabled={isDisabled}
                        className={`w-full py-3.5 rounded-xl font-bold text-[15px] flex justify-center items-center gap-2 transition-colors ${
                            isDisabled
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                : 'bg-[#FF6B35] hover:bg-[#E95D31] text-white shadow-md shadow-[#FF6B35]/20'
                        }`}
                    >
                        {!isDisabled && <ShoppingBag size={18} />}
                        <span className="truncate">
                            {isSoldOut ? 'Sold out' : (dInfo ? dInfo.btnText : "Add to tomorrow's order")}
                        </span>
                    </button>
                </div>
            </div>
        );
    };

    // Date sub-label for a day band, derived from that day's first dish's topTag
    // (en special topTag = "Jun 30 · Mon" → "Jun 30").
    const dayDateSub = (dish: MenuItem) => menuDates[dish.id]?.topTag?.split(' · ')[0] ?? null;

    const mobileSkeleton = weeklyMenu.map((dish) => (
        <div key={dish.id} className="bg-white rounded-2xl p-3 border border-gray-100 flex flex-col">
            <div className="flex justify-between items-start mb-2">
                <SkeletonBlock className="h-4 w-14" />
                <SkeletonBlock className="h-4 w-12" />
            </div>
            <SkeletonBlock className="aspect-square w-full rounded-xl mb-2" />
            <SkeletonBlock className="h-4 w-3/4 mb-2" />
            <div className="flex gap-1 mb-3">
                <SkeletonBlock className="h-4 w-12" />
                <SkeletonBlock className="h-4 w-10" />
            </div>
            <SkeletonBlock className="h-8 w-full mt-auto rounded-lg" />
        </div>
    ));

    const desktopSkeleton = weeklyMenu.map((dish) => (
        <div key={dish.id} className="bg-white rounded-3xl p-5 border border-gray-100 flex flex-col">
            <div className="flex justify-between items-start mb-4">
                <SkeletonBlock className="h-5 w-24" />
                <SkeletonBlock className="h-5 w-16" />
            </div>
            <SkeletonBlock className="aspect-square w-full rounded-2xl mb-4" />
            <SkeletonBlock className="h-6 w-3/4 mb-2" />
            <SkeletonBlock className="h-4 w-1/2 mb-4" />
            <div className="flex gap-2 mb-4">
                <SkeletonBlock className="h-6 w-16" />
                <SkeletonBlock className="h-6 w-16" />
            </div>
            <SkeletonBlock className="h-11 w-full mt-auto" />
        </div>
    ));

    const whatsappMobile = (
        <a
            href="https://wa.me/60103370197?text=Hi%20BowlMama!%20I%27d%20like%20to%20be%20notified%20when%20next%20week%27s%20menu%20is%20updated.%20Could%20you%20let%20me%20know%3F"
            target="_blank"
            rel="noopener noreferrer"
            className="col-span-2 mt-1 group bg-gradient-to-br from-[#FFF3E0] to-[#FFE5C9]/70 rounded-2xl p-4 border-2 border-[#FF6B35]/30 shadow-sm shadow-[#FF6B35]/10 flex items-center gap-3 transition-[transform,box-shadow] duration-200 active:scale-[0.99] relative overflow-hidden"
        >
            <div className="w-12 h-12 bg-[#FF6B35]/20 rounded-full flex items-center justify-center shrink-0 shadow-sm shadow-[#FF6B35]/20">
                <Sparkles size={20} className="text-[#FF6B35]" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-[#FF6B35] uppercase tracking-widest mb-0.5">Next Week</p>
                <p className="text-[14px] font-extrabold text-[#1A2D23] leading-tight">Get a heads-up when next week&rsquo;s menu drops?</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#25D366] text-white rounded-full text-[12px] font-black shadow-sm shadow-[#25D366]/30 shrink-0">
                <Phone size={12} strokeWidth={2.5} /> WhatsApp
            </span>
        </a>
    );

    const whatsappDesktop = (
        <a
            href="https://wa.me/60103370197?text=Hi%20BowlMama!%20I%27d%20like%20to%20be%20notified%20when%20next%20week%27s%20menu%20is%20updated.%20Could%20you%20let%20me%20know%3F"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-gradient-to-br from-[#FFF3E0] to-[#FFE5C9]/70 rounded-3xl p-5 border-2 border-[#FF6B35]/30 shadow-md shadow-[#FF6B35]/10 hover:shadow-xl hover:shadow-[#FF6B35]/20 hover:-translate-y-1 hover:border-[#FF6B35]/60 flex flex-col text-center transition-[transform,box-shadow,border-color] duration-300 ease-out cursor-pointer min-h-[420px] relative overflow-hidden"
        >
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#FF6B35] rounded-full blur-3xl opacity-15 pointer-events-none" />

            <div className="relative flex-1 flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-[#FF6B35]/20 group-hover:bg-[#FF6B35]/30 rounded-full flex items-center justify-center mb-4 transition-colors shadow-md shadow-[#FF6B35]/20">
                    <Sparkles size={28} className="text-[#FF6B35]" strokeWidth={2.5} />
                </div>
                <p className="text-xs font-black text-[#FF6B35] uppercase tracking-widest mb-2">✨ NEXT WEEK</p>
                <p className="text-[22px] font-extrabold text-[#1A2D23] leading-tight mb-3">Coming<br />Next Week</p>
                <p className="text-sm font-medium text-[#1A2D23]/70 leading-relaxed max-w-[220px]">
                    BowlMama refreshes the menu weekly.<br />
                    <span className="text-[#1A2D23] font-bold">Want to be notified?</span>
                </p>
            </div>

            <span className="relative self-center inline-flex items-center gap-2 px-6 py-3.5 bg-[#25D366] group-hover:bg-[#20BE5A] text-white rounded-full text-[15px] font-black shadow-lg shadow-[#25D366]/30 group-hover:shadow-[#25D366]/40 transition-[background-color,box-shadow] duration-150 ease-out">
                <Phone size={15} strokeWidth={2.5} /> Notify me on WhatsApp
            </span>
        </a>
    );

    return (
        <div className="lg:col-span-12 mt-8" id="menu">
            <div className="flex items-center justify-between mb-6 px-4 md:px-2">
                <div>
                    <h2 className="text-[22px] lg:text-[40px] font-extrabold tracking-tight leading-tight">Daily Picks · Weekly Rotation</h2>
                    <p className="text-xs text-gray-500 font-medium mt-1.5 leading-relaxed">
                        <span className="lg:hidden">A different special each weekday — plus daily dishes, always available. BowlMama refreshes weekly.</span>
                        <span className="hidden lg:inline">One special per weekday, Mon–Fri — daily dishes available every day. BowlMama refreshes the menu weekly.</span>
                    </p>
                </div>
            </div>

            <SoldOutNotice locale="en" />

            {/* MOBILE + TABLET — compact 2-column grid, grouped by weekday */}
            <div className="lg:hidden grid grid-cols-2 gap-3 px-3 pt-2">
                {!ready || !groups
                    ? mobileSkeleton
                    : (
                        <>
                            {groups.days.map(g => {
                                const isNext = g.dishes.some(d => d.id === tomorrowsId);
                                return (
                                    <React.Fragment key={`m-day-${g.wd}`}>
                                        {sectionHeader(`m-hdr-${g.wd}`, `${WD_EMOJI[g.wd]} ${WD_LABEL[g.wd]}`, dayDateSub(g.dishes[0]), isNext, 'sm')}
                                        {g.dishes.map(renderMobileCard)}
                                    </React.Fragment>
                                );
                            })}

                            {groups.daily.length > 0 && (
                                <>
                                    {sectionHeader('m-hdr-daily', '⭐ Daily · Always available', null, false, 'sm')}
                                    {groups.daily.map(renderMobileCard)}
                                </>
                            )}

                            {whatsappMobile}

                            {groups.retired.length > 0 && (
                                <>
                                    {sectionHeader('m-hdr-retired', '🕰 Past favourites · Back soon', null, false, 'sm')}
                                    {groups.retired.map(renderMobileCard)}
                                </>
                            )}
                        </>
                    )}
            </div>

            {/* DESKTOP — weekly rotation calendar (lg+): Mon→Fri as 5 day-columns,
                then always-available daily + paused dishes as their own filled grids. */}
            <div className="hidden lg:block px-2 pt-4">
                {!ready || !groups
                    ? <div className="grid lg:grid-cols-3 xl:grid-cols-4 gap-5">{desktopSkeleton}</div>
                    : (
                        <>
                            {/* This week's specials · weekly calendar (5 even columns, no grid gaps) */}
                            <div className="grid grid-cols-5 gap-4">
                                {groups.days.map(g => {
                                    const isNext = g.dishes.some(d => d.id === tomorrowsId);
                                    return (
                                        <div key={`d-day-${g.wd}`} className="flex flex-col gap-4">
                                            <div className={`flex flex-col items-center text-center pb-2 border-b-2 ${isNext ? 'border-[#FF6B35]' : 'border-gray-100'}`}>
                                                <span className={`text-[22px] font-extrabold leading-none ${isNext ? 'text-[#FF6B35]' : 'text-[#1A2D23]'}`}>{WD_EMOJI[g.wd]} {WD_LABEL[g.wd]}</span>
                                                <span className="text-[12px] font-bold text-gray-400 mt-1.5">{dayDateSub(g.dishes[0])}</span>
                                                {isNext && <span className="mt-1.5 text-[10px] font-black text-[#FF6B35] bg-[#FF6B35]/12 rounded-full px-2 py-0.5">✨ Up next</span>}
                                            </div>
                                            {g.dishes.map(renderDesktopCard)}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Daily · Always available */}
                            {groups.daily.length > 0 && (
                                <div className="mt-12">
                                    <h3 className="text-[24px] font-extrabold text-[#1A2D23] leading-none px-1 mb-5">⭐ Daily · Always available</h3>
                                    <div className="grid grid-cols-3 xl:grid-cols-4 gap-5">
                                        {groups.daily.map(renderDesktopCard)}
                                    </div>
                                </div>
                            )}

                            {/* Next-week CTA */}
                            <div className="mt-8 grid grid-cols-3 xl:grid-cols-4 gap-5">
                                {whatsappDesktop}
                            </div>

                            {/* Paused · Past dishes */}
                            {groups.retired.length > 0 && (
                                <div className="mt-12">
                                    <h3 className="text-[24px] font-extrabold text-[#1A2D23] leading-none px-1 mb-5">🕰 Past favourites · Back soon</h3>
                                    <div className="grid grid-cols-3 xl:grid-cols-4 gap-5">
                                        {groups.retired.map(renderDesktopCard)}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
            </div>
        </div>
    );
}
