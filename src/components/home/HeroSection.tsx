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
                    <div className="flex items-center gap-3 mb-2">
                        <div className="px-2.5 py-1 rounded-md bg-[#FF6B35] text-white text-[11px] font-black tracking-widest animate-pulse shadow-lg shadow-[#FF6B35]/20">BETA</div>
                        <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight">邻里内测中</h3>
                    </div>
                    
                    <h4 className="text-[#FF9B50] font-bold text-base md:text-lg mb-4 flex items-center gap-2">
                        新店开灶，限时双重福利！🎉
                    </h4>

                    <p className="text-white/80 text-xs md:text-sm leading-relaxed mb-5">
                        Incredibowl 私厨正式开灶啦！我们不追求大批量，只坚持好品质。纯天然、0味精，每天早起巴刹采买新鲜好肉，专注精神做每天的专属菜单。严控品质，给您最踏实的家常味。<br/>
                        <span className="text-[#FF6B35] font-black mt-2 inline-block bg-[#FF6B35]/15 px-2.5 py-1 rounded-md">每天限量 25 份，新鲜现做！</span>
                    </p>

                    {/* Promo Box */}
                    <div className="bg-gradient-to-br from-[#FF6B35]/20 to-transparent border border-[#FF6B35]/30 rounded-2xl p-4 mb-5 shadow-inner">
                        <p className="text-white text-xs md:text-sm font-bold mb-3">感谢首批支持的街坊，特别推出内测福利：</p>
                        <div className="space-y-3">
                            <div>
                                <p className="text-[#FF9B50] font-black text-sm flex items-center gap-1.5"><span className="text-base leading-none">✨</span> 福利一：尝鲜立减</p>
                                <p className="text-white/70 text-xs mt-0.5 ml-6">即日起至 4月15日，下单每份餐点直接立减 RM 1！</p>
                            </div>
                            <div>
                                <p className="text-[#FF9B50] font-black text-sm flex items-center gap-1.5"><span className="text-base leading-none">✨</span> 福利二：好评返券</p>
                                <p className="text-white/70 text-xs mt-0.5 ml-6">吃得开心吗？只要带图评价，即送 RM 1专属回购券（下次抵扣）！</p>
                            </div>
                        </div>
                    </div>

                    <ul className="space-y-2 mb-4">
                        {['纯天然，0 味精提鲜', '轻盐减油，吃完不口干', '每日巴刹鲜购优质肉'].map((feat, idx) => (
                            <li key={idx} className="flex items-center gap-2.5 text-xs md:text-sm font-bold text-white/90">
                                <CheckCircle2 size={16} className="text-[#FF6B35]" /> {feat}
                            </li>
                        ))}
                    </ul>

                    <div className="text-center font-bold text-xs md:text-sm text-white/80 mt-auto pt-2">
                        数量有限，先到先得！<br/>
                        <span className="text-[#FF9B50] inline-block mt-1">👇 马上点击下单，抢今天的名额</span>
                    </div>
                </div>
                <div className="w-full relative group mt-8 lg:mt-10 z-30">
                    {/* Glowing background Layer with Strong Breathe effect */}
                    <div className="absolute -inset-1.5 bg-gradient-to-r from-[#FF6B35]/70 to-[#FF9B50]/70 rounded-[34px] animate-breathe opacity-70 transition duration-500 group-hover:opacity-100 group-hover:blur-2xl"></div>
                    
                    <div
                        className="relative bg-[#FF6B35] rounded-[32px] p-6 md:p-7 flex flex-col justify-center cursor-pointer hover:bg-[#E95D31] transition-all duration-300 transform group-hover:-translate-y-1 border border-white/10 mt-3"
                        onClick={() => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                        {/* Microcopy Pill - Half outside, half inside, above the arrow */}
                        <div className="absolute -top-4 right-3 md:right-6 z-[40] transition-transform duration-300 transform origin-bottom group-hover:-translate-y-1">
                            <span className="inline-flex items-center gap-1 bg-[#FFF3E0] text-[#E65100] px-3 py-1.5 rounded-full text-[9px] md:text-xs font-black shadow-lg border-2 border-white -rotate-3 group-hover:rotate-0 transition-all">
                                <span className="text-sm">🍲</span> <span className="whitespace-nowrap">限量现煮，家的味道</span>
                            </span>
                        </div>

                        <div className="flex justify-between items-center relative z-0">
                            <div className="flex flex-col items-start gap-1">
                                <p className="font-extrabold text-2xl md:text-3xl text-white tracking-tight">探索每日精选</p>
                                <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mt-1">Explore Menu</p>
                            </div>
                            <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white flex items-center justify-center text-[#FF6B35] group-hover:scale-110 shadow-xl shrink-0 transition-transform duration-300 mt-2">
                                <ArrowRight size={20} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
