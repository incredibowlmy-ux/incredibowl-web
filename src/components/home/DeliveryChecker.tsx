"use client";

import React, { useState } from 'react';
import { MapPin, Search, Loader2 } from 'lucide-react';

type Tier = 'free' | 'near' | 'mid' | 'far' | 'outside';

interface Result {
    tier: Tier;
    distanceKm: number;
    fee?: number;
    feeAtThreshold?: number;
    threshold?: number;
    formattedAddress?: string;
}

const WHATSAPP_URL = 'https://wa.me/60103370197?text=Hi%20%E7%A2%97%E5%A6%88%EF%BC%8C%E6%88%91%E7%9A%84%E5%9C%B0%E5%9D%80%E5%9C%A8%20%EF%BC%9A';

export default function DeliveryChecker() {
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
            aria-labelledby="delivery-checker-heading"
            className="lg:col-span-12 mt-2"
        >
            <div className="bg-white rounded-2xl border border-[#FF6B35]/15 shadow-sm p-4 md:p-5 lg:p-6">
                <div className="flex items-center gap-2 mb-3">
                    <MapPin size={16} className="text-[#FF6B35] shrink-0" strokeWidth={2.5} />
                    <h2 id="delivery-checker-heading" className="text-[14px] md:text-[15px] font-extrabold text-[#1A2D23]">
                        我家能送吗？<span className="font-medium text-[#1A2D23]/60">30 秒查一下</span>
                    </h2>
                </div>

                <form onSubmit={check} className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            inputMode="text"
                            autoComplete="street-address"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="例: Pearl Suria, OUG Parklane, 58200, Bangsar South..."
                            aria-label="输入你的地址或邮编"
                            className="w-full px-4 py-3 pr-10 text-[14px] bg-[#FDFBF7] border border-gray-200 rounded-xl focus:outline-none focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/15 placeholder:text-gray-400"
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
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#FF6B35] hover:bg-[#E95D31] disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-[14px] transition-colors active:scale-[0.97]"
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
                    <p className="mt-3 text-[13px] text-red-600 leading-relaxed">⚠️ {error}</p>
                )}

                {result && result.tier === 'free' && (
                    <div className="mt-3 p-3 rounded-xl bg-green-50 border border-green-200">
                        <p className="text-[14px] font-extrabold text-green-700">
                            ✅ 免运 🛵 · 你离碗妈 {result.distanceKm} km
                        </p>
                        {result.formattedAddress && (
                            <p className="text-[12px] text-green-700/75 mt-0.5 truncate">{result.formattedAddress}</p>
                        )}
                    </div>
                )}

                {result && result.tier === 'near' && (
                    <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                        <p className="text-[14px] font-extrabold text-amber-800">
                            🛵 配送费 RM {result.fee} · 你离碗妈 {result.distanceKm} km
                        </p>
                        <p className="text-[12px] text-amber-800/80 mt-1">
                            💡 满 <span className="font-bold">RM {result.threshold}</span> 即享 <span className="font-bold">免运</span>（邻里特惠）
                        </p>
                        {result.formattedAddress && (
                            <p className="text-[11px] text-amber-700/60 mt-1 truncate">{result.formattedAddress}</p>
                        )}
                    </div>
                )}

                {result && (result.tier === 'mid' || result.tier === 'far') && (
                    <div className="mt-3 p-3 rounded-xl bg-orange-50 border border-orange-200">
                        <p className="text-[14px] font-extrabold text-orange-800">
                            🛵 配送费 RM {result.fee} · 你离碗妈 {result.distanceKm} km
                        </p>
                        <p className="text-[12px] text-orange-800/80 mt-1">
                            💡 满 <span className="font-bold">RM {result.threshold}</span> 配送费降至 <span className="font-bold">RM {result.feeAtThreshold}</span>
                        </p>
                        {result.formattedAddress && (
                            <p className="text-[11px] text-orange-700/60 mt-1 truncate">{result.formattedAddress}</p>
                        )}
                    </div>
                )}

                {result && result.tier === 'outside' && (
                    <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-200">
                        <p className="text-[14px] font-extrabold text-gray-700">
                            😢 抱歉，你的地址离碗妈 {result.distanceKm} km，超出我们的配送范围
                        </p>
                        <a
                            href={WHATSAPP_URL + encodeURIComponent(address)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 mt-2 text-[12px] font-bold text-green-700 hover:text-green-800"
                        >
                            WhatsApp 问问看有没有变通 →
                        </a>
                    </div>
                )}
            </div>
        </section>
    );
}
