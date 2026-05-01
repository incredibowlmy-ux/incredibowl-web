"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';

const STORAGE_KEY = 'incredibowl_subscribe_modal_seen';
const COOLDOWN_DAYS = 7;
const SCROLL_TRIGGER = 0.6;

const WHATSAPP_NUMBER = '60165119118';
// Trailing 🍱 is a silent source tag — Carmen can tell at-a-glance this came from the modal.
const PREFILLED = 'Hi 碗妈！我从网站加入，想拿首单 RM 5 voucher，之后有新 Promo 可以通知我 🙏 🍱';

export default function SubscribeModal() {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const seen = localStorage.getItem(STORAGE_KEY);
        if (seen) {
            const seenTime = parseInt(seen, 10);
            if (!Number.isNaN(seenTime) && Date.now() - seenTime < COOLDOWN_DAYS * 86_400_000) {
                return;
            }
        }

        const onScroll = () => {
            const scrollable = document.documentElement.scrollHeight - window.innerHeight;
            if (scrollable <= 0) return;
            const fraction = window.scrollY / scrollable;
            if (fraction >= SCROLL_TRIGGER) {
                setOpen(true);
                window.removeEventListener('scroll', onScroll);
            }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        if (!open) return;
        const original = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') dismiss();
        };
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = original;
            window.removeEventListener('keydown', onKey);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const dismiss = () => {
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
        setOpen(false);
    };

    if (!open) return null;

    const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(PREFILLED)}`;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="subscribe-modal-title"
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center px-3 pb-3 sm:px-4 sm:pb-0"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/55 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={dismiss}
                aria-hidden="true"
            />

            {/* Card */}
            <div className="relative w-full max-w-sm bg-[#FDFBF7] rounded-[28px] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 zoom-in-95 duration-300">
                <button
                    type="button"
                    onClick={dismiss}
                    aria-label="关闭"
                    className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-sm border border-gray-100 transition-colors"
                >
                    <X size={18} className="text-[#1A2D23]/70" strokeWidth={2.5} />
                </button>

                {/* Hero photo */}
                <div className="relative h-44 w-full bg-[#FFF3E0]">
                    <Image
                        src="/pork_potato_stew.webp"
                        alt="碗妈每天新鲜手作"
                        fill
                        sizes="384px"
                        className="object-cover"
                    />
                    {/* Soft fade for legibility */}
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent" />
                    {/* Voucher badge */}
                    <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FF6B35] text-white text-xs font-black shadow-lg">
                        <span className="text-sm leading-none">🎁</span>
                        <span>首单立减 RM 5</span>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6">
                    <h3
                        id="subscribe-modal-title"
                        className="text-xl font-black text-[#1A2D23] leading-tight mb-2"
                    >
                        加入碗妈 WhatsApp · 不错过新菜和优惠
                    </h3>
                    <p className="text-sm text-[#1A2D23]/70 leading-relaxed mb-5">
                        新菜上架、限时 promo 第一时间通知。新加入立减
                        <span className="font-black text-[#FF6B35]"> RM 5</span>。Pearl Point / OUG / SkyVille 邻居都加了。
                    </p>

                    <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={dismiss}
                        className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#25D366] hover:bg-[#20BE5A] text-white rounded-full font-black text-base shadow-lg shadow-[#25D366]/35 active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out"
                    >
                        <svg viewBox="0 0 32 32" className="w-5 h-5 fill-white shrink-0" aria-hidden="true">
                            <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.638 3.41 4.673 4.34.616.287 2.035.888 2.722.888.817 0 2.15-.515 2.49-1.318.158-.386.216-.815.216-1.231 0-.817-.27-.99-.974-1.318-.388-.198-1.005-.43-1.477-.687zM16.205 28.997c-2.262 0-4.49-.617-6.418-1.792l-.46-.273-4.762 1.247 1.273-4.633-.302-.476a12.652 12.652 0 0 1-1.946-6.747c0-7 5.674-12.673 12.673-12.673 3.387 0 6.57 1.32 8.96 3.71a12.595 12.595 0 0 1 3.7 8.97c0 7.001-5.778 12.667-12.776 12.667zm10.79-23.461A14.864 14.864 0 0 0 16.207 1.205C7.965 1.205 1.252 7.918 1.236 16.16c0 2.64.69 5.215 2 7.49l-2.131 7.79 7.97-2.09a15.122 15.122 0 0 0 7.122 1.817h.014c8.244 0 15.07-6.713 15.07-14.957 0-3.998-1.65-7.752-4.487-10.575z" />
                        </svg>
                        <span>加 WhatsApp 拿 RM 5 voucher</span>
                    </a>

                    <button
                        type="button"
                        onClick={dismiss}
                        className="block mx-auto mt-3 text-xs text-[#1A2D23]/50 hover:text-[#1A2D23]/80 transition-colors"
                    >
                        下次再说
                    </button>
                </div>
            </div>
        </div>
    );
}
