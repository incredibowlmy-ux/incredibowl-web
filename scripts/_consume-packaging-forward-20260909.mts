// 一次性：把「配送日 ≥ --from 且在 2026-09-09 盘点前已下」的订单的**餐具套装 / 150mm 餐盒**扣掉
// （碗和纸袋 09-06 起已由下单自动扣，这里不再碰）。之后的新单由 submit-order / 手动单自动扣。
// 幂等：ledger 里查到同 NOTE 就不再扣。
//   npx tsx scripts/_consume-packaging-forward-20260909.mts [--from 2026-09-10]           # dry run
//   npx tsx scripts/_consume-packaging-forward-20260909.mts [--from 2026-09-10] --apply
import admin from 'firebase-admin';
import fs from 'node:fs';
import { packagingLines, type PrepOrder } from '../src/lib/prepIngredients';
import { CUTLERY_SET, FOOD_TRAY } from '../src/data/packaging';

const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const APPLY = process.argv.includes('--apply');
const FROM = arg('--from') || '2026-09-10';
const NOTE = `2026-09-09 盘点后一次性扣减已下的前瞻订单（配送日≥${FROM}）`;
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();
const { FieldValue } = admin.firestore;

type O = PrepOrder & { id: string; deliveryDate?: string; mealType?: 'lunch' | 'dinner' | null };
const snap = await db.collection('orders').where('deliveryDate', '>=', FROM).get();
const orders = snap.docs.map(d => ({ id: d.id, ...(d.data() as PrepOrder & { deliveryDate?: string }) }) as O)
  .filter(o => o.status !== 'cancelled');
const byDate = new Map<string, [number, number, number]>();
let tCut = 0, tTray = 0;
for (const o of orders) {
  const l = packagingLines([o]);
  const c = l.find(x => x.name === CUTLERY_SET)?.qty ?? 0;
  const t = l.find(x => x.name === FOOD_TRAY)?.qty ?? 0;
  const cur = byDate.get(o.deliveryDate || '?') || [0, 0, 0];
  byDate.set(o.deliveryDate || '?', [cur[0] + 1, cur[1] + c, cur[2] + t]);
  tCut += c; tTray += t;
}
for (const [d, [n, c, t]] of [...byDate].sort()) console.log(`${d}: ${n} 单 · 餐具 ${c} · 餐盒 ${t}`);
console.log(`合计 ${orders.length} 单 · 餐具 ${tCut} · 餐盒 ${tTray}`);

// 参考：今天（FROM 前一天）晚市还没配送的单会用多少——老板决定要不要一并扣
const prev = new Date(`${FROM}T00:00:00Z`); prev.setUTCDate(prev.getUTCDate() - 1);
const today = prev.toISOString().slice(0, 10);
const tSnap = await db.collection('orders').where('deliveryDate', '==', today).get();
const dinner = tSnap.docs.map(d => ({ id: d.id, ...(d.data() as O) })).filter(o => o.status !== 'cancelled' && o.mealType === 'dinner');
const dl = packagingLines(dinner);
console.log(`参考：${today} 晚市 ${dinner.length} 单 · 餐具 ${dl.find(x => x.name === CUTLERY_SET)?.qty ?? 0} · 餐盒 ${dl.find(x => x.name === FOOD_TRAY)?.qty ?? 0}（未含在上面合计里）`);

for (const [name, qty, unit] of [[CUTLERY_SET, tCut, '套'], [FOOD_TRAY, tTray, '个']] as const) {
  if (qty <= 0) continue;
  const ref = db.collection('ingredientStock').doc(name);
  if (!(await ref.get()).exists) { console.log(`✗ ${name} 未建档（先跑 _set-packaging-stock-20260909.mjs --apply）`); continue; }
  const dup = await ref.collection('log').where('note', '==', NOTE).limit(1).get();
  if (!dup.empty) { console.log(`= ${name} 已扣过，跳过`); continue; }
  if (!APPLY) { console.log(`[dry] ${name} -${qty}`); continue; }
  await db.runTransaction(async (tx) => {
    const cur = Number((await tx.get(ref)).data()?.onHand) || 0;
    tx.update(ref, { onHand: FieldValue.increment(-qty), updatedAt: FieldValue.serverTimestamp() });
    tx.set(ref.collection('log').doc(), {
      type: 'consume', delta: -qty, after: cur - qty, unit, note: NOTE,
      orderId: null, by: 'incredibowl.my@gmail.com', at: FieldValue.serverTimestamp(),
    });
    console.log(`→ ${name} ${cur} → ${cur - qty}`);
  });
}
process.exit(0);
