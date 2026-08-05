/**
 * 回填：把组合单（multi-part）的餐券归属从 part 1 拆分到各 part。
 *
 * 背景 2026-08-04（订单 #C77ODR）：2026-08-04 之前的组合单，餐券 claim 记录
 * 全部写在 part 1，其余 part 只有一个按 subtotal 比例摊分的 mealVoucherDiscount。
 * 这种「孤儿 part」被取消/删除时 orderRollback 读到空的 claimedMealVoucherIds
 * → 退 0 张券，客户的券凭空蒸发。
 *
 * ⚠️ 本脚本**只动券归属三个字段**：
 *      claimedMealVoucherIds / mealVouchersUsed / mealVoucherAllocatedRevenue
 *    **绝不碰 mealVoucherDiscount 和 total** —— 各 part 配送日期不同，一动金额
 *    历史日营收就会在日期轴上挪位。组内摊销收入总和保持不变 → 历史报表数字
 *    零变化，只是券从此退得回来。
 *
 * 顺带把券文档的 redeemedOrderId 回指到它真正归属的那一 part。
 *
 * 跑法：
 *   node --import ./scripts/_register-alias.mjs scripts/backfill-multipart-voucher-attribution.mts
 *   node --import ./scripts/_register-alias.mjs scripts/backfill-multipart-voucher-attribution.mts --apply
 *   （可加 --group GRP-XXXX 只处理一个组）
 */

import admin from 'firebase-admin';
import fs from 'node:fs';
import { weeklyMenu, dishVoucherValue } from '@/data/weeklyMenu';
import { allocateVouchersByGroup, type VoucherServing } from '@/lib/voucherGroupAllocation';

const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
const APPLY = process.argv.includes('--apply');
const ONLY_GROUP = (() => {
  const i = process.argv.indexOf('--group');
  return i >= 0 ? process.argv[i + 1] : null;
})();

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();
const { FieldValue } = admin.firestore;

const menuByName = new Map(weeklyMenu.map(d => [d.name, d]));
const isAddOnRow = (name: string) => /^↳/.test(name || '');
const short = (id: string) => '#' + id.slice(-6).toUpperCase();

// ── 收集所有组合单 ────────────────────────────────────────────
const snap = await db.collection('orders').get();
const groups: Record<string, { id: string; o: FirebaseFirestore.DocumentData }[]> = {};
for (const d of snap.docs) {
  const o = d.data() || {};
  if (!o.groupId) continue;
  if (ONLY_GROUP && o.groupId !== ONLY_GROUP) continue;
  (groups[o.groupId] ||= []).push({ id: d.id, o });
}

let touchedGroups = 0, touchedParts = 0, movedVouchers = 0;
const problems: string[] = [];

for (const [gid, rawParts] of Object.entries(groups)) {
  const parts = rawParts.sort((a, b) => (a.o.partIndex || 0) - (b.o.partIndex || 0));

  // 券的 claim 记录挂在哪一 part（历史上总是 part 1）
  const holders = parts.filter(p => Array.isArray(p.o.claimedMealVoucherIds) && p.o.claimedMealVoucherIds.length);
  if (holders.length === 0) continue;               // 整组没用券 → 无事可做
  if (holders.length > 1) { problems.push(`${gid}: ${holders.length} 个 part 都有 claim 记录，已是拆分态或人工改过 —— 跳过`); continue; }
  const holder = holders[0];
  const allIds: string[] = holder.o.claimedMealVoucherIds;

  // 有券折扣但无 claim 记录的孤儿 part
  const orphans = parts.filter(p => p.id !== holder.id && Number(p.o.mealVoucherDiscount || 0) > 0);
  if (orphans.length === 0) continue;               // 单 part 用券，本来就正确

  // ── 按菜重算：每个 part 实际该占几张券 ─────────────────────
  // groupKey 用 part 的 doc id，天然唯一（同组两个 part 可能同日期不同时段，
  // 也可能被人工改过日期 —— 用 doc id 比 date|time 更不容易撞车）。
  const servings: VoucherServing[] = [];
  for (const p of parts) {
    for (const it of (p.o.items || [])) {
      if (!it?.name || isAddOnRow(it.name)) continue;
      const dish = menuByName.get(it.name);
      const value = dishVoucherValue(Number(it.price) || 0, dish ?? { voucherTopUp: undefined } as any);
      if (!dish) problems.push(`${gid} ${short(p.id)}: 菜「${it.name}」不在 weeklyMenu，voucherTopUp 按 0 处理`);
      for (let k = 0; k < (Number(it.quantity) || 1); k++) servings.push({ groupKey: p.id, value });
    }
  }
  const alloc = allocateVouchersByGroup(servings, allIds.length);

  // 每张券的摊销价（不同批次不同价，必须逐张读，不能平均）
  const allocRMById: Record<string, number> = {};
  for (const vid of allIds) {
    const v = await db.collection('mealVouchers').doc(vid).get();
    allocRMById[vid] = v.exists && typeof v.data()!.allocatedValueRM === 'number'
      ? v.data()!.allocatedValueRM : 0;
  }

  // ── 按 alloc 顺序把券 ID 切给各 part ──────────────────────
  const plan: { part: typeof parts[0]; ids: string[]; allocRM: number }[] = [];
  let cursor = 0;
  for (const p of parts) {
    const n = alloc.perGroup[p.id]?.count || 0;
    if (n === 0) continue;
    const ids = allIds.slice(cursor, cursor + n);
    cursor += n;
    plan.push({ part: p, ids, allocRM: Number(ids.reduce((s, i) => s + (allocRMById[i] || 0), 0).toFixed(2)) });
  }
  if (cursor !== allIds.length) {
    problems.push(`${gid}: 切分用了 ${cursor} 张但共有 ${allIds.length} 张 —— 跳过（不冒险）`);
    continue;
  }
  // 分完之后 holder 还是拿全部 → 本来就没有孤儿，无需改
  if (plan.length === 1 && plan[0].part.id === holder.id) continue;

  touchedGroups++;
  const oldAllocSum = parts.reduce((s, p) => s + (Number(p.o.mealVoucherAllocatedRevenue) || 0), 0);
  const newAllocSum = plan.reduce((s, x) => s + x.allocRM, 0);

  console.log(`\n${'─'.repeat(72)}`);
  console.log(`${gid}  ${parts[0].o.userName}  ${parts.length} part  共 ${allIds.length} 张券`);
  for (const p of parts) {
    const before = Array.isArray(p.o.claimedMealVoucherIds) ? p.o.claimedMealVoucherIds.length : 0;
    const after = plan.find(x => x.part.id === p.id);
    const dishes = (p.o.items || []).filter((i: any) => i?.name && !isAddOnRow(i.name))
      .map((i: any) => `${i.name}×${i.quantity || 1}`).join(' + ');
    console.log(`  ${short(p.id)} part${p.o.partIndex}/${p.o.totalParts} ${p.o.deliveryDate} ${p.o.status}`);
    console.log(`      ${dishes}`);
    console.log(`      券 ${before} 张 → ${after ? after.ids.length : 0} 张` +
      `   摊销 ${Number(p.o.mealVoucherAllocatedRevenue) || 0} → ${after ? after.allocRM : 0}` +
      `   (mealVoucherDiscount ${p.o.mealVoucherDiscount ?? '-'} 保持不动)`);
    if (after && after.part.id !== holder.id) { touchedParts++; movedVouchers += after.ids.length; }
  }
  if (Math.abs(oldAllocSum - newAllocSum) > 0.01) {
    problems.push(`${gid}: 摊销收入总和会变 ${oldAllocSum.toFixed(2)} → ${newAllocSum.toFixed(2)} —— 跳过（历史营收必须守恒）`);
    console.log(`  ⛔ 摊销总和不守恒，跳过本组`);
    continue;
  }
  console.log(`  ✅ 摊销收入总和守恒：${oldAllocSum.toFixed(2)} = ${newAllocSum.toFixed(2)}`);

  if (!APPLY) continue;

  for (const x of plan) {
    await db.collection('orders').doc(x.part.id).update({
      claimedMealVoucherIds: x.ids,
      mealVouchersUsed: x.ids.length,
      mealVoucherAllocatedRevenue: x.allocRM,
      updatedAt: FieldValue.serverTimestamp(),
    });
    // 券回指真正归属的 part（best-effort，失败不影响订单已写好的归属）
    if (x.part.id !== holder.id) {
      try {
        const b = db.batch();
        for (const vid of x.ids) {
          b.update(db.collection('mealVouchers').doc(vid), {
            redeemedOrderId: x.part.id, updatedAt: FieldValue.serverTimestamp(),
          });
        }
        await b.commit();
      } catch (e: any) {
        problems.push(`${gid} ${short(x.part.id)}: 券 redeemedOrderId 回指失败 ${e?.message}`);
      }
    }
  }
  console.log(`  ✅ 已写入`);
}

console.log(`\n${'='.repeat(72)}`);
console.log(`处理组 ${touchedGroups} 个 · 补上归属的 part ${touchedParts} 笔 · 迁移券 ${movedVouchers} 张`);
if (problems.length) { console.log('\n⚠️ 需要留意：'); problems.forEach(p => console.log('  - ' + p)); }
if (!APPLY) console.log('\n[DRY RUN] 未写入。加 --apply 正式执行。');
await admin.app().delete();
