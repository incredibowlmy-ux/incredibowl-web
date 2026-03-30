"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, ChevronDown, ChevronUp, Minus, Plus, ShoppingBag, Leaf, Calendar, Clock } from 'lucide-react';
import { getDishPrice } from '@/data/promoConfig';

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
        maxSelect: 50, // High limit as we're focusing on per-item limit now
        items: [
            { id: 'less-rice', name: '少饭 (150g)', nameEn: 'Less Rice', price: 0.00, category: 'sides', maxQty: 1 },
            { id: 'extra-rice', name: '加饭 (150g)', nameEn: 'Extra Rice', price: 2.00, category: 'sides' },
            { id: 'brown-rice', name: '白饭换糙米 (180g)', nameEn: 'Swap Brown Rice', price: 2.00, category: 'sides', maxQty: 1 },
        ]
    },
    {
        id: 'alacarte',
        title: '单点',
        titleEn: 'A La Carte',
        minSelect: 0,
        maxSelect: 30,
        items: [
            { id: 'sunny-egg', name: '荷包蛋', nameEn: 'Sunny Side Up Egg', price: 2.50, category: 'alacarte' },
            { id: 'onsen-egg', name: '温泉蛋', nameEn: 'Onsen Egg', price: 3.00, category: 'alacarte' },
            { id: 'potato-egg', name: '马铃薯煎蛋', nameEn: 'Potato Fried Egg', price: 3.50, image: '/potato_fried_egg.webp', category: 'alacarte' },
            { id: 'extra-edamame', name: '清甜水煮毛豆仁 (50g)', nameEn: 'Edamame (50g)', price: 2.50, category: 'alacarte', maxQty: 3 },
            { id: 'extra-corn', name: '金黄甜玉米 (50g)', nameEn: 'Sweet Corn (50g)', price: 2.50, category: 'alacarte', maxQty: 3 },
            { id: 'chia-pudding', name: '奇亚籽布丁', nameEn: 'Chia Seed Pudding', price: 6.90, image: '/chia_seed_pudding.webp', category: 'alacarte' },
        ]
    },
    {
        id: 'drinks',
        title: '特选茗茶',
        titleEn: 'Premium Chinese Tea',
        minSelect: 0,
        maxSelect: 30,
        items: [
            { id: 'longjing-ice', name: '龙井 (冰)', nameEn: 'Longjing Tea (Iced)', price: 3.80, category: 'drinks' },
            { id: 'longjing-warm', name: '龙井 (温)', nameEn: 'Longjing Tea (Warm)', price: 3.80, category: 'drinks' },
            { id: 'tieguanyin-ice', name: '铁观音 (冰)', nameEn: 'Tieguanyin Oolong (Iced)', price: 3.80, category: 'drinks' },
            { id: 'tieguanyin-warm', name: '铁观音 (温)', nameEn: 'Tieguanyin Oolong (Warm)', price: 3.80, category: 'drinks' },
            { id: 'shuixian-ice', name: '水仙 (冰)', nameEn: 'Shuixian Oolong (Iced)', price: 3.80, category: 'drinks' },
            { id: 'shuixian-warm', name: '水仙 (温)', nameEn: 'Shuixian Oolong (Warm)', price: 3.80, category: 'drinks' },
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
    initialConfig = null,
}: AddOnModalProps) {
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
            const nattoSpecial: AddOnSection & { extraDesc?: string } = {
                id: 'natto-combo',
                title: '✨ 升级你的 Incredibowl！',
                titleEn: '灵魂三件套 (Soulful Trio) (+ RM 5) · Max 3',
                minSelect: 0,
                maxSelect: 3,
                extraDesc: '包含：浓厚温泉蛋 + 脆质海苔 + 特制日本酱油\n“当酱油遇见脆爽海苔，在流心月见的温柔包裹下，瞬间唤醒纳豆沉睡的‘极鲜’灵魂。”',
                items: [
                    { id: 'natto-super-combo', name: '灵魂三件套 (原价 RM 6.0)', nameEn: 'Soulful Trio', price: 5.00, category: 'combo' }
                ]
            };
            const customSections = addOnSections.map(section => {
                if (section.id === 'sides') {
                    return {
                        ...section,
                        items: [
                            { id: 'natto-side', name: '健康发酵纳豆', nameEn: 'Natto', price: 4.90, category: 'sides' },
                            { id: 'onsen-egg-side', name: '温泉蛋', nameEn: 'Onsen Egg', price: 3.00, category: 'sides' },
                            { id: 'nori', name: '海苔', nameEn: 'Nori (Seaweed)', price: 2.00, category: 'sides' },
                            { id: 'soy-sauce', name: '秘制日本酱油', nameEn: 'Secret Japanese Soy Sauce', price: 1.50, category: 'sides' },
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
            const surfTurfSpecial: AddOnSection & { extraDesc?: string } = {
                id: 'surf-turf-combo',
                title: '✨ 鲜上加鲜！海陆澎湃大翻倍',
                titleEn: 'Ultimate Surf & Turf Trio (+ RM 11.40)',
                minSelect: 0,
                maxSelect: 3,
                extraDesc: '包含：鲜甜大虾仁 4只 + 嫩炒鸡丁 50g + 脆爽云耳 20g\n“想要大口吃肉的满足感？这是蛋白质与膳食纤维的终极爆发。”',
                items: [
                    { id: 'surf-turf-super-combo', name: '海陆澎湃三件套 (原价 RM 14.0)', nameEn: 'Ultimate Trio', price: 11.40, category: 'combo' }
                ]
            };
            const customSections = addOnSections.map(section => {
                if (section.id === 'sides') {
                    return {
                        ...section,
                        items: [
                            { id: 'extra-prawns', name: '鲜甜大虾仁 (4只)', nameEn: 'Extra Sweet Prawns (4pcs)', price: 7.00, category: 'sides', maxQty: 3 },
                            { id: 'extra-chicken-breast', name: '嫩炒鸡丁 (50g)', nameEn: 'Tender Shredded Chicken Breast (50g)', price: 4.50, category: 'sides', maxQty: 3 },
                            { id: 'extra-fungus', name: '脆爽云耳 (20g)', nameEn: 'Crisp Black Fungus (20g)', price: 2.50, category: 'sides', maxQty: 3 },
                            { id: 'extra-yam', name: '鲜脆山药块 (90g)', nameEn: 'Fresh Chinese Yam (90g)', price: 4.00, category: 'sides', maxQty: 3 },
                            ...section.items.filter(item => item.id !== 'sunny-egg' && item.id !== 'potato-egg')
                        ]
                    };
                }
                return section;
            });
            return [surfTurfSpecial, ...customSections];
        }

        // If it's Golden Crispy Chicken Chop (id: 1), append specific add-ons to the sides
        if (dish.id === 1) {
            const chickenChopSpecial: AddOnSection & { extraDesc?: string } = {
                id: 'chicken-chop-combo',
                title: '✨ 古早味澎湃大满贯三件套',
                titleEn: 'Ultimate Nostalgia Combo (+ RM 12.40)',
                minSelect: 0,
                maxSelect: 3,
                extraDesc: '包含：多加一块香煎金鸡扒 + 荷包蛋 + 加饭\n“想要彻底犒劳自己的一顿饭？双份酒香鸡扒的爆棚肉感，戳破流心的古早味荷包蛋拌入白饭，这是干饭人最顶级的满足感！”',
                items: [
                    { id: 'chicken-chop-nostalgia-combo', name: '古早味大满贯三件套 (原价 RM 14.40)', nameEn: 'Ultimate Nostalgia Combo', price: 12.40, category: 'combo' }
                ]
            };
            const customSections = addOnSections.map(section => {
                if (section.id === 'sides') {
                    return {
                        ...section,
                        items: [
                            ...section.items.filter(item => item.id !== 'less-rice' && item.id !== 'extra-rice' && item.id !== 'brown-rice'),
                            { id: 'extra-chicken-chop', name: '加香煎金鸡扒 (150g)', nameEn: 'Extra Chicken Chop', price: 9.90, category: 'sides', maxQty: 3 },
                            { id: 'extra-edamame-side', name: '清甜水煮毛豆仁 (50g)', nameEn: 'Edamame', price: 2.50, category: 'sides', maxQty: 3 },
                            { id: 'extra-corn-side', name: '金黄甜玉米 (50g)', nameEn: 'Corn', price: 2.50, category: 'sides', maxQty: 3 },
                            { id: 'cherry-tomato', name: '爽脆多汁小番茄 (50g)', nameEn: 'Cherry Tomato', price: 2.50, category: 'sides', maxQty: 3 },
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
            const proteinBombSpecial: AddOnSection & { extraDesc?: string } = {
                id: 'greek-combo',
                title: '✨ 终极爆肌！蛋白质核弹三件套',
                titleEn: 'Ultimate Protein Bomb Trio (+ RM 15.90)',
                minSelect: 0,
                maxSelect: 3,
                extraDesc: '包含：180g 柠香烤鸡胸 + 80g 澳洲烤薯块 + 80g 脆甜椰菜花\n“突破百克优质蛋白的终极归宿，练后快速回血、饱腹无负担。”',
                items: [
                    { id: 'greek-protein-bomb-combo', name: '蛋白质核弹三件套 (原价 RM 18.40)', nameEn: 'Protein Bomb Trio', price: 15.90, category: 'combo' }
                ]
            };
            const customSections = addOnSections.map(section => {
                if (section.id === 'sides') {
                    return {
                        ...section,
                        items: [
                            { id: 'extra-greek-chicken-180g', name: '【增肌极客】加 180g 柠香烤鸡胸', nameEn: 'Extra Lemon Chicken Breast (180g)', price: 11.90, category: 'sides', maxQty: 3 },
                            { id: 'extra-aus-potato-80g', name: '【优质碳水】加 80g 澳洲烤薯块', nameEn: 'Extra Roasted Aus Potato (80g)', price: 3.50, category: 'sides', maxQty: 3 },
                            { id: 'extra-cauliflower-80g', name: '【抗氧高纤】加 80g 脆甜椰菜花', nameEn: 'Extra Cauliflower (80g)', price: 3.00, category: 'sides', maxQty: 3 },
                            { id: 'extra-black-olive-12g', name: '【地中海风味】加 12g 提鲜黑橄榄', nameEn: 'Extra Black Olive Slice (12g)', price: 1.50, category: 'sides', maxQty: 3 },
                            ...section.items.filter(item => item.id !== 'sunny-egg' && item.id !== 'potato-egg')
                        ]
                    };
                }
                return section;
            });
            return [proteinBombSpecial, ...customSections];
        }

        // If it's Angelica Steamed Whole Chicken Leg (id: 13), append specific add-ons to the sides
        if (dish.id === 13) {
            return addOnSections.map(section => {
                if (section.id === 'sides') {
                    return {
                        ...section,
                        items: [
                            ...section.items.filter(item => item.id !== 'less-rice' && item.id !== 'extra-rice' && item.id !== 'brown-rice'),
                            { id: 'extra-herbal-leg-1', name: '【犒劳自己】多加一只暖胃全鸡腿', nameEn: 'Extra Steamed Herbal Chicken Leg (+1)', price: 11.90, category: 'sides', maxQty: 1 },
                            { id: 'extra-herbal-leg-2', name: '【双份温补】加两只汤汁饱满鸡腿', nameEn: 'Extra Steamed Herbal Chicken Legs (+2)', price: 21.90, category: 'sides', maxQty: 1 },
                            { id: 'extra-herbal-leg-3', name: '【全家加菜】加三只（家人一起补）', nameEn: 'Extra Steamed Herbal Chicken Legs (+3)', price: 31.40, category: 'sides', maxQty: 1 },
                            ...section.items.filter(item => item.id === 'less-rice' || item.id === 'extra-rice' || item.id === 'brown-rice')
                        ]
                    };
                }
                return section;
            });
        }

        // If it's Golden Scallion Pan-Fried Chicken Soup (id: 5), prepend combo + chicken leg add-ons
        if (dish.id === 5) {
            const scallionCombo: AddOnSection & { extraDesc?: string } = {
                id: 'scallion-combo',
                title: '✨ 葱汤干饭王！爆量满足三件套',
                titleEn: 'Scallion Soup Rice King Trio (+ RM 12.40)',
                minSelect: 0,
                maxSelect: 3,
                extraDesc: '包含：香煎金鸡扒 150g + 古早味荷包蛋 + 加饭\n"一碗热腾腾的葱汤配上焦香鸡扒，戳破流心荷包蛋拌进白饭——周五就该这样犒劳自己！"',
                items: [
                    { id: 'scallion-soup-combo', name: '爆量满足三件套 (原价 RM 14.40)', nameEn: 'Rice King Trio', price: 12.40, category: 'combo' }
                ]
            };
            const customSections = addOnSections.map(section => {
                if (section.id === 'sides') {
                    return {
                        ...section,
                        items: [
                            ...section.items.filter(item => item.id !== 'less-rice' && item.id !== 'extra-rice' && item.id !== 'brown-rice'),
                            { id: 'extra-scallion-chop-side', name: '【收工犒劳】多加一只葱香煎鸡扒', nameEn: 'Extra Scallion Chicken Chop', price: 9.90, category: 'sides', maxQty: 3 },
                            ...section.items.filter(item => item.id === 'less-rice' || item.id === 'extra-rice' || item.id === 'brown-rice')
                        ]
                    };
                }
                return section;
            });
            return [scallionCombo, ...customSections];
        }

        // If it's Potato Pork Belly Stew (id: 4), prepend a special combo section
        if (dish.id === 4) {
            const porkPotatoCombo: AddOnSection & { extraDesc?: string } = {
                id: 'pork-potato-combo',
                title: '✨ 薯肉双拼满足套',
                titleEn: 'Potato & Pork Belly Duo (+ RM 11.40)',
                minSelect: 0,
                maxSelect: 3,
                extraDesc: '包含：绵密马铃薯 90g + 香滑花肉片 70g\n"一口软糯薯块裹着浓郁肉汁，再来几片入味花肉，这就是家的味道。"',
                items: [
                    { id: 'pork-potato-duo-combo', name: '薯肉双拼满足套 (原价 RM 13.40)', nameEn: 'Potato & Pork Belly Duo', price: 11.40, category: 'combo' }
                ]
            };
            const customSections = addOnSections.map(section => {
                if (section.id === 'sides') {
                    return {
                        ...section,
                        items: [
                            ...section.items.filter(item => item.id !== 'less-rice' && item.id !== 'extra-rice' && item.id !== 'brown-rice'),
                            { id: 'extra-potato', name: '【绵密软糯】加马铃薯 (90g)', nameEn: 'Extra Potato (90g)', price: 3.50, category: 'sides', maxQty: 3 },
                            { id: 'extra-pork-belly', name: '【浓香入味】加花肉片 (70g)', nameEn: 'Extra Pork Belly Slices (70g)', price: 9.90, category: 'sides', maxQty: 3 },
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

    const discountedPrice = getDishPrice(dish.price);
    const grandTotal = (discountedPrice * dishQty) + addOnsTotal;

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
                            {dish.name}
                        </h2>
                        <p className="text-sm font-medium text-[#8B7355] mb-3">
                            {dish.nameEn}
                        </p>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                            {dish.tags.map(tag => (
                                <span
                                    key={tag}
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#C76F40]/10 text-[#C76F40]"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                        <p className="text-[9px] font-bold text-[#8B7355]/50 mb-4">* 营养数据为估算值，实际可能因食材批次略有差异。</p>

                        {/* Description */}
                        <p className="text-sm text-[#5C4A32]/80 leading-relaxed mb-4 italic">
                            &ldquo;{dish.desc}&rdquo;
                        </p>

                        {/* Price + Qty */}
                        <div className="flex items-center justify-between py-3 px-4 bg-white rounded-2xl border border-[#E8DFD0] mb-6">
                            <div className="flex flex-col">
                                <span className="text-xs text-[#8B7355]/60 line-through font-medium">RM {dish.price.toFixed(2)}</span>
                                <span className="text-xl font-extrabold text-[#C76F40]">RM {getDishPrice(dish.price).toFixed(2)}</span>
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

                    {/* ─── Add-on Sections ─── */}
                    <div className="px-5 md:px-6 mt-4 space-y-3">
                        {activeAddOnSections.map(section => {
                            const selectedCount = getSectionSelectedCount(section);
                            const isExpanded = expandedSections[section.id] ?? false;
                            const isSpecialCombo = section.id === 'natto-combo' || section.id === 'surf-turf-combo' || section.id === 'scallion-combo' || section.id === 'pork-potato-combo';

                            return (
                                <div key={section.id} className={`bg-white rounded-2xl border ${isSpecialCombo ? 'border-[#FF6B35] shadow-sm' : 'border-[#E8DFD0]'} overflow-hidden transition-all duration-300`}>
                                    {/* Section Header */}
                                    <button
                                        onClick={() => toggleSection(section.id)}
                                        className={`w-full flex items-center justify-between px-4 py-3.5 hover:bg-[#FDF8F0]/50 transition-colors ${isSpecialCombo ? 'bg-[#FFF3E0]' : ''}`}
                                    >
                                        <div className="text-left">
                                            <h3 className={`text-sm font-extrabold ${isSpecialCombo ? 'text-[#FF6B35]' : 'text-[#3B2A1A]'}`}>
                                                {section.title}
                                            </h3>
                                            <p className={`text-[11px] font-medium ${isSpecialCombo ? 'text-[#FF6B35]/80' : 'text-[#8B7355]'}`}>
                                                {section.titleEn}
                                            </p>
                                            {(section as any).extraDesc && (
                                                <p className="max-w-[85%] text-[10px] mt-1.5 leading-relaxed text-[#FF6B35]/70 whitespace-pre-wrap">
                                                    {(section as any).extraDesc}
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
                                                                {item.name}
                                                            </p>
                                                            <p className="text-[11px] text-[#8B7355]">
                                                                {item.nameEn} · <span className="font-bold text-[#C76F40]">+RM {item.price.toFixed(2)}</span>
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
                    <div className="px-5 md:px-6 mt-6">
                        <div className="flex items-center gap-2 mb-3">
                            <Calendar size={18} className="text-[#8B7355]" />
                            <h3 className="text-sm font-extrabold text-[#3B2A1A]">送达时间 / Delivery Schedule</h3>
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
                                                alert("周末不对外开灶哦！请选择周一至周五的配送。 (Weekends are only for BowlMama's rest!)");
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
                                    {dateLabel || selectedDate} (固定款)
                                </div>
                            )}
                            <div className="relative">
                                <div className="absolute inset-y-0 left-4 flex justify-center items-center pointer-events-none">
                                    <Clock size={16} className="text-[#2D5F3E]" />
                                </div>
                                <select
                                    className="w-full block appearance-none min-h-[46px] pl-10 pr-4 py-3 bg-white border border-[#E8DFD0] rounded-2xl text-sm outline-none focus:ring-2 focus:ring-[#2D5F3E] text-[#3B2A1A] font-bold cursor-pointer"
                                    value={selectedTime}
                                    onChange={(e) => setSelectedTime(e.target.value)}
                                >
                                    <option value="" disabled hidden>选个时间呗 / Select Time</option>
                                    <option value="Lunch (11AM-1PM)">🌞 午餐 11AM - 1PM</option>
                                    <option value="Dinner (6PM-8PM)">🌙 晚餐 6PM - 8PM</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* ─── Note to Restaurant ─── */}
                    <div className="px-5 md:px-6 mt-6">
                        <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-sm font-extrabold text-[#3B2A1A]">备注 / Note to Kitchen</h3>
                        </div>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="告诉碗妈你的要求（如：不放葱、送到门口/家楼下guard house等） Special instructions (e.g., No green onions, leave at door/guard house)..."
                            className="w-full h-24 p-4 bg-white rounded-2xl border border-[#E8DFD0] text-sm text-[#3B2A1A] placeholder:text-[#8B7355]/40 outline-none focus:ring-2 focus:ring-[#2D5F3E]/20 transition-all resize-none"
                        />
                    </div>

                </div>

                {/* ─── Non-overlapping Footer: Add to Cart ─── */}
                <div className="shrink-0 bg-white border-t border-[#E8DFD0] px-5 md:px-6 py-4 shadow-[0_-8px_30px_rgba(0,0,0,0.05)] w-full">
                    {/* Add-on summary (if any) */}
                    {addOnsTotal > 0 && (
                        <div className="flex justify-between items-center text-xs text-[#8B7355] mb-2 px-1">
                            <span>主菜 RM {(getDishPrice(dish.price) * dishQty).toFixed(2)} + 加购 RM {addOnsTotal.toFixed(2)}</span>
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
                        {selectedTime ? (initialConfig ? `更新订单配置 · RM ${grandTotal.toFixed(2)}` : `加入预订 · RM ${grandTotal.toFixed(2)}`) : '请先选择送达时段 👆'}
                    </button>
                </div>
            </div>
        </div>
    );
}
