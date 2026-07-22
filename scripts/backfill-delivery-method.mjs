// One-off backfill (boss approved 2026-07-23): stamp deliveryMethod on historical
// orders and write actual Grab/driver cost from receipts.
//   grab/driver ← deliveries.csv matched receipts (cost = receipt fee, authoritative)
//   self        ← every other delivery order in the receipt window（老板确认 all by me）
//   pickup      ← deliveryZone === null
// Also: unlinked receipts (no order) → dashboardConfig/delivery.unlinkedDeliverySpend,
// and seeds self-delivery cost-rate defaults (petrol RM1.99/L × 11L/100km + maint
// RM0.13/km) into the same cfg doc WITHOUT overwriting existing values.
// Safety: full before-image rollback log; idempotent (skips docs already stamped);
// orders with an existing deliveryCostActual but no receipt are FLAGGED, not stamped.
// Usage: node scripts/backfill-delivery-method.mjs [--dry]
import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';
import { KEY, loadReceipts, loadOrders, matchReceipts } from './lib-delivery-match.mjs';

const DRY = process.argv.includes('--dry');

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();

const receipts = loadReceipts();
const orders = await loadOrders(db);
const { matchedPairs, unmatchedReceipts, usedOrderIds } = matchReceipts(orders, receipts);
const END = receipts.map(r => r.date).sort().at(-1);

// users → addressDistanceKm lookup (for self orders missing deliveryDistanceKm)
const usersSnap = await db.collection('users').get();
const kmByUid = new Map();
const kmByPhone = new Map();
const phoneCore = (v) => String(v || '').replace(/\D/g, '').replace(/^60/, '').replace(/^0/, '');
usersSnap.docs.forEach(d => {
    const u = d.data();
    if (typeof u.addressDistanceKm === 'number') {
        kmByUid.set(d.id, u.addressDistanceKm);
        if (u.phone) kmByPhone.set(phoneCore(u.phone), u.addressDistanceKm);
    }
});
// fallback: any order of the same phone that has a km
for (const o of orders) {
    if (typeof o.km === 'number' && o.phone) {
        const pc = phoneCore(o.phone);
        if (!kmByPhone.has(pc)) kmByPhone.set(pc, o.km);
    }
}

const updates = [];   // {id, set, before, tag}
const flagged = [];   // suspicious: costActual set but no receipt

// 1) matched receipts → grab / driver
for (const { r, o } of matchedPairs) {
    if (o.method) continue;  // already stamped (idempotent)
    const method = /manual driver/i.test(r.vehicle || '') ? 'driver' : 'grab';
    const fee = parseFloat(r.fee);
    const km = parseFloat(r.km);
    const set = { deliveryMethod: method };
    if (Number.isFinite(fee)) set.deliveryCostActual = fee;
    if (Number.isFinite(km) && typeof o.km !== 'number') set.deliveryDistanceKm = km;
    updates.push({ id: o.id, set, before: pick(o), tag: method });
}

// 2) unmatched delivery orders in window → self（老板确认 all by me）
for (const o of orders) {
    if (usedOrderIds.has(o.id) || o.method || o.date > END) continue;
    if (o.zone === null || o.zone === undefined) continue; // handled as pickup below
    if (typeof o.costActual === 'number') { flagged.push(o); continue; }  // 有旧实付成本却无收据 → 人工看
    const set = { deliveryMethod: 'self' };
    if (typeof o.km !== 'number') {
        const km = kmByUid.get(o.userId) ?? kmByPhone.get(phoneCore(o.phone));
        if (typeof km === 'number') set.deliveryDistanceKm = km;
    }
    updates.push({ id: o.id, set, before: pick(o), tag: 'self' });
}

// 3) zone-null in window → pickup
for (const o of orders) {
    if (usedOrderIds.has(o.id) || o.method || o.date > END) continue;
    if (o.zone === null || o.zone === undefined) {
        updates.push({ id: o.id, set: { deliveryMethod: 'pickup' }, before: pick(o), tag: 'pickup' });
    }
}

function pick(o) {
    return { deliveryMethod: o.method ?? null, deliveryCostActual: o.costActual ?? null, deliveryDistanceKm: o.km ?? null };
}

const counts = updates.reduce((m, u) => (m[u.tag] = (m[u.tag] || 0) + 1, m), {});
const noKm = updates.filter(u => u.tag === 'self' && !u.set.deliveryDistanceKm && u.before.deliveryDistanceKm == null).length;
console.log(`计划写入 ${updates.length} 单：`, counts, `· 自送缺距离 ${noKm} 单（dashboard 会退回 zone 估算）`);
if (flagged.length) {
    console.log(`⚠️ ${flagged.length} 单有 deliveryCostActual 但无收据，本次跳过请人工看：`);
    flagged.forEach(o => console.log(`   ${o.date} ${o.name} #${o.shortId} costActual=${o.costActual}`));
}

// unlinked receipts → cfg（含 5/27 Chloe catering、6/4-6/5 未记名、6/17-18 多单混送）
const unlinked = unmatchedReceipts.map(r => ({
    date: r.date,
    rm: parseFloat(r.fee) || 0,
    note: r.client && !r.client.startsWith('(') ? r.client : (r.area || ''),
    file: r.file || '',
}));
console.log(`未挂单配送支出 ${unlinked.length} 笔，共 RM ${unlinked.reduce((s, x) => s + x.rm, 0).toFixed(2)} → dashboardConfig/delivery.unlinkedDeliverySpend`);

if (DRY) { console.log('--dry：未写任何数据'); await admin.app().delete(); process.exit(0); }

// rollback log BEFORE writing
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const rollbackPath = path.resolve(`analytics/backfill-delivery-method-rollback-${stamp}.json`);
fs.mkdirSync(path.dirname(rollbackPath), { recursive: true });
fs.writeFileSync(rollbackPath, JSON.stringify({ ranAt: new Date().toISOString(), updates: updates.map(u => ({ id: u.id, before: u.before, set: u.set })) }, null, 2), 'utf-8');
console.log(`回滚日志 → ${rollbackPath}`);

// batched writes
for (let i = 0; i < updates.length; i += 400) {
    const batch = db.batch();
    for (const u of updates.slice(i, i + 400)) batch.update(db.collection('orders').doc(u.id), u.set);
    await batch.commit();
    console.log(`  已写 ${Math.min(i + 400, updates.length)}/${updates.length}`);
}

// cfg: unlinked spend (replace whole array = same csv-derived truth) + rate defaults only-if-absent
const cfgRef = db.collection('dashboardConfig').doc('delivery');
const cfgSnap = await cfgRef.get();
const cfg = cfgSnap.exists ? cfgSnap.data() : {};
const cfgSet = { unlinkedDeliverySpend: unlinked };
if (typeof cfg.petrolPriceRm !== 'number') cfgSet.petrolPriceRm = 1.99;   // 账本 6 笔加油全 RM1.99/L
if (typeof cfg.fuelL100km !== 'number') cfgSet.fuelL100km = 11;           // CX-5 老板报
if (typeof cfg.maintPerKm !== 'number') cfgSet.maintPerKm = 0.13;         // 估算 RM0.10 × 1.3（老板要求+30%）
await cfgRef.set(cfgSet, { merge: true });
console.log('cfg 已写：', Object.keys(cfgSet).join(', '));

console.log('✅ 回填完成');
await admin.app().delete();
