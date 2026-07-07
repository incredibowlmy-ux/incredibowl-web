"use client";

import React from 'react';
import { CheckCircle } from 'lucide-react';

interface CartSuccessProps {
    // Snapshot taken at submit time — the live cart is cleared the moment
    // the order succeeds, so this screen must not read from it.
    orderSuccess: { id: string; items: any[]; total: number; trackInfo?: { token: string; date: string; time: string }[] };
    userProfile: any;
    onDone: () => void;
}

const WHATSAPP_NUMBER = '60165119118';

// Pixel tracking moved to CartDrawer where we have access to the
// CAPI event IDs returned by /api/submit-order and /api/confirm-order
// — needed to deduplicate browser events against the server-side
// Conversions API events fired from those routes.
export default function CartSuccess({ orderSuccess, userProfile, onDone }: CartSuccessProps) {
    const { id, items, total, trackInfo } = orderSuccess;
    const isGroup = id.startsWith('GRP');
    const displayId = isGroup ? id : id.slice(-6).toUpperCase();

    // Tracking links (one per delivery) — absolute URLs so they survive
    // inside the customer's own WhatsApp chat as their receipt.
    const trackLines = (trackInfo || []).map(t =>
        `📍 跟踪订单${(trackInfo || []).length > 1 ? `（${t.date} ${t.time?.includes('Lunch') ? '午餐' : '晚餐'}）` : ''}：https://www.incredibowl.my/track/${t.token}`);

    const waText = [
        '你好碗妈 👋 我刚在网站下单了，想在 WhatsApp 接收订单确认：',
        `📌 ${isGroup ? '订单群组编号' : '订单编号'}：#${displayId}`,
        ...items.map((item: any) =>
            `🍛 ${item.dish?.name || ''} ×${(item.dishQty || 1) * (item.quantity || 1)}（${item.selectedDate || '日期未定'} ${item.selectedTime?.includes('Lunch') ? '午餐' : '晚餐'}）`),
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
                    <h2 className="text-3xl font-black text-[#1A2D23]">订单已提交！🍛</h2>
                    <p className="text-gray-500 flex flex-col items-center gap-1">
                        <span>
                            {isGroup ? '订单群组编号：' : '订单编号：'}
                            <span className="font-bold text-[#FF6B35]">#{displayId}</span>
                        </span>
                        {isGroup && (
                            <span className="text-[10px] font-bold text-[#FF6B35]/70 bg-[#FF6B35]/10 px-2 py-0.5 rounded-full mt-1">
                                你的订单已按送达日期自动拆分方便碗妈备餐
                            </span>
                        )}
                    </p>
                    <div className="bg-white rounded-2xl p-5 border border-[#E3EADA] text-left space-y-2">
                        <p className="text-sm">
                            <span className="font-bold">📅 配送安排：</span>
                            <span className="text-[#FF6B35] font-black">
                                {isGroup
                                    ? '多日配送 (已各自独立建单)'
                                    : `${items[0]?.selectedDate || '未定'} ${items[0]?.selectedTime?.includes('Lunch') ? '🌞午餐' : '🌙晚餐'}`}
                            </span>
                        </p>
                        <p className="text-sm"><span className="font-bold">📍 地址：</span>{userProfile?.address}</p>
                        <p className="text-sm"><span className="font-bold">💰 金额：</span><span className="text-[#FF6B35] font-black">RM {total.toFixed(2)}</span></p>
                    </div>
                    <p className="text-sm font-bold text-[#FF6B35] animate-pulse">碗妈正在核对付款截图，请耐心等候 💬</p>
                    <p className="text-xs text-gray-400">核对成功后，碗妈会确认你的订单 ✅</p>

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
                        📲 WhatsApp 接收订单确认
                    </a>
                    {(trackInfo || []).length > 0 && (
                        <div className="space-y-2">
                            {(trackInfo || []).map((t) => (
                                <a
                                    key={t.token}
                                    href={`/track/${t.token}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block w-full py-3 bg-white border-2 border-[#FF6B35] text-[#FF6B35] rounded-2xl text-sm font-black hover:bg-[#FF6B35]/5 transition-colors"
                                >
                                    📍 跟踪订单{(trackInfo || []).length > 1 ? `（${t.date} ${t.time?.includes('Lunch') ? '午餐' : '晚餐'}）` : ''}
                                </a>
                            ))}
                        </div>
                    )}
                    <button
                        onClick={onDone}
                        className="w-full py-2.5 text-sm font-bold text-gray-400 hover:text-[#1A2D23] transition-colors"
                    >
                        完成，返回首页
                    </button>
                </div>
            </div>
        </div>
    );
}
