"use client";

import { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';

type CutoffInfo = {
    daysLeft: number;
    hoursLeft: number;
    minutesLeft: number;
    secondsLeft: number;
    labelDay: string;
};

const ZH_WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/**
 * Compute time until next 06:00 cutoff. Skips Sat/Sun (kitchen closed).
 * Pre-cutoff (00:00-05:59): countdown to today's 06:00
 * Post-cutoff: countdown to next weekday 06:00
 *
 * labelDay reflects the actual cutoff day:
 *   今日 (cutoff is today)
 *   明日 (cutoff is tomorrow, no weekend skip)
 *   周一/二/三/四/五 (any further out, e.g. Fri afternoon → Mon)
 */
function computeCutoff(now: Date): CutoffInfo {
    const today6am = new Date(now);
    today6am.setHours(6, 0, 0, 0);

    let cutoff: Date;
    if (now < today6am) {
        cutoff = today6am;
    } else {
        cutoff = new Date(today6am);
        cutoff.setDate(cutoff.getDate() + 1);
    }

    while (cutoff.getDay() === 6 || cutoff.getDay() === 0) {
        cutoff.setDate(cutoff.getDate() + 1);
    }

    // Calendar-day distance (today vs cutoff day, ignoring time-of-day).
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfCutoffDay = new Date(cutoff);
    startOfCutoffDay.setHours(0, 0, 0, 0);
    const dayDiff = Math.round(
        (startOfCutoffDay.getTime() - startOfToday.getTime()) / 86_400_000
    );

    let labelDay: string;
    if (dayDiff === 0) labelDay = '今日';
    else if (dayDiff === 1) labelDay = '明日';
    else labelDay = ZH_WEEKDAYS[cutoff.getDay()];

    const diffMs = Math.max(0, cutoff.getTime() - now.getTime());
    const totalSec = Math.floor(diffMs / 1000);
    const daysLeft = Math.floor(totalSec / 86_400);
    const hoursLeft = Math.floor((totalSec % 86_400) / 3600);
    const minutesLeft = Math.floor((totalSec % 3600) / 60);
    const secondsLeft = totalSec % 60;

    return { daysLeft, hoursLeft, minutesLeft, secondsLeft, labelDay };
}

const pad = (n: number) => n.toString().padStart(2, '0');

export default function CutoffBanner() {
    const [info, setInfo] = useState<CutoffInfo | null>(null);

    useEffect(() => {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const tick = () => setInfo(computeCutoff(new Date()));
        tick();
        // 1Hz live ticker; 60s if user prefers reduced motion
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

    const { daysLeft, hoursLeft, minutesLeft, secondsLeft, labelDay } = info;
    const totalMinLeft = daysLeft * 1440 + hoursLeft * 60 + minutesLeft;
    const crossesDay = daysLeft > 0;

    // Three urgency tiers — color shifts smoothly as time decreases
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

    const label = `${labelDay} 06:00 截单`;

    return (
        <div className="lg:col-span-12 -mb-2 flex justify-center">
            <button
                type="button"
                onClick={scrollToMenu}
                aria-label={`${label}，还剩${crossesDay ? ` ${daysLeft} 天` : ''} ${hoursLeft} 小时 ${minutesLeft} 分钟。点击查看菜单`}
                className={`group inline-flex items-center gap-2.5 px-3.5 md:px-4 py-1.5 rounded-full text-[12px] md:text-[13px] font-bold shadow-sm border backdrop-blur-sm transition-[background-color,border-color,transform] duration-200 ease-out hover:brightness-95 active:scale-[0.98] ${tierClasses}`}
            >
                {/* Status dot */}
                <span className={`w-2 h-2 rounded-full shrink-0 ${dotClasses}`} aria-hidden="true" />

                {/* Label */}
                <span className="whitespace-nowrap">{label}</span>

                {/* Subtle separator */}
                <span className="w-px h-3.5 bg-current opacity-15" aria-hidden="true" />

                {/* Live ticker — boarding-pass-style segmented key blocks (Apple Card / Stripe).
                    < 24h: HH:MM:SS  ·  ≥ 24h: Dd:HH:MM (drop seconds, add days suffix) */}
                <span className="inline-flex items-center whitespace-nowrap" aria-hidden="true">
                    {crossesDay && (
                        <>
                            <span className="inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded-md bg-white/85 font-black tabular-nums tracking-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.06)] border border-black/[0.04]">
                                {daysLeft}<span className="text-[9px] opacity-60 ml-0.5">d</span>
                            </span>
                            <span className="opacity-30 mx-0.5 font-bold">:</span>
                        </>
                    )}
                    <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-md bg-white/85 font-black tabular-nums tracking-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.06)] border border-black/[0.04]">
                        {pad(hoursLeft)}
                    </span>
                    <span className="opacity-30 mx-0.5 font-bold">:</span>
                    <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-md bg-white/85 font-black tabular-nums tracking-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.06)] border border-black/[0.04]">
                        {pad(minutesLeft)}
                    </span>
                    {!crossesDay && (
                        <>
                            <span className="opacity-30 mx-0.5 font-bold">:</span>
                            <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-md bg-white/85 font-black tabular-nums tracking-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.06)] border border-black/[0.04]">
                                {pad(secondsLeft)}
                            </span>
                        </>
                    )}
                </span>

                {/* Action affordance */}
                <ArrowRight
                    size={12}
                    strokeWidth={2.5}
                    className="shrink-0 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-[transform,opacity] duration-150 ease-out"
                />
            </button>
        </div>
    );
}
