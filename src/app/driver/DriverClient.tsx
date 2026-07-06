"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

// Client-side gate is cosmetic only — every API call below is re-verified
// server-side by verifyAdminEmail. (Kept local: adminApi.ts imports
// next/server and must stay out of the client bundle.)
const ADMIN_EMAILS = ['hello@incredibowl.my', 'incredibowl.my@gmail.com'];

const GPS_REPORT_MS = 8_000;
const BATCH_POLL_MS = 30_000;

interface BatchOrder {
    id: string;
    orderNo: string;
    userName: string;
    userPhone: string;
    userAddress: string;
    deliveryTime: string;
    status: string;
    items: string;
    note: string;
}

export default function DriverClient() {
    const { currentUser, authLoading } = useAuth();
    const [batch, setBatch] = useState<{ id: string; deliveredOrderIds: string[] } | null>(null);
    const [orders, setOrders] = useState<BatchOrder[]>([]);
    const [loadingBatch, setLoadingBatch] = useState(true);
    const [gpsState, setGpsState] = useState<'off' | 'ok' | 'denied' | 'error'>('off');
    const [lastSentAt, setLastSentAt] = useState<number | null>(null);
    const [busy, setBusy] = useState<string | null>(null); // orderId being marked
    const lastReportRef = useRef(0);
    const batchIdRef = useRef<string | null>(null);

    const isAdmin = !!currentUser?.email && ADMIN_EMAILS.includes(currentUser.email);

    const callApi = useCallback(async (body: Record<string, unknown>) => {
        if (!currentUser) throw new Error('未登录');
        const token = await currentUser.getIdToken();
        const res = await fetch('/api/admin/delivery-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || '请求失败');
        return data;
    }, [currentUser]);

    const refreshBatch = useCallback(async () => {
        try {
            const data = await callApi({ action: 'current' });
            setBatch(data.batch);
            setOrders(data.orders || []);
            batchIdRef.current = data.batch?.id || null;
        } catch { /* transient — next poll retries */ }
        setLoadingBatch(false);
    }, [callApi]);

    // Load + poll the active batch
    useEffect(() => {
        if (!isAdmin) return;
        refreshBatch();
        const t = setInterval(refreshBatch, BATCH_POLL_MS);
        return () => clearInterval(t);
    }, [isAdmin, refreshBatch]);

    // GPS: watchPosition, throttled to one report / GPS_REPORT_MS
    useEffect(() => {
        if (!isAdmin || !batch?.id || !('geolocation' in navigator)) return;
        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                setGpsState('ok');
                const now = Date.now();
                if (now - lastReportRef.current < GPS_REPORT_MS) return;
                lastReportRef.current = now;
                callApi({
                    action: 'location',
                    batchId: batchIdRef.current,
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                }).then(() => setLastSentAt(Date.now())).catch(() => {});
            },
            (err) => setGpsState(err.code === err.PERMISSION_DENIED ? 'denied' : 'error'),
            { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }, [isAdmin, batch?.id, callApi]);

    // Keep the screen awake while delivering (browsers stop GPS when locked or backgrounded).
    // Re-acquire when returning to the page — the lock is released on hide.
    useEffect(() => {
        if (!isAdmin || !batch?.id) return;
        let lock: any = null;
        const acquire = async () => {
            try { lock = await (navigator as any).wakeLock?.request('screen'); } catch { /* unsupported */ }
        };
        const onVisibility = () => { if (!document.hidden) acquire(); };
        acquire();
        document.addEventListener('visibilitychange', onVisibility);
        return () => { document.removeEventListener('visibilitychange', onVisibility); lock?.release?.().catch(() => {}); };
    }, [isAdmin, batch?.id]);

    const markDelivered = async (orderId: string) => {
        if (!batch) return;
        setBusy(orderId);
        try {
            const res = await callApi({ action: 'deliver', batchId: batch.id, orderId });
            if (res.batchCompleted) {
                alert('🎉 全部送达，本趟配送完成！');
                setBatch(null); setOrders([]);
            } else {
                setBatch(b => b ? { ...b, deliveredOrderIds: [...b.deliveredOrderIds, orderId] } : b);
                setOrders(os => os.map(o => o.id === orderId ? { ...o, status: 'delivered' } : o));
            }
        } catch (e: any) { alert(e.message || '操作失败'); }
        setBusy(null);
    };

    const completeBatch = async () => {
        if (!batch || !confirm('确定结束本趟配送？未送达的订单会保持「配送中」状态。')) return;
        try {
            await callApi({ action: 'complete', batchId: batch.id });
            setBatch(null); setOrders([]);
        } catch (e: any) { alert(e.message || '操作失败'); }
    };

    const waLink = (phone: string) => `https://wa.me/${phone.replace(/[^0-9]/g, '').replace(/^0/, '60')}`;
    const mapsLink = (addr: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;

    // ── Gates ──────────────────────────────────────────────────
    if (authLoading) {
        return <Shell><p className="text-center text-gray-400 text-sm animate-pulse py-16">登录状态检查中…</p></Shell>;
    }
    if (!currentUser || !isAdmin) {
        return (
            <Shell>
                <div className="text-center py-16 space-y-4">
                    <p className="text-3xl">🔒</p>
                    <p className="font-black text-[#1A2D23]">配送模式仅限管理员</p>
                    {!currentUser && (
                        <button
                            onClick={async () => {
                                try { const { signInWithGoogle } = await import('@/lib/auth'); await signInWithGoogle(); }
                                catch { /* user closed the popup */ }
                            }}
                            className="px-6 py-3 bg-[#1A2D23] text-white rounded-2xl text-sm font-black"
                        >
                            用 Google 登录
                        </button>
                    )}
                </div>
            </Shell>
        );
    }

    const remaining = orders.filter(o => o.status !== 'delivered');
    const done = orders.filter(o => o.status === 'delivered');

    return (
        <Shell>
            {loadingBatch ? (
                <p className="text-center text-gray-400 text-sm animate-pulse py-16">读取配送批次…</p>
            ) : !batch ? (
                <div className="text-center py-16 space-y-2">
                    <p className="text-3xl">🛵</p>
                    <p className="font-black text-[#1A2D23]">当前没有进行中的配送批次</p>
                    <p className="text-xs text-gray-400">先在 Dashboard 点「开始配送」建立批次</p>
                </div>
            ) : (
                <>
                    {/* GPS status bar */}
                    <div className={`rounded-2xl px-4 py-3 text-sm font-bold flex items-center justify-between ${
                        gpsState === 'ok' ? 'bg-green-50 text-green-700 border border-green-200'
                        : gpsState === 'denied' ? 'bg-red-50 text-red-600 border border-red-200'
                        : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                    }`}>
                        <span>
                            {gpsState === 'ok' && '📡 GPS 上报中'}
                            {gpsState === 'denied' && '⛔ 定位被拒绝 — 请在浏览器设置允许定位'}
                            {(gpsState === 'off' || gpsState === 'error') && '⏳ 正在获取定位…'}
                        </span>
                        {lastSentAt && gpsState === 'ok' && (
                            <span className="text-[10px] font-normal opacity-70">
                                {new Date(lastSentAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] text-gray-400 text-center">⚠️ 配送途中请保持本页亮屏（锁屏/切走会暂停位置上报）</p>

                    {/* Remaining stops */}
                    <p className="font-black text-[#1A2D23] pt-1">📦 待送 {remaining.length} 单</p>
                    {remaining.map(o => (
                        <div key={o.id} className="bg-white rounded-2xl border border-[#E3EADA] p-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="font-black text-[#FF6B35]">#{o.orderNo}</span>
                                <span className="text-xs font-bold text-gray-400">{o.deliveryTime?.includes('Lunch') ? '🌞午餐' : '🌙晚餐'}</span>
                            </div>
                            <p className="text-sm font-bold text-[#1A2D23]">{o.userName}</p>
                            <p className="text-sm text-gray-600">{o.items}</p>
                            {o.note && <p className="text-xs bg-yellow-50 border border-yellow-200 rounded-lg px-2 py-1 text-yellow-800">📝 {o.note}</p>}
                            <a href={mapsLink(o.userAddress)} target="_blank" rel="noopener noreferrer"
                               className="block text-sm text-blue-600 underline underline-offset-2">📍 {o.userAddress}</a>
                            <div className="flex gap-2 pt-1">
                                <a href={`tel:${o.userPhone}`} className="flex-1 py-2.5 text-center bg-gray-100 rounded-xl text-sm font-bold text-[#1A2D23]">📞 打电话</a>
                                <a href={waLink(o.userPhone)} target="_blank" rel="noopener noreferrer"
                                   className="flex-1 py-2.5 text-center bg-[#25D366]/10 text-[#1EBE57] rounded-xl text-sm font-bold">💬 WhatsApp</a>
                            </div>
                            <button
                                onClick={() => markDelivered(o.id)}
                                disabled={busy === o.id}
                                className="w-full py-3.5 bg-[#FF6B35] text-white rounded-2xl font-black disabled:opacity-50"
                            >
                                {busy === o.id ? '提交中…' : '✅ 本单已送达'}
                            </button>
                        </div>
                    ))}

                    {/* Delivered */}
                    {done.length > 0 && (
                        <>
                            <p className="font-black text-gray-400 pt-2 text-sm">✅ 已送达 {done.length} 单</p>
                            {done.map(o => (
                                <div key={o.id} className="bg-gray-50 rounded-2xl border border-gray-200 px-4 py-2.5 flex items-center justify-between opacity-60">
                                    <span className="text-sm font-bold text-gray-500">#{o.orderNo} {o.userName}</span>
                                    <span className="text-xs text-green-600 font-bold">已送达</span>
                                </div>
                            ))}
                        </>
                    )}

                    <button onClick={completeBatch} className="w-full py-3 text-sm font-bold text-gray-400 hover:text-red-500 transition-colors">
                        结束本趟配送
                    </button>
                </>
            )}
        </Shell>
    );
}

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <main className="min-h-screen bg-[#FDFBF7] px-4 py-6 flex justify-center">
            <div className="w-full max-w-md space-y-3">
                <div className="text-center">
                    <p className="text-xl font-black text-[#1A2D23]">🛵 碗妈配送模式</p>
                </div>
                {children}
            </div>
        </main>
    );
}
