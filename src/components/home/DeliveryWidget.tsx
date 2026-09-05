"use client";

import React, { useState } from 'react';
import { MapPin, Search, Loader2, Clock, Truck, AlertTriangle } from 'lucide-react';
import { DELIVERY_TIER_COPY } from '@/lib/deliveryCopy';
import type { Locale } from '@/lib/locale';
import { HOME_DICT } from './dict';

// 2026-07-29: 'outside' now means past the 25km ceiling (was 7.5km). Between
// 7.5 and 25km customers get the banded 'far' tier instead of a refusal.
type Tier = 'near' | 'mid' | 'far' | 'outside';

interface Result {
    tier: Tier;
    distanceKm: number;
    fee?: number;
    /** null on the far tier — flat fee, no threshold to spend toward. */
    feeAtThreshold?: number | null;
    threshold?: number | null;
    formattedAddress?: string;
}

// WhatsApp 预填文案（已 URL 编码）在 dict.ts 的 deliveryWidget.whatsAppUrl。

export default function DeliveryWidget({ locale = 'zh' }: { locale?: Locale }) {
    const t = HOME_DICT[locale].deliveryWidget;
    // 两个首页各自的 heading id（EN 历史上带 -en 后缀），aria-labelledby 跟着走。
    const headingId = locale === 'en' ? 'delivery-heading-en' : 'delivery-heading';
    const [address, setAddress] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<Result | null>(null);
    const [error, setError] = useState('');
    // 运费表在移动端默认收起：它有 4 行 + 一段远距离说明，原来整块挡在
    // Hero 和菜单之间。桌面（lg+）一直展开，与改动前一致。
    const [feesOpen, setFeesOpen] = useState(false);

    const check = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = address.trim();
        if (!trimmed) return;
        setLoading(true);
        setError('');
        setResult(null);
        try {
            const res = await fetch('/api/check-delivery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: trimmed }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || t.lookupFailed);
                return;
            }
            setResult(data);
        } catch {
            setError(t.networkError);
        } finally {
            setLoading(false);
        }
    };

    return (
        <section
            aria-labelledby={headingId}
            className="lg:col-span-12 mt-4"
        >
            {/* Mobile keeps the stacked strips; desktop (full-width row since the
                promo banner moved below the menu) splits into checker-left /
                info-right so neither side stretches into dead space. */}
            <div className="bg-white rounded-[32px] border border-[#FF6B35]/15 shadow-sm overflow-hidden lg:grid lg:grid-cols-12">
                {/* Hero strip: address checker — the headline action */}
                <div className="bg-gradient-to-br from-[#FFF8F0] via-[#FFF1E5] to-[#FFE6D0] px-6 md:px-10 py-6 md:py-8 lg:col-span-6 lg:flex lg:flex-col lg:justify-center">
                    <div className="flex items-center gap-2.5 mb-1.5">
                        <MapPin size={18} className="text-[#FF6B35] shrink-0" strokeWidth={2.5} />
                        <h2 id={headingId} className="text-[18px] md:text-[22px] lg:text-[28px] font-extrabold text-[#1A2D23] leading-tight">
                            {t.heading}
                        </h2>
                    </div>
                    <p className="text-[13px] md:text-[14px] text-[#1A2D23]/65 mb-4">
                        {t.sub}
                    </p>

                    <form onSubmit={check} className="flex flex-col sm:flex-row gap-2.5 max-w-xl">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                inputMode="text"
                                autoComplete="street-address"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder={t.placeholder}
                                aria-label={t.addressAria}
                                className="w-full px-4 py-3 pr-10 text-[14px] bg-white border border-[#FF6B35]/20 rounded-xl focus:outline-none focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/20 placeholder:text-gray-400 shadow-sm"
                            />
                            {address && !loading && (
                                <button
                                    type="button"
                                    onClick={() => { setAddress(''); setResult(null); setError(''); }}
                                    aria-label={t.clearAria}
                                    className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={loading || !address.trim()}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 btn-primary disabled:bg-gray-300 disabled:cursor-not-allowed text-[14px] transition-colors active:scale-[0.97] shadow-md shadow-[#FF6B35]/20"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" strokeWidth={2.5} />
                                    {t.checking}
                                </>
                            ) : (
                                <>
                                    <Search size={16} strokeWidth={2.75} />
                                    {t.check}
                                </>
                            )}
                        </button>
                    </form>

                    {/* Result */}
                    {error && (
                        <p className="mt-3 flex items-start gap-1.5 text-[13px] text-red-600 leading-relaxed">
                            <AlertTriangle size={14} className="mt-0.5 shrink-0" strokeWidth={2.5} />
                            <span>{error}</span>
                        </p>
                    )}

                    {result && result.tier === 'near' && (
                        <div className="mt-3 max-w-xl p-3 rounded-xl bg-[#FFF3E0] border border-[#FF6B35]/25">
                            <p className="text-[14px] font-extrabold text-[#C84518] flex items-center gap-1.5">
                                <Truck size={16} strokeWidth={2.5} />
                                {t.feeBefore}{result.fee}{t.feeMid}{result.distanceKm}{t.feeAfter}
                            </p>
                            <p className="text-[12px] text-[#C84518]/85 mt-1">
                                {t.nearBefore}<span className="font-bold">RM {result.threshold}{t.thresholdPlus}</span>{t.nearMid}<span className="font-bold">{t.nearFree}</span>
                            </p>
                            {result.formattedAddress && (
                                <p className="text-[11px] text-[#C84518]/60 mt-1 truncate">{result.formattedAddress}</p>
                            )}
                        </div>
                    )}

                    {result && result.tier === 'mid' && (
                        <div className="mt-3 max-w-xl p-3 rounded-xl bg-[#FFE4D6] border border-[#FF6B35]/40">
                            <p className="text-[14px] font-extrabold text-[#9A3412] flex items-center gap-1.5">
                                <Truck size={16} strokeWidth={2.5} />
                                {t.feeBefore}{result.fee}{t.feeMid}{result.distanceKm}{t.feeAfter}
                            </p>
                            <p className="text-[12px] text-[#9A3412]/85 mt-1">
                                {t.midBefore}<span className="font-bold">RM {result.threshold}{t.thresholdPlus}</span>{t.midMid}<span className="font-bold">RM {result.feeAtThreshold}</span>
                            </p>
                            {result.formattedAddress && (
                                <p className="text-[11px] text-[#9A3412]/60 mt-1 truncate">{result.formattedAddress}</p>
                            )}
                        </div>
                    )}

                    {/* Far (7.5km+): flat fee, no threshold — say so plainly rather
                        than showing a "spend RM X" nudge that will never pay off. */}
                    {result && result.tier === 'far' && (
                        <div className="mt-3 max-w-xl p-3 rounded-xl bg-[#FFE4D6] border border-[#FF6B35]/40">
                            <p className="text-[14px] font-extrabold text-[#9A3412] flex items-center gap-1.5">
                                <Truck size={16} strokeWidth={2.5} />
                                {t.feeBefore}{result.fee}{t.feeMid}{result.distanceKm}{t.feeAfter}
                            </p>
                            <p className="text-[12px] text-[#9A3412]/85 mt-1">
                                {t.farBefore}<span className="font-bold">Grab</span>{t.farMid}<span className="font-bold">RM {result.fee}</span>{t.farAfter}
                            </p>
                            {result.formattedAddress && (
                                <p className="text-[11px] text-[#9A3412]/60 mt-1 truncate">{result.formattedAddress}</p>
                            )}
                        </div>
                    )}

                    {/* Past the 25km ceiling — the only distance we still turn away. */}
                    {result && result.tier === 'outside' && (
                        <div className="mt-3 max-w-xl p-3 rounded-xl bg-gray-50 border border-gray-200">
                            <p className="text-[14px] font-extrabold text-gray-700">
                                {t.outsideBefore}{result.distanceKm}{t.outsideAfter}
                            </p>
                            <a
                                href={t.whatsAppUrl + encodeURIComponent(address)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 mt-2 text-[12px] font-bold text-green-700 hover:text-green-800"
                            >
                                {t.cateringCta}
                            </a>
                        </div>
                    )}
                </div>

                {/* Lower grid: tier table + cutoff/windows.
                    WhatsApp fallback CTA removed — the checker's outside-zone result
                    already surfaces a WhatsApp link, and the floating button +
                    sticky bar cover the rest. */}
                <div className="px-6 md:px-10 py-6 md:py-7 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 items-start lg:col-span-6 lg:border-l lg:border-[#FF6B35]/10 lg:content-center lg:gap-8">
                    {/* Tier table */}
                    <div>
                        <button
                            type="button"
                            onClick={() => setFeesOpen(v => !v)}
                            aria-expanded={feesOpen}
                            className="w-full min-h-[40px] flex items-center gap-2 text-left lg:min-h-0 lg:pointer-events-none"
                        >
                            <span className="text-[13px] font-extrabold text-[#1A2D23]">{t.feeTable}</span>
                            <span className="ml-auto text-[12px] font-bold text-[#FF6B35] lg:hidden">{feesOpen ? t.hideFees : t.showFees}</span>
                        </button>
                        <p className={`text-[11px] lg:text-[12px] text-[#1A2D23]/50 mt-0.5 mb-2.5 ${feesOpen ? '' : 'hidden'} lg:block`}>{t.distanceBasis}</p>
                        <ul className={`space-y-1.5 lg:space-y-2 text-[13px] leading-snug ${feesOpen ? '' : 'hidden'} lg:block`}>
                            {DELIVERY_TIER_COPY.map((tier, i) => (
                                <li key={t.tierRange(tier)} className="flex justify-between items-center gap-2 lg:bg-[#FDFBF7] lg:border lg:border-[#E3EADA]/70 lg:rounded-xl lg:px-3.5 lg:py-2">
                                    <span className="text-[#1A2D23]/70"><span className="font-semibold text-[#1A2D23]">{t.tierRange(tier)}</span></span>
                                    <span className="text-right"><span className="font-bold text-gray-700">RM {tier.fee}</span><br /><span className={`text-[11px] lg:text-[12px] font-bold ${i === DELIVERY_TIER_COPY.length - 1 ? 'text-[#9A3412]' : 'text-[#FF6B35]'}`}>{t.tierFreeOver(tier)}</span></span>
                                </li>
                            ))}
                            {/* Far bands as one compact row — four extra table rows
                                would swamp this card on mobile. */}
                            <li className="pt-1.5 text-[11px] lg:text-[12px] text-[#1A2D23]/55 leading-snug border-t border-[#E3EADA]/70 lg:border-0">
                                {t.beyondNote}
                            </li>
                        </ul>
                    </div>

                    {/* Cutoff + windows */}
                    <div>
                        <p className="text-[13px] font-extrabold text-[#1A2D23] mb-2.5">{t.cutoffHeading}</p>
                        <div className="space-y-2.5">
                            <div className="flex items-start gap-2">
                                <Clock size={15} className="text-[#FF6B35] mt-0.5 shrink-0" strokeWidth={2.5} />
                                <div>
                                    <p className="text-[13px] font-bold text-[#1A2D23]">{t.cutoffTitle}</p>
                                    <p className="text-[12px] text-[#1A2D23]/60 mt-0.5">{t.cutoffSub}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <Truck size={15} className="text-[#FF6B35] mt-0.5 shrink-0" strokeWidth={2.5} />
                                <div>
                                    <p className="text-[13px] font-bold text-[#1A2D23]">{t.windowsTitle}</p>
                                    <p className="text-[12px] text-[#1A2D23]/60 mt-0.5">11AM–1PM · 5PM–8PM</p>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}
