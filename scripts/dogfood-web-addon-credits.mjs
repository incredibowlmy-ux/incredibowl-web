// Dogfood 网页下单自动抵扣预付加料 credits（真实写库 + 全量清理）
//
// 覆盖：
//   A  普通加料抵扣（sunny-egg×2）→ total 净额 + addonCreditsUsed + 批次递减
//   D  篡改 clientAddonCreditDiscount → 400 且无订单残留
//   C  多天 parts → per-part addonCreditDiscount 精确落组、claim 挂 part 1
//   B2 和牛不用餐券 → upgrade credit 纹丝不动（决策 3 反向断言）
//   B  和牛+餐券+upgrade credit → 差价抵扣 → total 0 走 voucher 支付
//   R  admin 取消 → 餐券 + addon credit 双双回补
//   E  release-stale-fpx 回补（需 N8N_API_KEY env，无则跳过）
//
// 需要本地 dev server: npm run dev（BASE 可覆盖）
// 副作用说明：ingredientStock 是 advisory 层，取消不回补（每日盘点自校正）；
//            dishStock 若存在文档，脚本结束时按净消耗 increment 回补。
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
const near = (a, b) => Math.abs(a - b) < 0.005;

// ── 测试日期：下一个及再下一个工作日（≥明天，跳过周末）──
function nextWeekdays(n) {
  const out = [];
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (out.length < n) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) {
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}
const [DAY1, DAY2] = nextWeekdays(2);
console.log(`测试日期: ${DAY1} / ${DAY2}`);

// ── 0) 造测试客户（auth user + users doc + credits + 1 张餐券）──
const ADDR = 'DOGFOOD Web Addon Credit Test Addr';
const testUser = await admin.auth().createUser({ displayName: 'Dogfood加料券' });
const UID = testUser.uid;
console.log(`✓ 测试 uid: ${UID}`);

const cleanup = { orders: [], creditDocs: [], voucherDocs: [], dishConsumed: {} };

try {
  await db.collection('users').doc(UID).set({
    displayName: 'Dogfood加料券', phone: '0100000001', email: '',
    address: ADDR, addressVerifiedText: ADDR, addressDistanceKm: 1.0,
    deliveryZone: 'within2km',
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
  });

  const expiresAt = Timestamp.fromMillis(Date.now() + 30 * 86_400_000);
  const mintBatch = async (addonId, addonName, unitPriceRM, qty) => {
    const ref = await db.collection('mealVoucherAddonCredits').add({
      userId: UID, purchaseId: `dogfood-web-ac-${addonId}`,
      addonId, addonName,
      unitPriceRM, unitAllocatedRM: unitPriceRM,
      quantityTotal: qty, quantityRemaining: qty,
      status: 'available', purchasedAt: Timestamp.now(), expiresAt,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    cleanup.creditDocs.push(ref.id);
    return ref.id;
  };
  await mintBatch('sunny-egg', '荷包蛋', 2.50, 10);
  await mintBatch('wagyu-upgrade', '和牛饭升级', 3.00, 1);

  const vRef = await db.collection('mealVouchers').add({
    userId: UID, purchaseId: 'dogfood-web-ac-voucher', status: 'available',
    faceValueRM: 19.90, allocatedValueRM: 15.92,
    purchasedAt: Timestamp.now(), expiresAt,
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  cleanup.voucherDocs.push(vRef.id);
  console.log('✓ 铸 credits: sunny-egg×10 + wagyu-upgrade×1 + 餐券×1');

  const balance = async (addonId) => {
    const snap = await db.collection('mealVoucherAddonCredits')
      .where('userId', '==', UID).where('addonId', '==', addonId)
      .where('status', '==', 'available').get();
    return snap.docs.reduce((s, d) => s + (Number(d.data().quantityRemaining) || 0), 0);
  };

  // ── tokens ──
  const signIn = async (uid) => {
    const ct = await admin.auth().createCustomToken(uid);
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: ct, returnSecureToken: true }),
    }).then(x => x.json());
    if (!r.idToken) throw new Error(`铸 token 失败: ${JSON.stringify(r)}`);
    return r.idToken;
  };
  const custToken = await signIn(UID);
  const adminUser = await admin.auth().getUserByEmail('incredibowl.my@gmail.com');
  const adminToken = await signIn(adminUser.uid);
  console.log('✓ 铸到客户 + admin token');

  const submit = (body) => fetch(`${BASE}/api/submit-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
    body: JSON.stringify({
      userName: 'Dogfood加料券', userEmail: '', userPhone: '0100000001', userAddress: ADDR,
      receiptUploaded: true, promoCode: '', promoDiscount: 0, orderNote: 'DOGFOOD-TEST 勿备餐',
      ...body,
    }),
  });
  const trackConsumed = (dishId, qty) => { cleanup.dishConsumed[dishId] = (cleanup.dishConsumed[dishId] || 0) + qty; };
  const getOrder = (id) => db.collection('orders').doc(id).get().then(s => s.data());

  const NATTO = { dishId: 11, price: 16.90 };   // 常驻，无 weekday 限制
  const WAGYU = { dishId: 24, price: 22.90, voucherTopUp: 3 };
  const eggBundle = (date) => ({
    dishId: NATTO.dishId, dishQty: 1, quantity: 1,
    addOns: [{ id: 'sunny-egg', name: '荷包蛋', nameEn: 'Sunny Egg', quantity: 2, image: '' }],
    price: NATTO.price + 2 * 2.50, selectedDate: date, selectedTime: 'Lunch', note: '',
  });

  // ══ A. 普通加料抵扣（qr）══
  console.log('\n■ A 普通加料抵扣 sunny-egg×2');
  {
    const res = await submit({
      cartBundles: [eggBundle(DAY1)], paymentMethod: 'qr',
      clientDeliveryFee: 0, mealVouchersUsed: 0, clientMealVoucherDiscount: 0,
      clientAddonCreditDiscount: 5.00,
    });
    const data = await res.json();
    check(res.ok, `HTTP ${res.status} ${res.ok ? '' : JSON.stringify(data)}`);
    if (res.ok) {
      cleanup.orders.push(...data.orderIds); trackConsumed(11, 1);
      const o = await getOrder(data.orderIds[0]);
      check(near(o.total, 16.90), `total=${o.total} 应 16.90（21.90−5.00）`);
      check(near(o.addonCreditDiscount, 5.00), `addonCreditDiscount=${o.addonCreditDiscount} 应 5.00`);
      check(JSON.stringify(o.addonCreditsUsed) === JSON.stringify([{ addonId: 'sunny-egg', count: 2 }]),
        `addonCreditsUsed=${JSON.stringify(o.addonCreditsUsed)} 应 [{sunny-egg,2}]`);
      check(near(o.addonCreditsAllocatedRevenue, 5.00), `allocatedRevenue=${o.addonCreditsAllocatedRevenue} 应 5.00`);
      check(await balance('sunny-egg') === 8, `sunny-egg 余额 ${await balance('sunny-egg')} 应 8`);
      cleanup.orderA = data.orderIds[0];
    }
  }

  // ══ D. 篡改对账数字 → 400 ══
  console.log('\n■ D 篡改 clientAddonCreditDiscount → 400');
  {
    const before = (await db.collection('orders').where('userId', '==', UID).get()).size;
    const res = await submit({
      cartBundles: [eggBundle(DAY1)], paymentMethod: 'qr',
      clientDeliveryFee: 0, mealVouchersUsed: 0, clientMealVoucherDiscount: 0,
      clientAddonCreditDiscount: 0,   // 服务器会算 5.00 → 不一致
    });
    check(res.status === 400, `HTTP ${res.status} 应 400（${(await res.json()).error || ''}）`);
    const after = (await db.collection('orders').where('userId', '==', UID).get()).size;
    check(before === after, `订单数不变 ${before}→${after}`);
    check(await balance('sunny-egg') === 8, `sunny-egg 余额仍 8`);
  }

  // ══ C. 多天 parts ══
  console.log('\n■ C 多天两 part，per-part 精确落组');
  {
    const res = await submit({
      cartBundles: [eggBundle(DAY1), eggBundle(DAY2)], paymentMethod: 'qr',
      clientDeliveryFee: 0, mealVouchersUsed: 0, clientMealVoucherDiscount: 0,
      clientAddonCreditDiscount: 10.00,
    });
    const data = await res.json();
    check(res.ok, `HTTP ${res.status} ${res.ok ? '' : JSON.stringify(data)}`);
    if (res.ok) {
      cleanup.orders.push(...data.orderIds); trackConsumed(11, 2);
      check(data.orderIds.length === 2, `拆成 ${data.orderIds.length} 单 应 2`);
      const [o1, o2] = await Promise.all(data.orderIds.map(getOrder));
      check(near(o1.addonCreditDiscount, 5.00) && near(o2.addonCreditDiscount, 5.00),
        `per-part 抵扣 ${o1.addonCreditDiscount}/${o2.addonCreditDiscount} 应各 5.00`);
      check(near(o1.total, 16.90) && near(o2.total, 16.90), `parts total ${o1.total}/${o2.total} 应各 16.90`);
      check(JSON.stringify(o1.addonCreditsUsed) === JSON.stringify([{ addonId: 'sunny-egg', count: 4 }]),
        `claim 挂 part1: ${JSON.stringify(o1.addonCreditsUsed)} 应 [{sunny-egg,4}]`);
      check(o2.addonCreditsUsed === undefined, `part2 无 claim 字段`);
      check(await balance('sunny-egg') === 4, `sunny-egg 余额 ${await balance('sunny-egg')} 应 4`);
    }
  }

  // ══ B2. 和牛不用餐券 → upgrade credit 不动 ══
  console.log('\n■ B2 和牛全现金（无餐券）→ upgrade credit 纹丝不动');
  {
    const res = await submit({
      cartBundles: [{ dishId: 24, dishQty: 1, quantity: 1, addOns: [], price: WAGYU.price, selectedDate: DAY1, selectedTime: 'Lunch', note: '' }],
      paymentMethod: 'qr', clientDeliveryFee: 0,
      mealVouchersUsed: 0, clientMealVoucherDiscount: 0, clientAddonCreditDiscount: 0,
    });
    const data = await res.json();
    check(res.ok, `HTTP ${res.status} ${res.ok ? '' : JSON.stringify(data)}`);
    if (res.ok) {
      cleanup.orders.push(...data.orderIds); trackConsumed(24, 1);
      const o = await getOrder(data.orderIds[0]);
      check(near(o.total, 22.90), `total=${o.total} 应 22.90（不抵）`);
      check(o.addonCreditsUsed === undefined, `无 addonCreditsUsed`);
      check(await balance('wagyu-upgrade') === 1, `wagyu-upgrade 余额仍 1`);
    }
  }

  // ══ B. 和牛+餐券 → upgrade credit 抵差价 → total 0 voucher 支付 ══
  console.log('\n■ B 和牛+餐券+upgrade credit → 差价 RM3 抵掉，voucher 全覆盖');
  let orderB = null;
  {
    const res = await submit({
      cartBundles: [{ dishId: 24, dishQty: 1, quantity: 1, addOns: [], price: WAGYU.price, selectedDate: DAY1, selectedTime: 'Lunch', note: '' }],
      paymentMethod: 'voucher', clientDeliveryFee: 0,
      mealVouchersUsed: 1, clientMealVoucherDiscount: 19.90, clientAddonCreditDiscount: 3.00,
    });
    const data = await res.json();
    check(res.ok, `HTTP ${res.status} ${res.ok ? '' : JSON.stringify(data)}`);
    if (res.ok) {
      cleanup.orders.push(...data.orderIds); trackConsumed(24, 1);
      orderB = data.orderIds[0];
      const o = await getOrder(orderB);
      check(near(o.total, 0), `total=${o.total} 应 0（22.90−19.90−3.00）`);
      check(near(o.addonCreditDiscount, 3.00), `addonCreditDiscount=${o.addonCreditDiscount} 应 3.00`);
      check(JSON.stringify(o.addonCreditsUsed) === JSON.stringify([{ addonId: 'wagyu-upgrade', count: 1 }]),
        `addonCreditsUsed=${JSON.stringify(o.addonCreditsUsed)} 应 [{wagyu-upgrade,1}]`);
      check(o.mealVouchersUsed === 1, `mealVouchersUsed=1`);
      check(await balance('wagyu-upgrade') === 0, `wagyu-upgrade 余额 0`);
    }
  }

  // ══ R. admin 取消 → 餐券 + credit 双回补 ══
  console.log('\n■ R admin 取消 B 与 A → 双层回补');
  {
    const cancel = (ids) => fetch(`${BASE}/api/confirm-order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ orderIds: ids, status: 'cancelled' }),
    });
    if (orderB) {
      const r = await cancel([orderB]);
      check(r.ok, `取消 B HTTP ${r.status}`);
      check(await balance('wagyu-upgrade') === 1, `wagyu-upgrade 回补至 1`);
      const vSnap = await db.collection('mealVouchers').doc(cleanup.voucherDocs[0]).get();
      check(vSnap.data()?.status === 'available', `餐券状态回 available（实际 ${vSnap.data()?.status}）`);
    }
    if (cleanup.orderA) {
      const r = await cancel([cleanup.orderA]);
      check(r.ok, `取消 A HTTP ${r.status}`);
      check(await balance('sunny-egg') === 6, `sunny-egg 回补 4→6`);
    }
  }

  // ══ E. release-stale-fpx（可选）══
  if (process.env.N8N_API_KEY) {
    console.log('\n■ E stale-fpx 回补');
    const res = await submit({
      cartBundles: [eggBundle(DAY1)], paymentMethod: 'fpx',
      clientDeliveryFee: 0, mealVouchersUsed: 0, clientMealVoucherDiscount: 0,
      clientAddonCreditDiscount: 5.00,
    });
    const data = await res.json();
    check(res.ok, `fpx 下单 HTTP ${res.status}`);
    if (res.ok) {
      cleanup.orders.push(...data.orderIds); trackConsumed(11, 1);
      await db.collection('orders').doc(data.orderIds[0]).update({
        createdAt: Timestamp.fromMillis(Date.now() - 2 * 3600_000),
      });
      const r = await fetch(`${BASE}/api/n8n/release-stale-fpx?hours=1&key=${process.env.N8N_API_KEY}`);
      const rd = await r.json();
      check(r.ok && rd.addonCreditsReleased >= 2, `addonCreditsReleased=${rd.addonCreditsReleased} 应 ≥2`);
      check(await balance('sunny-egg') === 6, `sunny-egg 余额回 6`);
      // stale-fpx 已回补 dishStock，抵消消耗记账
      cleanup.dishConsumed[11] -= 1;
    }
  } else {
    console.log('\n■ E stale-fpx：跳过（本地无 N8N_API_KEY；释放逻辑与 R 共用 releaseAddonCredits 已覆盖）');
  }
} finally {
  // ── 清理 ──
  console.log('\n── 清理测试数据 ──');
  for (const id of cleanup.orders) {
    try { await db.collection('orders').doc(id).delete(); } catch (e) { console.warn('删单失败', id, e.message); }
  }
  for (const id of cleanup.creditDocs) {
    try { await db.collection('mealVoucherAddonCredits').doc(id).delete(); } catch {}
  }
  for (const id of cleanup.voucherDocs) {
    try { await db.collection('mealVouchers').doc(id).delete(); } catch {}
  }
  // dishStock 回补（仅当存在限量文档时）
  for (const [dishId, qty] of Object.entries(cleanup.dishConsumed)) {
    if (!qty) continue;
    const ref = db.collection('dishStock').doc(String(dishId));
    const snap = await ref.get();
    if (snap.exists) {
      await ref.update({ remaining: FieldValue.increment(qty) });
      console.log(`  dishStock/${dishId} 回补 +${qty}`);
    }
  }
  try { await db.collection('users').doc(UID).delete(); } catch {}
  try { await admin.auth().deleteUser(UID); } catch {}
  console.log('✓ 清理完成（ingredientStock 为 advisory 层，少量净消耗由每日盘点自校正）');
}

console.log(`\n${fail === 0 ? '✅' : '⛔'} ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
