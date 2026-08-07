/**
 * 老板 2026-08-08 逐个确认过的地址修正。
 *
 * 三个地址一直 geocode 不出来（太短，Google 回整个「Malaysia」），历史上被
 * 手打过几个互相矛盾的距离（Citizenz2 有 2.6 / 2.1 / 0 三种）。老板逐个确认了
 * 真实距离，并且补全地址后 check-delivery 精确复现了这些数字 —— 两条独立证据对上。
 *
 *   Citizenz2               1.35km  老板确认 + 「Citizen 2, Old Klang Road, KL」实测 1.35
 *   S-16-8, Waltz Residence 1.88km  老板确认 + 补全成 Jalan Awan Besar Taman Yarl 实测 1.88
 *                                   （= PY•玉 另一个地址的距离，同一个地方）
 *   300-12-04 OBD Garden    2.75km  = HuannMean 的 287 Jalan Desa Utama 同栋楼（21 单实证）
 *
 * 同时改地址文本 —— 光改距离只修了成本，路线系统仍然定位不到这两户（会一直
 * 排在「未定位」队尾）。补全后 geocode 能过，坐标自然就有了。
 *
 * 另：#WUW7BL Damon 老板确认是自取（原本标 grab 但没有收据）。
 *
 * ⚠️ 只改 deliveryDistanceKm / userAddress / deliveryMethod，
 *    **绝不碰 deliveryFee 或任何金额** —— 历史运费是当时收的，既成事实。
 *
 * 用法：
 *   node scripts/fix-confirmed-addresses-2026-08-08.mjs            # dry-run
 *   node scripts/fix-confirmed-addresses-2026-08-08.mjs --commit
 */
import admin from 'firebase-admin';
import fs from 'node:fs';

const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
const COMMIT = process.argv.includes('--commit');

// 匹配用的地址片段 → { km, newAddr }。newAddr=null 表示地址本来就够用，不改。
const FIXES = [
    { match: 'Citizenz2',      km: 1.35, newAddr: 'Citizen 2, Old Klang Road, Kuala Lumpur' },
    { match: 'Waltz Residence', km: 1.88, newAddr: 'S-16-8, Waltz Residence, Jalan Awan Besar, Taman Yarl, 58200 Kuala Lumpur' },
    { match: 'OBD Garden',     km: 2.75, newAddr: null },
];
const METHOD_FIXES = [{ shortId: 'WUW7BL', method: 'pickup', why: '老板确认是自取（原标 grab 但无收据）' }];

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();
const all = (await db.collection('orders').get()).docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(o => o.status !== 'cancelled');

const updates = [];   // { id, set, label }
for (const f of FIXES) {
    const hits = all.filter(o => String(o.userAddress || '').includes(f.match));
    const changed = hits.filter(o => Number(o.deliveryDistanceKm) !== f.km
        || (f.newAddr && o.userAddress !== f.newAddr));
    console.log(`\n「${f.match}」 命中 ${hits.length} 单，要改 ${changed.length} 单 → ${f.km} km`);
    const was = {};
    hits.forEach(o => { const k = String(o.deliveryDistanceKm ?? '(无)'); was[k] = (was[k] || 0) + 1; });
    console.log(`  原有距离分布：${Object.entries(was).map(([k, n]) => `${k}km×${n}`).join(' · ')}`);
    if (f.newAddr) console.log(`  地址改成：「${f.newAddr}」`);
    for (const o of changed) {
        const set = { deliveryDistanceKm: f.km };
        if (f.newAddr) set.userAddress = f.newAddr;
        updates.push({ id: o.id, set, label: `${o.deliveryDate} #${o.id.slice(-6).toUpperCase()} ${o.userName}`, prev: { km: o.deliveryDistanceKm ?? null, addr: o.userAddress ?? null } });
    }
}
for (const m of METHOD_FIXES) {
    const o = all.find(x => x.id.slice(-6).toUpperCase() === m.shortId);
    if (!o) { console.log(`\n⚠️ 找不到 #${m.shortId}`); continue; }
    console.log(`\n#${m.shortId} ${o.userName} ${o.deliveryDate}: deliveryMethod ${o.deliveryMethod} → ${m.method}（${m.why}）`);
    if (o.deliveryMethod !== m.method)
        updates.push({ id: o.id, set: { deliveryMethod: m.method }, label: `${o.deliveryDate} #${m.shortId} ${o.userName}`, prev: { method: o.deliveryMethod ?? null } });
}

console.log(`\n${'═'.repeat(60)}\n合计要写 ${updates.length} 单`);
if (!COMMIT) { console.log('\n--dry（默认）：一个字节都没写。确认无误后加 --commit\n'); await admin.app().delete(); process.exit(0); }
if (!updates.length) { console.log('\n没有要改的。\n'); await admin.app().delete(); process.exit(0); }

const path = `scripts/_rollback-confirmed-addresses-2026-08-08.json`;
fs.writeFileSync(path, JSON.stringify({ ranAt: new Date().toISOString(),
    note: '还原：按 prev 把 deliveryDistanceKm / userAddress / deliveryMethod 写回（null = 原本没这个字段）',
    orders: updates.map(u => ({ id: u.id, label: u.label, wrote: u.set, prev: u.prev })) }, null, 2));
console.log(`📝 回滚日志：${path}`);

const { FieldValue } = await import('firebase-admin/firestore');
for (let i = 0; i < updates.length; i += 400) {
    const b = db.batch();
    updates.slice(i, i + 400).forEach(u => b.update(db.collection('orders').doc(u.id),
        { ...u.set, updatedAt: FieldValue.serverTimestamp() }));
    await b.commit();
}
console.log(`✅ 已写 ${updates.length} 单\n`);
await admin.app().delete();
