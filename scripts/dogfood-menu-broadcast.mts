/**
 * dogfood：每周 WhatsApp broadcast 文案生成（老板 2026-08-13 模板的固定要素必须全在、顺序不能乱）。
 * 纯逻辑，不碰 Firebase。
 */
import { buildMenu, MENU_SNAPSHOT_WEEK, DISH_CATALOG_ALL } from '@/data/weeklyMenu';
import { buildBroadcast, dishEmoji } from '@/lib/menuBroadcast';
import { ADD_ON_PRICES } from '@/data/addOnsConfig';

let fails = 0;
const ok = (c: unknown, m: string) => { if (c) console.log(`  ✓ ${m}`); else { fails++; console.error(`  ✗ ${m}`); } };

const week = MENU_SNAPSHOT_WEEK;
const menu = buildMenu(week);
const monday = '2026-09-14';
const prev = { days: { ...week.days, 5: week.days[5].slice(1) }, daily: week.daily, paused: week.paused }; // 上周没有周五主打 → 本周它是新菜
const text = buildBroadcast({ monday, week, prevWeek: prev, menu, customerName: 'Ah Ken' });

console.log('1. 固定要素顺序');
const must = [
    "Hi Ah Ken 😊 I'm wei ting from Incredibowl.",
    '🌿 Freshly cooked every morning. No MSG.',
    '🌐 Order anytime at Incredibowl.my',
    "Here's next week's menu (14 Sep – 18 Sep):",
    '🆕 NEW THIS WEEK',
    '🍚 Daily Staples (Available Every Day)',
    '✨ Daily Specials',
    'Monday (14 Sep)',
    'Friday (18 Sep)',
    '🍳 Add-ons',
    '📸 See all dish photos at Incredibowl.my',
    '🛵 Delivery (from Pearl Suria, next to Pearl Point, Old Klang Road)',
    '⏰ Order before 6:00 AM for same-day delivery.',
    '🍱 We prepare only a limited number of meals each day',
    '💬 Order directly at Incredibowl.my',
    '🙏 One small favour',
    "If you'd rather not receive our weekly menu, just reply STOP anytime.",
];
let pos = -1, ordered = true;
for (const m of must) { const i = text.indexOf(m); ok(i >= 0, `含「${m.slice(0, 40)}」`); if (i < pos) ordered = false; pos = Math.max(pos, i); }
ok(ordered, '要素顺序与模板一致');

console.log('2. 菜单内容');
const fri = DISH_CATALOG_ALL.find(d => d.id === week.days[5][0])!;
ok(text.includes(`${fri.nameEn} ${fri.name} ⭐NEW — RM${fri.price.toFixed(2).replace(/\.00$/, '')}`) || text.includes(`${fri.nameEn} ${fri.name} ⭐NEW — RM${fri.price}`), '上周没排的周五主打标为 NEW');
ok(text.includes('Friday only!'), '新菜供应日');
for (const id of week.daily) { const d = DISH_CATALOG_ALL.find(x => x.id === id)!; ok(text.includes(`${d.nameEn} ${d.name} — RM`), `常驻 ${d.name} 在 Daily Staples`); }
const monHero = DISH_CATALOG_ALL.find(d => d.id === week.days[1][0])!;
ok(text.indexOf('Monday (14 Sep)') < text.indexOf(monHero.nameEn) , '周一主打排在 Monday 段');
ok(!text.includes('undefined') && !text.includes('NaN'), '无 undefined / NaN');

console.log('3. 单一来源');
ok(text.includes(`Sunny side up egg +RM${ADD_ON_PRICES['sunny-egg'].toFixed(2)}`), '荷包蛋价来自 ADD_ON_PRICES');
ok(text.includes(`Potato fried egg +RM${ADD_ON_PRICES['potato-egg']}`) || text.includes(`Potato fried egg +RM${ADD_ON_PRICES['potato-egg'].toFixed(2)}`), '马铃薯煎蛋价来自 ADD_ON_PRICES');
ok(/Within 2\.5km RM3 \(FREE >RM20\)/.test(text), '运费第一档来自 deliveryCopy');
ok(/via Grab, flat rate/.test(text), '远距 Grab 说明');

console.log('4. 无上周文档 → 不标 NEW；forceNewIds 强制标');
const t2 = buildBroadcast({ monday, week, prevWeek: null, menu });
ok(!t2.includes('🆕 NEW THIS WEEK') && t2.includes('Hi {name} 😊'), 'prevWeek=null 不出 NEW 段，名字占位 {name}');
const t3 = buildBroadcast({ monday, week, prevWeek: null, menu, forceNewIds: [week.days[2][0]] });
ok(t3.includes('🆕 NEW THIS WEEK') && t3.includes('Tuesday only!'), 'forceNewIds 标周二主打为 NEW');

console.log('5. emoji');
ok(dishEmoji({ name: '蜜糖香煎三文鱼饭', nameEn: 'Honey Salmon' }) === '🐟', '三文鱼 🐟');
ok(dishEmoji({ name: '酱油鸡', nameEn: 'Soy Chicken' }) === '🍗', '鸡 🍗');
ok(dishEmoji({ name: '白萝卜焖花肉', nameEn: 'Daikon Pork Belly' }) === '🥓', '花肉 🥓');

if (fails) { console.error(`\n✗ ${fails} 条失败`); process.exit(1); }
console.log('\n✓ broadcast dogfood 全过\n');
console.log(text);
