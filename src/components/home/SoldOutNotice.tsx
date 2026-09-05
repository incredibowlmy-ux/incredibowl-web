"use client";

import { useEffect, useState } from 'react';
import { todayInMY } from '@/lib/cartDateUtils';
import {
    upcomingClosures,
    upcomingDinnerClosedDates,
    nextOpenDayAfter,
    type Closure,
} from '@/data/blockedDates';

const WD_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(ymd: string, locale: 'zh' | 'en'): string {
    const [y, m, d] = ymd.split('-').map(Number);
    const wd = new Date(y, m - 1, d).getDay();
    return locale === 'zh' ? `${m}月${d}日（${WD_ZH[wd]}）` : `${WD_EN[wd]} ${d} ${MON_EN[m - 1]}`;
}

const joinDates = (list: string[], locale: 'zh' | 'en') =>
    list.map(d => fmtDate(d, locale)).join(locale === 'zh' ? '、' : ', ');

/**
 * Closed-day notice. Reads whole-day closures + lunch-only days from blockedDates.
 *
 * 「售罄」和「放假」分开说 —— 计划内的休假挂「已售罄」是误导客户。复工日不写死，
 * 从 CLOSURES 推（nextOpenDayAfter），排休改了文案自动跟上。
 *
 * Mount-gated (renders only after the client computes today's date) so it never
 * appears in SSR output — avoids hydration mismatch on the statically prerendered
 * home page. Auto-hides once the dates have passed.
 */
export default function SoldOutNotice({ locale = 'zh' }: { locale?: 'zh' | 'en' }) {
    const [closures, setClosures] = useState<Closure[]>([]);
    const [lunchOnly, setLunchOnly] = useState<string[]>([]);
    useEffect(() => {
        const today = todayInMY();
        setClosures(upcomingClosures(today));
        setLunchOnly(upcomingDinnerClosedDates(today));
    }, []);

    const soldOut = closures.filter(c => c.reason === 'soldout').map(c => c.date);
    const holiday = closures.filter(c => c.reason === 'holiday').map(c => c.date);
    if (!soldOut.length && !holiday.length && !lunchOnly.length) return null;

    const resume = holiday.length ? nextOpenDayAfter(holiday[holiday.length - 1]) : '';

    return (
        <div className="mx-3 lg:mx-2 mb-4 rounded-xl border border-primary/30 bg-[#FFF4EC] px-4 py-3 flex items-start gap-2">
            <span className="text-lg leading-none" aria-hidden>📢</span>
            <div className="text-[13px] leading-relaxed text-[#9A3412] font-semibold space-y-1">
                {holiday.length > 0 && (
                    <p>
                        {locale === 'zh'
                            ? <>{joinDates(holiday, 'zh')} 碗妈休息，暂停接单 🙏{resume && <> {fmtDate(resume, 'zh')} 恢复正常营业～</>}</>
                            : <>Closed {joinDates(holiday, 'en')} — we&apos;re taking a short break 🙏{resume && <> Back on {fmtDate(resume, 'en')}.</>}</>}
                    </p>
                )}
                {lunchOnly.length > 0 && (
                    <p>
                        {locale === 'zh'
                            ? <>{joinDates(lunchOnly, 'zh')} 只送午餐，晚市休息。</>
                            : <>{joinDates(lunchOnly, 'en')}: lunch delivery only — no dinner.</>}
                    </p>
                )}
                {soldOut.length > 0 && (
                    <p>
                        {locale === 'zh'
                            ? <>{joinDates(soldOut, 'zh')} 已售罄，当天暂停接单 🙏 其他日期照常，欢迎提前预订～</>
                            : <>{joinDates(soldOut, 'en')} is sold out — no orders that day 🙏 Other days as usual, order ahead anytime.</>}
                    </p>
                )}
            </div>
        </div>
    );
}
