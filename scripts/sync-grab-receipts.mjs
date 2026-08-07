// Weekly sync: after记账 updates Accounting deliveries.csv with new Grab receipts,
// run this to stamp the matching Firestore orders (deliveryMethod + actual cost +
// distance) and refresh the unlinked-receipt spend list in dashboardConfig/delivery.
// Idempotent — safe to re-run any time; only writes docs whose values would change.
//
// Usage:
//   node scripts/sync-grab-receipts.mjs                       # sync receipts, report unclassified
//   node scripts/sync-grab-receipts.mjs --rest-self 2026-07-24  # 之后把 ≤该日 仍未分类的配送单标自送
//   node scripts/sync-grab-receipts.mjs --dry                 # preview only
//   node scripts/sync-grab-receipts.mjs --rest-self X --force  # 无视护栏（只在你确知没漏收据时用）
import admin from 'firebase-admin';
import fs from 'node:fs';
import { KEY, loadReceipts, loadOrders, matchReceipts } from './lib-delivery-match.mjs';

const DRY = process.argv.includes('--dry');
const FORCE = process.argv.includes('--force');
const restSelfIdx = process.argv.indexOf('--rest-self');
const REST_SELF_UNTIL = restSelfIdx >= 0 ? process.argv[restSelfIdx + 1] : null;
if (restSelfIdx >= 0 && !/^\d{4}-\d{2}-\d{2}$/.test(REST_SELF_UNTIL || '')) {
    console.error('--rest-self 需要 YYYY-MM-DD 日期'); process.exit(1);
}

// --rest-self 是**排除法**：「没有收据 = 老板自己送的」。这个推断只有在
// 「那段时间的收据都齐了」时才成立。下面两道护栏就是在检查这个前提。
// 用本地日期不用 toISOString —— UTC+8 的凌晨会比 UTC 快一天，按 UTC 算会把
// 今天当成昨天，反而放宽了滞后天数的检查。
const todayLocal = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);

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

// ── 两道护栏 ────────────────────────────────────────────────
// 只在真要跑 --rest-self 时检查。`--force` 可以硬闯（合法场景：某周确实一趟
// Grab 都没叫），但会打印一大段警告，闯了要自己负责。
if (REST_SELF_UNTIL) {
    const today = todayLocal();
    const receiptDates = receipts.map(r => r.date).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    const lastReceipt = receiptDates[receiptDates.length - 1] || null;
    const sweep = unclassified.filter(o => o.date <= REST_SELF_UNTIL);
    const blocks = [];

    // 护栏 1：扫到今天或未来 —— 今天的单还在跑，收据不可能存在。
    //
    // 这里刻意**不**要求「离今天至少 N 天」。老板的节奏是周五收工传整周收据，
    // 然后周末跑收尾 —— 那时扫到周五完全安全（收据刚传完），一个每周误报一次
    // 的闸只会训练他每次都 --force，等于没有闸。真正的判据是护栏 2 的
    // 「收据覆盖到哪天」，不是日历上离今天几天。
    if (REST_SELF_UNTIL >= today) {
        blocks.push(`日期 ${REST_SELF_UNTIL} 是今天（${today}）或更晚。`
            + `今天的单还在跑，Grab 收据根本还没产生 —— 扫下去会把今天所有 Grab 单标成自送。`);
    }

    // 护栏 2：扫的范围超出了收据覆盖到的最后一天
    if (!lastReceipt) {
        blocks.push('deliveries.csv 里一张收据都没有 —— 收据根本没传，此刻扫等于把所有单标自送。');
    } else if (REST_SELF_UNTIL > lastReceipt) {
        const naked = sweep.filter(o => o.date > lastReceipt);
        blocks.push(`收据只覆盖到 ${lastReceipt}，你要扫到 ${REST_SELF_UNTIL}。`
            + `中间 ${daysBetween(lastReceipt, REST_SELF_UNTIL)} 天没有任何收据，`
            + `这段里有 ${naked.length} 单会被无条件标成自送。`);
    }

    // 逐日明细 —— 光说「有风险」没用，要指出具体哪天可疑
    if (blocks.length && sweep.length) {
        const byDay = {};
        sweep.forEach(o => { (byDay[o.date] ||= 0); byDay[o.date]++; });
        const rcptByDay = {};
        receiptDates.forEach(d => { (rcptByDay[d] ||= 0); rcptByDay[d]++; });
        const risky = Object.keys(byDay).sort().filter(d => !rcptByDay[d]);
        if (risky.length) {
            console.log(`\n⚠️ 待扫范围里「有未分类单、但当天一张收据都没有」的日子（${risky.length} 天）：`);
            risky.slice(-14).forEach(d => console.log(`     ${d}  ${byDay[d]} 单`));
            if (risky.length > 14) console.log(`     …（只列最近 14 天，共 ${risky.length} 天）`);
        }
    }

    if (blocks.length) {
        console.log(`\n${'═'.repeat(66)}`);
        console.log('🛑 --rest-self 被护栏拦下 —— 它是排除法（没收据=自送），前提是收据齐了：\n');
        blocks.forEach((b, i) => console.log(`   ${i + 1}. ${b}\n`));
        console.log(`   现状：收据 ${receipts.length} 张，覆盖 ${receiptDates[0] || '—'} → ${lastReceipt || '—'}`);
        console.log(`         此次会扫 ${sweep.length} 单（${REST_SELF_UNTIL} 及之前仍未分类的）`);
        if (lastReceipt) {
            // 安全日期 = 收据覆盖到的最后一天，且不能是今天/未来
            const safe = lastReceipt < today ? lastReceipt : null;
            console.log(safe
                ? `\n   ✅ 安全的做法：先把缺的收据传上去，或改用 --rest-self ${safe}`
                : `\n   ✅ 安全的做法：等今天过完、把收据传上去再跑`);
        }
        console.log(`   ⚠️ 确知没漏收据的话可以加 --force 硬闯（比如那周真的一趟 Grab 都没叫）`);
        console.log(`${'═'.repeat(66)}\n`);
        if (!FORCE) { await admin.app().delete(); process.exit(1); }
        console.log('❗ --force 已指定，无视上面的警告继续。错了要自己回滚。\n');
    }
}

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
