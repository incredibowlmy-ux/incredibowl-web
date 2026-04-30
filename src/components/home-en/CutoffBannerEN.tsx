"use client";

import { useState, useEffect } from 'react';
import { Clock, AlertCircle } from 'lucide-react';

function computeCutoff(now: Date): { hoursLeft: number; minutesLeft: number; isToday: boolean } {
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

    const diffMs = cutoff.getTime() - now.getTime();
    const totalMin = Math.max(0, Math.floor(diffMs / 60000));
    const hoursLeft = Math.floor(totalMin / 60);
    const minutesLeft = totalMin % 60;

    return { hoursLeft, minutesLeft, isToday };
}

export default function CutoffBannerEN() {
    const [info, setInfo] = useState<ReturnType<typeof computeCutoff> | null>(null);

    useEffect(() => {
        const tick = () => setInfo(computeCutoff(new Date()));
        tick();
        const id = setInterval(tick, 60_000);
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

    const label = isToday
        ? `Today's cutoff in ${hoursLeft}h ${minutesLeft}m · 06:00 · Delivered same noon`
        : `Today closed · Order before 06:00 tomorrow · ${hoursLeft}h ${minutesLeft}m left`;

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
