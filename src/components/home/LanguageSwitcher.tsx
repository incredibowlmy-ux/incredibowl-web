"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Globe, Check } from 'lucide-react';

interface LanguageSwitcherProps {
    current: 'zh' | 'en';
}

// Pages that exist in BOTH /zh and /en variants. Toggle preserves the
// current page for these; for any other path (admin, blog, terms, refund,
// privacy, meal-vouchers) the switcher falls back to the locale homepage so
// we don't ship users into a 404.
const BILINGUAL_ROUTES = new Set(['', '/order', '/member', '/meal-vouchers']);

function computeTargets(pathname: string | null): { zhHref: string; enHref: string } {
    // Strip /en prefix to get the "shared" path; '' === root.
    const shared = pathname?.startsWith('/en')
        ? pathname.replace(/^\/en/, '')
        : pathname || '';
    const isMirrored = BILINGUAL_ROUTES.has(shared);
    return {
        zhHref: isMirrored ? (shared || '/') : '/',
        enHref: isMirrored ? `/en${shared}` : '/en',
    };
}

/**
 * Language switcher — globe icon button + dropdown with checkmark on the
 * current language. Click outside to dismiss; Escape key also closes.
 * Lives in the main NavBar right-side cluster (not the announcement bar).
 */
export default function LanguageSwitcher({ current }: LanguageSwitcherProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const pathname = usePathname();
    const { zhHref, enHref } = computeTargets(pathname);

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                aria-label={current === 'zh' ? '切换语言 / Switch language' : 'Switch language / 切换语言'}
                aria-expanded={open}
                aria-haspopup="menu"
                className="p-3 md:p-3 bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-100 hover:border-[#1A2D23]/20 transition-[border-color,box-shadow,background-color] duration-150 ease-out"
            >
                <Globe className="w-5 h-5 md:w-[22px] md:h-[22px] text-[#1A2D23]/75" strokeWidth={2} />
            </button>
            {open && (
                <div
                    role="menu"
                    aria-label="Language options"
                    className="absolute right-0 top-full mt-2 min-w-[160px] bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150"
                >
                    <Link
                        href={zhHref}
                        role="menuitem"
                        onClick={() => setOpen(false)}
                        className={`flex items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-[#1A2D23] hover:bg-[#FDFBF7] transition-colors ${current === 'zh' ? 'bg-[#FFF3E0]/40' : ''}`}
                    >
                        <span>中文</span>
                        {current === 'zh' && <Check size={14} className="text-[#FF6B35]" strokeWidth={3} aria-label="current" />}
                    </Link>
                    <Link
                        href={enHref}
                        role="menuitem"
                        onClick={() => setOpen(false)}
                        className={`flex items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-[#1A2D23] hover:bg-[#FDFBF7] transition-colors border-t border-gray-100 ${current === 'en' ? 'bg-[#FFF3E0]/40' : ''}`}
                    >
                        <span>English</span>
                        {current === 'en' && <Check size={14} className="text-[#FF6B35]" strokeWidth={3} aria-label="current" />}
                    </Link>
                </div>
            )}
        </div>
    );
}
