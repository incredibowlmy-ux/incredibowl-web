/**
 * 服务端正向地理编码 —— Google Geocoding 调用 + 25km 拒绝 + 结果整形，**唯一一份**。
 *
 * 为什么抽出来（2026-09-05，安全计划 A2）：
 *   以前只有 `/api/geocode` 会调 Google，结果回给浏览器，再由浏览器把
 *   lat/lng/distanceKm/deliveryZone 写进 users/{uid}。字段在 firestore.rules 的
 *   客户端白名单里，所以控制台一句 updateDoc 就能把 addressDistanceKm 改成 0.5
 *   永久免运费。根治 = 落库也搬到服务端（`/api/save-address`），而落库前必须
 *   自己再 geocode 一次 —— 于是这段逻辑有了两个调用方，只能留一份。
 *
 * 纯函数风格：不碰 request / 限流 / 认证，`fetchImpl` 可注入，dogfood 用假响应就能测。
 */
import {
    distanceFromPearlPointKm,
    zoneFromDistance,
    isBeyondServiceRange,
    MAX_DELIVERY_KM,
    type DeliveryZone,
} from '@/lib/deliveryUtils';

export interface GeocodeForwardResult {
    lat: number;
    lng: number;
    /** 两位小数，与旧接口一致。 */
    distanceKm: number;
    zone: DeliveryZone;
    formattedAddress: string;
    partialMatch: boolean;
}

export type GeocodeForwardOutcome =
    | { ok: true; result: GeocodeForwardResult }
    | {
        ok: false;
        /** 建议的 HTTP 状态码（旧接口的语义原样保留）。 */
        status: 404 | 422 | 502 | 503;
        error: string;
        distanceKm?: number;
        beyondRange?: true;
        googleStatus?: string;
        googleMessage?: string | null;
    };

interface GoogleGeocodeResponse {
    status: string;
    results?: Array<{
        geometry: { location: { lat: number; lng: number } };
        formatted_address: string;
        partial_match?: boolean;
    }>;
    error_message?: string;
}

const FRIENDLY: Record<string, string> = {
    REQUEST_DENIED: '地图服务被拒（API key 配置或限制问题）',
    OVER_QUERY_LIMIT: '地图服务超额',
    INVALID_REQUEST: '请求格式错误',
    UNKNOWN_ERROR: '地图服务临时故障，请重试',
};

/**
 * 正向查询：地址串 → 坐标 / 距离 / 分区。
 *
 * 偏置：region=my + components=country:MY + Pearl Point 周边 ~10km 的 bounds，
 * 让 Google 优先给附近的同名地点（bounds 是软偏置，不是硬边界）。
 */
export async function geocodeForward(
    address: string,
    apiKey: string,
    fetchImpl: typeof fetch = fetch,
): Promise<GeocodeForwardOutcome> {
    const params = new URLSearchParams({
        address,
        region: 'my',
        components: 'country:MY',
        bounds: '3.04,101.62|3.13,101.72',
        key: apiKey,
    });

    let data: GoogleGeocodeResponse;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetchImpl(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, {
            signal: controller.signal,
        });
        clearTimeout(timeout);
        data = await res.json();
    } catch (err) {
        console.error('Geocode network error:', err);
        return { ok: false, status: 503, error: '地图服务无响应，请重试' };
    }

    if (data.status === 'ZERO_RESULTS') {
        return {
            ok: false,
            status: 404,
            error: '找不到这个地址，请检查后重试（建议含 condo 名 + 路名 + 邮编）',
        };
    }
    if (data.status !== 'OK' || !data.results?.length) {
        // 把 Google 的状态和原话带出去：REQUEST_DENIED 几乎总是 key 限制问题，
        // 让老板一眼看到，而不是一句笼统的「请重试」。
        console.error('Geocode failed:', data.status, data.error_message);
        const friendly = FRIENDLY[data.status] || '地址解析失败';
        const detail = data.error_message ? ` — ${data.error_message}` : '';
        return {
            ok: false,
            status: 502,
            error: `${friendly}（${data.status}）${detail}`,
            googleStatus: data.status,
            googleMessage: data.error_message || null,
        };
    }

    const top = data.results[0];
    const { lat, lng } = top.geometry.location;
    const distanceKm = distanceFromPearlPointKm(lat, lng);

    // 25km 服务上限（老板 2026-07-29 定）。拒在这里 = 地址根本存不进档案。
    if (isBeyondServiceRange(distanceKm)) {
        return {
            ok: false,
            status: 422,
            error: `这个地址离厨房 ${distanceKm.toFixed(1)}km，超出 ${MAX_DELIVERY_KM}km 配送范围。公司团餐可 WhatsApp 碗妈单独询价。`,
            distanceKm: Number(distanceKm.toFixed(2)),
            beyondRange: true,
        };
    }

    return {
        ok: true,
        result: {
            lat,
            lng,
            distanceKm: Number(distanceKm.toFixed(2)),
            zone: zoneFromDistance(distanceKm),
            formattedAddress: top.formatted_address,
            partialMatch: !!top.partial_match,
        },
    };
}
