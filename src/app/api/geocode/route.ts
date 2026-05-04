import { NextRequest, NextResponse } from 'next/server';
import { distanceFromPearlPointKm, zoneFromDistance } from '@/lib/deliveryUtils';

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

export async function POST(req: NextRequest) {
    const uid = await verifyUser(req);
    if (!uid) {
        return NextResponse.json({ error: '请先登录' }, { status: 401 });
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

    // Bias results toward Malaysia (region=my) and Kuala Lumpur (components).
    const params = new URLSearchParams({
        address,
        region: 'my',
        components: 'country:MY',
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
