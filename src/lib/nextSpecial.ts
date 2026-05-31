import { weeklyMenu, MenuItem } from '@/data/weeklyMenu';
import { isDishBlockedOn } from '@/data/blockedDates';

export interface NextSpecial {
    dish: MenuItem;
    labelZh: string;
    labelEn: string;
    dateLine: string;
}

/**
 * Compute the next available special dish based on the 06:00 cutoff.
 * Skips weekends. Falls back to the signature daily Chicken Chop (id 14)
 * if no weekly special exists for the next available weekday.
 *
 * Lives in /lib so both HeroSection (display) and the deep-link prefill
 * handler in page.tsx can share the exact same dish.
 */
export function computeNextSpecial(): NextSpecial {
    // Compute against Asia/Kuala_Lumpur wall-clock (UTC+8, no DST) so the result
    // is identical on the server (runs in UTC) and the client (any timezone).
    // This lets HeroSection render the special during SSR for a stable, early
    // LCP without a hydration mismatch. We shift the UTC instant by +8h and read
    // the UTC getters, which then reflect MYT wall-clock time.
    const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;
    const now = new Date(Date.now() + MYT_OFFSET_MS);
    const isPastCutoff = now.getUTCHours() >= 6;

    const next = new Date(now);
    next.setUTCDate(now.getUTCDate() + (isPastCutoff ? 1 : 0));
    if (next.getUTCDay() === 6) next.setUTCDate(next.getUTCDate() + 2);
    else if (next.getUTCDay() === 0) next.setUTCDate(next.getUTCDate() + 1);

    // If the weekly special on `next` is explicitly blocked on that date,
    // advance day-by-day (skipping weekends) until we find a non-blocked day.
    // Hero then shows the next genuinely-available special (labels adjust to
    // 今日 / 明日 / 后日 / explicit date automatically below).
    const ymdUTC = (d: Date) =>
        `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    let skipSafety = 14;
    while (skipSafety-- > 0) {
        const wd = next.getUTCDay();
        const wkly = weeklyMenu.find(d => d.day !== 'Daily / 常驻' && d.id === wd);
        if (wkly && isDishBlockedOn(wkly.id, ymdUTC(next))) {
            next.setUTCDate(next.getUTCDate() + 1);
            if (next.getUTCDay() === 6) next.setUTCDate(next.getUTCDate() + 2);
            else if (next.getUTCDay() === 0) next.setUTCDate(next.getUTCDate() + 1);
            continue;
        }
        break;
    }

    const targetWd = next.getUTCDay();
    const weeklySpecial = weeklyMenu.find(d => d.day !== 'Daily / 常驻' && d.id === targetWd);
    const fallback = weeklyMenu.find(d => d.id === 14) ?? weeklyMenu[0];
    const dish = weeklySpecial ?? fallback;

    const nowMid = new Date(now).setUTCHours(0, 0, 0, 0);
    const nextMid = new Date(next).setUTCHours(0, 0, 0, 0);
    const diff = Math.round((nextMid - nowMid) / 86400000);

    const wdCn = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const wdEn = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    let labelZh = '今日特餐';
    let labelEn = "TODAY'S SPECIAL";
    if (diff === 1) { labelZh = '明日特餐'; labelEn = "TOMORROW'S SPECIAL"; }
    else if (diff === 2) { labelZh = '后日特餐'; labelEn = "DAY AFTER SPECIAL"; }

    const dateLine = `${next.getUTCMonth() + 1}月${next.getUTCDate()}日 · ${wdCn[targetWd]} / ${wdEn[targetWd]}`;

    return { dish, labelZh, labelEn, dateLine };
}
