/**
 * 只读全量对账：餐券 + 预付加料券 的「收到的钱」vs「确认的收入」是否闭合（MFRS 15）。
 *
 * 恒等式：合同负债(收到的现金) = 已确认收入 + 未使用余额(仍是负债) + 过期沉没(breakage)
 *
 * 五段检查：
 *   A 铸券完整性 —— 每笔购买铸出的券数 / 摊销总额 是否等于收到的钱
 *   B 总账闭合   —— 上面那条恒等式
 *   C 交叉核对   —— 订单侧记的收入 vs 券侧算的收入
 *   D 异常扫描   —— 孤儿券 / 挂在已取消单上的券 / 未付款却铸了券
 *   E 加料券     —— 同 A/B/C，针对 mealVoucherAddonCredits
 *
 * 绝不写库。Run: node scripts/audit-voucher-revenue-closure.mjs
 */
import admin from 'firebase-admin';
import fs from 'node:fs';

const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();

const NOW = Date.now();
const ms = (t) => t?.toMillis?.() ?? (t?._seconds ? t._seconds * 1000 : 0);
const r2 = (n) => Math.round(n * 100) / 100;
const rm = (n) => `RM ${r2(n).toFixed(2)}`;
const dt = (t) => { const m = ms(t); return m ? new Date(m + 8 * 3600e3).toISOString().slice(0, 10) : '-'; };

const [pSnap, vSnap, cSnap, oSnap] = await Promise.all([
  db.collection('mealVoucherPurchases').get(),
  db.collection('mealVouchers').get(),
  db.collection('mealVoucherAddonCredits').get(),
  db.collection('orders').get(),
]);
const purchases = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const vouchers = vSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const credits = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const orders = new Map(oSnap.docs.map(d => [d.id, d.data()]));

const paid = purchases.filter(p => p.status === 'paid');
console.log('═'.repeat(72));
console.log(`餐券 / 加料券 收支闭合审计 · ${new Date(NOW + 8 * 3600e3).toISOString().slice(0, 16).replace('T', ' ')} MYT`);
console.log(`购买 ${purchases.length} 笔（已付 ${paid.length}）· 餐券 ${vouchers.length} 张 · 加料批次 ${credits.length} 条 · 订单 ${orders.size} 单`);
console.log('═'.repeat(72));

const problems = [];
const flag = (sev, msg) => { problems.push({ sev, msg }); console.log(`  ${sev === 'high' ? '🔴' : sev === 'mid' ? '🟠' : '🟡'} ${msg}`); };

// ─────────────────────────────────────────────────────────────
// A. 铸券完整性
// ─────────────────────────────────────────────────────────────
console.log('\n【A】铸券完整性 —— 每笔购买：铸出券数 / 摊销总额 vs 收到的钱');
const vByPurchase = new Map();
for (const v of vouchers) {
  const k = v.purchaseId || '(无)';
  if (!vByPurchase.has(k)) vByPurchase.set(k, []);
  vByPurchase.get(k).push(v);
}
let aBad = 0;
for (const p of paid) {
  const mine = vByPurchase.get(p.id) || [];
  const wantCount = Number(p.voucherCount) || 0;
  // amountPaid = 餐券部分；addOnAmountPaid = 预付加料部分（旧单无此字段）
  const voucherCash = Number(p.amountPaid) || 0;
  const allocSum = mine.reduce((s, v) => s + (Number(v.allocatedValueRM) || 0), 0);
  const countOk = mine.length === wantCount;
  const allocOk = Math.abs(allocSum - voucherCash) < 0.05;   // 允许 5 分摊销尾差
  if (!countOk || !allocOk) {
    aBad++;
    const who = p.userName || p.userPhone || p.userId;
    if (!countOk) flag('high', `${who} 购买 ${p.id}：应铸 ${wantCount} 张，实际 ${mine.length} 张`);
    if (!allocOk) flag('high', `${who} 购买 ${p.id}：摊销合计 ${rm(allocSum)} ≠ 收款 ${rm(voucherCash)}（差 ${rm(allocSum - voucherCash)}）`);
  }
}
console.log(aBad === 0 ? `  ✅ ${paid.length} 笔已付购买全部对得上（张数 + 摊销额）` : `  ${aBad} 笔有问题`);

// 非 paid 购买却铸了券 —— 券已 void 则视为已正确冲销
const unpaidMinted = purchases.filter(p => p.status !== 'paid' && (vByPurchase.get(p.id) || []).length > 0);
for (const p of unpaidMinted) {
  const mine = vByPurchase.get(p.id) || [];
  const live = mine.filter(v => v.status !== 'voided');
  if (live.length === 0) {
    console.log(`  ✅ 购买 ${p.id} status=${p.status}（${p.userName}）铸出的 ${mine.length} 张券已全部 voided，冲销正确`);
  } else {
    flag('high', `购买 ${p.id} status=${p.status} 却有 ${live.length} 张券仍有效`);
  }
}
if (unpaidMinted.length === 0) console.log('  ✅ 无「未付款却铸券」');

// 孤儿券（purchaseId 指向不存在的购买）
const pIds = new Set(purchases.map(p => p.id));
const orphanV = vouchers.filter(v => !v.purchaseId || !pIds.has(v.purchaseId));
if (orphanV.length) flag('mid', `${orphanV.length} 张券的 purchaseId 找不到对应购买记录：${orphanV.slice(0, 5).map(v => v.id).join(', ')}${orphanV.length > 5 ? ' …' : ''}`);
else console.log('  ✅ 无孤儿券');

// ─────────────────────────────────────────────────────────────
// B. 餐券总账闭合
// ─────────────────────────────────────────────────────────────
console.log('\n【B】餐券总账闭合 —— 收到的钱 = 已确认收入 + 未使用负债 + 过期沉没');
const cashIn = paid.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0);
let recognized = 0, outstanding = 0, breakage = 0, otherStatus = 0, voidedValue = 0;
const byStatus = {};
for (const v of vouchers) {
  const a = Number(v.allocatedValueRM) || 0;
  byStatus[v.status] = (byStatus[v.status] || 0) + 1;
  // voided 券随其购买一起冲销：那笔钱也不在 cashIn 里（购买非 paid），
  // 两边同时排除才闭合。
  if (v.status === 'voided') { voidedValue += a; continue; }
  if (v.status === 'redeemed') recognized += a;
  else if (v.status === 'available') { (ms(v.expiresAt) > NOW ? (outstanding += a) : (breakage += a)); }
  else otherStatus += a;
}
console.log(`  状态分布: ${JSON.stringify(byStatus)}`);
if (voidedValue) console.log(`  （已冲销 voided 券 ${rm(voidedValue)}，其购买亦非 paid，两边同时排除）`);
console.log(`  收到现金（已付购买 amountPaid 合计）  : ${rm(cashIn)}`);
console.log(`  已确认收入（redeemed 券摊销额）      : ${rm(recognized)}`);
console.log(`  未使用负债（available 且未过期）     : ${rm(outstanding)}`);
console.log(`  过期沉没 breakage（available 已过期）: ${rm(breakage)}`);
if (otherStatus) console.log(`  其他状态摊销额                      : ${rm(otherStatus)}`);
const diffB = r2(cashIn - (recognized + outstanding + breakage + otherStatus));
console.log(`  ${Math.abs(diffB) < 0.05 ? '✅' : '🔴'} 闭合差额: ${rm(diffB)}`);
if (Math.abs(diffB) >= 0.05) flag('high', `餐券总账不闭合，差 ${rm(diffB)}`);

// ─────────────────────────────────────────────────────────────
// C. 交叉核对：订单侧 vs 券侧
// ─────────────────────────────────────────────────────────────
console.log('\n【C】交叉核对 —— 订单记的收入 vs 券侧算的收入');
let orderVoucherRev = 0, orderAddonRev = 0;
for (const [, o] of orders) {
  if (o.status === 'cancelled') continue;
  orderVoucherRev += Number(o.mealVoucherAllocatedRevenue) || 0;
  orderAddonRev += Number(o.addonCreditsAllocatedRevenue) || 0;
}
console.log(`  订单侧 mealVoucherAllocatedRevenue 合计: ${rm(orderVoucherRev)}`);
console.log(`  券侧 redeemed 摊销额合计               : ${rm(recognized)}`);
const diffC = orderVoucherRev - recognized;
// 订单侧按单 toFixed(2) 存，券的摊销额可能有 3 位小数（如 RM170.75/10 = 17.075），
// 每单最多丢 0.005 → 容差按参与单数放大。超出这个范围才是真差错。
let dustOrders = 0;
const revByOrder = new Map();
for (const v of vouchers) {
  if (v.status !== 'redeemed' || !v.redeemedOrderId) continue;
  revByOrder.set(v.redeemedOrderId, (revByOrder.get(v.redeemedOrderId) || 0) + (Number(v.allocatedValueRM) || 0));
}
let realGap = 0;
for (const [oid, actual] of revByOrder) {
  const o = orders.get(oid);
  if (!o || o.status === 'cancelled') continue;
  const rec = Number(o.mealVoucherAllocatedRevenue) || 0;
  const d = rec - actual;
  if (Math.abs(d) <= 0.005 + 1e-9) { if (Math.abs(d) > 1e-9) dustOrders++; }
  else realGap += d;
}
console.log(`  差额: ${rm(diffC)}  ← 其中 ${dustOrders} 单为「每单 toFixed(2) 丢 ≤半分」的四舍五入尘埃`);
if (Math.abs(realGap) < 0.005) {
  console.log(`  ✅ 剔除尘埃后无真实差错（真实差额 ${rm(realGap)}）`);
} else {
  flag('high', `订单侧与券侧确认收入存在非尘埃差额 ${rm(realGap)}`);
}

// ─────────────────────────────────────────────────────────────
// D. 异常扫描
// ─────────────────────────────────────────────────────────────
console.log('\n【D】异常扫描');
const redeemed = vouchers.filter(v => v.status === 'redeemed');
const noOrder = redeemed.filter(v => !v.redeemedOrderId);
const deadOrder = redeemed.filter(v => v.redeemedOrderId && !orders.has(v.redeemedOrderId));
const onCancelled = redeemed.filter(v => v.redeemedOrderId && orders.get(v.redeemedOrderId)?.status === 'cancelled');
if (noOrder.length) flag('mid', `${noOrder.length} 张券状态 redeemed 但没有 redeemedOrderId`);
if (deadOrder.length) flag('high', `${deadOrder.length} 张券挂在已删除的订单上（券被吞，顾客亏）：${deadOrder.map(v => `${v.id}→${v.redeemedOrderId}`).slice(0, 8).join(', ')}`);
if (onCancelled.length) flag('high', `${onCancelled.length} 张券挂在已取消订单上（本应释放）：${onCancelled.map(v => `${v.id}→${v.redeemedOrderId}`).slice(0, 8).join(', ')}`);
if (!noOrder.length && !deadOrder.length && !onCancelled.length) console.log('  ✅ redeemed 券全部挂在有效未取消订单上');

// 账面有券折但没扣券（本次修的洞）
const discNoClaim = [];
for (const [id, o] of orders) {
  if (o.status === 'cancelled') continue;
  if (Number(o.mealVoucherDiscount || 0) > 0 && !(o.claimedMealVoucherIds || []).length && !o.groupId) {
    discNoClaim.push({ id, o });
  }
}
if (discNoClaim.length) {
  for (const x of discNoClaim) flag('high', `${x.o.deliveryDate} ${x.o.userName} ${x.id} 记了券折 ${rm(x.o.mealVoucherDiscount)} 但没扣券`);
} else console.log('  ✅ 无「账面有券折但没扣券」的单张订单（分单已排除，见 D2）');

// 分单按 group 聚合核对
const groups = new Map();
for (const [id, o] of orders) {
  if (!o.groupId || o.status === 'cancelled') continue;
  if (!groups.has(o.groupId)) groups.set(o.groupId, []);
  groups.get(o.groupId).push({ id, o });
}
let gBad = 0;
for (const [gid, arr] of groups) {
  const disc = arr.reduce((s, x) => s + Number(x.o.mealVoucherDiscount || 0), 0);
  const claimed = arr.reduce((s, x) => s + (x.o.claimedMealVoucherIds || []).length, 0);
  if (disc > 0 && claimed === 0) { gBad++; flag('high', `分单组 ${gid}（${arr[0].o.userName}）券折合计 ${rm(disc)} 但组内一张没扣`); }
}
if (gBad === 0) console.log(`  ✅ ${groups.size} 个分单组，券折与实扣按组聚合全部有对应`);

// ─────────────────────────────────────────────────────────────
// E. 预付加料券
// ─────────────────────────────────────────────────────────────
console.log('\n【E】预付加料券（mealVoucherAddonCredits）');
const addonCashIn = paid.reduce((s, p) => s + (Number(p.addOnAmountPaid) || 0), 0);
let aRecognized = 0, aOutstanding = 0, aBreakage = 0, mintedValue = 0;
for (const c of credits) {
  const unit = Number(c.unitAllocatedRM) || 0;
  const total = Number(c.quantityTotal) || 0;
  const remain = Number(c.quantityRemaining) || 0;
  const used = total - remain;
  mintedValue += total * unit;
  aRecognized += used * unit;
  if (ms(c.expiresAt) > NOW) aOutstanding += remain * unit; else aBreakage += remain * unit;
}
console.log(`  铸出面值合计（quantityTotal × unitAllocatedRM）: ${rm(mintedValue)}`);
console.log(`  购买记录里的加料收款（addOnAmountPaid 合计）   : ${rm(addonCashIn)}`);
const diffE1 = r2(mintedValue - addonCashIn);
console.log(`  ${Math.abs(diffE1) < 0.05 ? '✅' : '🟠'} 差额: ${rm(diffE1)}${Math.abs(diffE1) >= 0.05 ? '（多为 backfill 补建的批次，购买记录里没拆出加料金额）' : ''}`);
console.log(`  已确认收入（已消耗 × 单位摊销）: ${rm(aRecognized)}`);
console.log(`  未使用负债（未过期剩余）       : ${rm(aOutstanding)}`);
console.log(`  过期沉没                       : ${rm(aBreakage)}`);
const diffE2 = r2(mintedValue - (aRecognized + aOutstanding + aBreakage));
console.log(`  ${Math.abs(diffE2) < 0.05 ? '✅' : '🔴'} 铸出面值闭合差额: ${rm(diffE2)}`);
if (Math.abs(diffE2) >= 0.05) flag('high', `加料券面值不闭合，差 ${rm(diffE2)}`);

console.log(`  订单侧 addonCreditsAllocatedRevenue 合计: ${rm(orderAddonRev)}`);
const diffE3 = r2(orderAddonRev - aRecognized);
console.log(`  ${Math.abs(diffE3) < 0.05 ? '✅' : '🔴'} 与批次侧已消耗差额: ${rm(diffE3)}`);
if (Math.abs(diffE3) >= 0.05) flag('high', `加料券：订单侧记 ${rm(orderAddonRev)} vs 批次侧扣 ${rm(aRecognized)}，差 ${rm(diffE3)}（差额多半是被删掉的订单吞掉）`);

// 逐户列出差异
console.log('\n  逐户批次消耗 vs 订单持有：');
const consumedByUser = new Map();
for (const c of credits) {
  const used = (Number(c.quantityTotal) || 0) - (Number(c.quantityRemaining) || 0);
  if (used <= 0) continue;
  if (!consumedByUser.has(c.userId)) consumedByUser.set(c.userId, new Map());
  const m = consumedByUser.get(c.userId);
  m.set(c.addonId, (m.get(c.addonId) || 0) + used);
}
const heldByUser = new Map();
for (const [, o] of orders) {
  if (o.status === 'cancelled') continue;
  for (const a of o.addonCreditsUsed || []) {
    if (!heldByUser.has(o.userId)) heldByUser.set(o.userId, new Map());
    const m = heldByUser.get(o.userId);
    m.set(a.addonId, (m.get(a.addonId) || 0) + (Number(a.count) || 0));
  }
}
let eBad = 0;
for (const [uid, m] of consumedByUser) {
  for (const [addonId, used] of m) {
    const held = heldByUser.get(uid)?.get(addonId) || 0;
    if (used !== held) {
      eBad++;
      const uDoc = await db.collection('users').doc(uid).get();
      const u = uDoc.data() || {};
      const unit = credits.find(c => c.userId === uid && c.addonId === addonId)?.unitAllocatedRM || 0;
      flag('mid', `${u.displayName || u.name || uid} ${addonId}: 批次扣 ${used} vs 订单持有 ${held} → 差 ${used - held} 个（${rm((used - held) * unit)}）`);
    }
  }
}
if (eBad === 0) console.log('  ✅ 全库逐户对账干净');

// ─────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(72));
const high = problems.filter(p => p.sev === 'high').length;
const mid = problems.filter(p => p.sev === 'mid').length;
console.log(problems.length === 0
  ? '✅ 结论：餐券 + 加料券 收支完全闭合，账实相符。'
  : `结论：${high} 项高危 / ${mid} 项中等 / ${problems.length - high - mid} 项提示，明细见上。`);
console.log('═'.repeat(72));
process.exit(0);
