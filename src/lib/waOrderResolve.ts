/**
 * 碗妈 WhatsApp bot 下单的菜名/加料解析 —— AI 给的是自然语言（中文菜名、
 * 加料叫法各异），这里解析成目录内的权威条目；解析不了宁可不认（返回 null /
 * 原样返回让 buildPlan 拦），绝不猜。价格永远来自服务端目录，不信 AI。
 *
 * 单独成 lib 是为了能被 scripts/dogfood-wa-order.mts 直接测（route 文件
 * 不允许导出非 handler）。
 */

import { weeklyMenu } from '@/data/weeklyMenu';
import { DISH_ADDONS_BY_NAME, type DishAddonOption } from '@/data/dishAddonMap.generated';

/** 去空格/括号/分隔符 + 小写，让「毛豆仁 (25g)」「毛豆仁25g」互相命中 */
export function normalizeLabel(s: string): string {
  return String(s || '').toLowerCase().replace(/[\s()（）【】\[\]·+＋]/g, '');
}

/**
 * 加料解析：先按 id 精确 → 再按 label 精确（归一化后）→ 最后唯一包含匹配。
 * 多个命中 = 歧义 → null（宁可让 AI 追问，也不给客户加错料）。
 */
export function resolveAddon(dishName: string, raw: string): DishAddonOption | null {
  const options = DISH_ADDONS_BY_NAME[dishName] ?? [];
  const key = normalizeLabel(raw);
  if (!key) return null;
  const byId = options.find(o => o.id === String(raw).trim());
  if (byId) return byId;
  const exact = options.find(o => normalizeLabel(o.label) === key);
  if (exact) return exact;
  const contains = options.filter(o => normalizeLabel(o.label).includes(key) || key.includes(normalizeLabel(o.label)));
  return contains.length === 1 ? contains[0] : null;
}

/**
 * 菜名解析：数字 id → 全名精确 → 唯一包含匹配 → 原样返回
 * （原样交给 buildPlan，让它按「不在菜品目录」拦下并警告）。
 */
export function resolveDishName(raw: unknown): string {
  const asNum = Number(raw);
  if (Number.isFinite(asNum) && String(raw).trim() !== '') {
    const byId = weeklyMenu.find(d => d.id === asNum);
    if (byId) return byId.name;
  }
  const s = String(raw ?? '').trim();
  if (!s) return s;
  const exact = weeklyMenu.find(d => d.name === s);
  if (exact) return exact.name;
  const key = normalizeLabel(s);
  const contains = weeklyMenu.filter(d => {
    const n = normalizeLabel(d.name);
    return n.includes(key) || key.includes(n);
  });
  if (contains.length === 1) return contains[0].name;
  return s;
}
