"use client";

/**
 * /admin/multi-day — 多日手动单（不扣券，正常收钱）
 *
 * /admin/subscriptions 管「每周固定模板 + 扣餐券」的常客；这里管临时需求：
 * 客户 WhatsApp 说「帮我排这几天的饭」→ 搜客户自动填充 → 逐天加日期/菜/加料
 * → 生成预览（服务端现价重算 + 警告）→ 复制 WhatsApp 确认文字 → 确认建单，
 * 每天落一张 confirmed 手动单，现金/QR 全额收款，完全不碰餐券。
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { User } from 'firebase/auth';
import { onAuthChange, signInWithGoogle, logout } from '@/lib/auth';
import { DISH_ADDONS_BY_NAME, DEFAULT_ADDON_OPTIONS } from '@/data/dishAddonMap.generated';
import DishPicker, { defaultDishForWeekday } from '@/components/admin/DishPicker';
import {
    ArrowLeft, Plus, Trash2, RefreshCw, Copy, CheckCircle, AlertTriangle,
    LogOut, CalendarDays, Loader2, CalendarCheck,
} from 'lucide-react';

const ADMIN_EMAILS = ['hello@incredibowl.my', 'incredibowl.my@gmail.com'];
const WD_CN = ['日', '一', '二', '三', '四', '五', '六'];

// 可选主菜：目录里未 hidden 未 retired 的全部（含常驻）

interface OrderOption { address: string; fee: number; zone: '' | 'within2km' | 'outside2km'; distanceKm: number; note: string; lastDate: string }
interface Customer { userId: string; name: string; phone: string; address: string; deliveryDistanceKm: number; orderOptions?: OrderOption[] }
interface PlanItem { dishName: string; qty: number; addOns: { label: string; price: number; quantity: number }[] }
interface DayEntry { date: string; meal: 'lunch' | 'dinner'; time: string; items: PlanItem[] }
type PaymentMethod = 'cash' | 'qr' | 'fpx' | 'card' | 'ewallet';
// 与 dashboard 手动录单同一套值，报表按这些值分桶
const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
    { value: 'qr', label: 'QR / DuitNow' },
    { value: 'cash', label: '现金' },
    { value: 'fpx', label: 'FPX 转账' },
    { value: 'card', label: '信用卡' },
    { value: 'ewallet', label: 'E-wallet' },
];

interface Form {
    userId: string; name: string; phone: string; address: string;
    deliveryTier: 'near' | 'mid' | 'far'; deliveryZone: 'within2km' | 'outside2km';
    deliveryDistanceKm: number; deliveryFeePerDelivery: number; note: string;
    paymentMethod: PaymentMethod;
    days: DayEntry[];
}

function ymd(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function tomorrow(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return ymd(d);
}
function addDays(dateStr: string, n: number): string {
    const d = new Date(`${dateStr}T00:00:00`);
    d.setDate(d.getDate() + n);
    return ymd(d);
}
/** 日期串 → weekday（1–5 才有排期意义；周末/格式非法回 undefined）。 */
function weekdayOf(date: string): number | undefined {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
    const wd = new Date(`${date}T00:00:00`).getDay();
    return wd >= 1 && wd <= 5 ? wd : undefined;
}
function newDay(date: string): DayEntry {
    // 默认填那天的主打菜；菜品下拉也按那天置顶（见 DishPicker weekday）
    return { date, meal: 'lunch', time: '12:00', items: [{ dishName: defaultDishForWeekday(weekdayOf(date)), qty: 1, addOns: [] }] };
}

const EMPTY_FORM: Form = {
    userId: '', name: '', phone: '', address: '',
    deliveryTier: 'near', deliveryZone: 'within2km', deliveryDistanceKm: 0,
    deliveryFeePerDelivery: 0, note: '', paymentMethod: 'qr', days: [newDay(tomorrow())],
};

export default function MultiDayAdmin() {
    const [user, setUser] = useState<User | null>(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [custQuery, setCustQuery] = useState('');
    const [custPicked, setCustPicked] = useState<Customer | null>(null);
    const [form, setForm] = useState<Form>(EMPTY_FORM);
    const [error, setError] = useState('');
    const [preview, setPreview] = useState<any | null>(null);
    const [previewing, setPreviewing] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [copied, setCopied] = useState(false);
    const [createdMsg, setCreatedMsg] = useState('');

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

    // 客户名录复用 subscriptions 的 GET（users + 历史订单聚合），不另开一条 API
    useEffect(() => {
        if (!isAdmin) return;
        api('/api/admin/subscriptions')
            .then(data => setCustomers(data.customers || []))
            .catch((e: any) => setError(e.message));
    }, [isAdmin, api]);

    const payload = () => ({
        customer: {
            userId: form.userId, name: form.name, phone: form.phone, address: form.address,
            deliveryTier: form.deliveryTier, deliveryZone: form.deliveryZone,
            deliveryDistanceKm: form.deliveryDistanceKm, deliveryFeePerDelivery: form.deliveryFeePerDelivery,
            note: form.note,
        },
        paymentMethod: form.paymentMethod,
        days: form.days,
    });

    const runPreview = async () => {
        setPreviewing(true); setError(''); setPreview(null); setCreatedMsg('');
        try { setPreview(await api('/api/admin/multi-day-orders', { method: 'POST', body: JSON.stringify({ action: 'preview', ...payload() }) })); }
        catch (e: any) { setError(e.message); }
        finally { setPreviewing(false); }
    };

    const confirmCreate = async () => {
        if (!preview) return;
        if (!confirm(`确认为 ${preview.name} 建 ${preview.days.filter((d: any) => !d.blocked).length} 张正常订单（不扣券，现金合计 RM ${preview.cashTotal.toFixed(2)}）？`)) return;
        setConfirming(true); setError('');
        try {
            const r = await api('/api/admin/multi-day-orders', { method: 'POST', body: JSON.stringify({ action: 'confirm', batchTag: preview.batchTag, ...payload() }) });
            setCreatedMsg(`✅ 已为 ${preview.name} 建 ${r.created.length} 单，现金合计 RM ${r.cashTotal.toFixed(2)}${r.skippedDays?.length ? `，跳过 ${r.skippedDays.join(', ')}` : ''}`);
            setPreview(null);
        } catch (e: any) { setError(e.message); alert(`⛔ ${e.message}`); }
        finally { setConfirming(false); }
    };

    const copyText = (text: string) => {
        navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    };

    // ── 客户搜索联想（同 subscriptions 的体验）──
    const custMatches = (() => {
        const q = custQuery.trim().toLowerCase();
        if (!q) return [];
        const qd = q.replace(/\D/g, '');
        return customers.filter(c =>
            c.name.toLowerCase().includes(q) ||
            (qd.length >= 3 && c.phone.replace(/\D/g, '').includes(qd)),
        ).slice(0, 8);
    })();
    const applyOrderOption = (o: OrderOption) => setForm(prev => {
        const zone = o.zone || prev.deliveryZone;
        const km = o.distanceKm || prev.deliveryDistanceKm;
        const tier = zone === 'within2km' ? 'near' as const : (km > 5 ? 'far' as const : 'mid' as const);
        return {
            ...prev,
            address: o.address,
            deliveryZone: zone,
            deliveryTier: tier,
            deliveryDistanceKm: km,
            deliveryFeePerDelivery: o.fee,
            note: o.note || prev.note,
        };
    });
    const fillFromCustomer = (c: Customer) => {
        setForm(prev => {
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
        if (c.orderOptions?.[0]) applyOrderOption(c.orderOptions[0]);
        setCustPicked(c);
        setCustQuery('');
    };

    // ── 天编辑 helpers ──
    const setDay = (idx: number, day: DayEntry | null) => setForm(prev => {
        const days = [...prev.days];
        if (day === null) days.splice(idx, 1); else days[idx] = day;
        return { ...prev, days };
    });
    const addDay = () => setForm(prev => {
        const last = prev.days[prev.days.length - 1];
        // 新一天默认 = 上一天的吃法顺延一天（连着排几天多半吃法接近，微调就好）
        const next: DayEntry = last
            ? { ...JSON.parse(JSON.stringify(last)), date: addDays(last.date, 1) }
            : newDay(tomorrow());
        return { ...prev, days: [...prev.days, next] };
    });

    if (!authChecked) return <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]"><Loader2 className="animate-spin text-[#FF6B35]" /></div>;

    if (!isAdmin) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#FDFBF7]">
                <p className="font-bold text-[#1A2D23]">多日手动单 · 仅限管理员</p>
                {user
                    ? <button onClick={logout} className="px-5 py-2.5 bg-gray-200 rounded-xl font-bold text-sm">当前账号无权限，退出</button>
                    : <button onClick={signInWithGoogle} className="px-5 py-2.5 bg-[#FF6B35] text-white rounded-xl font-bold text-sm">Google 登录</button>}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FDFBF7] text-[#1A2D23] p-4 lg:p-8">
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <Link href="/admin" className="p-2 bg-white rounded-xl border border-gray-200 hover:border-[#FF6B35]/40"><ArrowLeft size={16} /></Link>
                        <h1 className="text-xl font-black flex items-center gap-2"><CalendarDays className="text-[#FF6B35]" size={20} /> 多日手动单 <span className="text-xs font-bold text-gray-400">不扣券 · 正常收钱</span></h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/admin/subscriptions" className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-[#FF6B35]"><CalendarCheck size={13} /> 常客周计划</Link>
                        <button onClick={logout} className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-red-500"><LogOut size={13} /> 退出</button>
                    </div>
                </div>

                {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm font-bold text-red-600">{error}</div>}
                {createdMsg && <div className="p-3 bg-green-50 border border-green-300 rounded-xl text-sm font-bold text-green-700">{createdMsg}</div>}

                {/* ── 客户 + 配送 ── */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
                    <div className="relative">
                        <label className="text-xs font-bold text-gray-500">🔍 从现有客户填充（输姓名或电话，点选自动填姓名/电话/地址/运费）
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

                    {/* 该客户历史订单用过的地址/运费/备注 — 最近一单已自动填入，点选可换 */}
                    {custPicked && (custPicked.orderOptions?.length ?? 0) > 0 && (
                        <div className="space-y-1.5">
                            <p className="text-[11px] font-bold text-gray-400">📦 {custPicked.name || custPicked.phone} 之前订单用过的地址/运费/备注（已自动填最近一单，点选可换）</p>
                            {custPicked.orderOptions!.map((o, i) => {
                                const selected = form.address === o.address && form.deliveryFeePerDelivery === o.fee;
                                return (
                                    <button key={i} onClick={() => applyOrderOption(o)}
                                        className={`w-full text-left px-3 py-2 border rounded-xl ${selected ? 'border-[#FF6B35] bg-[#FF6B35]/5' : 'border-gray-200 hover:border-[#FF6B35]/40'}`}>
                                        <span className="text-xs font-bold">{o.address}</span>
                                        <span className="block text-[11px] text-gray-400 font-bold">
                                            运费 RM{o.fee.toFixed(2)}
                                            {o.zone ? ` · ${o.zone === 'outside2km' ? '2km 外' : '2km 内'}` : ''}
                                            {o.distanceKm ? ` · ${o.distanceKm}km` : ''}
                                            {o.lastDate ? ` · 最近 ${o.lastDate}` : ''}
                                        </span>
                                        {o.note && <span className="block text-[11px] text-amber-600 font-bold">备注：{o.note}</span>}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <label className="text-xs font-bold text-gray-500">姓名<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-xl text-sm" /></label>
                        <label className="text-xs font-bold text-gray-500">电话<input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-xl text-sm" /></label>
                        <label className="text-xs font-bold text-gray-500 col-span-2">地址<input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-xl text-sm" /></label>
                        <label className="text-xs font-bold text-gray-500">配送档
                            <select value={form.deliveryTier} onChange={e => setForm({ ...form, deliveryTier: e.target.value as any, deliveryZone: e.target.value === 'near' ? 'within2km' : 'outside2km' })} className="mt-1 w-full px-3 py-2 border rounded-xl text-sm">
                                <option value="near">near（邻里）</option><option value="mid">mid</option><option value="far">far</option>
                            </select></label>
                        <label className="text-xs font-bold text-gray-500">每次运费 RM<input type="number" step="0.5" value={form.deliveryFeePerDelivery} onChange={e => setForm({ ...form, deliveryFeePerDelivery: Number(e.target.value) })} className="mt-1 w-full px-3 py-2 border rounded-xl text-sm" /></label>
                        <label className="text-xs font-bold text-gray-500">收款方式
                            <select value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value as PaymentMethod })} className="mt-1 w-full px-3 py-2 border rounded-xl text-sm">
                                {PAYMENT_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                            </select></label>
                        <label className="text-xs font-bold text-gray-500">备注（会写进每张订单）<input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-xl text-sm" /></label>
                    </div>
                </div>

                {/* ── 天列表 ── */}
                <div className="space-y-3">
                    {form.days.map((day, idx) => (
                        <div key={idx} className="bg-white border border-gray-200 rounded-xl p-3">
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-sm font-black">第 {idx + 1} 天</span>
                                <input type="date" value={day.date} onChange={e => setDay(idx, { ...day, date: e.target.value })} className="px-2 py-1 border rounded-lg text-xs font-bold" />
                                {/^\d{4}-\d{2}-\d{2}$/.test(day.date) && <span className="text-xs font-bold text-gray-400">周{WD_CN[new Date(`${day.date}T00:00:00`).getDay()]}</span>}
                                <select value={day.meal} onChange={e => setDay(idx, { ...day, meal: e.target.value as any, time: e.target.value === 'dinner' ? '19:00' : '12:00' })} className="px-2 py-1 border rounded-lg text-xs font-bold">
                                    <option value="lunch">午餐</option><option value="dinner">晚餐</option>
                                </select>
                                <input value={day.time} onChange={e => setDay(idx, { ...day, time: e.target.value })} className="w-20 px-2 py-1 border rounded-lg text-xs font-bold" />
                                {form.days.length > 1 && <button onClick={() => setDay(idx, null)} className="ml-auto text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>}
                            </div>
                            <div className="mt-2 space-y-2">
                                {day.items.map((it, i) => {
                                    const addonOptions = DISH_ADDONS_BY_NAME[it.dishName] ?? DEFAULT_ADDON_OPTIONS;
                                    const setItem = (patch: Partial<PlanItem>) => { const items = [...day.items]; items[i] = { ...it, ...patch }; setDay(idx, { ...day, items }); };
                                    return (
                                        <div key={i} className="space-y-1.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <DishPicker value={it.dishName} onChange={name => setItem({ dishName: name })} weekday={weekdayOf(day.date)} />
                                                <input type="number" min={1} value={it.qty} onChange={e => setItem({ qty: Number(e.target.value) || 1 })} className="w-14 px-2 py-1 border rounded-lg text-xs font-bold" />
                                                {/* 加料选择 — 与 dashboard 手动录单同一张表（gen-dish-addon-map 生成） */}
                                                <select value="" onChange={e => {
                                                    const opt = addonOptions.find(o => o.id === e.target.value);
                                                    if (!opt) return;
                                                    const exist = it.addOns.findIndex(a => a.label === opt.label);
                                                    const addOns = [...it.addOns];
                                                    if (exist >= 0) addOns[exist] = { ...addOns[exist], quantity: addOns[exist].quantity + 1 };
                                                    else addOns.push({ label: opt.label, price: opt.price, quantity: 1 });
                                                    setItem({ addOns });
                                                }} className="px-2 py-1 border rounded-lg text-xs text-[#FF6B35] font-bold min-w-[120px]">
                                                    <option value="">＋ 加料…</option>
                                                    {addonOptions.map(o => <option key={o.id} value={o.id}>{o.label} · RM {o.price.toFixed(2)}</option>)}
                                                </select>
                                                <button onClick={() => { const items = day.items.filter((_, x) => x !== i); setDay(idx, { ...day, items }); }} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                                            </div>
                                            {it.addOns.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 pl-1">
                                                    {it.addOns.map((a, ai) => (
                                                        <span key={ai} className="inline-flex items-center gap-1 px-2 py-1 bg-[#FF6B35]/10 border border-[#FF6B35]/30 rounded-lg text-[11px] font-bold">
                                                            ＋{a.label} <span className="text-gray-400">RM {a.price.toFixed(2)}</span>
                                                            <input type="number" min={1} value={a.quantity} onChange={e => {
                                                                const addOns = [...it.addOns];
                                                                addOns[ai] = { ...a, quantity: Math.max(1, Number(e.target.value) || 1) };
                                                                setItem({ addOns });
                                                            }} className="w-11 px-1 py-0.5 border rounded text-[11px] text-center" />
                                                            <button onClick={() => setItem({ addOns: it.addOns.filter((_, x) => x !== ai) })} className="text-gray-400 hover:text-red-500 font-black">×</button>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                <button onClick={() => setDay(idx, { ...day, items: [...day.items, { dishName: defaultDishForWeekday(weekdayOf(day.date)), qty: 1, addOns: [] }] })} className="text-[11px] font-bold text-[#FF6B35]">+ 加一道主菜</button>
                            </div>
                        </div>
                    ))}
                    <button onClick={addDay} className="w-full py-2.5 border-2 border-dashed border-[#FF6B35]/40 rounded-xl text-sm font-black text-[#FF6B35] flex items-center justify-center gap-1.5 hover:bg-[#FF6B35]/5">
                        <Plus size={14} /> 加一天（照抄上一天再改）
                    </button>
                </div>

                {/* ── 预览操作 ── */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3 flex-wrap">
                    <button onClick={runPreview} disabled={previewing}
                        className="px-5 py-2.5 bg-[#1A2D23] text-white rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50">
                        {previewing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} 生成预览
                    </button>
                    <p className="text-[11px] text-gray-400 font-bold">预览 = dry-run：不写库、服务端现价重算。确认建单才会落 confirmed 手动单（不扣券）。</p>
                </div>

                {/* ── 预览结果 ── */}
                {preview && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <p className="font-black">{preview.name} <span className="text-xs text-gray-400 font-bold">{preview.phone} · {preview.days.filter((d: any) => !d.blocked).length} 天 · 现金合计 RM {preview.cashTotal.toFixed(2)}</span></p>
                            <div className="flex items-center gap-2">
                                <button onClick={() => copyText(preview.whatsappText)}
                                    className="px-3 py-1.5 bg-[#25D366]/10 text-[#128C7E] rounded-lg text-xs font-bold flex items-center gap-1.5 border border-[#25D366]/30">
                                    {copied ? <CheckCircle size={12} /> : <Copy size={12} />} 复制 WhatsApp 文字
                                </button>
                                <button onClick={confirmCreate} disabled={!preview.canConfirm || confirming}
                                    className="px-4 py-1.5 bg-[#FF6B35] text-white rounded-lg text-xs font-black disabled:opacity-40 flex items-center gap-1.5">
                                    {confirming ? <Loader2 size={12} className="animate-spin" /> : null} 确认建单（不扣券）
                                </button>
                            </div>
                        </div>
                        <div className="grid gap-1.5">
                            {preview.days.map((d: any, i: number) => (
                                <div key={i} className={`text-xs font-bold flex flex-wrap gap-x-2 items-baseline px-3 py-2 rounded-lg ${d.blocked ? 'bg-red-50 text-red-500 line-through' : 'bg-[#F5F3EF]'}`}>
                                    <span className="text-gray-400">{d.date} 周{WD_CN[d.weekday]} {d.meal === 'dinner' ? '晚' : '午'} {d.time}</span>
                                    <span>{d.items.map((it: any) => `${it.name}×${it.quantity}${it.addOns.length ? `（+${it.addOns.map((a: any) => a.label).join('+')}）` : ''}`).join('、')}</span>
                                    <span className="text-[#FF6B35]">RM {d.cashDue.toFixed(2)}</span>
                                    {d.warnings.map((w: string, wi: number) => <span key={wi} className="text-amber-600">⚠ {w}</span>)}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
