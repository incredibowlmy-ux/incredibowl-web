"use client";

import { useState, useEffect } from 'react';
import { Clock, AlertCircle } from 'lucide-react';

/**
 * Compute time until next 06:00 cutoff.
 * - Before today's 06:00: countdown to today 06:00 (today's lunch)
 * - After today's 06:00: countdown to tomorrow 06:00 (tomorrow's lunch)
 * Skips Sat/Sun (kitchen closed) — rolls forward to Monday 06:00 if cutoff lands on weekend.
 */
function computeCutoff(now: Date): { hoursLeft: number; minutesLeft: number; isToday: boolean; isClosed: boolean } {
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

    // Roll forward over weekends — Saturday (6) or Sunday (0)
    while (cutoff.getDay() === 6 || cutoff.getDay() === 0) {
        cutoff.setDate(cutoff.getDate() + 1);
    }

    const isClosed = cutoff.getDay() < 1 || cutoff.getDay() > 5;
    const diffMs = cutoff.getTime() - now.getTime();
    const totalMin = Math.max(0, Math.floor(diffMs / 60000));
    const hoursLeft = Math.floor(totalMin / 60);
    const minutesLeft = totalMin % 60;

    return { hoursLeft, minutesLeft, isToday, isClosed };
}

export default function CutoffBanner() {
    const [info, setInfo] = useState<ReturnType<typeof computeCutoff> | null>(null);

    useEffect(() => {
        const tick = () => setInfo(computeCutoff(new Date()));
        tick();
        const id = setInterval(tick, 60_000); // update every minute
        return () => clearInterval(id);
    }, []);

    if (!info) {
        return (
            <div className="lg:col-span-12 -mb-2 flex justify-center">
                <div className="h-9 px-4 rounded-full bg-[#FFF3E0] border border-[#FF6B35]/20" />
            </div>
        );
    }

    const { hoursLeft, minutesLeft, isToday } = info;
    const urgent = isToday && hoursLeft < 2;

    // Wrap text — keep the strip thin, single-line on lg+
    const label = isToday
        ? `今日 06:00 截单 · 还剩 ${hoursLeft}h ${minutesLeft}m · 当日中午送达`
        : `今日已截单 · 明日 06:00 前下单 · 还剩 ${hoursLeft}h ${minutesLeft}m`;

    return (
        <div className="lg:col-span-12 -mb-2 flex justify-center">
            <div
                role="status"
                aria-live="polite"
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[12px] md:text-[13px] font-bold shadow-sm border ${
                    urgent
                        ? 'bg-[#FFE4D6] border-[#FF6B35]/40 text-[#C84518] animate-pulse'
                        : 'bg-[#FFF3E0] border-[#FF6B35]/25 text-[#1A2D23]/90'
                }`}
            >
                {urgent ? (
                    <AlertCircle size={13} strokeWidth={2.5} className="shrink-0" />
                ) : (
                    <Clock size={13} strokeWidth={2.5} className="text-[#FF6B35] shrink-0" />
                )}
                <span className="truncate">{label}</span>
            </div>
        </div>
    );
}
