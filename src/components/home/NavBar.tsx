"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag, User, ChevronRight, Menu, X } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import LanguageSwitcher from './LanguageSwitcher';
import { useModalA11y } from '@/components/ui/useModalA11y';
import { DELIVERY_SUMMARY_ZH } from '@/lib/deliveryCopy';

interface NavBarProps {
    currentUser: FirebaseUser | null;
    cartCount: number;
    cartTotal: number;
    onCartOpen: () => void;
    onAuthOpen: () => void;
}

export default function NavBar({ currentUser, cartCount, cartTotal, onCartOpen, onAuthOpen }: NavBarProps) {
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

    return (
        <>
            <div className={`fixed top-0 w-full z-[60] bg-[#FF6B35] text-white overflow-hidden shadow-md h-[28px] sm:h-[30px] flex items-center transition-transform duration-300 ease-out ${scrolled ? '-translate-y-full' : 'translate-y-0'}`}>
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @keyframes marquee-horizontal {
                        0% { transform: translateX(0); }
                        100% { transform: translateX(-50%); }
                    }
                    .animate-marquee-mobile {
                        animation: marquee-horizontal 35s linear infinite;
                        display: flex;
                        width: max-content;
                    }
                `}} />
                
                {/* Desktop Version */}
                <div className="hidden sm:flex w-full justify-center px-3">
                    <p className="text-xs lg:text-[13px] font-medium tracking-wide truncate">
                        温馨提示：每天早上 06:00 截单（06:00 前下单 当日配送） <span className="opacity-50 mx-1">|</span> {DELIVERY_SUMMARY_ZH}
                    </p>
                </div>

                {/* Mobile Marquee Version (Larger font, animated) */}
                <div className="sm:hidden w-full overflow-hidden whitespace-nowrap flex items-center">
                    <div className="animate-marquee-mobile flex shrink-0 items-center">
                        <span className="text-[12px] font-bold tracking-wide px-10 leading-none inline-block">
                            温馨提示：每天早上 06:00 截单（06:00 前下单 当日配送） <span className="opacity-50 mx-1">|</span> {DELIVERY_SUMMARY_ZH}
                        </span>
                        {/* Duplicate for seamless infinite loop — aria-hidden 否则读屏把同一句念两遍 */}
                        <span aria-hidden="true" className="text-[12px] font-bold tracking-wide px-10 leading-none inline-block">
                            温馨提示：每天早上 06:00 截单（06:00 前下单 当日配送） <span className="opacity-50 mx-1">|</span> {DELIVERY_SUMMARY_ZH}
                        </span>
                    </div>
                </div>
            </div>
            <nav className={`fixed w-full z-50 transition-[top,background-color,backdrop-filter,box-shadow,border-color,padding] duration-300 ease-out ${scrolled ? 'top-0 bg-[#FDFBF7]/95 backdrop-blur-md shadow-md border-b border-[#E3EADA]/60 py-2' : 'top-[28px] sm:top-[30px] bg-gradient-to-b from-[#FDFBF7]/80 to-transparent py-4'}`}>
            <div className="max-w-7xl mx-auto px-4 md:px-6 flex justify-between items-center">
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-14 h-14 md:w-[72px] md:h-[72px] rounded-full bg-white flex items-center justify-center shadow-lg overflow-hidden border-2 border-[#E3EADA] hover:scale-105 transition-transform duration-300">
                        <Image src="/logo.webp" alt="Incredibowl Logo" width={192} height={192} className="scale-110" />
                    </div>
                    <div>
                        {/* Brand name — semantically a link/label, not the page H1 (page H1 lives in Hero) */}
                        <Link href="/" aria-label="Incredibowl 碗妈的厨房 首页" className="block text-2xl md:text-[28px] font-black tracking-tight text-[#1A2D23] hover:text-[#FF6B35] transition-colors">碗妈的厨房</Link>
                        <div className="flex items-center gap-2">
                            <span className="h-[1px] w-3 bg-[#FF6B35]"></span>
                            <p className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-[#FF6B35]">Incredibowl.my</p>
                        </div>
                    </div>
                </div>

                {/* Desktop-only quick nav anchors (hidden on mobile/tablet) */}
                <nav className="hidden lg:flex items-center gap-8 text-sm font-bold text-[#1A2D23]/75">
                    <a href="#menu" className="hover:text-[#FF6B35] transition-colors">每日菜单</a>
                    <Link href="/meal-vouchers" className="hover:text-[#FF6B35] transition-colors">餐券预付包</Link>
                    <a href="#feedback" className="hover:text-[#FF6B35] transition-colors">邻居好评</a>
                    <a href="https://wa.me/60103370197" target="_blank" rel="noopener noreferrer" className="hover:text-[#FF6B35] transition-colors">联系碗妈</a>
                </nav>

                <div className="flex items-center gap-2 md:gap-3">
                    {currentUser ? (
                        <>
                            {/* Mobile: avatar only — brand-orange letter on transparent ring */}
                            <a href="/member" aria-label="进入会员中心" className="md:hidden flex items-center justify-center min-w-[44px] min-h-[44px]">
                                <div className="relative w-10 h-10 rounded-full bg-[#FF6B35] flex items-center justify-center text-white font-black text-sm shadow-sm ring-2 ring-white">
                                    {(currentUser.displayName || 'U')[0].toUpperCase()}
                                </div>
                            </a>
                            {/* Desktop: brand-orange avatar + name + thin chevron, transparent pill */}
                            <a
                                href="/member"
                                title="进入会员中心 · 查看订单与 voucher"
                                aria-label="进入会员中心"
                                className="hidden md:flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-full border border-[#1A2D23]/10 hover:bg-[#FDFBF7] hover:border-[#1A2D23]/25 transition-[background-color,border-color] duration-150 ease-out group"
                            >
                                <div className="relative w-8 h-8 rounded-full bg-[#FF6B35] flex items-center justify-center text-white font-black text-sm shadow-sm">
                                    {(currentUser.displayName || 'U')[0].toUpperCase()}
                                </div>
                                <span className="text-xs font-bold text-[#1A2D23] max-w-[100px] truncate">{currentUser.displayName || '会员中心'}</span>
                                <ChevronRight size={12} className="text-[#1A2D23]/30 group-hover:text-[#FF6B35] group-hover:translate-x-0.5 transition-[transform,color] duration-150 ease-out" strokeWidth={2} />
                            </a>
                        </>
                    ) : (
                        <>
                            {/* Mobile: icon-only login button */}
                            <button onClick={onAuthOpen} aria-label="登录 / 邻里会员" className="md:hidden p-3 bg-[#E3EADA]/60 rounded-full border border-[#E3EADA] hover:bg-[#E3EADA] transition-colors">
                                <User size={18} className="text-[#1A2D23]" />
                            </button>
                            {/* Desktop: full login button */}
                            <button onClick={onAuthOpen} aria-label="登录 / 邻里会员" className="hidden md:flex items-center gap-3 px-4 py-2.5 bg-[#E3EADA]/50 rounded-full border border-[#E3EADA] hover:bg-[#E3EADA] transition-colors">
                                <User size={16} className="text-[#1A2D23]" />
                                <span className="text-xs font-bold text-[#1A2D23]">登录 / 邻里会员</span>
                            </button>
                        </>
                    )}

                    {/* 汉堡：只在 <lg 出现（桌面有那排锚点） */}

                    <button

                        type="button"

                        onClick={() => setNavOpen(v => !v)}

                        aria-label={navOpen ? '关闭菜单' : '打开菜单'}

                        aria-expanded={navOpen}

                        aria-controls="mobile-nav-panel"

                        className="lg:hidden p-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-[#1A2D23]/20 transition-colors"

                    >

                        {navOpen ? <X size={20} className="text-[#1A2D23]" /> : <Menu size={20} className="text-[#1A2D23]" />}

                    </button>


                    <div className="hidden lg:block"><LanguageSwitcher current="zh" /></div>

                    {cartCount > 0 ? (
                        /* With items — dark-green pill always; price text only shows on md+ */
                        <button
                            onClick={onCartOpen}
                            aria-label={`打开购物车（${cartCount} 件 · RM ${cartTotal.toFixed(2)}）`}
                            className="relative inline-flex items-center gap-2 p-3 md:pl-3 md:pr-4 md:py-3 bg-[#1A2D23] hover:bg-[#243A2D] text-white rounded-xl md:rounded-2xl shadow-sm transition-[background-color,transform] duration-150 ease-out active:scale-[0.97]"
                        >
                            <ShoppingBag className="w-5 h-5 md:w-[18px] md:h-[18px] shrink-0" strokeWidth={2} />
                            <span className="hidden md:inline font-black tabular-nums text-sm whitespace-nowrap">RM {cartTotal.toFixed(2)}</span>
                            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-[#FF6B35] text-white text-[11px] rounded-full inline-flex items-center justify-center font-black shadow-md ring-2 ring-[#FDFBF7]">
                                {cartCount}
                            </span>
                        </button>
                    ) : (
                        /* Empty cart — minimal icon */
                        <button
                            onClick={onCartOpen}
                            aria-label="打开购物车"
                            className="relative p-3 md:p-3 bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-100 hover:border-[#1A2D23]/20 transition-[border-color,box-shadow] duration-150 ease-out"
                        >
                            <ShoppingBag className="w-5 h-5 md:w-6 md:h-6 text-[#1A2D23]" />
                        </button>
                    )}
                </div>
            </div>
        {/* 移动导航面板。不做全屏遮罩：下拉一层就够，也不打断浏览。 */}
        {navOpen && (
            <div
                id="mobile-nav-panel"
                ref={navPanelRef}
                className="lg:hidden mx-4 mt-2 bg-white rounded-2xl border border-[#E3EADA] shadow-xl"
            >
                <a href="#menu" onClick={() => setNavOpen(false)} className="block w-full min-h-[48px] first:rounded-t-2xl flex items-center px-5 text-[15px] font-bold text-[#1A2D23] hover:bg-[#FDFBF7] border-b border-[#E3EADA]/50 last:border-0">每日菜单</a>
                <Link href="/meal-vouchers" onClick={() => setNavOpen(false)} className="block w-full min-h-[48px] first:rounded-t-2xl flex items-center px-5 text-[15px] font-bold text-[#1A2D23] hover:bg-[#FDFBF7] border-b border-[#E3EADA]/50 last:border-0">餐券预付包</Link>
                <a href="#feedback" onClick={() => setNavOpen(false)} className="block w-full min-h-[48px] first:rounded-t-2xl flex items-center px-5 text-[15px] font-bold text-[#1A2D23] hover:bg-[#FDFBF7] border-b border-[#E3EADA]/50 last:border-0">邻居好评</a>
                <a href="https://wa.me/60103370197" target="_blank" rel="noopener noreferrer" onClick={() => setNavOpen(false)} className="block w-full min-h-[48px] first:rounded-t-2xl flex items-center px-5 text-[15px] font-bold text-[#1A2D23] hover:bg-[#FDFBF7] border-b border-[#E3EADA]/50 last:border-0">联系碗妈</a>
                {currentUser && <Link href="/member" onClick={() => setNavOpen(false)} className="block w-full min-h-[48px] first:rounded-t-2xl flex items-center px-5 text-[15px] font-bold text-[#1A2D23] hover:bg-[#FDFBF7] border-b border-[#E3EADA]/50 last:border-0">会员中心</Link>}
                <div className="flex items-center gap-3 px-5 py-3 border-t border-[#E3EADA]/50">
                    <span className="text-[13px] font-bold text-[#1A2D23]/60">语言 / Language</span>
                    <span className="ml-auto"><LanguageSwitcher current="zh" /></span>
                </div>
            </div>
        )}
        </nav>
        </>
    );
}
