"use client";

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const STORAGE_KEY = 'incredibowl_sticky_bar_dismissed';
const COOLDOWN_HOURS = 24;
const SHOW_DELAY_MS = 1500;

const WHATSAPP_NUMBER = '60165119118';
const PREFILLED = 'Hi 碗妈！我从网站加入，想拿首单 RM 5 voucher，之后有新 Promo 可以通知我 🙏';

export default function WhatsAppStickyBar() {
    const [show, setShow] = useState(false);

    useEffect(() => {
        const dismissed = localStorage.getItem(STORAGE_KEY);
        if (dismissed) {
            const t = parseInt(dismissed, 10);
            if (!Number.isNaN(t) && Date.now() - t < COOLDOWN_HOURS * 3_600_000) {
                return;
            }
        }
        const timer = setTimeout(() => setShow(true), SHOW_DELAY_MS);
        return () => clearTimeout(timer);
    }, []);

    // Push WhatsAppFloat upward while sticky bar is mounted, so they don't collide.
    useEffect(() => {
        if (!show) return;
        const root = document.documentElement;
        root.style.setProperty('--sticky-bar-h', '88px');
        return () => {
            root.style.removeProperty('--sticky-bar-h');
        };
    }, [show]);

    const dismiss = () => {
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
        setShow(false);
    };

    if (!show) return null;

    const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(PREFILLED)}`;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[70] px-3 pb-3 md:px-4 md:pb-4 pointer-events-none animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="pointer-events-auto max-w-md mx-auto bg-[#1A2D23] text-white rounded-2xl shadow-2xl shadow-black/40 backdrop-blur flex items-center gap-2.5 pl-3 pr-2 py-2 ring-1 ring-white/5">
                <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={dismiss}
                    className="flex items-center gap-2.5 flex-1 min-w-0 group"
                    aria-label="加 WhatsApp 看明日菜单 · 首单立减 RM 5"
                >
                    <span className="w-9 h-9 shrink-0 rounded-full bg-[#25D366] flex items-center justify-center shadow-inner">
                        <svg viewBox="0 0 32 32" className="w-4.5 h-4.5 fill-white" aria-hidden="true">
                            <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.638 3.41 4.673 4.34.616.287 2.035.888 2.722.888.817 0 2.15-.515 2.49-1.318.158-.386.216-.815.216-1.231 0-.817-.27-.99-.974-1.318-.388-.198-1.005-.43-1.477-.687zM16.205 28.997c-2.262 0-4.49-.617-6.418-1.792l-.46-.273-4.762 1.247 1.273-4.633-.302-.476a12.652 12.652 0 0 1-1.946-6.747c0-7 5.674-12.673 12.673-12.673 3.387 0 6.57 1.32 8.96 3.71a12.595 12.595 0 0 1 3.7 8.97c0 7.001-5.778 12.667-12.776 12.667zm10.79-23.461A14.864 14.864 0 0 0 16.207 1.205C7.965 1.205 1.252 7.918 1.236 16.16c0 2.64.69 5.215 2 7.49l-2.131 7.79 7.97-2.09a15.122 15.122 0 0 0 7.122 1.817h.014c8.244 0 15.07-6.713 15.07-14.957 0-3.998-1.65-7.752-4.487-10.575z" />
                        </svg>
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-black leading-tight truncate">加 WhatsApp 不错过 promo</span>
                        <span className="block text-[11px] text-white/60 leading-tight truncate">首单立减 <span className="font-black text-[#FF9B50]">RM 5</span> · 新菜抢先知</span>
                    </span>
                </a>
                <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={dismiss}
                    className="shrink-0 px-3.5 py-2 bg-[#FF6B35] hover:bg-[#E95D31] text-white rounded-full text-[12px] font-black shadow-md shadow-[#FF6B35]/30 active:scale-95 transition-[transform,background-color] duration-150"
                >
                    加入
                </a>
                <button
                    type="button"
                    onClick={dismiss}
                    aria-label="关闭"
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                >
                    <X size={14} className="text-white/55" strokeWidth={2.5} />
                </button>
            </div>
        </div>
    );
}
