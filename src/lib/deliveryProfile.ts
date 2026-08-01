/**
 * 「收货信息」保存的唯一入口 —— 手机 + 已验证地址写进 users/{uid}。
 *
 * 抽出来的原因：2026-08-01 把收货信息表单内嵌进购物车（结账不再跳第二个
 * 全屏 modal）之后，同一套写库逻辑有了两个宿主（AuthModal 的资料页 +
 * CartDrawer 的内嵌表单）。字段少一个就是「下单时服务端防换址校验不过」
 * 或「运费按旧距离算」，所以只留一份。
 *
 * ⚠️ addressVerifiedText 是防换址的关键：/api/submit-order 会拿它和下单时
 * 提交的 address 逐字比对，对不上直接拒收。改这里必须同步看 submit-order。
 */

import { updateUserProfile, upsertSavedAddress } from './auth';
import type { DeliveryZone } from './deliveryUtils';

export interface GeocodeResult {
    lat: number;
    lng: number;
    distanceKm: number;
    zone: DeliveryZone;
    formattedAddress: string;
    partialMatch?: boolean;
}

export interface SaveDeliveryProfileInput {
    uid: string;
    isAnonymous: boolean;
    phone: string;
    address: string;
    geocode: GeocodeResult;
    /** 地址簿备注（家 / 公司）。匿名访客不建地址簿，传了也忽略。 */
    addressLabel?: string;
    /** 访客「怎么称呼」（选填）。填了才覆盖 displayName（默认 "Guest"）。 */
    guestName?: string;
}

export async function saveDeliveryProfile(input: SaveDeliveryProfileInput): Promise<void> {
    const { uid, isAnonymous, phone, address, geocode, addressLabel, guestName } = input;
    const { serverTimestamp } = await import('firebase/firestore');

    const updateData: Record<string, unknown> = {
        phone,
        address,
        addressLat: geocode.lat,
        addressLng: geocode.lng,
        addressDistanceKm: geocode.distanceKm,
        deliveryZone: geocode.zone,
        addressFormatted: geocode.formattedAddress,
        addressVerifiedAt: serverTimestamp(),
        addressVerifiedText: address.trim(),  // anti-spoof: server cross-checks this on submit-order
    };
    if (isAnonymous && guestName?.trim()) {
        updateData.displayName = guestName.trim();
    }

    await updateUserProfile(uid, updateData);

    // 已验证的地址顺手收编进地址簿（≤5 条自动收，满了不打断保存）。
    // 匿名访客不建地址簿——升级成正式账号前只维护单一当前地址。
    if (!isAnonymous) {
        try {
            await upsertSavedAddress(uid, {
                label: (addressLabel || '').trim(),
                address: address.trim(),
                lat: geocode.lat,
                lng: geocode.lng,
                distanceKm: geocode.distanceKm,
                zone: geocode.zone,
                formatted: geocode.formattedAddress,
                verifiedText: address.trim(),
                verifiedAtMs: Date.now(),
            });
        } catch (e) {
            console.warn('[profile] 地址簿同步失败（当前地址已保存）', e);
        }
    }
}
