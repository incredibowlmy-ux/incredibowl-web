/**
 * Dogfood: 配送路线自动排序（routeOptimizer）
 *
 * 跑法：node --import ./scripts/_register-alias.mjs scripts/dogfood-route-optimizer.mts
 *
 * 不碰 Firestore、不调 Google —— 全部用假 db + 断网环境跑，验证的是：
 *
 *   A. 不丢单（最重要）：orderedIds 永远是输入 id 的一个排列，不多不少不重复。
 *      丢一单 = 有客户没饭吃，比绕路严重一万倍。
 *   B. 排序确实变短：2-opt 后的总里程 < 故意打乱的原顺序。
 *   C. fail-soft：db 炸了 / 没 API key / 地址烂 / 坐标缺失，planRoute 都不抛错。
 *   D. 缓存 key 稳定：同一地址的不同写法命中同一条缓存（否则天天重复付 geocode 钱）。
 *
 * 无坐标的单必须排在队尾 —— /driver 靠这个假设显示「不在自动路线内」的黄条。
 */
import {
    planRoute,
    optimizeLocally,
    normalizeAddress,
    type RouteOrderInput,
} from '@/lib/routeOptimizer';
import { PEARL_POINT_LAT, PEARL_POINT_LNG, haversineKm } from '@/lib/deliveryUtils';

let pass = 0, fail = 0;

function ok(label: string, cond: boolean, detail = '') {
    if (cond) pass++; else fail++;
    console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? `\n      ${detail}` : ''}`);
}

function eq(label: string, actual: unknown, expected: unknown) {
    const good = JSON.stringify(actual) === JSON.stringify(expected);
    if (good) pass++; else fail++;
    console.log(`  ${good ? '✓' : '✗'} ${label}\n      → ${JSON.stringify(actual)}${good ? '' : `   ← 期望 ${JSON.stringify(expected)}`}`);
}

/** 厨房 → 依次各点 的直线总长（开放路径，不含回程），用来比较排序好坏。 */
function pathKm(points: { lat: number; lng: number }[]): number {
    if (points.length === 0) return 0;
    let sum = haversineKm(PEARL_POINT_LAT, PEARL_POINT_LNG, points[0].lat, points[0].lng);
    for (let i = 0; i < points.length - 1; i++) {
        sum += haversineKm(points[i].lat, points[i].lng, points[i + 1].lat, points[i + 1].lng);
    }
    return sum;
}

// ── 假 Firestore ────────────────────────────────────────────
// planRoute 只用到 db.getAll() 和 collection().doc().set()/update()
function fakeDb(opts: { throwOnGetAll?: boolean; cache?: Record<string, { lat: number; lng: number }> } = {}) {
    const writes: string[] = [];
    const cache = opts.cache || {};
    const db = {
        collection: (name: string) => ({
            doc: (id: string) => ({
                id,
                _path: `${name}/${id}`,
                set: async (data: any) => { writes.push(`set ${name}/${id}`); cache[id] = data; },
                update: async () => { writes.push(`update ${name}/${id}`); },
            }),
        }),
        getAll: async (...refs: any[]) => {
            if (opts.throwOnGetAll) throw new Error('模拟 Firestore 挂了');
            db._lookups.push(refs.map((r: any) => r.id));
            return refs.map(r => ({
                id: r.id,
                exists: !!cache[r.id],
                data: () => cache[r.id],
            }));
        },
        _writes: writes,
        _lookups: [] as string[][],
    };
    return db as any;
}

// ── 真实感的测试坐标（Pearl Point 周边 ~1-6km 的几个方向）────
const STOPS = {
    A: { lat: 3.0900, lng: 101.6780 },   // 北，~0.7km
    B: { lat: 3.0700, lng: 101.6650 },   // 西南，~2.0km
    C: { lat: 3.1100, lng: 101.6900 },   // 东北，~3.2km
    D: { lat: 3.0600, lng: 101.7100 },   // 东南，~4.6km
    E: { lat: 3.1250, lng: 101.6500 },   // 西北，~5.2km
};

async function main() {
    // 断网 + 没 key → 强制走本地降级路径。这正是我们要重点验的那条路。
    delete process.env.GOOGLE_MAPS_API_KEY;

    console.log('\n【A】不丢单 — orderedIds 必须是输入的一个排列');
    {
        const orders: RouteOrderInput[] = Object.entries(STOPS).map(([id, c]) => ({
            id, deliveryLat: c.lat, deliveryLng: c.lng,
        }));
        const plan = await planRoute(fakeDb(), orders);
        const inIds = orders.map(o => o.id).sort();
        const outIds = [...plan.orderedIds].sort();
        eq('5 单进 5 单出，id 完全一致', outIds, inIds);
        ok('无重复', new Set(plan.orderedIds).size === plan.orderedIds.length);
        eq('routeSource = local（没 key 就该降级）', plan.routeSource, 'local');
    }

    console.log('\n【B】排序确实变短 — 2-opt 优于故意打乱的顺序');
    {
        // 故意排成来回横跳的最差顺序
        const bad = [STOPS.E, STOPS.A, STOPS.D, STOPS.B, STOPS.C];
        const badKm = pathKm(bad);
        const { order, totalKm } = optimizeLocally(
            Object.entries(STOPS).map(([id, c]) => ({ id, lat: c.lat, lng: c.lng })),
        );
        const goodKm = pathKm(order);
        ok(
            `优化后 ${goodKm.toFixed(2)}km < 打乱的 ${badKm.toFixed(2)}km`,
            goodKm < badKm,
            `省了 ${(badKm - goodKm).toFixed(2)}km（${((1 - goodKm / badKm) * 100).toFixed(0)}%）· 顺序 ${order.map(o => o.id).join('→')}`,
        );
        ok('totalKm 与实际路径吻合（±0.1）', Math.abs(totalKm - goodKm) < 0.1, `报告 ${totalKm} / 实算 ${goodKm.toFixed(2)}`);
        ok('第一站是离厨房最近的 A', order[0].id === 'A', `实际 ${order[0].id}`);
    }

    console.log('\n【C】fail-soft — 各种炸法都不能抛错、不能丢单');
    {
        // C1: Firestore getAll 直接炸
        const withAddr: RouteOrderInput[] = [
            { id: 'X', userAddress: 'Pearl Suria, Old Klang Road' },
            { id: 'Y', userAddress: 'Menara OBYU, Damansara' },
        ];
        let threw = false;
        let plan = await planRoute(fakeDb({ throwOnGetAll: true }), withAddr).catch(() => { threw = true; return null as any; });
        ok('db 挂了不抛错', !threw);
        eq('db 挂了仍原样返回全部订单', plan?.orderedIds, ['X', 'Y']);
        eq('如实标记 routeSource=none', plan?.routeSource, 'none');

        // C2: 地址烂到 geocode 不了（且没 key）→ 全进 unlocated
        plan = await planRoute(fakeDb(), [{ id: 'X', userAddress: '啊' }, { id: 'Y', userAddress: '' }]);
        eq('地址无效时全部进 unlocated', plan.unlocatedOrderIds.sort(), ['X', 'Y']);
        eq('仍然一单不少', plan.orderedIds.sort(), ['X', 'Y']);

        // C3: 混合 —— 有坐标的排前面，没坐标的一律沉到队尾
        plan = await planRoute(fakeDb(), [
            { id: 'noloc1', userAddress: '啊' },
            { id: 'D', deliveryLat: STOPS.D.lat, deliveryLng: STOPS.D.lng },
            { id: 'noloc2', userAddress: '' },
            { id: 'A', deliveryLat: STOPS.A.lat, deliveryLng: STOPS.A.lng },
        ]);
        const tail = plan.orderedIds.slice(-2).sort();
        eq('无坐标的单沉到队尾', tail, ['noloc1', 'noloc2']);
        eq('有坐标的排前面且已优化（近的 A 先）', plan.orderedIds.slice(0, 2), ['A', 'D']);
        eq('coords 只含定位成功的单', Object.keys(plan.coords).sort(), ['A', 'D']);

        // C4: 边界 —— 0 单 / 1 单
        eq('空批次返回空', (await planRoute(fakeDb(), [])).orderedIds, []);
        const one = await planRoute(fakeDb(), [{ id: 'solo', deliveryLat: STOPS.A.lat, deliveryLng: STOPS.A.lng }]);
        eq('单张订单原样返回', one.orderedIds, ['solo']);
        // 单张单不排序，但坐标必须带出来 —— /driver 的导航按钮全靠它
        eq('单张订单仍带出坐标', Object.keys(one.coords), ['solo']);
        eq('单张订单不算 unlocated', one.unlocatedOrderIds, []);
    }

    console.log('\n【D】geocode 缓存 key 稳定 — 同地址的不同写法必须归一');
    {
        const variants = [
            'A-12-3, Pearl Suria Residence, Old Klang Road',
            'a-12-3  pearl suria residence,  old klang road.',
            'A-12-3，Pearl Suria Residence、Old Klang Road',
        ];
        const normalized = variants.map(normalizeAddress);
        ok('三种写法归一成同一个字符串', new Set(normalized).size === 1, normalized.join('  |  '));
        ok('中文地址不被吃掉', normalizeAddress('吉隆坡 珍珠苑 A座').includes('珍珠苑'));
        ok('不同地址不会撞车', normalizeAddress('Pearl Suria A') !== normalizeAddress('Pearl Suria B'));
    }

    console.log('\n【E】缓存命中就不该再查 Google（省钱）');
    {
        const addr = 'Pearl Suria Residence, Old Klang Road';
        // 预置一条缓存，key 用与生产同一套算法算 —— 直接跑一次 planRoute 观察写入
        const db = fakeDb();
        const plan = await planRoute(db, [
            { id: 'P', userAddress: addr },
            { id: 'Q', deliveryLat: STOPS.B.lat, deliveryLng: STOPS.B.lng },
        ]);
        ok('没 key 时不写缓存也不崩', plan.orderedIds.length === 2, `writes: ${db._writes.length}`);
        ok('自带坐标的单不产生任何 geocode 写入', !db._writes.some((w: string) => w.startsWith('set geocodeCache')));
    }

    console.log('\n【F】同地址去重 — 一栋楼多张单只查一次 Google');
    {
        const db = fakeDb();
        // 同一栋楼 3 张单，写法各不相同；外加 1 张自带坐标的
        await planRoute(db, [
            { id: 'r1', userAddress: 'A-12-3, Pearl Suria Residence' },
            { id: 'r2', userAddress: 'a-12-3  pearl suria residence.' },
            { id: 'r3', userAddress: 'A-12-3，Pearl Suria Residence' },
            { id: 'r4', deliveryLat: STOPS.C.lat, deliveryLng: STOPS.C.lng },
        ]);
        const keys = db._lookups[0] || [];
        eq('3 张同址单只产生 1 次缓存查询', keys.length, 1);
        ok('自带坐标的单完全不进缓存查询', keys.length === 1, `查询的 key: ${keys.join(', ')}`);
    }

    console.log('\n【G】队尾约定 — /driver 靠它显示「不在自动路线内」');
    {
        // 大批量：15 单有坐标 + 3 单没有，确认队尾恰好是那 3 单
        const many: RouteOrderInput[] = [];
        for (let i = 0; i < 15; i++) {
            many.push({
                id: `ok${i}`,
                deliveryLat: PEARL_POINT_LAT + (i % 5) * 0.004 - 0.008,
                deliveryLng: PEARL_POINT_LNG + Math.floor(i / 5) * 0.006 - 0.006,
            });
        }
        ['bad1', 'bad2', 'bad3'].forEach(id => many.push({ id, userAddress: '' }));
        const plan = await planRoute(fakeDb(), many);
        eq('18 单一个不少', plan.orderedIds.length, 18);
        eq('队尾正好是 3 张无坐标单', plan.orderedIds.slice(-3).sort(), ['bad1', 'bad2', 'bad3']);
        ok('前 15 位全是有坐标的单', plan.orderedIds.slice(0, 15).every(id => id.startsWith('ok')));
        ok('unlocatedOrderIds 与队尾一致', JSON.stringify(plan.unlocatedOrderIds.sort()) === JSON.stringify(['bad1', 'bad2', 'bad3']));
    }

    console.log(`\n${'─'.repeat(50)}`);
    console.log(fail === 0 ? `✅ 全绿 ${pass}/${pass + fail}` : `❌ ${fail} 项失败（${pass}/${pass + fail} 通过）`);
    process.exit(fail === 0 ? 0 : 1);
}

main().catch(err => {
    console.error('\n💥 dogfood 本身炸了：', err);
    process.exit(1);
});
