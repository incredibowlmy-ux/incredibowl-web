"use client";

import React, { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import type { AppUser } from '@/types';

interface EditCustomerModalProps {
    user: AppUser;
    token: string;
    onClose: () => void;
    onSaved: () => void;
}

type NumMode = 'set' | 'delta';

interface NumFieldState {
    mode: NumMode;
    setValue: string;   // value when mode === 'set'
    deltaValue: string; // value when mode === 'delta' (e.g. "+10" or "-5")
}

function initNumState(currentValue: number): NumFieldState {
    return {
        mode: 'set',
        setValue: String(currentValue || 0),
        deltaValue: '',
    };
}

function resolveNumValue(state: NumFieldState, currentValue: number): { value: number; changed: boolean; error?: string } {
    if (state.mode === 'set') {
        const trimmed = state.setValue.trim();
        if (trimmed === '') return { value: currentValue, changed: false };
        const n = Number(trimmed);
        if (Number.isNaN(n)) return { value: currentValue, changed: false, error: '不是合法数字' };
        if (n < 0) return { value: currentValue, changed: false, error: '不能为负数' };
        return { value: n, changed: n !== currentValue };
    } else {
        const trimmed = state.deltaValue.trim();
        if (trimmed === '' || trimmed === '+' || trimmed === '-') return { value: currentValue, changed: false };
        const n = Number(trimmed);
        if (Number.isNaN(n)) return { value: currentValue, changed: false, error: '不是合法数字（用 +10 或 -5）' };
        const next = currentValue + n;
        if (next < 0) return { value: currentValue, changed: false, error: '调整后不能为负数' };
        return { value: next, changed: n !== 0 };
    }
}

export default function EditCustomerModal({ user, token, onClose, onSaved }: EditCustomerModalProps) {
    const [displayName, setDisplayName] = useState(user.displayName || '');
    const [phone, setPhone] = useState(user.phone || '');
    const [address, setAddress] = useState(user.address || '');
    const [pointsState, setPointsState] = useState<NumFieldState>(initNumState(user.points || 0));
    const [spentState, setSpentState] = useState<NumFieldState>(initNumState(user.totalSpent || 0));
    const [ordersState, setOrdersState] = useState<NumFieldState>(initNumState(user.totalOrders || 0));
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const pointsResolved = resolveNumValue(pointsState, user.points || 0);
    const spentResolved = resolveNumValue(spentState, user.totalSpent || 0);
    const ordersResolved = resolveNumValue(ordersState, user.totalOrders || 0);

    const numErrors = [pointsResolved.error, spentResolved.error, ordersResolved.error].filter(Boolean);
    const hasNumError = numErrors.length > 0;

    const handleSave = async () => {
        setError('');
        if (!reason.trim()) { setError('请填写变更原因（用于审计）'); return; }
        if (hasNumError) { setError(numErrors.join(' / ')); return; }

        const updates: Record<string, unknown> = {};
        const trimDN = displayName.trim();
        const trimPh = phone.trim();
        const trimAd = address.trim();
        if (trimDN !== (user.displayName || '')) updates.displayName = trimDN;
        if (trimPh !== (user.phone || '')) updates.phone = trimPh;
        if (trimAd !== (user.address || '')) updates.address = trimAd;
        if (pointsResolved.changed) updates.points = pointsResolved.value;
        if (spentResolved.changed) updates.totalSpent = spentResolved.value;
        if (ordersResolved.changed) updates.totalOrders = ordersResolved.value;

        if (Object.keys(updates).length === 0) {
            setError('没有任何变更');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/admin/update-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ uid: user.id, updates, reason: reason.trim() }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || '更新失败');
                setSaving(false);
                return;
            }
            onSaved();
        } catch (e) {
            setError(e instanceof Error ? e.message : '网络错误');
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-2xl">
                    <div>
                        <h2 className="text-lg font-black text-[#1A2D23]">编辑客户</h2>
                        <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[300px]">{user.email || user.id}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
                        <X size={18} className="text-gray-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                    {/* Text fields */}
                    <FieldText label="名字" value={displayName} onChange={setDisplayName} placeholder="客户名字" />
                    <FieldText label="电话" value={phone} onChange={setPhone} placeholder="0103370197" />
                    <FieldText label="地址" value={address} onChange={setAddress} placeholder="完整地址" textarea />

                    <div className="border-t border-gray-100 pt-4 space-y-4">
                        <FieldNum
                            label="积分"
                            currentValue={user.points || 0}
                            state={pointsState}
                            onChange={setPointsState}
                            resolved={pointsResolved}
                        />
                        <FieldNum
                            label="总消费 (RM)"
                            currentValue={user.totalSpent || 0}
                            state={spentState}
                            onChange={setSpentState}
                            resolved={spentResolved}
                        />
                        <FieldNum
                            label="订单数"
                            currentValue={user.totalOrders || 0}
                            state={ordersState}
                            onChange={setOrdersState}
                            resolved={ordersResolved}
                        />
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                        <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider">
                            变更原因 <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="例：补偿订单延误 / 推荐人奖励 / 数据更正"
                            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6B35] resize-none"
                            rows={2}
                        />
                        <p className="text-[10px] text-gray-400 mt-1">写入审计日志，方便日后追溯</p>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 font-bold">
                            ⚠️ {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-4 flex justify-end gap-2 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || hasNumError}
                        className="px-4 py-2 bg-[#FF6B35] hover:bg-[#E95D31] disabled:bg-gray-300 text-white text-sm font-bold rounded-lg flex items-center gap-2"
                    >
                        {saving ? <><Loader2 size={14} className="animate-spin" /> 保存中</> : <><Save size={14} /> 保存</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

function FieldText({ label, value, onChange, placeholder, textarea }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    textarea?: boolean;
}) {
    return (
        <div>
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider">{label}</label>
            {textarea ? (
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    rows={2}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6B35] resize-none"
                />
            ) : (
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6B35]"
                />
            )}
        </div>
    );
}

function FieldNum({ label, currentValue, state, onChange, resolved }: {
    label: string;
    currentValue: number;
    state: NumFieldState;
    onChange: (s: NumFieldState) => void;
    resolved: { value: number; changed: boolean; error?: string };
}) {
    return (
        <div>
            <div className="flex items-center justify-between">
                <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider">{label}</label>
                <div className="flex bg-gray-100 rounded-md p-0.5 text-[10px] font-bold">
                    <button
                        type="button"
                        onClick={() => onChange({ ...state, mode: 'set' })}
                        className={`px-2 py-0.5 rounded ${state.mode === 'set' ? 'bg-white text-[#1A2D23] shadow-sm' : 'text-gray-500'}`}
                    >
                        设定
                    </button>
                    <button
                        type="button"
                        onClick={() => onChange({ ...state, mode: 'delta' })}
                        className={`px-2 py-0.5 rounded ${state.mode === 'delta' ? 'bg-white text-[#1A2D23] shadow-sm' : 'text-gray-500'}`}
                    >
                        +/-
                    </button>
                </div>
            </div>

            <div className="mt-1 flex items-center gap-2">
                <input
                    type="text"
                    inputMode="decimal"
                    value={state.mode === 'set' ? state.setValue : state.deltaValue}
                    onChange={(e) =>
                        state.mode === 'set'
                            ? onChange({ ...state, setValue: e.target.value })
                            : onChange({ ...state, deltaValue: e.target.value })
                    }
                    placeholder={state.mode === 'set' ? `当前: ${currentValue}` : '+10 或 -5'}
                    className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6B35] ${
                        resolved.error ? 'border-red-300' : 'border-gray-200'
                    }`}
                />
                <span className="text-xs text-gray-400 font-bold whitespace-nowrap min-w-[80px] text-right">
                    {resolved.error
                        ? <span className="text-red-500">{resolved.error}</span>
                        : resolved.changed
                            ? <span className="text-[#FF6B35]">→ {resolved.value}</span>
                            : <span>当前 {currentValue}</span>}
                </span>
            </div>
        </div>
    );
}
