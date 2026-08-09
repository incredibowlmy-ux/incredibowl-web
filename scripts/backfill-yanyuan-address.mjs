// 给 Yan Yuan（gZKCy1NpJl8XFinqOrUw）补收货地址 —— 老板 2026-08-09 口述。
//   node scripts/backfill-yanyuan-address.mjs           ← dry-run
//   node scripts/backfill-yanyuan-address.mjs --apply    ← 写库
//
// ⚠️ 口径说明：只写 address 文本，与 Dashboard「改客户资料」(/api/admin/update-user
// 的 TEXT_FIELDS = displayName/phone/address) 完全一致，不写 addressLat/Lng/
// addressDistanceKm/deliveryZone/addressVerifiedText —— 那套是 saveDeliveryProfile
// 的「已验证地址」包，必须由真实 geocode 产出，编不得。本机拿不到 Maps key，
// 所以坐标留空；配送批次排线时服务端会自己 geocode，不受影响。
import admin from 'firebase-admin';
import fs from 'node:fs';

const APPLY = process.argv.includes('--apply');
const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
const UID = 'gZKCy1NpJl8XFinqOrUw';
const EXPECT_PHONE = '0102250779';
const ADDRESS = 'A-16-06, The Legacy OUG, Jalan Gembira, Taman Overseas Union, 58200 Kuala Lumpur';

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();
const { FieldValue } = admin.firestore;

const ref = db.collection('users').doc(UID);
const before = (await ref.get()).data();
if (!before) throw new Error(`users/${UID} 不存在`);
if (String(before.phone) !== EXPECT_PHONE) throw new Error(`电话 ${before.phone} 与预期不符，中止`);

console.log(`目标: ${before.displayName} | ${before.phone}`);
console.log('写库前 address :', JSON.stringify(before.address ?? null));
console.log('将写入 address :', JSON.stringify(ADDRESS));
console.log('坐标字段       : 不动（addressLat=' + (before.addressLat ?? '无') + '）');

if (!APPLY) {
  console.log('\n(dry-run，未写库)');
  await admin.app().delete();
  process.exit(0);
}

await ref.set({
  address: ADDRESS,
  addressSource: 'admin-script 2026-08-09（老板口述，未 geocode）',
  updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });

const after = (await ref.get()).data();
console.log('\n✓ 已写入。复核 address =', JSON.stringify(after.address));

await admin.app().delete();
