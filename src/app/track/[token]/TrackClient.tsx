"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

// Leaflet touches `window` at import time — client-only, loaded only when
// the order is actually out for delivery (keeps first paint light).
const DriverMap = dynamic(() => import('./DriverMap'), {
    ssr: false,
    loading: () => (
        <div className="h-56 rounded-2xl bg-[#E3EADA]/50 animate-pulse flex items-center justify-center text-sm text-gray-400">
            地图加载中…
        </div>
    ),
});

interface TrackData {
    orderNo: string;
    status: 'pending' | 'confirmed' | 'preparing' | 'delivering' | 'delivered' | 'cancelled';
    deliveryDate: string;
    deliveryTime: string;
    items: { name: string; nameEn: string; quantity: number }[];
    driver: { lat: number; lng: number; updatedAt: number | null } | null;
    dest: { lat: number; lng: number } | null;
}

const POLL_MS = 10_000;

const STEPS = [
    { key: 'confirmed', icon: '✅', zh: '订单已确认', en: 'Confirmed' },
    { key: 'preparing', icon: '👩‍🍳', zh: '碗妈备餐中', en: 'Preparing' },
    { key: 'delivering', icon: '🛵', zh: '配送中', en: 'On the way' },
    { key: 'delivered', icon: '🎉', zh: '已送达', en: 'Delivered' },
] as const;

export default function TrackClient({ token }: { token: string }) {
    const [data, setData] = useState<TrackData | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [loading, setLoading] = useState(true);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch(`/api/track?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
            if (res.status === 404) { setNotFound(true); setLoading(false); return; }
            if (!res.ok) return; // transient error — keep last good data, next poll retries
            const json = await res.json();
            setData(json);
            setLoading(false);
        } catch { /* offline blip — next poll retries */ }
    }, [token]);

    useEffect(() => {
        fetchStatus();
        const startPolling = () => {
            if (timerRef.current) return;
            timerRef.current = setInterval(fetchStatus, POLL_MS);
        };
        const stopPolling = () => {
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        };
        // Pause polling in background tabs; refetch immediately on return
        const onVisibility = () => {
            if (document.hidden) stopPolling();
            else { fetchStatus(); startPolling(); }
        };
        startPolling();
        document.addEventListener('visibilitychange', onVisibility);
        return () => { stopPolling(); document.removeEventListener('visibilitychange', onVisibility); };
    }, [fetchStatus]);

    // Terminal states don't need polling
    useEffect(() => {
        if ((data?.status === 'delivered' || data?.status === 'cancelled') && timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, [data?.status]);

    const isLunch = data?.deliveryTime?.includes('Lunch');
    const currentStep = data ? STEPS.findIndex(s => s.key === data.status) : -1;

    return (
        <main className="min-h-screen bg-[#FDFBF7] px-4 py-8 flex justify-center">
            <div className="w-full max-w-md space-y-5">
                {/* Header */}
                <div className="text-center space-y-1">
                    <a href="/" className="text-2xl font-black text-[#1A2D23]">🍛 Incredibowl</a>
                    <p className="text-sm font-bold text-gray-400">订单跟踪 · Order Tracking</p>
                </div>

                {loading && (
                    <div className="bg-white rounded-2xl border border-[#E3EADA] p-8 text-center text-gray-400 text-sm animate-pulse">
                        查询订单中…
                    </div>
                )}

                {notFound && (
                    <div className="bg-white rounded-2xl border border-[#E3EADA] p-8 text-center space-y-2">
                        <p className="text-3xl">🔍</p>
                        <p className="font-black text-[#1A2D23]">找不到这个订单</p>
                        <p className="text-xs text-gray-400">链接无效或已失效 · Invalid tracking link</p>
                    </div>
                )}

                {data && (
                    <>
                        {/* Order summary */}
                        <div className="bg-white rounded-2xl border border-[#E3EADA] p-5 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">订单编号 Order</span>
                                <span className="font-black text-[#FF6B35]">#{data.orderNo}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">配送时段 Delivery</span>
                                <span className="font-bold text-[#1A2D23] text-sm">
                                    {data.deliveryDate} {isLunch ? '🌞午餐' : '🌙晚餐'}
                                </span>
                            </div>
                            {data.items.length > 0 && (
                                <div className="pt-2 border-t border-[#E3EADA]/70 space-y-1">
                                    {data.items.map((it, i) => (
                                        <p key={i} className="text-sm text-[#1A2D23]">
                                            {it.name.startsWith('↳') ? <span className="text-gray-400 pl-3">{it.name}</span> : it.name}
                                            <span className="text-gray-400"> ×{it.quantity}</span>
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Cancelled */}
                        {data.status === 'cancelled' && (
                            <div className="bg-red-50 rounded-2xl border border-red-200 p-5 text-center space-y-1">
                                <p className="text-2xl">😔</p>
                                <p className="font-black text-red-500">订单已取消 · Cancelled</p>
                                <p className="text-xs text-gray-400">有疑问请 WhatsApp 联系碗妈</p>
                            </div>
                        )}

                        {/* Pending — before boss confirms */}
                        {data.status === 'pending' && (
                            <div className="bg-white rounded-2xl border border-[#E3EADA] p-5 text-center space-y-1">
                                <p className="text-sm font-bold text-[#FF6B35] animate-pulse">⏳ 碗妈正在核对付款，请稍候</p>
                                <p className="text-xs text-gray-400">Awaiting confirmation</p>
                            </div>
                        )}

                        {/* Timeline */}
                        {data.status !== 'cancelled' && (
                            <div className="bg-white rounded-2xl border border-[#E3EADA] p-5">
                                <div className="space-y-0">
                                    {STEPS.map((step, i) => {
                                        const reached = currentStep >= i;
                                        const isCurrent = currentStep === i && data.status !== 'delivered';
                                        return (
                                            <div key={step.key} className="flex gap-3">
                                                <div className="flex flex-col items-center">
                                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 transition-colors ${
                                                        reached ? 'bg-[#FF6B35]/10' : 'bg-gray-100 grayscale opacity-40'
                                                    } ${isCurrent ? 'ring-2 ring-[#FF6B35] animate-pulse' : ''}`}>
                                                        {step.icon}
                                                    </div>
                                                    {i < STEPS.length - 1 && (
                                                        <div className={`w-0.5 h-6 ${currentStep > i ? 'bg-[#FF6B35]' : 'bg-gray-200'}`} />
                                                    )}
                                                </div>
                                                <div className="pt-1.5">
                                                    <p className={`text-sm font-black leading-tight ${reached ? 'text-[#1A2D23]' : 'text-gray-300'}`}>
                                                        {step.zh}
                                                    </p>
                                                    <p className={`text-[10px] ${reached ? 'text-gray-400' : 'text-gray-300'}`}>{step.en}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Live driver map — only while out for delivery */}
                        {data.status === 'delivering' && (
                            <div className="bg-white rounded-2xl border border-[#E3EADA] p-3 space-y-2">
                                <p className="text-sm font-black text-[#1A2D23] px-2 pt-1">
                                    🛵 碗妈正在路上 <span className="text-[10px] font-bold text-gray-400">Driver on the way</span>
                                </p>
                                {data.driver ? (
                                    <DriverMap driver={data.driver} dest={data.dest} />
                                ) : (
                                    <p className="text-xs text-gray-400 px-2 pb-1">📡 正在获取司机位置…（司机手机信号恢复后自动更新）</p>
                                )}
                                {data.driver?.updatedAt && (
                                    <p className="text-[10px] text-gray-300 px-2 pb-1">
                                        位置更新于 {new Date(data.driver.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </p>
                                )}
                            </div>
                        )}

                        {data.status === 'delivered' && (
                            <div className="bg-green-50 rounded-2xl border border-green-200 p-5 text-center space-y-1">
                                <p className="text-2xl">🎉</p>
                                <p className="font-black text-green-600">已送达，请享用！</p>
                                <p className="text-xs text-gray-400">Delivered — enjoy your meal!</p>
                            </div>
                        )}
                    </>
                )}

                <p className="text-center text-[10px] text-gray-300">
                    页面每 10 秒自动更新 · Auto-refreshes every 10s
                </p>
            </div>
        </main>
    );
}
