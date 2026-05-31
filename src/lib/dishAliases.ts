/**
 * Canonical dish-name aliases.
 *
 * Manual orders entered via the local HTML dashboard historically stored SHORT
 * dish names (e.g. "酱油鸡全腿"), while web-cart orders store the full branded
 * name from weeklyMenu ("阿嫲古早味酱油鸡全腿"). Same dish, two strings — which
 * splits kitchen-prep summaries and analytics into duplicate rows.
 *
 * Map every variant onto the canonical (full) name so they merge into one line.
 * Add a new entry here whenever a dish is renamed so historical orders stay merged.
 *
 * NOTE: Mirror of `DISH_ALIASES` in public/dashboard-h7x2q9.html — keep both in sync.
 */
export const DISH_ALIASES: Record<string, string> = {
    '招牌原盅当归清蒸鸡全腿': '招牌原盅当归蒸鸡全腿',
    '招牌虫草当归清蒸鸡全腿': '招牌原盅当归蒸鸡全腿',
    '招牌虫草当归蒸鸡全腿': '招牌原盅当归蒸鸡全腿',
    '酱油鸡全腿': '阿嫲古早味酱油鸡全腿',
};

/** Resolve a dish name to its canonical (full) form. Add-on `↳` rows pass through unchanged. */
export function canonicalDishName(name: string): string {
    if (!name) return name;
    return DISH_ALIASES[name] || name;
}
