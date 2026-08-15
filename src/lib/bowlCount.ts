/**
 * 一张订单到底占了几份「碗」—— 产能统计的唯一口径。
 *
 * 为什么不能直接 sum(items[].quantity)：加料在库里有**两种**落库形态
 * （见 memory project_manual_order_addon_item_lines）：
 *   · 网页单 → 加料是独立的一行，name 以「↳」开头（近期样本 63 行）
 *   · 手动单 → 加料嵌在 item.addOns 数组里（近期样本 60 行）
 * 直接 sum 会把网页单的加料算成碗：实测 2026-07-16 那张单 1 碗 + 8 条加料行
 * 会被算成 11 份，团餐档期立刻算错。
 *
 * 规则：**只数不以「↳」开头的行**。两种形态下这都恰好等于真实碗数。
 */

export interface BowlCountItem {
  name?: unknown;
  quantity?: unknown;
}

/** 加料行的前缀标记（网页单）。 */
const ADDON_LINE_PREFIX = '↳';

export function isAddonLine(item: BowlCountItem): boolean {
  return String(item?.name ?? '').trimStart().startsWith(ADDON_LINE_PREFIX);
}

/** 单张订单的碗数。items 缺失/畸形一律算 0，绝不抛错（产能查询挂了比算错更糟）。 */
export function bowlsInOrder(items: unknown): number {
  if (!Array.isArray(items)) return 0;
  let n = 0;
  for (const it of items) {
    if (!it || typeof it !== 'object') continue;
    if (isAddonLine(it as BowlCountItem)) continue;
    const q = Number((it as BowlCountItem).quantity);
    if (Number.isFinite(q) && q > 0) n += Math.floor(q);
  }
  return n;
}
