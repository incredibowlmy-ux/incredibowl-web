/**
 * 审计：用了抵扣的订单，total 与各项折扣是否闭合。
 *
 * ⚠️ 抵扣金额 ≠ 摊销收入（MFRS 15）。这两个数字在每一层都不同：
 *    餐券   mealVoucherDiscount(面值/菜价) vs mealVoucherAllocatedRevenue(摊销)
 *    credit 抵扣额                        vs addonCreditsAllocatedRevenue(摊销)
 *    差额 = 客户买套餐时拿到的批量折扣。
 *
 * 这个脚本写错过两版，两版都把**完全正常**的订单报成错账，记在这里免得重蹈：
 *   v1 拿摊销收入当抵扣额  → 误报 2 笔（18.60 抵扣 vs 17.60 摊销）
 *   v2 拿明细 × 当前价格表 → 误报 1 笔（salmon-upgrade 07-26 从 4.00 涨到
 *      5.00，用今天的价去算 07-15 的单，凭空多出 RM2）
 * 现在只认订单自己存下来的抵扣额；存不了的如实列为「不可审计」，不硬算。
 *
 * 跑法：node --import ./scripts/_register-alias.mjs scripts/audit-voucher-total-drift.mts
 */
import admin from 'firebase-admin';
import fs from 'node:fs';


const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();
const ts = (t: any) => t?.toDate?.()?.toISOString?.()?.slice(0, 10) || '';

/**
 * credit 的**抵扣金额**（不是摊销收入）。只认订单自己存下来的数字。
 *
 * 返回 null = 这单用了 credit 但没存抵扣额（2026-08-06 之前的订阅单），
 * **无法可靠对账**，必须跳过而不是硬算：
 *   · 用 addonCreditsAllocatedRevenue 代替 → 那是摊销价，含批量折扣（实测
 *     18.60 抵扣 vs 17.60 摊销），会误报 RM1 差额；
 *   · 用 addonCreditsUsed × 当前价格表 → credit 会调价（salmon-upgrade
 *     2026-07-26 从 4.00 涨到 5.00），拿今天的价算 07-15 的单会误报 RM2。
 * 两种「聪明的」补救都会把完全正常的订单报成错账 —— 宁可如实说算不了。
 */
function creditDiscountOf(o: any): number | null {
  const explicit = Number(o.addonCreditDiscount ?? o.addonCreditsDiscount ?? NaN);
  if (Number.isFinite(explicit)) return explicit;
  const lines = Array.isArray(o.addonCreditsUsed) ? o.addonCreditsUsed : [];
  if (!lines.length) return 0;          // 压根没用 credit
  return null;                          // 用了但没存金额 → 不可审计
}

const snap = await db.collection('orders').get();
let checked = 0; const bad: any[] = []; const unauditable: any[] = [];
for (const d of snap.docs) {
  const o = d.data() || {};
  if (o.status === 'cancelled') continue;
  const mv = Number(o.mealVoucherDiscount || 0);
  const acRaw = creditDiscountOf(o);
  const promo = Number(o.promoDiscount || o.discount || 0);
  if (mv <= 0 && acRaw === 0) continue;
  if (acRaw === null) { unauditable.push({ id: d.id, o }); continue; }
  const ac = acRaw;
  checked++;
  const orig = Number(o.originalTotal || 0), total = Number(o.total || 0);
  if (orig <= 0) continue;
  const expect = Math.max(0, orig - mv - promo - ac);
  if (Math.abs(expect - total) > 0.02) bad.push({ id: d.id, o, orig, mv, ac, promo, total, expect });
}
console.log(`用过抵扣的在效订单 ${checked} 笔，账目对不上的 ${bad.length} 笔\n`);
let net = 0;
for (const b of bad) {
  const drift = b.total - b.expect; net += drift;
  console.log(`  #${b.id.slice(-6).toUpperCase()} ${ts(b.o.createdAt)} ${String(b.o.userName).slice(0, 12).padEnd(14)} manual=${!!b.o.isManual} sub=${!!b.o.subscriptionId}`);
  console.log(`     ${b.orig.toFixed(2)} − 券${b.mv.toFixed(2)} − promo${b.promo.toFixed(2)} − credit${b.ac.toFixed(2)} = 应收 ${b.expect.toFixed(2)}  账面 ${b.total.toFixed(2)}  差 ${drift > 0 ? '+' : ''}${drift.toFixed(2)}`);
}
console.log(bad.length
  ? `\n净漂移：RM ${net.toFixed(2)}（正=账面虚高/营收多计，负=账面偏低）`
  : '✅ 可审计范围内全部闭合。');
if (unauditable.length) {
  console.log(`\nℹ️ 另有 ${unauditable.length} 笔用了 credit 但没存抵扣额（2026-08-06 之前的订阅单），`);
  console.log(`   无法独立对账 —— 它们的 total 当初算得对不对，只能靠当时的价格表推，而价格改过。`);
  console.log(`   新单已在 subscriptions/week 落 addonCreditsDiscount 字段，之后不会再有这一类。`);
  console.log('   ' + unauditable.map(x => '#' + x.id.slice(-6).toUpperCase()).join(' '));
}
await admin.app().delete();
