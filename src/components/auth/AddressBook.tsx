"use client";

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, CheckCircle, Loader2, AlertCircle, Trash2, Plus } from 'lucide-react';
import { User } from 'firebase/auth';
import {
    selectSavedAddress, removeSavedAddress, upsertSavedAddress,
    MAX_SAVED_ADDRESSES, type SavedAddress,
} from '@/lib/auth';
import {
    tierFromDistance, tierLabelZh, tierLabelEn,
    FREE_DELIVERY_RADIUS_KM, PRICING_V2_CUTOFF_MS, type DeliveryTier,
} from '@/lib/deliveryUtils';

// 地址簿（最多 5 个已验证地址）—— AuthProfileView（资料弹窗）和 MemberView
// （会员中心）共用。顶层 address 字段是「当前配送地址」，选用 = 整包复制
// （lib/auth.ts selectSavedAddress，含 verifiedText 过服务端防换址比对）。
// 仅注册（非匿名）会员渲染；「+新增地址」跳回宿主自己的地址编辑流程。

const DICT = {
    zh: {
        title: (n: number) => `地址簿（${n}/${MAX_SAVED_ADDRESSES}）`,
        addNew: '新增地址',
        full: '已满，删除后可再加',
        emptyHint: `最多可存 ${MAX_SAVED_ADDRESSES} 个常用地址（家 / 公司…），下单时一键切换。点右上「+ 新增地址」开始。`,
        current: '当前',
        use: '使用',
        removeConfirm: (name: string) => `删除地址「${name}」？`,
        switchFailed: '切换失败，请重试',
        removeFailed: '删除失败，请重试',
        removeAria: '删除地址',
    },
    en: {
        title: (n: number) => `Address book (${n}/${MAX_SAVED_ADDRESSES})`,
        addNew: 'Add address',
        full: 'Full — remove one to add more',
        emptyHint: `Save up to ${MAX_SAVED_ADDRESSES} addresses (home / office…) and switch in one tap at checkout. Tap "+ Add address" to start.`,
        current: 'Current',
        use: 'Use',
        removeConfirm: (name: string) => `Remove address "${name}"?`,
        switchFailed: 'Switch failed, please retry',
        removeFailed: 'Remove failed, please retry',
        removeAria: 'Remove address',
    },
};

export default function AddressBook({
    currentUser, profileData, onReload, onAddNew, locale = 'zh',
}: {
    currentUser: User;
    profileData: any;
    /** 重新拉取权威 profile（宿主自己的 state + AuthProvider 都要刷） */
    onReload: () => Promise<void>;
    /** 进入宿主的「编辑地址」流程（地址栏清空） */
    onAddNew: () => void;
    locale?: 'zh' | 'en';
}) {
    const t = DICT[locale];
    const tierLabel = locale === 'en' ? tierLabelEn : tierLabelZh;

    const savedAddresses: SavedAddress[] = Array.isArray(profileData?.savedAddresses)
        ? profileData.savedAddresses
        : [];
    const currentAddressKey = (profileData?.address || '').trim();
    const [busyId, setBusyId] = useState('');
    const [error, setError] = useState('');

    // 懒迁移：簿为空但顶层已有完整 geocode 数据 → 自动把当前地址收编成
    // 第 1 条（每次挂载最多试一次；写失败只 warn，不影响任何现有功能）。
    const seeded = useRef(false);
    useEffect(() => {
        if (seeded.current || currentUser.isAnonymous) return;
        const p = profileData;
        if (!p?.address || savedAddresses.length > 0) return;
        if (typeof p.addressLat !== 'number' || typeof p.addressLng !== 'number'
            || typeof p.addressDistanceKm !== 'number'
            || (p.deliveryZone !== 'within2km' && p.deliveryZone !== 'outside2km')) return;
        seeded.current = true;
        (async () => {
            try {
                await upsertSavedAddress(currentUser.uid, {
                    label: '',
                    address: p.address.trim(),
                    lat: p.addressLat,
                    lng: p.addressLng,
                    distanceKm: p.addressDistanceKm,
                    zone: p.deliveryZone,
                    formatted: p.addressFormatted || '',
                    verifiedText: p.addressVerifiedText || p.address.trim(),
                    verifiedAtMs: typeof p.addressVerifiedAt?.seconds === 'number'
                        ? p.addressVerifiedAt.seconds * 1000
                        : Date.now(),
                });
                await onReload();
            } catch (e) {
                console.warn('[address-book] 懒迁移失败（不影响现有资料）', e);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profileData]);

    if (currentUser.isAnonymous || (!savedAddresses.length && !profileData?.address)) return null;

    const handleSelect = async (entry: SavedAddress) => {
        if (busyId || entry.address.trim() === currentAddressKey) return;
        setBusyId(entry.id);
        setError('');
        try {
            await selectSavedAddress(currentUser.uid, entry);
            await onReload();
        } catch (e) {
            setError(e instanceof Error ? e.message : t.switchFailed);
        } finally {
            setBusyId('');
        }
    };

    const handleRemove = async (entry: SavedAddress) => {
        if (busyId) return;
        if (!window.confirm(t.removeConfirm(entry.label || entry.address))) return;
        setBusyId(entry.id);
        setError('');
        try {
            await removeSavedAddress(currentUser.uid, entry.id);
            await onReload();
        } catch (e) {
            setError(e instanceof Error ? e.message : t.removeFailed);
        } finally {
            setBusyId('');
        }
    };

    return (
        <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1"><MapPin size={10} /> {t.title(savedAddresses.length)}</span>
                {savedAddresses.length < MAX_SAVED_ADDRESSES ? (
                    <button onClick={onAddNew} className="flex items-center gap-0.5 text-[#FF6B35] font-black hover:underline">
                        <Plus size={10} /> {t.addNew}
                    </button>
                ) : (
                    <span className="text-gray-300 normal-case">{t.full}</span>
                )}
            </label>
            {savedAddresses.length === 0 && (
                <p className="mt-1 px-3 py-2.5 bg-white rounded-xl border border-dashed border-gray-200 text-[10px] text-gray-400 leading-relaxed">
                    {t.emptyHint}
                </p>
            )}
            <div className="mt-1 space-y-1.5">
                {savedAddresses.map((entry) => {
                    const isCurrent = entry.address.trim() === currentAddressKey;
                    const busy = busyId === entry.id;
                    // 老客户 2km 内保留免运档，与资料页地址徽章同一套规则
                    const createdAtSec = profileData?.createdAt?.seconds;
                    const isExistingCustomer =
                        typeof createdAtSec === 'number' && createdAtSec * 1000 < PRICING_V2_CUTOFF_MS;
                    const tier: DeliveryTier =
                        isExistingCustomer && entry.distanceKm <= FREE_DELIVERY_RADIUS_KM
                            ? 'free'
                            : tierFromDistance(entry.distanceKm);
                    return (
                        <div key={entry.id}
                            className={`px-3 py-2.5 bg-white rounded-xl border flex items-center gap-2 text-xs ${isCurrent ? 'border-[#FF6B35] ring-1 ring-[#FF6B35]/30' : 'border-gray-100'}`}>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-[#1A2D23] truncate">
                                    {entry.label && <span className="mr-1.5 px-1.5 py-0.5 bg-[#E3EADA] rounded text-[10px]">{entry.label}</span>}
                                    {entry.address}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-0.5">{tierLabel(tier)} · {entry.distanceKm}km</p>
                            </div>
                            {isCurrent ? (
                                <span className="shrink-0 flex items-center gap-1 text-[#FF6B35] font-black text-[10px]">
                                    <CheckCircle size={12} /> {t.current}
                                </span>
                            ) : (
                                <button onClick={() => handleSelect(entry)} disabled={!!busyId}
                                    className="shrink-0 px-2.5 py-1.5 bg-[#1A2D23] text-white rounded-lg font-black text-[10px] hover:bg-[#2A3D33] transition-all disabled:opacity-50">
                                    {busy ? <Loader2 size={12} className="animate-spin" /> : t.use}
                                </button>
                            )}
                            <button onClick={() => handleRemove(entry)} disabled={!!busyId}
                                className="shrink-0 p-1.5 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50" aria-label={t.removeAria}>
                                {busy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            </button>
                        </div>
                    );
                })}
            </div>
            {error && (
                <p className="mt-1 text-[10px] text-red-500 font-bold flex items-center gap-1"><AlertCircle size={10} /> {error}</p>
            )}
        </div>
    );
}
