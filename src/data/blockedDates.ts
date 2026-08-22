// Per-dish dates that are explicitly stopped from sale (sold out / boss manual stop).
// Format: { dishId: ['YYYY-MM-DD', ...] }
// dishId = `weeklyMenu` item `id` (a stable unique identifier; NOT the weekday —
// the dish's serve-day now lives in MenuItem.weekday).
//
// To stop a dish for a specific date:
//   - add the YYYY-MM-DD (MYT) to that dish's array
//   - menu UI + hero "next special" will roll forward to the next non-blocked occurrence
//
// Past dates are harmless (no match against future serve dates) but feel free to prune.

export const BLOCKED_DATES: Record<number, string[]> = {
    // 4 = 绍兴酒蒸花肉（2026-06-15 起改为周一特餐）。马铃薯炖花肉片自 2026-05-31 改为常驻日常菜。
    // 12 = 山药云耳海陆双鲜炒 (常驻)。老板要求 2026-06-12（周五）暂停一天。过后自动恢复。
    12: ['2026-06-12'],
};

export function isDishBlockedOn(dishId: number, ymd: string): boolean {
    return BLOCKED_DATES[dishId]?.includes(ymd) ?? false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Whole-day closures (整天售罄 / 老板临时停一天). Unlike BLOCKED_DATES (per-dish),
// these stop EVERY dish for that date. The menu rolls forward to the next open
// weekday (顺延), checkout for the date is rejected, and a sold-out notice shows.
// Format: ['YYYY-MM-DD', ...] in Malaysia time. Past dates auto-stop showing.
//
// 每条带 reason —— 「售罄」和「放假」对客户是两件事，首页横幅按它分文案。
// 只加日期不写 reason 会 TS 报错，逼着以后每次都想一下写哪种。
export type ClosureReason = 'soldout' | 'holiday';
export interface Closure { date: string; reason: ClosureReason }

// 2026-06-19（周五）：老板临时停一天，顺延到下周一。过后自动恢复，删掉即可。
// 2026-08-31 ~ 09-02（周一~周三）：老板放假。最后一餐是 08-28 周五午餐
//   （见下方 DINNER_CLOSED_DATES），09-03 周四复工 —— 复工日不写死，
//   nextOpenDayAfter 自己从这张表推。8/29 周六、8/30 周日本来就不营业，不必列。
export const CLOSURES: Closure[] = [
    { date: '2026-06-19', reason: 'soldout' },
    { date: '2026-08-31', reason: 'holiday' },
    { date: '2026-09-01', reason: 'holiday' },
    { date: '2026-09-02', reason: 'holiday' },
];

export const CLOSED_DATES: string[] = CLOSURES.map(c => c.date);

// ─────────────────────────────────────────────────────────────────────────────
// Dinner-only closures：当天照送午餐，晚市不出。用于「厨房做完午餐就收工」的
// 日子（例：长假前最后一天）。整天不开请用 CLOSED_DATES，别两边都写。
//
// 2026-08-28（周五）：放假前最后一餐，只送午餐。
export const DINNER_CLOSED_DATES: string[] = ['2026-08-28'];

/** True if that date delivers lunch only (dinner slot closed). */
export function isDinnerClosedOn(ymd: string): boolean {
    return DINNER_CLOSED_DATES.includes(ymd);
}

/** True if the whole day is closed (sold out / boss stop). */
export function isDateClosed(ymd: string): boolean {
    return CLOSED_DATES.includes(ymd);
}

/** 停业原因，给「为什么这天不能选」的文案分流。没停业返回 null。 */
export function closureReasonOn(ymd: string): ClosureReason | null {
    return CLOSURES.find(c => c.date === ymd)?.reason ?? null;
}

/** Upcoming closures (today or later) for the sold-out notice. Empty when none. */
export function upcomingClosedDates(todayYmd: string): string[] {
    return CLOSED_DATES.filter(d => d >= todayYmd).sort();
}

/** Same, but keeping each closure's reason so the notice can word it correctly. */
export function upcomingClosures(todayYmd: string): Closure[] {
    return CLOSURES.filter(c => c.date >= todayYmd).sort((a, b) => a.date.localeCompare(b.date));
}

/** Upcoming lunch-only days (today or later). */
export function upcomingDinnerClosedDates(todayYmd: string): string[] {
    return DINNER_CLOSED_DATES.filter(d => d >= todayYmd).sort();
}

/**
 * 下一个能送货的日子：跳过周末和 CLOSED_DATES。用来推「几号复工」，
 * 免得文案里再手写一遍复工日期，改了排休却忘了改文案。
 */
export function nextOpenDayAfter(ymd: string): string {
    const [y, m, d] = ymd.split('-').map(Number);
    const cur = new Date(Date.UTC(y, m - 1, d));
    for (let i = 0; i < 60; i++) {
        cur.setUTCDate(cur.getUTCDate() + 1);
        const wd = cur.getUTCDay();
        if (wd === 0 || wd === 6) continue;
        const next = cur.toISOString().slice(0, 10);
        if (!isDateClosed(next)) return next;
    }
    return '';
}
