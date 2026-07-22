// READ-ONLY: match Accounting deliveries.csv (Grab/private-driver receipts) against
// Firestore orders and write a review report. Matching logic lives in
// scripts/lib-delivery-match.mjs (shared with backfill + weekly sync).
// Usage: node scripts/match-deliveries-to-orders.mjs
// Output: analytics/delivery-method-match-report.md  (+ console summary)
import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';
import { KEY, loadReceipts, loadOrders, matchReceipts } from './lib-delivery-match.mjs';

const OUT = path.resolve('analytics/delivery-method-match-report.md');

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();

const receipts = loadReceipts();
const orders = await loadOrders(db);
const { matchedPairs, unmatchedReceipts, usedOrderIds } = matchReceipts(orders, receipts);

const END = receipts.map(r => r.date).sort().at(-1);
const candidateSelf = orders.filter(o =>
    !usedOrderIds.has(o.id) && o.date <= END &&
    o.zone !== null && o.zone !== undefined
);
const zoneless = orders.filter(o => !usedOrderIds.has(o.id) && o.date <= END && (o.zone === null || o.zone === undefined));

const L = [];
L.push('# 配送方式配对报告（只读，未写任何数据）');
L.push('');
L.push(`> 生成：${new Date().toISOString().slice(0, 10)} · 收据窗口 ${receipts[0]?.date} → ${END}`);
L.push(`> 收据（去重后）${receipts.length} 趟 · 窗口内非取消订单 ${orders.filter(o => o.date <= END).length} 单`);
L.push('');
L.push(`## ✅ 配上的（${matchedPairs.length} 趟）→ 将标 Grab / 私人司机 + 写实付成本`);
L.push('');
L.push('| 送达日 | 客户(收据) | 订单客户 | 订单ID尾6位 | 距离km | 实付RM | 工具 |');
L.push('|---|---|---|---|---:|---:|---|');
for (const { r, o, off } of matchedPairs)
    L.push(`| ${r.date}${off ? ` (单${off > 0 ? '+1' : '-1'}d)` : ''} | ${r.client} | ${o.name} | ${o.shortId} | ${r.km} | ${r.fee} | ${r.vehicle} |`);
L.push('');
L.push(`## ❓ 有收据但找不到订单（${unmatchedReceipts.length} 趟）— 将记入「未挂单配送支出」`);
L.push('');
L.push('| 送达日 | 客户 | 区域 | 距离km | 实付RM | 收据文件 |');
L.push('|---|---|---|---:|---:|---|');
for (const r of unmatchedReceipts)
    L.push(`| ${r.date} | ${r.client} | ${r.area} | ${r.km} | ${r.fee} | ${path.basename(r.file || '')} |`);
L.push('');

// Same customer + same day = one trip regardless of doc count (multi-part /
// lunch+dinner split docs) — boss reviews trips, not docs.
const tripMap = new Map();
for (const o of candidateSelf) {
    const key = `${o.date}|${o.phone || o.name}`;
    if (!tripMap.has(key)) tripMap.set(key, { date: o.date, name: o.name, docs: [], zone: o.zone, km: o.km, fee: 0, total: 0 });
    const t = tripMap.get(key);
    t.docs.push(o.shortId);
    t.fee += o.fee; t.total += o.total;
    if (o.km != null) t.km = o.km;
}
const trips = [...tripMap.values()].sort((a, b) => a.date.localeCompare(b.date));
L.push(`## 🚗 没有收据的配送（${trips.length} 趟 / ${candidateSelf.length} 个订单文档）— 老板已确认全部自送`);
L.push('');
L.push('| 送达日 | 客户 | 订单ID尾6位 | zone | 距离km | 运费收 | 食物RM |');
L.push('|---|---|---|---|---:|---:|---:|');
for (const t of trips)
    L.push(`| ${t.date} | ${t.name} | ${t.docs.join(' ')} | ${t.zone} | ${t.km ?? '—'} | ${t.fee} | ${t.total.toFixed(2)} |`);
if (zoneless.length) {
    L.push('');
    L.push(`## 🏠 zone 为空的单（${zoneless.length} 单）— 拟标自取`);
    L.push('');
    L.push('| 送达日 | 客户 | 订单ID尾6位 | 食物RM |');
    L.push('|---|---|---|---:|');
    for (const o of zoneless.sort((a, b) => a.date.localeCompare(b.date)))
        L.push(`| ${o.date} | ${o.name} | ${o.shortId} | ${o.total} |`);
}
L.push('');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, L.join('\n'), 'utf-8');

console.log(`收据(去重) ${receipts.length} · 配上 ${matchedPairs.length} · 收据无单 ${unmatchedReceipts.length} · 单无收据(自送) ${candidateSelf.length} · zone空 ${zoneless.length}`);
console.log(`报告 → ${OUT}`);
await admin.app().delete();
