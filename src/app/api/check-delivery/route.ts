import { NextRequest, NextResponse } from 'next/server';
import {
    distanceFromPearlPointKm,
    tierFromDistance,
    calcDeliveryFee,
    thresholdForDistance,
    type DeliveryTier,
} from '@/lib/deliveryUtils';
import { checkBurst, checkDailyQuota, getClientIp } from '@/lib/rateLimit';

// CORS so the standalone admin dashboard (served from file:// or a different
// host) can call this for manual order entry. Same '*' pattern as the
// /api/admin/* routes. Endpoint is already public + rate-limited.
const CORS_HEADERS: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

function corsify(res: NextResponse): NextResponse {
    for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
    return res;
}

export async function OPTIONS() {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * POST /api/check-delivery
 *
 * Public, no-auth address-to-tier preview used by the DeliveryChecker widget
 * on the home page. Cold visitors from Meta ads need a 30-second go/no-go
 * answer BEFORE committing to signup. The authenticated /api/geocode endpoint
 * is for logged-in users finalising their profile — this one is the public
 * peek.
 *
 * Body:    { address: string }
 * Returns: { tier, distanceKm, fee, threshold, feeAtThreshold, formattedAddress }
 *          or { error, status }. threshold + feeAtThreshold are null on the
 *          far tier (7.5km+, flat RM 18) — there is nothing to spend toward.
 *
 * Rate limit（2026-07-26 加固）：
 *   突发 8 次/分钟/IP（内存桶）+ 每 IP 每天 200 次（Firestore，跨实例硬上限）。
 *   内存桶单独用不够 —— 每个 serverless 实例各有一份，请求打散就绕过了，
 *   而这个接口无需登录且直连 Google Geocoding（≈USD 5/1000 次）。
 *   日上限故意放宽到 200：马来西亚移动运营商走 CGNAT，一个出口 IP 后面可能
 *   有很多真顾客，宁可多放行也不能挡掉冷流量（挡掉 = 丢广告转化）。
 * Doesn't expose lat/lng — the customer doesn't need that for a tier preview.
 */

const BURST = { max: 8, windowMs: 60_000 };
const DAILY_LIMIT_PER_IP = 200;
// 2026-07-29: the hard "we don't deliver past 7.5 km" cutoff was removed —
// 7.5 km+ is now the far tier (RM 18 flat, Grab-fulfilled). This endpoint no
// longer returns tier:'outside'; it quotes the far fee like any other tier.
//
// It was ALSO the only place the 7.5 km ceiling was ever enforced — the real
// order path (geocode → profile → submit-order) never checked it, so far
// addresses were already being served, just mispriced as mid (RM 12). The
// tier now matches reality on both paths.

export async function POST(req: NextRequest) {
    const ip = getClientIp(req);
    const rl = checkBurst(`check-delivery:${ip}`, BURST);
    if (!rl.ok) {
        return corsify(NextResponse.json(
            { error: '查询次数过多，请稍后重试' },
            { status: 429, headers: { 'Retry-After': rl.retryAfterSec.toString() } },
        ));
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        console.error('GOOGLE_MAPS_API_KEY is not set');
        return corsify(NextResponse.json({ error: '地图服务暂未配置，请联系客服' }, { status: 500 }));
    }

    let address: string;
    try {
        const body = await req.json();
        address = String(body.address || '').trim();
    } catch {
        return corsify(NextResponse.json({ error: '请求格式错误' }, { status: 400 }));
    }

    if (!address || address.length < 4) {
        return corsify(NextResponse.json({ error: '请输入完整地址（建议含 condo 名 + 路名 / 邮编）' }, { status: 400 }));
    }

    // 跨实例日上限。放在参数校验之后 —— 格式错误的请求不消耗配额。
    // fail-open：Firestore 挂了照样放行（挡掉冷流量比多付几毛地图费贵）。
    try {
        const { getAdminDb } = await import('@/lib/firebase-admin');
        const quota = await checkDailyQuota(getAdminDb(), 'check-delivery', ip, DAILY_LIMIT_PER_IP);
        if (!quota.ok) {
            console.warn(`[check-delivery] daily quota exhausted for ip=${ip} (${quota.used}/${quota.limit})`);
            return corsify(NextResponse.json(
                { error: '今日查询次数已达上限，请直接 WhatsApp 碗妈查询配送范围' },
                { status: 429 },
            ));
        }
    } catch (e) {
        console.error('[check-delivery] quota check skipped:', e);
    }

    const params = new URLSearchParams({
        address,
        region: 'my',
        components: 'country:MY',
        bounds: '3.04,101.62|3.13,101.72',
        key: apiKey,
    });

    let googleData: {
        status: string;
        results: Array<{
            geometry: { location: { lat: number; lng: number } };
            formatted_address: string;
            partial_match?: boolean;
        }>;
        error_message?: string;
    };

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, {
            signal: controller.signal,
        });
        clearTimeout(timeout);
        googleData = await res.json();
    } catch (err) {
        console.error('check-delivery geocode network error:', err);
        return corsify(NextResponse.json({ error: '地图服务无响应，请重试' }, { status: 503 }));
    }

    if (googleData.status === 'ZERO_RESULTS') {
        return corsify(NextResponse.json(
            { error: '找不到这个地址，请加上 condo 名或路名后重试' },
            { status: 404 },
        ));
    }
    if (googleData.status !== 'OK' || !googleData.results?.length) {
        console.error('check-delivery geocode failed:', googleData.status, googleData.error_message);
        return corsify(NextResponse.json({ error: '地址解析失败，请稍后重试' }, { status: 502 }));
    }

    const top = googleData.results[0];
    const { lat, lng } = top.geometry.location;
    const distanceKm = distanceFromPearlPointKm(lat, lng);

    const tier: DeliveryTier = tierFromDistance(distanceKm);
    // Preview fees at two cart sizes: an empty cart (full fee) and at the
    // distance-resolved threshold (discounted fee). The widget shows both —
    // "today RM 5" vs "spend RM 20 / 30 and it's free" is a strong nudge.
    // thresholdForDistance() resolves the split near tier (RM 20 inner /
    // RM 30 outer); mid is tier-uniform.
    //
    // Far tier has threshold === null (RM 18 flat, never waived) — we send
    // threshold: null and omit feeAtThreshold so the widget renders the flat
    // fee with no "spend more" nudge. Sending a number here would promise
    // free delivery we don't offer at that distance.
    const feeNow = calcDeliveryFee(distanceKm, 0);
    const threshold = thresholdForDistance(distanceKm);
    const feeAtThreshold = threshold === null ? null : calcDeliveryFee(distanceKm, threshold);

    return corsify(NextResponse.json({
        tier,
        distanceKm: Number(distanceKm.toFixed(2)),
        fee: feeNow,
        feeAtThreshold,
        threshold,
        formattedAddress: top.formatted_address,
        partialMatch: !!top.partial_match,
    }));
}
