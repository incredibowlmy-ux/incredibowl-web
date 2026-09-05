/**
 * 「收货信息」保存的唯一入口 —— 手机 + 已验证地址写进 users/{uid}。
 *
 * 抽出来的原因：2026-08-01 把收货信息表单内嵌进购物车（结账不再跳第二个
 * 全屏 modal）之后，同一套写库逻辑有了两个宿主（AuthModal 的资料页 +
 * CartDrawer 的内嵌表单）。字段少一个就是「下单时服务端防换址校验不过」
 * 或「运费按旧距离算」，所以只留一份。
 *
 * 🔒 2026-09-05（安全计划 A2）：写库从客户端 `updateUserProfile` 改成
 * `POST /api/save-address`。服务端拿地址串自己再 geocode 一次再落库 ——
 * 浏览器不再写 lat / lng / distanceKm / deliveryZone，firestore.rules 可以把
 * 这些字段从客户端白名单里删掉，控制台改距离骗免运费的口子就此关死。
 * 调用方传进来的 `geocode` 只是 /api/geocode 的**预览**结果，用于地址簿条目；
 * 落进 user doc 的以服务端返回为准。
 *
 * ⚠️ addressVerifiedText 是防换址的关键：/api/submit-order 会拿它和下单时
 * 提交的 address 逐字比对，对不上直接拒收。现在由服务端写，恒等于 address.trim()。
 */

import { auth } from './firebase';
import { upsertSavedAddress } from './auth';
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
    /** /api/geocode 的预览结果。只用于 UI 与地址簿；落库以服务端重算为准。 */
    geocode: GeocodeResult;
    /** 地址簿备注（家 / 公司）。匿名访客不建地址簿，传了也忽略。 */
    addressLabel?: string;
    /** 访客「怎么称呼」（选填）。填了才覆盖 displayName（默认 "Guest"）。 */
    guestName?: string;
}

/**
 * 服务端落库 + 返回权威 geocode 结果。失败抛 Error（message 可直接展示给顾客）。
 */
export async function saveDeliveryProfile(input: SaveDeliveryProfileInput): Promise<GeocodeResult> {
    const { uid, isAnonymous, phone, address, addressLabel, guestName } = input;

    const verified = await saveAddressViaApi(uid, {
        address: address.trim(),
        phone,
        guestName: isAnonymous ? guestName?.trim() || undefined : undefined,
    });

    // 已验证的地址顺手收编进地址簿（≤5 条自动收，满了不打断保存）。
    // 匿名访客不建地址簿——升级成正式账号前只维护单一当前地址。
    // savedAddresses 仍是客户端可写字段：它只是候选清单，不参与运费计算；
    // 真正选用时会再过一次 /api/save-address（见 lib/auth.selectSavedAddress）。
    if (!isAnonymous) {
        try {
            await upsertSavedAddress(uid, {
                label: (addressLabel || '').trim(),
                address: address.trim(),
                lat: verified.lat,
                lng: verified.lng,
                distanceKm: verified.distanceKm,
                zone: verified.zone,
                formatted: verified.formattedAddress,
                verifiedText: address.trim(),
                verifiedAtMs: Date.now(),
            });
        } catch (e) {
            console.warn('[profile] 地址簿同步失败（当前地址已保存）', e);
        }
    }

    return verified;
}

/**
 * 调 /api/save-address。`uid` 只用来确认当前登录的就是要写的那个人；
 * 服务端只信 token 里的 uid，不信 body。
 */
export async function saveAddressViaApi(
    uid: string,
    body: { address: string; phone?: string; guestName?: string },
): Promise<GeocodeResult> {
    const user = auth.currentUser;
    if (!user || user.uid !== uid) {
        throw new Error('登录状态已失效，请重新登录后再保存地址');
    }
    const token = await user.getIdToken();
    const res = await fetch('/api/save-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : '地址保存失败，请重试');
    }
    return {
        lat: data.lat,
        lng: data.lng,
        distanceKm: data.distanceKm,
        zone: data.zone,
        formattedAddress: data.formattedAddress,
        partialMatch: !!data.partialMatch,
    };
}
