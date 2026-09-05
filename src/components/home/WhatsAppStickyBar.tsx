"use client";

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { claimFirstOrderPromo, FIRST_ORDER_PROMO_CODE, FIRST_ORDER_PROMO_RM } from '@/lib/firstOrderPromo';

const STORAGE_KEY = 'incredibowl_sticky_bar_dismissed';
const COOLDOWN_HOURS = 24;

const WHATSAPP_NUMBER = '60165119118';
// Trailing 🥡 is a silent source tag — Carmen can tell at-a-glance this came from the sticky bar.
const PREFILLED = 'Hi 碗妈！我从网站加入，想拿首单 RM 5 voucher，之后有新 Promo 可以通知我 🙏 🥡';

export default function WhatsAppStickyBar() {
    const [show, setShow] = useState(false);
    const [claimed, setClaimed] = useState(false);

    useEffect(() => {
        const dismissed = localStorage.getItem(STORAGE_KEY);
        if (dismissed) {
            const t = parseInt(dismissed, 10);
            if (!Number.isNaN(t) && Date.now() - t < COOLDOWN_HOURS * 3_600_000) {
                return;
            }
        }
        // Surface the bar only once the visitor has reached the menu (engaged
        // intent) — on BOTH breakpoints now.
        //
        // Mobile used to fire on a 1.5s timer, so 1.5 seconds after landing the
        // customer had three WhatsApp affordances on screen at once (top
        // marquee, floating bubble, this bar) plus a bar covering the bottom of
        // the fold. Desktop already used the scroll rule; this aligns them.
        //
        // Anchored on #menu rather than a pixel threshold because the
        // above-the-fold stack is a very different height per breakpoint.
        const target = document.getElementById('menu');
        if (target && 'IntersectionObserver' in window) {
            const obs = new IntersectionObserver(([entry]) => {
                if (!entry.isIntersecting) return;
                setShow(true);
                obs.disconnect();
            }, { rootMargin: '0px 0px -25% 0px' });
            obs.observe(target);
            return () => obs.disconnect();
        }
        // Fallback (no #menu on the page yet / no IO): a plain scroll depth.
        const onScroll = () => {
            if (window.scrollY > 1200) {
                setShow(true);
                window.removeEventListener('scroll', onScroll);
            }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Tell WhatsAppFloat to hide while the sticky bar is on screen — two
    // green WhatsApp affordances at the same time was muddy. CSS var stays
    // for any legacy callers still reading it; the event drives the float.
    useEffect(() => {
        if (!show) return;
        const root = document.documentElement;
        root.style.setProperty('--sticky-bar-h', '88px');
        window.dispatchEvent(new Event('wa-sticky-show'));
        return () => {
            root.style.removeProperty('--sticky-bar-h');
            window.dispatchEvent(new Event('wa-sticky-hide'));
        };
    }, [show]);

    const dismiss = () => {
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
        setShow(false);
    };

    // 站内领码：写进 localStorage，购物车打开时自动填入并（已登录则）自动套用。
    const claim = () => {
        claimFirstOrderPromo();
        setClaimed(true);
    };

    const goOrder = () => {
        dismiss();
        document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' });
    };

    if (!show) return null;

    const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(PREFILLED)}`;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[70] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-4 md:pb-[calc(1rem+env(safe-area-inset-bottom))] pointer-events-none animate-in slide-in-from-bottom-4 fade-in duration-300 lg:left-auto lg:right-6 lg:bottom-6 lg:px-0 lg:pb-0 lg:w-[380px]">
            <div className="pointer-events-auto max-w-md mx-auto lg:mx-0 lg:max-w-none bg-[#1A2D23] text-white rounded-2xl shadow-2xl shadow-black/40 backdrop-blur flex items-center gap-2.5 pl-3 pr-2 py-2 ring-1 ring-white/5">
                {/* WhatsApp 降为次选：只剩这个绿色圆钮。主行动是站内领码。 */}
                <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 shrink-0 rounded-full bg-[#25D366] flex items-center justify-center shadow-inner active:scale-95 transition-transform"
                    aria-label="WhatsApp 碗妈 · 收新菜通知"
                >
                    <svg viewBox="0 0 32 32" className="w-4.5 h-4.5 fill-white" aria-hidden="true">
                        <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.638 3.41 4.673 4.34.616.287 2.035.888 2.722.888.817 0 2.15-.515 2.49-1.318.158-.386.216-.815.216-1.231 0-.817-.27-.99-.974-1.318-.388-.198-1.005-.43-1.477-.687zM16.205 28.997c-2.262 0-4.49-.617-6.418-1.792l-.46-.273-4.762 1.247 1.273-4.633-.302-.476a12.652 12.652 0 0 1-1.946-6.747c0-7 5.674-12.673 12.673-12.673 3.387 0 6.57 1.32 8.96 3.71a12.595 12.595 0 0 1 3.7 8.97c0 7.001-5.778 12.667-12.776 12.667zm10.79-23.461A14.864 14.864 0 0 0 16.207 1.205C7.965 1.205 1.252 7.918 1.236 16.16c0 2.64.69 5.215 2 7.49l-2.131 7.79 7.97-2.09a15.122 15.122 0 0 0 7.122 1.817h.014c8.244 0 15.07-6.713 15.07-14.957 0-3.998-1.65-7.752-4.487-10.575z" />
                    </svg>
                </a>
                <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold leading-tight truncate">
                        {claimed ? '优惠码已领取' : <>首单立减 <span className="font-black text-[#FF9B50]">RM {FIRST_ORDER_PROMO_RM}</span></>}
                    </span>
                    <span className="block text-[11px] text-white/60 leading-tight truncate">
                        {claimed ? `${FIRST_ORDER_PROMO_CODE} · 结账自动帮你用上` : '点一下就领，结账自动套用'}
                    </span>
                </span>
                {claimed ? (
                    <button
                        type="button"
                        onClick={goOrder}
                        className="shrink-0 px-3.5 py-2 bg-[#FF6B35] hover:bg-[#E95D31] text-white rounded-full text-[12px] font-black shadow-md shadow-[#FF6B35]/30 active:scale-95 transition-[transform,background-color] duration-150"
                    >
                        去点菜
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={claim}
                        className="shrink-0 px-3.5 py-2 bg-[#FF6B35] hover:bg-[#E95D31] text-white rounded-full text-[12px] font-black shadow-md shadow-[#FF6B35]/30 active:scale-95 transition-[transform,background-color] duration-150"
                    >
                        领取
                    </button>
                )}
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
