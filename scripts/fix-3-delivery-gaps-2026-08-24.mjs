/**
 * 老板 2026-08-24 给的三单配送方式/地址补全。
 *
 *   Sam Cheong   08-03  → 自取（我的 --rest-self 排除法把它误扫成自送；
 *                          该客户另外 2 单本来就标 pickup）
 *   Samantha Sum 08-10  → 自取（同上）
 *   Joey Ng      08-13  → 自送，地址 249 Jalan Sekata, Taman United
 *                          距离 0.33km（线上 /api/geocode 实算，partialMatch=false，
 *                          与网站下单写 deliveryDistanceKm 同一口径）
 *
 *   node scripts/fix-3-delivery-gaps-2026-08-24.mjs            # dry-run
 *   node scripts/fix-3-delivery-gaps-2026-08-24.mjs --commit
 */
import admin from 'firebase-admin';
import fs from 'node:fs';
const COMMIT = process.argv.includes('--commit');
const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();
const Timestamp = admin.firestore.Timestamp;

const JOEY_ADDRESS = '249, Jalan Sekata, Taman United, 58200 Kuala Lumpur';
const JOEY_KM = 0.33;

const FIXES = [
    { name: 'Sam Cheong',   phone: '0127826610', date: '2026-08-03',
      set: { deliveryMethod: 'pickup' }, why: '自取（老板确认）' },
    { name: 'Samantha Sum', phone: '0162108005', date: '2026-08-10',
      set: { deliveryMethod: 'pickup' }, why: '自取（老板确认）' },
    { name: 'Joey Ng',      phone: '0193218281', date: '2026-08-13',
      set: { deliveryMethod: 'self', userAddress: JOEY_ADDRESS, deliveryDistanceKm: JOEY_KM },
      why: `自送 · 地址补全 · 0.33km（geocode 实算）` },
];

const all = (await db.collection('orders').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const t8 = s => String(s || '').replace(/\D/g, '').slice(-8);

console.log(`\n=== ${COMMIT ? '【真写 --commit】' : '【DRY-RUN】'} 三单配送补全 ===\n`);
const writes = [];
let abort = false;
for (const f of FIXES) {
    const hits = all.filter(o => t8(o.userPhone) === t8(f.phone) && o.deliveryDate === f.date && o.status !== 'cancelled');
    if (hits.length !== 1) {
        console.log(`❌ ${f.name} ${f.date}：预期 1 单，实得 ${hits.length} 单 —— 停手，别乱改`);
        abort = true; continue;
    }
    const o = hits[0];
    const before = { method: o.deliveryMethod, km: o.deliveryDistanceKm, addr: o.userAddress || '(空)' };
    console.log(`✅ ${f.name}  ${f.date}  #${o.id.slice(0, 6)}   ${f.why}`);
    console.log(`   method ${before.method} → ${f.set.deliveryMethod}` +
        (f.set.deliveryDistanceKm !== undefined ? ` · km ${before.km ?? '(无)'} → ${f.set.deliveryDistanceKm}` : '') +
        (f.set.userAddress ? `\n   地址「${before.addr}」→「${f.set.userAddress}」` : ''));
    writes.push({ id: o.id, set: f.set, userId: o.userId, name: f.name });
}
if (abort) { console.log('\n有对不上的，全部不写。'); await admin.app().delete(); process.exit(1); }

// Joey Ng 的地址+距离同时写进 users 档案，下次下单/建订阅自动带出来
const joey = writes.find(w => w.name === 'Joey Ng');
let joeyUserDoc = null;
if (joey?.userId) {
    const snap = await db.collection('users').doc(joey.userId).get();
    joeyUserDoc = snap.exists ? joey.userId : null;
    console.log(`\nJoey Ng users/${joey.userId} ${snap.exists ? '存在 → 顺带写 address + deliveryDistanceKm' : '不存在（manual stub）→ 只改订单'}`);
}

if (COMMIT) {
    const batch = db.batch();
    for (const w of writes) batch.set(db.collection('orders').doc(w.id), { ...w.set, updatedAt: Timestamp.now() }, { merge: true });
    if (joeyUserDoc) batch.set(db.collection('users').doc(joeyUserDoc),
        { address: JOEY_ADDRESS, deliveryDistanceKm: JOEY_KM, updatedAt: Timestamp.now() }, { merge: true });
    await batch.commit();
    console.log(`\n✅ 已写入 ${writes.length} 单${joeyUserDoc ? ' + 1 个 users 档案' : ''}。`);
} else {
    console.log('\n▶ 确认无误后加 --commit。');
}
await admin.app().delete();
