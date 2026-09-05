"use client";

import React, { useState, useEffect } from 'react';
import { LogOut, User as UserIcon, Phone, MapPin, Save, ShoppingBag, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { User } from 'firebase/auth';
import Image from 'next/image';
import SkeletonBlock from '@/components/ui/SkeletonBlock';
import { tierFromDistance, tierFeeHintZh, tierLabelZh, tierFeeHintEn, tierLabelEn, FREE_DELIVERY_RADIUS_KM, PRICING_V2_CUTOFF_MS, type DeliveryZone, type DeliveryTier } from '@/lib/deliveryUtils';
import { type SavedAddress } from '@/lib/auth';
import AddressBook from './AddressBook';
import type { Locale } from '@/lib/locale';
import { AUTH_DICT } from './dict';

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
    onUpdateProfile: (geocode?: GeocodeResult, addressLabel?: string, guestName?: string) => void;
    onReloadProfile: () => Promise<void>;
    onLogout: () => void;
    onClose: () => void;
    locale?: Locale;
}

export default function AuthProfileView({
    currentUser, profileData,
    phone, setPhone, address, setAddress,
    editingProfile, setEditingProfile,
    loading, message, onUpdateProfile, onReloadProfile, onLogout, onClose,
    locale = 'zh',
}: AuthProfileViewProps) {
    const t = AUTH_DICT[locale].profile;
    const isEn = locale === 'en';
    const tierLabel = isEn ? tierLabelEn : tierLabelZh;
    const tierFeeHint = isEn ? tierFeeHintEn : tierFeeHintZh;
    const [geocoding, setGeocoding] = useState(false);
    const [geocodeResult, setGeocodeResult] = useState<GeocodeResult | null>(null);
    const [geocodeError, setGeocodeError] = useState('');
    // 「用我的当前位置」状态。定位只负责把地址串填进输入框，不参与验证/存档。
    const [locating, setLocating] = useState(false);
    const [locateNotice, setLocateNotice] = useState('');
    // Track which address text the geocode result was for; if user edits the address afterward
    // we must re-verify before saving.
    const [verifiedFor, setVerifiedFor] = useState('');
    // 地址簿逻辑在共享组件 AddressBook（MemberView 也用）；这里只留
    // label 输入 + 「+新增地址」入口的宿主接线。
    const savedAddresses: SavedAddress[] = Array.isArray(profileData?.savedAddresses)
        ? profileData.savedAddresses
        : [];
    const [addressLabel, setAddressLabel] = useState('');
    const [linkingGoogle, setLinkingGoogle] = useState(false);
    // 绑定 Google 的结果提示（替代 alert：手机上 alert 顶着域名前缀、冻结页面、
    // 文字选不中）。本地 state，不动 props 里的 message 契约（那是 AuthModal 的）。
    const [linkNotice, setLinkNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
    // 访客「怎么称呼」（选填）：匿名账号 displayName 默认 "Guest"，订单/Dashboard
    // 上全是 Guest 认不出人。填了就存进 users.displayName，下单时带进 userName。
    const [guestName, setGuestName] = useState('');

    // 访客 → Google 原地升级（同 uid，订单保留）。付款成功弹窗只出现一次，
    // 这里是错过后的常驻自助入口（买餐券也必须真账号）。
    const handleLinkGoogle = async () => {
        setLinkingGoogle(true);
        setLinkNotice(null);
        try {
            const { linkGuestToGoogle } = await import('@/lib/auth');
            await linkGuestToGoogle();
            setLinkNotice({ kind: 'success', text: t.linkSuccess });
            await onReloadProfile();
        } catch (e: any) {
            setLinkNotice({
                kind: 'error',
                text: e?.code === 'auth/credential-already-in-use' ? t.linkInUse : t.linkFailed,
            });
        }
        setLinkingGoogle(false);
    };

    // 成功提示 4 秒后自撤；失败提示常驻不自动消失（客户要时间读，
    // linkInUse 那条还要他去 WhatsApp 碗妈）。
    useEffect(() => {
        if (linkNotice?.kind !== 'success') return;
        const timer = setTimeout(() => setLinkNotice(null), 4000);
        return () => clearTimeout(timer);
    }, [linkNotice]);

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
            // 预填已存的称呼（占位符 "Guest" 不算名字）
            const dn = profileData?.displayName;
            setGuestName(dn && dn !== 'Guest' ? dn : '');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editingProfile]);

    const addressChangedSinceVerify = !!geocodeResult && address.trim() !== verifiedFor;
    const needsReVerify = editingProfile && (!geocodeResult || addressChangedSinceVerify);

    /**
     * 「用我的当前位置」—— 手机上把最痛的一步（拇指打完整马来西亚地址）换成一次点击。
     *
     * 只做一件事：GPS 坐标 → 反查地址串 → 填进输入框。距离/运费档位仍由后面的
     * 「验证地址并保存」走原来的 address 路径由服务端权威解析，所以这里没有引入
     * 「传个假坐标骗免运」的口子（/api/geocode 反查分支也只回 formattedAddress）。
     *
     * 反查结果通常只到楼栋级别，拿不到单位/门牌，所以填完要提示客户补上。
     */
    const handleUseMyLocation = () => {
        setGeocodeError('');
        setLocateNotice('');
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            setGeocodeError(t.locateUnsupported);
            return;
        }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    const token = await currentUser.getIdToken();
                    const res = await fetch('/api/geocode', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                    });
                    const data = await res.json();
                    if (!res.ok || !data.formattedAddress) {
                        setGeocodeError(data.error || t.locateFailed);
                        return;
                    }
                    setAddress(data.formattedAddress);
                    // 地址变了 → 作废上一次验证，强制重新 geocode 再保存。
                    setGeocodeResult(null);
                    setVerifiedFor('');
                    setLocateNotice(t.locateFilled);
                } catch {
                    setGeocodeError(t.networkError);
                } finally {
                    setLocating(false);
                }
            },
            (err) => {
                setLocating(false);
                setGeocodeError(err.code === err.PERMISSION_DENIED ? t.locateDenied : t.locateFailed);
            },
            { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
        );
    };

    // 一键「验证并保存」：自动跑 geocode 验证，通过立即续接保存 —— 用户不用
    // 分两步点「确认地址」再点「保存」。安全语义不变：没验证过的地址永远
    // 到不了 onUpdateProfile（geocode 是保存的前置，服务端下单还会再比对）。
    const handleVerifyAndSave = async () => {
        // 已验证且地址没改 → 直接保存
        if (geocodeResult && !addressChangedSinceVerify) {
            onUpdateProfile(geocodeResult, addressLabel, guestName);
            return;
        }
        if (!address || address.trim().length < 10) {
            setGeocodeError(t.addressMin);
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
                setGeocodeError(data.error || t.geocodeFailed);
                return;
            }
            setGeocodeResult(data);
            setVerifiedFor(address.trim());
            // 验证通过 → 直接续接保存（运费档位卡会闪现展示；保存成功后
            // 回到购物车还有完整费用明细）
            onUpdateProfile(data, addressLabel, guestName);
        } catch (e) {
            setGeocodeError(e instanceof Error ? e.message : t.networkError);
        } finally {
            // finally 保证失败路径也复位（旧代码 early-return 会把按钮卡在「验证中」）
            setGeocoding(false);
        }
    };

    return (
        <div className="p-6 space-y-5">
            {/* Avatar + name */}
            <div className="text-center space-y-2">
                <div className="relative w-16 h-16 mx-auto rounded-full bg-line flex items-center justify-center overflow-hidden border-2 border-line">
                    {currentUser.photoURL ? (
                        <Image src={currentUser.photoURL} alt="Avatar" fill sizes="64px" className="object-cover" />
                    ) : (
                        <UserIcon size={28} className="text-ink" />
                    )}
                </div>
                <h3 className="font-bold text-ink text-lg">
                    {currentUser.displayName
                        || (profileData?.displayName && profileData.displayName !== 'Guest' ? profileData.displayName : t.memberFallback)}
                </h3>
                <p className="text-xs text-gray-500">{currentUser.email}</p>
            </div>

            {/* 访客账号提示 + 绑定 Google 升级入口（仅匿名账号可见） */}
            {currentUser.isAnonymous && (
                <div className="bg-[#FFF7ED] border border-primary/30 rounded-2xl p-4 space-y-2">
                    <p className="text-xs font-bold text-ink">{t.guestBanner}</p>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                        {t.guestBannerDesc}
                    </p>
                    <button
                        onClick={handleLinkGoogle}
                        disabled={linkingGoogle}
                        className="w-full py-2.5 bg-ink text-white rounded-xl text-xs font-bold hover:bg-[#2A3D33] transition-colors disabled:opacity-50"
                    >
                        {linkingGoogle ? t.linking : t.linkCta}
                    </button>
                </div>
            )}

            {/* 绑定结果提示：故意放在访客卡「外面」—— 绑定成功后 isAnonymous 变 false，
                整张访客卡会消失，提示挂在卡内就跟着一起没了，客户看不到结果。 */}
            {linkNotice && (linkNotice.kind === 'success' ? (
                <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs font-bold text-green-800 flex items-start gap-1.5">
                    <CheckCircle size={12} className="mt-0.5 shrink-0" /> {linkNotice.text}
                </div>
            ) : (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-700 flex items-start gap-1.5">
                    <AlertCircle size={12} className="mt-0.5 shrink-0" /> {linkNotice.text}
                </div>
            ))}

            {/* Order summary (replaces the legacy points dashboard) */}
            {profileData === null ? (
                <div className="bg-gradient-to-br from-ink to-[#2A3D33] rounded-2xl p-5 space-y-3">
                    <SkeletonBlock className="h-3 w-20 bg-white/20" />
                    <SkeletonBlock className="h-6 w-32 bg-white/20" />
                    <div className="flex gap-4 pt-3 border-t border-white/10">
                        <SkeletonBlock className="h-6 w-12 bg-white/20" />
                        <SkeletonBlock className="h-6 w-16 bg-white/20" />
                    </div>
                </div>
            ) : (
                <div className="bg-gradient-to-br from-ink to-[#2A3D33] rounded-2xl p-5 text-white">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{t.orderSummary}</span>
                    </div>
                    <div className="flex gap-4 mt-3 pt-3 border-t border-white/10">
                        <div>
                            <p className="text-lg font-black">{profileData?.totalOrders || 0}</p>
                            <p className="text-[9px] opacity-50 uppercase">{t.totalOrders}</p>
                        </div>
                        <div>
                            <p className="text-lg font-black">RM {(profileData?.totalSpent || 0).toFixed(0)}</p>
                            <p className="text-[9px] opacity-50 uppercase">{t.totalSpent}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Profile Info / Edit */}
            <div className="space-y-3">
                {/* 访客「怎么称呼」（选填）：只有匿名账号需要 —— 正式账号有真名 */}
                {currentUser.isAnonymous && editingProfile && (
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                            <UserIcon size={10} /> {t.guestNameLabel}
                        </label>
                        <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)}
                            placeholder={t.guestNamePlaceholder} maxLength={30}
                            className="w-full mt-1 px-4 py-3 bg-white border-2 border-line rounded-xl text-sm outline-none focus:border-primary transition-colors" />
                    </div>
                )}
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <Phone size={10} /> {t.phoneLabel}
                    </label>
                    {editingProfile ? (
                        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.phonePlaceholder}
                            className="w-full mt-1 px-4 py-3 bg-white border-2 border-line rounded-xl text-sm outline-none focus:border-primary transition-colors" required />
                    ) : (
                        <p className="mt-1 px-4 py-3 bg-white rounded-xl text-sm border border-gray-100">
                            {profileData?.phone || <span className="text-red-400 font-bold">{t.notFilled}</span>}
                        </p>
                    )}
                </div>
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <MapPin size={10} /> {t.addressLabel}
                    </label>
                    {editingProfile ? (
                        <>
                            <textarea value={address} onChange={(e) => { setAddress(e.target.value); setLocateNotice(''); }}
                                placeholder={t.addressPlaceholder}
                                rows={2} className="w-full mt-1 px-4 py-3 bg-white border-2 border-line rounded-xl text-sm outline-none focus:border-primary transition-colors resize-none" required />
                            {/* 手机上打完整地址是整条下单链路最痛的一步 —— 一键定位回填 */}
                            <button
                                type="button"
                                onClick={handleUseMyLocation}
                                disabled={locating || geocoding}
                                className="mt-2 w-full py-2.5 rounded-xl border-2 border-line bg-white text-ink text-xs font-bold flex items-center justify-center gap-1.5 hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {locating ? <><Loader2 size={13} className="animate-spin" /> {t.locating}</> : t.useMyLocation}
                            </button>
                            {locateNotice && (
                                <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs font-bold text-amber-800 flex items-start gap-1.5">
                                    <AlertCircle size={12} className="mt-0.5 shrink-0" /> {locateNotice}
                                </div>
                            )}
                            {!currentUser.isAnonymous && (
                                <input type="text" value={addressLabel} onChange={(e) => setAddressLabel(e.target.value)}
                                    placeholder={t.labelPlaceholder} maxLength={12}
                                    className="w-full mt-2 px-4 py-2 bg-white border-2 border-line rounded-xl text-xs outline-none focus:border-primary transition-colors" />
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
                                            {t.tierLine(tierLabel(tier), geocodeResult.distanceKm)}
                                        </p>
                                        <p className="text-[10px] mt-1 opacity-80 leading-snug">
                                            {tier === 'free' ? t.freeAllOrders : tierFeeHint(tier, geocodeResult.distanceKm)}
                                        </p>
                                        {geocodeResult.partialMatch && tier !== 'free' && (
                                            <p className="text-[10px] mt-1 opacity-70 italic">
                                                {t.partialMatchNote(geocodeResult.distanceKm)}
                                            </p>
                                        )}
                                    </div>
                                );
                            })()}
                            {addressChangedSinceVerify && (
                                <p className="mt-1 text-[10px] text-amber-600 font-bold">{t.addressChangedNote}</p>
                            )}
                        </>
                    ) : (
                        <p className="mt-1 px-4 py-3 bg-white rounded-xl text-sm border border-gray-100">
                            {profileData?.address || <span className="text-red-400 font-bold">{t.notFilled}</span>}
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
                                        {tierLabel(tier)}{distSuffix}
                                    </span>
                                );
                            })()}
                        </p>
                    )}
                </div>

                {/* 地址簿：注册会员最多存 5 个已验证地址，点「使用」切换当前配送地址 */}
                {!editingProfile && (
                    <AddressBook
                        currentUser={currentUser}
                        profileData={profileData}
                        onReload={onReloadProfile}
                        onAddNew={handleAddNew}
                        locale={locale}
                    />
                )}

            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
                {editingProfile ? (
                    <>
                        <button onClick={handleVerifyAndSave} disabled={loading || geocoding || !phone.trim() || !address.trim()}
                            className="w-full py-3 bg-primary text-white rounded-xl flex items-center justify-center gap-2 font-bold hover:bg-primary-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20">
                            {geocoding ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {geocoding ? t.verifyingAddress : loading ? t.saving : needsReVerify ? t.verifyAndSave : t.saveProfile}
                        </button>
                        {/* 资料已完整才给取消（新账号缺手机/地址时必须先填完，不能退出编辑） */}
                        {profileData?.phone && profileData?.address && (
                            <button onClick={() => {
                                setPhone(profileData.phone || '');
                                setAddress(profileData.address || '');
                                setEditingProfile(false);
                            }} disabled={loading || geocoding}
                                className="w-full py-2 text-gray-400 text-xs font-bold hover:text-gray-600 transition-colors disabled:opacity-50">
                                {t.cancelKeep}
                            </button>
                        )}
                    </>
                ) : (
                    <button onClick={() => setEditingProfile(true)}
                        className="w-full py-3 bg-ink text-white rounded-xl flex items-center justify-center gap-2 font-bold hover:bg-[#2A3D33] transition-all">
                        {t.editProfile}
                    </button>
                )}
                <button onClick={onLogout} disabled={loading}
                    className="w-full py-3 bg-gray-100 text-gray-500 rounded-xl flex items-center justify-center gap-2 font-bold hover:bg-gray-200 transition-all disabled:opacity-50 text-sm">
                    <LogOut size={14} /> {t.logout}
                </button>
            </div>

            {message && <p className="text-center text-sm font-bold text-primary">{message}</p>}

            <a href={isEn ? '/en/member' : '/member'} onClick={onClose}
                className="w-full py-3 bg-gradient-to-r from-primary to-[#FF8F60] text-white rounded-xl flex items-center justify-center gap-2 font-bold hover:shadow-lg hover:shadow-primary/20 transition-all">
                <ShoppingBag size={16} /> {t.memberCentre}
            </a>
        </div>
    );
}
