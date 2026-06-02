import { NextRequest, NextResponse } from 'next/server';
import {
    distanceFromPearlPointKm,
    tierFromDistance,
    calcDeliveryFee,
    thresholdForDistance,
    type DeliveryTier,
} from '@/lib/deliveryUtils';

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
 * Returns: { tier, distanceKm, fee, threshold, formattedAddress }
 *          or { error, status } / { tier: 'outside', distanceKm } when far
 *
 * Rate limit: 8 calls / minute / IP (in-memory; resets on server restart).
 * Doesn't expose lat/lng — the customer doesn't need that for a tier preview.
 */

// In-memory rate limiter. Survives a single Node process; that's fine for
// the abuse we care about (someone trying to use this as a free geocoder).
// Vercel's serverless gives us a per-instance bucket, which is close enough.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const RATE_LIMIT_MAX = 8;
const RATE_LIMIT_WINDOW_MS = 60_000;
// Distance beyond which we tell the user we don't deliver. Tightened
// 10 → 8 km on 2026-05-18 (removed empty 8 km+ tier), then 8 → 7.5 km on
// 2026-05-19 (last 500 m never had customers; matches actual route reach).
// Anything past 7.5 km gets the WhatsApp catering fallback in the widget.
const MAX_DELIVERY_KM = 7.5;

function getClientIp(req: NextRequest): string {
    const xff = req.headers.get('x-forwarded-for');
    if (xff) return xff.split(',')[0].trim();
    return req.headers.get('x-real-ip') || 'anon';
}

function checkRateLimit(ip: string): { ok: boolean; retryAfterSec: number } {
    const now = Date.now();
    const b = buckets.get(ip);
    if (!b || b.resetAt <= now) {
        buckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return { ok: true, retryAfterSec: 0 };
    }
    if (b.count >= RATE_LIMIT_MAX) {
        return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
    }
    b.count += 1;
    return { ok: true, retryAfterSec: 0 };
}

export async function POST(req: NextRequest) {
    const ip = getClientIp(req);
    const rl = checkRateLimit(ip);
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

    // Outside the 7.5km service ceiling: tell them honestly, offer WhatsApp.
    if (distanceKm > MAX_DELIVERY_KM) {
        return corsify(NextResponse.json({
            tier: 'outside' as const,
            distanceKm: Number(distanceKm.toFixed(2)),
            formattedAddress: top.formatted_address,
        }));
    }

    const tier: DeliveryTier = tierFromDistance(distanceKm);
    // Preview fees at two cart sizes: an empty cart (full fee) and at the
    // distance-resolved threshold (discounted fee). The widget shows both —
    // "today RM 5" vs "spend RM 20 / 30 and it's free" is a strong nudge.
    // thresholdForDistance() resolves the split near tier (RM 20 inner /
    // RM 30 outer); mid/far are tier-uniform.
    const feeNow = calcDeliveryFee(distanceKm, 0);
    const threshold = thresholdForDistance(distanceKm);
    const feeAtThreshold = calcDeliveryFee(distanceKm, threshold);

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
