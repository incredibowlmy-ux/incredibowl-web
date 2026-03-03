"use client";

import React from 'react';
import Image from 'next/image';
import { Trash2 } from 'lucide-react';

interface CartItemCardProps {
    item: any;
    onRemove: (id: string) => void;
    onEdit?: (item: any) => void;
    animationDelay?: number;
}

export default function CartItemCard({ item, onRemove, onEdit, animationDelay = 0 }: CartItemCardProps) {
    return (
        <div
            className="bg-white rounded-[24px] p-4 border border-[#E3EADA]/80 shadow-sm flex flex-col animate-in slide-in-from-bottom duration-300 relative group"
            style={{ animationDelay: `${animationDelay}ms` }}
        >
            {onEdit && (
                <button onClick={() => onEdit(item)}
                    className="absolute inset-0 w-full h-full z-0 rounded-[24px] hover:bg-[#1A2D23]/[0.02] transition-colors"
                    aria-label="Edit Item" />
            )}

            <div className="flex gap-4 items-center relative z-20">
                <div className="w-16 h-16 rounded-2xl bg-[#FDFBF7] flex items-center justify-center text-3xl overflow-hidden relative shrink-0 shadow-inner border border-[#E3EADA]/30">
                    {item.dish.image?.startsWith('/') ? (
                        <Image src={item.dish.image} alt={item.dish.name} fill className="object-cover" />
                    ) : item.dish.image}
                </div>
                <div className="flex-1 min-w-0 pr-8">
                    <div className="flex flex-col">
                        <h4 className="font-bold text-[#1A2D23] text-[15px] leading-snug truncate">
                            {item.dish.name}
                            {item.dishQty > 1 && (
                                <span className="ml-2 text-[10px] bg-[#FF6B35]/10 text-[#FF6B35] px-1.5 py-0.5 rounded-md font-black inline-block relative -top-0.5">
                                    x{item.dishQty}
                                </span>
                            )}
                        </h4>
                        {(item.addOns?.length > 0 || item.note) && (
                            <p className="text-[11px] text-gray-400 font-medium mt-0.5 flex flex-wrap gap-x-2">
                                {item.addOns?.length > 0 && <span>加购 {item.addOns.reduce((sum: number, a: any) => sum + a.quantity, 0)} 项</span>}
                                {item.note && <span>📝 备注</span>}
                            </p>
                        )}
                    </div>
                    <p className="text-[#FF6B35] font-black text-lg mt-1 relative z-20 w-fit">
                        RM {(item.price * item.quantity).toFixed(2)}
                    </p>
                </div>
                <button onClick={() => onRemove(item.cartItemId)}
                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors absolute top-0 right-0 z-20">
                    <Trash2 size={16} />
                </button>
            </div>

            {onEdit && (
                <div className="mt-2.5 flex justify-end px-1 relative z-20">
                    <button onClick={() => onEdit(item)}
                        className="px-3 py-1 bg-gray-50 text-gray-400 text-[11px] font-bold rounded-lg hover:bg-gray-100 hover:text-gray-600 transition-all border border-gray-100">
                        Edit
                    </button>
                </div>
            )}
        </div>
    );
}
