/**
 * routeOptimizer — 配送批次的自动路线排序。
 *
 * 入口是 planRoute()：给它一批订单，还你一个排好序的 orderIds。
 *
 * 三件事，按顺序：
 *   1. 坐标解析 —— 订单自带 → geocodeCache → Google Geocoding（三层，从免费到花钱）
 *   2. 排序 —— Google **Routes API** computeRoutes + optimizeWaypointOrder（真实路网 + 实时路况）
 *   3. 降级 —— Google 挂了就用本地 haversine 最近邻 + 2-opt，再挂就原样返回
 *
 * 为什么是 Routes API 而不是 Directions API：
 *   2025-03-01 起 Google 把 Directions / Distance Matrix / Places 划为 legacy，新项目
 *   一律**无法启用**。本项目 2026-07-31 线上实测就是这个报错：
 *     REQUEST_DENIED "You're calling a legacy API, which is not enabled for your project."
 *   没有豁免通道，只能走 Routes API。（Geocoding **不在** legacy 名单，可以继续用。）
 *
 * ⚠️ 铁律：planRoute() 永不抛错。
 * 批次建不了 = 当天送不了货。路线排不出来最多是绕远路，不能变成「开始配送」按钮报错。
 * 所以这里每一层都 try/catch 兜底，最坏情况原样返回勾选顺序。
 *
 * 成本：每天午/晚各一次 ≈ 60 次/月。开了 optimizeWaypointOrder + TRAFFIC_AWARE 会落在
 * Compute Routes **Pro** SKU（$10/1000），免费额度 5,000 次/月 → 用量只占 1.2%，月费 $0。
 * 一次请求只计最高那一档 SKU，所以在已开路点优化的前提下加实时路况是零边际成本。
 * ⚠️ 别改 travelMode 成 TWO_WHEELER，也别开 TOLLS —— 会跳到 Enterprise（免费额度只剩 1,000）。
 * Geocoding 走独立的 Essentials 额度（10,000/月），且只在遇到全新地址时才调，结果永久缓存。
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

// Routes API 的 intermediates 上限（不含 origin/destination，所以单次最多 26 个配送点）。
// delivery-batch 本身已限 30 单 → 27 个中途点，超一点点，所以要有兜底（超了走本地排序）。
const MAX_WAYPOINTS = 25;

const ROUTES_TIMEOUT_MS = 8_000;
const GEOCODE_TIMEOUT_MS = 8_000;

// Geocoding 结果的合理性上限。`bounds` 只是**偏置**不是限制 —— Google 认不出
// 「Citizenz2」这种没路名没邮编的地址时，会回一个马来半岛中心点（4.21, 101.98，
// 距厨房 129.5km）而且 status 照样是 OK。以前这里照单全收，还写进 geocodeCache
// 和订单：2026-08-07 查出 2 个缓存条目 + 7 个订单被污染。真出现在批次里，
// 「最远的一单当终点」会挑中它，整条路线围着一个 130km 外的幻影点排。
//
// 配送硬上限是 25km（老板 2026-07-29 定），留 30km 余量。超出一律当解析失败
// → 该单进 unlocatedOrderIds 排队尾，/driver 标黄让人工确认。宁可说「定位不到」，
// 也不能给一个看起来很确定的错坐标。顾客端 /api/geocode 早就有这道校验
// （isBeyondServiceRange → 422），这里是补上同一道。
const MAX_SANE_GEOCODE_KM = 30;
// 整个坐标解析阶段的时间预算。超了就把剩下的单丢进 unlocated（排队尾，
// /driver 会标黄），绝不让批次卡到 Vercel 函数超时 —— 建不出批次 = 送不了货。
// 最坏路径预算：坐标解析 20s + Directions 8s×2（带路况失败退一次）= 36s < maxDuration 60s。
const GEOCODE_PHASE_BUDGET_MS = 20_000;

export type RouteSource =
    | 'google'            // 路网 + 实时路况（TRAFFIC_AWARE），最优
    | 'google-notraffic'  // 路网，但带路况那次失败了，退到 TRAFFIC_UNAWARE 重排
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
        const lat = top.geometry.location.lat;
        const lng = top.geometry.location.lng;
        // 合理性校验 —— 见 MAX_SANE_GEOCODE_KM 的注释。status=OK 不代表结果可信。
        const km = distanceFromPearlPointKm(lat, lng);
        if (!Number.isFinite(km) || km > MAX_SANE_GEOCODE_KM) {
            console.warn(`[routeOptimizer] geocode 结果离厨房 ${km.toFixed(1)}km，超出 ${MAX_SANE_GEOCODE_KM}km 合理范围，当解析失败：`, address, top.formatted_address);
            return null;
        }
        return { lat, lng, formattedAddress: top.formatted_address || '' };
    } catch (err) {
        console.warn('[routeOptimizer] geocode error', address, err);
        return null;
    }
}

/**
 * 坐标可用吗 —— 格式合法**且**落在合理配送半径内。
 *
 * 半径这一条不是洁癖：库里已经存在被污染的坐标（2026-08-07 查出 geocodeCache
 * 2 条 + 订单 7 个，全是 4.21/101.98 这个马来半岛中心点，距厨房 129.5km）。
 * 光修 geocodeOnce 的写入口挡不住已经落地的脏数据，所以读取口（第 1 层订单
 * 自带坐标、第 2 层缓存）也得过同一道闸。
 *
 * 挡下来的单进 unlocatedOrderIds：排队尾 + /driver 标黄让人工确认顺序。
 * 「说不知道」永远好过「给一个很确定的错坐标」。
 */
function isFiniteCoord(lat: unknown, lng: unknown): boolean {
    if (typeof lat !== 'number' || typeof lng !== 'number') return false;
    if (!isFinite(lat) || !isFinite(lng)) return false;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
    const km = distanceFromPearlPointKm(lat, lng);
    return Number.isFinite(km) && km <= MAX_SANE_GEOCODE_KM;
}

// ─────────────────────────────────────────────────────────────
//   Google Directions 排序
// ─────────────────────────────────────────────────────────────

interface GoogleResult {
    order: Located[];
    totalKm: number | null;
    totalMinutes: number | null;
    source: 'google' | 'google-notraffic';
}

const ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';
// 逗号分隔、camelCase、任何位置都不能有空格。FieldMask 是必填的 —— 不给直接报错，
// 没有「默认返回字段」这回事。optimizedIntermediateWaypointIndex 漏写会让整个请求失败
// （REST 与 RPC 参考文档原文都是 "the request fails"，不是静默返回空）。
// 故意不请求 legs：路线级 distanceMeters/duration 已经是全程合计，逐段累加反而会被
// proto3 的零值省略规则坑到。将来要显示逐点 ETA 再追加 routes.legs.*。
const ROUTES_FIELD_MASK =
    'routes.optimizedIntermediateWaypointIndex,routes.distanceMeters,routes.duration';

/** Routes API 的路点形状：location.latLng.latitude/longitude（是全称，不是 lat/lng）。 */
function wp(lat: number, lng: number) {
    return { location: { latLng: { latitude: lat, longitude: lng } } };
}

/**
 * "165s" / "3.5s" → 165 / 3.5。
 * duration 是 protobuf Duration **字符串**，不是 legacy 那种纯数字 —— Number("165s") 是 NaN。
 * 拿不到就返回 null，绝不让 NaN 流进 Firestore。
 */
function parseDurationSeconds(raw: unknown): number | null {
    if (typeof raw !== 'string') return null;
    const n = Number(raw.replace(/s$/, ''));
    return Number.isFinite(n) ? n : null;
}

/**
 * 优化后的下标序列 → 重排后的点。
 *
 * 语义：数组元素是「原始下标」，按最优访问顺序排列（与 legacy waypoint_order 一致）。
 * 例：intermediates=[A,B,C,D]，返回 [3,2,0,1] → 访问顺序 D→C→A→B。
 *
 * ⚠️ 长度不符 / 越界 / 重复 / 非整数，任何一点不对就整体退回原序。
 * 早先的写法是 `forEach(i => { if (middle[i]) push(...) })` —— 下标非法时会**静默丢单**，
 * 那是有客户收不到饭的 bug。绕路只是绕路，丢单是事故。
 */
function applyWaypointOrder(raw: unknown, middle: Located[]): Located[] {
    if (!Array.isArray(raw) || raw.length !== middle.length) return [...middle];
    const seen = new Set<number>();
    for (const i of raw) {
        if (!Number.isInteger(i) || i < 0 || i >= middle.length || seen.has(i)) return [...middle];
        seen.add(i);
    }
    return (raw as number[]).map(i => middle[i]);
}

type CallResult =
    | { route: any }
    | { fatalConfigError: true }   // 400/403：配置问题，重试纯属白等 8 秒
    | null;                        // 可重试（超时 / 5xx / 空结果）

async function callComputeRoutes(body: unknown, apiKey: string): Promise<CallResult> {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), ROUTES_TIMEOUT_MS);
        const res = await fetch(ROUTES_ENDPOINT, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                // key 走 header 而不是 URL —— 顺带让日志里的 URL 不再泄露密钥
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': ROUTES_FIELD_MASK,
            },
            body: JSON.stringify(body),
        });
        clearTimeout(timer);

        // 新 API 是真实 HTTP 错误码 + {error:{code,message,status}}，
        // 不再有 legacy 那种 HTTP 200 + 顶层 status:"REQUEST_DENIED"。
        // 网关层出错时 body 可能根本不是 JSON，所以先取文本再试解析。
        const text = await res.text();
        let data: any = null;
        try { data = JSON.parse(text); } catch { /* 非 JSON，下面按原文记日志 */ }

        if (!res.ok) {
            console.warn('[routeOptimizer] Routes API failed:', res.status,
                data?.error?.status || '', String(data?.error?.message || text).slice(0, 200));
            // 403 = Routes API 没启用 / key 的 API 限制没放行；400 = 请求体不合法。
            // 这两种重试一万次也是同样结果。
            if (res.status === 400 || res.status === 403) return { fatalConfigError: true };
            return null;
        }

        // 算不出路线时 routes 是空数组，而 proto3 会把空数组整个省掉 → 响应可能就是 {}
        const route = data?.routes?.[0];
        if (!route) {
            console.warn('[routeOptimizer] Routes API 返回空结果（算不出路线）');
            return null;
        }
        return { route };
    } catch (err) {
        console.warn('[routeOptimizer] Routes API error', err);
        return null;
    }
}

/**
 * 「开放路径」的实现方式（重要）：
 *
 * Routes API 和 legacy Directions 一样，必须给一个明确的 destination —— 没有
 * 「让 Google 自己挑终点」这个选项，它只重排 intermediates。
 * 所以我们用 haversine 挑出离厨房最远的那一单当 destination，其余全丢进 intermediates。
 * 这是启发式不是全局最优（全局最优要每个候选终点各跑一次），但符合配送直觉
 * 「先近后远，送完人在外圈」，且只花一次调用。
 */
async function optimizeWithGoogle(
    points: Located[],
    apiKey: string,
): Promise<GoogleResult | null> {
    if (points.length === 0) return null;

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

    const destLat = destPoint ? destPoint.lat : PEARL_POINT_LAT;
    const destLng = destPoint ? destPoint.lng : PEARL_POINT_LNG;
    // ≤1 个中途点本来就无序可排；而且「0/1 个中途点时优化字段的行为」官方文档没写，
    // 索性不开优化绕过这个未知数。applyWaypointOrder 会兜住返回值。
    const doOptimize = middle.length >= 2;

    const buildBody = (withTraffic: boolean) => ({
        origin: wp(PEARL_POINT_LAT, PEARL_POINT_LNG),
        destination: wp(destLat, destLng),
        ...(middle.length > 0 ? { intermediates: middle.map(m => wp(m.lat, m.lng)) } : {}),
        travelMode: 'DRIVE',
        // 不写的默认值是 TRAFFIC_UNAWARE（无路况）—— 这是从 legacy 迁过来最阴的坑：
        // 静默降级、零报错、数字照常返回，只是完全没有路况。必须显式写。
        // 另：TRAFFIC_AWARE_OPTIMAL 与 optimizeWaypointOrder 互斥，只能用 TRAFFIC_AWARE。
        routingPreference: withTraffic ? 'TRAFFIC_AWARE' : 'TRAFFIC_UNAWARE',
        ...(doOptimize ? { optimizeWaypointOrder: true } : {}),
        computeAlternativeRoutes: false,
        // 故意不传 departureTime（默认就是请求时刻，DRIVE 模式传过去的时间还会被拒）
        // 也不传 trafficModel（只在 TRAFFIC_AWARE_OPTIMAL 下生效，而那个用不了）
        // 也不传 regionCode（传坐标时它基本是 no-op，只对地址字符串做偏置）
    });

    // 先试带路况；失败就退到无路况再试一次 —— 没路况也远好过不排序。
    for (const withTraffic of [true, false]) {
        const result = await callComputeRoutes(buildBody(withTraffic), apiKey);
        if (result && 'fatalConfigError' in result) return null;  // 配置错，第二次也白搭
        if (!result) continue;

        const { route } = result;
        const ordered = applyWaypointOrder(route.optimizedIntermediateWaypointIndex, middle);
        if (destPoint) ordered.push(destPoint);

        // distanceMeters 为 0 时会被 proto3 省略 → undefined，不能当 0 显示
        const meters = typeof route.distanceMeters === 'number' ? route.distanceMeters : null;
        const seconds = parseDurationSeconds(route.duration);

        return {
            order: ordered,
            totalKm: meters === null ? null : Math.round((meters / 1000) * 10) / 10,
            totalMinutes: seconds === null ? null : Math.round(seconds / 60),
            source: withTraffic ? 'google' : 'google-notraffic',
        };
    }

    return null;
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

/**
 * 仅供 dogfood 脚本使用 —— Routes API 响应解析的两个纯函数。
 * 它们不该是公开 API（外部没有理由调），但必须能被单独测：
 * applyWaypointOrder 一旦回归就是「有客户收不到饭」，parseDurationSeconds 一旦回归
 * 就是 NaN 写进 Firestore。
 */
export const __testables = { applyWaypointOrder, parseDurationSeconds };

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
                    note: g.source === 'google-notraffic' ? '带实时路况那次失败了，已退回无路况路网排序' : null,
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
            note: apiKey
                ? 'Google Routes API 不可用（多半是没启用或 key 未放行），已用本地直线距离排序'
                : '未配置地图 key，已用本地直线距离排序',
        };
    } catch (err) {
        console.error('[routeOptimizer] 本地排序也失败 — 原样返回', err);
        return { ...fallback('排序全线失败'), coords, unlocatedOrderIds: unlocated };
    }
}
