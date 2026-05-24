"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { animate, useMotionValue } from 'framer-motion';
import { ShoppingBag, ChevronLeft, ChevronRight, Sparkles, Phone } from 'lucide-react';
import { weeklyMenu, MenuItem, dishImageAlt } from '@/data/weeklyMenu';
import { MenuDateInfo } from '@/lib/dateUtils';
import { computeNextSpecial } from '@/lib/nextSpecial';
import SkeletonBlock from '@/components/ui/SkeletonBlock';

interface MenuCarouselENProps {
    menuDates: Record<number, MenuDateInfo>;
    onOpenAddOn: (dish: MenuItem) => void;
}

/** Translate the Chinese topTag (e.g., "今日特餐", "明日特餐", "周一", "常驻") into English. */
function translateTopTag(tag: string): string {
    const map: Record<string, string> = {
        '今日特餐': "Today's special",
        '明日特餐': "Tomorrow's special",
        '后日特餐': 'Day-after special',
        '已截单': 'Closed',
        '常驻': 'Daily',
        '周一': 'Mon',
        '周二': 'Tue',
        '周三': 'Wed',
        '周四': 'Thu',
        '周五': 'Fri',
        '周六': 'Sat',
        '周日': 'Sun',
    };
    return map[tag] ?? tag;
}

/** Translate the order button text. */
function translateBtnText(btnText: string, dish: MenuItem): string {
    const cleaned = btnText.replace(` · RM ${dish.price.toFixed(2)}`, '');
    const map: Record<string, string> = {
        '加入今日预订': "Add to today's order",
        '加入明天的预订': "Add to tomorrow's order",
        '加入后日预订': 'Add to day-after order',
        '已截单': 'Closed for orders',
    };
    return map[cleaned] ?? cleaned;
}

export default function MenuCarouselEN({ menuDates, onOpenAddOn }: MenuCarouselENProps) {
    const [activeIdx, setActiveIdx] = useState(-1);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const dragStartX = useRef(0);
    const dragStartScroll = useRef(0);
    const isDragging = useRef(false);
    const dragVelocity = useMotionValue(0);
    const lastMoveTime = useRef(0);
    const lastMoveX = useRef(0);

    // Reorder: [tomorrow's special, ...other orderable, ...cutoff-disabled].
    const sortedMenu = useMemo(() => {
        if (!Object.keys(menuDates).length) return weeklyMenu;
        const tomorrowsId = computeNextSpecial().dish.id;
        const tomorrows = weeklyMenu.filter(d => d.id === tomorrowsId);
        const others = weeklyMenu.filter(d => d.id !== tomorrowsId && !menuDates[d.id]?.disabled);
        const disabled = weeklyMenu.filter(d => menuDates[d.id]?.disabled);
        return [...tomorrows, ...others, ...disabled];
    }, [menuDates]);

    const scrollToIndex = (index: number) => {
        const container = scrollContainerRef.current;
        if (!container || index < 0 || index >= sortedMenu.length) return;

        const menuItems = Array.from(container.children).filter(child =>
            child instanceof HTMLElement && child.classList.contains('menu-item')
        ) as HTMLElement[];

        if (!menuItems[index]) return;
        const item = menuItems[index];
        const target = item.offsetLeft - (container.offsetWidth / 2) + (item.offsetWidth / 2);

        const reduceMotion = typeof window !== 'undefined' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (reduceMotion) {
            container.scrollLeft = target;
            return;
        }

        animate(container.scrollLeft, target, {
            type: 'spring',
            stiffness: 240,
            damping: 30,
            mass: 0.9,
            onUpdate: (v) => { container.scrollLeft = v; },
        });
    };

    useEffect(() => {
        const timer = setTimeout(() => { scrollToIndex(0); }, 800);
        return () => clearTimeout(timer);
    }, [sortedMenu]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const handleScrollEvent = () => {
            const container = scrollContainerRef.current;
            if (!container) return;

            const menuItems = Array.from(container.children).filter(child =>
                child instanceof HTMLElement && child.classList.contains('menu-item')
            ) as HTMLElement[];

            if (menuItems.length === 0) return;

            const containerCenter = container.scrollLeft + container.offsetWidth / 2;
            let closestIdx = 0;
            let minDistance = Infinity;

            menuItems.forEach((item, idx) => {
                const itemCenter = item.offsetLeft + item.offsetWidth / 2;
                const distance = Math.abs(containerCenter - itemCenter);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestIdx = idx;
                }
            });

            if (closestIdx !== activeIdx && closestIdx < sortedMenu.length) {
                setActiveIdx(closestIdx);
            }
        };

        container.addEventListener('scroll', handleScrollEvent, { passive: true });
        return () => container.removeEventListener('scroll', handleScrollEvent);
    }, [activeIdx]);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType !== 'mouse') return;
        const container = scrollContainerRef.current;
        if (!container) return;
        isDragging.current = true;
        dragStartX.current = e.clientX;
        dragStartScroll.current = container.scrollLeft;
        lastMoveTime.current = performance.now();
        lastMoveX.current = e.clientX;
        dragVelocity.set(0);
        container.setPointerCapture(e.pointerId);
        container.style.cursor = 'grabbing';
        container.style.scrollSnapType = 'none';
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging.current) return;
        const container = scrollContainerRef.current;
        if (!container) return;
        const dx = e.clientX - dragStartX.current;
        container.scrollLeft = dragStartScroll.current - dx;
        const now = performance.now();
        const dt = now - lastMoveTime.current;
        if (dt > 0) {
            dragVelocity.set((e.clientX - lastMoveX.current) / dt * 1000);
        }
        lastMoveTime.current = now;
        lastMoveX.current = e.clientX;
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging.current) return;
        const container = scrollContainerRef.current;
        if (!container) return;
        isDragging.current = false;
        container.releasePointerCapture(e.pointerId);
        container.style.cursor = '';
        container.style.scrollSnapType = '';

        const v = dragVelocity.get();
        const flingThreshold = 350;
        let nextIdx = activeIdx;
        if (v < -flingThreshold) nextIdx = Math.min(sortedMenu.length - 1, activeIdx + 1);
        else if (v > flingThreshold) nextIdx = Math.max(0, activeIdx - 1);

        if (nextIdx !== activeIdx && nextIdx >= 0 && nextIdx < sortedMenu.length) {
            scrollToIndex(nextIdx);
        } else {
            scrollToIndex(activeIdx);
        }
    };

    return (
        <div className="lg:col-span-12 mt-8" id="menu">
            <div className="flex items-center justify-between mb-6 px-4 md:px-2">
                <div>
                    <h2 className="text-[22px] lg:text-[40px] font-extrabold tracking-tight leading-tight">Daily Picks · Weekly Rotation</h2>
                    <p className="text-xs text-gray-500 font-medium mt-1.5 leading-relaxed">
                        <span className="md:hidden">Swipe to explore — a different bowl every day.</span>
                        <span className="hidden md:inline lg:hidden">Tap the arrows to browse our daily picks.</span>
                        <span className="hidden lg:inline">{weeklyMenu.length} dishes this week — tap a card to view details and add to order.</span>
                    </p>
                </div>
            </div>

            {/* Mobile + Tablet carousel */}
            <div className="lg:hidden relative group">
                <button
                    onClick={() => scrollToIndex(activeIdx - 1)}
                    disabled={activeIdx <= 0}
                    aria-label="Previous dish"
                    className={`hidden md:flex absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 z-20 w-14 h-14 rounded-full items-center justify-center border border-gray-100 transition-[transform,background-color,color,box-shadow,opacity] duration-200 ease-out shadow-[0_8px_30px_rgb(0,0,0,0.12)] ${
                        activeIdx <= 0
                            ? 'bg-white/50 text-gray-300 cursor-not-allowed backdrop-blur-sm opacity-0'
                            : 'bg-white text-[#1A2D23] hover:bg-[#1A2D23] hover:text-white hover:scale-110 hover:shadow-2xl'
                    }`}
                >
                    <ChevronLeft size={28} />
                </button>

                <button
                    onClick={() => scrollToIndex(activeIdx + 1)}
                    disabled={activeIdx === sortedMenu.length - 1}
                    aria-label="Next dish"
                    className={`hidden md:flex absolute right-4 lg:right-8 top-1/2 -translate-y-1/2 z-20 w-14 h-14 rounded-full items-center justify-center border border-gray-100 transition-[transform,background-color,color,box-shadow,opacity] duration-200 ease-out shadow-[0_8px_30px_rgb(0,0,0,0.12)] ${
                        activeIdx === sortedMenu.length - 1
                            ? 'bg-white/50 text-gray-300 cursor-not-allowed backdrop-blur-sm opacity-0'
                            : 'bg-white text-[#1A2D23] hover:bg-[#1A2D23] hover:text-white hover:scale-110 hover:shadow-2xl'
                    }`}
                >
                    <ChevronRight size={28} />
                </button>

                <div
                    ref={scrollContainerRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    className="flex overflow-x-auto pb-8 pt-4 no-scrollbar snap-x snap-mandatory scroll-smooth relative menu-carousel-padding cursor-grab"
                >
                    {Object.keys(menuDates).length === 0 && <>
                        <div className="min-w-[calc(50%-138px)] md:min-w-[calc(50%-180px)] shrink-0" />
                        {weeklyMenu.map((dish) => (
                            <div key={dish.id} className="menu-item w-[276px] md:w-[360px] snap-center shrink-0 rounded-[32px] p-6 mx-2 bg-white border border-gray-100">
                                <div className="flex justify-between items-start mb-6">
                                    <SkeletonBlock className="h-5 w-28" />
                                    <SkeletonBlock className="h-5 w-16" />
                                </div>
                                <SkeletonBlock className="aspect-square w-full rounded-2xl mb-6" />
                                <SkeletonBlock className="h-6 w-3/4 mb-2" />
                                <SkeletonBlock className="h-4 w-1/2 mb-6" />
                                <div className="flex gap-2 mb-6">
                                    <SkeletonBlock className="h-6 w-16" />
                                    <SkeletonBlock className="h-6 w-16" />
                                </div>
                            </div>
                        ))}</>}
                    {Object.keys(menuDates).length > 0 && <>
                        <div className="min-w-[calc(50%-138px)] md:min-w-[calc(50%-180px)] shrink-0" />
                        {sortedMenu.map((dish, i) => (
                            <div
                                key={dish.id}
                                className={`menu-item w-[276px] md:w-[360px] snap-center shrink-0 rounded-[32px] p-6 transition-[transform,background-color,color,box-shadow,opacity] duration-400 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] mx-2 ${menuDates[dish.id]?.disabled ? 'bg-gray-50 text-gray-400 border border-gray-100 scale-90 opacity-50' : activeIdx === i ? 'bg-[#1A2D23] text-white shadow-2xl scale-100 transform -translate-y-2' : 'bg-white text-[#1A2D23] border border-gray-100 scale-95 opacity-80 hover:opacity-100 cursor-pointer'}`}
                                onClick={() => scrollToIndex(i)}
                            >
                                <div className="flex justify-between items-start mb-6">
                                    <div className={`px-3 py-1 rounded-lg text-xs font-bold ${activeIdx === i ? 'bg-white/10 text-white' : 'bg-[#FDFBF7] text-gray-500'}`}>
                                        {menuDates[dish.id] ? translateTopTag(menuDates[dish.id].topTag) : dish.day}
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <p className={`font-extrabold text-[20px] leading-none ${activeIdx === i ? 'text-white' : 'text-[#FF6B35]'}`}>RM {dish.price.toFixed(2)}</p>
                                    </div>
                                </div>

                                <div className={`aspect-square w-full rounded-2xl bg-[#FDFBF7] flex items-center justify-center text-7xl mb-6 relative overflow-hidden border-4 border-transparent ${menuDates[dish.id]?.disabled ? 'grayscale' : ''}`}>
                                    {dish.image.startsWith('/') ? <Image src={dish.image} alt={dishImageAlt(dish, 'en')} fill className="object-cover" sizes="(max-width: 768px) 276px, 360px" /> : dish.image}
                                </div>

                                <h3 className="font-extrabold text-[22px] leading-tight mb-1">{dish.nameEn}</h3>
                                <h4 lang="zh" className={`text-sm font-medium mb-4 leading-relaxed ${activeIdx === i ? 'text-white/60' : 'text-gray-400'}`}>{dish.name}</h4>

                                <div className="flex flex-wrap gap-2 mb-6">
                                    {(dish.tagsEn ?? dish.tags).map(tag => (
                                        <span key={tag} className={`text-[13px] font-bold px-2.5 py-1 rounded-md ${activeIdx === i ? 'bg-[#FF6B35]/20 text-[#FF6B35]' : 'bg-[#E3EADA]/70 text-[#1A2D23]'}`}>
                                            {tag}
                                        </span>
                                    ))}
                                </div>

                                {activeIdx === i && (
                                    <p className="animate-in fade-in slide-in-from-bottom-4 duration-300 text-sm font-medium text-white/80 leading-relaxed mb-6 italic">&ldquo;{dish.descEn ?? dish.desc}&rdquo;</p>
                                )}

                                <div className="relative group/btn">
                                    {activeIdx === i && !menuDates[dish.id]?.disabled && (
                                        <div className="absolute -inset-0.5 bg-[#FF6B35] rounded-xl blur-md opacity-50 animate-breathe z-0"></div>
                                    )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onOpenAddOn(dish); }}
                                        disabled={menuDates[dish.id]?.disabled}
                                        className={`relative z-10 w-full py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 transition-[background-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.97] active:brightness-95 md:text-sm text-xs ${
                                            menuDates[dish.id]?.disabled
                                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                                : activeIdx === i
                                                    ? 'bg-[#FF6B35] hover:bg-[#E95D31] text-white shadow-lg shadow-[#FF6B35]/20'
                                                    : 'bg-[#FF6B35]/10 text-[#FF6B35] hover:bg-[#FF6B35] hover:text-white'
                                        }`}
                                    >
                                        {!menuDates[dish.id]?.disabled && <ShoppingBag size={16} />}
                                        <span className="truncate">
                                            {menuDates[dish.id]
                                                ? translateBtnText(menuDates[dish.id].btnText, dish)
                                                : "Add to tomorrow's order"}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        ))}
                        <div className="min-w-[calc(50%-138px)] md:min-w-[calc(50%-180px)] shrink-0" />
                    </>}
                </div>
            </div>

            {/* Desktop grid */}
            <div className="hidden lg:grid lg:grid-cols-3 xl:grid-cols-4 gap-5 px-2 pt-4">
                {Object.keys(menuDates).length === 0
                    ? weeklyMenu.map((dish) => (
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
                    ))
                    : sortedMenu.map((dish) => {
                        const dInfo = menuDates[dish.id];
                        const isDisabled = !!dInfo?.disabled;
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
                                        {dInfo ? translateTopTag(dInfo.topTag) : dish.day}
                                    </div>
                                    <p className="font-extrabold text-[20px] leading-none text-[#FF6B35]">
                                        RM {dish.price.toFixed(2)}
                                    </p>
                                </div>

                                <div className={`aspect-square w-full rounded-2xl bg-[#FDFBF7] flex items-center justify-center text-6xl mb-4 relative overflow-hidden ${isDisabled ? 'grayscale' : ''}`}>
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
                                            {dInfo ? translateBtnText(dInfo.btnText, dish) : "Add to tomorrow's order"}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                {Object.keys(menuDates).length > 0 && (
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
                )}
            </div>
        </div>
    );
}
