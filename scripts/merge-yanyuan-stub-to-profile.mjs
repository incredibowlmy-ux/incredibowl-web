// Yan Yuan（0102250779）历史手动单归并：orders.userId manual_0102250779 → gZKCy1NpJl8XFinqOrUw
//   node scripts/merge-yanyuan-stub-to-profile.mjs           ← dry-run 只报告
//   node scripts/merge-yanyuan-stub-to-profile.mjs --apply    ← 真改
// 口径与 src/app/api/confirm-order/route.ts 一致：totalSpent += order.total + order.deliveryFee
// 留痕：每单写 userIdMergedFrom；用户档写 ltvBackfill 审计块；本地 JSON 回滚日志。
import admin from 'firebase-admin';
import fs from 'node:fs';

const APPLY = process.argv.includes('--apply');
const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();
const { FieldValue } = admin.firestore;

const FROM_UID = 'manual_0102250779';
const TO_UID = 'gZKCy1NpJl8XFinqOrUw';
const EXPECT_PHONE_CORE = '102250779';
const EXPECT_NAME = 'yan yuan';

const norm = (raw) => {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.startsWith('60') && d.length > 9) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  return d;
};

// ── 闸门 1：目标档案存在且就是这个电话/名字 ──
const target = await db.collection('users').doc(TO_UID).get();
if (!target.exists) throw new Error(`目标 users/${TO_UID} 不存在，中止`);
const tu = target.data();
if (norm(tu.phone) !== EXPECT_PHONE_CORE) throw new Error(`目标档电话 ${tu.phone} 与预期不符，中止`);
console.log(`目标档案 ${TO_UID}: ${tu.displayName} | ${tu.phone} | totalOrders=${tu.totalOrders ?? '(无)'} totalSpent=${tu.totalSpent ?? '(无)'}`);

// ── 闸门 2：源 uid 名下的单，逐单校验名字/电话 ──
const snap = await db.collection('orders').where('userId', '==', FROM_UID).get();
const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
rows.sort((a, b) => String(a.deliveryDate ?? '').localeCompare(String(b.deliveryDate ?? '')));

const toMerge = [];
const skipped = [];
for (const o of rows) {
  const nameOk = String(o.userName ?? o.customerName ?? '').trim().toLowerCase() === EXPECT_NAME;
  const phoneRaw = o.userPhone ?? o.phone ?? o.customerPhone ?? '';
  const phoneOk = !phoneRaw || norm(phoneRaw) === EXPECT_PHONE_CORE; // 手动单常无电话字段，uid 后缀已是电话
  const already = !!o.userIdMergedFrom;
  if (already) { skipped.push([o, '已归并过']); continue; }
  if (!nameOk) { skipped.push([o, `名字不符: ${o.userName ?? o.customerName}`]); continue; }
  if (!phoneOk) { skipped.push([o, `电话不符: ${phoneRaw}`]); continue; }
  toMerge.push(o);
}

let addSpent = 0;
console.log(`\n— 待归并 ${toMerge.length} 单 —`);
console.log('单号                      配送日期      状态       total  +运费  = 计入LTV');
for (const o of toMerge) {
  const total = Number(o.total ?? 0);
  const fee = Number(o.deliveryFee ?? 0);
  addSpent += total + fee;
  console.log(`${o.id.padEnd(24)}  ${String(o.deliveryDate ?? '?').padEnd(12)} ${String(o.status).padEnd(10)} ${String(total).padStart(6)} ${String(fee).padStart(6)}  ${(total + fee).toFixed(2).padStart(8)}`);
}
addSpent = Math.round(addSpent * 100) / 100;
if (skipped.length) {
  console.log(`\n— 跳过 ${skipped.length} 单 —`);
  for (const [o, why] of skipped) console.log(`  ${o.id} | ${o.deliveryDate ?? '?'} | ${why}`);
}

const beforeOrders = Number(tu.totalOrders ?? 0);
const beforeSpent = Number(tu.totalSpent ?? 0);
console.log(`\nLTV 回填：totalOrders ${beforeOrders} → ${beforeOrders + toMerge.length} | totalSpent ${beforeSpent} → ${(beforeSpent + addSpent).toFixed(2)}（+${addSpent}）`);

if (!APPLY) {
  console.log('\n(dry-run，未改任何数据；确认后加 --apply)');
  await admin.app().delete();
  process.exit(0);
}
if (toMerge.length === 0) {
  console.log('\n没有可归并的单，不做任何写入。');
  await admin.app().delete();
  process.exit(0);
}

const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const log = {
  ranAt: new Date().toISOString(),
  from: FROM_UID, to: TO_UID,
  userBefore: { totalOrders: tu.totalOrders ?? null, totalSpent: tu.totalSpent ?? null },
  ltvDelta: { totalOrders: toMerge.length, totalSpent: addSpent },
  orders: toMerge.map(o => ({ orderId: o.id, deliveryDate: o.deliveryDate ?? null, total: o.total ?? null, deliveryFee: o.deliveryFee ?? null })),
};

const batch = db.batch();
for (const o of toMerge) {
  batch.update(db.collection('orders').doc(o.id), {
    userId: TO_UID,
    userIdMergedFrom: FROM_UID,
    userIdMergedAt: FieldValue.serverTimestamp(),
  });
}
batch.set(db.collection('users').doc(TO_UID), {
  totalOrders: FieldValue.increment(toMerge.length),
  totalSpent: FieldValue.increment(addSpent),
  ltvBackfill: {
    mergedFrom: FROM_UID,
    orderCount: toMerge.length,
    spentAdded: addSpent,
    at: FieldValue.serverTimestamp(),
  },
  updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });
await batch.commit();

const logPath = `C:/Users/User/Desktop/Incredibowl Services/merge-yanyuan-log-${stamp}.json`;
fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
console.log(`\n✓ 已归并 ${toMerge.length} 单，LTV 已回填。回滚日志: ${logPath}`);

// ── 复核 ──
const after = (await db.collection('users').doc(TO_UID).get()).data();
const leftover = await db.collection('orders').where('userId', '==', FROM_UID).get();
const now = await db.collection('orders').where('userId', '==', TO_UID).get();
console.log(`复核: users/${TO_UID} totalOrders=${after.totalOrders} totalSpent=${after.totalSpent} | 旧 uid 名下剩 ${leftover.size} 单 | 新 uid 名下 ${now.size} 单`);

await admin.app().delete();
