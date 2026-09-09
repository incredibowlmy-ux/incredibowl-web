// 一次性：老板 2026-09-09 盘点 → 餐具套装 / 150mm 餐盒 初始库存 + 阈值。
// 与 _set-bowl-stock-20260906.mjs 同款：自建文档，只在文档不存在或 onHand 仍为 0 时写（幂等）。
//   node scripts/_set-packaging-stock-20260909.mjs           # dry run
//   node scripts/_set-packaging-stock-20260909.mjs --apply
import admin from 'firebase-admin';
import fs from 'node:fs';

const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
const APPLY = process.argv.includes('--apply');
// 阈值（老板 2026-09-09 定）：餐具 500 ≈ 3 周量（周均 ~173 份主菜）；餐盒 100
const PLAN = [
  { name: '餐具套装（叉勺筷）', unit: '套', onHand: 1000, threshold: 500 },
  { name: '150mm 餐盒', unit: '个', onHand: 300, threshold: 100 },
];

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();
const { FieldValue } = admin.firestore;

for (const p of PLAN) {
  const ref = db.collection('ingredientStock').doc(p.name);
  const snap = await ref.get();
  const cur = snap.exists ? (Number(snap.data()?.onHand) || 0) : 0;
  if (cur !== 0) { console.log(`= ${p.name} onHand 已是 ${cur}，跳过`); continue; }
  console.log(`${APPLY ? '→' : '[dry]'} ${p.name}: onHand 0 → ${p.onHand} ${p.unit}, threshold ${p.threshold}`);
  if (!APPLY) continue;
  await db.runTransaction(async (tx) => {
    tx.set(ref, { name: p.name, unit: p.unit, onHand: p.onHand, threshold: p.threshold, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(ref.collection('log').doc(), {
      type: 'adjust', delta: p.onHand, after: p.onHand, unit: p.unit,
      note: '2026-09-09 老板盘点初始数', orderId: null, by: 'incredibowl.my@gmail.com', at: FieldValue.serverTimestamp(),
    });
  });
}
process.exit(0);
