"use client";

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag, Sparkles, Phone, Ticket } from 'lucide-react';
import { weeklyMenu, MenuItem, dishImageAlt } from '@/data/weeklyMenu';
import { MenuDateInfo } from '@/lib/dateUtils';
import { computeNextSpecial } from '@/lib/nextSpecial';
import SoldOutNotice from '@/components/home/SoldOutNotice';
import type { Locale } from '@/lib/locale';
import { HOME_DICT } from './dict';

interface MenuCarouselProps {
    locale: Locale;
    menuDates: Record<number, MenuDateInfo>;
    onOpenAddOn: (dish: MenuItem) => void;
    /** dishId(string) → remaining stock for limited dishes; absent = unlimited. */
    dishStock?: Record<string, number>;
}

export default function MenuCarousel({ locale, menuDates, onOpenAddOn, dishStock = {} }: MenuCarouselProps) {
    const t = HOME_DICT[locale].menuCarousel;
    const WD_LABEL = t.wdLabel;
    // `ready` === the date layer has landed (page.tsx / en/page.tsx computes it in an effect).
    // It gates ONLY date-derived values — never the cards themselves.
    const ready = Object.keys(menuDates).length > 0;
    // Desktop-only: retired dishes collapsed by default so new visitors aren't
    // greeted by a wall of unorderable grey cards. Mobile keeps them expanded.
    const [showRetired, setShowRetired] = useState(false);

    // Date-dependent → stays behind `ready`. Computing this during render would
    // bake the build-day special into the statically prerendered HTML.
    const tomorrowsId = useMemo(() => (ready ? computeNextSpecial().dish.id : null), [ready]);

    // Group into the weekly-rotation story: Mon→Fri specials (one band per day),
    // then always-available 常驻, then retired/paused at the very bottom.
    //
    // 2026-08-01: un-gated from `ready` so the cards land in the prerendered HTML
    // (was a flat skeleton → menu only appeared after ~414KB of JS parsed, and
    // crawlers saw zero dish names). This is safe because the grouping reads ONLY
    // weeklyMenu, which is a build-time constant — zero date dependency. Every
    // date-derived field (topTag / btnText / disabled / dayDateSub / tomorrowsId)
    // still comes from `menuDates` and renders its static fallback until the
    // client effect lands, so server HTML === first client render.
    const groups = useMemo(() => {
        const active = weeklyMenu.filter(d => !d.retired && !d.hidden);
        // featureOnAvailableDays 常驻菜（如绍兴酒蒸花肉 周一+周四）改进每个
        // 供应日的列里展示，不占常驻区；排它日的特餐后面，日期头仍取特餐。
        const featured = (d: MenuItem) => d.weekday == null && !!d.featureOnAvailableDays && !!d.availableWeekdays?.length;
        const daily = active.filter(d => d.weekday == null && !featured(d));
        const days = [1, 2, 3, 4, 5]
            .map(wd => ({
                wd,
                dishes: [
                    ...active
                        .filter(d => d.weekday === wd)
                        .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0)),
                    ...active.filter(d => featured(d) && d.availableWeekdays!.includes(wd)),
                ],
            }))
            .filter(g => g.dishes.length > 0);
        const retired = weeklyMenu.filter(d => d.retired);
        return { daily, days, retired };
    }, []);

    // ── Section header (spans the full row in both grids) ──
    const sectionHeader = (key: string, title: string, dateSub: string | null, highlight: boolean, size: 'sm' | 'lg', badgeNum?: number) => (
        <div
            key={key}
            className={`${size === 'sm' ? 'col-span-2 mt-3 first:mt-1 px-1' : 'col-span-full mt-5 first:mt-0 px-1'} flex items-center gap-2`}
        >
            {badgeNum != null && (
                <span className={`inline-flex items-center justify-center rounded-full font-black shrink-0 ${size === 'sm' ? 'w-5 h-5 text-[11px]' : 'w-6 h-6 text-[13px]'} ${highlight ? 'bg-[#FF6B35] text-white' : 'bg-[#E3EADA] text-[#1A2D23]'}`}>
                    {badgeNum}
                </span>
            )}
            <h3 className={`font-extrabold leading-none ${size === 'sm' ? 'text-[16px]' : 'text-[24px]'} ${highlight ? 'text-[#FF6B35]' : 'text-[#1A2D23]'}`}>
                {title}
            </h3>
            {dateSub && <span className={`font-bold text-gray-400 ${size === 'sm' ? 'text-[11px]' : 'text-[14px]'}`}>{dateSub}</span>}
            {highlight && (
                <span className={`ml-auto inline-flex items-center gap-1 font-black text-[#FF6B35] bg-[#FF6B35]/12 rounded-full ${size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-[12px] px-2.5 py-1'}`}>
                    {t.upNext}
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
        // ⚠️ Interaction guard is the INVERSE of the visual one: no date info =
        // no open. Cards now ship in the prerendered HTML, so between hydration
        // and the menuDates effect there is a frame where dInfo is undefined —
        // opening the modal there would hand it an empty defaultDate/minDate and
        // put a `selectedDate: ""` bundle in the cart (server rejects it as
        // invalid_format), and would also let a retired dish through (retired is
        // carried by menuDates, not by the card). Default closed, unlock on data.
        const canOpen = !!dInfo && !isDisabled;
        const isTomorrow = dish.id === tomorrowsId && !isDisabled;
        return (
            <div
                key={dish.id}
                onClick={() => canOpen && onOpenAddOn(dish)}
                className={`bg-white rounded-2xl p-3 border flex flex-col transition-[transform,box-shadow,border-color,opacity] duration-200 ease-out ${
                    isDisabled
                        ? 'opacity-50 border-gray-100 cursor-not-allowed'
                        : isTomorrow
                            ? 'border-[#FF6B35]/40 shadow-md shadow-[#FF6B35]/15 cursor-pointer active:scale-[0.98]'
                            : 'border-gray-100 cursor-pointer active:scale-[0.98]'
                }`}
            >
                <div className="flex justify-between items-start mb-2 gap-1">
                    <div className={`px-1.5 py-0.5 rounded text-[11px] font-bold truncate ${
                        isTomorrow
                            ? 'bg-[#FF6B35]/15 text-[#FF6B35]'
                            : 'bg-[#FDFBF7] text-gray-500'
                    }`}>
                        {isTomorrow ? t.tomorrowTag : (dInfo ? dInfo.topTag.split(' · ')[0] : dish.day)}
                    </div>
                    <p className="font-extrabold text-[13px] leading-none text-[#FF6B35] shrink-0">
                        RM{dish.price.toFixed(2)}
                    </p>
                </div>

                <div className={`aspect-square w-full rounded-xl bg-[#FDFBF7] mb-2 relative overflow-hidden ${isDisabled ? 'grayscale' : ''}`}>
                    {isLimited && stockLeft <= 10 && (
                        <span className={`absolute top-1.5 left-1.5 z-10 px-2 py-1 rounded-md text-[12px] font-extrabold shadow-md ${isSoldOut ? 'bg-gray-800/90 text-white' : 'bg-[#FF6B35] text-white'}`}>
                            {isSoldOut ? t.soldOut : t.stockLeft(stockLeft)}
                        </span>
                    )}
                    {dish.image.startsWith('/') ? (
                        <Image
                            src={dish.image}
                            alt={dishImageAlt(dish, locale)}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 25vw"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-5xl">{dish.image}</div>
                    )}
                </div>

                <h4 className="font-extrabold text-[14px] leading-tight mb-1.5 text-[#1A2D23] line-clamp-2 min-h-[34px]">
                    {locale === 'en' ? dish.nameEn : dish.name}
                </h4>

                <div className="flex flex-wrap gap-1 mb-2.5 min-h-[18px] overflow-hidden max-h-[18px]">
                    {(locale === 'en' ? (dish.tagsEn ?? dish.tags) : dish.tags).slice(0, 2).map(tag => (
                        <span key={tag} className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-[#E3EADA]/70 text-[#1A2D23] truncate max-w-full">
                            {tag}
                        </span>
                    ))}
                </div>

                <div className="mt-auto">
                    <button
                        onClick={(e) => { e.stopPropagation(); if (canOpen) onOpenAddOn(dish); }}
                        disabled={isDisabled}
                        className={`w-full min-h-[40px] py-2.5 rounded-xl font-bold text-[13px] flex justify-center items-center gap-1 transition-colors ${
                            isDisabled
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : isTomorrow
                                    ? 'bg-[#FF6B35] hover:bg-[#E95D31] text-white shadow-sm shadow-[#FF6B35]/30'
                                    : 'bg-[#FF6B35]/10 text-[#FF6B35] hover:bg-[#FF6B35] hover:text-white'
                        }`}
                    >
                        {!isDisabled && <ShoppingBag size={12} />}
                        <span className="truncate">
                            {/* zh 会先取 dInfo.reasonShort（如「周日休息」），en 原来写死 'Closed'——按 locale 原样保留 */}
                            {isDisabled
                                ? (isSoldOut ? t.soldOut : (locale === 'en' ? t.closed : (dInfo?.reasonShort ?? t.closed)))
                                : isTomorrow
                                    ? t.orderTomorrow
                                    : t.addToOrder}
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
        // Past today's cutoff (bookable again next week) reads differently from
        // sold-out/retired: keep the photo in colour, just dim the card, so the
        // column doesn't look like the dish is gone for good.
        const isCutoffOnly = !!dInfo?.disabled && !isSoldOut && !dish.retired;
        // See renderMobileCard: interaction requires dInfo, visuals don't.
        const canOpen = !!dInfo && !isDisabled;
        return (
            <div
                key={dish.id}
                onClick={() => canOpen && onOpenAddOn(dish)}
                className={`group bg-white rounded-3xl p-5 border border-gray-100 transition-[transform,box-shadow,border-color,opacity] duration-300 ease-out flex flex-col ${
                    isDisabled
                        ? `${isCutoffOnly ? 'opacity-75' : 'opacity-50'} cursor-not-allowed`
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

                <div className={`aspect-square w-full rounded-2xl bg-[#FDFBF7] flex items-center justify-center text-6xl mb-4 relative overflow-hidden ${isDisabled && !isCutoffOnly ? 'grayscale' : ''}`}>
                    {isCutoffOnly && !(isLimited && stockLeft <= 10) && (
                        <span className="absolute top-2.5 left-2.5 z-10 px-2.5 py-1 rounded-md text-[13px] font-medium shadow-md bg-white/90 text-[#1A2D23]/70">
                            {t.closedToday}
                        </span>
                    )}
                    {isLimited && stockLeft <= 10 && (
                        <span className={`absolute top-2.5 left-2.5 z-10 px-2.5 py-1 rounded-md text-[14px] font-extrabold shadow-md ${isSoldOut ? 'bg-gray-800/90 text-white' : 'bg-[#FF6B35] text-white'}`}>
                            {isSoldOut ? t.soldOut : t.stockLeft(stockLeft)}
                        </span>
                    )}
                    {dish.image.startsWith('/') ? (
                        <Image
                            src={dish.image}
                            alt={dishImageAlt(dish, locale)}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                            sizes="(min-width: 1280px) 25vw, 33vw"
                        />
                    ) : (
                        dish.image
                    )}
                </div>

                {/* 名称/英文名/标签固定高度 —— 5 列日历里每张卡等高，行与行对齐不参差
                    (fixed-height name/subtitle/tags — equal card heights so the 5-day calendar rows align).
                    zh 是 <h4>中文名</h4><p>英文名</p>；en 历史上是 <h3>英文名</h3><h4 lang="zh">中文名</h4>——按 locale 原样保留。 */}
                {locale === 'en' ? (
                    <>
                        <h3 className="font-extrabold text-[22px] leading-tight mb-1 text-[#1A2D23] line-clamp-2 min-h-[56px]">{dish.nameEn}</h3>
                        <h4 lang="zh" className="text-[15px] font-medium mb-3 leading-relaxed text-gray-400 line-clamp-2 min-h-[49px]">{dish.name}</h4>
                    </>
                ) : (
                    <>
                        <h4 className="font-extrabold text-[22px] leading-tight mb-1 text-[#1A2D23] line-clamp-2 min-h-[56px]">{dish.name}</h4>
                        <p className="text-[15px] font-medium mb-3 leading-relaxed text-gray-400 line-clamp-2 min-h-[49px]">{dish.nameEn}</p>
                    </>
                )}

                <div className="flex flex-wrap gap-1.5 mb-5 content-start min-h-[62px] max-h-[62px] overflow-hidden">
                    {(locale === 'en' ? (dish.tagsEn ?? dish.tags) : dish.tags).map(tag => (
                        <span key={tag} className="text-[13px] font-bold px-2.5 py-1 rounded-md bg-[#E3EADA]/70 text-[#1A2D23]">
                            {tag}
                        </span>
                    ))}
                </div>

                <div className="mt-auto">
                    <button
                        onClick={(e) => { e.stopPropagation(); if (canOpen) onOpenAddOn(dish); }}
                        disabled={isDisabled}
                        className={`w-full py-3.5 rounded-xl font-bold text-[15px] flex justify-center items-center gap-2 transition-colors ${
                            isDisabled
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                : 'bg-[#FF6B35] hover:bg-[#E95D31] text-white shadow-md shadow-[#FF6B35]/20'
                        }`}
                    >
                        {!isDisabled && <ShoppingBag size={18} />}
                        <span className="truncate">
                            {/* Fallback is the date-neutral wording: it is what the
                                prerendered HTML ships before menuDates lands.
                                zh 会把 btnText 尾巴的 ` · RM xx.xx` 剥掉，en 原来直接用 btnText——按 locale 原样保留。 */}
                            {isSoldOut ? t.soldOut : (dInfo ? (locale === 'en' ? dInfo.btnText : dInfo.btnText.replace(` · RM ${dish.price.toFixed(2)}`, '')) : t.addToOrder)}
                        </span>
                    </button>
                </div>
            </div>
        );
    };

    // Date sub-label for a day band, derived from that day's first dish's topTag
    // (zh special topTag = "6月30日 周一 · Mon" → "6月30日"; en topTag = "Jun 30 · Mon" → "Jun 30").
    const dayDateSub = (dish: MenuItem) => menuDates[dish.id]?.topTag?.split(t.dayDateSubSep)[0] ?? null;

    const whatsappMobile = (
        <a
            href={t.whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="col-span-2 mt-1 group bg-gradient-to-br from-[#FFF3E0] to-[#FFE5C9]/70 rounded-2xl p-4 border-2 border-[#FF6B35]/30 shadow-sm shadow-[#FF6B35]/10 flex items-center gap-3 transition-[transform,box-shadow] duration-200 active:scale-[0.99] relative overflow-hidden"
        >
            <div className="w-12 h-12 bg-[#FF6B35]/20 rounded-full flex items-center justify-center shrink-0 shadow-sm shadow-[#FF6B35]/20">
                <Sparkles size={20} className="text-[#FF6B35]" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-[#FF6B35] uppercase tracking-widest mb-0.5">{t.nextWeekEyebrow}</p>
                <p className="text-[14px] font-extrabold text-[#1A2D23] leading-tight">{t.nextWeekQuestion}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#25D366] text-white rounded-full text-[12px] font-black shadow-sm shadow-[#25D366]/30 shrink-0">
                <Phone size={12} strokeWidth={2.5} /> WhatsApp
            </span>
        </a>
    );

    const whatsappDesktop = (
        <a
            href={t.whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-gradient-to-br from-[#FFF3E0] to-[#FFE5C9]/70 rounded-3xl p-5 border-2 border-[#FF6B35]/30 shadow-md shadow-[#FF6B35]/10 hover:shadow-xl hover:shadow-[#FF6B35]/20 hover:-translate-y-1 hover:border-[#FF6B35]/60 flex flex-col text-center transition-[transform,box-shadow,border-color] duration-300 ease-out cursor-pointer min-h-[420px] relative overflow-hidden"
        >
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#FF6B35] rounded-full blur-3xl opacity-15 pointer-events-none" />

            <div className="relative flex-1 flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-[#FF6B35]/20 group-hover:bg-[#FF6B35]/30 rounded-full flex items-center justify-center mb-4 transition-colors shadow-md shadow-[#FF6B35]/20">
                    <Sparkles size={28} className="text-[#FF6B35]" strokeWidth={2.5} />
                </div>
                <p className="text-xs font-medium text-[#FF6B35] uppercase tracking-widest mb-2">{t.nextWeekEyebrowDesktop}</p>
                <p className="text-[22px] font-extrabold text-[#1A2D23] leading-tight mb-3">Coming<br />Next Week</p>
                <p className="text-sm font-medium text-[#1A2D23]/70 leading-relaxed max-w-[220px]">
                    {t.nextWeekLine1}<br />
                    <span className="text-[#1A2D23] font-bold">{t.nextWeekLine2}</span>
                </p>
            </div>

            <span className="relative self-center inline-flex items-center gap-2 px-6 py-3.5 bg-[#25D366] group-hover:bg-[#20BE5A] text-white rounded-full text-[15px] font-black shadow-lg shadow-[#25D366]/30 group-hover:shadow-[#25D366]/40 transition-[background-color,box-shadow] duration-150 ease-out">
                <Phone size={15} strokeWidth={2.5} />{t.notifyMe}
            </span>
        </a>
    );

    return (
        <div className="lg:col-span-12 mt-8" id="menu">
            <div className="flex items-center justify-between mb-6 px-4 md:px-2">
                <div>
                    <h2 className="text-[22px] lg:text-[40px] font-extrabold tracking-tight leading-tight">{t.heading}</h2>
                    <p className="text-xs text-gray-500 font-medium mt-1.5 leading-relaxed">
                        <span className="lg:hidden">{t.subMobile}</span>
                        <span className="hidden lg:inline">{t.subDesktop}</span>
                    </p>
                </div>
            </div>

            <SoldOutNotice locale={locale} />

            {/* MOBILE + TABLET — compact 2-column grid, grouped by weekday */}
            <div className="lg:hidden grid grid-cols-2 gap-3 px-3 pt-2">
                {groups.days.map(g => {
                    const isNext = g.dishes.some(d => d.id === tomorrowsId);
                    return (
                        <React.Fragment key={`m-day-${g.wd}`}>
                            {sectionHeader(`m-hdr-${g.wd}`, WD_LABEL[g.wd], dayDateSub(g.dishes[0]), isNext, 'sm', g.wd)}
                            {g.dishes.map(renderMobileCard)}
                        </React.Fragment>
                    );
                })}

                {groups.daily.length > 0 && (
                    <>
                        {sectionHeader('m-hdr-daily', t.dailyHeading, null, false, 'sm')}
                        {groups.daily.map(renderMobileCard)}
                    </>
                )}

                {whatsappMobile}

                {groups.retired.length > 0 && (
                    <>
                        {/* 2026-09-05：移动端原来把 9 张 50% 灰度的暂别卡**全量渲染**在菜单底部
                            （桌面端早就折起来了）。改成和桌面共用同一个 showRetired 开关。 */}
                        <div className="col-span-2 mt-4">
                            <button
                                type="button"
                                onClick={() => setShowRetired(v => !v)}
                                aria-expanded={showRetired}
                                className="w-full min-h-[44px] flex items-center gap-2 px-3 py-2.5 bg-white/70 border border-gray-200 rounded-xl"
                            >
                                <span className="text-[15px] font-extrabold text-[#1A2D23] leading-none">{t.retiredTitle}</span>
                                <span className="text-[12px] font-bold text-gray-400">{t.retiredCountBefore}{groups.retired.length}{t.retiredCountAfter}</span>
                                <span className="ml-auto text-[12px] font-bold text-[#FF6B35]">{showRetired ? t.collapse : t.expand}</span>
                            </button>
                        </div>
                        {showRetired && groups.retired.map(renderMobileCard)}
                    </>
                )}
            </div>

            {/* DESKTOP — weekly rotation calendar (lg+): Mon→Fri as 5 day-columns,
                then always-available 常驻 + 暂别 as their own filled grids. */}
            <div className="hidden lg:block px-2 pt-4">
                {/* 本周特餐 · 一周日历（5 列对齐填满宽度，无网格留白） */}
                <div className="grid grid-cols-5 gap-4">
                    {groups.days.map(g => {
                        const isNext = g.dishes.some(d => d.id === tomorrowsId);
                        return (
                            <div key={`d-day-${g.wd}`} className="flex flex-col gap-4">
                                <div className={`flex flex-col items-center text-center pb-2 border-b-2 ${isNext ? 'border-[#FF6B35]' : 'border-gray-100'}`}>
                                    <span className="flex items-center gap-2">
                                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[14px] font-black ${isNext ? 'bg-[#FF6B35] text-white' : 'bg-[#E3EADA] text-[#1A2D23]'}`}>{g.wd}</span>
                                        <span className={`text-[22px] font-extrabold leading-none ${isNext ? 'text-[#FF6B35]' : 'text-[#1A2D23]'}`}>{WD_LABEL[g.wd]}</span>
                                    </span>
                                    {/* min-h 预留：日期小字来自 menuDates，SSR 时为空。没有它，
                                        日期落地那一刻 5 个列头同时长高，把整片卡片往下推（CLS）。 */}
                                    <span className="text-[13px] font-bold text-gray-500 mt-1.5 min-h-[16px]">{dayDateSub(g.dishes[0])}</span>
                                    {/* 非下一餐用 invisible 占位 —— 5 个列头等高，第一行卡片顶对齐 */}
                                    <span className={`mt-1.5 text-[11px] font-black text-[#FF6B35] bg-[#FF6B35]/12 rounded-full px-2 py-0.5 ${isNext ? '' : 'invisible'}`}>{t.upNext}</span>
                                </div>
                                {g.dishes.map(renderDesktopCard)}
                            </div>
                        );
                    })}
                </div>

                {/* 常驻 · 天天都有 — 下周预告 CTA 与常驻卡同行，填满一整行不留白 */}
                {groups.daily.length > 0 ? (
                    <div className="mt-12">
                        <h3 className="text-[24px] font-extrabold text-[#1A2D23] leading-none px-1 mb-5">{t.dailyHeading}</h3>
                        <div className="grid grid-cols-3 gap-5">
                            {groups.daily.map(renderDesktopCard)}
                            {whatsappDesktop}
                        </div>
                    </div>
                ) : (
                    <div className="mt-8 grid grid-cols-3 gap-5">
                        {whatsappDesktop}
                    </div>
                )}

                {/* 暂别 · 往期菜式 — 默认折叠，点击展开（对新客是噪音，老客有回归期待感） */}
                {groups.retired.length > 0 && (
                    <div className="mt-12">
                        <button
                            type="button"
                            onClick={() => setShowRetired(v => !v)}
                            className="w-full flex items-center gap-3 px-5 py-4 bg-white/70 hover:bg-white border border-gray-200 hover:border-[#FF6B35]/30 rounded-2xl transition-colors text-left"
                            aria-expanded={showRetired}
                        >
                            <span className="text-[20px] font-extrabold text-[#1A2D23] leading-none">{t.retiredTitle}</span>
                            <span className="text-[14px] font-bold text-gray-400">{t.retiredCountBefore}{groups.retired.length}{t.retiredCountAfter}</span>
                            <span className="ml-auto text-[14px] font-bold text-[#FF6B35]">{showRetired ? t.collapse : t.expand}</span>
                        </button>
                        {showRetired && (
                            <div className="mt-5 grid grid-cols-3 xl:grid-cols-4 gap-5">
                                {groups.retired.map(renderDesktopCard)}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Meal voucher promo — full-width banner closing the menu section
                (outside both breakpoint grids so the day-band layout stays intact;
                static content, safe for SSR/prerender). */}
            <div className="mt-8 lg:mt-12 px-3 lg:px-2">
                <Link
                    href={locale === 'en' ? '/en/meal-vouchers' : '/meal-vouchers'}
                    className="group block bg-gradient-to-br from-[#FFF3E0] via-white to-[#FFE9D5] border border-[#FFD6B0]/60 rounded-2xl lg:rounded-3xl p-4 lg:p-6 hover:shadow-lg hover:border-[#FF6B35]/40 transition-[box-shadow,border-color] duration-200 relative overflow-hidden"
                >
                    <div className="absolute -top-8 -right-8 w-28 h-28 bg-[#FF6B35]/10 rounded-full blur-2xl pointer-events-none" />
                    <div className="relative flex items-center gap-3 lg:gap-5">
                        <div className="w-11 h-11 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-[#FF6B35] text-white flex items-center justify-center shrink-0 shadow-md shadow-[#FF6B35]/30">
                            <Ticket size={22} className="lg:hidden" />
                            <Ticket size={28} className="hidden lg:block" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[14px] lg:text-[18px] font-extrabold text-[#1A2D23] leading-tight">{t.voucherTitle}</p>
                            <p className="text-[11px] lg:text-[13px] text-[#1A2D23]/60 font-bold mt-0.5 leading-snug">
                                {t.voucherSub}
                            </p>
                        </div>
                        <span className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 lg:px-5 lg:py-2.5 bg-[#FF6B35] group-hover:bg-[#E95D31] text-white rounded-full text-[12px] lg:text-[14px] font-black shadow-sm shadow-[#FF6B35]/30 transition-colors">
                            {t.voucherCta}<span className="hidden lg:inline"> →</span>
                        </span>
                    </div>
                </Link>
            </div>
        </div>
    );
}
