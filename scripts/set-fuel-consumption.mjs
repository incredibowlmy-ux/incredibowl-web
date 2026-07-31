/**
 * 改自送油耗（dashboardConfig/delivery.fuelL100km）。
 * ⚠️ 这个值不是快照 —— 自送成本是每次渲染时用当前率重算的，
 *    所以改完**所有历史自送成本都会跟着变**。先 dry-run 看影响再 --commit。
 *
 *   node scripts/set-fuel-consumption.mjs 14            ← dry-run
 *   node scripts/set-fuel-consumption.mjs 14 --commit   ← 真写
 */
import admin from 'firebase-admin'; import fs from 'node:fs';
const NEW = Number(process.argv[2]);
const COMMIT = process.argv.includes('--commit');
if (!Number.isFinite(NEW) || NEW <= 0) { console.error('用法: node scripts/set-fuel-consumption.mjs <L/100km> [--commit]'); process.exit(1); }

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync('C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json','utf-8'))) });
const db = admin.firestore();
const ref = db.collection('dashboardConfig').doc('delivery');
const cfg = (await ref.get()).data() || {};
const petrol = cfg.petrolPriceRm ?? 1.99, maint = cfg.maintPerKm ?? 0.13, old = cfg.fuelL100km ?? 11;
const rate = (p,l,m) => p*l/100 + m;
const oldRate = rate(petrol, old, maint), newRate = rate(petrol, NEW, maint);
console.log(`\n油价 RM${petrol}/L · 保养 RM${maint}/km（不变）`);
console.log(`油耗  ${old} → ${NEW} L/100km`);
console.log(`自送率 RM${oldRate.toFixed(4)}/km → RM${newRate.toFixed(4)}/km （+${((newRate/oldRate-1)*100).toFixed(1)}%）\n`);
[2,5,8,13,20].forEach(km => console.log(`  ${String(km).padStart(2)}km 往返：RM${(oldRate*km*2).toFixed(2)} → RM${(newRate*km*2).toFixed(2)}`));

// 影响面：历史自送单总里程
const PAID = ['confirmed','delivering','delivered'];
const snap = await db.collection('orders').get();
let trips = new Map();
snap.docs.forEach(d => { const o = d.data();
  if (!PAID.includes(o.status) || o.deliveryMethod !== 'self') return;
  if (typeof o.deliveryDistanceKm !== 'number') return;
  const k = `${o.deliveryDate}|${(o.userPhone||o.userName||d.id)}|${(o.deliveryTime||'').includes('Lunch')?'L':'D'}`;
  if (!trips.has(k)) trips.set(k, o.deliveryDistanceKm);
});
const totalKm = [...trips.values()].reduce((s,k)=>s+k,0)*2;
console.log(`\n历史自送 ${trips.size} 趟 / ${totalKm.toFixed(0)} km（往返）`);
console.log(`  自送成本合计 RM${(oldRate*totalKm).toFixed(2)} → RM${(newRate*totalKm).toFixed(2)}  （成本 +RM${((newRate-oldRate)*totalKm).toFixed(2)}，净利同额下调）`);

if (!COMMIT) { console.log('\n🔍 DRY-RUN，没写。确认后加 --commit'); await admin.app().delete(); process.exit(0); }
await ref.set({ fuelL100km: NEW }, { merge: true });
console.log(`\n✅ 已写入 fuelL100km = ${NEW}（dashboard 刷新即生效）`);
await admin.app().delete();
