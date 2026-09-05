"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, ChevronDown, ChevronUp, Minus, Plus, ShoppingBag, Leaf, Calendar } from 'lucide-react';
import { buildAddOnSections, defaultAddOnSections } from './addOnSections';
import type { AddOnItem, AddOnSection, DishItem } from './addOnSections';
import { isDishBlockedOn, isDateClosed, isDinnerClosedOn, closureReasonOn } from '@/data/blockedDates';
import type { Locale } from '@/lib/locale';
import { ADDON_DICT } from './dict';
import { useModalA11y } from '@/components/ui/useModalA11y';

export type { AddOnItem, AddOnSection } from './addOnSections';

/**
 * 记住上次选的午/晚餐。
 *
 * 时段是必填（没选 CTA 就灰着写「请先选择时段」），而每加一道菜都要重新点
 * 一次同一个选择 —— 点 3 道菜就是 3 次重复劳动，而 99% 的客户每次都选同一个。
 *
 * ⚠️ 只接受下面两个**逐字**字面量。这两个串会原样进订单文档、备餐单和
 * dashboard 的午/晚分组，localStorage 是客户可以随便改的地方，绝不能把它
 * 里面的任意字符串直接当时段用。认不出就当没存过，回到「必须自己选」。
 */
const SLOT_LUNCH = 'Lunch (11AM-1PM)';
const SLOT_DINNER = 'Dinner (5PM-8PM)';
const LAST_SLOT_KEY = 'incredibowl_last_slot';

function readLastSlot(): string {
    try {
        const v = localStorage.getItem(LAST_SLOT_KEY);
        return v === SLOT_LUNCH || v === SLOT_DINNER ? v : '';
    } catch {
        return '';
    }
}

function saveLastSlot(slot: string): void {
    if (slot !== SLOT_LUNCH && slot !== SLOT_DINNER) return;
    try { localStorage.setItem(LAST_SLOT_KEY, slot); } catch { /* 隐私模式 */ }
}

// ─── Types ──────────────────────────────────────────────────────────────────

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
    // 日期不可选的原因，内联显示在日期框下面。取代原来的 alert() —— alert
    // 弹完客户点掉后 input 的值已经被 return 掉了，视觉上「日期没变」却不知
    // 道为什么，还要重新点开日历重滑一遍。
    const [dateError, setDateError] = useState('');
    // Animation state
    const [isVisible, setIsVisible] = useState(false);
    /** 面板本体：焦点陷阱要知道「哪块算弹窗内部」。 */
    const panelRef = React.useRef<HTMLDivElement | null>(null);
    /** 时段区：CTA 点下去要能滚过来并闪一下。 */
    const scheduleRef = React.useRef<HTMLDivElement | null>(null);
    /** 时段区的一次性高亮（1.2s 后自动撤）。 */
    const [slotHighlight, setSlotHighlight] = useState(false);

    // 只送午餐的日子（长假前最后一天等）：晚餐按钮灰掉。上次记住的时段是
    // 晚餐、或者先选了晚餐再改日期的，都要把已选时段清掉 —— 否则 CTA 亮着
    // 却会被 /api/submit-order 拒收。
    const dinnerClosed = !!selectedDate && isDinnerClosedOn(selectedDate);
    useEffect(() => {
        if (dinnerClosed && selectedTime === SLOT_DINNER) setSelectedTime('');
    }, [dinnerClosed, selectedTime]);

    // Compute dynamic add-on sections based on the selected dish
    const activeAddOnSections = React.useMemo(() => {
        if (!dish) return addOnSections;
        return buildAddOnSections(dish, addOnSections);
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
                // 记住上次选的午/晚餐并默认选中。时段是必填（不选 CTA 灰着），
                // 点 3 道菜就要重复点 3 次同一个选择；99% 的客户每次都选同一个。
                // 只认我们自己写进去的两个字面量，其余一律当没存过。
                setSelectedTime(readLastSlot());
                // 默认展开**第一个非套餐区**。套餐区经常就是 index 0，而它通常只有
                // 1 个商品 —— 展开它等于把真正的 7~12 个加料全折起来，客人打开弹窗
                // 只看得到一行。套餐区自己有橙色高亮，不靠展开也够显眼。
                const firstRegular = activeAddOnSections.findIndex(
                    sec => !sec.items.some(it => it.category === 'combo'));
                const openIdx = firstRegular >= 0 ? firstRegular : 0;
                const initialExpanded: Record<string, boolean> = {};
                activeAddOnSections.forEach((s, i) => {
                    initialExpanded[s.id] = i === openIdx;
                });
                setExpandedSections(initialExpanded);
            }
            // Trigger entrance animation
            requestAnimationFrame(() => setIsVisible(true));
        } else {
            setIsVisible(false);
        }
    }, [isOpen, dish, activeAddOnSections, defaultDate, minDate, initialConfig]);

    // 背景滚动锁 / Escape / 焦点陷阱全部交给共享 hook。原来这里的实现结束时把
    // overflow 写死成 ''，而购物车抽屉可以叠在这个弹窗之上打开 —— 后关的那个会
    // 把前一个的锁一起解掉。hook 记的是「打开前的值」。
    // ⚠️ 必须在任何 early return **之前**声明并调用（hook 规则），所以
    // handleClose 也提到这里 —— 原来它定义在 `if (!isOpen) return null` 之后。
    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300); // wait for exit animation
    };

    useModalA11y({ open: isOpen, onClose: handleClose, panelRef });

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

    /**
     * 没选时段时点主按钮：不再是「按钮灰着 + 一句指向看不见的地方的提示」，
     * 而是把人送到时段区并高亮一下。移动端图片 + 标题 + 标签 + 价格行大约 700px，
     * 时段区本来就在首屏之外，客人看不到那个 👆 指的是什么。
     */
    const focusSlotPicker = () => {
        scheduleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setSlotHighlight(true);
        setTimeout(() => setSlotHighlight(false), 1200);
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
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="addon-modal-title"
                className={`relative w-full max-w-lg h-[92vh] md:h-auto md:max-h-[88vh] bg-[#FDF8F0] md:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ease-out ${isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-[0.97]'}`}
            >
                {/* ─── Close Button ─── */}
                <button
                    onClick={handleClose}
                    aria-label={t.closeModal}
                    className="absolute top-4 right-4 z-20 w-11 h-11 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-md hover:bg-white hover:scale-110 transition-all duration-200 border border-[#E8DFD0]"
                >
                    <X size={18} className="text-[#5C4A32]" />
                </button>

                {/* ─── Scrollable Content ─── */}
                <div className="flex-1 overflow-y-auto overscroll-contain pb-6">

                    {/* ─── Dish Hero Image ─── */}
                    <div className="relative w-full aspect-[16/9] md:aspect-[4/3] bg-[#E8DFD0]">
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

                        <h2 id="addon-modal-title" className="text-2xl font-extrabold text-[#3B2A1A] leading-tight mb-1">
                            {isEn ? dish.nameEn : dish.name}
                        </h2>
                        <p className="text-sm font-medium text-[#8B7355] mb-3">
                            {isEn ? dish.name : dish.nameEn}
                        </p>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                            {(isEn ? ((dish as any).tagsEn || dish.tags) : dish.tags).slice(0, 3).map((tag: string) => (
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
                                    aria-label={t.decreaseQty(t.dishQtyLabel)}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${dishQty <= 1 ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-[#2D5F3E] text-[#2D5F3E] hover:bg-[#2D5F3E] hover:text-white'}`}
                                    disabled={dishQty <= 1}
                                >
                                    <Minus size={16} />
                                </button>
                                <span className="w-8 text-center text-lg font-extrabold text-[#3B2A1A]" aria-live="polite">
                                    {dishQty}
                                </span>
                                <button
                                    onClick={() => setDishQty(dishQty + 1)}
                                    aria-label={t.increaseQty(t.dishQtyLabel)}
                                    className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-[#2D5F3E] text-[#2D5F3E] hover:bg-[#2D5F3E] hover:text-white transition-all duration-200"
                                >
                                    <Plus size={16} />
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
                    {/* 送达时间（必选）在 DOM 里就排在加料（可选）之前 ——
                        2026-09-05 之前是靠 CSS order-1/order-2 反转视觉顺序，
                        Tab 和读屏走 DOM 顺序，会先撞进十来个加料才到必选项。 */}
                    <div className="flex flex-col">
                    {/* ─── Delivery Date and Time ─── */}
                    <div ref={scheduleRef} className={`px-5 md:px-6 mt-4 rounded-2xl transition-shadow duration-300 ${slotHighlight ? 'ring-2 ring-primary ring-offset-2 ring-offset-[#FDF8F0]' : ''}`}>
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
                                                setDateError(t.weekendAlert);
                                                return;
                                            }
                                            const allow = dish?.availableWeekdays;
                                            if (allow && allow.length && !allow.includes(day)) {
                                                setDateError(t.weekdayOnlyAlert(allow));
                                                return;
                                            }
                                            if (dish && isDishBlockedOn(dish.id, selected)) {
                                                setDateError(t.dishPausedAlert);
                                                return;
                                            }
                                            if (isDateClosed(selected)) {
                                                // 计划内的休假不能挂「已售罄」——那是两件事。
                                                setDateError(closureReasonOn(selected) === 'holiday'
                                                    ? t.dateHolidayAlert
                                                    : t.dateClosedAlert);
                                                return;
                                            }
                                            setDateError('');
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
                            {dateError && (
                                <div className="-mt-1 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 leading-relaxed">
                                    {dateError}
                                </div>
                            )}
                            {/* Both breakpoints: the two slots as big one-tap targets.
                                (Was a native <select> on mobile — three interactions and
                                an iOS picker wheel for a two-option choice.) */}
                            <div className="grid grid-cols-2 gap-3">
                                {([
                                    { value: SLOT_LUNCH, label: t.lunchSlot },
                                    { value: SLOT_DINNER, label: t.dinnerSlot },
                                ] as const).map(slot => {
                                    const closed = slot.value === SLOT_DINNER && dinnerClosed;
                                    return (
                                    <button
                                        key={slot.value}
                                        type="button"
                                        disabled={closed}
                                        onClick={() => { setSelectedTime(slot.value); saveLastSlot(slot.value); }}
                                        className={`min-h-[46px] px-4 py-3 rounded-2xl text-sm font-bold border-2 transition-colors ${
                                            closed
                                                ? 'border-[#E8DFD0] bg-[#E8DFD0]/40 text-[#8B7355]/50 line-through cursor-not-allowed'
                                                : selectedTime === slot.value
                                                ? 'border-[#2D5F3E] bg-[#2D5F3E] text-white'
                                                : 'border-[#E8DFD0] bg-white text-[#3B2A1A] hover:border-[#2D5F3E]/50'
                                        }`}
                                    >
                                        {slot.label}
                                    </button>
                                    );
                                })}
                            </div>
                            {dinnerClosed && (
                                <div className="-mt-1 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-800 leading-relaxed">
                                    {t.dinnerClosedNote}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ─── Add-on Sections ─── */}
                    <div className="px-5 md:px-6 mt-6 space-y-3">
                        {activeAddOnSections.map(section => {
                            const selectedCount = getSectionSelectedCount(section);
                            const isExpanded = expandedSections[section.id] ?? false;
                            // 套餐区一律高亮（橙框橙底橙字）。这里原本是四个 section id 的
                            // 硬编码白名单，2026-07-16 新增的四个套餐（greek/shaoxing/
                            // taucu/curry）没人往名单里补，结果长得跟普通配菜区一模一样。
                            // 改成看内容：这一区放的是 combo 商品就高亮，以后加套餐不会再漏。
                            const isSpecialCombo = section.items.some(item => item.category === 'combo');

                            return (
                                <div key={section.id} className={`bg-white rounded-2xl border ${isSpecialCombo ? 'border-primary shadow-sm' : 'border-[#E8DFD0]'} overflow-hidden transition-all duration-300`}>
                                    {/* Section Header */}
                                    <button
                                        onClick={() => toggleSection(section.id)}
                                        className={`w-full flex items-center justify-between px-4 py-3.5 hover:bg-[#FDF8F0]/50 transition-colors ${isSpecialCombo ? 'bg-[#FFF3E0]' : ''}`}
                                    >
                                        <div className="text-left">
                                            <h3 className={`text-sm font-extrabold ${isSpecialCombo ? 'text-primary' : 'text-[#3B2A1A]'}`}>
                                                {isEn ? (section.titleDisplayEn || section.titleEn) : section.title}
                                            </h3>
                                            <p className={`text-[11px] lg:text-[12px] font-medium ${isSpecialCombo ? 'text-primary/80' : 'text-[#8B7355]'}`}>
                                                {isEn ? section.title : section.titleEn}
                                            </p>
                                            {/* 收起时不显示已选数量的话，客人不知道这一区里还有东西。
                                                selectedCount 一直算着，只是从来没渲染过。 */}
                                            {!isExpanded && selectedCount > 0 && (
                                                <span className="inline-block mt-1 text-[11px] font-bold text-white bg-primary rounded-full px-2 py-0.5">
                                                    {t.selectedCount(selectedCount)}
                                                </span>
                                            )}
                                            {((section as any).extraDesc || (section as any).extraDescEn) && (
                                                <p className="max-w-[85%] text-[10px] lg:text-[11px] mt-1.5 leading-relaxed text-primary/70 lg:text-primary/85 whitespace-pre-wrap">
                                                    {isEn ? ((section as any).extraDescEn || (section as any).extraDesc) : (section as any).extraDesc}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isExpanded ? (
                                                <ChevronUp size={18} className={isSpecialCombo ? 'text-primary' : 'text-[#8B7355]'} />
                                            ) : (
                                                <ChevronDown size={18} className={isSpecialCombo ? 'text-primary' : 'text-[#8B7355]'} />
                                            )}
                                        </div>
                                    </button>

                                    {/* Section Items */}
                                    <div
                                        className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[1500px] opacity-100' : 'max-h-0 opacity-0'}`}
                                    >
                                        <div className={`border-t ${isSpecialCombo ? 'border-primary/20' : 'border-[#E8DFD0]/60'}`}>
                                            {section.items.map((item, itemIdx) => {
                                                const qty = quantities[item.id] || 0;
                                                const sectionCount = getSectionSelectedCount(section);
                                                const mutexBlocked = MUTEX_PAIRS[item.id] ? (quantities[MUTEX_PAIRS[item.id]] || 0) > 0 : false;

                                                return (
                                                    <div
                                                        key={item.id}
                                                        className={`flex items-center gap-3 px-4 py-3 ${itemIdx < section.items.length - 1 ? (isSpecialCombo ? 'border-b border-primary/10' : 'border-b border-[#E8DFD0]/40') : ''} transition-colors ${mutexBlocked ? 'opacity-35' : 'hover:bg-[#FDF8F0]/30'}`}
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
                                                                aria-label={t.decreaseQty(isEn ? (item.nameEn || item.name) : item.name)}
                                                                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${qty === 0 ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-[#2D5F3E] text-[#2D5F3E] hover:bg-[#2D5F3E] hover:text-white active:scale-90'}`}
                                                            >
                                                                <Minus size={16} />
                                                            </button>
                                                            <span className={`w-6 text-center text-sm font-extrabold transition-colors ${qty > 0 ? 'text-[#2D5F3E]' : 'text-gray-300'}`} aria-live="polite">
                                                                {qty}
                                                            </span>
                                                            <button
                                                                onClick={() => updateQty(item.id, 1)}
                                                                disabled={qty >= (item.maxQty ?? 10) || sectionCount >= section.maxSelect || mutexBlocked}
                                                                aria-label={t.increaseQty(isEn ? (item.nameEn || item.name) : item.name)}
                                                                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${(qty >= (item.maxQty ?? 10) || sectionCount >= section.maxSelect || mutexBlocked) ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-[#2D5F3E] text-[#2D5F3E] hover:bg-[#2D5F3E] hover:text-white active:scale-90'}`}
                                                            >
                                                                <Plus size={16} />
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
                    {/* 未选时段时按钮**不再灰掉**。原来是灰按钮 + 「请先选择送达时段 👆」，
                        而那个 👆 指向的时段区在移动端根本不在首屏 —— 客人看到的是一个
                        点不动的按钮和一句指着空白处的话。现在点它会滚过去并高亮。 */}
                    <button
                        onClick={selectedTime ? handleAddToCart : focusSlotPicker}
                        className={`w-full py-4 rounded-2xl font-extrabold text-base flex justify-center items-center gap-2.5 transition-all duration-200 shadow-lg ${selectedTime
                            ? 'bg-[#2D5F3E] hover:bg-[#244E33] active:scale-[0.98] text-white shadow-[#2D5F3E]/20'
                            : 'bg-[#C76F40] hover:bg-[#B05F33] active:scale-[0.98] text-white shadow-[#C76F40]/20'
                            }`}
                    >
                        {selectedTime ? <ShoppingBag size={20} /> : <Calendar size={20} />}
                        {selectedTime ? (initialConfig ? t.updateCart(grandTotal.toFixed(2)) : t.addToCart(grandTotal.toFixed(2))) : t.chooseSlotCta}
                    </button>
                </div>
            </div>
        </div>
    );
}
