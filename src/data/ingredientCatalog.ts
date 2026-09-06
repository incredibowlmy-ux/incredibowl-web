/**
 * 食材主数据 —— 采购分类 + 「配方里用到的全部食材」派生表。
 *
 * 解决两件事（老板 2026-08-10 提）：
 *  1. 盘点表按拼音排序，肉菜调料混在一起看不清 → 给每个食材一个采购类别，
 *     dashboard 按类别分组显示（顺序＝碗妈买菜的动线：肉 → 海鲜 → 蛋 →
 *     菜 → 米 → 调味干货）。
 *  2. 盘点表只列「已建档 ∪ 当日订单需要」，所以配方里有、但今天没订单的
 *     食材（如周五才卖的猪扒）整个不出现 → ALL_RECIPE_INGREDIENTS 从
 *     dishRecipes/addOnRecipes **派生**，配方里加了新食材，盘点表自动就有，
 *     不需要另外维护一张清单，也不会漏。
 *
 * 新食材的类别：先查 EXPLICIT_CATEGORY（人工确认过的），没有就跑
 * CATEGORY_RULES 按名字关键词猜。猜错了就在 EXPLICIT_CATEGORY 加一行——
 * 那是唯一需要人手维护的地方，且漏了也只是归进「其他」，不会消失。
 */

import { dishRecipes, addOnRecipes } from './dishIngredients';
import { PACKAGING_ITEMS } from './packaging';

export type IngredientCategory = '肉类' | '海鲜' | '蛋类' | '蔬菜' | '米·主食' | '调味·干货' | '包装' | '其他';

/** 显示顺序 + 图标 —— dashboard 按这个顺序排组。 */
export const CATEGORY_ORDER: { key: IngredientCategory; icon: string }[] = [
  { key: '肉类', icon: '🥩' },
  { key: '海鲜', icon: '🐟' },
  { key: '蛋类', icon: '🥚' },
  { key: '蔬菜', icon: '🥬' },
  { key: '米·主食', icon: '🍚' },
  { key: '调味·干货', icon: '🫙' },
  { key: '包装', icon: '🥡' },
  { key: '其他', icon: '📦' },
];

/**
 * 人工确认过的归类（2026-08-10 覆盖当时全部 41 种）。
 * 关键词规则猜不准的都在这里钉死：
 *   · 臭豆是湿市场买的蔬菜，但名字含「豆」会被误判成纳豆那类调味
 *   · 纳豆是盒装冷藏调味料，名字含「豆」却不是蔬菜
 *   · 黑橄榄是罐装腌渍品，不跟着鲜蔬走
 *   · 当归是药材，归干货
 *   · 温泉蛋是半成品但采购上跟鸡蛋同类
 */
const EXPLICIT_CATEGORY: Record<string, IngredientCategory> = {
  // ── 肉类 ──
  // 三条独立采购线，不是同一块肉的不同叫法：焖/蒸/炒那三道用无皮，
  // 白萝卜那道用有皮，马铃薯那道是梅花（肩胛）部位。
  '顶级无皮五花肉': '肉类', '顶级有皮五花肉': '肉类', '顶级梅花肉片': '肉类',
  // 旧名（2026-08-10 前叫「五花肉」）—— 历史流水/旧库存文档还可能带它，
  // 留着保证那些记录不会掉进「其他」。
  '五花肉': '肉类',
  '鸡扒': '肉类', '鸡全腿': '肉类', '鸡胸肉': '肉类',
  '排骨': '肉类', '猪扒': '肉类', '澳洲和牛饼': '肉类',
  // ── 海鲜 ──
  '三文鱼': '海鲜', '巴丁鱼片': '海鲜', '鳗鱼': '海鲜',
  'PD31/40 虾': '海鲜', 'PD51/60 虾': '海鲜',
  // ── 蛋类 ──
  '鸡蛋(生)': '蛋类', '温泉蛋': '蛋类',
  // ── 蔬菜 ──
  '白萝卜': '蔬菜', '红萝卜': '蔬菜', '黄洋葱': '蔬菜', '西兰花': '蔬菜',
  '椰菜花': '蔬菜', '马铃薯': '蔬菜', '山药': '蔬菜', '云耳': '蔬菜',
  '玉米': '蔬菜', '毛豆': '蔬菜', '樱桃番茄': '蔬菜', '时蔬': '蔬菜',
  '臭豆': '蔬菜', '葱': '蔬菜', '姜': '蔬菜', '柠檬': '蔬菜',
  // 豆腐：没有「豆制品」这一类，采购上跟蔬菜同属湿货、同一趟买，归蔬菜。
  // 兜底规则的 /豆/ 本来也会判成蔬菜，写死是为了以后改规则时不会漂走。
  '豆腐': '蔬菜',
  // ── 米·主食 ──
  '白饭': '米·主食', '糙米': '米·主食',
  // ── 调味·干货 ──
  '酱油': '调味·干货', 'sambal': '调味·干货', '咖喱块': '调味·干货',
  '海苔': '调味·干货', '纳豆': '调味·干货', '当归': '调味·干货',
  '黑橄榄': '调味·干货',
  // ── 包装 ──（碗不是配方食材，见 src/data/packaging.ts）
  '1000ml 打包碗': '包装', '750ml 打包碗': '包装', '纸袋': '包装',
};

/**
 * 新食材的兜底猜测 —— 按顺序匹配，第一条命中即采用。
 * 顺序有意义：肉/海鲜/蛋在前，因为「鸡蛋」含「鸡」、「鱼片」含「片」，
 * 靠后的宽泛规则会抢错。
 */
const CATEGORY_RULES: { cat: IngredientCategory; re: RegExp }[] = [
  { cat: '蛋类', re: /蛋/ },
  // 蚝(?!油)：「生蚝」是海鲜，「蚝油」是调味 —— 少了这个否定前瞻，蚝油会被
  // 这条先抢走（海鲜规则排在调味之前）。
  { cat: '海鲜', re: /鱼|虾|蟹|鳗|贝|带子|扇贝|鲍|蚌|鱿|蛤|海鲜|蚝(?!油)|PD\d/i },
  { cat: '肉类', re: /五花|花肉|鸡扒|鸡腿|鸡胸|鸡翅|排骨|猪|牛|羊|鸭|肉|培根|香肠|火腿/ },
  // 调味必须排在「米·主食」之前：否则「米酒」会被米规则的 /米/ 抢成主食。
  // 同理 油(?!菜) 保住「油菜」归蔬菜。
  { cat: '调味·干货', re: /酱|醋|盐|糖|油(?!菜)|酒|咖喱|香料|胡椒|海苔|紫菜|当归|党参|枸杞|罐|腌|sambal|粉$/i },
  { cat: '米·主食', re: /饭|米|面条|米粉|意粉|乌冬/ },
  { cat: '蔬菜', re: /菜|萝卜|洋葱|薯|山药|耳|菇|瓜|茄|葱|姜|蒜|椒|豆|玉米|柠檬|果|苗|芽/ },
];

/** 食材名 → 采购类别。未知食材归「其他」，不会消失。 */
export function categorizeIngredient(name: string): IngredientCategory {
  const n = String(name || '').trim();
  if (!n) return '其他';
  if (EXPLICIT_CATEGORY[n]) return EXPLICIT_CATEGORY[n];
  for (const { cat, re } of CATEGORY_RULES) {
    if (re.test(n)) return cat;
  }
  return '其他';
}

export interface CatalogIngredient {
  name: string;
  /** 配方里登记的单位（g / ml / 颗 / 只 / 块 / 盒 / 片 / 份 / 汤匙…） */
  unit: string;
  category: IngredientCategory;
}

/**
 * 配方里用到的全部食材（主菜 + 加料，去重）+ 打包碗（PACKAGING_ITEMS）。
 * 派生自 dishRecipes / addOnRecipes —— 加新菜或新加料时只要在
 * dishIngredients.ts 写配方，这里自动多出来，盘点表也跟着有。
 */
export const ALL_RECIPE_INGREDIENTS: CatalogIngredient[] = (() => {
  const byName = new Map<string, string>();   // name → unit（首次出现的单位为准）
  for (const r of dishRecipes) {
    for (const l of r.ingredients) if (!byName.has(l.name)) byName.set(l.name, l.unit);
  }
  for (const lines of Object.values(addOnRecipes)) {
    for (const l of lines) if (!byName.has(l.name)) byName.set(l.name, l.unit);
  }
  // 打包碗：不在配方里，但要跟食材一起盘点/扣减（2026-09-06）。
  for (const p of PACKAGING_ITEMS) if (!byName.has(p.name)) byName.set(p.name, p.unit);
  return [...byName.entries()]
    .map(([name, unit]) => ({ name, unit, category: categorizeIngredient(name) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
})();

/**
 * 厨房加工：用原料现做成半成品，两边都是真实库存。
 *
 * 老板 2026-08-10 定的模型 —— 他习惯一次做 20 颗温泉蛋放着，所以温泉蛋
 * 不该只是「下单时折算成生蛋」，它本身就是冰箱里数得出来的成品。
 * dashboard 上按一次「用生鸡蛋做」＝ 扣生蛋、加温泉蛋，两边各留一条流水。
 *
 * inputPerOutput：产出 1 个成品要投入多少原料（>1 即损耗）。
 * 温泉蛋 1 颗生蛋做 1 颗，按 1.1 计破损（老板给的数，不是我推的）。
 *
 * 加新加工品：这里加一条即可，API 白名单和 dashboard 按钮都读这张表。
 */
export interface IngredientConversion {
  /** 成品（库存里独立的一项） */
  to: string;
  /** 原料 */
  from: string;
  /** 产出 1 个成品要投入的原料数量（含损耗） */
  inputPerOutput: number;
  /** dashboard 按钮文案 */
  buttonLabel: string;
}

export const INGREDIENT_CONVERSIONS: IngredientConversion[] = [
  { to: '温泉蛋', from: '鸡蛋(生)', inputPerOutput: 1.1, buttonLabel: '用生鸡蛋做' },
];

/** 这个食材是不是「可以现做」的成品？是就返回它的加工配方。 */
export function getConversionFor(name: string): IngredientConversion | undefined {
  return INGREDIENT_CONVERSIONS.find(c => c.to === name);
}

/**
 * 做 outputQty 个成品要投入多少原料。
 * 向上取整：原料是整颗的（蛋/块），做 15 颗要打 16.5 颗蛋 → 实际得开 17 颗，
 * 按 16.5 记账会让生蛋余额虚高。宁多勿少，与配方表的一贯口径一致。
 */
export function conversionInputQty(conv: IngredientConversion, outputQty: number): number {
  // ⚠️ 先抹掉浮点尘埃再判整数：100 × 1.1 在 IEEE754 下 = 110.00000000000001，
  // 直接 Number.isInteger 会判成小数并向上取整成 111 —— 每做 100 颗白吃
  // 一颗蛋的账。（dogfood-ingredient-conversion.mts 就是拿这个用例抓到的。）
  const raw = Math.round(outputQty * conv.inputPerOutput * 1e6) / 1e6;
  return Number.isInteger(raw) ? raw : Math.ceil(raw);
}

/** 排序用：类别在 CATEGORY_ORDER 里的位置（未知类别排最后）。 */
export function categoryRank(cat: string): number {
  const i = CATEGORY_ORDER.findIndex(c => c.key === cat);
  return i < 0 ? CATEGORY_ORDER.length : i;
}
