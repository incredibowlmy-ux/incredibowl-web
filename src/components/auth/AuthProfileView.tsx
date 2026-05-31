"use client";

import React, { useState, useEffect } from 'react';
import { LogOut, User as UserIcon, Phone, MapPin, Save, ShoppingBag, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { User } from 'firebase/auth';
import Image from 'next/image';
import SkeletonBlock from '@/components/ui/SkeletonBlock';
import { tierFromDistance, tierFeeHintZh, tierLabelZh, FREE_DELIVERY_RADIUS_KM, PRICING_V2_CUTOFF_MS, type DeliveryZone, type DeliveryTier } from '@/lib/deliveryUtils';

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
    referralInput: string; setReferralInput: (v: string) => void;
    loading: boolean;
    message: string;
    onUpdateProfile: (geocode?: GeocodeResult) => void;
    onLogout: () => void;
    onClose: () => void;
}

export default function AuthProfileView({
    currentUser, profileData,
    phone, setPhone, address, setAddress,
    editingProfile, setEditingProfile,
    referralInput, setReferralInput,
    loading, message, onUpdateProfile, onLogout, onClose,
}: AuthProfileViewProps) {
    const [geocoding, setGeocoding] = useState(false);
    const [geocodeResult, setGeocodeResult] = useState<GeocodeResult | null>(null);
    const [geocodeError, setGeocodeError] = useState('');
    // Track which address text the geocode result was for; if user edits the address afterward
    // we must re-verify before saving.
    const [verifiedFor, setVerifiedFor] = useState('');

    // Reset geocode state when entering edit mode
    useEffect(() => {
        if (editingProfile) {
            setGeocodeResult(null);
            setGeocodeError('');
            setVerifiedFor('');
        }
    }, [editingProfile]);

    const addressChangedSinceVerify = !!geocodeResult && address.trim() !== verifiedFor;
    const needsReVerify = editingProfile && (!geocodeResult || addressChangedSinceVerify);

    const handleVerifyAddress = async () => {
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
        } catch (e) {
            setGeocodeError(e instanceof Error ? e.message : '网络错误，请重试');
        }
        setGeocoding(false);
    };

    const handleSave = () => {
        if (!geocodeResult || addressChangedSinceVerify) {
            setGeocodeError('请先点「确认地址」验证后再保存');
            return;
        }
        onUpdateProfile(geocodeResult);
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

                            {/* Verify address button + result */}
                            <button
                                type="button"
                                onClick={handleVerifyAddress}
                                disabled={geocoding || !address.trim()}
                                className={`mt-2 w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
                                    geocoding || !address.trim()
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-[#1A2D23] text-white hover:bg-[#2A3D33]'
                                }`}
                            >
                                {geocoding ? <><Loader2 size={14} className="animate-spin" /> 验证中…</> : '📍 确认地址 / 检查配送区'}
                            </button>

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
                                <p className="mt-1 text-[10px] text-amber-600 font-bold">⚠️ 地址已修改，请重新点「确认地址」验证</p>
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

                {editingProfile && !profileData?.referredBy && (profileData?.totalOrders || 0) === 0 && (
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                            🎁 推荐码 Referral Code（选填）
                        </label>
                        <input type="text" value={referralInput} onChange={(e) => setReferralInput(e.target.value)}
                            placeholder="朋友的推荐码，例: IB-A1B2C3"
                            className="w-full mt-1 px-4 py-3 bg-[#FFF3E0] border-2 border-[#FFE0B2] rounded-xl text-sm outline-none focus:border-[#FF6B35] placeholder:text-[#E65100]/30" />
                        <p className="text-[10px] text-[#E65100]/50 mt-1">填写推荐码，首次下单确认后双方各获永久 RM 5 voucher</p>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
                {editingProfile ? (
                    <button onClick={handleSave} disabled={loading || needsReVerify}
                        className="w-full py-3 bg-[#FF6B35] text-white rounded-xl flex items-center justify-center gap-2 font-bold hover:bg-[#E95D31] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#FF6B35]/20">
                        <Save size={16} />
                        {loading ? '保存中...' : needsReVerify ? '请先确认地址' : '保存资料'}
                    </button>
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
