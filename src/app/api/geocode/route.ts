import { NextRequest, NextResponse } from 'next/server';
import {
    distanceFromPearlPointKm,
    zoneFromDistance,
    isBeyondServiceRange,
    MAX_DELIVERY_KM,
} from '@/lib/deliveryUtils';
import { checkBurst, checkDailyQuota, getClientIp } from '@/lib/rateLimit';

/**
 * POST /api/geocode
 * Body: { address: string }
 * Auth: requires Firebase ID token in Authorization: Bearer <token>
 *
 * Server-side wrapper around Google Geocoding API. The API key never
 * reaches the browser. Caller must be a logged-in user (basic abuse
 * protection — we re-verify their UID against Firestore lazily).
 *
 * Returns:
 *   { lat, lng, distanceKm, zone, formattedAddress, partialMatch }
 * On failure:
 *   { error, status }
 */

let adminDb: FirebaseFirestore.Firestore | null = null;
async function getDb() {
    if (adminDb) return adminDb;
    const { getAdminDb } = await import('@/lib/firebase-admin');
    adminDb = getAdminDb();
    return adminDb;
}

async function verifyUser(req: NextRequest): Promise<string | null> {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    try {
        await getDb();
        const { getAuth } = await import('firebase-admin/auth');
        const decoded = await getAuth().verifyIdToken(token);
        return decoded.uid;
    } catch {
        return null;
    }
}

// 限流参数。正常顾客一辈子调不到 10 次（注册填一次、偶尔改地址）；
// 20/天 已经宽到离谱，纯粹是给刷账单的人封顶。
const BURST = { max: 6, windowMs: 60_000 };
const DAILY_LIMIT_PER_UID = 20;
const DAILY_LIMIT_PER_IP = 60; // 同一 WiFi 下多个家人各自注册，留足余量

export async function POST(req: NextRequest) {
    const uid = await verifyUser(req);
    if (!uid) {
        return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    // ── 滥用限流 ──────────────────────────────────────────────
    // 光有登录挡不住：匿名登录是开着的（访客下单），signInAnonymously 可以
    // 无成本无限拿 uid，每个 uid 再无限调 Google Geocoding（≈USD 5/1000 次）
    // = 账单可被刷爆。所以 uid 和 IP 两个维度都要卡。
    const ip = getClientIp(req);
    for (const [key, label] of [[`geocode:${uid}`, 'uid'], [`geocode-ip:${ip}`, 'ip']] as const) {
        const burst = checkBurst(key, BURST);
        if (!burst.ok) {
            console.warn(`[geocode] burst limit hit (${label}) — ${key}`);
            return NextResponse.json(
                { error: '查询过于频繁，请稍后再试' },
                { status: 429, headers: { 'Retry-After': String(burst.retryAfterSec) } },
            );
        }
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        console.error('GOOGLE_MAPS_API_KEY is not set');
        return NextResponse.json({ error: '地图服务暂未配置，请联系客服' }, { status: 500 });
    }

    let address: string;
    try {
        const body = await req.json();
        address = String(body.address || '').trim();
    } catch {
        return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
    }

    if (!address || address.length < 5) {
        return NextResponse.json({ error: '请输入完整地址' }, { status: 400 });
    }

    // 跨实例硬上限（内存桶挡不住扇出到多个 serverless 实例的攻击）。
    // 放在参数校验之后 —— 格式错误的请求不该消耗配额。
    // fail-open：Firestore 挂了照样放行，不能让顾客存不了地址。
    const db = await getDb();
    for (const [scope, key, limit] of [
        ['geocode', uid, DAILY_LIMIT_PER_UID],
        ['geocode-ip', ip, DAILY_LIMIT_PER_IP],
    ] as const) {
        const quota = await checkDailyQuota(db, scope, key, limit);
        if (!quota.ok) {
            console.warn(`[geocode] daily quota exhausted: ${scope}=${key} (${quota.used}/${quota.limit})`);
            return NextResponse.json(
                { error: '今日地址查询次数已达上限，请联系碗妈协助' },
                { status: 429 },
            );
        }
    }

    // Bias results toward Malaysia (region=my, components=country:MY) AND a
    // ~10km bounding box around Pearl Point, so Google prefers nearby matches
    // over distant same-named places. Bounds is a soft bias, not a hard limit.
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
        console.error('Geocode network error:', err);
        return NextResponse.json({ error: '地图服务无响应，请重试' }, { status: 503 });
    }

    if (googleData.status === 'ZERO_RESULTS') {
        return NextResponse.json({ error: '找不到这个地址，请检查后重试（建议含 condo 名 + 路名 + 邮编）' }, { status: 404 });
    }
    if (googleData.status !== 'OK' || !googleData.results?.length) {
        // Surface the underlying Google status + message so the customer (or admin
        // looking over their shoulder) can see exactly what's wrong, instead of a
        // generic "try again". REQUEST_DENIED almost always = key restrictions.
        console.error('Geocode failed:', googleData.status, googleData.error_message);
        const friendlyMap: Record<string, string> = {
            REQUEST_DENIED: '地图服务被拒（API key 配置或限制问题）',
            OVER_QUERY_LIMIT: '地图服务超额',
            INVALID_REQUEST: '请求格式错误',
            UNKNOWN_ERROR: '地图服务临时故障，请重试',
        };
        const friendly = friendlyMap[googleData.status] || '地址解析失败';
        const detail = googleData.error_message ? ` — ${googleData.error_message}` : '';
        return NextResponse.json({
            error: `${friendly}（${googleData.status}）${detail}`,
            googleStatus: googleData.status,
            googleMessage: googleData.error_message || null,
        }, { status: 502 });
    }

    const top = googleData.results[0];
    const { lat, lng } = top.geometry.location;
    const distanceKm = distanceFromPearlPointKm(lat, lng);

    // 25km 服务上限（老板 2026-07-29 定）。这道校验是新加的 —— 在此之前
    // 这个接口对任何距离都照存不误，全站文案却写着「7.5km 以外暂不配送」，
    // 所以远距离地址一路存进个人资料再结账，只是被错算成 mid 档收 RM 12。
    // 拒在这里 = 地址根本存不进档案，下单链路自然进不去。
    if (isBeyondServiceRange(distanceKm)) {
        return NextResponse.json({
            error: `这个地址离厨房 ${distanceKm.toFixed(1)}km，超出 ${MAX_DELIVERY_KM}km 配送范围。公司团餐可 WhatsApp 碗妈单独询价。`,
            distanceKm: Number(distanceKm.toFixed(2)),
            beyondRange: true,
        }, { status: 422 });
    }

    const zone = zoneFromDistance(distanceKm);

    return NextResponse.json({
        lat,
        lng,
        distanceKm: Number(distanceKm.toFixed(2)),
        zone,
        formattedAddress: top.formatted_address,
        partialMatch: !!top.partial_match,
    });
}
