"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag, User, ChevronRight } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import LanguageSwitcher from '../home/LanguageSwitcher';

interface NavBarENProps {
    currentUser: FirebaseUser | null;
    cartCount: number;
    cartTotal: number;
    onCartOpen: () => void;
    onAuthOpen: () => void;
}

export default function NavBarEN({ currentUser, cartCount, cartTotal, onCartOpen, onAuthOpen }: NavBarENProps) {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <>
            <div className="fixed top-0 w-full z-[60] bg-[#FF6B35] text-white overflow-hidden shadow-md h-[28px] sm:h-[30px] flex items-center">
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @keyframes marquee-horizontal-en {
                        0% { transform: translateX(0); }
                        100% { transform: translateX(-50%); }
                    }
                    .animate-marquee-mobile-en {
                        animation: marquee-horizontal-en 35s linear infinite;
                        display: flex;
                        width: max-content;
                    }
                `}} />

                {/* Desktop */}
                <div className="hidden sm:flex w-full justify-center px-3">
                    <p className="text-xs font-black tracking-wide truncate">
                        Heads up: orders close 06:00 daily (place before 06:00 for same-day delivery) <span className="opacity-50 mx-1">|</span> Free delivery within 2km of Pearl Point 🛵
                    </p>
                </div>

                {/* Mobile marquee */}
                <div className="sm:hidden w-full overflow-hidden whitespace-nowrap flex items-center">
                    <div className="animate-marquee-mobile-en flex shrink-0 items-center">
                        <span className="text-[12px] font-bold tracking-wide px-10 leading-none inline-block">
                            Orders close 06:00 daily · Free delivery within 2km of Pearl Point 🛵
                        </span>
                        <span className="text-[12px] font-bold tracking-wide px-10 leading-none inline-block">
                            Orders close 06:00 daily · Free delivery within 2km of Pearl Point 🛵
                        </span>
                    </div>
                </div>
            </div>
            <nav className={`fixed w-full z-50 transition-[background-color,backdrop-filter,box-shadow,border-color,padding] duration-300 ease-out top-[28px] sm:top-[30px] ${scrolled ? 'bg-[#FDFBF7]/95 backdrop-blur-md shadow-md border-b border-[#E3EADA]/60 py-3' : 'bg-gradient-to-b from-[#FDFBF7]/80 to-transparent py-6'}`}>
                <div className="max-w-7xl mx-auto px-4 md:px-6 flex justify-between items-center">
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="w-16 h-16 md:w-[72px] md:h-[72px] rounded-full bg-white flex items-center justify-center shadow-lg overflow-hidden border-2 border-[#E3EADA] hover:scale-105 transition-transform duration-300">
                            <Image src="/logo.webp" alt="Incredibowl Logo" width={192} height={192} className="scale-110" />
                        </div>
                        <div>
                            <Link href="/en" aria-label="Incredibowl BowlMama Kitchen home" className="block text-2xl md:text-[28px] font-black tracking-tight text-[#1A2D23] hover:text-[#FF6B35] transition-colors">BowlMama&apos;s Kitchen</Link>
                            <div className="flex items-center gap-2">
                                <span className="h-[1px] w-3 bg-[#FF6B35]"></span>
                                <p className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-[#FF6B35]">Incredibowl.my</p>
                            </div>
                        </div>
                    </div>

                    <nav className="hidden lg:flex items-center gap-8 text-sm font-bold text-[#1A2D23]/75">
                        <a href="#menu" className="hover:text-[#FF6B35] transition-colors">Daily Menu</a>
                        <a href="#feedback" className="hover:text-[#FF6B35] transition-colors">Reviews</a>
                        <a href="https://wa.me/60103370197" target="_blank" rel="noopener noreferrer" className="hover:text-[#FF6B35] transition-colors">Contact BowlMama</a>
                    </nav>

                    <div className="flex items-center gap-2 md:gap-3">
                        {currentUser ? (
                            <>
                                <a href="/member" aria-label="Open member centre" className="md:hidden">
                                    <div className="relative w-10 h-10 rounded-full bg-[#FF6B35] flex items-center justify-center text-white font-black text-sm shadow-sm ring-2 ring-white">
                                        {(currentUser.displayName || 'U')[0].toUpperCase()}
                                    </div>
                                </a>
                                <a
                                    href="/member"
                                    title="Member centre · points & orders"
                                    aria-label="Open member centre"
                                    className="hidden md:flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-full border border-[#1A2D23]/10 hover:bg-[#FDFBF7] hover:border-[#1A2D23]/25 transition-[background-color,border-color] duration-150 ease-out group"
                                >
                                    <div className="relative w-8 h-8 rounded-full bg-[#FF6B35] flex items-center justify-center text-white font-black text-sm shadow-sm">
                                        {(currentUser.displayName || 'U')[0].toUpperCase()}
                                    </div>
                                    <span className="text-xs font-bold text-[#1A2D23] max-w-[100px] truncate">{currentUser.displayName || 'Member'}</span>
                                    <ChevronRight size={12} className="text-[#1A2D23]/30 group-hover:text-[#FF6B35] group-hover:translate-x-0.5 transition-[transform,color] duration-150 ease-out" strokeWidth={2} />
                                </a>
                            </>
                        ) : (
                            <>
                                <button onClick={onAuthOpen} aria-label="Sign in" className="md:hidden p-2.5 bg-[#E3EADA]/60 rounded-full border border-[#E3EADA] hover:bg-[#E3EADA] transition-colors">
                                    <User size={18} className="text-[#1A2D23]" />
                                </button>
                                <button onClick={onAuthOpen} aria-label="Sign in / Neighbourhood member" className="hidden md:flex items-center gap-3 px-4 py-2.5 bg-[#E3EADA]/50 rounded-full border border-[#E3EADA] hover:bg-[#E3EADA] transition-colors">
                                    <User size={16} className="text-[#1A2D23]" />
                                    <span className="text-xs font-bold text-[#1A2D23]">Sign in / Member</span>
                                </button>
                            </>
                        )}

                        <LanguageSwitcher current="en" />

                        {cartCount > 0 ? (
                            /* With items — Mobile: minimal icon card; md+: dark green pill with total price */
                            <button
                                onClick={onCartOpen}
                                aria-label={`Open cart (${cartCount} items · RM ${cartTotal.toFixed(2)})`}
                                className="relative inline-flex items-center gap-2 p-2.5 md:pl-3 md:pr-4 md:py-3 bg-white md:bg-[#1A2D23] md:hover:bg-[#243A2D] text-[#1A2D23] md:text-white rounded-xl md:rounded-2xl shadow-sm border border-gray-100 md:border-0 hover:border-[#1A2D23]/20 transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out md:active:scale-[0.97]"
                            >
                                <ShoppingBag className="w-5 h-5 md:w-[18px] md:h-[18px] shrink-0" strokeWidth={2} />
                                <span className="hidden md:inline font-black tabular-nums text-sm whitespace-nowrap">RM {cartTotal.toFixed(2)}</span>
                                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-[#FF6B35] text-white text-[10px] rounded-full inline-flex items-center justify-center font-black shadow-md ring-2 ring-[#FDFBF7]">
                                    {cartCount}
                                </span>
                            </button>
                        ) : (
                            /* Empty cart — minimal icon */
                            <button
                                onClick={onCartOpen}
                                aria-label="Open cart"
                                className="relative p-2.5 md:p-3 bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-100 hover:border-[#1A2D23]/20 transition-[border-color,box-shadow] duration-150 ease-out"
                            >
                                <ShoppingBag className="w-5 h-5 md:w-6 md:h-6 text-[#1A2D23]" />
                            </button>
                        )}
                    </div>
                </div>
            </nav>
        </>
    );
}
