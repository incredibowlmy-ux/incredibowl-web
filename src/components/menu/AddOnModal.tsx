"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, ChevronDown, ChevronUp, Minus, Plus, ShoppingBag, Leaf, Calendar } from 'lucide-react';
import { ADD_ON_PRICES } from '@/data/addOnsConfig';
import { isDishBlockedOn, isDateClosed } from '@/data/blockedDates';
import type { Locale } from '@/lib/locale';
import { ADDON_DICT } from './dict';

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
const defaultAddOnSections: AddOnSection[] = [
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
            { id: 'potato-egg', name: '马铃薯煎蛋', nameEn: 'Potato Fried Egg', price: p('potato-egg', 3.50), image: '/potato_fried_egg.webp', category: 'alacarte' },
            { id: 'broccoli-egg', name: '蒜蓉西兰花炒蛋', nameEn: 'Garlic Broccoli with Soft-Scrambled Egg', price: p('broccoli-egg', 10.90), image: '/broccoli_egg.webp', category: 'alacarte', maxQty: 3 },
            { id: 'extra-edamame', name: '清甜水煮毛豆仁 (25g)', nameEn: 'Edamame (25g)', price: p('extra-edamame', 2.50), category: 'alacarte', maxQty: 3 },
            { id: 'extra-corn', name: '金黄甜玉米 (30g)', nameEn: 'Sweet Corn (30g)', price: p('extra-corn', 2.50), category: 'alacarte', maxQty: 3 },
        ]
    },
];

// ─── Types ──────────────────────────────────────────────────────────────────

interface DishItem {
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

interface AddOnModalProps {
    isOpen: boolean;
    onClose: () => void;
    dish: DishItem | null;
    addOnSections?: AddOnSection[];
    onAddToCart: (dish: DishItem, addOns: { item: AddOnItem; quantity: number }[], totalPrice: number, note: string, selectedDate: string, selectedTime: string, dishQty: number, editCartItemId?: string) => void;
    defaultDate?: string;
    isDaily?: boolean;
    minDate?: string;
    dateLabel?: string;
    locale?: Locale;
    initialConfig?: {
        cartItemId: string;
        quantities: Record<string, number>;
        dishQty: number;
        note: string;
        selectedDate: string;
        selectedTime: string;
    } | null;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AddOnModal({
    isOpen,
    onClose,
    dish,
    addOnSections = defaultAddOnSections,
    onAddToCart,
    defaultDate = '',
    isDaily = false,
    minDate = '',
    dateLabel = '',
    locale = 'zh',
    initialConfig = null,
}: AddOnModalProps) {
    // 渲染层文案（zh 与旧字面量逐字一致）；加料 name 是订单 key 不经过字典。
    const t = ADDON_DICT[locale];
    const isEn = locale === 'en';
    // Track quantities per add-on item
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    // Track which sections are expanded
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    // Main dish quantity
    const [dishQty, setDishQty] = useState(1);
    // Note to restaurant
    const [note, setNote] = useState('');
    // Delivery Date and Time
    const [selectedDate, setSelectedDate] = useState("");
    const [selectedTime, setSelectedTime] = useState("");
    // Animation state
    const [isVisible, setIsVisible] = useState(false);

    // Compute dynamic add-on sections based on the selected dish
    const activeAddOnSections = React.useMemo(() => {
        if (!dish) return addOnSections;

        // If it's Natto Rice Bowl (id: 11), prepend a special combo section
        if (dish.id === 11) {
            const nattoWorth = comboWorth('natto-super-combo', 5, [['onsen-egg-side', 3], ['nori', 2], ['soy-sauce', 1.5]]);
            const nattoSpecial: AddOnSection & { extraDesc?: string; extraDescEn?: string } = {
                id: 'natto-combo',
                title: '✨ 升级你的 Incredibowl！',
                titleEn: '灵魂三件套 (Soulful Trio) (+ RM 5) · Max 3',
                titleDisplayEn: '✨ Upgrade your Incredibowl! Soulful Trio (+ RM 5) · Max 3',
                minSelect: 0,
                maxSelect: 3,
                extraDesc: `包含：浓厚温泉蛋 (${rm('onsen-egg-side', 3)}) + 脆质海苔 (${rm('nori', 2)}) + 特制日本酱油 (${rm('soy-sauce', 1.5)})${nattoWorth.zh}\n“当酱油遇见脆爽海苔，在流心月见的温柔包裹下，瞬间唤醒纳豆沉睡的‘极鲜’灵魂。”`,
                extraDescEn: `Includes: rich onsen egg (${rm('onsen-egg-side', 3)}) + crispy nori (${rm('nori', 2)}) + special Japanese soy sauce (${rm('soy-sauce', 1.5)})${nattoWorth.en}\n"When soy sauce meets crisp nori, wrapped in a silky moon-gazing egg, natto's sleeping umami soul awakens."`,
                items: [
                    // 2026-08-01 原价 6.0 → 6.50 修正：组件单点价 3.00+2.00+1.50 = 6.50，
                    // 旧标签的 6.0 与明细对不上（明细价上墙后客人会看出来）。
                    { id: 'natto-super-combo', name: '灵魂三件套 (原价 RM 6.50)', nameEn: 'Soulful Trio', price: p('natto-super-combo', 5), category: 'combo' }
                ]
            };
            const customSections = addOnSections.map(section => {
                if (section.id === 'sides') {
                    return {
                        ...section,
                        items: [
                            { id: 'natto-side', name: '健康发酵纳豆', nameEn: 'Natto', price: p('natto-side', 7.90), category: 'sides' },
                            { id: 'onsen-egg-side', name: '温泉蛋', nameEn: 'Onsen Egg', price: p('onsen-egg-side', 3), category: 'sides' },
                            { id: 'nori', name: '海苔', nameEn: 'Nori (Seaweed)', price: p('nori', 2), category: 'sides' },
                            { id: 'soy-sauce', name: '秘制日本酱油', nameEn: 'Secret Japanese Soy Sauce', price: p('soy-sauce', 1.50), category: 'sides' },
                            ...section.items.filter(item => item.id.includes('rice') && item.id !== 'brown-rice')
                        ]
                    };
                }
                if (section.id === 'alacarte') {
                    // Filter out onsen-egg from alacarte because it's already in sides for natto
                    return {
                        ...section,
                        items: section.items.filter(item => item.id !== 'onsen-egg')
                    };
                }
                return section;
            });
            return [nattoSpecial, ...customSections];
        }

        // If it's Chinese Yam & Black Fungus Surf & Turf (id: 12), prepend a special combo section
        if (dish.id === 12) {
            const surfTurfWorth = comboWorth('surf-turf-super-combo', 11.40, [['extra-prawns', 7], ['extra-chicken-breast', 4.5], ['extra-fungus', 2.5]]);
            const surfTurfSpecial: AddOnSection & { extraDesc?: string; extraDescEn?: string } = {
                id: 'surf-turf-combo',
                title: '✨ 鲜上加鲜！海陆澎湃大翻倍',
                titleEn: 'Ultimate Surf & Turf Trio (+ RM 11.40)',
                minSelect: 0,
                maxSelect: 3,
                extraDesc: `包含：鲜甜大虾仁 4只 (${rm('extra-prawns', 7)}) + 嫩炒鸡丁 50g (${rm('extra-chicken-breast', 4.5)}) + 脆爽云耳 20g (${rm('extra-fungus', 2.5)})${surfTurfWorth.zh}\n“想要大口吃肉的满足感？这是蛋白质与膳食纤维的终极爆发。”`,
                extraDescEn: `Includes: 4 sweet prawns (${rm('extra-prawns', 7)}) + 50g tender stir-fried chicken (${rm('extra-chicken-breast', 4.5)}) + 20g crisp black fungus (${rm('extra-fungus', 2.5)})${surfTurfWorth.en}\n"Craving big bites of protein? The ultimate protein-and-fibre power-up."`,
                items: [
                    { id: 'surf-turf-super-combo', name: '海陆澎湃三件套 (原价 RM 14.0)', nameEn: 'Ultimate Trio', price: p('surf-turf-super-combo', 11.40), category: 'combo' }
                ]
            };
            const customSections = addOnSections.map(section => {
                if (section.id === 'sides') {
                    return {
                        ...section,
                        items: [
                            { id: 'extra-prawns', name: '鲜甜大虾仁 (4只)', nameEn: 'Extra Sweet Prawns (4pcs)', price: p('extra-prawns', 7), category: 'sides', maxQty: 3 },
                            { id: 'extra-chicken-breast', name: '嫩炒鸡丁 (50g)', nameEn: 'Tender Shredded Chicken Breast (50g)', price: p('extra-chicken-breast', 4.50), category: 'sides', maxQty: 3 },
                            { id: 'extra-fungus', name: '脆爽云耳 (20g)', nameEn: 'Crisp Black Fungus (20g)', price: p('extra-fungus', 2.50), category: 'sides', maxQty: 3 },
                            { id: 'extra-yam', name: '鲜脆山药块 (90g)', nameEn: 'Fresh Chinese Yam (90g)', price: p('extra-yam', 4), category: 'sides', maxQty: 3 },
                            ...section.items.filter(item => item.id !== 'sunny-egg' && item.id !== 'potato-egg')
                        ]
                    };
                }
                return section;
            });
            return [surfTurfSpecial, ...customSections];
        }

        // If it's Golden Crispy Chicken Chop (now daily, id: 14) or Honey Lemon
        // Glazed Chicken Chop (id: 26), append the chop-series add-ons to the
        // sides. 柠扒与鸡扒同系列，配菜+三件套整套看齐（老板 2026-07-14 拍板）。
        if (dish.id === 14 || dish.id === 26) {
            const chopWorth = comboWorth('chicken-chop-nostalgia-combo', 12.90, [['extra-chicken-chop', 10.9], ['sunny-egg', 2.5], ['extra-rice', 2]]);
            const chickenChopSpecial: AddOnSection & { extraDesc?: string; extraDescEn?: string } = {
                id: 'chicken-chop-combo',
                title: '✨ 古早味澎湃大满贯三件套',
                titleEn: 'Ultimate Nostalgia Combo (+ RM 12.90)',
                minSelect: 0,
                maxSelect: 3,
                extraDesc: `包含：多加一块香煎金鸡扒 (${rm('extra-chicken-chop', 10.9)}) + 荷包蛋 (${rm('sunny-egg', 2.5)}) + 加饭 150g (${rm('extra-rice', 2)})${chopWorth.zh}\n“想要彻底犒劳自己的一顿饭？双份酒香鸡扒的爆棚肉感，戳破流心的古早味荷包蛋拌入白饭，这是干饭人最顶级的满足感！”`,
                extraDescEn: `Includes: one extra pan-fried golden chicken chop (${rm('extra-chicken-chop', 10.9)}) + sunny-side-up egg (${rm('sunny-egg', 2.5)}) + extra rice 150g (${rm('extra-rice', 2)})${chopWorth.en}\n"A double-chop feast with a runny-yolk egg stirred into rice — the ultimate treat for big eaters!"`,
                items: [
                    { id: 'chicken-chop-nostalgia-combo', name: '古早味大满贯三件套 (原价 RM 15.40)', nameEn: 'Ultimate Nostalgia Combo', price: p('chicken-chop-nostalgia-combo', 12.90), category: 'combo' }
                ]
            };
            const customSections = addOnSections.map(section => {
                if (section.id === 'sides') {
                    return {
                        ...section,
                        items: [
                            ...section.items.filter(item => item.id !== 'less-rice' && item.id !== 'extra-rice' && item.id !== 'brown-rice'),
                            { id: 'extra-chicken-chop', name: '加香煎金鸡扒 (150g)', nameEn: 'Extra Chicken Chop (150g)', price: p('extra-chicken-chop', 10.90), category: 'sides', maxQty: 3 },
                            { id: 'extra-edamame-side', name: '清甜水煮毛豆仁 (25g)', nameEn: 'Edamame', price: p('extra-edamame-side', 2.50), category: 'sides', maxQty: 3 },
                            { id: 'extra-corn-side', name: '金黄甜玉米 (30g)', nameEn: 'Corn', price: p('extra-corn-side', 2.50), category: 'sides', maxQty: 3 },
                            { id: 'cherry-tomato', name: '爽脆多汁小番茄 (20g)', nameEn: 'Cherry Tomato', price: p('cherry-tomato', 2.50), category: 'sides', maxQty: 3 },
                            ...section.items.filter(item => item.id === 'less-rice' || item.id === 'extra-rice' || item.id === 'brown-rice')
                        ]
                    };
                }
                if (section.id === 'alacarte') {
                    // Remove global extra-edamame and extra-corn from alacarte for this dish
                    return {
                        ...section,
                        items: section.items.filter(item => item.id !== 'extra-edamame' && item.id !== 'extra-corn')
                    };
                }
                return section;
            });
            return [chickenChopSpecial, ...customSections];
        }

        // If it's Greek Mediterranean Lemon Chicken (id: 3), prepend a special combo section
        if (dish.id === 3) {
            // 2026-08-01 老板拍板：加购鸡胸份量 180g → 150g（价不变，id 仍是
            // extra-greek-chicken-180g 订单 key 不动，只换显示标签）。
            const greekWorth = comboWorth('greek-protein-bomb-combo', 15.90, [['extra-greek-chicken-180g', 11.9], ['extra-aus-potato-80g', 3.5], ['extra-cauliflower-80g', 3]]);
            const proteinBombSpecial: AddOnSection & { extraDesc?: string; extraDescEn?: string } = {
                id: 'greek-combo',
                title: '✨ 终极爆肌！蛋白质核弹三件套',
                titleEn: 'Ultimate Protein Bomb Trio (+ RM 15.90)',
                minSelect: 0,
                maxSelect: 3,
                extraDesc: `包含：150g 柠香烤鸡胸 (${rm('extra-greek-chicken-180g', 11.9)}) + 90g 马铃薯 (${rm('extra-aus-potato-80g', 3.5)}) + 80g 脆甜椰菜花 (${rm('extra-cauliflower-80g', 3)})${greekWorth.zh}\n“突破百克优质蛋白的终极归宿，练后快速回血、饱腹无负担。”`,
                extraDescEn: `Includes: 150g lemon roast chicken breast (${rm('extra-greek-chicken-180g', 11.9)}) + 90g potato (${rm('extra-aus-potato-80g', 3.5)}) + 80g sweet cauliflower (${rm('extra-cauliflower-80g', 3)})${greekWorth.en}\n"Over 100g of quality protein — fast post-workout recovery, filling without the guilt."`,
                items: [
                    { id: 'greek-protein-bomb-combo', name: '蛋白质核弹三件套 (原价 RM 18.40)', nameEn: 'Protein Bomb Trio', price: p('greek-protein-bomb-combo', 15.90), category: 'combo' }
                ]
            };
            const customSections = addOnSections.map(section => {
                if (section.id === 'sides') {
                    return {
                        ...section,
                        items: [
                            { id: 'extra-greek-chicken-180g', name: '【增肌极客】加柠香烤鸡胸 (150g)', nameEn: 'Extra Lemon Chicken Breast (150g)', price: p('extra-greek-chicken-180g', 11.90), category: 'sides', maxQty: 3 },
                            { id: 'extra-aus-potato-80g', name: '【优质碳水】加马铃薯 (90g)', nameEn: 'Extra Potato (90g)', price: p('extra-aus-potato-80g', 3.50), category: 'sides', maxQty: 3 },
                            { id: 'extra-cauliflower-80g', name: '【抗氧高纤】加脆甜椰菜花 (80g)', nameEn: 'Extra Cauliflower (80g)', price: p('extra-cauliflower-80g', 3), category: 'sides', maxQty: 3 },
                            { id: 'extra-black-olive-12g', name: '【地中海风味】加提鲜黑橄榄 (12g)', nameEn: 'Extra Black Olive Slice (12g)', price: p('extra-black-olive-12g', 2.50), category: 'sides', maxQty: 3 },
                            ...section.items.filter(item => item.id !== 'sunny-egg' && item.id !== 'potato-egg')
                        ]
                    };
                }
                return section;
            });
            return [proteinBombSpecial, ...customSections];
        }

        // If it's Lemon Pan-Seared Salmon (id: 21), sides carry the dish's own
        // ingredients (edamame / corn / cherry tomato) plus an extra-salmon upsell.
        // 西兰花 (50g) intentionally absent — no standalone add-on price provided yet.
        // 2026-07-31 加两个专属套餐（老板拍板）：数据说三文鱼客最常加的是
        // 蒜蓉西兰花炒蛋（7 周里 6 周排前三），而 RM18.50 的加三文鱼在约 122 份
        // 里只卖出过 1 次 —— 所以套餐围着「客人已经在买的东西」打包，不推双份鱼。
        if (dish.id === 21) {
            const salmonDuoWorth = comboWorth('salmon-protein-duo-combo', 12.90, [['broccoli-egg', 10.9], ['onsen-egg', 3]]);
            const salmonProteinCombo: AddOnSection & { extraDesc?: string; extraDescEn?: string } = {
                id: 'salmon-protein-combo',
                title: '✨ 柠香双蛋白套',
                titleEn: 'Lemon Salmon Protein Duo (+ RM 12.90)',
                minSelect: 0,
                maxSelect: 3,
                extraDesc: `包含：蒜蓉西兰花炒蛋 (${rm('broccoli-egg', 10.9)}) + 浓厚温泉蛋 (${rm('onsen-egg', 3)})${salmonDuoWorth.zh}\n"香煎三文鱼配蒜香西兰花炒蛋，再戳破一颗流心温泉蛋——一碗吃满两份蛋白质。"`,
                extraDescEn: `Includes: garlic broccoli with soft-scrambled egg (${rm('broccoli-egg', 10.9)}) + rich onsen egg (${rm('onsen-egg', 3)})${salmonDuoWorth.en}\n"Pan-seared salmon with garlicky broccoli-egg and a silky onsen egg — two proteins in one bowl."`,
                items: [
                    { id: 'salmon-protein-duo-combo', name: '柠香双蛋白套 (原价 RM 13.90)', nameEn: 'Protein Duo', price: p('salmon-protein-duo-combo', 12.90), category: 'combo' }
                ]
            };
            const tricolorWorth = comboWorth('salmon-tricolor-combo', 5.90, [['extra-edamame', 2.5], ['extra-corn', 2.5], ['cherry-tomato', 2.5]]);
            const salmonTricolorCombo: AddOnSection & { extraDesc?: string; extraDescEn?: string } = {
                id: 'salmon-tricolor-combo-section',
                title: '✨ 三色加倍套',
                titleEn: 'Triple Veggie Boost (+ RM 5.90)',
                minSelect: 0,
                maxSelect: 3,
                extraDesc: `包含：清甜毛豆 25g (${rm('extra-edamame', 2.5)}) + 金黄甜玉米 30g (${rm('extra-corn', 2.5)}) + 爽脆小番茄 20g (${rm('cherry-tomato', 2.5)})${tricolorWorth.zh}\n"碗里本来就有的三样配色，全部加倍——每一口都咬得到。"`,
                extraDescEn: `Includes: 25g edamame (${rm('extra-edamame', 2.5)}) + 30g sweet corn (${rm('extra-corn', 2.5)}) + 20g cherry tomato (${rm('cherry-tomato', 2.5)})${tricolorWorth.en}\n"The three colours already in your bowl, doubled — something in every bite."`,
                items: [
                    { id: 'salmon-tricolor-combo', name: '三色加倍套 (原价 RM 7.50)', nameEn: 'Triple Veggie Boost', price: p('salmon-tricolor-combo', 5.90), category: 'combo' }
                ]
            };
            const customSections = addOnSections.map(section => {
                if (section.id === 'sides') {
                    return {
                        ...section,
                        items: [
                            ...section.items.filter(item => item.id !== 'less-rice' && item.id !== 'extra-rice' && item.id !== 'brown-rice'),
                            { id: 'extra-salmon-70g', name: '加香煎三文鱼 (70g+)', nameEn: 'Extra Pan-Seared Salmon (70g+)', price: p('extra-salmon-70g', 18.50), category: 'sides', maxQty: 3 },
                            { id: 'extra-edamame-side', name: '清甜水煮毛豆仁 (25g)', nameEn: 'Edamame', price: p('extra-edamame-side', 2.50), category: 'sides', maxQty: 3 },
                            { id: 'extra-corn-side', name: '金黄甜玉米 (30g)', nameEn: 'Corn', price: p('extra-corn-side', 2.50), category: 'sides', maxQty: 3 },
                            { id: 'cherry-tomato', name: '爽脆多汁小番茄 (20g)', nameEn: 'Cherry Tomato', price: p('cherry-tomato', 2.50), category: 'sides', maxQty: 3 },
                            ...section.items.filter(item => item.id === 'less-rice' || item.id === 'extra-rice' || item.id === 'brown-rice')
                        ]
                    };
                }
                if (section.id === 'alacarte') {
                    // Remove global extra-edamame and extra-corn from alacarte for this dish
                    return {
                        ...section,
                        items: section.items.filter(item => item.id !== 'extra-edamame' && item.id !== 'extra-corn')
                    };
                }
                return section;
            });
            return [salmonProteinCombo, salmonTricolorCombo, ...customSections];
        }

        // If it's Aussie Wagyu Beef Patty Don (id: 24), sides carry the dish's own
        // cherry-tomato & onion salad (tossed in extra-virgin olive oil + pinch of
        // salt — NOT the plain 'cherry-tomato' add-on) plus an extra-patty upsell.
        if (dish.id === 24) {
            return addOnSections.map(section => {
                if (section.id === 'sides') {
                    return {
                        ...section,
                        items: [
                            ...section.items.filter(item => item.id !== 'less-rice' && item.id !== 'extra-rice' && item.id !== 'brown-rice'),
                            { id: 'extra-wagyu-patty', name: '加澳洲和牛饼 (1块)', nameEn: 'Extra Aussie Wagyu Patty (1 pc)', price: p('extra-wagyu-patty', 17.50), category: 'sides', maxQty: 3 },
                            { id: 'cherry-tomato-salad', name: '小番茄洋葱沙拉 (40g)', nameEn: 'Cherry Tomato & Onion Salad (40g)', price: p('cherry-tomato-salad', 4.50), category: 'sides', maxQty: 3 },
                            ...section.items.filter(item => item.id === 'less-rice' || item.id === 'extra-rice' || item.id === 'brown-rice')
                        ]
                    };
                }
                return section;
            });
        }

        // If it's Hometown Sweet & Sour Onion Pork Chop (id: 27), prepend two combos
        // + an extra-chop upsell. 选品依据 analytics/weekly：这道菜销量常年前三、
        // 加料渗透 45~67%，但客单只有 RM1.78~1.85/份（当归鸡腿 4.56、姜葱鱼片 4.04）
        // —— 不是客人不肯花，是这道菜此前既没有「加主菜」也没有套餐，能加的最贵
        // 的只有西兰花炒蛋。两周稳定的前三加料是 荷包蛋 / 换糙米 / 马铃薯煎蛋，
        // 所以套餐围着荷包蛋 + 加饭做，A 档再补上这碗完全缺席的蔬菜。
        if (dish.id === 27) {
            const ssChopWorth = comboWorth('sweetsour-chop-combo', 12.90, [['broccoli-egg', 10.9], ['sunny-egg', 2.5], ['extra-rice', 2]]);
            const sweetSourChopCombo: AddOnSection & { extraDesc?: string; extraDescEn?: string } = {
                id: 'sweetsour-chop-combo-section',
                title: '✨ 甜酸下饭套',
                titleEn: 'Sweet & Sour Rice King Set (+ RM 12.90)',
                minSelect: 0,
                maxSelect: 3,
                extraDesc: `包含：蒜蓉西兰花炒蛋 (${rm('broccoli-egg', 10.9)}) + 古早味荷包蛋 (${rm('sunny-egg', 2.5)}) + 加饭 150g (${rm('extra-rice', 2)})${ssChopWorth.zh}\n"甜酸洋葱酱最缺一口青——蒜香西兰花炒蛋补上，再戳破荷包蛋捞饭，这碗才算完整。"`,
                extraDescEn: `Includes: garlic broccoli with soft-scrambled egg (${rm('broccoli-egg', 10.9)}) + old-school sunny-side-up egg (${rm('sunny-egg', 2.5)}) + extra rice 150g (${rm('extra-rice', 2)})${ssChopWorth.en}\n"That sweet & sour sauce is begging for greens — garlicky broccoli-egg and a runny yolk over extra rice finish the bowl."`,
                items: [
                    { id: 'sweetsour-chop-combo', name: '甜酸下饭套 (原价 RM 15.40)', nameEn: 'Sweet & Sour Rice King Set', price: p('sweetsour-chop-combo', 12.90), category: 'combo' }
                ]
            };
            const ssRiceWorth = comboWorth('sweetsour-rice-combo', 5.90, [['sunny-egg', 2.5], ['extra-rice', 2], ['extra-edamame', 2.5]]);
            const sweetSourRiceCombo: AddOnSection & { extraDesc?: string; extraDescEn?: string } = {
                id: 'sweetsour-rice-combo-section',
                title: '✨ 猪扒干饭套',
                titleEn: 'Pork Chop Rice Set (+ RM 5.90)',
                minSelect: 0,
                maxSelect: 3,
                extraDesc: `包含：古早味荷包蛋 (${rm('sunny-egg', 2.5)}) + 加饭 150g (${rm('extra-rice', 2)}) + 清甜毛豆 25g (${rm('extra-edamame', 2.5)})${ssRiceWorth.zh}\n"酱汁剩在碗底最可惜——多一碗饭、一颗流心蛋、一把毛豆，一滴都不留。"`,
                extraDescEn: `Includes: old-school sunny-side-up egg (${rm('sunny-egg', 2.5)}) + extra rice 150g (${rm('extra-rice', 2)}) + 25g edamame (${rm('extra-edamame', 2.5)})${ssRiceWorth.en}\n"Never leave that sauce behind — extra rice, a runny egg and crisp edamame mop up every drop."`,
                items: [
                    { id: 'sweetsour-rice-combo', name: '猪扒干饭套 (原价 RM 7.00)', nameEn: 'Pork Chop Rice Set', price: p('sweetsour-rice-combo', 5.90), category: 'combo' }
                ]
            };
            const customSections = addOnSections.map(section => {
                if (section.id === 'sides') {
                    return {
                        ...section,
                        items: [
                            ...section.items.filter(item => item.id !== 'less-rice' && item.id !== 'extra-rice' && item.id !== 'brown-rice'),
                            { id: 'extra-pork-chop', name: '加甜酸猪扒 (1块)', nameEn: 'Extra Sweet & Sour Pork Chop (1 pc)', price: p('extra-pork-chop', 14.90), category: 'sides', maxQty: 3 },
                            ...section.items.filter(item => item.id === 'less-rice' || item.id === 'extra-rice' || item.id === 'brown-rice')
                        ]
                    };
                }
                return section;
            });
            return [sweetSourChopCombo, sweetSourRiceCombo, ...customSections];
        }

        // If it's Hometown Glazed Unagi Rice (id: 29), sides carry the half-fillet
        // upsell plus 温泉蛋 (丼 classic) instead of leaving the egg buried in a la carte.
        // 海苔 老板 2026-07-31 明确不要，别再加回来。
        // 名字必须逐字是「温泉蛋」—— prepIngredients 按 add-on label 查 addOnRecipes，
        // 改名就静默算 0 食材（见 dishIngredients.ts 别名注释）。
        // 西兰花仍缺独立加料价（三文鱼饭也一样缺），故不列。
        if (dish.id === 29) {
            // 2026-08-01 老板要求：文案不写「0.5片」，改写「加倍成整整 1 片」
            //（碗里自带半片 + 套餐再加半片 = 1 片）。⚠️ 备餐/采购配方不变，
            // dishIngredients 里本套餐仍按 鳗鱼 0.5 片 扣——只是话术升级。
            const unagiDoubleWorth = comboWorth('unagi-double-combo', 19.90, [['extra-unagi-half', 18.5], ['onsen-egg', 3], ['extra-rice', 2]]);
            const unagiDoubleCombo: AddOnSection & { extraDesc?: string; extraDescEn?: string } = {
                id: 'unagi-double-combo-section',
                title: '✨ 双倍鳗鱼丼套',
                titleEn: 'Double Unagi Don Set (+ RM 19.90)',
                minSelect: 0,
                maxSelect: 3,
                extraDesc: `包含：照烧鳗鱼加倍成整整 1 片 (${rm('extra-unagi-half', 18.5)}) + 浓厚温泉蛋 (${rm('onsen-egg', 3)}) + 加饭 150g (${rm('extra-rice', 2)})${unagiDoubleWorth.zh}\n"碗里自带半片，再加半片——整整一片鳗鱼铺满碗面，戳破温泉蛋拌进照烧酱。"`,
                extraDescEn: `Includes: unagi doubled to a full fillet (${rm('extra-unagi-half', 18.5)}) + rich onsen egg (${rm('onsen-egg', 3)}) + extra rice 150g (${rm('extra-rice', 2)})${unagiDoubleWorth.en}\n"Half comes with the bowl, half more on top — a full fillet across the rice, with a runny onsen egg in the glaze."`,
                items: [
                    { id: 'unagi-double-combo', name: '双倍鳗鱼丼套 (原价 RM 23.50)', nameEn: 'Double Unagi Don Set', price: p('unagi-double-combo', 19.90), category: 'combo' }
                ]
            };
            const unagiRiceWorth = comboWorth('unagi-rice-combo', 5.90, [['onsen-egg', 3], ['extra-rice', 2], ['extra-edamame', 2.5]]);
            const unagiRiceCombo: AddOnSection & { extraDesc?: string; extraDescEn?: string } = {
                id: 'unagi-rice-combo-section',
                title: '✨ 照烧干饭套',
                titleEn: 'Unagi Rice Set (+ RM 5.90)',
                minSelect: 0,
                maxSelect: 3,
                extraDesc: `包含：浓厚温泉蛋 (${rm('onsen-egg', 3)}) + 加饭 150g (${rm('extra-rice', 2)}) + 清甜毛豆 25g (${rm('extra-edamame', 2.5)})${unagiRiceWorth.zh}\n"照烧酱最怕饭不够——蛋滑、饭足、毛豆脆，一碗干到底。"`,
                extraDescEn: `Includes: rich onsen egg (${rm('onsen-egg', 3)}) + extra rice 150g (${rm('extra-rice', 2)}) + 25g edamame (${rm('extra-edamame', 2.5)})${unagiRiceWorth.en}\n"That glaze needs rice to soak it up — silky egg, extra rice, crisp edamame."`,
                items: [
                    { id: 'unagi-rice-combo', name: '照烧干饭套 (原价 RM 7.50)', nameEn: 'Unagi Rice Set', price: p('unagi-rice-combo', 5.90), category: 'combo' }
                ]
            };
            const customSections = addOnSections.map(section => {
                if (section.id === 'sides') {
                    return {
                        ...section,
                        items: [
                            ...section.items.filter(item => item.id !== 'less-rice' && item.id !== 'extra-rice' && item.id !== 'brown-rice'),
                            { id: 'extra-unagi-half', name: '【照烧加倍】加照烧鳗鱼 (0.5片)', nameEn: 'Extra Glazed Unagi (½ fillet)', price: p('extra-unagi-half', 18.50), category: 'sides', maxQty: 3 },
                            { id: 'onsen-egg', name: '温泉蛋', nameEn: 'Onsen Egg', price: p('onsen-egg', 3), category: 'sides', maxQty: 3 },
                            ...section.items.filter(item => item.id === 'less-rice' || item.id === 'extra-rice' || item.id === 'brown-rice')
                        ]
                    };
                }
                if (section.id === 'alacarte') {
                    // 温泉蛋 已挪到 sides，这里滤掉避免同一个 id 出现两次
                    return {
                        ...section,
                        items: section.items.filter(item => item.id !== 'onsen-egg')
                    };
                }
                return section;
            });
            return [unagiDoubleCombo, unagiRiceCombo, ...customSections];
        }

        // If it's Angelica Steamed Whole Chicken Leg (Tuesday special, id: 2), append specific add-ons to the sides
        if (dish.id === 2) {
            return addOnSections.map(section => {
                if (section.id === 'sides') {
                    return {
                        ...section,
                        items: [
                            ...section.items.filter(item => item.id !== 'less-rice' && item.id !== 'extra-rice' && item.id !== 'brown-rice'),
                            { id: 'extra-herbal-leg-1', name: '【犒劳自己】多加一只暖胃全鸡腿', nameEn: 'Extra Steamed Herbal Chicken Leg (+1)', price: p('extra-herbal-leg-1', 16.50), category: 'sides', maxQty: 1 },
                            ...section.items.filter(item => item.id === 'less-rice' || item.id === 'extra-rice' || item.id === 'brown-rice')
                        ]
                    };
                }
                return section;
            });
        }

        // If it's Grandma's Traditional Soy Sauce Chicken Whole Leg (now Monday special, id: 1), same pattern as id:13
        if (dish.id === 1) {
            return addOnSections.map(section => {
                if (section.id === 'sides') {
                    return {
                        ...section,
                        items: [
                            ...section.items.filter(item => item.id !== 'less-rice' && item.id !== 'extra-rice' && item.id !== 'brown-rice'),
                            { id: 'extra-soy-leg-1', name: '【犒劳自己】多加一只酱油全鸡腿', nameEn: 'Extra Soy Sauce Chicken Whole Leg (+1)', price: p('extra-soy-leg-1', 16.50), category: 'sides', maxQty: 1 },
                            ...section.items.filter(item => item.id === 'less-rice' || item.id === 'extra-rice' || item.id === 'brown-rice')
                        ]
                    };
                }
                return section;
            });
        }

        // If it's Shaoxing Wine Steamed Pork Belly (id: 4), prepend combo + dual-tier pork add-ons
        if (dish.id === 4) {
            const shaoxingWorth = comboWorth('shaoxing-pork-combo', 15.90, [['extra-shaoxing-pork-100g', 14.9], ['sunny-egg', 2.5], ['extra-rice', 2]]);
            const shaoxingCombo: AddOnSection & { extraDesc?: string; extraDescEn?: string } = {
                id: 'shaoxing-combo',
                title: '✨ 酒香干饭套',
                titleEn: 'Shaoxing Rice King Set (+ RM 15.90)',
                minSelect: 0,
                maxSelect: 3,
                extraDesc: `包含：酒香绍兴花肉 100g (${rm('extra-shaoxing-pork-100g', 14.9)}) + 古早味荷包蛋 (${rm('sunny-egg', 2.5)}) + 加饭 150g (${rm('extra-rice', 2)})${shaoxingWorth.zh}\n"绍兴酒香渗进双倍花肉，戳破流心荷包蛋拌饭——干饭魂彻底点燃！"`,
                extraDescEn: `Includes: 100g Shaoxing pork belly (${rm('extra-shaoxing-pork-100g', 14.9)}) + old-school sunny-side-up egg (${rm('sunny-egg', 2.5)}) + extra rice 150g (${rm('extra-rice', 2)})${shaoxingWorth.en}\n"Double pork soaked in Shaoxing wine, a runny egg over extra rice — pure comfort."`,
                items: [
                    { id: 'shaoxing-pork-combo', name: '酒香干饭套 (原价 RM 19.40)', nameEn: 'Shaoxing Rice King Set', price: p('shaoxing-pork-combo', 15.90), category: 'combo' }
                ]
            };
            const customSections = addOnSections.map(section => {
                if (section.id === 'sides') {
                    return {
                        ...section,
                        items: [
                            ...section.items.filter(item => item.id !== 'less-rice' && item.id !== 'extra-rice' && item.id !== 'brown-rice'),
                            { id: 'extra-shaoxing-pork-50g', name: '【小酌怡情】加绍兴花肉 (50g)', nameEn: 'Extra Shaoxing Pork Belly (50g)', price: p('extra-shaoxing-pork-50g', 7.90), category: 'sides', maxQty: 3 },
                            { id: 'extra-shaoxing-pork-100g', name: '【酒香入魂】加绍兴花肉 (100g)', nameEn: 'Extra Shaoxing Pork Belly (100g)', price: p('extra-shaoxing-pork-100g', 14.90), category: 'sides', maxQty: 3 },
                            ...section.items.filter(item => item.id === 'less-rice' || item.id === 'extra-rice' || item.id === 'brown-rice')
                        ]
                    };
                }
                return section;
            });
            return [shaoxingCombo, ...customSections];
        }

        // If it's Homestyle Japanese Curry Rice (id: 25), prepend combo + extra-chicken add-ons
        if (dish.id === 25) {
            const curryWorth = comboWorth('curry-trio-combo', 7.90, [['extra-curry-chicken-50g', 4.5], ['onsen-egg', 3], ['extra-rice', 2]]);
            const curryCombo: AddOnSection & { extraDesc?: string; extraDescEn?: string } = {
                id: 'curry-combo',
                title: '✨ 咖喱控三件套',
                titleEn: 'Curry Lover Trio (+ RM 7.90)',
                minSelect: 0,
                maxSelect: 3,
                extraDesc: `包含：滑嫩咖喱鸡丁 50g (${rm('extra-curry-chicken-50g', 4.5)}) + 浓厚温泉蛋 (${rm('onsen-egg', 3)}) + 加饭 150g (${rm('extra-rice', 2)})${curryWorth.zh}\n"温泉蛋滑进浓郁咖喱酱，多一份鸡丁多一份满足——咖喱控没有抵抗力。"`,
                extraDescEn: `Includes: 50g tender curry chicken (${rm('extra-curry-chicken-50g', 4.5)}) + rich onsen egg (${rm('onsen-egg', 3)}) + extra rice 150g (${rm('extra-rice', 2)})${curryWorth.en}\n"An onsen egg melting into thick curry with extra chicken — irresistible for curry lovers."`,
                items: [
                    { id: 'curry-trio-combo', name: '咖喱控三件套 (原价 RM 9.50)', nameEn: 'Curry Lover Trio', price: p('curry-trio-combo', 7.90), category: 'combo' }
                ]
            };
            const customSections = addOnSections.map(section => {
                if (section.id === 'sides') {
                    return {
                        ...section,
                        items: [
                            ...section.items.filter(item => item.id !== 'less-rice' && item.id !== 'extra-rice' && item.id !== 'brown-rice'),
                            { id: 'extra-curry-chicken-50g', name: '【滑嫩多汁】加咖喱鸡丁 (50g)', nameEn: 'Extra Curry Chicken (50g)', price: p('extra-curry-chicken-50g', 4.50), category: 'sides', maxQty: 3 },
                            ...section.items.filter(item => item.id === 'less-rice' || item.id === 'extra-rice' || item.id === 'brown-rice')
                        ]
                    };
                }
                return section;
            });
            return [curryCombo, ...customSections];
        }

        // If it's Hometown Taucu Braised Pork Belly (id: 23), prepend combo + dual-tier pork add-ons
        if (dish.id === 23) {
            // 2026-08-01 组件调价：加豆酱花肉 100g 14.90 → 15.50，原价 19.40 → 20.00
            //（label 是订单/备餐 key，dishIngredients 已同步新键并保留 19.40 legacy）。
            const taucuWorth = comboWorth('taucu-pork-combo', 16.90, [['extra-taucu-pork-100g', 15.5], ['sunny-egg', 2.5], ['extra-rice', 2]]);
            const taucuCombo: AddOnSection & { extraDesc?: string; extraDescEn?: string } = {
                id: 'taucu-combo',
                title: '✨ 阿嫲下饭王套',
                titleEn: 'Grandma Rice King Set (+ RM 16.90)',
                minSelect: 0,
                maxSelect: 3,
                extraDesc: `包含：家乡豆酱花肉 100g (${rm('extra-taucu-pork-100g', 15.5)}) + 古早味荷包蛋 (${rm('sunny-egg', 2.5)}) + 加饭 150g (${rm('extra-rice', 2)})${taucuWorth.zh}\n"豆酱花肉加量，配流心荷包蛋捞饭——阿嫲看了都说你会吃。"`,
                extraDescEn: `Includes: 100g taucu pork belly (${rm('extra-taucu-pork-100g', 15.5)}) + old-school sunny-side-up egg (${rm('sunny-egg', 2.5)}) + extra rice 150g (${rm('extra-rice', 2)})${taucuWorth.en}\n"Double taucu pork with a runny egg over extra rice — grandma-approved indulgence."`,
                items: [
                    { id: 'taucu-pork-combo', name: '阿嫲下饭王套 (原价 RM 20.00)', nameEn: 'Grandma Rice King Set', price: p('taucu-pork-combo', 16.90), category: 'combo' }
                ]
            };
            const customSections = addOnSections.map(section => {
                if (section.id === 'sides') {
                    return {
                        ...section,
                        items: [
                            ...section.items.filter(item => item.id !== 'less-rice' && item.id !== 'extra-rice' && item.id !== 'brown-rice'),
                            { id: 'extra-taucu-pork-50g', name: '【小碗解馋】加豆酱花肉 (50g)', nameEn: 'Extra Taucu Pork Belly (50g)', price: p('extra-taucu-pork-50g', 7.90), category: 'sides', maxQty: 3 },
                            { id: 'extra-taucu-pork-100g', name: '【家乡浓香】加豆酱花肉 (100g)', nameEn: 'Extra Taucu Pork Belly (100g)', price: p('extra-taucu-pork-100g', 15.50), category: 'sides', maxQty: 3 },
                            ...section.items.filter(item => item.id === 'less-rice' || item.id === 'extra-rice' || item.id === 'brown-rice')
                        ]
                    };
                }
                return section;
            });
            return [taucuCombo, ...customSections];
        }

        // If it's Grandma-Style Ginger-Scallion Fish Fillet (id: 20), add an extra-fish upsell to sides
        if (dish.id === 20) {
            return addOnSections.map(section => {
                if (section.id === 'sides') {
                    return {
                        ...section,
                        items: [
                            ...section.items.filter(item => item.id !== 'less-rice' && item.id !== 'extra-rice' && item.id !== 'brown-rice'),
                            { id: 'extra-fish-120g', name: '加姜葱鱼片 (120g)', nameEn: 'Extra Fish Fillet (120g)', price: p('extra-fish-120g', 13.90), category: 'sides', maxQty: 3 },
                            ...section.items.filter(item => item.id === 'less-rice' || item.id === 'extra-rice' || item.id === 'brown-rice')
                        ]
                    };
                }
                return section;
            });
        }

        // If it's Golden Scallion Pan-Fried Chicken Soup (id: 5), prepend combo + chicken leg add-ons
        if (dish.id === 5) {
            const scallionWorth = comboWorth('scallion-soup-combo', 12.90, [['extra-scallion-chop-side', 10.9], ['sunny-egg', 2.5], ['extra-rice', 2]]);
            const scallionCombo: AddOnSection & { extraDesc?: string; extraDescEn?: string } = {
                id: 'scallion-combo',
                title: '✨ 葱汤干饭王！爆量满足三件套',
                titleEn: 'Scallion Soup Rice King Trio (+ RM 12.90)',
                minSelect: 0,
                maxSelect: 3,
                extraDesc: `包含：香煎金鸡扒 150g (${rm('extra-scallion-chop-side', 10.9)}) + 古早味荷包蛋 (${rm('sunny-egg', 2.5)}) + 加饭 150g (${rm('extra-rice', 2)})${scallionWorth.zh}\n"一碗热腾腾的葱汤配上焦香鸡扒，戳破流心荷包蛋拌进白饭——周五就该这样犒劳自己！"`,
                extraDescEn: `Includes: 150g pan-fried golden chicken chop (${rm('extra-scallion-chop-side', 10.9)}) + old-school sunny-side-up egg (${rm('sunny-egg', 2.5)}) + extra rice 150g (${rm('extra-rice', 2)})${scallionWorth.en}\n"Steaming scallion soup with a crispy chop and a runny egg over rice — Fridays done right!"`,
                items: [
                    { id: 'scallion-soup-combo', name: '爆量满足三件套 (原价 RM 15.40)', nameEn: 'Rice King Trio', price: p('scallion-soup-combo', 12.90), category: 'combo' }
                ]
            };
            const customSections = addOnSections.map(section => {
                if (section.id === 'sides') {
                    return {
                        ...section,
                        items: [
                            ...section.items.filter(item => item.id !== 'less-rice' && item.id !== 'extra-rice' && item.id !== 'brown-rice'),
                            { id: 'extra-scallion-chop-side', name: '【收工犒劳】多加一只葱香煎鸡扒', nameEn: 'Extra Scallion Chicken Chop', price: p('extra-scallion-chop-side', 10.90), category: 'sides', maxQty: 3 },
                            ...section.items.filter(item => item.id === 'less-rice' || item.id === 'extra-rice' || item.id === 'brown-rice')
                        ]
                    };
                }
                return section;
            });
            return [scallionCombo, ...customSections];
        }

        // If it's Potato Pork Belly Stew (now daily, id: 13), prepend a special combo section
        if (dish.id === 13) {
            const porkPotatoWorth = comboWorth('pork-potato-duo-combo', 13.40, [['extra-potato', 3.5], ['extra-pork-belly', 11.9]]);
            const porkPotatoCombo: AddOnSection & { extraDesc?: string; extraDescEn?: string } = {
                id: 'pork-potato-combo',
                title: '✨ 薯肉双拼满足套',
                titleEn: 'Potato & Pork Belly Duo (+ RM 13.40)',
                minSelect: 0,
                maxSelect: 3,
                extraDesc: `包含：绵密马铃薯 90g (${rm('extra-potato', 3.5)}) + 香滑花肉片 70g (${rm('extra-pork-belly', 11.9)})${porkPotatoWorth.zh}\n"一口软糯薯块裹着浓郁肉汁，再来几片入味花肉，这就是家的味道。"`,
                extraDescEn: `Includes: 90g creamy potato (${rm('extra-potato', 3.5)}) + 70g silky pork belly slices (${rm('extra-pork-belly', 11.9)})${porkPotatoWorth.en}\n"Soft potato coated in rich gravy with melt-in-your-mouth pork belly — the taste of home."`,
                items: [
                    { id: 'pork-potato-duo-combo', name: '薯肉双拼满足套 (原价 RM 15.40)', nameEn: 'Potato & Pork Belly Duo', price: p('pork-potato-duo-combo', 13.40), category: 'combo' }
                ]
            };
            const customSections = addOnSections.map(section => {
                if (section.id === 'sides') {
                    return {
                        ...section,
                        items: [
                            ...section.items.filter(item => item.id !== 'less-rice' && item.id !== 'extra-rice' && item.id !== 'brown-rice'),
                            { id: 'extra-potato', name: '【绵密软糯】加马铃薯 (90g)', nameEn: 'Extra Potato (90g)', price: p('extra-potato', 3.50), category: 'sides', maxQty: 3 },
                            { id: 'extra-pork-belly', name: '【浓香入味】加花肉片 (70g)', nameEn: 'Extra Pork Belly Slices (70g)', price: p('extra-pork-belly', 11.90), category: 'sides', maxQty: 3 },
                            ...section.items.filter(item => item.id === 'less-rice' || item.id === 'extra-rice' || item.id === 'brown-rice')
                        ]
                    };
                }
                return section;
            });
            return [porkPotatoCombo, ...customSections];
        }

        return addOnSections;
    }, [dish, addOnSections]);

    // Reset state when modal opens/dish changes
    useEffect(() => {
        if (isOpen && dish) {
            if (initialConfig) {
                setQuantities(initialConfig.quantities);
                setDishQty(initialConfig.dishQty);
                setNote(initialConfig.note);
                setSelectedDate(initialConfig.selectedDate);
                setSelectedTime(initialConfig.selectedTime);
                const initialExpanded: Record<string, boolean> = {};
                activeAddOnSections.forEach((s) => {
                    initialExpanded[s.id] = true;
                });
                setExpandedSections(initialExpanded);
            } else {
                setQuantities({});
                setDishQty(1);
                setNote('');
                setSelectedDate(defaultDate || minDate || "");
                setSelectedTime("");
                const initialExpanded: Record<string, boolean> = {};
                activeAddOnSections.forEach((s, i) => {
                    initialExpanded[s.id] = i === 0;
                });
                setExpandedSections(initialExpanded);
            }
            // Trigger entrance animation
            requestAnimationFrame(() => setIsVisible(true));
        } else {
            setIsVisible(false);
        }
    }, [isOpen, dish, activeAddOnSections, defaultDate, minDate, initialConfig]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    if (!isOpen || !dish) return null;

    // ─── Handlers ─────────────────────────────────────────────────

    // Mutual exclusion pairs — selecting one auto-clears the other
    const MUTEX_PAIRS: Record<string, string> = {
        'less-rice': 'extra-rice',
        'extra-rice': 'less-rice',
    };

    const updateQty = (itemId: string, delta: number) => {
        setQuantities(prev => {
            const current = prev[itemId] || 0;
            const newVal = Math.max(0, current + delta);
            const updated = { ...prev, [itemId]: Math.min(newVal, 10) };
            // Enforce mutual exclusion: adding this item zeros out its pair
            if (delta > 0 && newVal > 0 && MUTEX_PAIRS[itemId]) {
                updated[MUTEX_PAIRS[itemId]] = 0;
            }
            return updated;
        });
    };

    const toggleSection = (sectionId: string) => {
        setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
    };

    const getSectionSelectedCount = (section: AddOnSection) => {
        return section.items.reduce((sum, item) => sum + (quantities[item.id] || 0), 0);
    };

    const addOnsTotal = activeAddOnSections.reduce((sum, section) => {
        return sum + section.items.reduce((s, item) => s + (quantities[item.id] || 0) * item.price, 0);
    }, 0);

    const dishPrice = dish.price;
    const grandTotal = (dishPrice * dishQty) + addOnsTotal;

    const handleAddToCart = () => {
        const selectedAddOns = activeAddOnSections.flatMap(section =>
            section.items
                .filter(item => (quantities[item.id] || 0) > 0)
                .map(item => ({ item, quantity: quantities[item.id] }))
        );
        onAddToCart(dish, selectedAddOns, grandTotal, note, selectedDate, selectedTime, dishQty, initialConfig?.cartItemId);
        handleClose();
    };

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300); // wait for exit animation
    };

    // ─── Render ───────────────────────────────────────────────────

    return (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                onClick={handleClose}
            />

            {/* Modal Panel */}
            <div
                className={`relative w-full max-w-lg h-[92vh] md:h-auto md:max-h-[88vh] bg-[#FDF8F0] md:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ease-out ${isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-[0.97]'}`}
            >
                {/* ─── Close Button ─── */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 z-20 w-9 h-9 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-md hover:bg-white hover:scale-110 transition-all duration-200 border border-[#E8DFD0]"
                >
                    <X size={18} className="text-[#5C4A32]" />
                </button>

                {/* ─── Scrollable Content ─── */}
                <div className="flex-1 overflow-y-auto overscroll-contain pb-6">

                    {/* ─── Dish Hero Image ─── */}
                    <div className="relative w-full aspect-[4/3] bg-[#E8DFD0]">
                        {dish.image.startsWith('/') ? (
                            <Image
                                src={dish.image}
                                alt={dish.name}
                                fill
                                className="object-cover"
                                sizes="(max-width: 512px) 100vw, 512px"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-8xl">
                                {dish.image}
                            </div>
                        )}
                        {/* Gradient overlay at bottom */}
                        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#FDF8F0] to-transparent" />
                    </div>

                    {/* ─── Dish Info ─── */}
                    <div className="px-5 md:px-6 -mt-4 relative z-10">
                        {/* Day badge */}
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#2D5F3E]/10 rounded-full mb-3">
                            <Leaf size={12} className="text-[#2D5F3E]" />
                            <span className="text-[11px] font-bold text-[#2D5F3E]">{dish.day}</span>
                        </div>

                        <h2 className="text-2xl font-extrabold text-[#3B2A1A] leading-tight mb-1">
                            {isEn ? dish.nameEn : dish.name}
                        </h2>
                        <p className="text-sm font-medium text-[#8B7355] mb-3">
                            {isEn ? dish.name : dish.nameEn}
                        </p>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                            {(isEn ? ((dish as any).tagsEn || dish.tags) : dish.tags).map((tag: string) => (
                                <span
                                    key={tag}
                                    className="text-[13px] font-bold px-2.5 py-1 rounded-md bg-[#C76F40]/15 text-[#C76F40]"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                        <p className="text-[11px] font-medium text-[#8B7355]/65 mb-4">{t.nutritionDisclaimer}</p>

                        {/* Description */}
                        <p className="text-sm text-[#5C4A32]/80 leading-relaxed mb-4 italic">
                            &ldquo;{isEn ? ((dish as any).descEn || dish.desc) : dish.desc}&rdquo;
                        </p>

                        {/* Price + Qty */}
                        <div className="flex items-center justify-between py-3 px-4 bg-white rounded-2xl border border-[#E8DFD0] mb-6">
                            <div className="flex flex-col">
                                <span className="text-xl font-extrabold text-[#C76F40]">RM {dish.price.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setDishQty(Math.max(1, dishQty - 1))}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${dishQty <= 1 ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-[#2D5F3E] text-[#2D5F3E] hover:bg-[#2D5F3E] hover:text-white'}`}
                                    disabled={dishQty <= 1}
                                >
                                    <Minus size={14} />
                                </button>
                                <span className="w-8 text-center text-lg font-extrabold text-[#3B2A1A]">
                                    {dishQty}
                                </span>
                                <button
                                    onClick={() => setDishQty(dishQty + 1)}
                                    className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-[#2D5F3E] text-[#2D5F3E] hover:bg-[#2D5F3E] hover:text-white transition-all duration-200"
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ─── Divider ─── */}
                    <div className="mx-5 md:mx-6 border-t border-dashed border-[#E8DFD0] my-2" />

                    {/* The (required) delivery schedule comes BEFORE the optional add-ons
                        on BOTH breakpoints, so the disabled "请先选择送达时段" CTA is
                        explained without scroll-hunting. (Was desktop-only; boss approved
                        aligning mobile 2026-07-05.) */}
                    <div className="flex flex-col">

                    {/* ─── Add-on Sections ─── */}
                    <div className="px-5 md:px-6 mt-6 space-y-3 order-2">
                        {activeAddOnSections.map(section => {
                            const selectedCount = getSectionSelectedCount(section);
                            const isExpanded = expandedSections[section.id] ?? false;
                            // 套餐区一律高亮（橙框橙底橙字）。这里原本是四个 section id 的
                            // 硬编码白名单，2026-07-16 新增的四个套餐（greek/shaoxing/
                            // taucu/curry）没人往名单里补，结果长得跟普通配菜区一模一样。
                            // 改成看内容：这一区放的是 combo 商品就高亮，以后加套餐不会再漏。
                            const isSpecialCombo = section.items.some(item => item.category === 'combo');

                            return (
                                <div key={section.id} className={`bg-white rounded-2xl border ${isSpecialCombo ? 'border-[#FF6B35] shadow-sm' : 'border-[#E8DFD0]'} overflow-hidden transition-all duration-300`}>
                                    {/* Section Header */}
                                    <button
                                        onClick={() => toggleSection(section.id)}
                                        className={`w-full flex items-center justify-between px-4 py-3.5 hover:bg-[#FDF8F0]/50 transition-colors ${isSpecialCombo ? 'bg-[#FFF3E0]' : ''}`}
                                    >
                                        <div className="text-left">
                                            <h3 className={`text-sm font-extrabold ${isSpecialCombo ? 'text-[#FF6B35]' : 'text-[#3B2A1A]'}`}>
                                                {isEn ? (section.titleDisplayEn || section.titleEn) : section.title}
                                            </h3>
                                            <p className={`text-[11px] lg:text-[12px] font-medium ${isSpecialCombo ? 'text-[#FF6B35]/80' : 'text-[#8B7355]'}`}>
                                                {isEn ? section.title : section.titleEn}
                                            </p>
                                            {((section as any).extraDesc || (section as any).extraDescEn) && (
                                                <p className="max-w-[85%] text-[10px] lg:text-[11px] mt-1.5 leading-relaxed text-[#FF6B35]/70 lg:text-[#FF6B35]/85 whitespace-pre-wrap">
                                                    {isEn ? ((section as any).extraDescEn || (section as any).extraDesc) : (section as any).extraDesc}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isExpanded ? (
                                                <ChevronUp size={18} className={isSpecialCombo ? 'text-[#FF6B35]' : 'text-[#8B7355]'} />
                                            ) : (
                                                <ChevronDown size={18} className={isSpecialCombo ? 'text-[#FF6B35]' : 'text-[#8B7355]'} />
                                            )}
                                        </div>
                                    </button>

                                    {/* Section Items */}
                                    <div
                                        className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[1500px] opacity-100' : 'max-h-0 opacity-0'}`}
                                    >
                                        <div className={`border-t ${isSpecialCombo ? 'border-[#FF6B35]/20' : 'border-[#E8DFD0]/60'}`}>
                                            {section.items.map((item, itemIdx) => {
                                                const qty = quantities[item.id] || 0;
                                                const sectionCount = getSectionSelectedCount(section);
                                                const mutexBlocked = MUTEX_PAIRS[item.id] ? (quantities[MUTEX_PAIRS[item.id]] || 0) > 0 : false;

                                                return (
                                                    <div
                                                        key={item.id}
                                                        className={`flex items-center gap-3 px-4 py-3 ${itemIdx < section.items.length - 1 ? (isSpecialCombo ? 'border-b border-[#FF6B35]/10' : 'border-b border-[#E8DFD0]/40') : ''} transition-colors ${mutexBlocked ? 'opacity-35' : 'hover:bg-[#FDF8F0]/30'}`}
                                                    >
                                                        {/* Thumbnail */}
                                                        {item.image && (
                                                            <div className="w-12 h-12 rounded-xl bg-[#FDF8F0] overflow-hidden shrink-0 border border-[#E8DFD0]/60 relative">
                                                                <Image
                                                                    src={item.image}
                                                                    alt={item.name}
                                                                    fill
                                                                    className="object-cover"
                                                                    sizes="48px"
                                                                />
                                                            </div>
                                                        )}

                                                        {/* Item Info */}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold text-[#3B2A1A] truncate">
                                                                {isEn ? item.nameEn : item.name}
                                                            </p>
                                                            <p className="text-[11px] lg:text-[12px] text-[#8B7355]">
                                                                {isEn ? item.name : item.nameEn} · <span className="font-bold text-[#C76F40]">+RM {item.price.toFixed(2)}</span>
                                                            </p>
                                                        </div>

                                                        {/* Quantity Stepper */}
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <button
                                                                onClick={() => updateQty(item.id, -1)}
                                                                disabled={qty === 0}
                                                                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${qty === 0 ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-[#2D5F3E] text-[#2D5F3E] hover:bg-[#2D5F3E] hover:text-white active:scale-90'}`}
                                                            >
                                                                <Minus size={14} />
                                                            </button>
                                                            <span className={`w-6 text-center text-sm font-extrabold transition-colors ${qty > 0 ? 'text-[#2D5F3E]' : 'text-gray-300'}`}>
                                                                {qty}
                                                            </span>
                                                            <button
                                                                onClick={() => updateQty(item.id, 1)}
                                                                disabled={qty >= (item.maxQty ?? 10) || sectionCount >= section.maxSelect || mutexBlocked}
                                                                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${(qty >= (item.maxQty ?? 10) || sectionCount >= section.maxSelect || mutexBlocked) ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-[#2D5F3E] text-[#2D5F3E] hover:bg-[#2D5F3E] hover:text-white active:scale-90'}`}
                                                            >
                                                                <Plus size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* ─── Delivery Date and Time ─── */}
                    <div className="px-5 md:px-6 mt-4 order-1">
                        <div className="flex items-center gap-2 mb-3">
                            <Calendar size={18} className="text-[#8B7355]" />
                            <h3 className="text-sm font-extrabold text-[#3B2A1A]">{t.scheduleTitle}</h3>
                        </div>
                        <div className="flex flex-col gap-3">
                            {isDaily ? (
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-4 flex justify-center items-center pointer-events-none">
                                        <Calendar size={16} className="text-[#2D5F3E]" />
                                    </div>
                                    <input
                                        type="date"
                                        className="w-full block appearance-none min-h-[46px] pl-10 pr-4 py-3 bg-white border border-[#E8DFD0] rounded-2xl text-sm outline-none focus:ring-2 focus:ring-[#2D5F3E] text-[#3B2A1A] font-bold"
                                        value={selectedDate}
                                        min={minDate}
                                        onChange={(e) => {
                                            const selected = e.target.value;
                                            const selDate = new Date(selected);
                                            // 0=Sunday, 6=Saturday
                                            const day = selDate.getDay();
                                            if (day === 0 || day === 6) {
                                                alert(t.weekendAlert);
                                                return;
                                            }
                                            const allow = dish?.availableWeekdays;
                                            if (allow && allow.length && !allow.includes(day)) {
                                                alert(t.weekdayOnlyAlert(allow));
                                                return;
                                            }
                                            if (dish && isDishBlockedOn(dish.id, selected)) {
                                                alert(t.dishPausedAlert);
                                                return;
                                            }
                                            if (isDateClosed(selected)) {
                                                alert(t.dateClosedAlert);
                                                return;
                                            }
                                            if (selected < (minDate || "")) {
                                                setSelectedDate(minDate || "");
                                            } else {
                                                setSelectedDate(selected);
                                            }
                                        }}
                                    />
                                </div>
                            ) : (
                                <div className="w-full px-4 py-3 bg-[#E8DFD0]/30 border border-[#E8DFD0] rounded-2xl text-sm font-bold text-[#3B2A1A] flex items-center gap-2">
                                    <Calendar size={16} className="text-[#2D5F3E]" />
                                    {dateLabel || selectedDate} {t.fixedDateSuffix}
                                </div>
                            )}
                            {/* Both breakpoints: the two slots as big one-tap targets.
                                (Was a native <select> on mobile — three interactions and
                                an iOS picker wheel for a two-option choice.) */}
                            <div className="grid grid-cols-2 gap-3">
                                {([
                                    { value: 'Lunch (11AM-1PM)', label: t.lunchSlot },
                                    { value: 'Dinner (5PM-8PM)', label: t.dinnerSlot },
                                ] as const).map(slot => (
                                    <button
                                        key={slot.value}
                                        type="button"
                                        onClick={() => setSelectedTime(slot.value)}
                                        className={`min-h-[46px] px-4 py-3 rounded-2xl text-sm font-bold border-2 transition-colors ${
                                            selectedTime === slot.value
                                                ? 'border-[#2D5F3E] bg-[#2D5F3E] text-white'
                                                : 'border-[#E8DFD0] bg-white text-[#3B2A1A] hover:border-[#2D5F3E]/50'
                                        }`}
                                    >
                                        {slot.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    </div>{/* /desktop reorder wrapper */}

                    {/* ─── Note to Restaurant ─── */}
                    <div className="px-5 md:px-6 mt-6">
                        <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-sm font-extrabold text-[#3B2A1A]">{t.noteTitle}</h3>
                        </div>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder={t.notePlaceholder}
                            className="w-full h-24 p-4 bg-white rounded-2xl border border-[#E8DFD0] text-sm text-[#3B2A1A] placeholder:text-[#8B7355]/40 outline-none focus:ring-2 focus:ring-[#2D5F3E]/20 transition-all resize-none"
                        />
                    </div>

                </div>

                {/* ─── Non-overlapping Footer: Add to Cart ─── */}
                <div className="shrink-0 bg-white border-t border-[#E8DFD0] px-5 md:px-6 py-4 shadow-[0_-8px_30px_rgba(0,0,0,0.05)] w-full">
                    {/* Add-on summary (if any) */}
                    {addOnsTotal > 0 && (
                        <div className="flex justify-between items-center text-xs text-[#8B7355] mb-2 px-1">
                            <span>{t.summaryLine((dish.price * dishQty).toFixed(2), addOnsTotal.toFixed(2))}</span>
                        </div>
                    )}
                    <button
                        onClick={handleAddToCart}
                        disabled={!selectedTime}
                        className={`w-full py-4 rounded-2xl font-extrabold text-base flex justify-center items-center gap-2.5 transition-all duration-200 shadow-lg ${selectedTime
                            ? 'bg-[#2D5F3E] hover:bg-[#244E33] active:scale-[0.98] text-white shadow-[#2D5F3E]/20'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                            }`}
                    >
                        <ShoppingBag size={20} />
                        {selectedTime ? (initialConfig ? t.updateCart(grandTotal.toFixed(2)) : t.addToCart(grandTotal.toFixed(2))) : t.pickTimeFirst}
                    </button>
                </div>
            </div>
        </div>
    );
}
