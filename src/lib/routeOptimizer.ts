/**
 * routeOptimizer — 配送批次的自动路线排序。
 *
 * 入口是 planRoute()：给它一批订单，还你一个排好序的 orderIds。
 *
 * 三件事，按顺序：
 *   1. 坐标解析 —— 订单自带 → geocodeCache → Google Geocoding（三层，从免费到花钱）
 *   2. 排序 —— Google Directions `optimize:true`（真实路网 + 实时路况）
 *   3. 降级 —— Google 挂了就用本地 haversine 最近邻 + 2-opt，再挂就原样返回
 *
 * ⚠️ 铁律：planRoute() 永不抛错。
 * 批次建不了 = 当天送不了货。路线排不出来最多是绕远路，不能变成「开始配送」按钮报错。
 * 所以这里每一层都 try/catch 兜底，最坏情况原样返回勾选顺序。
 *
 * 成本：每天午/晚各一次 ≈ 60 次/月，Directions 免费额度 10,000 次/月 → 实质零成本。
 * Geocoding 只在遇到全新地址时才调，结果永久缓存。
 */

import {
    PEARL_POINT_LAT,
    PEARL_POINT_LNG,
    haversineKm,
    distanceFromPearlPointKm,
} from '@/lib/deliveryUtils';

// 老板 2026-07-31 定：终点 = 最后一单，不算回厨房的回程。
// 改成 true 就变成闭环（出去转一圈再回厨房），Google 会给不同的顺序。
const ROUTE_END_AT_KITCHEN = false;

// Directions API 的 waypoints 上限（不含 origin/destination）。
// delivery-batch 本身已限 30 单 → 27 个中途点，超一点点，所以要有分段兜底。
const MAX_WAYPOINTS = 25;

const DIRECTIONS_TIMEOUT_MS = 8_000;
const GEOCODE_TIMEOUT_MS = 8_000;
// 整个坐标解析阶段的时间预算。超了就把剩下的单丢进 unlocated（排队尾，
// /driver 会标黄），绝不让批次卡到 Vercel 函数超时 —— 建不出批次 = 送不了货。
// 最坏路径预算：坐标解析 20s + Directions 8s×2（带路况失败退一次）= 36s < maxDuration 60s。
const GEOCODE_PHASE_BUDGET_MS = 20_000;

export type RouteSource =
    | 'google'            // 路网 + 实时路况，最优
    | 'google-notraffic'  // 路网，但 API 不接受 departure_time，退了一次
    | 'local'             // 本地直线距离最近邻 + 2-opt
    | 'none';             // 全挂了，原样返回勾选顺序

export interface RouteOrderInput {
    id: string;
    userAddress?: string;
    /** 订单上快照的坐标（submit-order 从 users 档案带过来的） */
    deliveryLat?: number;
    deliveryLng?: number;
}

export interface RoutePlan {
    /** 排好序的订单 id —— 直接存进 batch.orderIds */
    orderedIds: string[];
    routeSource: RouteSource;
    /** 全程公里数。Google 给的是路网真实里程；本地降级时是直线距离之和（会偏小） */
    totalKm: number | null;
    /** 全程分钟数（不含每单停留时间）。只有 Google 路径才有 */
    totalMinutes: number | null;
    /** 拿不到坐标的订单 id —— 这些被排到队尾，/driver 上要标黄提醒人工确认 */
    unlocatedOrderIds: string[];
    /** 解析出来的坐标，key = orderId。/driver 拿它做导航深链 */
    coords: Record<string, { lat: number; lng: number }>;
    /** 降级原因，写进批次方便日后排查（顺利时为 null） */
    note: string | null;
}

interface Located {
    id: string;
    lat: number;
    lng: number;
}

// ─────────────────────────────────────────────────────────────
//   坐标解析
// ─────────────────────────────────────────────────────────────

/**
 * 地址规范化 —— 缓存命中率的关键。
 * 「A-12-3, Pearl Suria」「a-12-3  pearl suria.」「A-12-3，Pearl Suria」
 * 必须命中同一条缓存，否则每天都在为同一个地址重复付 Geocoding 的钱。
 *
 * 标点（含逗号）一律当分隔符丢掉 —— 逗号在地址里纯粹是书写习惯，
 * 有人打有人不打、中文逗号英文逗号混用，保留它就等于放弃缓存。
 */
export function normalizeAddress(raw: string): string {
    return raw
        .toLowerCase()
        .replace(/[^\w一-鿿]+/g, ' ')  // 字母数字下划线和中文字以外全变空格
        .replace(/\s+/g, ' ')
        .trim();
}

/** Firestore doc id 不能含 `/`，也不能太长 —— 用 FNV-1a 压成短 hash。 */
function addressCacheKey(normalized: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < normalized.length; i++) {
        h ^= normalized.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return `a${h.toString(36)}_${normalized.length}`;
}

/**
 * 三层坐标解析。返回 { located, unlocated }。
 *
 * best-effort：任何一步失败都只是让那一单进 unlocated，不影响其他单，更不抛错。
 */
async function resolveOrderCoords(
    db: FirebaseFirestore.Firestore,
    orders: RouteOrderInput[],
): Promise<{ located: Located[]; unlocated: string[] }> {
    const located: Located[] = [];
    const unlocated: string[] = [];
    const needGeo: RouteOrderInput[] = [];

    // 第 1 层：订单自带坐标（网页单从 users 档案快照过来，零成本）
    for (const o of orders) {
        if (isFiniteCoord(o.deliveryLat, o.deliveryLng)) {
            located.push({ id: o.id, lat: o.deliveryLat!, lng: o.deliveryLng! });
        } else if (typeof o.userAddress === 'string' && normalizeAddress(o.userAddress).length >= 5) {
            needGeo.push(o);
        } else {
            unlocated.push(o.id);  // 连地址文本都没有，救不了
        }
    }

    if (needGeo.length === 0) return { located, unlocated };

    const deadline = Date.now() + GEOCODE_PHASE_BUDGET_MS;

    // 按规范化地址去重 —— 一栋楼两张单只该查一次 Google。
    const keyOf = new Map<string, string>();   // orderId → cacheKey
    const addrOf = new Map<string, string>();  // cacheKey → 原始地址（写缓存用）
    for (const o of needGeo) {
        const key = addressCacheKey(normalizeAddress(o.userAddress!));
        keyOf.set(o.id, key);
        if (!addrOf.has(key)) addrOf.set(key, o.userAddress!);
    }
    const uniqueKeys = [...addrOf.keys()];

    // 第 2 层：geocodeCache（同一个地址一辈子只查一次 Google）
    const resolvedByKey = new Map<string, { lat: number; lng: number }>();
    try {
        const snaps = await db.getAll(...uniqueKeys.map(k => db.collection('geocodeCache').doc(k)));
        snaps.forEach(s => {
            const d = s.data();
            if (s.exists && isFiniteCoord(d?.lat, d?.lng)) {
                resolvedByKey.set(s.id, { lat: d!.lat, lng: d!.lng });
            }
        });
    } catch (err) {
        console.warn('[routeOptimizer] geocodeCache read failed — 全部走 Geocoding', err);
    }

    // 第 3 层：Google Geocoding（花钱的那层，只有前两层都没命中才走）。
    // **并发**跑：首次启用时可能整批 20 个地址都要查，串行会撞函数超时。
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const misses = uniqueKeys.filter(k => !resolvedByKey.has(k));
    if (apiKey && misses.length > 0) {
        const results = await Promise.all(misses.map(async key => {
            if (Date.now() > deadline) return { key, geo: null };
            return { key, geo: await geocodeOnce(addrOf.get(key)!, apiKey) };
        }));
        // 写缓存也并发，best-effort：写失败只是下次再查一遍，不影响本次排序
        await Promise.all(results.map(async ({ key, geo }) => {
            if (!geo) return;
            resolvedByKey.set(key, { lat: geo.lat, lng: geo.lng });
            try {
                await db.collection('geocodeCache').doc(key).set({
                    lat: geo.lat,
                    lng: geo.lng,
                    formattedAddress: geo.formattedAddress,
                    address: addrOf.get(key),
                    createdAt: new Date(),
                });
            } catch (err) {
                console.warn('[routeOptimizer] geocodeCache write failed', key, err);
            }
        }));
    }

    // 落回订单 + 回写坐标（回写也并发，同样 best-effort）
    const writeBacks: Promise<void>[] = [];
    for (const o of needGeo) {
        const hit = resolvedByKey.get(keyOf.get(o.id)!);
        if (hit) {
            located.push({ id: o.id, lat: hit.lat, lng: hit.lng });
            writeBacks.push(writeBackOrderCoords(db, o.id, hit));
        } else {
            unlocated.push(o.id);
        }
    }
    await Promise.all(writeBacks);

    return { located, unlocated };
}

async function writeBackOrderCoords(
    db: FirebaseFirestore.Firestore,
    orderId: string,
    c: { lat: number; lng: number },
): Promise<void> {
    try {
        await db.collection('orders').doc(orderId).update({
            deliveryLat: c.lat,
            deliveryLng: c.lng,
        });
    } catch (err) {
        console.warn('[routeOptimizer] order coord write-back failed', orderId, err);
    }
}

async function geocodeOnce(
    address: string,
    apiKey: string,
): Promise<{ lat: number; lng: number; formattedAddress: string } | null> {
    // 与 /api/geocode 同一套 bias 参数（MY + Pearl Point 周边 bounding box），
    // 否则同名地点会解析到别的州去。
    const params = new URLSearchParams({
        address,
        region: 'my',
        components: 'country:MY',
        bounds: '3.04,101.62|3.13,101.72',
        key: apiKey,
    });
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, {
            signal: controller.signal,
        });
        clearTimeout(timer);
        const data = await res.json();
        if (data.status !== 'OK' || !data.results?.length) {
            console.warn('[routeOptimizer] geocode miss:', data.status, address);
            return null;
        }
        const top = data.results[0];
        return {
            lat: top.geometry.location.lat,
            lng: top.geometry.location.lng,
            formattedAddress: top.formatted_address || '',
        };
    } catch (err) {
        console.warn('[routeOptimizer] geocode error', address, err);
        return null;
    }
}

function isFiniteCoord(lat: unknown, lng: unknown): boolean {
    return typeof lat === 'number' && typeof lng === 'number'
        && isFinite(lat) && isFinite(lng)
        && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

// ─────────────────────────────────────────────────────────────
//   Google Directions 排序
// ─────────────────────────────────────────────────────────────

interface GoogleResult {
    order: Located[];
    totalKm: number;
    totalMinutes: number;
    source: 'google' | 'google-notraffic';
}

/**
 * 「开放路径」的实现方式（重要）：
 *
 * Directions API 必须给一个明确的 destination —— 没有「让 Google 自己挑终点」这个选项。
 * 所以我们用 haversine 挑出离厨房最远的那一单当 destination，其余全丢进
 * waypoints=optimize:true。这是启发式不是全局最优（全局最优要每个候选终点各跑一次），
 * 但符合配送直觉「先近后远，送完人在外圈」，且只花一次调用。
 */
async function optimizeWithGoogle(
    points: Located[],
    apiKey: string,
): Promise<GoogleResult | null> {
    if (points.length === 0) return null;

    const origin = `${PEARL_POINT_LAT},${PEARL_POINT_LNG}`;

    let destPoint: Located | null = null;
    let middle: Located[];

    if (ROUTE_END_AT_KITCHEN) {
        middle = points;
    } else {
        // 最远的一单当终点
        let farIdx = 0;
        let farKm = -1;
        points.forEach((p, i) => {
            const km = distanceFromPearlPointKm(p.lat, p.lng);
            if (km > farKm) { farKm = km; farIdx = i; }
        });
        destPoint = points[farIdx];
        middle = points.filter((_, i) => i !== farIdx);
    }

    if (middle.length > MAX_WAYPOINTS) {
        console.warn(`[routeOptimizer] ${middle.length} 个中途点超过 ${MAX_WAYPOINTS} 上限 — 走本地排序`);
        return null;
    }

    const destination = destPoint ? `${destPoint.lat},${destPoint.lng}` : origin;

    // departure_time=now 打开实时路况（老板 2026-07-31 定）。
    // Google 对 optimize:true + departure_time 的组合有过限制历史，所以下面
    // 带路况失败会自动去掉 departure_time 重试一次 —— 不带路况也远好过不排序。
    const build = (withTraffic: boolean) => {
        const p = new URLSearchParams({
            origin,
            destination,
            mode: 'driving',
            region: 'my',
            key: apiKey,
        });
        if (middle.length > 0) {
            p.set('waypoints', `optimize:true|${middle.map(m => `${m.lat},${m.lng}`).join('|')}`);
        }
        if (withTraffic) {
            p.set('departure_time', 'now');
            p.set('traffic_model', 'best_guess');
        }
        return p;
    };

    for (const withTraffic of [true, false]) {
        const data = await callDirections(build(withTraffic));
        if (!data) continue;

        const route = data.routes?.[0];
        if (!route) continue;

        // waypoint_order 是「中途点在最优顺序里的下标序列」，对应我们传进去的 middle
        const wpOrder: number[] = Array.isArray(route.waypoint_order) ? route.waypoint_order : [];
        const ordered: Located[] = [];
        if (wpOrder.length === middle.length) {
            wpOrder.forEach(i => { if (middle[i]) ordered.push(middle[i]); });
        } else {
            // Google 没给顺序（比如只有 1 个点）——保持原样，起码 legs 里的里程还有用
            ordered.push(...middle);
        }
        if (destPoint) ordered.push(destPoint);

        // legs 是每一段的距离/时长。开了路况时优先用 duration_in_traffic。
        const legs: any[] = Array.isArray(route.legs) ? route.legs : [];
        const meters = legs.reduce((s, l) => s + (l?.distance?.value || 0), 0);
        const seconds = legs.reduce((s, l) => s + (l?.duration_in_traffic?.value ?? l?.duration?.value ?? 0), 0);

        return {
            order: ordered,
            totalKm: Math.round((meters / 1000) * 10) / 10,
            totalMinutes: Math.round(seconds / 60),
            source: withTraffic ? 'google' : 'google-notraffic',
        };
    }

    return null;
}

async function callDirections(params: URLSearchParams): Promise<any | null> {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), DIRECTIONS_TIMEOUT_MS);
        const res = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`, {
            signal: controller.signal,
        });
        clearTimeout(timer);
        const data = await res.json();
        if (data.status !== 'OK') {
            // REQUEST_DENIED 基本都是「Directions API 没启用」或 key 限制没放行
            console.warn('[routeOptimizer] directions failed:', data.status, data.error_message || '');
            return null;
        }
        return data;
    } catch (err) {
        console.warn('[routeOptimizer] directions error', err);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────
//   本地降级排序（零 API 成本）
// ─────────────────────────────────────────────────────────────

/**
 * 最近邻建初始解 + 2-opt 改良。用直线距离。
 *
 * 在 4km 半径、20 单以内，直线距离排出来的顺序和真实路网差别很小 ——
 * 这条路径不只是「兜底」，就算 Google 全挂了也够用。
 */
export function optimizeLocally(points: Located[]): { order: Located[]; totalKm: number } {
    if (points.length <= 1) {
        return { order: [...points], totalKm: points.length === 1
            ? distanceFromPearlPointKm(points[0].lat, points[0].lng) : 0 };
    }

    // ── 最近邻 ──
    const remaining = [...points];
    const tour: Located[] = [];
    let curLat = PEARL_POINT_LAT, curLng = PEARL_POINT_LNG;
    while (remaining.length > 0) {
        let bestIdx = 0, bestKm = Infinity;
        remaining.forEach((p, i) => {
            const km = haversineKm(curLat, curLng, p.lat, p.lng);
            if (km < bestKm) { bestKm = km; bestIdx = i; }
        });
        const [next] = remaining.splice(bestIdx, 1);
        tour.push(next);
        curLat = next.lat; curLng = next.lng;
    }

    // ── 2-opt：反复翻转区间，只要总长变短就接受 ──
    // 开放路径（不回厨房），所以 tourLength 不含回程。
    let improved = true;
    let guard = 0;
    while (improved && guard++ < 50) {
        improved = false;
        for (let i = 0; i < tour.length - 1; i++) {
            for (let j = i + 1; j < tour.length; j++) {
                const before = tourLength(tour);
                const candidate = [...tour.slice(0, i), ...tour.slice(i, j + 1).reverse(), ...tour.slice(j + 1)];
                if (tourLength(candidate) < before - 1e-9) {
                    tour.splice(0, tour.length, ...candidate);
                    improved = true;
                }
            }
        }
    }

    return { order: tour, totalKm: Math.round(tourLength(tour) * 10) / 10 };
}

/** 厨房 → 各点依次 的直线总长（ROUTE_END_AT_KITCHEN 时补回程）。 */
function tourLength(tour: Located[]): number {
    if (tour.length === 0) return 0;
    let sum = haversineKm(PEARL_POINT_LAT, PEARL_POINT_LNG, tour[0].lat, tour[0].lng);
    for (let i = 0; i < tour.length - 1; i++) {
        sum += haversineKm(tour[i].lat, tour[i].lng, tour[i + 1].lat, tour[i + 1].lng);
    }
    if (ROUTE_END_AT_KITCHEN) {
        const last = tour[tour.length - 1];
        sum += haversineKm(last.lat, last.lng, PEARL_POINT_LAT, PEARL_POINT_LNG);
    }
    return sum;
}

// ─────────────────────────────────────────────────────────────
//   入口
// ─────────────────────────────────────────────────────────────

/**
 * 给一批订单排出配送顺序。**永不抛错** —— 最坏情况原样返回传入顺序。
 *
 * 拿不到坐标的单一律排到队尾（/driver 会标黄提醒人工确认位置）。
 */
export async function planRoute(
    db: FirebaseFirestore.Firestore,
    orders: RouteOrderInput[],
): Promise<RoutePlan> {
    const fallback = (note: string): RoutePlan => ({
        orderedIds: orders.map(o => o.id),
        routeSource: 'none',
        totalKm: null,
        totalMinutes: null,
        unlocatedOrderIds: orders.map(o => o.id),
        coords: {},
        note,
    });

    if (orders.length === 0) return { ...fallback('空批次'), unlocatedOrderIds: [], note: null };

    // 只有 1 单也照样跑坐标解析 —— 不排序，但 /driver 的导航按钮要那个坐标。
    // （下面 located.length < 2 的分支会兜住「无需排序」这件事。）
    let located: Located[] = [];
    let unlocated: string[] = [];
    try {
        const resolved = await resolveOrderCoords(db, orders);
        located = resolved.located;
        unlocated = resolved.unlocated;
    } catch (err) {
        console.error('[routeOptimizer] 坐标解析整体失败 — 原样返回', err);
        return fallback('坐标解析失败');
    }

    const coords: Record<string, { lat: number; lng: number }> = {};
    located.forEach(p => { coords[p.id] = { lat: p.lat, lng: p.lng }; });

    if (located.length < 2) {
        return {
            orderedIds: [...located.map(p => p.id), ...unlocated],
            routeSource: 'none',
            totalKm: null,
            totalMinutes: null,
            unlocatedOrderIds: unlocated,
            coords,
            note: located.length === 0 ? '所有订单都拿不到坐标' : '只有 1 单有坐标，无需排序',
        };
    }

    // ── 先试 Google ──
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (apiKey) {
        try {
            const g = await optimizeWithGoogle(located, apiKey);
            if (g) {
                return {
                    orderedIds: [...g.order.map(p => p.id), ...unlocated],
                    routeSource: g.source,
                    totalKm: g.totalKm,
                    totalMinutes: g.totalMinutes,
                    unlocatedOrderIds: unlocated,
                    coords,
                    note: g.source === 'google-notraffic' ? 'Google 不接受实时路况参数，已退回无路况排序' : null,
                };
            }
        } catch (err) {
            console.error('[routeOptimizer] Google 排序异常 — 转本地', err);
        }
    }

    // ── 降级：本地直线距离 ──
    try {
        const l = optimizeLocally(located);
        return {
            orderedIds: [...l.order.map(p => p.id), ...unlocated],
            routeSource: 'local',
            totalKm: l.totalKm,
            totalMinutes: null,
            unlocatedOrderIds: unlocated,
            coords,
            note: apiKey ? 'Google Directions 不可用，已用本地直线距离排序' : '未配置地图 key，已用本地直线距离排序',
        };
    } catch (err) {
        console.error('[routeOptimizer] 本地排序也失败 — 原样返回', err);
        return { ...fallback('排序全线失败'), coords, unlocatedOrderIds: unlocated };
    }
}
