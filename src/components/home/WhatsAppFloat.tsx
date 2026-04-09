"use client";

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const WHATSAPP_NUMBER = '60103370197';
const PREFILLED_MESSAGE = 'Hi BowlMama! 我想了解一下今天的菜单 / I want to ask about today\'s menu.';
const TOOLTIP_DISMISS_KEY = 'wa_tooltip_dismissed';

export default function WhatsAppFloat() {
    const [showTooltip, setShowTooltip] = useState(false);

    useEffect(() => {
        const dismissed = sessionStorage.getItem(TOOLTIP_DISMISS_KEY);
        if (dismissed) return;
        // Delay tooltip appearance to avoid clashing with hero load
        const timer = setTimeout(() => setShowTooltip(true), 4000);
        return () => clearTimeout(timer);
    }, []);

    const dismissTooltip = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setShowTooltip(false);
        sessionStorage.setItem(TOOLTIP_DISMISS_KEY, '1');
    };

    const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(PREFILLED_MESSAGE)}`;

    return (
        <div className="fixed bottom-5 right-5 md:bottom-7 md:right-7 z-[80] flex flex-col items-end gap-2">
            {/* Tooltip bubble */}
            {showTooltip && (
                <div className="relative bg-white rounded-2xl shadow-2xl border border-[#25D366]/20 px-4 py-3 max-w-[220px] animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <button
                        type="button"
                        onClick={dismissTooltip}
                        aria-label="关闭"
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-400 transition-colors shadow-sm"
                    >
                        <X size={11} strokeWidth={3} />
                    </button>
                    <p className="text-[13px] font-black text-[#1A2D23] leading-tight">
                        有问题？直接问碗妈
                    </p>
                    <p className="text-[11px] font-medium text-[#1A2D23]/55 italic mt-0.5 leading-tight">
                        Got a question? Chat with BowlMama
                    </p>
                    {/* Tail */}
                    <div className="absolute -bottom-1.5 right-7 w-3 h-3 bg-white border-r border-b border-[#25D366]/20 rotate-45" />
                </div>
            )}

            {/* Floating button */}
            <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp 碗妈"
                className="group relative flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#25D366] hover:bg-[#20BE5A] text-white shadow-2xl shadow-[#25D366]/40 hover:scale-110 active:scale-95 transition-all duration-300"
            >
                {/* Pulse ring */}
                <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-30" />
                {/* WhatsApp logo (inline SVG) */}
                <svg
                    viewBox="0 0 32 32"
                    className="relative w-7 h-7 md:w-8 md:h-8 fill-white"
                    aria-hidden="true"
                >
                    <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.638 3.41 4.673 4.34.616.287 2.035.888 2.722.888.817 0 2.15-.515 2.49-1.318.158-.386.216-.815.216-1.231 0-.817-.27-.99-.974-1.318-.388-.198-1.005-.43-1.477-.687zM16.205 28.997c-2.262 0-4.49-.617-6.418-1.792l-.46-.273-4.762 1.247 1.273-4.633-.302-.476a12.652 12.652 0 0 1-1.946-6.747c0-7 5.674-12.673 12.673-12.673 3.387 0 6.57 1.32 8.96 3.71a12.595 12.595 0 0 1 3.7 8.97c0 7.001-5.778 12.667-12.776 12.667zm10.79-23.461A14.864 14.864 0 0 0 16.207 1.205C7.965 1.205 1.252 7.918 1.236 16.16c0 2.64.69 5.215 2 7.49l-2.131 7.79 7.97-2.09a15.122 15.122 0 0 0 7.122 1.817h.014c8.244 0 15.07-6.713 15.07-14.957 0-3.998-1.65-7.752-4.487-10.575z"/>
                </svg>
            </a>
        </div>
    );
}
