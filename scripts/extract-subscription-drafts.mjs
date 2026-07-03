// 从近 8 周的餐券手动单里提取每个常客的「周模板草稿」，供 /admin/subscriptions
// 常客周计划（订阅引擎阶段 1）初始化。
//
// 推断逻辑：
//   - 候选人 = 近 8 周内有 mealVouchersUsed>0 订单的 userId（即真·餐券常客）
//   - 每个 weekday 取该客户点得最多的主菜组合 + 多数 meal/time
//   - 地址/电话/运费档取最近一单
//   - 已有 subscriptions 文档的 userId 跳过（不覆盖你手工调过的模板）
//
// 输出 markdown 草稿给老板过目；--seed 才写入 subscriptions（一律 active:false，
// 在 /admin/subscriptions 里核对启用）。
//
// Usage: node scripts/extract-subscription-drafts.mjs [--seed]
import admin from 'firebase-admin';
import fs from 'node:fs';

const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
const SEED = process.argv.includes('--seed');
const WEEKS_BACK = 8;

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();
const { FieldValue } = admin.firestore;

const WD_CN = ['日', '一', '二', '三', '四', '五', '六'];
const cutoff = new Date(Date.now() - WEEKS_BACK * 7 * 86400000);

// ── 拉近 8 周的餐券单 ──────────────────────────────────
const snap = await db.collection('orders')
  .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(cutoff))
  .get();

const voucherOrders = snap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .filter(o => (Number(o.mealVouchersUsed) || 0) > 0 && o.status !== 'cancelled');

console.log(`近 ${WEEKS_BACK} 周餐券单：${voucherOrders.length} 单`);

// ── 按 userId 聚合 ─────────────────────────────────────
const byUser = new Map();
for (const o of voucherOrders) {
  if (!o.userId) continue;
  const list = byUser.get(o.userId) || [];
  list.push(o);
  byUser.set(o.userId, list);
}

// 已有订阅的跳过
const subSnap = await db.collection('subscriptions').get();
const existingUserIds = new Set(subSnap.docs.map(d => d.data().userId));

const majority = (arr) => {
  const c = new Map();
  for (const x of arr) c.set(x, (c.get(x) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
};

const drafts = [];
for (const [userId, orders] of byUser) {
  if (existingUserIds.has(userId)) { console.log(`↷ 跳过（已有订阅）：${userId}`); continue; }
  orders.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  const latest = orders[0];

  // weekday → 出现过的「主菜组合 + meal + time」样本
  const dayBuckets = new Map(); // wd -> array of {key, items, meal, time}
  for (const o of orders) {
    if (!o.deliveryDate) continue;
    const wd = new Date(`${o.deliveryDate}T00:00:00`).getDay();
    if (wd < 1 || wd > 5) continue;
    // 网页单把加料存成独立 item 行（名字带「↳ 」前缀），要折叠回上一道主菜
    // 的 addOns；手动单的加料本来就嵌在 items[].addOns 里。
    const items = [];
    for (const it of o.items || []) {
      const rawName = String(it.name || '').trim();
      const isAddonRow = rawName.startsWith('↳');
      if (isAddonRow && items.length > 0) {
        items[items.length - 1].addOns.push({
          label: rawName.replace(/^↳\s*/, ''),
          price: Number(it.price) || 0,
          quantity: Number(it.quantity) || 1,
        });
        continue;
      }
      items.push({
        dishName: rawName,
        qty: Number(it.quantity) || 1,
        addOns: (it.addOns || []).map(a => ({
          label: String(a.label ?? a.name ?? ''),
          price: Number(a.price) || 0,
          quantity: Number(a.quantity) || 1,
        })),
      });
    }
    if (items.length === 0) continue;
    // 午/晚：手动单有 mealType；网页单 deliveryTime 是 'Lunch (11AM-1PM)' /
    // 'Dinner (5PM-8PM)'；手动单是 '12:00' / '19:00' 这类钟点。
    const dt = String(o.deliveryTime || '');
    let meal = o.mealType;
    if (!meal) {
      if (/lunch/i.test(dt)) meal = 'lunch';
      else if (/dinner/i.test(dt)) meal = 'dinner';
      else meal = (parseInt(dt, 10) || 12) < 15 ? 'lunch' : 'dinner';
    }
    const time = /^\d{1,2}:\d{2}$/.test(dt) ? dt : (meal === 'dinner' ? '19:00' : '12:00');
    const key = items.map(i => `${i.dishName}×${i.qty}`).sort().join('|');
    const bucket = dayBuckets.get(wd) || [];
    bucket.push({ key, items, meal, time });
    dayBuckets.set(wd, bucket);
  }

  const plan = {};
  for (const [wd, bucket] of dayBuckets) {
    const topKey = majority(bucket.map(b => b.key));
    const sample = bucket.find(b => b.key === topKey);
    plan[String(wd)] = {
      meal: majority(bucket.map(b => b.meal)) === 'dinner' ? 'dinner' : 'lunch',
      time: majority(bucket.map(b => b.time)) || '12:00',
      items: sample.items,
    };
  }
  if (Object.keys(plan).length === 0) continue;

  drafts.push({
    userId,
    name: latest.userName || '',
    phone: latest.userPhone || '',
    address: latest.userAddress || '',
    deliveryTier: latest.deliveryTier || 'near',
    deliveryZone: latest.deliveryZone || 'within2km',
    deliveryDistanceKm: Number(latest.deliveryDistanceKm) || 0,
    deliveryFeePerDelivery: Number(latest.deliveryFee) || 0,
    active: false, // 草稿：老板在 /admin/subscriptions 核对后手动启用
    note: `自动提取草稿（${orders.length} 单样本，${WEEKS_BACK} 周窗口）— 核对后改 active`,
    plan,
    _sampleCount: orders.length,
  });
}

// ── 输出 markdown 草稿 ────────────────────────────────
console.log(`\n=== 提取到 ${drafts.length} 个常客草稿 ===\n`);
for (const d of drafts) {
  console.log(`## ${d.name}（${d.phone}）· ${d._sampleCount} 单样本 · ${d.deliveryTier} 运费 RM${d.deliveryFeePerDelivery}`);
  console.log(`   ${d.userId} · ${d.address}`);
  for (const wd of ['1', '2', '3', '4', '5']) {
    const day = d.plan[wd];
    if (!day) continue;
    const items = day.items.map(i => `${i.dishName}×${i.qty}${i.addOns.length ? `（+${i.addOns.map(a => a.label).join('+')}）` : ''}`).join('、');
    console.log(`   周${WD_CN[wd]} ${day.meal === 'dinner' ? '晚' : '午'} ${day.time}：${items}`);
  }
  console.log('');
}

if (!SEED) { console.log('[DRY RUN] 未写入。核对无误后加 --seed 写入 subscriptions（active:false）。'); process.exit(0); }

const batch = db.batch();
for (const d of drafts) {
  const { _sampleCount, ...doc } = d;
  batch.set(db.collection('subscriptions').doc(), {
    ...doc,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: 'extract-subscription-drafts.mjs',
  });
}
await batch.commit();
console.log(`✅ 已写入 ${drafts.length} 个订阅草稿（全部 active:false，去 /admin/subscriptions 核对启用）`);
process.exit(0);
