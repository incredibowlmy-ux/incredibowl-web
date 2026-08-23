/**
 * 回填订阅与其生成订单的 deliveryDistanceKm。
 *
 * 背景：5 份在跑的订阅 deliveryDistanceKm=0（建档时前端自动套用「最近一单」，
 * 而最近一单正是同一订阅生成的 0 单 → 自我强化）。结果这些客户的自送单算不出
 * 「率×km×2」，只能退回 zone 默认 RM5，近 28 天 35 单配送成本因此是拍的。
 *
 * 取值来源：该客户历史上**真算出来过**的距离（网站下单时 Routes API 写入），
 * 取「同一地址、出现次数最多」的那个值。地址对不上或无历史 → 跳过并列出来。
 *
 *   node scripts/backfill-subscription-distance-2026-08-24.mjs          # dry-run
 *   node scripts/backfill-subscription-distance-2026-08-24.mjs --commit
 */
import admin from 'firebase-admin';
import fs from 'node:fs';
const COMMIT = process.argv.includes('--commit');
const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();
const Timestamp = admin.firestore.Timestamp;

const norm = s => String(s || '').toLowerCase().replace(/[\s,，.。\-]/g, '');
const digits = s => String(s || '').replace(/\D/g, '');
const tail8 = s => digits(s).slice(-8);

const subs = (await db.collection('subscriptions').get()).docs;
const all = (await db.collection('orders').get()).docs.map(d => ({ id: d.id, ...d.data() }));

const plan = [];      // { sub, km, orders[] }
const skipped = [];

for (const d of subs) {
    const s = d.data();
    if (Number(s.deliveryDistanceKm) > 0) continue;

    // 该客户所有带 km 的历史单（按电话尾 8 位配，姓名可能有变体）
    const t = tail8(s.phone);
    const hist = all.filter(o => t && tail8(o.userPhone) === t && Number(o.deliveryDistanceKm) > 0);
    if (!hist.length) { skipped.push({ name: s.name, phone: s.phone, why: '全库无带距离的历史单' }); continue; }

    // 众数取值：同一 km 出现最多的那个（防一次性异常值，如 Lee Yin 那单 1.5km）
    const tally = new Map();
    for (const o of hist) {
        const km = Number(o.deliveryDistanceKm);
        const e = tally.get(km) || { km, n: 0, addrs: new Set(), last: '' };
        e.n++; e.addrs.add(String(o.userAddress || '')); if (o.deliveryDate > e.last) e.last = o.deliveryDate;
        tally.set(km, e);
    }
    const best = [...tally.values()].sort((a, b) => b.n - a.n || b.last.localeCompare(a.last))[0];
    const addrMatch = [...best.addrs].some(a => norm(a) === norm(s.address));

    // 这份订阅生成的、缺 km 的单
    const orders = all.filter(o => o.subscriptionId === d.id && !(Number(o.deliveryDistanceKm) > 0)
        && o.status !== 'cancelled');
    plan.push({ id: d.id, name: s.name, phone: s.phone, address: s.address, km: best.km,
                n: best.n, addrMatch, variants: [...tally.values()].map(v => `${v.km}km×${v.n}`), orders });
}

// 订阅之外：手动单里缺 km、但客户有已知距离的（如 henny）
const subUserPhones = new Set(plan.map(p => tail8(p.phone)));
const loose = new Map();
for (const o of all) {
    if (o.status === 'cancelled' || o.deliveryMethod !== 'self') continue;
    if (Number(o.deliveryDistanceKm) > 0 || o.subscriptionId) continue;
    const t = tail8(o.userPhone);
    if (!t || subUserPhones.has(t)) continue;
    const hist = all.filter(x => tail8(x.userPhone) === t && Number(x.deliveryDistanceKm) > 0);
    if (!hist.length) continue;
    const tally = new Map();
    hist.forEach(x => tally.set(+x.deliveryDistanceKm, (tally.get(+x.deliveryDistanceKm) || 0) + 1));
    const km = [...tally].sort((a, b) => b[1] - a[1])[0][0];
    if (!loose.has(t)) loose.set(t, { name: o.userName, phone: o.userPhone, km, orders: [] });
    loose.get(t).orders.push(o);
}

console.log(`\n=== ${COMMIT ? '【真写 --commit】' : '【DRY-RUN】'} 订阅距离回填 ===\n`);
let subCount = 0, ordCount = 0;
for (const p of plan) {
    console.log(`${p.addrMatch ? '✅' : '⚠️'} ${p.name} ${p.phone} → ${p.km}km  （历史 ${p.variants.join(' / ')}${p.addrMatch ? '，地址一致' : '，地址串不同但同一客户'}）`);
    console.log(`   订阅 ${p.id} · 顺带回填 ${p.orders.length} 单`);
    subCount++; ordCount += p.orders.length;
}
console.log('');
for (const l of loose.values()) {
    console.log(`✅ ${l.name} ${l.phone} → ${l.km}km  （非订阅单 ${l.orders.length} 单）`);
    ordCount += l.orders.length;
}
if (skipped.length) {
    console.log(`\n❌ 跳过（需老板补地址后重算）：`);
    skipped.forEach(s => console.log(`   ${s.name} ${s.phone} — ${s.why}`));
}
console.log(`\n合计：${subCount} 份订阅 + ${ordCount} 单订单`);

if (COMMIT) {
    let batch = db.batch(), n = 0;
    const flush = async () => { if (n) { await batch.commit(); batch = db.batch(); n = 0; } };
    for (const p of plan) {
        batch.set(db.collection('subscriptions').doc(p.id),
            { deliveryDistanceKm: p.km, updatedAt: Timestamp.now() }, { merge: true }); n++;
        for (const o of p.orders) {
            batch.set(db.collection('orders').doc(o.id),
                { deliveryDistanceKm: p.km, updatedAt: Timestamp.now() }, { merge: true }); n++;
            if (n >= 400) await flush();
        }
        if (n >= 400) await flush();
    }
    for (const l of loose.values()) for (const o of l.orders) {
        batch.set(db.collection('orders').doc(o.id),
            { deliveryDistanceKm: l.km, updatedAt: Timestamp.now() }, { merge: true }); n++;
        if (n >= 400) await flush();
    }
    await flush();
    console.log('✅ 已写入。');
} else {
    console.log('▶ 确认无误后加 --commit。');
}
await admin.app().delete();
