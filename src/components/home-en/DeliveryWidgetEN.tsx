"use client";

import React, { useState } from 'react';
import { MapPin, Search, Loader2, Clock, Truck, AlertTriangle } from 'lucide-react';
import { DELIVERY_TIER_COPY, DISTANCE_BASIS_EN, freeOverPhraseEn, BEYOND_DELIVERY_NOTE_EN } from '@/lib/deliveryCopy';

// 2026-07-29: 'outside' now means past the 25km ceiling — see ZH twin.
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

const WHATSAPP_URL = "https://wa.me/60103370197?text=Hi%20BowlMama%2C%20my%20address%20is%3A%20";

export default function DeliveryWidgetEN() {
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
                setError(data.error || 'Lookup failed, please try again');
                return;
            }
            setResult(data);
        } catch {
            setError('Network error, please try again later');
        } finally {
            setLoading(false);
        }
    };

    return (
        <section
            aria-labelledby="delivery-heading-en"
            className="lg:col-span-12 mt-4"
        >
            {/* Mobile keeps the stacked strips; desktop splits into checker-left /
                info-right so neither side stretches into dead space. */}
            <div className="bg-white rounded-[32px] border border-[#FF6B35]/15 shadow-sm overflow-hidden lg:grid lg:grid-cols-12">
                <div className="bg-gradient-to-br from-[#FFF8F0] via-[#FFF1E5] to-[#FFE6D0] px-6 md:px-10 py-6 md:py-8 lg:col-span-6 lg:flex lg:flex-col lg:justify-center">
                    <div className="flex items-center gap-2.5 mb-1.5">
                        <MapPin size={18} className="text-[#FF6B35] shrink-0" strokeWidth={2.5} />
                        <h2 id="delivery-heading-en" className="text-[18px] md:text-[22px] lg:text-[26px] font-extrabold text-[#1A2D23] leading-tight">
                            Can we deliver to you?
                        </h2>
                    </div>
                    <p className="text-[13px] md:text-[14px] text-[#1A2D23]/65 mb-4">
                        30-second check &mdash; see your delivery zone
                    </p>

                    <form onSubmit={check} className="flex flex-col sm:flex-row gap-2.5 max-w-xl">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                inputMode="text"
                                autoComplete="street-address"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="e.g. Pearl Suria, OUG Parklane, 58200..."
                                aria-label="Enter your address or postcode"
                                className="w-full px-4 py-3 pr-10 text-[14px] bg-white border border-[#FF6B35]/20 rounded-xl focus:outline-none focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/20 placeholder:text-gray-400 shadow-sm"
                            />
                            {address && !loading && (
                                <button
                                    type="button"
                                    onClick={() => { setAddress(''); setResult(null); setError(''); }}
                                    aria-label="Clear"
                                    className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={loading || !address.trim()}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#FF6B35] hover:bg-[#E95D31] disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-[14px] transition-colors active:scale-[0.97] shadow-md shadow-[#FF6B35]/20"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" strokeWidth={2.5} />
                                    Checking
                                </>
                            ) : (
                                <>
                                    <Search size={16} strokeWidth={2.75} />
                                    Check
                                </>
                            )}
                        </button>
                    </form>

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
                                Delivery fee RM {result.fee} &middot; {result.distanceKm} km away
                            </p>
                            <p className="text-[12px] text-[#C84518]/85 mt-1">
                                Spend <span className="font-bold">RM {result.threshold}+</span> and it&apos;s <span className="font-bold">free</span>
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
                                Delivery fee RM {result.fee} &middot; {result.distanceKm} km away
                            </p>
                            <p className="text-[12px] text-[#9A3412]/85 mt-1">
                                Spend <span className="font-bold">RM {result.threshold}+</span> and the fee drops to <span className="font-bold">RM {result.feeAtThreshold}</span>
                            </p>
                            {result.formattedAddress && (
                                <p className="text-[11px] text-[#9A3412]/60 mt-1 truncate">{result.formattedAddress}</p>
                            )}
                        </div>
                    )}

                    {/* Far (7.5km+): flat fee, no threshold — see ZH twin. */}
                    {result && result.tier === 'far' && (
                        <div className="mt-3 max-w-xl p-3 rounded-xl bg-[#FFE4D6] border border-[#FF6B35]/40">
                            <p className="text-[14px] font-extrabold text-[#9A3412] flex items-center gap-1.5">
                                <Truck size={16} strokeWidth={2.5} />
                                Delivery fee RM {result.fee} &middot; {result.distanceKm} km away
                            </p>
                            <p className="text-[12px] text-[#9A3412]/85 mt-1">
                                Long-distance orders are delivered by <span className="font-bold">Grab</span> at a flat <span className="font-bold">RM {result.fee}</span> &mdash; no free-delivery threshold
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
                                Sorry, you&apos;re {result.distanceKm} km away &mdash; beyond our 25km delivery range
                            </p>
                            <a
                                href={WHATSAPP_URL + encodeURIComponent(address)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 mt-2 text-[12px] font-bold text-green-700 hover:text-green-800"
                            >
                                Catering order? WhatsApp us &rarr;
                            </a>
                        </div>
                    )}
                </div>

                {/* WhatsApp fallback CTA removed — outside-zone result already
                    surfaces a WhatsApp link, and the floating button + sticky
                    bar cover the rest. */}
                <div className="px-6 md:px-10 py-6 md:py-7 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 items-start lg:col-span-6 lg:border-l lg:border-[#FF6B35]/10 lg:content-center lg:gap-8">
                    <div>
                        <button
                            type="button"
                            onClick={() => setFeesOpen(v => !v)}
                            aria-expanded={feesOpen}
                            className="w-full min-h-[40px] flex items-center gap-2 text-left lg:min-h-0 lg:pointer-events-none"
                        >
                            <span className="text-[13px] font-extrabold text-[#1A2D23]">Delivery fee at a glance</span>
                            <span className="ml-auto text-[12px] font-bold text-[#FF6B35] lg:hidden">{feesOpen ? 'Hide ▴' : 'View ▾'}</span>
                        </button>
                        <p className={`text-[11px] lg:text-[12px] text-[#1A2D23]/50 mt-0.5 mb-2.5 ${feesOpen ? '' : 'hidden'} lg:block`}>{DISTANCE_BASIS_EN}</p>
                        <ul className={`space-y-1.5 lg:space-y-2 text-[13px] leading-snug ${feesOpen ? '' : 'hidden'} lg:block`}>
                            {DELIVERY_TIER_COPY.map((t, i) => (
                                <li key={t.rangeEn} className="flex justify-between items-center gap-2 lg:bg-[#FDFBF7] lg:border lg:border-[#E3EADA]/70 lg:rounded-xl lg:px-3.5 lg:py-2">
                                    <span className="text-[#1A2D23]/70"><span className="font-semibold text-[#1A2D23]">{t.rangeEn}</span></span>
                                    <span className="text-right"><span className="font-bold text-gray-700">RM {t.fee}</span><br /><span className={`text-[11px] lg:text-[12px] font-bold ${i === DELIVERY_TIER_COPY.length - 1 ? 'text-[#9A3412]' : 'text-[#FF6B35]'}`}>{t.freeOver === null ? freeOverPhraseEn(t) : `RM ${t.freeOver}+ → free`}</span></span>
                                </li>
                            ))}
                            {/* Far bands as one compact row — see ZH twin. */}
                            <li className="pt-1.5 text-[11px] lg:text-[12px] text-[#1A2D23]/55 leading-snug border-t border-[#E3EADA]/70 lg:border-0">
                                {BEYOND_DELIVERY_NOTE_EN}
                            </li>
                        </ul>
                    </div>

                    <div>
                        <p className="text-[13px] font-extrabold text-[#1A2D23] mb-2.5">Cutoff &amp; delivery windows</p>
                        <div className="space-y-2.5">
                            <div className="flex items-start gap-2">
                                <Clock size={15} className="text-[#FF6B35] mt-0.5 shrink-0" strokeWidth={2.5} />
                                <div>
                                    <p className="text-[13px] font-bold text-[#1A2D23]">Orders close 06:00 daily</p>
                                    <p className="text-[12px] text-[#1A2D23]/60 mt-0.5">Order before 06:00 for same-day delivery</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <Truck size={15} className="text-[#FF6B35] mt-0.5 shrink-0" strokeWidth={2.5} />
                                <div>
                                    <p className="text-[13px] font-bold text-[#1A2D23]">Delivery windows</p>
                                    <p className="text-[12px] text-[#1A2D23]/60 mt-0.5">11AM–1PM &middot; 5PM–8PM</p>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}
