/**
 * 给缺 deliveryDistanceKm 的自送单补距离 —— 只从**完全同一个地址**的其它订单抄。
 *
 * 为什么严格到地址而不是按电话：同一个客户可能搬过家。按电话抄会把 A 地址的
 * 距离盖到 B 地址上，产生一个看起来很确定的错数字（实测 PY•玉 就是这种情况，
 * 按电话能"补"12 单，按地址一单都补不了 —— 那 12 单就该老实留空）。
 *
 * 来源距离的可信度：这些值原本都是 /api/geocode 写的，那条链路有
 * isBeyondServiceRange 校验（>25km 直接 422），所以不会是垃圾坐标算出来的。
 *
 * 零 Google API 成本 —— 纯粹搬运库里已有的数据。
 *
 * 用法：
 *   node scripts/backfill-distance-from-same-address.mjs            # dry-run
 *   node scripts/backfill-distance-from-same-address.mjs --commit   # 写库 + 回滚日志
 */
import admin from 'firebase-admin';
import fs from 'node:fs';

const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
const COMMIT = process.argv.includes('--commit');
const MAX_SANE_KM = 30;

// 与 routeOptimizer.normalizeAddress 同一套：标点全丢当分隔符，
// 否则「Jalan Klang Lama,」和「Jalan Klang Lama」会被当成两个地址
const norm = s => String(s || '').toLowerCase().replace(/[^\w一-鿿]+/g, ' ').replace(/\s+/g, ' ').trim();

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();
const orders = (await db.collection('orders').get()).docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(o => o.status !== 'cancelled');

const kmByAddr = new Map();
for (const o of orders) {
    const a = norm(o.userAddress);
    const km = Number(o.deliveryDistanceKm);
    if (!a || !(km > 0) || km > MAX_SANE_KM) continue;
    if (!kmByAddr.has(a)) kmByAddr.set(a, { km, src: o.id.slice(-6).toUpperCase() });
}

const need = orders.filter(o => o.deliveryMethod === 'self'
    && !(Number(o.deliveryDistanceKm) > 0) && String(o.userAddress || '').trim());

const targets = [], stuck = [];
for (const o of need) {
    const hit = kmByAddr.get(norm(o.userAddress));
    (hit ? targets : stuck).push(hit ? { o, ...hit } : o);
}

console.log(`\n自送单缺距离 ${need.length} 单\n${'═'.repeat(64)}`);
console.log(`✏️  同地址可回填：${targets.length} 单\n`);
const grouped = new Map();
targets.forEach(t => {
    const k = norm(t.o.userAddress);
    if (!grouped.has(k)) grouped.set(k, { name: t.o.userName, addr: (t.o.userAddress || '').replace(/\n/g, ' '), km: t.km, src: t.src, n: 0 });
    grouped.get(k).n++;
});
[...grouped.values()].sort((a, b) => b.n - a.n).forEach(g =>
    console.log(`  ${String(g.n).padStart(2)} 单  ${(g.name || '匿名').padEnd(14)} → ${String(g.km).padStart(5)} km  （抄自同地址的 #${g.src}）\n        「${g.addr.slice(0, 54)}」`));

console.log(`\n${'═'.repeat(64)}\n❌ 补不了：${stuck.length} 单 —— 这些地址库里从来没成功解析过\n`);
const sg = new Map();
stuck.forEach(o => { const k = norm(o.userAddress);
    if (!sg.has(k)) sg.set(k, { name: o.userName, addr: (o.userAddress || '').replace(/\n/g, ' '), n: 0 });
    sg.get(k).n++; });
[...sg.values()].sort((a, b) => b.n - a.n).forEach(g =>
    console.log(`  ${String(g.n).padStart(2)} 单  ${(g.name || '匿名').padEnd(14)} 「${g.addr.slice(0, 50)}」`));
if (stuck.length) console.log(`\n  → 这几个地址太简略，Google 认不出（会回整个「Malaysia」）。要修得让客户补上\n    完整地址：楼盘全名 + 路名 + 邮编。补完在 dashboard 订单里改一次地址即可。`);

if (!COMMIT) { console.log(`\n--dry（默认）：一个字节都没写。确认无误后加 --commit\n`); await admin.app().delete(); process.exit(0); }
if (!targets.length) { console.log('\n没有可回填的单。\n'); await admin.app().delete(); process.exit(0); }

const stamp = new Date().toISOString().slice(0, 10);
const path = `scripts/_rollback-distance-backfill-${stamp}.json`;
fs.writeFileSync(path, JSON.stringify({
    ranAt: new Date().toISOString(),
    note: '还原：把 deliveryDistanceKm 删掉即可（这些单原本就没有这个字段）',
    orders: targets.map(t => ({ id: t.o.id, shortId: t.o.id.slice(-6).toUpperCase(),
        name: t.o.userName || '', date: t.o.deliveryDate || '', wroteKm: t.km, copiedFrom: t.src })),
}, null, 2));
console.log(`\n📝 回滚日志已写：${path}`);

const { FieldValue } = await import('firebase-admin/firestore');
for (let i = 0; i < targets.length; i += 400) {
    const b = db.batch();
    targets.slice(i, i + 400).forEach(t => b.update(db.collection('orders').doc(t.o.id), {
        deliveryDistanceKm: t.km,
        updatedAt: FieldValue.serverTimestamp(),
    }));
    await b.commit();
}
console.log(`✅ 已回填 ${targets.length} 单的距离\n`);
await admin.app().delete();
