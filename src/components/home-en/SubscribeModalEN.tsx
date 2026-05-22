"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { X, Gift } from 'lucide-react';

const STORAGE_KEY = 'incredibowl_subscribe_modal_seen';
const COOLDOWN_DAYS = 7;
// Minimum time on page before exit-intent can fire (so we don't ambush
// instant-bouncers who hate popups anyway).
const MIN_DWELL_MS = 8_000;

const WHATSAPP_NUMBER = '60165119118';
// Trailing 🍱 is a silent source tag — Carmen can tell at-a-glance this came from the modal.
const PREFILLED = "Hi BowlMama! I'd like to claim the RM 5 first-order voucher — please ping me when you have new promos or new dishes. Thanks! 🍱";

export default function SubscribeModalEN() {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const seen = localStorage.getItem(STORAGE_KEY);
        if (seen) {
            const seenTime = parseInt(seen, 10);
            if (!Number.isNaN(seenTime) && Date.now() - seenTime < COOLDOWN_DAYS * 86_400_000) {
                return;
            }
        }

        const mountedAt = Date.now();
        let lastScrollY = window.scrollY;
        let lastScrollAt = mountedAt;
        const isCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;

        const fire = () => {
            if (Date.now() - mountedAt < MIN_DWELL_MS) return;
            setOpen(true);
            cleanup();
        };

        const onMouseOut = (e: MouseEvent) => {
            if (e.clientY <= 0 && !e.relatedTarget) fire();
        };

        const onScroll = () => {
            const now = Date.now();
            const dy = window.scrollY - lastScrollY;
            const dt = now - lastScrollAt;
            const isFastUpward = dy < -60 && dt < 250;
            const nearTop = window.scrollY < window.innerHeight * 1.5;
            if (isFastUpward && nearTop) fire();
            lastScrollY = window.scrollY;
            lastScrollAt = now;
        };

        const onVisibility = () => {
            if (document.visibilityState === 'hidden') fire();
        };

        const cleanup = () => {
            document.removeEventListener('mouseout', onMouseOut);
            window.removeEventListener('scroll', onScroll);
            document.removeEventListener('visibilitychange', onVisibility);
        };

        if (!isCoarsePointer) document.addEventListener('mouseout', onMouseOut);
        window.addEventListener('scroll', onScroll, { passive: true });
        document.addEventListener('visibilitychange', onVisibility);

        return cleanup;
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
            aria-labelledby="subscribe-modal-title-en"
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center px-3 pb-3 sm:px-4 sm:pb-0"
        >
            <div
                className="absolute inset-0 bg-black/55 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={dismiss}
                aria-hidden="true"
            />

            <div className="relative w-full max-w-sm bg-[#FDFBF7] rounded-[28px] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 zoom-in-95 duration-300">
                <button
                    type="button"
                    onClick={dismiss}
                    aria-label="Close"
                    className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-sm border border-gray-100 transition-colors"
                >
                    <X size={18} className="text-[#1A2D23]/70" strokeWidth={2.5} />
                </button>

                <div className="relative h-44 w-full bg-[#FFF3E0]">
                    <Image
                        src="/pork_potato_stew.webp"
                        alt="BowlMama's daily home-cooked dish"
                        fill
                        sizes="384px"
                        className="object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent" />
                    <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FF6B35] text-white text-xs font-black shadow-lg">
                        <Gift size={13} strokeWidth={2.5} />
                        <span>RM 5 off your first order</span>
                    </div>
                </div>

                <div className="p-6">
                    <h3
                        id="subscribe-modal-title-en"
                        className="text-xl font-black text-[#1A2D23] leading-tight mb-2"
                    >
                        Don&apos;t miss BowlMama&apos;s next promo.
                    </h3>
                    <p className="text-sm text-[#1A2D23]/70 leading-relaxed mb-5">
                        We&apos;ll ping you when new dishes drop or there&apos;s a promo. New subscribers get
                        <span className="font-black text-[#FF6B35]"> RM 5 off </span>
                        their first order. Pearl Point / OUG / Citizen 1 & 2 neighbours are already in.
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
                        <span>Add WhatsApp · Claim RM 5</span>
                    </a>

                    <button
                        type="button"
                        onClick={dismiss}
                        className="block mx-auto mt-3 text-xs text-[#1A2D23]/50 hover:text-[#1A2D23]/80 transition-colors"
                    >
                        Maybe later
                    </button>
                </div>
            </div>
        </div>
    );
}
