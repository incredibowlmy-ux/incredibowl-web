// Per-dish dates that are explicitly stopped from sale (sold out / boss manual stop).
// Format: { dishId: ['YYYY-MM-DD', ...] }
// dishId mirrors `weeklyMenu` `id` (= weekday 0-6 for weekly specials).
//
// To stop a dish for a specific date:
//   - add the YYYY-MM-DD (MYT) to that dish's array
//   - menu UI + hero "next special" will roll forward to the next non-blocked occurrence
//
// Past dates are harmless (no match against future serve dates) but feel free to prune.

export const BLOCKED_DATES: Record<number, string[]> = {
    // 4 = 绍兴酒蒸花肉 (周四特餐)。马铃薯炖花肉片自 2026-05-31 改为常驻日常菜。
};

export function isDishBlockedOn(dishId: number, ymd: string): boolean {
    return BLOCKED_DATES[dishId]?.includes(ymd) ?? false;
}
