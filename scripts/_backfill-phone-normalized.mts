// 给缺 phoneNormalized 的老 users 文档补上（09-10 发现 6 个，Ebby 的旧账号就在里面 →
// 碗妈 bot / 所有 admin 按号码查客户的入口 findUserByNormalizedPhone 都看不到它们）。
//   npx tsx scripts/_backfill-phone-normalized.mts        只读：列出会补哪些
//   npx tsx scripts/_backfill-phone-normalized.mts go     写入（只 set 这一个字段，merge）
import admin from 'firebase-admin';
import fs from 'node:fs';
import { normalizePhone } from '../src/lib/phoneUtils';

const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();
const GO = process.argv[2] === 'go';

const snap = await db.collection('users').get();
const todo: { id: string; phone: string; normalized: string; name: string }[] = [];
for (const d of snap.docs) {
  const u = d.data();
  if (!u.phone || u.phoneNormalized) continue;
  const normalized = normalizePhone(String(u.phone));
  if (!normalized) { console.log(`跳过（号码解析不出）: ${d.id} phone=${u.phone}`); continue; }
  todo.push({ id: d.id, phone: String(u.phone), normalized, name: String(u.displayName || u.name || '') });
}
console.log(`缺 phoneNormalized 且可补: ${todo.length}`);
for (const t of todo) console.log(`  ${t.id}  ${t.phone} → ${t.normalized}  ${t.name}`);
if (!GO) { console.log('\n（只读。写入：npx tsx scripts/_backfill-phone-normalized.mts go）'); process.exit(0); }

const batch = db.batch();
for (const t of todo) batch.set(db.collection('users').doc(t.id), { phoneNormalized: t.normalized }, { merge: true });
await batch.commit();
console.log(`✅ 已补 ${todo.length} 个`);
process.exit(0);
