"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { MapPin, CheckCircle2, ArrowRight } from 'lucide-react';
import { weeklyMenu } from '@/data/weeklyMenu';

export default function HeroSection() {
    const [heroImgIdx, setHeroImgIdx] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setHeroImgIdx(prev => (prev + 1) % weeklyMenu.length);
        }, 8000);
        return () => clearInterval(timer);
    }, []);

    return (
        <>
            {/* Hero Bento 1: Main Promise */}
            <div className="lg:col-span-8 bg-[#E3EADA] rounded-[32px] p-8 md:p-12 relative overflow-hidden flex flex-col justify-end min-h-[400px]">
                {/* Rotating Background Images */}
                <div className="absolute inset-0 pointer-events-none">
                    {weeklyMenu.map((dish, i) => (
                        <div key={dish.id} className="absolute inset-0 transition-opacity duration-[2000ms] ease-in-out" style={{ opacity: heroImgIdx === i ? 0.25 : 0 }}>
                            <Image src={dish.image} alt="" fill className="object-cover object-center mix-blend-multiply" />
                        </div>
                    ))}
                    <div className="absolute inset-0 bg-gradient-to-r from-[#E3EADA] via-transparent to-[#E3EADA]/80 z-10" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#E3EADA] via-transparent to-transparent z-10" />
                </div>

                <div className="relative z-20 max-w-xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/60 backdrop-blur-md rounded-full text-xs font-bold mb-6 text-[#1A2D23]">
                        <MapPin size={12} className="text-[#FF6B35]" /> Old Klang Road 邻里私房菜
                    </div>
                    <h2 className="text-4xl md:text-6xl font-extrabold leading-[1.1] tracking-tight mb-4">
                        家的味道，<br />
                        每天新鲜采购。
                    </h2>
                    <p className="text-lg md:text-xl font-medium text-[#1A2D23]/70 mb-8 max-w-md">
                        "没时间做菜，但要吃得健康。无味精、真材实料，阿姨每天只专注煮一道拿手好菜。"
                    </p>
                </div>
            </div>

            {/* Hero Bento 2: Delivery & Trust */}
            <div className="lg:col-span-4 flex flex-col gap-4">
                <div className="bg-[#1A2D23] rounded-[32px] p-8 text-white flex-1 flex flex-col justify-center relative overflow-hidden">
                    <div className="w-32 h-32 bg-[#FF6B35] rounded-full blur-3xl opacity-20 absolute -top-10 -right-10" />
                    <div className="flex items-center gap-3 mb-3">
                        <div className="px-2.5 py-1 rounded-md bg-[#FF6B35] text-white text-[11px] font-black tracking-widest animate-pulse shadow-lg shadow-[#FF6B35]/20">BETA</div>
                        <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight">邻里内测中</h3>
                    </div>
                    <p className="text-white/80 text-sm md:text-base mb-6 leading-relaxed">
                        阿姨的厨房正式开灶！首批仅开放 <span className="text-white font-bold">Pearl Point</span> 周边邻居试吃。<br />
                        名额有限，<span className="text-[#FF6B35] font-black text-base underline decoration-[#FF6B35]/30 underline-offset-4">每天限量 25 份</span>。
                    </p>
                    <div className="w-full h-px bg-white/10 mb-5" />
                    <ul className="space-y-3.5">
                        {['纯天然，0 味精提鲜', '轻盐减油，吃完不口干', '每日巴刹鲜购优质肉'].map((feat, idx) => (
                            <li key={idx} className="flex items-center gap-3 text-sm font-bold text-white/90">
                                <CheckCircle2 size={18} className="text-[#FF6B35]" /> {feat}
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="flex flex-col gap-3">
                    <div
                        className="bg-[#FF6B35] rounded-[32px] p-6 shadow-lg shadow-[#FF6B35]/30 flex items-center justify-between group cursor-pointer hover:bg-[#E95D31] hover:shadow-xl hover:shadow-[#FF6B35]/40 transition-all duration-300 transform hover:-translate-y-1"
                        onClick={() => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                        <div>
                            <p className="text-xs font-black text-white/80 uppercase tracking-widest mb-1 animate-pulse">Explore Menu</p>
                            <p className="font-extrabold text-xl md:text-2xl text-white">探索每日精选</p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-[#FF6B35] group-hover:scale-110 transition-transform duration-300 shadow-md">
                            <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
                        </div>
                    </div>
                    <div className="w-full flex justify-center">
                        <p className="text-xs font-bold text-[#FF6B35]/80 bg-[#FF6B35]/10 px-4 py-1.5 rounded-full inline-flex items-center gap-1.5 border border-[#FF6B35]/20 shadow-sm">
                            🍲 限量现煮，家的味道
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
