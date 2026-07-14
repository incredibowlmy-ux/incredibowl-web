"use client";

import React from 'react';
import { CheckCircle } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import { CART_DICT } from './dict';

interface CartSuccessProps {
    // Snapshot taken at submit time — the live cart is cleared the moment
    // the order succeeds, so this screen must not read from it.
    orderSuccess: { id: string; items: any[]; total: number; trackInfo?: { token: string; date: string; time: string }[] };
    userProfile: any;
    onDone: () => void;
    locale?: Locale;
}

const WHATSAPP_NUMBER = '60165119118';

// Pixel tracking moved to CartDrawer where we have access to the
// CAPI event IDs returned by /api/submit-order and /api/confirm-order
// — needed to deduplicate browser events against the server-side
// Conversions API events fired from those routes.
export default function CartSuccess({ orderSuccess, userProfile, onDone, locale = 'zh' }: CartSuccessProps) {
    const t = CART_DICT[locale].success;
    const { id, items, total, trackInfo } = orderSuccess;
    const isGroup = id.startsWith('GRP');
    const displayId = isGroup ? id : id.slice(-6).toUpperCase();
    // 渲染层菜名：EN 显示 nameEn 兜底 name；订单 payload 早已提交，不受影响。
    const dishName = (item: any) => (locale === 'en'
        ? (item.dish?.nameEn || item.dish?.name || '')
        : (item.dish?.name || ''));

    // Tracking links (one per delivery) — absolute URLs so they survive
    // inside the customer's own WhatsApp chat as their receipt.
    const multiTrack = (trackInfo || []).length > 1;
    // EN 客户拿到的 track 链接带 ?lang=en，打开即英文（页内切换仍可换回）
    const trackQuery = locale === 'en' ? '?lang=en' : '';
    const trackLines = (trackInfo || []).map(tr =>
        t.waTrack(multiTrack, tr.date, t.mealWord(tr.time), `https://www.incredibowl.my/track/${tr.token}${trackQuery}`));

    const waText = [
        t.waIntro,
        t.waOrderNo(isGroup, displayId),
        ...items.map((item: any) =>
            t.waItem(dishName(item), (item.dishQty || 1) * (item.quantity || 1), item.selectedDate || t.dateTbdWa, t.mealWord(item.selectedTime))),
        `💰 RM ${total.toFixed(2)}`,
        ...trackLines,
    ].join('\n');
    const waHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waText)}`;

    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-[#1A2D23]/60 backdrop-blur-sm" />
            <div className="relative w-full max-w-md bg-[#FDFBF7] h-full shadow-2xl flex flex-col items-center justify-center border-l border-[#E3EADA] overflow-y-auto">
                <div className="text-center space-y-5 p-8 animate-in zoom-in-95 duration-500 w-full">
                    <div className="w-24 h-24 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle size={48} className="text-green-500" />
                    </div>
                    <h2 className="text-3xl font-black text-[#1A2D23]">{t.title}</h2>
                    <p className="text-gray-500 flex flex-col items-center gap-1">
                        <span>
                            {t.orderIdLabel(isGroup)}
                            <span className="font-bold text-[#FF6B35]">#{displayId}</span>
                        </span>
                        {isGroup && (
                            <span className="text-[10px] font-bold text-[#FF6B35]/70 bg-[#FF6B35]/10 px-2 py-0.5 rounded-full mt-1">
                                {t.groupSplitNote}
                            </span>
                        )}
                    </p>
                    <div className="bg-white rounded-2xl p-5 border border-[#E3EADA] text-left space-y-2">
                        <p className="text-sm">
                            <span className="font-bold">{t.deliveryPlan}</span>
                            <span className="text-[#FF6B35] font-black">
                                {isGroup
                                    ? t.multiDay
                                    : `${items[0]?.selectedDate || t.dateTbd} ${items[0]?.selectedTime?.includes('Lunch') ? t.lunchEmoji : t.dinnerEmoji}`}
                            </span>
                        </p>
                        <p className="text-sm"><span className="font-bold">{t.addressLabel}</span>{userProfile?.address}</p>
                        <p className="text-sm"><span className="font-bold">{t.amountLabel}</span><span className="text-[#FF6B35] font-black">RM {total.toFixed(2)}</span></p>
                    </div>
                    <p className="text-sm font-bold text-[#FF6B35] animate-pulse">{t.verifying}</p>
                    <p className="text-xs text-gray-400">{t.verifiedNote}</p>

                    {/* WhatsApp confirmation deep link — puts a copy of the order
                        in the customer's own chat (their receipt) and opens the
                        private-domain channel in one tap. Message is prefilled;
                        they only press send. */}
                    <a
                        href={waHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full py-3.5 bg-[#25D366] text-white rounded-2xl text-sm font-black hover:bg-[#1EBE57] transition-colors shadow-lg shadow-[#25D366]/25"
                    >
                        {t.waButton}
                    </a>
                    {(trackInfo || []).length > 0 && (
                        <div className="space-y-2">
                            {(trackInfo || []).map((tr) => (
                                <a
                                    key={tr.token}
                                    href={`/track/${tr.token}${trackQuery}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block w-full py-3 bg-white border-2 border-[#FF6B35] text-[#FF6B35] rounded-2xl text-sm font-black hover:bg-[#FF6B35]/5 transition-colors"
                                >
                                    {t.trackBtn(multiTrack, tr.date, t.mealWord(tr.time))}
                                </a>
                            ))}
                        </div>
                    )}
                    <button
                        onClick={onDone}
                        className="w-full py-2.5 text-sm font-bold text-gray-400 hover:text-[#1A2D23] transition-colors"
                    >
                        {t.done}
                    </button>
                </div>
            </div>
        </div>
    );
}
