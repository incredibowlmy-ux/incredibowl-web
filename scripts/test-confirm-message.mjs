// 验证 buildConfirmMessage 的格式逻辑 = 老板给的示例消息。
// 这是 dashboard 里同一份逻辑的镜像（dashboard 是 .html 不好直接 import）。
// 跑：node scripts/test-confirm-message.mjs

// dashboard 用 localStorage 记落款人；node 没有 localStorage，这里默认 Wei Ting
const _cmFirstName = n => (String(n || '').trim().split(/\s+/)[0]) || '亲';
const _cmMoney = n => 'RM ' + (Number(n) || 0).toFixed(2);
function _cmDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(String(dateStr) + 'T00:00:00');
  if (isNaN(d.getTime())) return String(dateStr);
  const wd = d.toLocaleDateString('en-US', { weekday: 'short' });
  const mo = d.toLocaleDateString('en-US', { month: 'long' });
  return `${wd}, ${d.getDate()} ${mo}`;
}
function _cmMeal(o) {
  const m = String(o.mealType || '').toLowerCase();
  if (m === 'lunch') return 'Lunch';
  if (m === 'dinner') return 'Dinner';
  const t = String(o.deliveryTime || '');
  if (/lunch|午/i.test(t)) return 'Lunch';
  if (/dinner|晚/i.test(t)) return 'Dinner';
  return '';
}
function waPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('60')) return d;
  if (d.startsWith('0')) return '60' + d.slice(1);
  if (d.startsWith('1')) return '60' + d;
  return d;
}
function buildConfirmMessage(o, sender) {
  sender = sender || 'Wei Ting';
  const first = _cmFirstName(o.userName);
  const L = [];
  L.push(`Hi ${first} 😊 ${sender} from Incredibowl — order confirmed!`);
  L.push('');
  const head = [_cmDate(o.deliveryDate), _cmMeal(o)].filter(Boolean).join(' · ');
  if (head) L.push(`📅 ${head}`);
  (o.items || []).forEach(it => {
    const rawName = String(it.name || '');
    const isAddon = rawName.startsWith('↳');
    const zh = rawName.replace(/^↳\s*/, '').trim();
    const en = String(it.nameEn || '').trim();
    const label = en ? `${en} ${zh}` : zh;
    const qty = Number(it.quantity) || 1;
    L.push(`${isAddon ? '🍳' : '🍲'} ${label} ×${qty} — ${_cmMoney((Number(it.price) || 0) * qty)}`);
    (it.addOns || []).forEach(a => {
      const al = a.label || a.name || a.id || '加料';
      const aq = Number(a.quantity) || 1;
      L.push(`🍳 ${al} ×${aq} — ${_cmMoney((Number(a.price) || 0) * aq)}`);
    });
  });
  const mvDisc = Number(o.mealVoucherDiscount) || 0;
  if (mvDisc > 0) L.push(`🎫 Meal voucher — −${_cmMoney(mvDisc)}`);
  const promoDisc = Number(o.promoDiscount) || 0;
  if (promoDisc > 0) L.push(`🎟 ${o.promoCode || 'Promo'} — −${_cmMoney(promoDisc)}`);
  const fee = Number(o.deliveryFee) || 0;
  L.push(fee > 0 ? `🛵 Delivery — ${_cmMoney(fee)}` : `🛵 Delivery — FREE 🎉`);
  L.push('━'.repeat(19));
  L.push(`✅ Total ${_cmMoney((Number(o.total) || 0) + fee)}`);
  if (o.deliveryTime) L.push(`🕛 Delivery at ${o.deliveryTime} 👍`);
  L.push('');
  if (o.userAddress) L.push(`📍 ${o.userAddress}`);
  L.push(`💳 How would you like to pay? (DuitNow QR / FPX / transfer) — a screenshot once done would be great 🙏`);
  L.push('');
  L.push(`Thank you, ${first}! ✨`);
  L.push(`— ${sender}`);
  return L.join('\n');
}

// ── 用老板示例那一单构造订单（egg 是 add-on，存为 ↳ 行 + nameEn）──
const sampleOrder = {
  userName: 'Fione Lim',
  userPhone: '0123456789',
  userAddress: '13-9-5, Danau Impian Condo, Taman Danau Desa',
  deliveryDate: '2026-06-17',
  mealType: 'lunch',
  deliveryTime: '12pm',
  items: [
    { name: '马铃薯炖花肉片', nameEn: 'Potato Braised Pork Belly', price: 19.90, quantity: 1 },
    { name: '↳ 马铃薯煎蛋', nameEn: 'Potato Fried Egg', price: 3.50, quantity: 1 },
  ],
  deliveryFee: 0,
  total: 23.40,
  status: 'pending',
};

const expected = [
  'Hi Fione 😊 Wei Ting from Incredibowl — order confirmed!',
  '',
  '📅 Wed, 17 June · Lunch',
  '🍲 Potato Braised Pork Belly 马铃薯炖花肉片 ×1 — RM 19.90',
  '🍳 Potato Fried Egg 马铃薯煎蛋 ×1 — RM 3.50',
  '🛵 Delivery — FREE 🎉',
  '━'.repeat(19),
  '✅ Total RM 23.40',
  '🕛 Delivery at 12pm 👍',
  '',
  '📍 13-9-5, Danau Impian Condo, Taman Danau Desa',
  '💳 How would you like to pay? (DuitNow QR / FPX / transfer) — a screenshot once done would be great 🙏',
  '',
  'Thank you, Fione! ✨',
  '— Wei Ting',
].join('\n');

const got = buildConfirmMessage(sampleOrder);
console.log('───── 生成结果 ─────');
console.log(got);
console.log('────────────────────');

if (got === expected) {
  console.log('\n✅ PASS：生成结果与示例消息逐字一致');
} else {
  console.log('\n❌ FAIL：与示例不一致');
  const a = got.split('\n'), b = expected.split('\n');
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (a[i] !== b[i]) console.log(`  行${i + 1}\n    got: ${JSON.stringify(a[i])}\n    exp: ${JSON.stringify(b[i])}`);
  }
  process.exit(1);
}

// 电话归一化抽测
const phoneCases = [['0123456789', '60123456789'], ['+60 12-345 6789', '60123456789'], ['60123456789', '60123456789'], ['123456789', '60123456789'], ['', '']];
let pPass = true;
for (const [inp, exp] of phoneCases) {
  const r = waPhone(inp);
  if (r !== exp) { pPass = false; console.log(`❌ waPhone(${JSON.stringify(inp)}) = ${JSON.stringify(r)}, 期望 ${JSON.stringify(exp)}`); }
}
console.log(pPass ? '✅ PASS：电话归一化全过' : '❌ FAIL：电话归一化有错');
if (!pPass) process.exit(1);
