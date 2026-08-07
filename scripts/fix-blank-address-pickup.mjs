/**
 * 空地址的单 = 自取（老板 2026-08-07 确认）
 *
 * 背景：--rest-self 那一步会把「未分类的配送单」一律标成 self，但它没看地址。
 * 结果一批本来是到店自取的单被标成自送，成本按 zone 默认 RM5 记 —— 自取的真实
 * 配送成本是 0。dashboard buildDeliveryCostMap 对 pickup 直接给 0，所以只要把
 * deliveryMethod 改成 'pickup' 就修好了，不用动 zone / fee / 任何金额字段。
 *
 * 四条护栏（宁可少改也不能改错）：
 *   1. method 是 grab / driver 的**绝不动** —— 那是真的送出去了（哪怕地址没记）
 *   2. 收了客户运费（deliveryFee > 0）的**绝不动** —— 收了运费就不是自取
 *   3. **进过 deliveryBatches 的绝不动** —— 上过车 = 老板真开车送了。这条实测
 *      抓到 1 个反例（#PVSSDB Sam Cheong 08-03，地址空但在批次里）。批次功能
 *      07-23 才上线，所以这条只能兜住近期的单，早期的只能靠前两条。
 *   4. 已取消的单不动
 *
 * 用法：
 *   node scripts/fix-blank-address-pickup.mjs            # dry-run，只看不写
 *   node scripts/fix-blank-address-pickup.mjs --commit   # 写库 + 落回滚日志
 */
import admin from 'firebase-admin';
import fs from 'node:fs';

const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
const COMMIT = process.argv.includes('--commit');

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();

const snap = await db.collection('orders').get();
const all = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(o => o.status !== 'cancelled');
const blank = all.filter(o => !String(o.userAddress || '').trim());

const cfg = (await db.collection('dashboardConfig').doc('delivery').get()).data() || {};
const zoneCost = o => (o.deliveryZone || 'within2km') === 'outside2km'
    ? (Number(cfg.outside2kmCost) || 0) : (Number(cfg.within2kmCost) || 0);

// 上过配送车的订单 id —— 客观证据，胜过任何字段推断
const inBatch = new Set((await db.collection('deliveryBatches').get()).docs.flatMap(b => b.data().orderIds || []));

const targets = [], keptDelivered = [], keptPaidFee = [], keptInBatch = [], alreadyPickup = [];
for (const o of blank) {
    if (o.deliveryMethod === 'pickup') { alreadyPickup.push(o); continue; }
    if (o.deliveryMethod === 'grab' || o.deliveryMethod === 'driver') { keptDelivered.push(o); continue; }
    if (Number(o.deliveryFee) > 0) { keptPaidFee.push(o); continue; }
    if (inBatch.has(o.id) || o.batchId) { keptInBatch.push(o); continue; }
    targets.push(o);
}

const line = o => `  ${o.deliveryDate || '?'.padEnd(10)} #${o.id.slice(-6).toUpperCase()} ${(o.userName || '匿名').padEnd(16)} `
    + `method=${String(o.deliveryMethod || '(未标)').padEnd(8)} zone=${o.deliveryZone === null ? 'null' : (o.deliveryZone || '(无)')} `
    + `运费RM${(Number(o.deliveryFee) || 0).toFixed(2)}`;

console.log(`\n非取消单 ${all.length} · 地址为空 ${blank.length}\n`);
console.log(`${'═'.repeat(70)}\n✏️  要改成自取的：${targets.length} 单\n`);
targets.forEach(o => console.log(line(o)));

const savedRm = targets.reduce((s, o) => s + zoneCost(o), 0);
console.log(`\n  这些单现在按 zone 默认记成本 RM ${savedRm.toFixed(2)}，改成自取后 = RM 0`);
console.log(`  → 历史配送成本会**降低 RM ${savedRm.toFixed(2)}**（这部分本来就是虚记的）`);

console.log(`\n${'═'.repeat(70)}\n🛡️  护栏挡下、不动的：\n`);
console.log(`  已经是 pickup            ${alreadyPickup.length} 单`);
console.log(`  method=grab/driver（真送出去了，地址没记而已）  ${keptDelivered.length} 单`);
keptDelivered.forEach(o => console.log('  ' + line(o).trim()));
console.log(`  收了客户运费（不是自取）  ${keptPaidFee.length} 单`);
keptPaidFee.forEach(o => console.log('  ' + line(o).trim()));
console.log(`  进过配送批次（你真开车送了）  ${keptInBatch.length} 单`);
keptInBatch.forEach(o => console.log('  ' + line(o).trim()));

if (!COMMIT) {
    console.log(`\n--dry（默认）：一个字节都没写。确认无误后加 --commit\n`);
    await admin.app().delete();
    process.exit(0);
}

if (targets.length === 0) { console.log('\n没有要改的单。\n'); await admin.app().delete(); process.exit(0); }

// 先落回滚日志再写库 —— 写完才发现搞错就晚了
const stamp = new Date().toISOString().slice(0, 10);
const rollbackPath = `scripts/_rollback-blank-address-pickup-${stamp}.json`;
fs.writeFileSync(rollbackPath, JSON.stringify({
    ranAt: new Date().toISOString(),
    note: '把 deliveryMethod 改回 prevMethod 即可完全还原（prevMethod=null 表示原本没这个字段）',
    orders: targets.map(o => ({ id: o.id, shortId: o.id.slice(-6).toUpperCase(), name: o.userName || '',
        date: o.deliveryDate || '', prevMethod: o.deliveryMethod ?? null })),
}, null, 2));
console.log(`\n📝 回滚日志已写：${rollbackPath}`);

const { FieldValue } = await import('firebase-admin/firestore');
for (let i = 0; i < targets.length; i += 400) {
    const batch = db.batch();
    for (const o of targets.slice(i, i + 400)) {
        batch.update(db.collection('orders').doc(o.id), {
            deliveryMethod: 'pickup',
            updatedAt: FieldValue.serverTimestamp(),
        });
    }
    await batch.commit();
}
console.log(`✅ 已把 ${targets.length} 单改成自取，历史配送成本降低 RM ${savedRm.toFixed(2)}\n`);
await admin.app().delete();
