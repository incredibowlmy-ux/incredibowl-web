/**
 * 清掉离厨房过远的垃圾坐标（Google 认不出模糊地址时回的半岛中心点）。
 *
 * 根因已在 src/lib/routeOptimizer.ts 修掉（geocodeOnce 写入口 + isFiniteCoord
 * 读取口都加了 MAX_SANE_GEOCODE_KM 校验）。这个脚本只负责扫掉已经落地的脏数据：
 *   - geocodeCache 里超范围的条目 → 删（下次遇到会重新查一次 Google）
 *   - orders 上超范围的 deliveryLat/deliveryLng → 删字段（该单退回「未定位」，
 *     排队尾 + /driver 标黄，比拿着错坐标导航强）
 *
 * 只删坐标，绝不碰 userAddress / deliveryDistanceKm / 任何金额字段。
 *
 * 用法：
 *   node scripts/purge-bad-geocode.mjs            # dry-run
 *   node scripts/purge-bad-geocode.mjs --commit   # 写库 + 回滚日志
 */
import admin from 'firebase-admin';
import fs from 'node:fs';

const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
const COMMIT = process.argv.includes('--commit');

// 与 src/lib/deliveryUtils.ts 保持一致
const PEARL_POINT_LAT = 3.0853475861917716;
const PEARL_POINT_LNG = 101.67428154483449;
const MAX_SANE_KM = 30;   // = routeOptimizer 的 MAX_SANE_GEOCODE_KM

const rad = d => d * Math.PI / 180;
const distKm = (lat, lng) => {
    const dLat = rad(lat - PEARL_POINT_LAT), dLng = rad(lng - PEARL_POINT_LNG);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(rad(PEARL_POINT_LAT)) * Math.cos(rad(lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(a));
};
const bad = (lat, lng) => typeof lat === 'number' && typeof lng === 'number'
    && isFinite(lat) && isFinite(lng) && distKm(lat, lng) > MAX_SANE_KM;

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();

// ── geocodeCache ────────────────────────────────────────
const cache = await db.collection('geocodeCache').get();
const badCache = cache.docs.filter(d => bad(d.data().lat, d.data().lng));
console.log(`\ngeocodeCache ${cache.size} 条，超 ${MAX_SANE_KM}km 的 ${badCache.length} 条：`);
badCache.forEach(d => {
    const c = d.data();
    console.log(`  ${distKm(c.lat, c.lng).toFixed(1).padStart(7)} km  「${c.address || '(无)'}」`);
    console.log(`            → ${c.lat}, ${c.lng}   Google 认成：${(c.formattedAddress || '').slice(0, 56)}`);
});

// ── orders ──────────────────────────────────────────────
const orders = (await db.collection('orders').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const badOrders = orders.filter(o => bad(o.deliveryLat, o.deliveryLng));
console.log(`\n订单 ${orders.length} 单，坐标超范围的 ${badOrders.length} 单：`);
badOrders.forEach(o => console.log(`  ${o.deliveryDate || '?'} #${o.id.slice(-6).toUpperCase()} ${(o.userName || '匿名').padEnd(14)} `
    + `${distKm(o.deliveryLat, o.deliveryLng).toFixed(1)}km  「${(o.userAddress || '').replace(/\n/g, ' ').slice(0, 34)}」`));

// ── 顺带体检：users 档案里有没有同样的脏坐标 ──────────────
const users = (await db.collection('users').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const badUsers = users.filter(u => bad(u.addressLat, u.addressLng));
console.log(`\n用户档案 ${users.length} 个，坐标超范围的 ${badUsers.length} 个` + (badUsers.length ? '：' : '（顾客端 /api/geocode 的 isBeyondServiceRange 挡住了，符合预期）'));
badUsers.forEach(u => console.log(`  ⚠️ ${u.name || u.id} ${distKm(u.addressLat, u.addressLng).toFixed(1)}km 「${(u.address || '').slice(0, 40)}」`));

if (!COMMIT) {
    console.log(`\n--dry（默认）：一个字节都没写。确认无误后加 --commit\n`);
    await admin.app().delete();
    process.exit(0);
}
if (badCache.length === 0 && badOrders.length === 0) {
    console.log('\n没有要清的数据。\n'); await admin.app().delete(); process.exit(0);
}

const stamp = new Date().toISOString().slice(0, 10);
const path = `scripts/_rollback-bad-geocode-${stamp}.json`;
fs.writeFileSync(path, JSON.stringify({
    ranAt: new Date().toISOString(),
    note: '还原：把 cache 条目按 doc id 写回 geocodeCache；把 orders 的 deliveryLat/Lng 写回。但这些坐标本来就是错的，正常不该还原。',
    cache: badCache.map(d => ({ docId: d.id, ...d.data(), createdAt: undefined })),
    orders: badOrders.map(o => ({ id: o.id, shortId: o.id.slice(-6).toUpperCase(), name: o.userName || '',
        date: o.deliveryDate || '', lat: o.deliveryLat, lng: o.deliveryLng })),
}, null, 2));
console.log(`\n📝 回滚日志已写：${path}`);

const { FieldValue } = await import('firebase-admin/firestore');
for (let i = 0; i < badCache.length; i += 400) {
    const b = db.batch();
    badCache.slice(i, i + 400).forEach(d => b.delete(d.ref));
    await b.commit();
}
for (let i = 0; i < badOrders.length; i += 400) {
    const b = db.batch();
    badOrders.slice(i, i + 400).forEach(o => b.update(db.collection('orders').doc(o.id), {
        deliveryLat: FieldValue.delete(),
        deliveryLng: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
    }));
    await b.commit();
}
console.log(`✅ 删缓存 ${badCache.length} 条 · 清订单坐标 ${badOrders.length} 单\n`);
await admin.app().delete();
