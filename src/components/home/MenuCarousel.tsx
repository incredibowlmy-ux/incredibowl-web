"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { ShoppingBag, ChevronLeft, ChevronRight } from 'lucide-react';
import { weeklyMenu, MenuItem } from '@/data/weeklyMenu';
import { MenuDateInfo } from '@/lib/dateUtils';
import SkeletonBlock from '@/components/ui/SkeletonBlock';

interface MenuCarouselProps {
    menuDates: Record<number, MenuDateInfo>;
    onOpenAddOn: (dish: MenuItem) => void;
}

export default function MenuCarousel({ menuDates, onOpenAddOn }: MenuCarouselProps) {
    const [activeIdx, setActiveIdx] = useState(-1);
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const timer = setTimeout(() => { scrollToIndex(2); }, 800);
        return () => clearTimeout(timer);
    }, []);

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

            if (closestIdx !== activeIdx && closestIdx < weeklyMenu.length) {
                setActiveIdx(closestIdx);
            }
        };

        container.addEventListener('scroll', handleScrollEvent, { passive: true });
        return () => container.removeEventListener('scroll', handleScrollEvent);
    }, [activeIdx]);

    const scrollToIndex = (index: number) => {
        const container = scrollContainerRef.current;
        if (container && index >= 0 && index < weeklyMenu.length) {
            const menuItems = Array.from(container.children).filter(child =>
                child instanceof HTMLElement && child.classList.contains('menu-item')
            ) as HTMLElement[];

            if (menuItems[index]) {
                const item = menuItems[index];
                const scrollPos = item.offsetLeft - (container.offsetWidth / 2) + (item.offsetWidth / 2);
                container.scrollTo({ left: scrollPos, behavior: 'smooth' });
            }
        }
    };

    return (
        <div className="lg:col-span-12 mt-8" id="menu">
            <div className="flex items-center justify-between mb-6 px-2">
                <div>
                    <h2 className="text-2xl font-extrabold tracking-tight">每日精选 / Weekly Rotation</h2>
                    <p className="text-xs text-gray-400 font-medium mt-1">点击或滑动切换每日精选菜单</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => scrollToIndex(activeIdx - 1)}
                        disabled={activeIdx <= 0}
                        className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all duration-300 ${activeIdx <= 0 ? 'border-gray-100 text-gray-200 cursor-not-allowed bg-gray-50/50' : 'border-[#E3EADA] text-[#1A2D23] bg-white hover:bg-[#1A2D23] hover:text-white shadow-sm'}`}
                    >
                        <ChevronLeft size={22} />
                    </button>
                    <button
                        onClick={() => scrollToIndex(activeIdx + 1)}
                        disabled={activeIdx === weeklyMenu.length - 1}
                        className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all duration-300 ${activeIdx === weeklyMenu.length - 1 ? 'border-gray-100 text-gray-200 cursor-not-allowed bg-gray-50/50' : 'border-[#E3EADA] text-[#1A2D23] bg-white hover:bg-[#1A2D23] hover:text-white shadow-sm'}`}
                    >
                        <ChevronRight size={22} />
                    </button>
                </div>
            </div>

            <div
                ref={scrollContainerRef}
                className="flex overflow-x-auto pb-8 pt-4 no-scrollbar snap-x snap-mandatory scroll-smooth relative menu-carousel-padding"
            >
                {Object.keys(menuDates).length === 0 && weeklyMenu.map((dish) => (
                    <div key={dish.id} className="menu-item w-[300px] md:w-[360px] snap-center shrink-0 rounded-[32px] p-6 mx-2 bg-white border border-gray-100">
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
                ))}
                {Object.keys(menuDates).length > 0 && weeklyMenu.map((dish, i) => (

                    <div
                        key={dish.id}
                        className={`menu-item w-[300px] md:w-[360px] snap-center shrink-0 rounded-[32px] p-6 transition-all duration-300 mx-2 ${activeIdx === i ? 'bg-[#1A2D23] text-white shadow-2xl scale-100 transform -translate-y-2' : 'bg-white text-[#1A2D23] border border-gray-100 scale-95 opacity-80 hover:opacity-100 cursor-pointer'}`}
                        onClick={() => scrollToIndex(i)}
                    >
                        <div className="flex justify-between items-start mb-6">
                            <div className={`px-3 py-1 rounded-lg text-xs font-bold ${activeIdx === i ? 'bg-white/10 text-white' : 'bg-[#FDFBF7] text-gray-500'}`}>
                                {menuDates[dish.id] ? menuDates[dish.id].topTag : dish.day}
                            </div>
                            <div className="flex flex-col items-end">
                                <p className={`font-extrabold text-xl leading-none ${activeIdx === i ? 'text-white' : 'text-[#FF6B35]'}`}>RM {(dish.price - 1).toFixed(2)}</p>
                            </div>
                        </div>

                        <div className="aspect-square w-full rounded-2xl bg-[#FDFBF7] flex items-center justify-center text-7xl mb-6 relative overflow-hidden border-4 border-transparent">
                            {dish.image.startsWith('/') ? <Image src={dish.image} alt={dish.name} fill className="object-cover" /> : dish.image}
                            
                            {/* Promo Tag */}
                            <div className="absolute top-3 left-3 bg-[#FF6B35] text-white text-[10px] sm:text-xs font-black px-2.5 py-1.5 rounded-br-xl rounded-tl-xl rounded-tr-sm rounded-bl-sm shadow-lg flex items-center gap-1.5 z-10">
                                <span className="text-sm">🎁</span> <span>尝鲜立减 RM 1</span>
                            </div>
                        </div>

                        <h3 className="font-extrabold text-xl mb-1">{dish.name}</h3>
                        <h4 className={`text-sm font-medium mb-4 ${activeIdx === i ? 'text-white/60' : 'text-gray-400'}`}>{dish.nameEn}</h4>

                        <div className="flex flex-wrap gap-2 mb-6">
                            {dish.tags.map(tag => (
                                <span key={tag} className={`text-[10px] font-bold px-2 py-1 rounded-md ${activeIdx === i ? 'bg-[#FF6B35]/20 text-[#FF6B35]' : 'bg-[#E3EADA]/50 text-[#1A2D23]'}`}>
                                    {tag}
                                </span>
                            ))}
                        </div>

                        {activeIdx === i && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <p className="text-sm font-medium text-white/80 leading-relaxed mb-6 italic">"{dish.desc}"</p>
                                <div className="relative group/btn">
                                    {!menuDates[dish.id]?.disabled && (
                                        <div className="absolute -inset-0.5 bg-[#FF6B35] rounded-xl blur-md opacity-50 animate-breathe z-0"></div>
                                    )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onOpenAddOn(dish); }}
                                        disabled={menuDates[dish.id]?.disabled}
                                        className={`relative z-10 w-full py-4 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors text-sm ${menuDates[dish.id]?.disabled ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-[#FF6B35] hover:bg-[#E95D31] text-white shadow-lg shadow-[#FF6B35]/20'}`}
                                    >
                                        {!menuDates[dish.id]?.disabled && <ShoppingBag size={18} />}
                                        <span className="truncate">
                                            {menuDates[dish.id] 
                                                ? menuDates[dish.id].btnText.replace(`RM ${dish.price.toFixed(2)}`, `RM ${(dish.price - 1).toFixed(2)}`) 
                                                : '加入明天的预订'}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {/* Right Spacer */}
                <div className="min-w-[calc(50%-150px)] md:min-w-[calc(50%-180px)] shrink-0" />
            </div>
        </div>
    );
}
