"use client";

import { useEffect, useState } from 'react';
import { todayInMY } from '@/lib/cartDateUtils';
import { upcomingClosedDates } from '@/data/blockedDates';

const WD_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(ymd: string, locale: 'zh' | 'en'): string {
    const [y, m, d] = ymd.split('-').map(Number);
    const wd = new Date(y, m - 1, d).getDay();
    return locale === 'zh' ? `${m}月${d}日（${WD_ZH[wd]}）` : `${WD_EN[wd]} ${d} ${MON_EN[m - 1]}`;
}

/**
 * Sold-out / closed-day notice. Reads whole-day closures from blockedDates.
 * Mount-gated (renders only after the client computes today's date) so it never
 * appears in SSR output — avoids hydration mismatch on the statically prerendered
 * home page. Auto-hides once the closed date has passed.
 */
export default function SoldOutNotice({ locale = 'zh' }: { locale?: 'zh' | 'en' }) {
    const [dates, setDates] = useState<string[]>([]);
    useEffect(() => { setDates(upcomingClosedDates(todayInMY())); }, []);
    if (!dates.length) return null;

    const label = dates.map(d => fmtDate(d, locale)).join('、');
    return (
        <div className="mx-3 lg:mx-2 mb-4 rounded-xl border border-[#FF6B35]/30 bg-[#FFF4EC] px-4 py-3 flex items-start gap-2">
            <span className="text-lg leading-none" aria-hidden>📢</span>
            <p className="text-[13px] leading-relaxed text-[#9A3412] font-semibold">
                {locale === 'zh'
                    ? <>{label} 已售罄，当天暂停接单 🙏 其他日期照常，欢迎提前预订～</>
                    : <>{label} is sold out — no orders that day 🙏 Other days as usual, order ahead anytime.</>}
            </p>
        </div>
    );
}
