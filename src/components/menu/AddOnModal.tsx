"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, ChevronDown, ChevronUp, Minus, Plus, ShoppingBag, Leaf } from 'lucide-react';

// ─── Add-on Data ────────────────────────────────────────────────────────────
// TODO: Move prices/items to a central config or CMS once finalized

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
            { id: 'sunny-egg', name: '荷包蛋', nameEn: 'Sunny Side Up Egg', price: 2.50, category: 'sides' },
            { id: 'potato-egg', name: '马铃薯煎蛋', nameEn: 'Potato Fried Egg', price: 3.50, image: '/potato_fried_egg.png', category: 'sides' },
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
            { id: 'onsen-egg', name: '温泉蛋', nameEn: 'Onsen Egg', price: 3.50, category: 'alacarte' },
            { id: 'chia-pudding', name: '奇亚籽布丁', nameEn: 'Chia Seed Pudding', price: 6.90, image: '/chia_seed_pudding.png', category: 'alacarte' },
        ]
    },
    {
        id: 'drinks',
        title: '特选茗茶',
        titleEn: 'Premium Chinese Tea',
        minSelect: 0,
        maxSelect: 30,
        items: [
            { id: 'longjing-ice', name: '龙井 (冰)', nameEn: 'Longjing Tea (Iced)', price: 3.80, image: '/tea.png', category: 'drinks' },
            { id: 'longjing-warm', name: '龙井 (温)', nameEn: 'Longjing Tea (Warm)', price: 3.80, image: '/tea.png', category: 'drinks' },
            { id: 'tieguanyin-ice', name: '铁观音 (冰)', nameEn: 'Tieguanyin Oolong (Iced)', price: 3.80, image: '/tea.png', category: 'drinks' },
            { id: 'tieguanyin-warm', name: '铁观音 (温)', nameEn: 'Tieguanyin Oolong (Warm)', price: 3.80, image: '/tea.png', category: 'drinks' },
            { id: 'shuixian-ice', name: '水仙 (冰)', nameEn: 'Shuixian Oolong (Iced)', price: 3.80, image: '/tea.png', category: 'drinks' },
            { id: 'shuixian-warm', name: '水仙 (温)', nameEn: 'Shuixian Oolong (Warm)', price: 3.80, image: '/tea.png', category: 'drinks' },
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
    onAddToCart: (dish: DishItem, addOns: { item: AddOnItem; quantity: number }[], totalPrice: number, note: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AddOnModal({
    isOpen,
    onClose,
    dish,
    addOnSections = defaultAddOnSections,
    onAddToCart,
}: AddOnModalProps) {
    // Track quantities per add-on item
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    // Track which sections are expanded
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    // Main dish quantity
    const [dishQty, setDishQty] = useState(1);
    // Note to restaurant
    const [note, setNote] = useState('');
    // Animation state
    const [isVisible, setIsVisible] = useState(false);

    // Compute dynamic add-on sections based on the selected dish
    const activeAddOnSections = React.useMemo(() => {
        if (!dish) return addOnSections;

        // If it's Natto Rice Bowl (id: 6), prepend a special combo section
        if (dish.id === 6) {
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
                            { id: 'onsen-egg-side', name: '温泉蛋', nameEn: 'Onsen Egg', price: 2.50, category: 'sides' },
                            { id: 'nori', name: '海苔', nameEn: 'Nori (Seaweed)', price: 2.00, category: 'sides' },
                            { id: 'soy-sauce', name: '秘制日本酱油', nameEn: 'Secret Japanese Soy Sauce', price: 1.50, category: 'sides' },
                            ...section.items.filter(item => item.id.includes('rice') && item.id !== 'brown-rice')
                        ]
                    };
                }
                if (section.id === 'alacarte') {
                    return {
                        ...section,
                        items: [
                            { id: 'sunny-egg-alacarte', name: '荷包蛋', nameEn: 'Sunny Side Up Egg', price: 2.50, category: 'alacarte' },
                            { id: 'potato-egg-alacarte', name: '马铃薯煎蛋', nameEn: 'Potato Fried Egg', price: 3.50, image: '/potato_fried_egg.png', category: 'alacarte' },
                            ...section.items.filter(item => item.id.includes('chia-pudding'))
                        ]
                    };
                }
                return section;
            });
            return [nattoSpecial, ...customSections];
        }

        // If it's Golden Crispy Chicken Chop (id: 1), append specific add-ons to the sides
        if (dish.id === 1) {
            return addOnSections.map(section => {
                if (section.id === 'sides') {
                    return {
                        ...section,
                        items: [
                            ...section.items.filter(item => item.id !== 'less-rice' && item.id !== 'extra-rice' && item.id !== 'brown-rice'),
                            { id: 'extra-chicken-chop', name: '加香煎金鸡扒 (150g)', nameEn: 'Extra Chicken Chop', price: 8.50, category: 'sides', maxQty: 3 },
                            { id: 'edamame', name: '枝豆 (50g)', nameEn: 'Edamame', price: 2.00, category: 'sides', maxQty: 3 },
                            { id: 'corn', name: '玉米粒 (50g)', nameEn: 'Corn', price: 2.00, category: 'sides', maxQty: 3 },
                            { id: 'cherry-tomato', name: '小番茄 (50g)', nameEn: 'Cherry Tomato', price: 2.00, category: 'sides', maxQty: 3 },
                            ...section.items.filter(item => item.id === 'less-rice' || item.id === 'extra-rice' || item.id === 'brown-rice')
                        ]
                    };
                }
                return section;
            });
        }

        return addOnSections;
    }, [dish, addOnSections]);

    // Reset state when modal opens/dish changes
    useEffect(() => {
        if (isOpen && dish) {
            setQuantities({});
            setDishQty(1);
            setNote('');
            // Expand first section by default
            const initialExpanded: Record<string, boolean> = {};
            activeAddOnSections.forEach((s, i) => {
                initialExpanded[s.id] = i === 0;
            });
            setExpandedSections(initialExpanded);
            // Trigger entrance animation
            requestAnimationFrame(() => setIsVisible(true));
        } else {
            setIsVisible(false);
        }
    }, [isOpen, dish, activeAddOnSections]);

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

    const updateQty = (itemId: string, delta: number) => {
        setQuantities(prev => {
            const current = prev[itemId] || 0;
            const newVal = Math.max(0, current + delta);
            // Limit individual add-on to 10 items
            return { ...prev, [itemId]: Math.min(newVal, 10) };
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

    const grandTotal = (dish.price * dishQty) + addOnsTotal;

    const handleAddToCart = () => {
        const selectedAddOns = activeAddOnSections.flatMap(section =>
            section.items
                .filter(item => (quantities[item.id] || 0) > 0)
                .map(item => ({ item, quantity: quantities[item.id] }))
        );
        onAddToCart(dish, selectedAddOns, grandTotal, note);
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
                className={`relative w-full max-w-lg max-h-[92vh] md:max-h-[88vh] bg-[#FDF8F0] md:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ease-out ${isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-[0.97]'}`}
            >
                {/* ─── Close Button ─── */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 z-20 w-9 h-9 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-md hover:bg-white hover:scale-110 transition-all duration-200 border border-[#E8DFD0]"
                >
                    <X size={18} className="text-[#5C4A32]" />
                </button>

                {/* ─── Scrollable Content ─── */}
                <div className="flex-1 overflow-y-auto overscroll-contain">

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
                        <div className="flex flex-wrap gap-1.5 mb-4">
                            {dish.tags.map(tag => (
                                <span
                                    key={tag}
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#C76F40]/10 text-[#C76F40]"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>

                        {/* Description */}
                        <p className="text-sm text-[#5C4A32]/80 leading-relaxed mb-4 italic">
                            "{dish.desc}"
                        </p>

                        {/* Price + Qty */}
                        <div className="flex items-center justify-between py-3 px-4 bg-white rounded-2xl border border-[#E8DFD0] mb-6">
                            <span className="text-xl font-extrabold text-[#C76F40]">
                                RM {dish.price.toFixed(2)}
                            </span>
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

                            return (
                                <div key={section.id} className={`bg-white rounded-2xl border ${section.id === 'natto-combo' ? 'border-[#FF6B35] shadow-sm' : 'border-[#E8DFD0]'} overflow-hidden transition-all duration-300`}>
                                    {/* Section Header */}
                                    <button
                                        onClick={() => toggleSection(section.id)}
                                        className={`w-full flex items-center justify-between px-4 py-3.5 hover:bg-[#FDF8F0]/50 transition-colors ${section.id === 'natto-combo' ? 'bg-[#FFF3E0]' : ''}`}
                                    >
                                        <div className="text-left">
                                            <h3 className={`text-sm font-extrabold ${section.id === 'natto-combo' ? 'text-[#FF6B35]' : 'text-[#3B2A1A]'}`}>
                                                {section.title}
                                            </h3>
                                            <p className={`text-[11px] font-medium ${section.id === 'natto-combo' ? 'text-[#FF6B35]/80' : 'text-[#8B7355]'}`}>
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
                                                <ChevronUp size={18} className={section.id === 'natto-combo' ? 'text-[#FF6B35]' : 'text-[#8B7355]'} />
                                            ) : (
                                                <ChevronDown size={18} className={section.id === 'natto-combo' ? 'text-[#FF6B35]' : 'text-[#8B7355]'} />
                                            )}
                                        </div>
                                    </button>

                                    {/* Section Items */}
                                    <div
                                        className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
                                    >
                                        <div className={`border-t ${section.id === 'natto-combo' ? 'border-[#FF6B35]/20' : 'border-[#E8DFD0]/60'}`}>
                                            {section.items.map((item, itemIdx) => {
                                                const qty = quantities[item.id] || 0;
                                                const sectionCount = getSectionSelectedCount(section);
                                                const atMax = sectionCount >= section.maxSelect && qty === 0;

                                                return (
                                                    <div
                                                        key={item.id}
                                                        className={`flex items-center gap-3 px-4 py-3 ${itemIdx < section.items.length - 1 ? (section.id === 'natto-combo' ? 'border-b border-[#FF6B35]/10' : 'border-b border-[#E8DFD0]/40') : ''} transition-colors hover:bg-[#FDF8F0]/30`}
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
                                                                disabled={qty >= (item.maxQty ?? 10) || sectionCount >= section.maxSelect}
                                                                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${(qty >= (item.maxQty ?? 10) || sectionCount >= section.maxSelect) ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-[#2D5F3E] text-[#2D5F3E] hover:bg-[#2D5F3E] hover:text-white active:scale-90'}`}
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

                    {/* ─── Note to Restaurant ─── */}
                    <div className="px-5 md:px-6 mt-6">
                        <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-sm font-extrabold text-[#3B2A1A]">备注 / Note to Kitchen</h3>
                        </div>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="告诉阿姨你的要求（如：不放葱、送到门口/家楼下guard house等） Special instructions (e.g., No green onions, leave at door/guard house)..."
                            className="w-full h-24 p-4 bg-white rounded-2xl border border-[#E8DFD0] text-sm text-[#3B2A1A] placeholder:text-[#8B7355]/40 outline-none focus:ring-2 focus:ring-[#2D5F3E]/20 transition-all resize-none"
                        />
                    </div>

                    {/* Bottom spacer for sticky footer */}
                    <div className="h-4" />
                </div>

                {/* ─── Sticky Footer: Add to Cart ─── */}
                <div className="shrink-0 bg-white/95 backdrop-blur-md border-t border-[#E8DFD0] px-5 md:px-6 py-4 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] z-10 w-full">
                    {/* Add-on summary (if any) */}
                    {addOnsTotal > 0 && (
                        <div className="flex justify-between items-center text-xs text-[#8B7355] mb-2 px-1">
                            <span>主菜 RM {(dish.price * dishQty).toFixed(2)} + 加购 RM {addOnsTotal.toFixed(2)}</span>
                        </div>
                    )}
                    <button
                        onClick={handleAddToCart}
                        className="w-full py-4 bg-[#2D5F3E] hover:bg-[#244E33] active:scale-[0.98] text-white rounded-2xl font-extrabold text-base flex justify-center items-center gap-2.5 transition-all duration-200 shadow-lg shadow-[#2D5F3E]/20"
                    >
                        <ShoppingBag size={20} />
                        加入预订 · RM {grandTotal.toFixed(2)}
                    </button>
                </div>
            </div>
        </div>
    );
}
