"use client";

import React, { useState, useEffect } from 'react';
import { LogOut, User as UserIcon, Phone, MapPin, Save, ShoppingBag, CheckCircle, Loader2, AlertCircle, Trash2, Plus } from 'lucide-react';
import { User } from 'firebase/auth';
import Image from 'next/image';
import SkeletonBlock from '@/components/ui/SkeletonBlock';
import { tierFromDistance, tierFeeHintZh, tierLabelZh, FREE_DELIVERY_RADIUS_KM, PRICING_V2_CUTOFF_MS, type DeliveryZone, type DeliveryTier } from '@/lib/deliveryUtils';
import { selectSavedAddress, removeSavedAddress, MAX_SAVED_ADDRESSES, type SavedAddress } from '@/lib/auth';

interface GeocodeResult {
    lat: number;
    lng: number;
    distanceKm: number;
    zone: DeliveryZone;
    formattedAddress: string;
    partialMatch: boolean;
}

interface AuthProfileViewProps {
    currentUser: User;
    profileData: any;
    phone: string; setPhone: (v: string) => void;
    address: string; setAddress: (v: string) => void;
    editingProfile: boolean; setEditingProfile: (v: boolean) => void;
    loading: boolean;
    message: string;
    onUpdateProfile: (geocode?: GeocodeResult, addressLabel?: string) => void;
    onReloadProfile: () => Promise<void>;
    onLogout: () => void;
    onClose: () => void;
}

export default function AuthProfileView({
    currentUser, profileData,
    phone, setPhone, address, setAddress,
    editingProfile, setEditingProfile,
    loading, message, onUpdateProfile, onReloadProfile, onLogout, onClose,
}: AuthProfileViewProps) {
    const [geocoding, setGeocoding] = useState(false);
    const [geocodeResult, setGeocodeResult] = useState<GeocodeResult | null>(null);
    const [geocodeError, setGeocodeError] = useState('');
    // Track which address text the geocode result was for; if user edits the address afterward
    // we must re-verify before saving.
    const [verifiedFor, setVerifiedFor] = useState('');
    // 地址簿：仅注册（非匿名）会员可见。savedAddresses 是资料层的地址簿，
    // 顶层 address 字段仍是「当前配送地址」，选用 = 整包复制（lib/auth.ts）。
    const savedAddresses: SavedAddress[] = Array.isArray(profileData?.savedAddresses)
        ? profileData.savedAddresses
        : [];
    const showAddressBook = !currentUser.isAnonymous && savedAddresses.length > 0;
    const [addressLabel, setAddressLabel] = useState('');
    const [bookBusyId, setBookBusyId] = useState('');   // 正在切换/删除的条目 id
    const [bookError, setBookError] = useState('');

    const currentAddressKey = (profileData?.address || '').trim();

    const handleSelectSaved = async (entry: SavedAddress) => {
        if (bookBusyId || entry.address.trim() === currentAddressKey) return;
        setBookBusyId(entry.id);
        setBookError('');
        try {
            await selectSavedAddress(currentUser.uid, entry);
            await onReloadProfile();
        } catch (e) {
            setBookError(e instanceof Error ? e.message : '切换失败，请重试');
        } finally {
            setBookBusyId('');
        }
    };

    const handleRemoveSaved = async (entry: SavedAddress) => {
        if (bookBusyId) return;
        if (!window.confirm(`删除地址「${entry.label || entry.address}」？`)) return;
        setBookBusyId(entry.id);
        setBookError('');
        try {
            await removeSavedAddress(currentUser.uid, entry.id);
            await onReloadProfile();
        } catch (e) {
            setBookError(e instanceof Error ? e.message : '删除失败，请重试');
        } finally {
            setBookBusyId('');
        }
    };

    // 「+ 新增地址」：清空地址进编辑模式，走既有的 geocode 验证 + 保存流程，
    // 保存成功即成为当前地址并自动收编进地址簿（AuthModal.handleUpdateProfile）。
    const handleAddNew = () => {
        setAddress('');
        setAddressLabel('');
        setEditingProfile(true);
    };

    // Reset geocode state when entering edit mode; prefill the label if the
    // address being edited is already in the book (add-new cleared it first).
    useEffect(() => {
        if (editingProfile) {
            setGeocodeResult(null);
            setGeocodeError('');
            setVerifiedFor('');
            const match = savedAddresses.find(a => (a?.address || '').trim() === address.trim());
            setAddressLabel(match?.label || '');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editingProfile]);

    const addressChangedSinceVerify = !!geocodeResult && address.trim() !== verifiedFor;
    const needsReVerify = editingProfile && (!geocodeResult || addressChangedSinceVerify);

    // 一键「验证并保存」：自动跑 geocode 验证，通过立即续接保存 —— 用户不用
    // 分两步点「确认地址」再点「保存」。安全语义不变：没验证过的地址永远
    // 到不了 onUpdateProfile（geocode 是保存的前置，服务端下单还会再比对）。
    const handleVerifyAndSave = async () => {
        // 已验证且地址没改 → 直接保存
        if (geocodeResult && !addressChangedSinceVerify) {
            onUpdateProfile(geocodeResult, addressLabel);
            return;
        }
        if (!address || address.trim().length < 10) {
            setGeocodeError('请填写完整地址（至少 10 个字符）');
            return;
        }
        setGeocoding(true);
        setGeocodeError('');
        setGeocodeResult(null);
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch('/api/geocode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ address: address.trim() }),
            });
            const data = await res.json();
            if (!res.ok) {
                setGeocodeError(data.error || '地址验证失败');
                return;
            }
            setGeocodeResult(data);
            setVerifiedFor(address.trim());
            // 验证通过 → 直接续接保存（运费档位卡会闪现展示；保存成功后
            // 回到购物车还有完整费用明细）
            onUpdateProfile(data, addressLabel);
        } catch (e) {
            setGeocodeError(e instanceof Error ? e.message : '网络错误，请重试');
        } finally {
            // finally 保证失败路径也复位（旧代码 early-return 会把按钮卡在「验证中」）
            setGeocoding(false);
        }
    };

    return (
        <div className="p-6 space-y-5">
            {/* Avatar + name */}
            <div className="text-center space-y-2">
                <div className="relative w-16 h-16 mx-auto rounded-full bg-[#E3EADA] flex items-center justify-center overflow-hidden border-2 border-[#E3EADA]">
                    {currentUser.photoURL ? (
                        <Image src={currentUser.photoURL} alt="Avatar" fill className="object-cover" />
                    ) : (
                        <UserIcon size={28} className="text-[#1A2D23]" />
                    )}
                </div>
                <h3 className="font-bold text-[#1A2D23] text-lg">{currentUser.displayName || '会员'}</h3>
                <p className="text-xs text-gray-500">{currentUser.email}</p>
            </div>

            {/* Order summary (replaces the legacy points dashboard) */}
            {profileData === null ? (
                <div className="bg-gradient-to-br from-[#1A2D23] to-[#2A3D33] rounded-2xl p-5 space-y-3">
                    <SkeletonBlock className="h-3 w-20 bg-white/20" />
                    <SkeletonBlock className="h-6 w-32 bg-white/20" />
                    <div className="flex gap-4 pt-3 border-t border-white/10">
                        <SkeletonBlock className="h-6 w-12 bg-white/20" />
                        <SkeletonBlock className="h-6 w-16 bg-white/20" />
                    </div>
                </div>
            ) : (
                <div className="bg-gradient-to-br from-[#1A2D23] to-[#2A3D33] rounded-2xl p-5 text-white">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">订单概要</span>
                    </div>
                    <div className="flex gap-4 mt-3 pt-3 border-t border-white/10">
                        <div>
                            <p className="text-lg font-black">{profileData?.totalOrders || 0}</p>
                            <p className="text-[9px] opacity-50 uppercase">总订单</p>
                        </div>
                        <div>
                            <p className="text-lg font-black">RM {(profileData?.totalSpent || 0).toFixed(0)}</p>
                            <p className="text-[9px] opacity-50 uppercase">累计消费</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Profile Info / Edit */}
            <div className="space-y-3">
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <Phone size={10} /> 手机号码 *
                    </label>
                    {editingProfile ? (
                        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="例: 010-337 0197"
                            className="w-full mt-1 px-4 py-3 bg-white border-2 border-[#E3EADA] rounded-xl text-sm outline-none focus:border-[#FF6B35] transition-colors" required />
                    ) : (
                        <p className="mt-1 px-4 py-3 bg-white rounded-xl text-sm border border-gray-100">
                            {profileData?.phone || <span className="text-red-400 font-bold">未填写（必填）</span>}
                        </p>
                    )}
                </div>
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <MapPin size={10} /> 配送地址 *
                    </label>
                    {editingProfile ? (
                        <>
                            <textarea value={address} onChange={(e) => setAddress(e.target.value)}
                                placeholder="例: Pearl Point, Block B-12-3, Jalan 1/116B, OKR, 58000 KL"
                                rows={2} className="w-full mt-1 px-4 py-3 bg-white border-2 border-[#E3EADA] rounded-xl text-sm outline-none focus:border-[#FF6B35] transition-colors resize-none" required />
                            {!currentUser.isAnonymous && (
                                <input type="text" value={addressLabel} onChange={(e) => setAddressLabel(e.target.value)}
                                    placeholder="备注（选填）如：家 / 公司" maxLength={12}
                                    className="w-full mt-2 px-4 py-2 bg-white border-2 border-[#E3EADA] rounded-xl text-xs outline-none focus:border-[#FF6B35] transition-colors" />
                            )}

                            {geocodeError && (
                                <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-700 flex items-start gap-1.5">
                                    <AlertCircle size={12} className="mt-0.5 shrink-0" /> {geocodeError}
                                </div>
                            )}

                            {geocodeResult && !addressChangedSinceVerify && (() => {
                                // Existing customer (createdAt < cutoff) within 2km → grandfathered free.
                                const createdAtSec = profileData?.createdAt?.seconds;
                                const isExistingCustomer =
                                    typeof createdAtSec === 'number' && createdAtSec * 1000 < PRICING_V2_CUTOFF_MS;
                                const tier: DeliveryTier =
                                    isExistingCustomer && geocodeResult.distanceKm <= FREE_DELIVERY_RADIUS_KM
                                        ? 'free'
                                        : tierFromDistance(geocodeResult.distanceKm);
                                const tierStyles: Record<DeliveryTier, string> = {
                                    free: 'bg-green-50 border-green-200 text-green-700',
                                    near: 'bg-amber-50 border-amber-200 text-amber-700',
                                    mid: 'bg-orange-50 border-orange-200 text-orange-700',
                                    far: 'bg-orange-50 border-orange-200 text-orange-700',
                                };
                                return (
                                    <div className={`mt-2 px-3 py-2.5 rounded-lg text-xs border ${tierStyles[tier]}`}>
                                        <p className="font-black flex items-center gap-1.5">
                                            <CheckCircle size={12} />
                                            {tierLabelZh(tier)} · 距 Pearl Point {geocodeResult.distanceKm}km
                                        </p>
                                        <p className="text-[10px] mt-1 opacity-80 leading-snug">
                                            {tier === 'free' ? '✅ 你的订单全部免运' : tierFeeHintZh(tier, geocodeResult.distanceKm)}
                                        </p>
                                        {geocodeResult.partialMatch && tier !== 'free' && (
                                            <p className="text-[10px] mt-1 opacity-70 italic">
                                                ⚠️ Google 没找到完全匹配，按 {geocodeResult.distanceKm}km 计算运费。如有疑问 WhatsApp 联系碗妈
                                            </p>
                                        )}
                                    </div>
                                );
                            })()}
                            {addressChangedSinceVerify && (
                                <p className="mt-1 text-[10px] text-amber-600 font-bold">⚠️ 地址已修改，保存时会自动重新验证</p>
                            )}
                        </>
                    ) : (
                        <p className="mt-1 px-4 py-3 bg-white rounded-xl text-sm border border-gray-100">
                            {profileData?.address || <span className="text-red-400 font-bold">未填写（必填）</span>}
                            {(() => {
                                // Prefer addressDistanceKm (precise tier); fall back to legacy
                                // binary deliveryZone for users who predate the geocoding upgrade.
                                // Existing customers (createdAt < cutoff) within 2km keep 'free'.
                                const km = profileData?.addressDistanceKm;
                                const createdAtSec = profileData?.createdAt?.seconds;
                                const isExistingCustomer =
                                    typeof createdAtSec === 'number' && createdAtSec * 1000 < PRICING_V2_CUTOFF_MS;
                                const tier: DeliveryTier | null =
                                    typeof km === 'number'
                                        ? (isExistingCustomer && km <= FREE_DELIVERY_RADIUS_KM
                                            ? 'free'
                                            : tierFromDistance(km))
                                        : profileData?.deliveryZone === 'within2km'
                                            ? 'free'
                                            : profileData?.deliveryZone === 'outside2km'
                                                ? 'near'
                                                : null;
                                if (!tier) return null;
                                const badgeStyles: Record<DeliveryTier, string> = {
                                    free: 'bg-green-100 text-green-700',
                                    near: 'bg-amber-100 text-amber-700',
                                    mid: 'bg-orange-100 text-orange-700',
                                    far: 'bg-orange-100 text-orange-700',
                                };
                                const distSuffix = typeof km === 'number' ? ` · ${km}km` : '';
                                return (
                                    <span className={`ml-2 inline-block px-2 py-0.5 rounded text-[10px] font-black ${badgeStyles[tier]}`}>
                                        {tierLabelZh(tier)}{distSuffix}
                                    </span>
                                );
                            })()}
                        </p>
                    )}
                </div>

                {/* 地址簿：注册会员最多存 5 个已验证地址，点「使用」切换当前配送地址 */}
                {!editingProfile && showAddressBook && (
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                            <span className="flex items-center gap-1"><MapPin size={10} /> 地址簿（{savedAddresses.length}/{MAX_SAVED_ADDRESSES}）</span>
                            {savedAddresses.length < MAX_SAVED_ADDRESSES ? (
                                <button onClick={handleAddNew} className="flex items-center gap-0.5 text-[#FF6B35] font-black hover:underline">
                                    <Plus size={10} /> 新增地址
                                </button>
                            ) : (
                                <span className="text-gray-300 normal-case">已满，删除后可再加</span>
                            )}
                        </label>
                        <div className="mt-1 space-y-1.5">
                            {savedAddresses.map((entry) => {
                                const isCurrent = entry.address.trim() === currentAddressKey;
                                const busy = bookBusyId === entry.id;
                                // 老客户 2km 内保留免运档，与当前地址徽章同一套规则
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
                                            <p className="text-[10px] text-gray-400 mt-0.5">{tierLabelZh(tier)} · {entry.distanceKm}km</p>
                                        </div>
                                        {isCurrent ? (
                                            <span className="shrink-0 flex items-center gap-1 text-[#FF6B35] font-black text-[10px]">
                                                <CheckCircle size={12} /> 当前
                                            </span>
                                        ) : (
                                            <button onClick={() => handleSelectSaved(entry)} disabled={!!bookBusyId}
                                                className="shrink-0 px-2.5 py-1.5 bg-[#1A2D23] text-white rounded-lg font-black text-[10px] hover:bg-[#2A3D33] transition-all disabled:opacity-50">
                                                {busy ? <Loader2 size={12} className="animate-spin" /> : '使用'}
                                            </button>
                                        )}
                                        <button onClick={() => handleRemoveSaved(entry)} disabled={!!bookBusyId}
                                            className="shrink-0 p-1.5 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50" aria-label="删除地址">
                                            {busy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                        {bookError && (
                            <p className="mt-1 text-[10px] text-red-500 font-bold flex items-center gap-1"><AlertCircle size={10} /> {bookError}</p>
                        )}
                    </div>
                )}

            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
                {editingProfile ? (
                    <>
                        <button onClick={handleVerifyAndSave} disabled={loading || geocoding || !phone.trim() || !address.trim()}
                            className="w-full py-3 bg-[#FF6B35] text-white rounded-xl flex items-center justify-center gap-2 font-bold hover:bg-[#E95D31] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#FF6B35]/20">
                            {geocoding ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {geocoding ? '验证地址中…' : loading ? '保存中...' : needsReVerify ? '📍 验证地址并保存' : '保存资料'}
                        </button>
                        {/* 资料已完整才给取消（新账号缺手机/地址时必须先填完，不能退出编辑） */}
                        {profileData?.phone && profileData?.address && (
                            <button onClick={() => {
                                setPhone(profileData.phone || '');
                                setAddress(profileData.address || '');
                                setEditingProfile(false);
                            }} disabled={loading || geocoding}
                                className="w-full py-2 text-gray-400 text-xs font-bold hover:text-gray-600 transition-colors disabled:opacity-50">
                                取消，保持原资料
                            </button>
                        )}
                    </>
                ) : (
                    <button onClick={() => setEditingProfile(true)}
                        className="w-full py-3 bg-[#1A2D23] text-white rounded-xl flex items-center justify-center gap-2 font-bold hover:bg-[#2A3D33] transition-all">
                        ✏️ 编辑资料
                    </button>
                )}
                <button onClick={onLogout} disabled={loading}
                    className="w-full py-3 bg-gray-100 text-gray-500 rounded-xl flex items-center justify-center gap-2 font-bold hover:bg-gray-200 transition-all disabled:opacity-50 text-sm">
                    <LogOut size={14} /> 登出
                </button>
            </div>

            {message && <p className="text-center text-sm font-bold text-[#FF6B35]">{message}</p>}

            <a href="/member" onClick={onClose}
                className="w-full py-3 bg-gradient-to-r from-[#FF6B35] to-[#FF8F60] text-white rounded-xl flex items-center justify-center gap-2 font-bold hover:shadow-lg hover:shadow-[#FF6B35]/20 transition-all">
                <ShoppingBag size={16} /> 查看订单 & 会员中心 →
            </a>
        </div>
    );
}
