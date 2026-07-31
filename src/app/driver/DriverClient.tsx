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
    /** 配送顺序（1 起）—— 服务端按 batch.orderIds 排好的 */
    seq: number;
    lat: number | null;
    lng: number | null;
}

interface BatchMeta {
    id: string;
    deliveredOrderIds: string[];
    routeSource?: string;
    routeTotalKm?: number | null;
    routeTotalMinutes?: number | null;
}

// 厨房坐标（与 deliveryUtils.PEARL_POINT_* 同源）。这里硬写是为了不把
// 整个 deliveryUtils 拖进客户端 bundle —— 只要两个数字。
const KITCHEN = '3.0853475861917716,101.67428154483449';
// 每段最多几个中途点。取 3 是因为 Google 两份官方文档口径打架：
//   · 帮助中心（iOS/Android/桌面同文）：「最多 9 个停靠点，含终点」→ 中途点 ≤ 8
//   · URLs API：「移动浏览器最多 3 个 waypoints，其余场景最多 9 个」
// 而「Safari 点 universal link 交接给 App」算不算 mobile browser，官方从未定义。
// 2026-07-31 老板实测 9 个中途点时 Maps 卡在路线编辑器点不动 —— 官方对超限后的
// 行为零字说明，所以这里直接取最严的 3，同时躲开两种口径。
const MAX_WAYPOINTS_PER_LEG = 3;

export default function DriverClient() {
    const { currentUser, authLoading } = useAuth();
    const [batch, setBatch] = useState<BatchMeta | null>(null);
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
        const report = (pos: GeolocationPosition) => {
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
        };
        const fail = (err: GeolocationPositionError) =>
            setGpsState(err.code === err.PERMISSION_DENIED ? 'denied' : 'error');
        const watchId = navigator.geolocation.watchPosition(report, fail,
            { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 });
        // 后台期间浏览器会挂起 GPS（跳去 Google Maps 导航/WhatsApp 就会发生）——
        // 一切回本页立刻强制补报一次，不等下一次 watch 回调
        const onVisibility = () => {
            if (document.hidden) return;
            lastReportRef.current = 0;
            navigator.geolocation.getCurrentPosition(report, fail,
                { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 });
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            navigator.geolocation.clearWatch(watchId);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [isAdmin, batch?.id, callApi]);

    // 心跳 re-render：让「多久没成功上报」的黄条能自己出现/消失
    const [nowTs, setNowTs] = useState(() => Date.now());
    const batchLoadedAtRef = useRef(0);
    useEffect(() => {
        if (!batch?.id) return;
        batchLoadedAtRef.current = Date.now();
        const t = setInterval(() => setNowTs(Date.now()), 5_000);
        return () => clearInterval(t);
    }, [batch?.id]);
    // 「上报中断」不看 gpsState（上报 POST 失败时它仍是 ok）——只认上次成功时间
    const gpsSilentMs = nowTs - (lastSentAt ?? batchLoadedAtRef.current);
    const gpsStale = !!batch?.id && gpsState !== 'denied' && gpsSilentMs > 60_000;

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

    /**
     * 单点导航 —— 这是最可靠的一条路：没有 waypoints 就没有上限之争，
     * 四个参数全在官方 Maps URLs 文档里。
     *
     * dir_action=navigate 官方原文：不指定 origin（起点默认取设备当前位置）时
     * 「the map launches turn-by-turn navigation」→ 点一下直接开始导航，
     * 比原来「点开 → 出预览 → 再点 Start」少一步。
     * 所以这里**故意不传 origin**，传了反而会被官方降级成路线预览。
     *
     * 有坐标就用坐标（geocode 验证过，比自由文本准）；没有才退回地址文本。
     */
    const mapsLink = (o: BatchOrder) => {
        const dest = o.lat !== null && o.lng !== null
            ? `${o.lat},${o.lng}`
            : o.userAddress;
        return 'https://www.google.com/maps/dir/?'
            + new URLSearchParams({
                api: '1',
                travelmode: 'driving',
                dir_action: 'navigate',
                destination: dest,
            }).toString();
    };

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
    const unlocatedCount = remaining.filter(o => o.lat === null).length;

    // ── 一键全程导航（辅助路径）────────────────────────────────
    // 把「还没送的、有坐标的」单按顺序串成 Google Maps 路线链接。
    // 第一段不给 origin → Google Maps 自动用当前位置（送到一半才点也对）；
    // 后续段的起点 = 上一段的终点。
    //
    // ⚠️ 这里**故意不加 dir_action=navigate**：多 waypoints + navigate 的组合
    // 官方零文档零示例，且社区有「Google maps can't open this link」的报告。
    // 这条只到路线预览，要手点 Start —— 但至少出得来路线。
    // 要一键起航请用每单卡片里的单点导航（那条才有官方背书）。
    const navPoints = remaining.filter(o => o.lat !== null && o.lng !== null);
    const navLegs: { url: string; from: number; to: number }[] = [];
    for (let i = 0; i < navPoints.length; i += MAX_WAYPOINTS_PER_LEG + 1) {
        const chunk = navPoints.slice(i, i + MAX_WAYPOINTS_PER_LEG + 1);
        if (chunk.length === 0) break;
        const coord = (o: BatchOrder) => `${o.lat},${o.lng}`;
        const params = new URLSearchParams({ api: '1', travelmode: 'driving' });
        // 第一段交给 Google 用当前位置；后面几段从上一段最后一站接上
        if (i > 0) params.set('origin', coord(navPoints[i - 1]));
        params.set('destination', coord(chunk[chunk.length - 1]));
        const mid = chunk.slice(0, -1);
        if (mid.length > 0) params.set('waypoints', mid.map(coord).join('|'));
        navLegs.push({
            url: `https://www.google.com/maps/dir/?${params.toString()}`,
            from: chunk[0].seq,
            to: chunk[chunk.length - 1].seq,
        });
    }

    const routeLabel = batch?.routeSource === 'google' ? '🚦 已按实时路况排序'
        : batch?.routeSource === 'google-notraffic' ? '🗺️ 已按路网排序'
        : batch?.routeSource === 'local' ? '📐 已按直线距离排序'
        : '⚠️ 未自动排序（按勾选顺序）';

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
                    {/* GPS status bar — 黄条只认「上次成功上报」，POST 静默失败也会变黄 */}
                    <div className={`rounded-2xl px-4 py-3 text-sm font-bold flex items-center justify-between ${
                        gpsState === 'denied' ? 'bg-red-50 text-red-600 border border-red-200'
                        : gpsStale ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                        : gpsState === 'ok' ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                    }`}>
                        <span>
                            {gpsState === 'denied' && '⛔ 定位被拒绝 — 请在浏览器设置允许定位'}
                            {gpsState !== 'denied' && gpsStale && `⚠️ 位置已 ${Math.floor(gpsSilentMs / 60_000)} 分钟没上报 — 请留在本页`}
                            {gpsState === 'ok' && !gpsStale && '📡 GPS 上报中'}
                            {(gpsState === 'off' || gpsState === 'error') && !gpsStale && '⏳ 正在获取定位…'}
                        </span>
                        {lastSentAt && (
                            <span className="text-[10px] font-normal opacity-70">
                                {new Date(lastSentAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] text-gray-400 text-center">⚠️ 配送途中请保持本页亮屏（锁屏/切走会暂停位置上报）</p>

                    {/* ── 路线摘要 + 一键全程导航 ────────────────── */}
                    <div className="bg-white rounded-2xl border border-[#E3EADA] p-4 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-black text-[#1A2D23]">{routeLabel}</span>
                            {(batch.routeTotalKm != null || batch.routeTotalMinutes != null) && (
                                <span className="text-xs font-bold text-gray-400 whitespace-nowrap">
                                    {batch.routeTotalKm != null && `${batch.routeTotalKm} km`}
                                    {batch.routeTotalKm != null && batch.routeTotalMinutes != null && ' · '}
                                    {batch.routeTotalMinutes != null && `约 ${batch.routeTotalMinutes} 分钟`}
                                </span>
                            )}
                        </div>
                        {navLegs.length === 0 ? (
                            <p className="text-xs text-gray-400">没有可导航的坐标 — 请用每单的「🧭 导航去这一单」</p>
                        ) : navLegs.map((leg, i) => (
                            <a key={i} href={leg.url} target="_blank" rel="noopener noreferrer"
                               className="block w-full py-2.5 text-center bg-white border-2 border-[#1A2D23] text-[#1A2D23] rounded-2xl font-bold text-sm">
                                🗺️ {navLegs.length === 1 ? '整段路线预览' : `第 ${i + 1} 段路线预览`}
                                <span className="font-normal opacity-60"> · 第 {leg.from}–{leg.to} 站</span>
                            </a>
                        ))}
                        {navLegs.length > 0 && (
                            <p className="text-[10px] text-gray-400 leading-relaxed">
                                多点路线只到预览、还要手点 Start，且 Google 对停靠点数量有上限（已按 {MAX_WAYPOINTS_PER_LEG} 个一段拆开）。
                                <br />送单请优先用每单的「🧭 导航去这一单」—— 点一下直接开始导航。
                            </p>
                        )}
                        {unlocatedCount > 0 && (
                            <p className="text-xs bg-yellow-50 border border-yellow-200 rounded-lg px-2 py-1.5 text-yellow-800">
                                ⚠️ 有 {unlocatedCount} 单定位不到（地址太模糊），已排到队尾没进自动路线 — 请自己判断什么时候顺路送
                            </p>
                        )}
                    </div>

                    {/* Remaining stops */}
                    <p className="font-black text-[#1A2D23] pt-1">📦 待送 {remaining.length} 单</p>
                    {remaining.map(o => (
                        <div key={o.id} className="bg-white rounded-2xl border border-[#E3EADA] p-4 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="shrink-0 w-7 h-7 rounded-full bg-[#1A2D23] text-white text-sm font-black flex items-center justify-center">
                                        {o.seq}
                                    </span>
                                    <span className="font-black text-[#FF6B35]">#{o.orderNo}</span>
                                </div>
                                <span className="text-xs font-bold text-gray-400 whitespace-nowrap">{o.deliveryTime?.includes('Lunch') ? '🌞午餐' : '🌙晚餐'}</span>
                            </div>
                            <p className="text-sm font-bold text-[#1A2D23]">{o.userName}</p>
                            <p className="text-sm text-gray-600">{o.items}</p>
                            {o.note && <p className="text-xs bg-yellow-50 border border-yellow-200 rounded-lg px-2 py-1 text-yellow-800">📝 {o.note}</p>}
                            <p className="text-sm text-gray-600">📍 {o.userAddress}</p>
                            {o.lat === null && (
                                <p className="text-xs bg-yellow-50 border border-yellow-200 rounded-lg px-2 py-1 text-yellow-800">
                                    ⚠️ 这单定位不到，不在自动路线里 — 请自己安排顺序
                                </p>
                            )}
                            {/* 单点导航是最可靠的一条路（官方 dir_action=navigate，点一下直接起航），
                                所以给它一个正经按钮，别再藏在地址的下划线里 */}
                            <a href={mapsLink(o)} target="_blank" rel="noopener noreferrer"
                               className="block w-full py-3 text-center bg-[#1A2D23] text-white rounded-2xl text-sm font-black">
                                🧭 导航去这一单
                            </a>
                            <div className="flex gap-2">
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
                                    <span className="text-sm font-bold text-gray-500">{o.seq}. #{o.orderNo} {o.userName}</span>
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
