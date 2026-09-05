"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag, User, ChevronRight, Menu, X } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import LanguageSwitcher from './LanguageSwitcher';
import { useModalA11y } from '@/components/ui/useModalA11y';
import type { Locale } from '@/lib/locale';
import { HOME_DICT } from './dict';

interface NavBarProps {
    currentUser: FirebaseUser | null;
    cartCount: number;
    cartTotal: number;
    onCartOpen: () => void;
    onAuthOpen: () => void;
    locale?: Locale;
}

// ⚠️ 历史漂移（C1 合并时原样保留，两边预渲染 HTML 零变化）：原 NavBarEN 没跟上 ZH 的几次
// 桌面 / 移动微调——顶栏滚动隐藏、<nav> 的 top / padding、logo 尺寸、44px 点击区、按钮
// p-3 / p-2.5、marquee keyframe 名带 -en 后缀。要不要让 /en 追平 ZH 由老板决定；追平时
// 删掉 en 那一组即可。
const LAYOUT = {
    zh: {
        topBar: (scrolled: boolean) => `fixed top-0 w-full z-[60] bg-primary text-white overflow-hidden shadow-md h-[28px] sm:h-[30px] flex items-center transition-transform duration-300 ease-out ${scrolled ? '-translate-y-full' : 'translate-y-0'}`,
        keyframes: 'marquee-horizontal',
        marqueeClass: 'animate-marquee-mobile',
        nav: (scrolled: boolean) => `fixed w-full z-50 transition-[top,background-color,backdrop-filter,box-shadow,border-color,padding] duration-300 ease-out ${scrolled ? 'top-0 bg-paper/95 backdrop-blur-md shadow-md border-b border-line/60 py-2' : 'top-[28px] sm:top-[30px] bg-gradient-to-b from-paper/80 to-transparent py-4'}`,
        logo: 'w-14 h-14 md:w-[72px] md:h-[72px] rounded-full bg-white flex items-center justify-center shadow-lg overflow-hidden border-2 border-line hover:scale-105 transition-transform duration-300',
        mobileAvatarLink: 'md:hidden flex items-center justify-center min-w-[44px] min-h-[44px]',
        mobileLoginBtn: 'md:hidden p-3 bg-line/60 rounded-full border border-line hover:bg-line transition-colors',
        cartFilled: 'relative inline-flex items-center gap-2 p-3 md:pl-3 md:pr-4 md:py-3 bg-ink hover:bg-[#243A2D] text-white rounded-xl md:rounded-2xl shadow-sm transition-[background-color,transform] duration-150 ease-out active:scale-[0.97]',
        cartEmpty: 'relative p-3 md:p-3 bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-100 hover:border-ink/20 transition-[border-color,box-shadow] duration-150 ease-out',
    },
    en: {
        topBar: () => 'fixed top-0 w-full z-[60] bg-primary text-white overflow-hidden shadow-md h-[28px] sm:h-[30px] flex items-center',
        keyframes: 'marquee-horizontal-en',
        marqueeClass: 'animate-marquee-mobile-en',
        nav: (scrolled: boolean) => `fixed w-full z-50 transition-[background-color,backdrop-filter,box-shadow,border-color,padding] duration-300 ease-out top-[28px] sm:top-[30px] ${scrolled ? 'bg-paper/95 backdrop-blur-md shadow-md border-b border-line/60 py-3' : 'bg-gradient-to-b from-paper/80 to-transparent py-6'}`,
        logo: 'w-16 h-16 md:w-[72px] md:h-[72px] rounded-full bg-white flex items-center justify-center shadow-lg overflow-hidden border-2 border-line hover:scale-105 transition-transform duration-300',
        mobileAvatarLink: 'md:hidden',
        mobileLoginBtn: 'md:hidden p-2.5 bg-line/60 rounded-full border border-line hover:bg-line transition-colors',
        cartFilled: 'relative inline-flex items-center gap-2 p-2.5 md:pl-3 md:pr-4 md:py-3 bg-ink hover:bg-[#243A2D] text-white rounded-xl md:rounded-2xl shadow-sm transition-[background-color,transform] duration-150 ease-out active:scale-[0.97]',
        cartEmpty: 'relative p-2.5 md:p-3 bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-100 hover:border-ink/20 transition-[border-color,box-shadow] duration-150 ease-out',
    },
} as const;

export default function NavBar({ currentUser, cartCount, cartTotal, onCartOpen, onAuthOpen, locale = 'zh' }: NavBarProps) {
    const t = HOME_DICT[locale].navBar;
    const L = LAYOUT[locale];
    const [scrolled, setScrolled] = useState(false);
    // H4：<lg 的导航。原来四个锚点都是 hidden lg:flex，手机上零导航。
    const [navOpen, setNavOpen] = useState(false);
    const navPanelRef = React.useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);
    // 面板的 Escape / 焦点陷阱（背景滚动锁对下拉式导航也合适：
    // 它是覆盖在内容之上的临时层）。
    // trapFocus:false —— 汉堡 / X 按钮在面板外，关进去键盘就永远到不了 X（2026-09-05 审查）。
    useModalA11y({ open: navOpen, onClose: () => setNavOpen(false), panelRef: navPanelRef, trapFocus: false });

    // 手机跑马灯的一句：zh 与桌面同句（带 | 分隔 span）；en 历史上是另一句短文案直接拼运费摘要。
    const marquee = locale === 'en'
        ? <>{t.marqueeNotice}{t.deliverySummary}</>
        : <>{t.topNotice}<span className="opacity-50 mx-1">|</span> {t.deliverySummary}</>;

    return (
        <>
            <div className={L.topBar(scrolled)}>
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @keyframes ${L.keyframes} {
                        0% { transform: translateX(0); }
                        100% { transform: translateX(-50%); }
                    }
                    .${L.marqueeClass} {
                        animation: ${L.keyframes} 35s linear infinite;
                        display: flex;
                        width: max-content;
                    }
                `}} />

                {/* Desktop Version */}
                <div className="hidden sm:flex w-full justify-center px-3">
                    <p className="text-xs lg:text-[13px] font-medium tracking-wide truncate">
                        {t.topNotice}<span className="opacity-50 mx-1">|</span> {t.deliverySummary}
                    </p>
                </div>

                {/* Mobile Marquee Version (Larger font, animated) */}
                <div className="sm:hidden w-full overflow-hidden whitespace-nowrap flex items-center">
                    <div className={`${L.marqueeClass} flex shrink-0 items-center`}>
                        <span className="text-[12px] font-bold tracking-wide px-10 leading-none inline-block">
                            {marquee}
                        </span>
                        {/* Duplicate for seamless infinite loop — aria-hidden 否则读屏把同一句念两遍 */}
                        <span aria-hidden="true" className="text-[12px] font-bold tracking-wide px-10 leading-none inline-block">
                            {marquee}
                        </span>
                    </div>
                </div>
            </div>
            <nav className={L.nav(scrolled)}>
            <div className="max-w-7xl mx-auto px-4 md:px-6 flex justify-between items-center">
                <div className="flex items-center gap-3 md:gap-4">
                    <div className={L.logo}>
                        <Image src="/logo.webp" alt="Incredibowl Logo" width={192} height={192} className="scale-110" />
                    </div>
                    <div>
                        {/* Brand name — semantically a link/label, not the page H1 (page H1 lives in Hero) */}
                        <Link href={t.homeHref} aria-label={t.homeAriaLabel} className="block text-2xl md:text-[28px] font-black tracking-tight text-ink hover:text-primary transition-colors">{t.brandName}</Link>
                        <div className="flex items-center gap-2">
                            <span className="h-[1px] w-3 bg-primary"></span>
                            <p className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-primary">Incredibowl.my</p>
                        </div>
                    </div>
                </div>

                {/* Desktop-only quick nav anchors (hidden on mobile/tablet) */}
                <nav className="hidden lg:flex items-center gap-8 text-sm font-bold text-ink/75">
                    <a href="#menu" className="hover:text-primary transition-colors">{t.dailyMenu}</a>
                    <Link href={t.vouchersHref} className="hover:text-primary transition-colors">{t.mealVouchers}</Link>
                    <a href="#feedback" className="hover:text-primary transition-colors">{t.reviews}</a>
                    <a href="https://wa.me/60103370197" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">{t.contact}</a>
                </nav>

                <div className="flex items-center gap-2 md:gap-3">
                    {currentUser ? (
                        <>
                            {/* Mobile: avatar only — brand-orange letter on transparent ring */}
                            <a href={t.memberHref} aria-label={t.memberAria} className={L.mobileAvatarLink}>
                                <div className="relative w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-black text-sm shadow-sm ring-2 ring-white">
                                    {(currentUser.displayName || 'U')[0].toUpperCase()}
                                </div>
                            </a>
                            {/* Desktop: brand-orange avatar + name + thin chevron, transparent pill */}
                            <a
                                href={t.memberHref}
                                title={t.memberTitle}
                                aria-label={t.memberAria}
                                className="hidden md:flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-full border border-ink/10 hover:bg-paper hover:border-ink/25 transition-[background-color,border-color] duration-150 ease-out group"
                            >
                                <div className="relative w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-black text-sm shadow-sm">
                                    {(currentUser.displayName || 'U')[0].toUpperCase()}
                                </div>
                                <span className="text-xs font-bold text-ink max-w-[100px] truncate">{currentUser.displayName || t.member}</span>
                                <ChevronRight size={12} className="text-ink/30 group-hover:text-primary group-hover:translate-x-0.5 transition-[transform,color] duration-150 ease-out" strokeWidth={2} />
                            </a>
                        </>
                    ) : (
                        <>
                            {/* Mobile: icon-only login button */}
                            <button onClick={onAuthOpen} aria-label={t.signInMobileAria} className={L.mobileLoginBtn}>
                                <User size={18} className="text-ink" />
                            </button>
                            {/* Desktop: full login button */}
                            <button onClick={onAuthOpen} aria-label={t.signInDesktopAria} className="hidden md:flex items-center gap-3 px-4 py-2.5 bg-line/50 rounded-full border border-line hover:bg-line transition-colors">
                                <User size={16} className="text-ink" />
                                <span className="text-xs font-bold text-ink">{t.signInLabel}</span>
                            </button>
                        </>
                    )}

                    {/* 汉堡：只在 <lg 出现（桌面有那排锚点） */}

                    <button

                        type="button"

                        onClick={() => setNavOpen(v => !v)}

                        aria-label={navOpen ? t.closeMenu : t.openMenu}

                        aria-expanded={navOpen}

                        aria-controls="mobile-nav-panel"

                        className="lg:hidden p-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-ink/20 transition-colors"

                    >

                        {navOpen ? <X size={20} className="text-ink" /> : <Menu size={20} className="text-ink" />}

                    </button>


                    <div className="hidden lg:block"><LanguageSwitcher current={locale} /></div>

                    {cartCount > 0 ? (
                        /* With items — dark-green pill always; price text only shows on md+ */
                        <button
                            onClick={onCartOpen}
                            aria-label={t.cartAria(cartCount, cartTotal.toFixed(2))}
                            className={L.cartFilled}
                        >
                            <ShoppingBag className="w-5 h-5 md:w-[18px] md:h-[18px] shrink-0" strokeWidth={2} />
                            <span className="hidden md:inline font-black tabular-nums text-sm whitespace-nowrap">RM {cartTotal.toFixed(2)}</span>
                            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-primary text-white text-[11px] rounded-full inline-flex items-center justify-center font-black shadow-md ring-2 ring-paper">
                                {cartCount}
                            </span>
                        </button>
                    ) : (
                        /* Empty cart — minimal icon */
                        <button
                            onClick={onCartOpen}
                            aria-label={t.cartEmptyAria}
                            className={L.cartEmpty}
                        >
                            <ShoppingBag className="w-5 h-5 md:w-6 md:h-6 text-ink" />
                        </button>
                    )}
                </div>
            </div>
        {/* 移动导航面板。不做全屏遮罩：下拉一层就够，也不打断浏览。 */}
        {navOpen && (
            <div
                id="mobile-nav-panel"
                ref={navPanelRef}
                className="lg:hidden mx-4 mt-2 bg-white rounded-2xl border border-line shadow-xl"
            >
                <a href="#menu" onClick={() => setNavOpen(false)} className="block w-full min-h-[48px] first:rounded-t-2xl flex items-center px-5 text-[15px] font-bold text-ink hover:bg-paper border-b border-line/50 last:border-0">{t.dailyMenu}</a>
                <Link href={t.vouchersHref} onClick={() => setNavOpen(false)} className="block w-full min-h-[48px] first:rounded-t-2xl flex items-center px-5 text-[15px] font-bold text-ink hover:bg-paper border-b border-line/50 last:border-0">{t.mealVouchers}</Link>
                <a href="#feedback" onClick={() => setNavOpen(false)} className="block w-full min-h-[48px] first:rounded-t-2xl flex items-center px-5 text-[15px] font-bold text-ink hover:bg-paper border-b border-line/50 last:border-0">{t.panelReviews}</a>
                <a href="https://wa.me/60103370197" target="_blank" rel="noopener noreferrer" onClick={() => setNavOpen(false)} className="block w-full min-h-[48px] first:rounded-t-2xl flex items-center px-5 text-[15px] font-bold text-ink hover:bg-paper border-b border-line/50 last:border-0">{t.contact}</a>
                {currentUser && <Link href={t.memberHref} onClick={() => setNavOpen(false)} className="block w-full min-h-[48px] first:rounded-t-2xl flex items-center px-5 text-[15px] font-bold text-ink hover:bg-paper border-b border-line/50 last:border-0">{t.member}</Link>}
                <div className="flex items-center gap-3 px-5 py-3 border-t border-line/50">
                    <span className="text-[13px] font-bold text-ink/60">{t.languageLabel}</span>
                    <span className="ml-auto"><LanguageSwitcher current={locale} /></span>
                </div>
            </div>
        )}
        </nav>
        </>
    );
}
