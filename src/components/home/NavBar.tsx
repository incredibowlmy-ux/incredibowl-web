"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { ShoppingBag, User, Sparkles } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';

interface NavBarProps {
    currentUser: FirebaseUser | null;
    cartCount: number;
    onCartOpen: () => void;
    onAuthOpen: () => void;
}

export default function NavBar({ currentUser, cartCount, onCartOpen, onAuthOpen }: NavBarProps) {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <>
            <div className="fixed top-0 w-full z-[60] bg-[#FF6B35] text-white px-3 py-1.5 text-center flex justify-center items-center shadow-md">
                <p className="text-[10px] sm:text-xs font-black tracking-wide truncate">
                    温馨提示：每天早上 06:00 截单（06:00 前当日配送） <span className="opacity-50 mx-1">|</span> Pearl Point 2km 内免运费 🛵
                </p>
            </div>
            <nav className={`fixed w-full z-50 transition-all duration-500 top-[26px] sm:top-[28px] ${scrolled ? 'bg-[#FDFBF7]/95 backdrop-blur-md shadow-md border-b border-[#E3EADA]/60 py-3' : 'bg-gradient-to-b from-[#FDFBF7]/80 to-transparent py-6'}`}>
            <div className="max-w-7xl mx-auto px-4 md:px-6 flex justify-between items-center">
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-16 h-16 md:w-[72px] md:h-[72px] rounded-full bg-white flex items-center justify-center shadow-lg overflow-hidden border-2 border-[#E3EADA] hover:scale-105 transition-transform duration-300">
                        <Image src="/logo.png" alt="Incredibowl Logo" width={192} height={192} className="scale-110" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-[28px] font-black tracking-tight text-[#1A2D23]">阿姨的厨房</h1>
                        <div className="flex items-center gap-2">
                            <span className="h-[1px] w-3 bg-[#FF6B35]"></span>
                            <p className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-[#FF6B35]">Incredibowl.my</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 md:gap-4">
                    {currentUser ? (
                        <>
                            {/* Mobile: avatar only */}
                            <a href="/member" className="md:hidden">
                                <div className="relative w-10 h-10 rounded-full bg-[#FF6B35] flex items-center justify-center text-white font-black text-sm border-2 border-[#E3EADA] shadow-sm overflow-hidden">
                                    {currentUser.photoURL ? (
                                        <Image src={currentUser.photoURL} alt="Avatar" fill className="object-cover" />
                                    ) : (
                                        (currentUser.displayName || 'U')[0].toUpperCase()
                                    )}
                                </div>
                            </a>
                            {/* Desktop: avatar + name */}
                            <a href="/member" className="hidden md:flex items-center gap-3 px-4 py-2 bg-[#E3EADA]/50 rounded-full border border-[#E3EADA] hover:bg-[#E3EADA] transition-colors">
                                <div className="relative w-7 h-7 rounded-full bg-[#FF6B35] flex items-center justify-center text-white font-bold text-xs overflow-hidden">
                                    {currentUser.photoURL ? (
                                        <Image src={currentUser.photoURL} alt="Avatar" fill className="object-cover" />
                                    ) : (
                                        (currentUser.displayName || 'U')[0].toUpperCase()
                                    )}
                                </div>
                                <span className="text-xs font-bold text-[#1A2D23] max-w-[100px] truncate">{currentUser.displayName || '会员中心'}</span>
                                <Sparkles size={12} className="text-[#FF6B35]" />
                            </a>
                        </>
                    ) : (
                        <>
                            {/* Mobile: icon-only login button */}
                            <button onClick={onAuthOpen} className="md:hidden p-2.5 bg-[#E3EADA]/60 rounded-full border border-[#E3EADA] hover:bg-[#E3EADA] transition-colors">
                                <User size={18} className="text-[#1A2D23]" />
                            </button>
                            {/* Desktop: full login button */}
                            <button onClick={onAuthOpen} className="hidden md:flex items-center gap-3 px-4 py-2.5 bg-[#E3EADA]/50 rounded-full border border-[#E3EADA] hover:bg-[#E3EADA] transition-colors">
                                <User size={16} className="text-[#1A2D23]" />
                                <span className="text-xs font-bold text-[#1A2D23]">登录 / 邻里会员</span>
                            </button>
                        </>
                    )}
                    <button onClick={onCartOpen} className="relative p-2.5 md:p-3 bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-100 hover:border-[#1A2D23]/20 transition-all">
                        <ShoppingBag className="w-5 h-5 md:w-6 md:h-6 text-[#1A2D23]" />
                        {cartCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 md:w-6 md:h-6 bg-[#FF6B35] text-white text-[10px] md:text-xs rounded-full flex items-center justify-center font-black animate-pulse shadow-md">
                                {cartCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </nav>
        </>
    );
}
