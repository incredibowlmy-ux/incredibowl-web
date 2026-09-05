import { NextRequest, NextResponse } from 'next/server';
import { verifyBearerUser } from '@/lib/adminApi';
import { checkBurst, checkDailyQuota, getClientIp } from '@/lib/rateLimit';
import { geocodeForward } from '@/lib/geocodeServer';

/**
 * POST /api/save-address —— 「收货地址」落库的**唯一**入口（2026-09-05，安全计划 A2）。
 *
 * Body: { address: string, phone?: string, guestName?: string }
 * Auth: Authorization: Bearer <Firebase ID token>（顾客或访客匿名账号都行）
 *
 * 为什么要有它：
 *   以前 /api/geocode 只负责查，查到的 lat / lng / distanceKm / deliveryZone 由
 *   **浏览器**写进 users/{uid}。这些字段在 firestore.rules 的客户端白名单里，
 *   所以控制台一句 `updateDoc(users/uid, { addressDistanceKm: 0.5 })` 就永久免运费
 *   —— 而 /api/submit-order 的运费就是按 user doc 算的。
 *   现在：地址串进来 → 服务端自己 geocode 一次 → Admin SDK 落库。浏览器再也不
 *   写这些字段，rules 白名单可以把它们全删掉。
 *
 * 客户端预览（输入地址 → 看分区 / 运费）仍走 /api/geocode；确认保存时这里再查一次。
 * 多一次 Google 调用（≈USD 0.005），换来篡改面为零。
 *
 * 限流与 /api/geocode 共用同一组 key（每日配额同一个 scope），不给刷账单的人开第二条路。
 */

const BURST = { max: 6, windowMs: 60_000 };
const DAILY_LIMIT_PER_UID = 20;
const DAILY_LIMIT_PER_IP = 60;

/** 与 /api/submit-order 的手机号校验保持一致的宽松形态：马来西亚号码 9–12 位数字。 */
function normalizePhone(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const s = raw.trim();
    if (!s) return null;
    const digits = s.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 12) return null;
    return s;
}

export async function POST(req: NextRequest) {
    const user = await verifyBearerUser(req);
    if (!user) {
        return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }
    const uid = user.uid;

    let address = '';
    let phone: string | null = null;
    let guestName: string | null = null;
    try {
        const body = await req.json();
        address = String(body?.address || '').trim();
        if (body?.phone !== undefined && body?.phone !== null && body?.phone !== '') {
            phone = normalizePhone(body.phone);
            if (!phone) {
                return NextResponse.json({ error: '手机号码格式不正确' }, { status: 400 });
            }
        }
        if (typeof body?.guestName === 'string' && body.guestName.trim()) {
            guestName = body.guestName.trim().slice(0, 60);
        }
    } catch {
        return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
    }
    if (!address || address.length < 5) {
        return NextResponse.json({ error: '请输入完整地址' }, { status: 400 });
    }
    if (address.length > 300) {
        return NextResponse.json({ error: '地址过长' }, { status: 400 });
    }

    // ── 限流：uid + IP 两个维度，与 /api/geocode 同一组 key ───────────────
    const ip = getClientIp(req);
    for (const [key, label] of [[`geocode:${uid}`, 'uid'], [`geocode-ip:${ip}`, 'ip']] as const) {
        const burst = checkBurst(key, BURST);
        if (!burst.ok) {
            console.warn(`[save-address] burst limit hit (${label}) — ${key}`);
            return NextResponse.json(
                { error: '操作过于频繁，请稍后再试' },
                { status: 429, headers: { 'Retry-After': String(burst.retryAfterSec) } },
            );
        }
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        console.error('GOOGLE_MAPS_API_KEY is not set');
        return NextResponse.json({ error: '地图服务暂未配置，请联系客服' }, { status: 500 });
    }

    const { getAdminDb } = await import('@/lib/firebase-admin');
    const db = getAdminDb();
    for (const [scope, key, limit] of [
        ['geocode', uid, DAILY_LIMIT_PER_UID],
        ['geocode-ip', ip, DAILY_LIMIT_PER_IP],
    ] as const) {
        const quota = await checkDailyQuota(db, scope, key, limit);
        if (!quota.ok) {
            console.warn(`[save-address] daily quota exhausted: ${scope}=${key} (${quota.used}/${quota.limit})`);
            return NextResponse.json(
                { error: '今日地址查询次数已达上限，请联系碗妈协助' },
                { status: 429 },
            );
        }
    }

    // ── 服务端权威解析 ───────────────────────────────────────────────
    const outcome = await geocodeForward(address, apiKey);
    if (!outcome.ok) {
        const { ok: _ok, status, ...rest } = outcome;
        void _ok;
        return NextResponse.json(rest, { status });
    }
    const g = outcome.result;

    // ── 落库（Admin SDK，不受 rules 约束）────────────────────────────
    // addressVerifiedText 是 /api/submit-order 防换址比对的锚点：必须等于 address.trim()。
    const { FieldValue } = await import('firebase-admin/firestore');
    const data: Record<string, unknown> = {
        address,
        addressLat: g.lat,
        addressLng: g.lng,
        addressDistanceKm: g.distanceKm,
        deliveryZone: g.zone,
        addressFormatted: g.formattedAddress,
        addressVerifiedAt: FieldValue.serverTimestamp(),
        addressVerifiedText: address,
        updatedAt: FieldValue.serverTimestamp(),
    };
    if (phone) data.phone = phone;
    if (guestName) data.displayName = guestName;

    try {
        // set+merge：访客 doc 可能还没建（signInAsGuest 之后立刻填表），update 会抛。
        await db.collection('users').doc(uid).set(data, { merge: true });
    } catch (err) {
        console.error('[save-address] write failed:', err);
        return NextResponse.json({ error: '地址保存失败，请重试' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, ...g });
}
