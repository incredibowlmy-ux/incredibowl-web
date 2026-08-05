// READ-ONLY: 统计「multi-part 组 + 用了餐券/credit」的订单 —— 即取消会漏账的风险单
import admin from 'firebase-admin';
import fs from 'node:fs';
const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();
const ts = t => t?.toDate?.()?.toISOString?.()?.slice(0,10) || '';

const snap = await db.collection('orders').get();
const groups = {};
let totalMultiPart = 0;
for (const d of snap.docs) {
  const o = d.data() || {};
  if (!o.groupId) continue;
  totalMultiPart++;
  (groups[o.groupId] ||= []).push({ id: d.id, o });
}

console.log(`全库 multi-part 订单 ${totalMultiPart} 笔，分属 ${Object.keys(groups).length} 个组\n`);

let riskGroups = 0, riskParts = 0, riskVouchers = 0;
const rows = [];
for (const [gid, parts] of Object.entries(groups)) {
  const usedVoucher = parts.some(p => Number(p.o.mealVoucherDiscount || 0) > 0);
  const usedCredit = parts.some(p => Number(p.o.addonCreditDiscount || p.o.addonCreditsDiscount || 0) > 0);
  if (!usedVoucher && !usedCredit) continue;
  // 危险 part = 有券折扣但没有 claim 记录（取消时退 0 张）
  const orphan = parts.filter(p =>
    Number(p.o.mealVoucherDiscount || 0) > 0 &&
    !(Array.isArray(p.o.claimedMealVoucherIds) && p.o.claimedMealVoucherIds.length));
  if (!orphan.length) continue;
  riskGroups++; riskParts += orphan.length;
  const claimHolder = parts.find(p => (p.o.claimedMealVoucherIds || []).length);
  const nv = (claimHolder?.o.claimedMealVoucherIds || []).length;
  riskVouchers += nv;
  const st = parts.map(p => p.o.status).join('/');
  rows.push(`  ${gid}  ${ts(parts[0].o.createdAt)}  ${String(parts[0].o.userName).slice(0,14).padEnd(16)} ${parts.length}part  券${nv}张全挂part${claimHolder?.o.partIndex}  裸part=${orphan.map(p=>'#'+p.id.slice(-6).toUpperCase()).join(',')}  status=${st}`);
}
console.log(`⚠️ 有「裸 part」（取消会退 0 张券）的组：${riskGroups} 个，涉及 ${riskParts} 笔订单、${riskVouchers} 张券\n`);
rows.forEach(r => console.log(r));

console.log('\n=== 已取消的 multi-part 单（查历史是否已漏账）===');
let hit = 0;
for (const [gid, parts] of Object.entries(groups)) {
  for (const p of parts) {
    if (p.o.status !== 'cancelled') continue;
    hit++;
    console.log(`  #${p.id.slice(-6).toUpperCase()} ${ts(p.o.createdAt)} ${p.o.userName} part${p.o.partIndex}/${p.o.totalParts} 券折扣=${p.o.mealVoucherDiscount||0} claim=${(p.o.claimedMealVoucherIds||[]).length}张 reason=${p.o.cancelReason||'-'} rollbackAt=${p.o.rollbackAt?'Y':'N'}`);
  }
}
if (!hit) console.log('  （无已取消的 multi-part 单 —— 这个坑还没被踩过）');
await admin.app().delete();
