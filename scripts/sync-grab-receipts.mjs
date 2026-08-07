// Weekly sync: after记账 updates Accounting deliveries.csv with new Grab receipts,
// run this to stamp the matching Firestore orders (deliveryMethod + actual cost +
// distance) and refresh the unlinked-receipt spend list in dashboardConfig/delivery.
// Idempotent — safe to re-run any time; only writes docs whose values would change.
//
// Usage:
//   node scripts/sync-grab-receipts.mjs                       # sync receipts, report unclassified
//   node scripts/sync-grab-receipts.mjs --rest-self 2026-07-24  # 之后把 ≤该日 仍未分类的配送单标自送
//   node scripts/sync-grab-receipts.mjs --dry                 # preview only
import admin from 'firebase-admin';
import fs from 'node:fs';
import { KEY, loadReceipts, loadOrders, matchReceipts } from './lib-delivery-match.mjs';

const DRY = process.argv.includes('--dry');
const restSelfIdx = process.argv.indexOf('--rest-self');
const REST_SELF_UNTIL = restSelfIdx >= 0 ? process.argv[restSelfIdx + 1] : null;
if (restSelfIdx >= 0 && !/^\d{4}-\d{2}-\d{2}$/.test(REST_SELF_UNTIL || '')) {
    console.error('--rest-self 需要 YYYY-MM-DD 日期'); process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();

const receipts = loadReceipts();
const orders = await loadOrders(db);
const { matchedPairs, unmatchedReceipts, usedOrderIds } = matchReceipts(orders, receipts);

const phoneCore = (v) => String(v || '').replace(/\D/g, '').replace(/^60/, '').replace(/^0/, '');
const kmByPhone = new Map();
for (const o of orders) {
    if (typeof o.km === 'number' && o.phone) {
        const pc = phoneCore(o.phone);
        if (!kmByPhone.has(pc)) kmByPhone.set(pc, o.km);
    }
}

const updates = [];
// 1) receipts → grab/driver（含把之前误标 self 的升级成 grab，晚到收据场景）
for (const { r, o } of matchedPairs) {
    const method = /manual driver/i.test(r.vehicle || '') ? 'driver' : 'grab';
    const fee = parseFloat(r.fee);
    const km = parseFloat(r.km);
    const set = {};
    if (o.method !== method) set.deliveryMethod = method;
    if (Number.isFinite(fee) && o.costActual !== fee) set.deliveryCostActual = fee;
    if (Number.isFinite(km) && typeof o.km !== 'number') set.deliveryDistanceKm = km;
    if (Object.keys(set).length) updates.push({ id: o.id, set, tag: o.method === 'self' ? `self→${method}` : method, label: `${o.date} ${o.name} #${o.shortId}` });
}
// 2) optionally: remaining unclassified delivery orders ≤ REST_SELF_UNTIL → self
const unclassified = orders.filter(o =>
    !usedOrderIds.has(o.id) && !o.method && o.zone !== null && o.zone !== undefined);
if (REST_SELF_UNTIL) {
    for (const o of unclassified.filter(o => o.date <= REST_SELF_UNTIL)) {
        // 地址空 = 到店自取（老板 2026-08-07 确认）。以前这里一律标 self，
        // 把 62 单自取单按 zone 默认记了 RM310 的假配送成本；自取的真实成本是 0。
        // 但「地址空」只是自取的强信号不是铁证 —— 收了运费或上过配送车的照旧算自送。
        const isPickup = !String(o.addr || '').trim()
            && !(Number(o.fee) > 0)
            && !o.batchId;
        if (isPickup) {
            updates.push({ id: o.id, set: { deliveryMethod: 'pickup' }, tag: 'pickup',
                label: `${o.date} ${o.name} #${o.shortId}（地址空 → 自取）` });
            continue;
        }
        const set = { deliveryMethod: 'self' };
        if (typeof o.km !== 'number') {
            const km = kmByPhone.get(phoneCore(o.phone));
            if (typeof km === 'number') set.deliveryDistanceKm = km;
        }
        updates.push({ id: o.id, set, tag: 'self', label: `${o.date} ${o.name} #${o.shortId}` });
    }
}

const counts = updates.reduce((m, u) => (m[u.tag] = (m[u.tag] || 0) + 1, m), {});
console.log(`收据 ${receipts.length} · 配上 ${matchedPairs.length} · 计划写 ${updates.length} 单：`, counts);
updates.filter(u => u.tag.startsWith('self→')).forEach(u => console.log(`  ⚠️ 升级 ${u.label}（之前标自送，现有收据）`));
if (unmatchedReceipts.length) {
    console.log(`未挂单收据 ${unmatchedReceipts.length} 笔（写入 cfg.unlinkedDeliverySpend）：`);
    unmatchedReceipts.forEach(r => console.log(`  ${r.date} ${r.client} RM${r.fee}`));
}
const stillUnclassified = unclassified.filter(o => !REST_SELF_UNTIL || o.date > REST_SELF_UNTIL);
if (stillUnclassified.length) {
    console.log(`仍未分类的配送单 ${stillUnclassified.length} 单（确认没有 Grab 后可用 --rest-self <日期> 批量标自送）：`);
    stillUnclassified.slice(0, 30).forEach(o => console.log(`  ${o.date} ${o.name} #${o.shortId}`));
    if (stillUnclassified.length > 30) console.log(`  … 共 ${stillUnclassified.length} 单`);
}

if (DRY) { console.log('--dry：未写任何数据'); await admin.app().delete(); process.exit(0); }

for (let i = 0; i < updates.length; i += 400) {
    const batch = db.batch();
    for (const u of updates.slice(i, i + 400)) batch.update(db.collection('orders').doc(u.id), u.set);
    await batch.commit();
}
const unlinked = unmatchedReceipts.map(r => ({
    date: r.date,
    rm: parseFloat(r.fee) || 0,
    note: r.client && !r.client.startsWith('(') ? r.client : (r.area || ''),
    file: r.file || '',
}));
await db.collection('dashboardConfig').doc('delivery').set({ unlinkedDeliverySpend: unlinked }, { merge: true });
console.log(`✅ 同步完成：写 ${updates.length} 单 + 未挂单支出 ${unlinked.length} 笔 RM ${unlinked.reduce((s, x) => s + x.rm, 0).toFixed(2)}`);
await admin.app().delete();
