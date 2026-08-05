/**
 * 安全取消组合单（multi-part）的其中一个 part。
 *
 * 直接取消/删除组合单的某一 part 会出三处漏账（2026-08-04 #C77ODR）：
 *   ① 券记录挂在 part 1 → 退 0 张券，客户的券蒸发
 *   ② 摊销收入留在 part 1 → P&L 多确认收入、少记负债
 *   ③ mealVoucherDiscount 是按 subtotal 比例摊出来的，删掉一个 part 后
 *      剩余 part 账面金额与实际该收的钱对不上
 *
 * 本脚本按菜重算整组，把这三件事一次做对：
 *   退该 part 的券 → 回补两层库存 → 重算并修正同组剩余 part 的账 → 回退 LTV
 *
 * 跑法：
 *   node --import ./scripts/_register-alias.mjs scripts/cancel-group-part.mts C77ODR
 *   node --import ./scripts/_register-alias.mjs scripts/cancel-group-part.mts C77ODR --apply
 */

import admin from 'firebase-admin';
import fs from 'node:fs';
import { weeklyMenu, dishVoucherValue } from '@/data/weeklyMenu';
import { allocateVouchersByGroup, type VoucherServing } from '@/lib/voucherGroupAllocation';

const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
const APPLY = process.argv.includes('--apply');
const TARGET = (process.argv[2] || '').replace(/^#/, '').toUpperCase();
if (!TARGET || TARGET.startsWith('--')) {
  console.error('用法: node --import ./scripts/_register-alias.mjs scripts/cancel-group-part.mts <短号> [--apply]');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();
const { FieldValue } = admin.firestore;

const menuByName = new Map(weeklyMenu.map(d => [d.name, d]));
const isAddOnRow = (n: string) => /^↳/.test(n || '');
const short = (id: string) => '#' + id.slice(-6).toUpperCase();
const rm = (n: number) => 'RM ' + n.toFixed(2);

// ── 找目标单 + 整组 ───────────────────────────────────────────
const all = await db.collection('orders').get();
const hit = all.docs.find(d => d.id.slice(-6).toUpperCase() === TARGET);
if (!hit) { console.error(`⛔ 找不到 ${short(TARGET)}`); process.exit(2); }
const target = { id: hit.id, o: hit.data() };
if (!target.o.groupId) {
  console.error(`⛔ ${short(hit.id)} 不是组合单（无 groupId）。普通单请走 Dashboard 或 cancelOrderWithRollback。`);
  process.exit(2);
}
if (target.o.status === 'cancelled') { console.log(`✅ ${short(hit.id)} 已是取消态，无需重复处理。`); process.exit(0); }

const parts = all.docs
  .filter(d => d.data().groupId === target.o.groupId)
  .map(d => ({ id: d.id, o: d.data() }))
  .sort((a, b) => (a.o.partIndex || 0) - (b.o.partIndex || 0));

console.log(`=== 订单组 ${target.o.groupId} · ${target.o.userName} ===`);
for (const p of parts) {
  const dishes = (p.o.items || []).filter((i: any) => i?.name && !isAddOnRow(i.name))
    .map((i: any) => `${i.name}×${i.quantity || 1}`).join(' + ');
  console.log(`  ${short(p.id)} part${p.o.partIndex}/${p.o.totalParts} ${p.o.deliveryDate} ${p.o.status}` +
    `${p.id === target.id ? '   ← 要取消的' : ''}`);
  console.log(`      ${dishes}`);
  console.log(`      total=${rm(Number(p.o.total) || 0)} 券折扣=${p.o.mealVoucherDiscount ?? 0} ` +
    `券${(p.o.claimedMealVoucherIds || []).length}张 摊销=${p.o.mealVoucherAllocatedRevenue ?? 0}`);
}

// ── 整组按菜重算：谁该拿几张券 ────────────────────────────────
const servingsOf = (p: { id: string; o: FirebaseFirestore.DocumentData }): VoucherServing[] => {
  const out: VoucherServing[] = [];
  for (const it of (p.o.items || [])) {
    if (!it?.name || isAddOnRow(it.name)) continue;
    const dish = menuByName.get(it.name);
    const value = dishVoucherValue(Number(it.price) || 0, dish ?? ({} as any));
    for (let k = 0; k < (Number(it.quantity) || 1); k++) out.push({ groupKey: p.id, value });
  }
  return out;
};
const subtotalOf = (p: { o: FirebaseFirestore.DocumentData }) =>
  (p.o.items || []).reduce((s: number, it: any) => {
    if (!it?.name) return s;
    const base = isAddOnRow(it.name) ? 0 : (Number(it.price) || 0) * (Number(it.quantity) || 1);
    const ad = (it.addOns || []).reduce((a: number, x: any) => a + (Number(x.price) || 0) * (Number(x.quantity) || 1), 0);
    return s + base + ad;
  }, 0);

const allVoucherIds: string[] = parts.flatMap(p => (p.o.claimedMealVoucherIds || []) as string[]);
const totalVouchers = allVoucherIds.length;

// 取消前：整组怎么分（用来确定目标 part 该退几张）
const before = allocateVouchersByGroup(parts.flatMap(servingsOf), totalVouchers);
// 取消后：剩余 part 重新分同样这些券里、属于它们的那些
const remaining = parts.filter(p => p.id !== target.id && p.o.status !== 'cancelled');
const targetShare = before.perGroup[target.id]?.count || 0;
const keptVoucherCount = totalVouchers - targetShare;
const after = allocateVouchersByGroup(remaining.flatMap(servingsOf), keptVoucherCount);

// 券的摊销价逐张读（不同批次不同价）
const allocRM: Record<string, number> = {};
for (const vid of allVoucherIds) {
  const v = await db.collection('mealVouchers').doc(vid).get();
  allocRM[vid] = v.exists && typeof v.data()!.allocatedValueRM === 'number' ? v.data()!.allocatedValueRM : 0;
}

// 券 ID 切分：先按 after 给剩余 part，余下的就是要退的
let cursor = 0;
const keepPlan: { p: typeof parts[0]; ids: string[] }[] = [];
for (const p of remaining) {
  const n = after.perGroup[p.id]?.count || 0;
  if (n === 0) continue;
  keepPlan.push({ p, ids: allVoucherIds.slice(cursor, cursor + n) });
  cursor += n;
}
const releaseIds = allVoucherIds.slice(cursor);

console.log(`\n=== 取消 ${short(target.id)} 后的重算 ===`);
console.log(`  整组 ${totalVouchers} 张券 → 保留 ${cursor} 张，退回客户 ${releaseIds.length} 张`);
if (releaseIds.length !== targetShare) {
  console.log(`  ⚠️ 退券数(${releaseIds.length}) 与目标 part 应占(${targetShare}) 不一致 —— 请人工核对后再 --apply`);
}

const updates: { id: string; fields: Record<string, unknown>; note: string }[] = [];
for (const p of remaining) {
  const kept = keepPlan.find(k => k.p.id === p.id);
  const ids = kept?.ids || [];
  const newMV = after.perGroup[p.id]?.discountRM || 0;
  const newAlloc = Number(ids.reduce((s, i) => s + (allocRM[i] || 0), 0).toFixed(2));
  const promo = Number(p.o.promoDiscount || p.o.discount || 0);
  const ac = Number(p.o.addonCreditDiscount || 0);
  const newTotal = Number(Math.max(0, subtotalOf(p) - promo - newMV - ac).toFixed(2));
  const oldTotal = Number(p.o.total) || 0;
  updates.push({
    id: p.id,
    fields: {
      claimedMealVoucherIds: ids,
      mealVouchersUsed: ids.length,
      mealVoucherAllocatedRevenue: newAlloc,
      mealVoucherDiscount: newMV,
      total: newTotal,
    },
    note: `${short(p.id)}  券 ${(p.o.claimedMealVoucherIds || []).length}→${ids.length}` +
      `  券折扣 ${p.o.mealVoucherDiscount ?? 0}→${newMV}` +
      `  摊销 ${p.o.mealVoucherAllocatedRevenue ?? 0}→${newAlloc}` +
      `  total ${rm(oldTotal)}→${rm(newTotal)}${Math.abs(newTotal - oldTotal) > 0.005 ? '  ⚠️金额变了' : ''}`,
  });
  if (promo > 0) console.log(`  ⚠️ ${short(p.id)} 有 promo 折扣 ${promo}，重算按原值保留 —— 请人工确认`);
}
console.log('\n  剩余 part 修正：');
updates.forEach(u => console.log('    ' + u.note));

const cashBefore = parts.filter(p => p.o.status !== 'cancelled')
  .reduce((s, p) => s + (Number(p.o.total) || 0) + (Number(p.o.deliveryFee) || 0), 0);
const cashAfter = updates.reduce((s, u) => s + (u.fields.total as number), 0)
  + remaining.reduce((s, p) => s + (Number(p.o.deliveryFee) || 0), 0);
console.log(`\n  整组应收现金：${rm(cashBefore)} → ${rm(cashAfter)}  （差 ${rm(cashAfter - cashBefore)}）`);
console.log(`  ⚠️ 客户已付多少要人工核对 —— 订单文档没有「已付金额」字段。`);

const uid = target.o.userId;
console.log(`\n  LTV 回退：totalOrders −1，totalSpent −${rm(Number(target.o.total || 0) + Number(target.o.deliveryFee || 0))}` +
  `${updates.some(u => Math.abs((u.fields.total as number) - (parts.find(p => p.id === u.id)!.o.total || 0)) > 0.005)
    ? '，再按剩余 part 的 total 变化补差' : ''}`);

if (!APPLY) { console.log('\n[DRY RUN] 未写入。加 --apply 正式执行。'); await admin.app().delete(); process.exit(0); }

// ── 执行 ─────────────────────────────────────────────────────
// 1) 先把目标 part 的券归属补正，让 cancelOrderWithRollback 能正确退券
await db.collection('orders').doc(target.id).update({
  claimedMealVoucherIds: releaseIds,
  mealVouchersUsed: releaseIds.length,
  updatedAt: FieldValue.serverTimestamp(),
});
console.log(`\n✅ 已把 ${releaseIds.length} 张券的归属补正到 ${short(target.id)}`);

// 2) 走生产同款回滚（退券 + 双层库存），allowOrphanGroupPart 让闸门放行
const { cancelOrderWithRollback } = await import('@/lib/orderRollback');
const out = await cancelOrderWithRollback(db as any, target.id, {
  reason: 'cancel-group-part(script)',
  allowNonPending: true,
  allowOrphanGroupPart: true,
});
if (!out.cancelled) {
  console.error(`⛔ 取消失败：${out.blockedReason || '（订单可能已被取消）'}`);
  await admin.app().delete(); process.exit(3);
}
console.log(`✅ 已取消：退券 ${out.released.mealVouchers} 张 · 菜 ${out.released.dishStock} 份 · ` +
  `原料 ${out.released.ingredientStock ? '已回补' : '跳过'} · credit ${out.released.addonCredits} 份`);
if (out.failures.length) console.log(`   ⚠️ 回补失败项：${out.failures.join(', ')}`);

// 3) 修正剩余 part 的账
let ltvSpentDelta = -(Number(target.o.total || 0) + Number(target.o.deliveryFee || 0));
for (const u of updates) {
  const oldTotal = Number(parts.find(p => p.id === u.id)!.o.total) || 0;
  ltvSpentDelta += (u.fields.total as number) - oldTotal;
  await db.collection('orders').doc(u.id).update({ ...u.fields, updatedAt: FieldValue.serverTimestamp() });
  console.log(`✅ 修正 ${short(u.id)}`);
}

// 4) 回退 LTV（orderRollback 不碰这两个字段）
if (uid) {
  await db.collection('users').doc(uid).set({
    totalOrders: FieldValue.increment(-1),
    totalSpent: FieldValue.increment(Number(ltvSpentDelta.toFixed(2))),
  }, { merge: true });
  console.log(`✅ LTV：totalOrders −1，totalSpent ${ltvSpentDelta >= 0 ? '+' : ''}${ltvSpentDelta.toFixed(2)}`);
}

console.log('\n完成。请人工核对客户已付金额，决定退款 / 补收。');
await admin.app().delete();
