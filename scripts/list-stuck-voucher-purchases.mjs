// Read-only: list ALL meal-voucher purchases stuck in `pending` (FPX paid but
// never minted) or `pending-review` (QR awaiting admin). NEVER writes.
// Cross-checks each against actual minted vouchers so we can spot
// "paid-but-no-voucher" orphans too.
// Usage: node scripts/list-stuck-voucher-purchases.mjs
import admin from 'firebase-admin';
import fs from 'node:fs';

const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();
const now = Date.now();
const ts = (t) => t?.toDate?.()?.toISOString?.() ?? '(无)';
const ageMin = (t) => t?.toMillis ? ((now - t.toMillis()) / 60000).toFixed(0) : '?';

const snap = await db.collection('mealVoucherPurchases').orderBy('createdAt', 'desc').get();

const stuck = [];
for (const doc of snap.docs) {
  const d = doc.data() || {};
  const minted = Array.isArray(d.voucherIds) ? d.voucherIds.length : 0;
  // "Stuck" = not paid, OR paid but zero vouchers minted (orphan).
  const isStuck = d.status !== 'paid' || minted === 0;
  if (!isStuck) continue;
  stuck.push({ id: doc.id, d, minted });
}

console.log(`\n=== 扫描 ${snap.size} 条购券记录，发现 ${stuck.length} 条异常 ===\n`);

for (const { id, d, minted } of stuck) {
  // confirm against real minted vouchers (voucherIds could be stale)
  const vSnap = await db.collection('mealVouchers').where('purchaseId', '==', id).get();
  console.log(`──────── ${id} ────────`);
  console.log('  客户    :', d.userName || '(无名)', '|', d.userEmail || '', '|', d.userPhone || '');
  console.log('  userId  :', d.userId);
  console.log('  组合    :', d.bundleId, '×', d.voucherCount, '张 | 实付 RM', d.amountPaid);
  console.log('  支付方式:', d.paymentMethod, '| status:', d.status, '| isManual:', !!d.isManual);
  console.log('  RazorpayOrderId:', d.razorpayOrderId || '(无)', '| paymentId:', d.razorpayPaymentId || '(无)');
  console.log('  创建于  :', ts(d.createdAt), `（${ageMin(d.createdAt)} 分钟前）`);
  console.log('  实际已铸券:', vSnap.size, '张 | voucherIds 字段:', minted);
  let verdict;
  if (d.status === 'pending' && d.paymentMethod === 'fpx') {
    verdict = '⏳ FPX 卡 pending — 若客户确实付了款 → 用 finalize-pending-voucher-purchase.mjs 补券';
  } else if (d.status === 'pending-review') {
    verdict = '🧾 QR 待人工审核（正常流程，等 admin 确认）';
  } else if (d.status === 'paid' && vSnap.size === 0) {
    verdict = '🚨 已标 paid 却 0 张券 — 严重孤儿，需手动铸券';
  } else {
    verdict = `❓ status=${d.status} minted=${vSnap.size}`;
  }
  console.log('  判定    :', verdict, '\n');
}

console.log('提示：FPX pending 需先核实银行确实到账（Razorpay Dashboard 查 razorpayOrderId）再补券。\n');
process.exit(0);
