"use client";

/**
 * /admin/subscriptions — 常客周计划（每周订阅引擎 · 阶段 1）
 *
 * 取代「每周为每个餐券常客手写一个 create-*-week-orders.mjs」的流程：
 *   1. 每个常客存一份订阅模板（周几吃什么、时段、加料、运费档）
 *   2. 选下周一 → 生成预览（等价脚本 dry-run：菜价现算、券余额核对、警告）
 *   3. 复制 WhatsApp 确认文字发给客户 → 客户 OK → 点「确认建单」
 *      批量落 confirmed 手动单 + FIFO 扣券（幂等，同一周同一人只能建一次）
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { User } from 'firebase/auth';
import { onAuthChange, signInWithGoogle, logout } from '@/lib/auth';
import { weeklyMenu } from '@/data/weeklyMenu';
import {
    ArrowLeft, Plus, Trash2, RefreshCw, Copy, CheckCircle, AlertTriangle,
    ChevronDown, ChevronUp, LogOut, CalendarCheck, Loader2,
} from 'lucide-react';

const ADMIN_EMAILS = ['hello@incredibowl.my', 'incredibowl.my@gmail.com'];
const WD_LABEL: Record<string, string> = { '1': '周一', '2': '周二', '3': '周三', '4': '周四', '5': '周五' };

// 可选主菜：目录里未 hidden 未 retired 的全部（含常驻）
const DISH_OPTIONS = weeklyMenu.filter(d => !d.hidden && !d.retired).map(d => d.name);

interface Customer { userId: string; name: string; phone: string; address: string; deliveryDistanceKm: number }
interface PlanItem { dishName: string; qty: number; addOns: { label: string; price: number; quantity: number }[] }
interface PlanDay { skip?: boolean; meal: 'lunch' | 'dinner'; time: string; items: PlanItem[] }
interface Sub {
    id?: string; userId: string; name: string; phone: string; address: string;
    deliveryTier: 'near' | 'mid' | 'far'; deliveryZone: 'within2km' | 'outside2km';
    deliveryDistanceKm: number; deliveryFeePerDelivery: number; active: boolean; note?: string;
    plan: Record<string, PlanDay>;
}

const EMPTY_SUB: Sub = {
    userId: '', name: '', phone: '', address: '',
    deliveryTier: 'near', deliveryZone: 'within2km', deliveryDistanceKm: 0,
    deliveryFeePerDelivery: 0, active: true, note: '', plan: {},
};

function nextMonday(): string {
    const d = new Date();
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function SubscriptionsAdmin() {
    const [user, setUser] = useState<User | null>(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [subs, setSubs] = useState<Sub[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [custQuery, setCustQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState<Sub | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [weekStart, setWeekStart] = useState(nextMonday());
    const [previews, setPreviews] = useState<any[] | null>(null);
    const [previewing, setPreviewing] = useState(false);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState('');
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email);

    const api = useCallback(async (path: string, init?: RequestInit) => {
        const token = await user!.getIdToken();
        const res = await fetch(path, {
            ...init,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
    }, [user]);

    useEffect(() => onAuthChange(u => { setUser(u); setAuthChecked(true); }), []);

    const loadSubs = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const data = await api('/api/admin/subscriptions');
            setSubs(data.subscriptions);
            setCustomers(data.customers || []);
        }
        catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    }, [api]);

    useEffect(() => { if (isAdmin) loadSubs(); }, [isAdmin, loadSubs]);

    const saveSub = async () => {
        if (!editing) return;
        setSaving(true); setError('');
        try {
            await api('/api/admin/subscriptions', { method: 'POST', body: JSON.stringify(editing) });
            setEditing(null); await loadSubs();
        } catch (e: any) { setError(e.message); }
        finally { setSaving(false); }
    };

    const deleteSub = async (id: string) => {
        if (!confirm('确定删除这个常客模板？（不影响已建订单）')) return;
        try { await api('/api/admin/subscriptions', { method: 'POST', body: JSON.stringify({ id, delete: true }) }); await loadSubs(); }
        catch (e: any) { setError(e.message); }
    };

    const runPreview = async () => {
        setPreviewing(true); setError(''); setPreviews(null);
        try { setPreviews((await api('/api/admin/subscriptions/week', { method: 'POST', body: JSON.stringify({ action: 'preview', weekStart }) })).previews); }
        catch (e: any) { setError(e.message); }
        finally { setPreviewing(false); }
    };

    const confirmWeek = async (subscriptionId: string, name: string) => {
        if (!confirm(`确认为 ${name} 建下周订单并扣券？此操作会写入正式订单。`)) return;
        setConfirmingId(subscriptionId); setError('');
        try {
            const r = await api('/api/admin/subscriptions/week', { method: 'POST', body: JSON.stringify({ action: 'confirm', weekStart, subscriptionId }) });
            alert(`✅ 已建 ${r.created.length} 单${r.skippedDays?.length ? `，跳过 ${r.skippedDays.join(', ')}` : ''}`);
            await runPreview();
        } catch (e: any) { setError(e.message); alert(`⛔ ${e.message}`); }
        finally { setConfirmingId(null); }
    };

    const copyText = (id: string, text: string) => {
        navigator.clipboard.writeText(text).then(() => { setCopiedId(id); setTimeout(() => setCopiedId(''), 2000); });
    };

    // ── 客户搜索联想（同 dashboard 查客户的体验）──
    const custMatches = (() => {
        const q = custQuery.trim().toLowerCase();
        if (!q) return [];
        const qd = q.replace(/\D/g, '');
        return customers.filter(c =>
            c.name.toLowerCase().includes(q) ||
            (qd.length >= 3 && c.phone.replace(/\D/g, '').includes(qd)),
        ).slice(0, 8);
    })();
    const fillFromCustomer = (c: Customer) => {
        setEditing(prev => {
            if (!prev) return prev;
            // 距离已知则顺带建议运费档（2.5km 内 near / 5km 内 mid / 以上 far）
            const km = c.deliveryDistanceKm;
            const tierPatch = km > 0
                ? km <= 2.5
                    ? { deliveryTier: 'near' as const, deliveryZone: 'within2km' as const }
                    : km <= 5
                        ? { deliveryTier: 'mid' as const, deliveryZone: 'outside2km' as const }
                        : { deliveryTier: 'far' as const, deliveryZone: 'outside2km' as const }
                : {};
            return {
                ...prev,
                userId: c.userId,
                name: c.name || prev.name,
                phone: c.phone || prev.phone,
                address: c.address || prev.address,
                deliveryDistanceKm: km || prev.deliveryDistanceKm,
                ...tierPatch,
            };
        });
        setCustQuery('');
    };

    // ── 编辑器的 plan 修改 helpers ──
    const setDay = (wd: string, day: PlanDay | null) => setEditing(prev => {
        if (!prev) return prev;
        const plan = { ...prev.plan };
        if (day === null) delete plan[wd]; else plan[wd] = day;
        return { ...prev, plan };
    });

    if (!authChecked) return <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]"><Loader2 className="animate-spin text-[#FF6B35]" /></div>;

    if (!isAdmin) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#FDFBF7]">
                <p className="font-bold text-[#1A2D23]">常客周计划 · 仅限管理员</p>
                {user
                    ? <button onClick={logout} className="px-5 py-2.5 bg-gray-200 rounded-xl font-bold text-sm">当前账号无权限，退出</button>
                    : <button onClick={signInWithGoogle} className="px-5 py-2.5 bg-[#FF6B35] text-white rounded-xl font-bold text-sm">Google 登录</button>}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FDFBF7] text-[#1A2D23] p-4 lg:p-8">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <Link href="/admin" className="p-2 bg-white rounded-xl border border-gray-200 hover:border-[#FF6B35]/40"><ArrowLeft size={16} /></Link>
                        <h1 className="text-xl font-black flex items-center gap-2"><CalendarCheck className="text-[#FF6B35]" size={20} /> 常客周计划</h1>
                    </div>
                    <button onClick={logout} className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-red-500"><LogOut size={13} /> 退出</button>
                </div>

                {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm font-bold text-red-600">{error}</div>}

                {/* ── 周操作条 ── */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-end gap-3 flex-wrap">
                    <div>
                        <label className="text-[11px] font-bold text-gray-400 block mb-1">下周一（weekStart）</label>
                        <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)}
                            className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold" />
                    </div>
                    <button onClick={runPreview} disabled={previewing}
                        className="px-5 py-2.5 bg-[#1A2D23] text-white rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50">
                        {previewing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} 生成下周预览
                    </button>
                    <p className="text-[11px] text-gray-400 font-bold">预览 = 脚本 dry-run：不写库。确认建单才会落单+扣券（每人每周只能建一次）。</p>
                </div>

                {/* ── 预览结果 ── */}
                {previews && previews.map(p => (
                    <div key={p.subscriptionId} className={`bg-white rounded-2xl border p-4 space-y-3 ${p.alreadyCreated ? 'border-green-300' : 'border-gray-200'}`}>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <p className="font-black">{p.name} <span className="text-xs text-gray-400 font-bold">{p.phone} · 需 {p.vouchersNeeded} 券 / 有 {p.vouchersAvailable} 券 · 现金 RM {p.cashTotal.toFixed(2)}</span></p>
                            <div className="flex items-center gap-2">
                                <button onClick={() => copyText(p.subscriptionId, p.whatsappText)}
                                    className="px-3 py-1.5 bg-[#25D366]/10 text-[#128C7E] rounded-lg text-xs font-bold flex items-center gap-1.5 border border-[#25D366]/30">
                                    {copiedId === p.subscriptionId ? <CheckCircle size={12} /> : <Copy size={12} />} 复制 WhatsApp 文字
                                </button>
                                {p.alreadyCreated
                                    ? <span className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-black flex items-center gap-1"><CheckCircle size={12} /> 本周已建单</span>
                                    : <button onClick={() => confirmWeek(p.subscriptionId, p.name)} disabled={!p.canConfirm || confirmingId === p.subscriptionId}
                                        className="px-4 py-1.5 bg-[#FF6B35] text-white rounded-lg text-xs font-black disabled:opacity-40 flex items-center gap-1.5">
                                        {confirmingId === p.subscriptionId ? <Loader2 size={12} className="animate-spin" /> : null} 确认建单 + 扣券
                                    </button>}
                            </div>
                        </div>
                        {p.warnings.length > 0 && (
                            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl space-y-0.5">
                                {p.warnings.map((w: string, i: number) => <p key={i} className="text-[11px] font-bold text-amber-700 flex items-start gap-1"><AlertTriangle size={11} className="mt-0.5 shrink-0" />{w}</p>)}
                            </div>
                        )}
                        <div className="grid gap-1.5">
                            {p.days.map((d: any) => (
                                <div key={d.date} className={`text-xs font-bold flex flex-wrap gap-x-2 items-baseline px-3 py-2 rounded-lg ${d.blocked ? 'bg-red-50 text-red-500 line-through' : 'bg-[#F5F3EF]'}`}>
                                    <span className="text-gray-400">{d.date} {WD_LABEL[String(d.weekday)]} {d.meal === 'dinner' ? '晚' : '午'} {d.time}</span>
                                    <span>{d.items.map((it: any) => `${it.name}×${it.quantity}${it.addOns.length ? `（+${it.addOns.map((a: any) => a.label).join('+')}）` : ''}`).join('、')}</span>
                                    <span className="text-[#FF6B35]">{d.vCount}券抵{d.coverage.toFixed(2)}</span>
                                    <span className="text-gray-400">现金 {d.cashDue.toFixed(2)}</span>
                                    {d.warnings.map((w: string, i: number) => <span key={i} className="text-amber-600">⚠ {w}</span>)}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {/* ── 订阅列表 ── */}
                <div className="flex items-center justify-between">
                    <h2 className="font-black text-sm text-gray-500">常客模板（{subs.length}）</h2>
                    <button onClick={() => { setCustQuery(''); setEditing({ ...EMPTY_SUB }); }} className="px-4 py-2 bg-[#FF6B35] text-white rounded-xl text-xs font-black flex items-center gap-1.5"><Plus size={13} /> 新建常客</button>
                </div>
                {loading && <Loader2 className="animate-spin text-[#FF6B35] mx-auto" />}
                {subs.map(s => (
                    <div key={s.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <button onClick={() => setExpanded(prev => ({ ...prev, [s.id!]: !prev[s.id!] }))} className="flex items-center gap-2 font-black text-sm">
                                {expanded[s.id!] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                {s.name} <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>{s.active ? 'active' : '暂停'}</span>
                                <span className="text-xs text-gray-400 font-bold">{Object.entries(s.plan).filter(([, d]) => !d.skip).length} 天/周</span>
                            </button>
                            <div className="flex gap-2">
                                <button onClick={() => { setCustQuery(''); setEditing(JSON.parse(JSON.stringify(s))); }} className="px-3 py-1.5 bg-[#1A2D23] text-white rounded-lg text-xs font-bold">编辑</button>
                                <button onClick={() => deleteSub(s.id!)} className="p-1.5 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                            </div>
                        </div>
                        {expanded[s.id!] && (
                            <div className="mt-3 text-xs font-bold text-gray-500 space-y-1">
                                <p>{s.phone} · {s.userId} · {s.deliveryTier} 运费 RM{s.deliveryFeePerDelivery}/次</p>
                                <p className="text-gray-400">{s.address}</p>
                                {(['1', '2', '3', '4', '5'] as const).map(wd => {
                                    const d = s.plan[wd];
                                    if (!d || d.skip) return null;
                                    return <p key={wd}>{WD_LABEL[wd]} {d.meal === 'dinner' ? '晚' : '午'} {d.time}：{d.items.map(it => `${it.dishName}×${it.qty}${it.addOns.length ? `（+${it.addOns.map(a => a.label).join('+')}）` : ''}`).join('、')}</p>;
                                })}
                                {s.note && <p className="text-amber-600">备注：{s.note}</p>}
                            </div>
                        )}
                    </div>
                ))}

                {/* ── 编辑弹层 ── */}
                {editing && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto p-4">
                        <div className="bg-white rounded-2xl p-5 w-full max-w-2xl space-y-4 my-8">
                            <h3 className="font-black">{editing.id ? `编辑：${editing.name}` : '新建常客模板'}</h3>

                            {/* 客户搜索自动填充 — userId 用真实 uid，和餐券归属一致 */}
                            <div className="relative">
                                <label className="text-xs font-bold text-gray-500">🔍 从现有客户填充（输姓名或电话，点选自动填 uid/姓名/电话/地址）
                                    <input value={custQuery} onChange={e => setCustQuery(e.target.value)} placeholder="例：Thang 或 0122785765"
                                        className="mt-1 w-full px-3 py-2 border-2 border-[#FF6B35]/40 rounded-xl text-sm" />
                                </label>
                                {custMatches.length > 0 && (
                                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                                        {custMatches.map(c => (
                                            <button key={c.userId} onClick={() => fillFromCustomer(c)}
                                                className="w-full text-left px-3 py-2 hover:bg-[#FF6B35]/10 border-b border-gray-100 last:border-0">
                                                <span className="text-sm font-bold">{c.name || '（无名）'}</span>
                                                <span className="text-xs text-gray-400 font-bold ml-2">{c.phone || '无电话'} · uid {c.userId.slice(0, 8)}…{c.deliveryDistanceKm ? ` · ${c.deliveryDistanceKm}km` : ''}</span>
                                                {c.address && <span className="block text-[11px] text-gray-400 truncate">{c.address}</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {custQuery.trim() && custMatches.length === 0 && (
                                    <p className="mt-1 text-[11px] font-bold text-gray-400">没匹配到客户 — 可以直接手填下方字段</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <label className="text-xs font-bold text-gray-500">姓名<input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-xl text-sm" /></label>
                                <label className="text-xs font-bold text-gray-500">电话<input value={editing.phone} onChange={e => setEditing({ ...editing, phone: e.target.value, userId: editing.userId || `manual_${e.target.value.replace(/\D/g, '')}` })} className="mt-1 w-full px-3 py-2 border rounded-xl text-sm" /></label>
                                <label className="text-xs font-bold text-gray-500 col-span-2">userId（manual_手机号 或真实 uid，须与餐券归属一致）<input value={editing.userId} onChange={e => setEditing({ ...editing, userId: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-xl text-sm font-mono" /></label>
                                <label className="text-xs font-bold text-gray-500 col-span-2">地址<input value={editing.address} onChange={e => setEditing({ ...editing, address: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-xl text-sm" /></label>
                                <label className="text-xs font-bold text-gray-500">配送档
                                    <select value={editing.deliveryTier} onChange={e => setEditing({ ...editing, deliveryTier: e.target.value as any, deliveryZone: e.target.value === 'near' ? 'within2km' : 'outside2km' })} className="mt-1 w-full px-3 py-2 border rounded-xl text-sm">
                                        <option value="near">near（邻里）</option><option value="mid">mid</option><option value="far">far</option>
                                    </select></label>
                                <label className="text-xs font-bold text-gray-500">每次运费 RM<input type="number" step="0.5" value={editing.deliveryFeePerDelivery} onChange={e => setEditing({ ...editing, deliveryFeePerDelivery: Number(e.target.value) })} className="mt-1 w-full px-3 py-2 border rounded-xl text-sm" /></label>
                                <label className="text-xs font-bold text-gray-500 col-span-2">备注<input value={editing.note || ''} onChange={e => setEditing({ ...editing, note: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-xl text-sm" /></label>
                                <label className="text-xs font-bold flex items-center gap-2"><input type="checkbox" checked={editing.active} onChange={e => setEditing({ ...editing, active: e.target.checked })} /> active（参与每周生成）</label>
                            </div>

                            {/* 每周计划 */}
                            <div className="space-y-3">
                                {(['1', '2', '3', '4', '5'] as const).map(wd => {
                                    const day = editing.plan[wd];
                                    return (
                                        <div key={wd} className="border border-gray-200 rounded-xl p-3">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <label className="text-sm font-black flex items-center gap-1.5">
                                                    <input type="checkbox" checked={!!day && !day.skip}
                                                        onChange={e => setDay(wd, e.target.checked
                                                            ? (day
                                                                ? { ...day, skip: false }
                                                                : { meal: 'lunch', time: '12:00', items: [{ dishName: DISH_OPTIONS[0], qty: 1, addOns: [] }], skip: false })
                                                            : null)} />
                                                    {WD_LABEL[wd]}
                                                </label>
                                                {day && !day.skip && (<>
                                                    <select value={day.meal} onChange={e => setDay(wd, { ...day, meal: e.target.value as any, time: e.target.value === 'dinner' ? '19:00' : '12:00' })} className="px-2 py-1 border rounded-lg text-xs font-bold">
                                                        <option value="lunch">午餐</option><option value="dinner">晚餐</option>
                                                    </select>
                                                    <input value={day.time} onChange={e => setDay(wd, { ...day, time: e.target.value })} className="w-20 px-2 py-1 border rounded-lg text-xs font-bold" />
                                                </>)}
                                            </div>
                                            {day && !day.skip && (
                                                <div className="mt-2 space-y-2">
                                                    {day.items.map((it, i) => (
                                                        <div key={i} className="flex items-center gap-2 flex-wrap">
                                                            <select value={it.dishName} onChange={e => { const items = [...day.items]; items[i] = { ...it, dishName: e.target.value }; setDay(wd, { ...day, items }); }} className="px-2 py-1 border rounded-lg text-xs font-bold flex-1 min-w-[160px]">
                                                                {!DISH_OPTIONS.includes(it.dishName) && <option value={it.dishName}>{it.dishName}（已不在目录）</option>}
                                                                {DISH_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                                                            </select>
                                                            <input type="number" min={1} value={it.qty} onChange={e => { const items = [...day.items]; items[i] = { ...it, qty: Number(e.target.value) || 1 }; setDay(wd, { ...day, items }); }} className="w-14 px-2 py-1 border rounded-lg text-xs font-bold" />
                                                            <input placeholder="加料标签（如 蒜蓉西兰花炒蛋）" value={it.addOns[0]?.label ?? ''} onChange={e => { const items = [...day.items]; const label = e.target.value; items[i] = { ...it, addOns: label ? [{ label, price: it.addOns[0]?.price ?? 0, quantity: it.addOns[0]?.quantity ?? 1 }] : [] }; setDay(wd, { ...day, items }); }} className="px-2 py-1 border rounded-lg text-xs flex-1 min-w-[140px]" />
                                                            {it.addOns.length > 0 && <input type="number" step="0.1" placeholder="加料价" value={it.addOns[0].price} onChange={e => { const items = [...day.items]; items[i] = { ...it, addOns: [{ ...it.addOns[0], price: Number(e.target.value) || 0 }] }; setDay(wd, { ...day, items }); }} className="w-20 px-2 py-1 border rounded-lg text-xs" />}
                                                            <button onClick={() => { const items = day.items.filter((_, x) => x !== i); setDay(wd, { ...day, items }); }} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                                                        </div>
                                                    ))}
                                                    <button onClick={() => setDay(wd, { ...day, items: [...day.items, { dishName: DISH_OPTIONS[0], qty: 1, addOns: [] }] })} className="text-[11px] font-bold text-[#FF6B35]">+ 加一道主菜</button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={() => setEditing(null)} className="px-4 py-2 bg-gray-100 rounded-xl text-sm font-bold">取消</button>
                                <button onClick={saveSub} disabled={saving} className="px-5 py-2 bg-[#FF6B35] text-white rounded-xl text-sm font-black disabled:opacity-50 flex items-center gap-1.5">
                                    {saving && <Loader2 size={13} className="animate-spin" />} 保存
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
