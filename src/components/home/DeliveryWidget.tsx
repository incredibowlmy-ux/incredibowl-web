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

const WHATSAPP_URL = "https://wa.me/60103370197?text=Hi%20%E7%A2%97%E5%A6%88%EF%BC%8C%E6%88%91%E7%9A%84%E5%9C%B0%E5%9D%80%E5%9C%A8%20%EF%BC%9A";

export default function DeliveryWidget() {
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
                setError(data.error || '查询失败，请重试');
                return;
            }
            setResult(data);
        } catch {
            setError('网络异常，请稍后重试');
        } finally {
            setLoading(false);
        }
    };

    return (
        <section
            aria-labelledby="delivery-heading"
            className="lg:col-span-12 lg:row-start-3 mt-4"
        >
            <div className="bg-white rounded-[32px] border border-[#FF6B35]/15 shadow-sm overflow-hidden">
                {/* Hero strip: address checker — the headline action */}
                <div className="bg-gradient-to-br from-[#FFF8F0] via-[#FFF1E5] to-[#FFE6D0] px-6 md:px-10 py-6 md:py-8">
                    <div className="flex items-center gap-2.5 mb-1.5">
                        <MapPin size={18} className="text-[#FF6B35] shrink-0" strokeWidth={2.5} />
                        <h2 id="delivery-heading" className="text-[18px] md:text-[22px] lg:text-[26px] font-extrabold text-[#1A2D23] leading-tight">
                            我家能送吗？
                        </h2>
                    </div>
                    <p className="text-[13px] md:text-[14px] text-[#1A2D23]/65 mb-4">
                        30 秒查一下你属于哪个配送区
                    </p>

                    <form onSubmit={check} className="flex flex-col sm:flex-row gap-2.5 max-w-xl">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                inputMode="text"
                                autoComplete="street-address"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="例: Pearl Suria, OUG Parklane, 58200..."
                                aria-label="输入你的地址或邮编"
                                className="w-full px-4 py-3 pr-10 text-[14px] bg-white border border-[#FF6B35]/20 rounded-xl focus:outline-none focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/20 placeholder:text-gray-400 shadow-sm"
                            />
                            {address && !loading && (
                                <button
                                    type="button"
                                    onClick={() => { setAddress(''); setResult(null); setError(''); }}
                                    aria-label="清空"
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
                                    查询中
                                </>
                            ) : (
                                <>
                                    <Search size={16} strokeWidth={2.75} />
                                    查一下
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

                    {result && result.tier === 'free' && (
                        <div className="mt-3 max-w-xl p-3 rounded-xl bg-green-50 border border-green-200 flex items-start gap-2.5">
                            <CheckCircle2 size={18} className="text-green-600 mt-0.5 shrink-0" strokeWidth={2.5} />
                            <div className="min-w-0">
                                <p className="text-[14px] font-extrabold text-green-700">
                                    免运 · 你离碗妈 {result.distanceKm} km
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
                                配送费 RM {result.fee} · 离碗妈 {result.distanceKm} km
                            </p>
                            <p className="text-[12px] text-amber-800/80 mt-1">
                                满 <span className="font-bold">RM {result.threshold}</span> 即享 <span className="font-bold">免运</span>（邻里特惠）
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
                                配送费 RM {result.fee} · 离碗妈 {result.distanceKm} km
                            </p>
                            <p className="text-[12px] text-orange-800/80 mt-1">
                                满 <span className="font-bold">RM {result.threshold}</span> 配送费降至 <span className="font-bold">RM {result.feeAtThreshold}</span>
                            </p>
                            {result.formattedAddress && (
                                <p className="text-[11px] text-orange-700/60 mt-1 truncate">{result.formattedAddress}</p>
                            )}
                        </div>
                    )}

                    {result && result.tier === 'outside' && (
                        <div className="mt-3 max-w-xl p-3 rounded-xl bg-gray-50 border border-gray-200">
                            <p className="text-[14px] font-extrabold text-gray-700">
                                抱歉，你的地址离碗妈 {result.distanceKm} km，超出配送范围
                            </p>
                            <a
                                href={WHATSAPP_URL + encodeURIComponent(address)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 mt-2 text-[12px] font-bold text-green-700 hover:text-green-800"
                            >
                                WhatsApp 问问看 →
                            </a>
                        </div>
                    )}
                </div>

                {/* Lower grid: tier table + cutoff/windows + WhatsApp CTA */}
                <div className="px-6 md:px-10 py-6 md:py-7 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 items-start">
                    {/* Tier table */}
                    <div>
                        <p className="text-[13px] font-extrabold text-[#1A2D23] mb-2.5">配送费一览</p>
                        <ul className="space-y-1.5 text-[13px] leading-snug">
                            <li className="flex justify-between gap-2">
                                <span className="text-[#1A2D23]/70"><span className="font-semibold text-[#1A2D23]">2km 内</span></span>
                                <span className="font-bold text-green-600">免运</span>
                            </li>
                            <li className="flex justify-between gap-2">
                                <span className="text-[#1A2D23]/70"><span className="font-semibold text-[#1A2D23]">2–5km</span> · 邻里特惠</span>
                                <span className="text-right"><span className="font-bold text-gray-700">RM 5</span><br /><span className="text-[11px] text-[#FF6B35] font-bold">满 RM 20 免运</span></span>
                            </li>
                            <li className="flex justify-between gap-2">
                                <span className="text-[#1A2D23]/70"><span className="font-semibold text-[#1A2D23]">5–8km</span></span>
                                <span className="text-right"><span className="font-bold text-gray-700">RM 15</span><br /><span className="text-[11px] text-amber-600 font-bold">满 RM 40 → RM 5</span></span>
                            </li>
                            <li className="flex justify-between gap-2">
                                <span className="text-[#1A2D23]/70"><span className="font-semibold text-[#1A2D23]">8km +</span></span>
                                <span className="text-right"><span className="font-bold text-gray-700">RM 25</span><br /><span className="text-[11px] text-orange-600 font-bold">满 RM 40 → RM 15</span></span>
                            </li>
                        </ul>
                    </div>

                    {/* Cutoff + windows */}
                    <div>
                        <p className="text-[13px] font-extrabold text-[#1A2D23] mb-2.5">截单与配送时段</p>
                        <div className="space-y-2.5">
                            <div className="flex items-start gap-2">
                                <Clock size={15} className="text-[#FF6B35] mt-0.5 shrink-0" strokeWidth={2.5} />
                                <div>
                                    <p className="text-[13px] font-bold text-[#1A2D23]">每天 06:00 截单</p>
                                    <p className="text-[12px] text-[#1A2D23]/60 mt-0.5">06:00 前下单当日配送</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <Truck size={15} className="text-[#FF6B35] mt-0.5 shrink-0" strokeWidth={2.5} />
                                <div>
                                    <p className="text-[13px] font-bold text-[#1A2D23]">配送时段</p>
                                    <p className="text-[12px] text-[#1A2D23]/60 mt-0.5">11AM–1PM · 5PM–8PM</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* WhatsApp fallback */}
                    <div className="md:col-span-1 flex flex-col gap-2.5">
                        <p className="text-[13px] font-extrabold text-[#1A2D23]">不确定能不能送？</p>
                        <a
                            href={WHATSAPP_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#25D366] hover:bg-[#20BE5A] text-white rounded-xl font-bold text-[14px] transition-colors active:scale-[0.97] shadow-md shadow-[#25D366]/20"
                        >
                            <Phone size={15} strokeWidth={2.75} />
                            WhatsApp 问碗妈
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
}
