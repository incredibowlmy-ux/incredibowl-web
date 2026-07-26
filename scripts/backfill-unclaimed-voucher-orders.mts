/**
 * One-off 补扣：3 张手动单账面记了餐券折扣但券池从未扣券（Dashboard「编辑订单」
 * 分支只跑 updateDoc、不调 /api/admin/manual-voucher-redemption 所致）。
 *
 *   2026-06-29 Zowi3      vdQ7RTwncYLQQ4ytmfnb  券折 RM18.50
 *   2026-07-08 Zowi3      O53EeC2fvud4uCj7YBqc  券折 RM18.50
 *   2026-07-09 HuannMean  D5ZQaZsOQ6U6uPsi9EiF  券折 RM18.50
 *
 * 复用生产同一个 claimMealVouchers（FIFO + 事务），写回的字段与
 * /api/admin/manual-voucher-redemption 完全一致，只是 redemptionRecordedBy
 * 标成 backfill 便于日后审计区分。
 *
 * 预付加料 credit（老板 2026-07-26 定口径「退回 3 个再扣 2 个」）：
 * Zowi3 的 sunny-egg 池 total 19 / remaining 1 = 已扣 18，但订单侧只记 15 次，
 * 差 3 个是 07-12（966d5e6 修好删单退 credit）之前被删单吞掉的、顾客白付的。
 * 存活订单真实消耗 17 个（15 已记 + 本次补 2），所以正确终态是剩 2 个。
 *   → 先把 3 个退回池子（1 → 4），再为两单各扣 1 个（4 → 2）。
 *
 * Run: npx tsx scripts/backfill-unclaimed-voucher-orders.mts          （dry-run）
 *      npx tsx scripts/backfill-unclaimed-voucher-orders.mts --commit （写库）
 */
import admin from 'firebase-admin';
import fs from 'node:fs';
import { FieldValue } from 'firebase-admin/firestore';

const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();

const { claimMealVouchers, countAvailableVouchers } = await import('../src/lib/mealVoucherUtils');
const { claimAddonCredits } = await import('../src/lib/addonCreditUtils');

const COMMIT = process.argv.includes('--commit');
const TARGETS = [
  { orderId: 'vdQ7RTwncYLQQ4ytmfnb', who: 'Zowi3',     count: 1, addon: 'sunny-egg' },
  { orderId: 'O53EeC2fvud4uCj7YBqc', who: 'Zowi3',     count: 1, addon: 'sunny-egg' },
  { orderId: 'D5ZQaZsOQ6U6uPsi9EiF', who: 'HuannMean', count: 1, addon: null },
];

// ── 阶段 0：退回被旧「删单吞 credit」洞吃掉的 3 个荷包蛋 ──
// 只退这一个批次，且带幂等标记，重跑不会重复退。
const REFUND = { creditDocId: 'XRVbamge1toe54yz6FJ8', qty: 3, tag: 'refund-deleted-order-leak-2026-07-26' };
{
  const ref = db.collection('mealVoucherAddonCredits').doc(REFUND.creditDocId);
  const snap = await ref.get();
  if (!snap.exists) {
    console.log(`❌ credit 批次 ${REFUND.creditDocId} 不存在，跳过退回\n`);
  } else {
    const c = snap.data()!;
    const remaining = Number(c.quantityRemaining) || 0;
    console.log(`【阶段 0】退回删单吞掉的 credit`);
    console.log(`  批次 ${REFUND.creditDocId} ${c.addonName}（${c.addonId}）`);
    console.log(`  total=${c.quantityTotal} remaining=${remaining} → 拟退回 ${REFUND.qty} 个 → ${remaining + REFUND.qty}`);
    if (c.backfillRefundTag === REFUND.tag) {
      console.log(`  ⏭  已退过（tag 命中），跳过\n`);
    } else if (remaining + REFUND.qty > Number(c.quantityTotal)) {
      console.log(`  ❌ 退回后会超过 quantityTotal，中止请人工复核\n`);
      process.exit(1);
    } else if (!COMMIT) {
      console.log(`  ✅ dry-run 通过（未写）\n`);
    } else {
      await ref.update({
        quantityRemaining: FieldValue.increment(REFUND.qty),
        status: 'available',
        backfillRefundTag: REFUND.tag,
        backfillRefundQty: REFUND.qty,
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`  ✅ 已退回 ${REFUND.qty} 个\n`);
    }
  }
}

console.log(COMMIT ? '🔴 COMMIT 模式 — 会写库\n' : '🔵 DRY-RUN — 只检查不写\n');

let ok = 0, skipped = 0;
for (const t of TARGETS) {
  const ref = db.collection('orders').doc(t.orderId);
  const snap = await ref.get();
  if (!snap.exists) { console.log(`❌ ${t.orderId} 订单不存在，跳过`); skipped++; continue; }
  const o = snap.data()!;

  // ── 安全闸：状态必须仍是「账面有券折 / 实际没扣券」才动 ──
  const disc = Number(o.mealVoucherDiscount || 0);
  const claimed = (o.claimedMealVoucherIds || []).length;
  if (disc <= 0) { console.log(`⏭  ${t.orderId} 无 mealVoucherDiscount，跳过`); skipped++; continue; }
  if (claimed > 0) { console.log(`⏭  ${t.orderId} 已扣 ${claimed} 张券（已被别处修好），跳过`); skipped++; continue; }
  if (o.redemptionRecordedBy) { console.log(`⏭  ${t.orderId} 已有 redemptionRecordedBy，跳过`); skipped++; continue; }
  if (o.status === 'cancelled') { console.log(`⏭  ${t.orderId} 已取消，跳过`); skipped++; continue; }
  const userId = String(o.userId || '');
  if (!userId || userId.startsWith('manual_')) {
    console.log(`❌ ${t.orderId} userId 无效（${userId || '空'}），跳过`); skipped++; continue;
  }

  const avail = await countAvailableVouchers(db, userId);
  console.log(`• ${o.deliveryDate} ${t.who} ${t.orderId}`);
  console.log(`    券折 RM${disc} · 实扣 0 张 → 需补扣 ${t.count} 张 · 账户可用 ${avail} 张`);
  if (avail < t.count) { console.log(`    ❌ 余额不足，跳过`); skipped++; continue; }

  // 预付加料：账面记了 addonCreditsDiscount 但没 addonCreditsUsed 的才补
  const aDisc = Number(o.addonCreditsDiscount || 0);
  const aUsed = (o.addonCreditsUsed || []).length;
  const needAddon = !!t.addon && aDisc > 0 && aUsed === 0;
  if (needAddon) console.log(`    credit 折 RM${aDisc} · 实扣 0 项 → 需补扣 ${t.addon} ×1`);
  else if (t.addon && aUsed > 0) console.log(`    credit 已扣 ${aUsed} 项，本次不动`);

  if (!COMMIT) { console.log(`    ✅ dry-run 通过（未写）`); ok++; continue; }

  const res = await claimMealVouchers(db, userId, t.count, t.orderId);
  const update: Record<string, any> = {
    mealVouchersUsed: t.count,
    claimedMealVoucherIds: res.ids,
    mealVoucherAllocatedRevenue: res.allocatedTotalRM,
    redemptionRecordedBy: 'backfill-unclaimed-voucher-orders.mts (dashboard 编辑分支漏扣补账)',
    updatedAt: FieldValue.serverTimestamp(),
  };
  let addonMsg = '';
  if (needAddon) {
    const ar = await claimAddonCredits(db, userId, [{ addonId: t.addon!, count: 1 }], t.orderId);
    update.addonCreditsUsed = ar.lines.map(l => ({ addonId: l.addonId, count: l.count }));
    update.addonCreditsAllocatedRevenue = ar.recognizedRevenueRM;
    addonMsg = ` · credit ${t.addon}×1（确认 RM${ar.recognizedRevenueRM.toFixed(2)}）`;
  }
  await ref.update(update);
  console.log(`    ✅ 已扣券 ${res.ids.join(', ')} · 摊销确认 RM${res.allocatedTotalRM.toFixed(2)}${addonMsg}`);
  ok++;
}

console.log(`\n合计：处理 ${ok} 单 / 跳过 ${skipped} 单`);

// ── 收尾对账：把最终余额打出来核对 ──
const cSnap = await db.collection('mealVoucherAddonCredits').doc(REFUND.creditDocId).get();
if (cSnap.exists) {
  const c = cSnap.data()!;
  console.log(`sunny-egg 池终态：total=${c.quantityTotal} remaining=${c.quantityRemaining}（预期 commit 后 = 2）`);
}
console.log(`Zowi3 可用餐券：${await countAvailableVouchers(db, 'Zxu1PvRzTyM6qALYLDf9')} 张（预期 commit 后 = 2）`);
console.log(`HuannMean 可用餐券：${await countAvailableVouchers(db, '3aVAHQM9RoomGXtrBNIE')} 张（预期 commit 后 = 4）`);

await admin.app().delete();
