"use client";

import { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';

type CutoffInfo = {
    hoursLeft: number;
    minutesLeft: number;
    secondsLeft: number;
    isToday: boolean;
};

function computeCutoff(now: Date): CutoffInfo {
    const today6am = new Date(now);
    today6am.setHours(6, 0, 0, 0);

    let cutoff: Date;
    let isToday: boolean;
    if (now < today6am) {
        cutoff = today6am;
        isToday = true;
    } else {
        cutoff = new Date(today6am);
        cutoff.setDate(cutoff.getDate() + 1);
        isToday = false;
    }

    while (cutoff.getDay() === 6 || cutoff.getDay() === 0) {
        cutoff.setDate(cutoff.getDate() + 1);
    }

    const diffMs = Math.max(0, cutoff.getTime() - now.getTime());
    const totalSec = Math.floor(diffMs / 1000);
    const hoursLeft = Math.floor(totalSec / 3600);
    const minutesLeft = Math.floor((totalSec % 3600) / 60);
    const secondsLeft = totalSec % 60;

    return { hoursLeft, minutesLeft, secondsLeft, isToday };
}

const pad = (n: number) => n.toString().padStart(2, '0');

export default function CutoffBannerEN() {
    const [info, setInfo] = useState<CutoffInfo | null>(null);

    useEffect(() => {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const tick = () => setInfo(computeCutoff(new Date()));
        tick();
        const id = setInterval(tick, reduceMotion ? 60_000 : 1_000);
        return () => clearInterval(id);
    }, []);

    const scrollToMenu = () => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' });

    if (!info) {
        return (
            <div className="lg:col-span-12 -mb-2 flex justify-center">
                <div className="h-9 w-72 rounded-full bg-[#FFF3E0] border border-[#FF6B35]/20" />
            </div>
        );
    }

    const { hoursLeft, minutesLeft, secondsLeft, isToday } = info;
    const totalMinLeft = hoursLeft * 60 + minutesLeft;

    const tier = totalMinLeft >= 240 ? 'calm' : totalMinLeft >= 60 ? 'soon' : 'urgent';

    const tierClasses = {
        calm: 'bg-[#FFF3E0] border-[#FF6B35]/25 text-[#1A2D23]/90',
        soon: 'bg-[#FFE9C2] border-[#FF6B35]/40 text-[#C84518]',
        urgent: 'bg-[#FFE4D6] border-[#FF6B35]/60 text-[#C84518]',
    }[tier];

    const dotClasses = {
        calm: 'bg-[#34A853]',
        soon: 'bg-[#FF9B50]',
        urgent: 'bg-[#FF6B35] animate-pulse',
    }[tier];

    const label = isToday ? "Today's cutoff · 06:00" : "Next cutoff · 06:00 tomorrow";

    return (
        <div className="lg:col-span-12 -mb-2 flex justify-center">
            <button
                type="button"
                onClick={scrollToMenu}
                aria-label={`${label}, ${hoursLeft}h ${minutesLeft}m left. Tap to view menu.`}
                className={`group inline-flex items-center gap-2.5 px-3.5 md:px-4 py-1.5 rounded-full text-[12px] md:text-[13px] font-bold shadow-sm border transition-[background-color,border-color,transform] duration-200 ease-out hover:brightness-95 active:scale-[0.98] ${tierClasses}`}
            >
                <span className={`w-2 h-2 rounded-full shrink-0 ${dotClasses}`} aria-hidden="true" />

                <span className="whitespace-nowrap">{label}</span>

                <span className="w-px h-3.5 bg-current opacity-15" aria-hidden="true" />

                <span className="tabular-nums tracking-tight font-black whitespace-nowrap">
                    {pad(hoursLeft)}
                    <span className="opacity-40 mx-0.5">:</span>
                    {pad(minutesLeft)}
                    <span className="opacity-40 mx-0.5">:</span>
                    {pad(secondsLeft)}
                </span>

                <ArrowRight
                    size={12}
                    strokeWidth={2.5}
                    className="shrink-0 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-[transform,opacity] duration-150 ease-out"
                />
            </button>
        </div>
    );
}
