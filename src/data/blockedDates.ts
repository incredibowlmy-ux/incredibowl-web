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
// 2026-06-19（周五）：老板临时停一天，顺延到下周一。过后自动恢复，删掉即可。
export const CLOSED_DATES: string[] = ['2026-06-19'];

/** True if the whole day is closed (sold out / boss stop). */
export function isDateClosed(ymd: string): boolean {
    return CLOSED_DATES.includes(ymd);
}

/** Upcoming closures (today or later) for the sold-out notice. Empty when none. */
export function upcomingClosedDates(todayYmd: string): string[] {
    return CLOSED_DATES.filter(d => d >= todayYmd).sort();
}
