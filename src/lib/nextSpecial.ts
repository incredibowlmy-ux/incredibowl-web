import { weeklyMenu, MenuItem } from '@/data/weeklyMenu';

export interface NextSpecial {
    dish: MenuItem;
    labelZh: string;
    labelEn: string;
    dateLine: string;
}

/**
 * Compute the next available special dish based on the 06:00 cutoff.
 * Skips weekends. Falls back to the signature daily dish (id 13) if no
 * weekly special exists for the next available weekday (e.g., Tuesday).
 *
 * Lives in /lib so both HeroSection (display) and the deep-link prefill
 * handler in page.tsx can share the exact same dish.
 */
export function computeNextSpecial(): NextSpecial {
    const now = new Date();
    const isPastCutoff = now.getHours() >= 6;

    const next = new Date(now);
    next.setDate(now.getDate() + (isPastCutoff ? 1 : 0));
    if (next.getDay() === 6) next.setDate(next.getDate() + 2);
    else if (next.getDay() === 0) next.setDate(next.getDate() + 1);

    const targetWd = next.getDay();
    const weeklySpecial = weeklyMenu.find(d => d.day !== 'Daily / 常驻' && d.id === targetWd);
    const fallback = weeklyMenu.find(d => d.id === 13) ?? weeklyMenu[0];
    const dish = weeklySpecial ?? fallback;

    const nowMid = new Date(now).setHours(0, 0, 0, 0);
    const nextMid = new Date(next).setHours(0, 0, 0, 0);
    const diff = Math.round((nextMid - nowMid) / 86400000);

    const wdCn = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const wdEn = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    let labelZh = '今日特餐';
    let labelEn = "TODAY'S SPECIAL";
    if (diff === 1) { labelZh = '明日特餐'; labelEn = "TOMORROW'S SPECIAL"; }
    else if (diff === 2) { labelZh = '后日特餐'; labelEn = "DAY AFTER SPECIAL"; }

    const dateLine = `${next.getMonth() + 1}月${next.getDate()}日 · ${wdCn[targetWd]} / ${wdEn[targetWd]}`;

    return { dish, labelZh, labelEn, dateLine };
}
