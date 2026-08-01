"use client";

import React, { useState } from 'react';
import { MapPin, Loader2, AlertCircle, CheckCircle, Save } from 'lucide-react';
import type { User } from 'firebase/auth';
import { isValidMyPhone } from '@/lib/cartUtils';
import { saveDeliveryProfile, type GeocodeResult } from '@/lib/deliveryProfile';
import {
    tierFromDistance, tierLabelZh, tierLabelEn, tierFeeHintZh, tierFeeHintEn,
    FREE_DELIVERY_RADIUS_KM, PRICING_V2_CUTOFF_MS, type DeliveryTier,
} from '@/lib/deliveryUtils';
import type { Locale } from '@/lib/locale';
import { CART_DICT } from './dict';

/**
 * 收货信息内嵌表单 —— 直接长在购物车里，不再跳第二个全屏 modal。
 *
 * 为什么：原来缺资料的客户要走「购物车 → 关掉 → AuthModal 全屏 → 填 → 关掉
 * → 回购物车 → 选支付 → 付款」6 步，两个全屏面板互相开关，手机上每次跳变
 * 都是一次「我在哪」的认知重置。现在 4 步，全程不离开购物车。
 *
 * 写库走 lib/deliveryProfile.saveDeliveryProfile —— 与 AuthModal 资料页同一份，
 * 字段不会漂移（少一个 addressVerifiedText 就是下单时防换址校验不过）。
 *
 * 安全语义与旧流程完全一致：地址必须先过服务端 /api/geocode 才能保存，
 * 服务端下单时照旧比对 addressVerifiedText。这里只是换了个宿主。
 */
export default function CartDeliveryInfo({
    currentUser, userProfile, locale = 'zh', onSaved, onCancel,
}: {
    currentUser: User;
    userProfile: Record<string, any> | null | undefined;
    locale?: Locale;
    /** 保存成功后刷新 AuthProvider 的 profile（运费会跟着重算）。 */
    onSaved: () => Promise<void> | void;
    /** 资料本来就完整、客户只是点开来改 → 提供「取消」退回摘要视图。 */
    onCancel?: () => void;
}) {
    const t = CART_DICT[locale].drawer;
    const isEn = locale === 'en';
    const tierLabel = isEn ? tierLabelEn : tierLabelZh;
    const tierFeeHint = isEn ? tierFeeHintEn : tierFeeHintZh;

    const [guestName, setGuestName] = useState<string>(
        (() => {
            const dn = userProfile?.displayName;
            return dn && dn !== 'Guest' ? dn : '';
        })(),
    );
    const [phone, setPhone] = useState<string>(userProfile?.phone || '');
    const [address, setAddress] = useState<string>(userProfile?.address || '');
    const [addressLabel, setAddressLabel] = useState('');

    const [busy, setBusy] = useState<'' | 'geocoding' | 'saving'>('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [locating, setLocating] = useState(false);
    const [result, setResult] = useState<GeocodeResult | null>(null);

    /** GPS → 反查地址串填进输入框。/api/geocode 的反查分支只回 formattedAddress，
     *  不回坐标/距离 —— 距离仍由下面的「验证并保存」服务端权威解析。 */
    const useMyLocation = () => {
        setError(''); setNotice('');
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            setError(t.locateUnsupported);
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
                        setError(data.error || t.locateFailed);
                        return;
                    }
                    setAddress(data.formattedAddress);
                    setResult(null);
                    setNotice(t.locateFilled);
                } catch {
                    setError(t.networkError);
                } finally {
                    setLocating(false);
                }
            },
            (err) => {
                setLocating(false);
                setError(err.code === err.PERMISSION_DENIED ? t.locateDenied : t.locateFailed);
            },
            { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
        );
    };

    const verifyAndSave = async () => {
        setError(''); setNotice('');
        const ph = phone.trim();
        const ad = address.trim();
        if (!isValidMyPhone(ph)) { setError(t.phoneInvalidInline); return; }
        if (ad.length < 10) { setError(t.addressMin); return; }

        setBusy('geocoding');
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch('/api/geocode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ address: ad }),
            });
            const geo = await res.json();
            if (!res.ok) { setError(geo.error || t.geocodeFailed); return; }

            setResult(geo as GeocodeResult);
            setBusy('saving');
            await saveDeliveryProfile({
                uid: currentUser.uid,
                isAnonymous: currentUser.isAnonymous,
                phone: ph,
                address: ad,
                geocode: geo as GeocodeResult,
                addressLabel,
                guestName,
            });
            await onSaved();
            setNotice(t.profileSaved);
        } catch (e) {
            setError(e instanceof Error ? e.message : t.networkError);
        } finally {
            setBusy('');
        }
    };

    // 老客户 grandfather：createdAt < cutoff 且 ≤2km → 免运区
    const createdAtSec = userProfile?.createdAt?.seconds;
    const isExisting = typeof createdAtSec === 'number' && createdAtSec * 1000 < PRICING_V2_CUTOFF_MS;
    const tier: DeliveryTier | null = result
        ? (isExisting && result.distanceKm <= FREE_DELIVERY_RADIUS_KM ? 'free' : tierFromDistance(result.distanceKm))
        : null;

    const inputCls = 'w-full px-3.5 py-2.5 bg-white border border-[#E3EADA] rounded-xl text-sm outline-none focus:border-[#FF6B35] transition-colors';

    return (
        <div className="mx-5 mt-4 rounded-2xl border border-[#FF6B35]/25 bg-white p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <p className="text-sm font-bold text-[#1A2D23] flex items-center gap-1.5">
                        <MapPin size={14} className="text-[#FF6B35]" /> {t.deliveryInfoTitle}
                    </p>
                    <p className="text-[11px] text-[#1A2D23]/50 font-medium mt-0.5">{t.deliveryInfoSub}</p>
                </div>
                {onCancel && (
                    <button type="button" onClick={onCancel}
                        className="shrink-0 text-[11px] font-medium text-gray-400 hover:text-gray-600 transition-colors">
                        {t.cancel}
                    </button>
                )}
            </div>

            {currentUser.isAnonymous && (
                <div>
                    <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{t.nameLabel}</label>
                    <input type="text" value={guestName} onChange={e => setGuestName(e.target.value)}
                        placeholder={t.namePlaceholder} maxLength={30} className={`${inputCls} mt-1`} />
                </div>
            )}

            <div>
                <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{t.phoneLabel}</label>
                <input type="tel" inputMode="tel" autoComplete="tel" value={phone}
                    onChange={e => { setPhone(e.target.value); setError(''); }}
                    placeholder={t.phonePlaceholder} className={`${inputCls} mt-1`} />
            </div>

            <div>
                <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{t.addressLabel}</label>
                <textarea value={address} rows={2} autoComplete="street-address"
                    onChange={e => { setAddress(e.target.value); setResult(null); setNotice(''); setError(''); }}
                    placeholder={t.addressPlaceholder} className={`${inputCls} mt-1 resize-none`} />
                <button type="button" onClick={useMyLocation} disabled={locating || busy !== ''}
                    className="mt-2 w-full py-2.5 rounded-xl border border-[#E3EADA] bg-[#FDFBF7] text-[#1A2D23] text-xs font-bold flex items-center justify-center gap-1.5 hover:border-[#FF6B35] hover:text-[#FF6B35] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    {locating ? <><Loader2 size={13} className="animate-spin" /> {t.locating}</> : t.useMyLocation}
                </button>
                {!currentUser.isAnonymous && (
                    <input type="text" value={addressLabel} onChange={e => setAddressLabel(e.target.value)}
                        placeholder={t.addressLabelPlaceholder} maxLength={12}
                        className={`${inputCls} mt-2 text-xs`} />
                )}
            </div>

            {error && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-700 flex items-start gap-1.5">
                    <AlertCircle size={12} className="mt-0.5 shrink-0" /> {error}
                </div>
            )}
            {notice && !error && (
                <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs font-bold text-amber-800 flex items-start gap-1.5">
                    <AlertCircle size={12} className="mt-0.5 shrink-0" /> {notice}
                </div>
            )}
            {result && tier && (
                <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800">
                    <p className="font-bold flex items-center gap-1.5">
                        <CheckCircle size={12} /> {t.tierLine(tierLabel(tier), result.distanceKm)}
                    </p>
                    <p className="text-[10px] mt-0.5 opacity-80">{tierFeeHint(tier, result.distanceKm)}</p>
                </div>
            )}

            <button type="button" onClick={verifyAndSave}
                disabled={busy !== '' || locating || !phone.trim() || !address.trim()}
                className={`w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors ${busy !== '' || locating || !phone.trim() || !address.trim()
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-[#1A2D23] text-white hover:bg-[#2A3D33]'}`}>
                {busy === 'geocoding' ? <><Loader2 size={14} className="animate-spin" /> {t.verifyingAddress}</>
                    : busy === 'saving' ? <><Loader2 size={14} className="animate-spin" /> {t.savingProfile}</>
                    : <><Save size={14} /> {t.verifyAndSave}</>}
            </button>
        </div>
    );
}
