"use client";

import React from 'react';
import Image from 'next/image';
import { Trash2 } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import { CART_DICT } from './dict';

interface CartItemCardProps {
    item: any;
    onRemove: (id: string) => void;
    onEdit?: (item: any) => void;
    animationDelay?: number;
    locale?: Locale;
}

export default function CartItemCard({ item, onRemove, onEdit, animationDelay = 0, locale = 'zh' }: CartItemCardProps) {
    const t = CART_DICT[locale].itemCard;
    const displayName = locale === 'en' ? (item.dish.nameEn || item.dish.name) : item.dish.name;
    return (
        // 2026-09-05：这里原来还盖着一个铺满整卡的隐形 <button aria-label="Edit Item">
        // （两个语言都是写死英文），和下面那个可见的「修改」按钮是**同一个动作的两个
        // 控件** —— 读屏会念两遍，手指点在卡片任何位置都会开编辑弹窗（想点删除、
        // 想选文字都会误触）。删掉隐形那层，只留可见按钮。
        <div
            className="bg-white rounded-[24px] p-4 border border-[#E3EADA]/80 shadow-sm flex flex-col animate-in slide-in-from-bottom duration-300 relative group"
            style={{ animationDelay: `${animationDelay}ms` }}
        >
            <div className="flex gap-4 items-center relative z-20">
                <div className="w-16 h-16 rounded-2xl bg-[#FDFBF7] flex items-center justify-center text-3xl overflow-hidden relative shrink-0 shadow-inner border border-[#E3EADA]/30">
                    {item.dish.image?.startsWith('/') ? (
                        // sizes 必填：容器固定 64px，不给的话 next/image 按最大宽取图。
                        <Image src={item.dish.image} alt={item.dish.name} fill sizes="64px" className="object-cover" />
                    ) : item.dish.image}
                </div>
                <div className="flex-1 min-w-0 pr-8">
                    <div className="flex flex-col">
                        <h4 className="font-bold text-[#1A2D23] text-[15px] leading-snug truncate">
                            {displayName}
                            {item.dishQty > 1 && (
                                <span className="ml-2 text-[10px] bg-[#FF6B35]/10 text-[#FF6B35] px-1.5 py-0.5 rounded-md font-medium inline-block relative -top-0.5">
                                    x{item.dishQty}
                                </span>
                            )}
                        </h4>
                        {(item.addOns?.length > 0 || item.note) && (
                            <p className="text-[11px] text-gray-400 font-medium mt-0.5 flex flex-wrap gap-x-2">
                                {item.addOns?.length > 0 && <span>{t.addOnsList(
                                    item.addOns
                                        .filter((a: any) => a.quantity > 0)
                                        .map((a: any) => `${locale === 'en' ? (a.item?.nameEn || a.item?.name) : a.item?.name} ×${a.quantity}`)
                                        .join(locale === 'en' ? ', ' : '、')
                                )}</span>}
                                {item.note && <span>{t.noteBadge}</span>}
                            </p>
                        )}
                    </div>
                    <p className="text-[#FF6B35] font-black text-lg mt-1 relative z-20 w-fit">
                        RM {(item.price * item.quantity).toFixed(2)}
                    </p>
                </div>
                <button onClick={() => onRemove(item.cartItemId)}
                    aria-label={t.removeItem(displayName)}
                    className="w-9 h-9 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors absolute -top-1 -right-1 z-20">
                    <Trash2 size={16} />
                </button>
            </div>

            {onEdit && (
                <div className="mt-2.5 flex justify-end px-1 relative z-20">
                    <button onClick={() => onEdit(item)}
                        className="min-h-[36px] px-3.5 bg-gray-50 text-gray-500 text-[12px] font-bold rounded-lg hover:bg-gray-100 hover:text-gray-700 transition-all border border-gray-100">
                        {t.edit}
                    </button>
                </div>
            )}
        </div>
    );
}
