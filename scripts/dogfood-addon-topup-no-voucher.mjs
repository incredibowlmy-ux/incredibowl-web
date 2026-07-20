// Dogfood 无餐券客户加料充值（老板 2026-07-21：充值入口对无券客户开放，30 天有效）
// 用例：
//   1. 无券客户充值 → 200，expiry ≈ 充值日 +30 天
//   2. 有券客户充值 → expiry 仍对齐最晚一张券（回归）
//   3. 不存在的电话 → 404
// 全程测试数据自动清理。需本地 dev server。
import admin from 'firebase-admin';
import fs from 'node:fs';

const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
const API_KEY = 'AIzaSyBSTpQdHv0XkijnWcLN8Ys8eNusdaNbgDc';
const BASE = process.env.BASE || 'http://localhost:3000';

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();
const { Timestamp, FieldValue } = admin.firestore;

let pass = 0, fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? '✓' : '✗'} ${msg}`); ok ? pass++ : fail++; };
const DAY = 86_400_000;

// admin token
const adminUser = await admin.auth().getUserByEmail('incredibowl.my@gmail.com');
const ct = await admin.auth().createCustomToken(adminUser.uid);
const signIn = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: ct, returnSecureToken: true }),
}).then(r => r.json());
if (!signIn.idToken) { console.error('铸 token 失败', signIn); process.exit(1); }

const topup = (phone) => fetch(`${BASE}/api/admin/manual-addon-topup`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signIn.idToken}` },
  body: JSON.stringify({ phone, prepaidAddOns: [{ addonId: 'sunny-egg', quantity: 2 }], paymentMethod: 'cash', note: 'DOGFOOD-TEST' }),
});

const cleanup = { users: [], purchases: [], credits: [], vouchers: [] };
const PHONE_NOV = '0100000002', PHONE_V = '0100000003';

try {
  // 造两个测试客户：无券 / 有券（券 45 天后到期）
  const mkUser = async (phone, name) => {
    const ref = await db.collection('users').add({
      displayName: name, phone, phoneNormalized: phone.replace(/\D/g, '').replace(/^0/, ''),  // 同 lib/phoneUtils normalizePhone
      createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    });
    cleanup.users.push(ref.id);
    return ref.id;
  };
  const uidNoV = await mkUser(PHONE_NOV, 'Dogfood无券');
  const uidV = await mkUser(PHONE_V, 'Dogfood有券');
  const voucherExp = Timestamp.fromMillis(Date.now() + 45 * DAY);
  const vRef = await db.collection('mealVouchers').add({
    userId: uidV, status: 'available', faceValueRM: 19.90, allocatedValueRM: 15.92,
    purchasedAt: Timestamp.now(), expiresAt: voucherExp,
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  cleanup.vouchers.push(vRef.id);
  console.log('✓ 造好无券/有券两个测试客户');

  // 1. 无券客户 → 200 + ~30 天
  console.log('\n■ 1 无券客户充值');
  {
    const res = await topup(PHONE_NOV);
    const d = await res.json();
    check(res.ok, `HTTP ${res.status} ${res.ok ? '' : JSON.stringify(d)}`);
    if (res.ok) {
      cleanup.purchases.push(d.purchaseId); cleanup.credits.push(...d.addonCreditIds);
      const days = (d.expiresAtMs - Date.now()) / DAY;
      check(days > 29 && days <= 30.1, `有效期 ${days.toFixed(1)} 天 应 ≈30`);
      const c = await db.collection('mealVoucherAddonCredits').doc(d.addonCreditIds[0]).get();
      check(c.data()?.quantityRemaining === 2, `credit 批次 sunny-egg×2 已铸`);
    }
  }

  // 2. 有券客户 → 对齐券到期日（回归）
  console.log('\n■ 2 有券客户充值（回归）');
  {
    const res = await topup(PHONE_V);
    const d = await res.json();
    check(res.ok, `HTTP ${res.status} ${res.ok ? '' : JSON.stringify(d)}`);
    if (res.ok) {
      cleanup.purchases.push(d.purchaseId); cleanup.credits.push(...d.addonCreditIds);
      check(Math.abs(d.expiresAtMs - voucherExp.toMillis()) < 1000,
        `expiry 对齐券到期日（差 ${Math.abs(d.expiresAtMs - voucherExp.toMillis())}ms）`);
    }
  }

  // 3. 不存在电话 → 404
  console.log('\n■ 3 不存在的客户');
  {
    const res = await topup('0199999999');
    check(res.status === 404, `HTTP ${res.status} 应 404（${(await res.json()).error || ''}）`);
  }
} finally {
  console.log('\n── 清理 ──');
  for (const id of cleanup.credits) { try { await db.collection('mealVoucherAddonCredits').doc(id).delete(); } catch {} }
  for (const id of cleanup.purchases) { try { await db.collection('mealVoucherPurchases').doc(id).delete(); } catch {} }
  for (const id of cleanup.vouchers) { try { await db.collection('mealVouchers').doc(id).delete(); } catch {} }
  for (const id of cleanup.users) { try { await db.collection('users').doc(id).delete(); } catch {} }
  console.log('✓ 清理完成');
}

console.log(`\n${fail === 0 ? '✅' : '⛔'} ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
