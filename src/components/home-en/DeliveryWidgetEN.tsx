"use client";

import React, { useState } from 'react';
import { MapPin, Search, Loader2, Clock, Truck, Phone, AlertTriangle, CheckCircle2 } from 'lucide-react';

type Tier = 'free' | 'near' | 'mid' | 'far' | 'outside';

interface Result {
    tier: Tier;
    distanceKm: number;
    fee?: number;
    feeAtThreshold?: number;
    threshold?: number;
    formattedAddress?: string;
}

const WHATSAPP_URL = "https://wa.me/60103370197?text=Hi%20BowlMama%2C%20my%20address%20is%3A%20";

export default function DeliveryWidgetEN() {
    const [address, setAddress] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<Result | null>(null);
    const [error, setError] = useState('');

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
            className="lg:col-span-12 lg:row-start-3 mt-4"
        >
            <div className="bg-white rounded-[32px] border border-[#FF6B35]/15 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-br from-[#FFF8F0] via-[#FFF1E5] to-[#FFE6D0] px-6 md:px-10 py-6 md:py-8">
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

                    {result && result.tier === 'free' && (
                        <div className="mt-3 max-w-xl p-3 rounded-xl bg-green-50 border border-green-200 flex items-start gap-2.5">
                            <CheckCircle2 size={18} className="text-green-600 mt-0.5 shrink-0" strokeWidth={2.5} />
                            <div className="min-w-0">
                                <p className="text-[14px] font-extrabold text-green-700">
                                    Free delivery &middot; You&apos;re {result.distanceKm} km from us
                                </p>
                                {result.formattedAddress && (
                                    <p className="text-[12px] text-green-700/75 mt-0.5 truncate">{result.formattedAddress}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {result && result.tier === 'near' && (
                        <div className="mt-3 max-w-xl p-3 rounded-xl bg-amber-50 border border-amber-200">
                            <p className="text-[14px] font-extrabold text-amber-800 flex items-center gap-1.5">
                                <Truck size={16} strokeWidth={2.5} />
                                Delivery fee RM {result.fee} &middot; {result.distanceKm} km away
                            </p>
                            <p className="text-[12px] text-amber-800/80 mt-1">
                                Spend <span className="font-bold">RM {result.threshold}+</span> and it&apos;s <span className="font-bold">free</span> (neighbour special)
                            </p>
                            {result.formattedAddress && (
                                <p className="text-[11px] text-amber-700/60 mt-1 truncate">{result.formattedAddress}</p>
                            )}
                        </div>
                    )}

                    {result && (result.tier === 'mid' || result.tier === 'far') && (
                        <div className="mt-3 max-w-xl p-3 rounded-xl bg-orange-50 border border-orange-200">
                            <p className="text-[14px] font-extrabold text-orange-800 flex items-center gap-1.5">
                                <Truck size={16} strokeWidth={2.5} />
                                Delivery fee RM {result.fee} &middot; {result.distanceKm} km away
                            </p>
                            <p className="text-[12px] text-orange-800/80 mt-1">
                                Spend <span className="font-bold">RM {result.threshold}+</span> and the fee drops to <span className="font-bold">RM {result.feeAtThreshold}</span>
                            </p>
                            {result.formattedAddress && (
                                <p className="text-[11px] text-orange-700/60 mt-1 truncate">{result.formattedAddress}</p>
                            )}
                        </div>
                    )}

                    {result && result.tier === 'outside' && (
                        <div className="mt-3 max-w-xl p-3 rounded-xl bg-gray-50 border border-gray-200">
                            <p className="text-[14px] font-extrabold text-gray-700">
                                Sorry, you&apos;re {result.distanceKm} km away &mdash; outside our delivery range
                            </p>
                            <a
                                href={WHATSAPP_URL + encodeURIComponent(address)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 mt-2 text-[12px] font-bold text-green-700 hover:text-green-800"
                            >
                                WhatsApp BowlMama anyway &rarr;
                            </a>
                        </div>
                    )}
                </div>

                <div className="px-6 md:px-10 py-6 md:py-7 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 items-start">
                    <div>
                        <p className="text-[13px] font-extrabold text-[#1A2D23] mb-2.5">Delivery fee at a glance</p>
                        <ul className="space-y-1.5 text-[13px] leading-snug">
                            <li className="flex justify-between gap-2">
                                <span className="text-[#1A2D23]/70"><span className="font-semibold text-[#1A2D23]">Within 2km</span></span>
                                <span className="font-bold text-green-600">Free</span>
                            </li>
                            <li className="flex justify-between gap-2">
                                <span className="text-[#1A2D23]/70"><span className="font-semibold text-[#1A2D23]">2–5km</span> · neighbour</span>
                                <span className="text-right"><span className="font-bold text-gray-700">RM 5</span><br /><span className="text-[11px] text-[#FF6B35] font-bold">RM 20+ → free</span></span>
                            </li>
                            <li className="flex justify-between gap-2">
                                <span className="text-[#1A2D23]/70"><span className="font-semibold text-[#1A2D23]">5–8km</span></span>
                                <span className="text-right"><span className="font-bold text-gray-700">RM 15</span><br /><span className="text-[11px] text-amber-600 font-bold">RM 40+ → RM 5</span></span>
                            </li>
                            <li className="flex justify-between gap-2">
                                <span className="text-[#1A2D23]/70"><span className="font-semibold text-[#1A2D23]">8km +</span></span>
                                <span className="text-right"><span className="font-bold text-gray-700">RM 25</span><br /><span className="text-[11px] text-orange-600 font-bold">RM 40+ → RM 15</span></span>
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

                    <div className="md:col-span-1 flex flex-col gap-2.5">
                        <p className="text-[13px] font-extrabold text-[#1A2D23]">Not sure if we deliver?</p>
                        <a
                            href={WHATSAPP_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#25D366] hover:bg-[#20BE5A] text-white rounded-xl font-bold text-[14px] transition-colors active:scale-[0.97] shadow-md shadow-[#25D366]/20"
                        >
                            <Phone size={15} strokeWidth={2.75} />
                            WhatsApp BowlMama
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
}
