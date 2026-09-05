/**
 * 加料弹窗的「分区」数据：默认配菜/单点两区 + 按菜品定制（专属套餐、专属配菜、
 * 单点过滤）。原先整段住在 AddOnModal.tsx 的 useMemo 里（C2 搬家，逻辑逐字未动），
 * 拆出来是为了能脱离 React 跑 dogfood / golden 比对。
 */
import { ADD_ON_PRICES } from '@/data/addOnsConfig';
import { DISH_COMBOS } from '@/data/dishCombos';
import type { ComboPart, DishCombo, SideDef } from '@/data/dishCombos';

/** Resolve add-on price from the centralized config (single source of truth). */
function p(id: string, fallback: number): number {
    return ADD_ON_PRICES[id] ?? fallback;
}

/** "RM X.XX" of an add-on at its live price — for itemized combo 包含 lines. */
function rm(id: string, fallback: number): string {
    return `RM ${p(id, fallback).toFixed(2)}`;
}

/**
 * 套餐「包含」行末尾的价值锚（中/英）：组件单点合计 + 立省额，全部从
 * ADD_ON_PRICES 现算 —— 调组件价/套餐价时这段文案自动跟上，不用手改。
 * ⚠️ 套餐 item.name 里的静态「(原价 RM …)」是订单/备餐 label key
 * （dishIngredients 按它查配方），组件调价时才手动改它并保留 legacy key。
 */
function comboWorth(comboId: string, comboFallback: number, parts: [string, number][]): { zh: string; en: string } {
    const total = parts.reduce((s, [id, fb]) => s + p(id, fb), 0);
    const save = total - p(comboId, comboFallback);
    return {
        zh: `（单点合计 RM ${total.toFixed(2)}，立省 RM ${save.toFixed(2)}）`,
        en: ` (worth RM ${total.toFixed(2)} — save RM ${save.toFixed(2)})`,
    };
}

// ─── Add-on Data ────────────────────────────────────────────────────────────

export interface AddOnItem {
    id: string;
    name: string;
    nameEn: string;
    price: number;
    image?: string;
    category: string;
    maxQty?: number;
}

export interface AddOnSection {
    id: string;
    title: string;
    titleEn: string;
    /** EN 渲染专用主标题（特惠 combo 的 titleEn 混了中文时用它兜底）。 */
    titleDisplayEn?: string;
    minSelect: number;
    maxSelect: number;
    items: AddOnItem[];
}

// Default add-on sections — can be overridden via props
export const defaultAddOnSections: AddOnSection[] = [
    {
        id: 'sides',
        title: '配菜加购',
        titleEn: 'Add-on Sides',
        minSelect: 0,
        maxSelect: 50,
        items: [
            { id: 'less-rice', name: '少饭 (150g)', nameEn: 'Less Rice', price: p('less-rice', 0), category: 'sides', maxQty: 1 },
            { id: 'extra-rice', name: '加饭 (150g)', nameEn: 'Extra Rice', price: p('extra-rice', 2), category: 'sides' },
            { id: 'brown-rice', name: '白饭换糙米 (180g)', nameEn: 'Swap Brown Rice', price: p('brown-rice', 2), category: 'sides', maxQty: 1 },
        ]
    },
    {
        id: 'alacarte',
        title: '单点',
        titleEn: 'A La Carte',
        minSelect: 0,
        maxSelect: 30,
        items: [
            { id: 'sunny-egg', name: '荷包蛋', nameEn: 'Sunny Side Up Egg', price: p('sunny-egg', 2.50), category: 'alacarte' },
            { id: 'onsen-egg', name: '温泉蛋', nameEn: 'Onsen Egg', price: p('onsen-egg', 3), category: 'alacarte' },
            { id: 'potato-egg', name: '马铃薯煎蛋', nameEn: 'Potato Fried Egg', price: p('potato-egg', 4.00), image: '/potato_fried_egg.webp', category: 'alacarte' },
            { id: 'broccoli-egg', name: '蒜蓉西兰花炒蛋', nameEn: 'Garlic Broccoli with Soft-Scrambled Egg', price: p('broccoli-egg', 10.90), image: '/broccoli_egg.webp', category: 'alacarte', maxQty: 3 },
            { id: 'extra-edamame', name: '清甜水煮毛豆仁 (25g)', nameEn: 'Edamame (25g)', price: p('extra-edamame', 2.50), category: 'alacarte', maxQty: 3 },
            { id: 'extra-corn', name: '金黄甜玉米 (30g)', nameEn: 'Sweet Corn (30g)', price: p('extra-corn', 2.50), category: 'alacarte', maxQty: 3 },
        ]
    },
];

export interface DishItem {
    id: number;
    day: string;
    name: string;
    nameEn: string;
    price: number;
    image: string;
    tags: string[];
    desc: string;
    /** Daily dish restricted to these weekdays (0=Sun…6=Sat); date picker rejects others. */
    availableWeekdays?: number[];
}

/** 专属套餐区：AddOnSection 多两段说明文案（渲染层按 extraDesc / extraDescEn 取）。 */
export type ComboSection = AddOnSection & { extraDesc?: string; extraDescEn?: string };

/** 「包含：X (RM a) + Y (RM b)」—— 每个组件的显示名 + 现价。 */
function partsLine(parts: ComboPart[], en: boolean): string {
    return parts.map(pt => `${en ? pt.labelEn : pt.label} (${rm(pt.id, pt.fallback)})`).join(' + ');
}

function comboSection(c: DishCombo): ComboSection {
    const worth = comboWorth(c.item.id, c.item.fallback, c.parts.map(pt => [pt.id, pt.fallback]));
    return {
        id: c.sectionId,
        title: c.title,
        titleEn: c.titleEn,
        ...(c.titleDisplayEn !== undefined ? { titleDisplayEn: c.titleDisplayEn } : {}),
        // 所有套餐区历来都是 0 / 3（一个套餐商品最多点 3 份）。
        minSelect: 0,
        maxSelect: 3,
        extraDesc: `包含：${partsLine(c.parts, false)}${worth.zh}\n${c.quote}`,
        extraDescEn: `Includes: ${partsLine(c.parts, true)}${worth.en}\n${c.quoteEn}`,
        items: [
            { id: c.item.id, name: c.item.name, nameEn: c.item.nameEn, price: p(c.item.id, c.item.fallback), category: 'combo' },
        ],
    };
}

function sideItem(s: SideDef): AddOnItem {
    return {
        id: s.id,
        name: s.name,
        nameEn: s.nameEn,
        price: p(s.id, s.fallback),
        category: 'sides',
        ...(s.maxQty !== undefined ? { maxQty: s.maxQty } : {}),
    };
}

/**
 * 某道菜打开加料弹窗时看到的分区：DISH_COMBOS 里有配置的菜 =
 * [专属套餐区…, 配菜（专属加料在前 + 默认少饭/加饭/糙米）, 单点（按 alacarteExclude 过滤）]；
 * 没配置的菜原样返回默认分区（同一个引用，useMemo / useEffect 依赖靠它不抖）。
 *
 * ⚠️ 专属配菜一律「排在默认配菜前面」。原分支对默认配菜的处理有三种写法
 * （只留饭类、滤掉早已不存在的荷包蛋/薯煎蛋、把饭类挪到专属加料后面），对着
 * 现在的默认配菜（只有少饭/加饭/糙米三行）算出来全是同一个结果，golden 比对
 * 逐字节相同；只有传入非默认 addOnSections 时才可能有差别，而没人传。
 */
export function buildAddOnSections(dish: DishItem, addOnSections: AddOnSection[] = defaultAddOnSections): AddOnSection[] {
    const cfg = DISH_COMBOS[dish.id];
    if (!cfg) return addOnSections;
    const { sides, alacarteExclude } = cfg;
    const customSections = addOnSections.map(section => {
        if (section.id === 'sides' && sides) {
            const drop = sides.dropBase ?? [];
            return {
                ...section,
                items: [...sides.items.map(sideItem), ...section.items.filter(item => !drop.includes(item.id))],
            };
        }
        if (section.id === 'alacarte' && alacarteExclude) {
            return {
                ...section,
                items: section.items.filter(item => !alacarteExclude.includes(item.id)),
            };
        }
        return section;
    });
    return [...(cfg.combos ?? []).map(comboSection), ...customSections];
}
