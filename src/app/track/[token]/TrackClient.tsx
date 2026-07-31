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
    /** 'grab' = 交给外送平台骑手，我们拿不到位置；'self' = 碗妈自己送，有实时地图 */
    carrier?: 'grab' | 'self';
}

const POLL_MS = 10_000;

const STEPS = [
    { key: 'confirmed', icon: '✅', zh: '订单已确认', en: 'Confirmed' },
    { key: 'preparing', icon: '👩‍🍳', zh: '碗妈备餐中', en: 'Preparing' },
    { key: 'delivering', icon: '🛵', zh: '配送中', en: 'On the way' },
    { key: 'delivered', icon: '🎉', zh: '已送达', en: 'Delivered' },
] as const;

// 页内语言切换（不开 /en/track 新路由：链接下单时已生成、随 WhatsApp 发出，
// 老链接无法换路由；页面 noindex 也无 SEO 需求）。?lang=en 由 EN 侧下单
// 成功页/FPX 弹窗生成；再用 localStorage 记住手动切换。zh 值保持原字面量。
type TrackLang = 'zh' | 'en';
const TRACK_LANG_KEY = 'ib_track_lang';
const TRACK_DICT = {
    zh: {
        subtitle: '订单跟踪 · Order Tracking',
        checking: '查询订单中…',
        notFoundTitle: '找不到这个订单',
        notFoundSub: '链接无效或已失效 · Invalid tracking link',
        orderLabel: '订单编号 Order',
        deliveryLabel: '配送时段 Delivery',
        lunch: '🌞午餐',
        dinner: '🌙晚餐',
        cancelledTitle: '订单已取消 · Cancelled',
        cancelledSub: '有疑问请 WhatsApp 联系碗妈',
        pendingTitle: '⏳ 碗妈正在核对付款，请稍候',
        pendingSub: 'Awaiting confirmation',
        driverOnWay: '🛵 碗妈正在路上',
        driverOnWaySub: 'Driver on the way',
        gettingLocation: '📡 正在获取司机位置…（司机手机信号恢复后自动更新）',
        locationUpdatedAt: (time: string) => `位置更新于 ${time}`,
        grabOnWay: '🚕 已交给外送骑手',
        grabOnWaySub: 'Rider on the way',
        grabNote: '这一单由外送平台骑手配送，我们这边看不到骑手的实时位置。骑手快到时通常会打电话给你，请留意来电。',
        deliveredTitle: '已送达，请享用！',
        deliveredSub: 'Delivered — enjoy your meal!',
        autoRefresh: '页面每 10 秒自动更新 · Auto-refreshes every 10s',
        timeLocale: 'zh-CN',
    },
    en: {
        subtitle: 'Order Tracking',
        checking: 'Looking up your order…',
        notFoundTitle: 'Order not found',
        notFoundSub: 'Invalid or expired tracking link',
        orderLabel: 'Order',
        deliveryLabel: 'Delivery',
        lunch: '🌞 Lunch',
        dinner: '🌙 Dinner',
        cancelledTitle: 'Order cancelled',
        cancelledSub: 'Questions? WhatsApp BowlMama',
        pendingTitle: '⏳ BowlMama is verifying your payment, hang tight',
        pendingSub: 'Awaiting confirmation',
        driverOnWay: '🛵 BowlMama is on the way',
        driverOnWaySub: 'Live driver location',
        gettingLocation: "📡 Locating the driver… (updates automatically once the driver's phone signal returns)",
        locationUpdatedAt: (time: string) => `Location updated at ${time}`,
        grabOnWay: '🚕 Handed to a delivery rider',
        grabOnWaySub: 'Rider on the way',
        grabNote: "This order is delivered by a third-party rider, so we can't show their live location here. The rider will usually call you when close by — please keep an eye on your phone.",
        deliveredTitle: 'Delivered — enjoy your meal!',
        deliveredSub: 'Thank you for ordering!',
        autoRefresh: 'Auto-refreshes every 10s',
        timeLocale: 'en-MY',
    },
} as const;

export default function TrackClient({ token }: { token: string }) {
    const [data, setData] = useState<TrackData | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [loading, setLoading] = useState(true);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // 首屏固定 zh（防 hydration mismatch），mount 后按 ?lang= → localStorage 切换
    const [lang, setLang] = useState<TrackLang>('zh');
    useEffect(() => {
        try {
            const q = new URLSearchParams(window.location.search).get('lang');
            if (q === 'en' || q === 'zh') {
                setLang(q);
                localStorage.setItem(TRACK_LANG_KEY, q);
                return;
            }
            if (localStorage.getItem(TRACK_LANG_KEY) === 'en') setLang('en');
        } catch { /* storage blocked — stay zh */ }
    }, []);
    const switchLang = (l: TrackLang) => {
        setLang(l);
        try { localStorage.setItem(TRACK_LANG_KEY, l); } catch { /* ignore */ }
    };
    const t = TRACK_DICT[lang];

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
                    <a href={lang === 'en' ? '/en' : '/'} className="text-2xl font-black text-[#1A2D23]">🍛 Incredibowl</a>
                    <p className="text-sm font-bold text-gray-400">{t.subtitle}</p>
                    {/* 语言小切换（页内 state + localStorage，不换路由） */}
                    <div className="inline-flex items-center gap-0.5 bg-white border border-[#E3EADA] rounded-full p-0.5 text-[11px] font-black">
                        <button type="button" onClick={() => switchLang('zh')}
                            className={`px-2.5 py-1 rounded-full transition-colors ${lang === 'zh' ? 'bg-[#1A2D23] text-white' : 'text-gray-400 hover:text-[#1A2D23]'}`}>
                            中文
                        </button>
                        <button type="button" onClick={() => switchLang('en')}
                            className={`px-2.5 py-1 rounded-full transition-colors ${lang === 'en' ? 'bg-[#1A2D23] text-white' : 'text-gray-400 hover:text-[#1A2D23]'}`}>
                            EN
                        </button>
                    </div>
                </div>

                {loading && (
                    <div className="bg-white rounded-2xl border border-[#E3EADA] p-8 text-center text-gray-400 text-sm animate-pulse">
                        {t.checking}
                    </div>
                )}

                {notFound && (
                    <div className="bg-white rounded-2xl border border-[#E3EADA] p-8 text-center space-y-2">
                        <p className="text-3xl">🔍</p>
                        <p className="font-black text-[#1A2D23]">{t.notFoundTitle}</p>
                        <p className="text-xs text-gray-400">{t.notFoundSub}</p>
                    </div>
                )}

                {data && (
                    <>
                        {/* Order summary */}
                        <div className="bg-white rounded-2xl border border-[#E3EADA] p-5 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">{t.orderLabel}</span>
                                <span className="font-black text-[#FF6B35]">#{data.orderNo}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">{t.deliveryLabel}</span>
                                <span className="font-bold text-[#1A2D23] text-sm">
                                    {data.deliveryDate} {isLunch ? t.lunch : t.dinner}
                                </span>
                            </div>
                            {data.items.length > 0 && (
                                <div className="pt-2 border-t border-[#E3EADA]/70 space-y-1">
                                    {data.items.map((it, i) => {
                                        const display = lang === 'en' ? (it.nameEn || it.name) : it.name;
                                        return (
                                            <p key={i} className="text-sm text-[#1A2D23]">
                                                {it.name.startsWith('↳') ? <span className="text-gray-400 pl-3">{display}</span> : display}
                                                <span className="text-gray-400"> ×{it.quantity}</span>
                                            </p>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Cancelled */}
                        {data.status === 'cancelled' && (
                            <div className="bg-red-50 rounded-2xl border border-red-200 p-5 text-center space-y-1">
                                <p className="text-2xl">😔</p>
                                <p className="font-black text-red-500">{t.cancelledTitle}</p>
                                <p className="text-xs text-gray-400">{t.cancelledSub}</p>
                            </div>
                        )}

                        {/* Pending — before boss confirms */}
                        {data.status === 'pending' && (
                            <div className="bg-white rounded-2xl border border-[#E3EADA] p-5 text-center space-y-1">
                                <p className="text-sm font-bold text-[#FF6B35] animate-pulse">{t.pendingTitle}</p>
                                <p className="text-xs text-gray-400">{t.pendingSub}</p>
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
                                                        {lang === 'en' ? step.en : step.zh}
                                                    </p>
                                                    <p className={`text-[10px] ${reached ? 'text-gray-400' : 'text-gray-300'}`}>{lang === 'en' ? step.zh : step.en}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 外送平台骑手送的单 —— 我们没有骑手位置，绝不能显示
                            「正在获取司机位置…」让客户干等一个永远不会出现的地图 */}
                        {data.status === 'delivering' && data.carrier === 'grab' && (
                            <div className="bg-white rounded-2xl border border-[#E3EADA] p-4 space-y-1.5">
                                <p className="text-sm font-black text-[#1A2D23]">
                                    {t.grabOnWay} <span className="text-[10px] font-bold text-gray-400">{t.grabOnWaySub}</span>
                                </p>
                                <p className="text-xs text-gray-500 leading-relaxed">{t.grabNote}</p>
                            </div>
                        )}

                        {/* Live driver map — only while BowlMama is driving it herself */}
                        {data.status === 'delivering' && data.carrier !== 'grab' && (
                            <div className="bg-white rounded-2xl border border-[#E3EADA] p-3 space-y-2">
                                <p className="text-sm font-black text-[#1A2D23] px-2 pt-1">
                                    {t.driverOnWay} <span className="text-[10px] font-bold text-gray-400">{t.driverOnWaySub}</span>
                                </p>
                                {data.driver ? (
                                    <DriverMap driver={data.driver} dest={data.dest} />
                                ) : (
                                    <p className="text-xs text-gray-400 px-2 pb-1">{t.gettingLocation}</p>
                                )}
                                {data.driver?.updatedAt && (
                                    <p className="text-[10px] text-gray-300 px-2 pb-1">
                                        {t.locationUpdatedAt(new Date(data.driver.updatedAt).toLocaleTimeString(t.timeLocale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }))}
                                    </p>
                                )}
                            </div>
                        )}

                        {data.status === 'delivered' && (
                            <div className="bg-green-50 rounded-2xl border border-green-200 p-5 text-center space-y-1">
                                <p className="text-2xl">🎉</p>
                                <p className="font-black text-green-600">{t.deliveredTitle}</p>
                                <p className="text-xs text-gray-400">{t.deliveredSub}</p>
                            </div>
                        )}
                    </>
                )}

                <p className="text-center text-[10px] text-gray-300">
                    {t.autoRefresh}
                </p>
            </div>
        </main>
    );
}
