// Dogfood 配送跟踪全链路（本地 dev server）：
// track API 404/200 → 批次 start(401/200) → GPS location → 客户可见司机 →
// 逐单 deliver → 批次自动 complete → driver 位置不再暴露 → 清理测试数据
import admin from 'firebase-admin';
import fs from 'node:fs';
import crypto from 'node:crypto';

const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
const API_KEY = 'AIzaSyBSTpQdHv0XkijnWcLN8Ys8eNusdaNbgDc';
const BASE = 'http://localhost:3000';

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`);
  ok ? pass++ : fail++;
};

// ── 铸 admin ID token ──
const adminUser = await admin.auth().getUserByEmail('incredibowl.my@gmail.com');
const customToken = await admin.auth().createCustomToken(adminUser.uid);
const signIn = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: customToken, returnSecureToken: true }),
}).then(r => r.json());
if (!signIn.idToken) { console.error('铸 token 失败', signIn); process.exit(1); }
console.log('✓ 铸到 admin ID token\n');
const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${signIn.idToken}` };

// ── 建 3 张测试订单（confirmed + trackToken，今天）──
const genToken = () => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.randomBytes(16)).map(b => alphabet[b % alphabet.length]).join('');
};
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kuala_Lumpur' });
const orderIds = [];
const tokens = [];
for (let i = 0; i < 3; i++) {
  const token = genToken();
  const ref = await db.collection('orders').add({
    userId: adminUser.uid,
    userName: `跟踪测试${i + 1}`, userEmail: '', userPhone: '0123456789',
    userAddress: `Test Address ${i + 1}, Pearl Point`,
    trackToken: token,
    items: [{ name: '测试菜品', nameEn: 'Test Dish', price: 10, quantity: 1, image: '' }],
    total: 10, originalTotal: 10, deliveryFee: 0,
    deliveryDate: today, deliveryTime: `Lunch (11:30AM - 1:00PM)`,
    paymentMethod: 'qr', receiptUploaded: true,
    status: 'confirmed', note: 'DOGFOOD-TRACKING-TEST',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  orderIds.push(ref.id);
  tokens.push(token);
}
console.log(`✓ 建了 3 张测试订单: ${orderIds.map(id => id.slice(-6)).join(', ')}\n`);

let batchId = null;
try {
  // ── 1. /api/track ──
  const bad = await fetch(`${BASE}/api/track?token=aaaaaaaaaaaaaaaa`);
  check('track 无效 token → 404', bad.status === 404);
  const malformed = await fetch(`${BASE}/api/track?token=<script>`);
  check('track 畸形 token → 404', malformed.status === 404);

  const t0 = await fetch(`${BASE}/api/track?token=${tokens[0]}`).then(r => r.json());
  check('track 有效 token → confirmed', t0.status === 'confirmed', JSON.stringify({ orderNo: t0.orderNo, driver: t0.driver }));
  check('track 白名单不含地址/电话/金额', !JSON.stringify(t0).includes('Test Address') && !('userPhone' in t0) && !('total' in t0));

  // ── 2. 批次 start ──
  const noAuth = await fetch(`${BASE}/api/admin/delivery-batch`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'start', orderIds }),
  });
  check('batch start 无 token → 401', noAuth.status === 401);

  const start = await fetch(`${BASE}/api/admin/delivery-batch`, {
    method: 'POST', headers: authHeaders, body: JSON.stringify({ action: 'start', orderIds }),
  }).then(r => r.json());
  batchId = start.batchId;
  check('batch start → batchId', !!batchId, batchId);

  const o0 = (await db.collection('orders').doc(orderIds[0]).get()).data();
  check('订单转 delivering + 挂 batchId', o0.status === 'delivering' && o0.batchId === batchId);

  // ── 3. current（/driver 页数据源）──
  const cur = await fetch(`${BASE}/api/admin/delivery-batch`, {
    method: 'POST', headers: authHeaders, body: JSON.stringify({ action: 'current' }),
  }).then(r => r.json());
  check('current → 3 单 + 有地址电话', cur.orders?.length === 3 && !!cur.orders[0].userAddress);

  // ── 4. GPS location → 客户端可见 ──
  const loc = await fetch(`${BASE}/api/admin/delivery-batch`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ action: 'location', batchId, lat: 3.0733, lng: 101.6828 }),
  });
  check('location 上报 → 200', loc.status === 200);

  const t1 = await fetch(`${BASE}/api/track?token=${tokens[1]}`).then(r => r.json());
  check('track → delivering + 司机坐标', t1.status === 'delivering' && t1.driver?.lat === 3.0733, JSON.stringify(t1.driver));

  const badLoc = await fetch(`${BASE}/api/admin/delivery-batch`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ action: 'location', batchId, lat: 999, lng: 101 }),
  });
  check('location 非法坐标 → 400', badLoc.status === 400);

  // ── 5. 逐单 deliver ──
  const d0 = await fetch(`${BASE}/api/admin/delivery-batch`, {
    method: 'POST', headers: authHeaders, body: JSON.stringify({ action: 'deliver', batchId, orderId: orderIds[0] }),
  }).then(r => r.json());
  check('deliver 第 1 单 → 批次未完', d0.success === true && d0.batchCompleted === false);

  const t0b = await fetch(`${BASE}/api/track?token=${tokens[0]}`).then(r => r.json());
  check('第 1 单 track → delivered，不再暴露司机', t0b.status === 'delivered' && t0b.driver === null);
  const t2 = await fetch(`${BASE}/api/track?token=${tokens[2]}`).then(r => r.json());
  check('第 3 单 track → 仍 delivering + 司机', t2.status === 'delivering' && !!t2.driver);

  await fetch(`${BASE}/api/admin/delivery-batch`, {
    method: 'POST', headers: authHeaders, body: JSON.stringify({ action: 'deliver', batchId, orderId: orderIds[1] }),
  });
  const d2 = await fetch(`${BASE}/api/admin/delivery-batch`, {
    method: 'POST', headers: authHeaders, body: JSON.stringify({ action: 'deliver', batchId, orderId: orderIds[2] }),
  }).then(r => r.json());
  check('deliver 最后 1 单 → 批次自动完结', d2.batchCompleted === true);

  const batchDoc = (await db.collection('deliveryBatches').doc(batchId).get()).data();
  check('批次 completed + driverLoc 已清', batchDoc.status === 'completed' && !batchDoc.driverLoc);

  // ── 6. 跟踪页 HTML ──
  const page = await fetch(`${BASE}/track/${tokens[0]}`);
  const html = await page.text();
  check('/track/<token> 页面 200 + 含跟踪 UI', page.status === 200 && html.includes('订单跟踪'));
  const driverPage = await fetch(`${BASE}/driver`);
  check('/driver 页面 200', driverPage.status === 200);
} finally {
  // ── 清理 ──
  for (const id of orderIds) await db.collection('orders').doc(id).delete().catch(() => {});
  if (batchId) await db.collection('deliveryBatches').doc(batchId).delete().catch(() => {});
  console.log('\n✓ 测试数据已清理');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
