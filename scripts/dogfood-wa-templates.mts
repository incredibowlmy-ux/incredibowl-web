/**
 * 模板变量的纯函数断言：订单确认（waOrderConfirm）+ 每周菜单群发（broadcastTemplateParams）。
 *   npx tsx scripts/dogfood-wa-templates.mts
 *
 * 模板正文是 Meta 审过的死文案，能错的只有变量：日期格式、语言、名字兜底、新菜连接词、
 * 变量里不能有换行。这里把每条钉死。
 */
import assert from 'node:assert/strict';
import { deliveryLabel, orderConfirmParams, normalizePhone, shortId, isOrderConfirmEnabled, ORDER_CONFIRM_TEMPLATE } from '../src/lib/waOrderConfirm';
import { broadcastTemplateParams, broadcastWeekFor } from '../src/lib/menuBroadcast';
import { properName } from '../src/lib/waName';
import type { MenuItem, MenuWeek } from '../src/data/weeklyMenu';

let n = 0;
const ok = (c: boolean, m: string) => { assert.ok(c, m); n++; };

// ── 订单确认 ────────────────────────────────────────────────
ok(deliveryLabel('2026-09-10', 'Lunch (11AM-1PM)', 'zh') === '9 月 10 日午餐 11:00–13:00', '中文送达标签');
ok(deliveryLabel('2026-09-10', 'Dinner (5PM-8PM)', 'en') === 'Sep 10, dinner 17:00–20:00', '英文送达标签');
ok(deliveryLabel('bad', 'Lunch (11AM-1PM)', 'zh') === '午餐 11:00–13:00', '日期坏了只剩时段');
ok(deliveryLabel('', '', 'en') === 'as scheduled', '全空 → 英文兜底');
ok(deliveryLabel('2026-12-01', 'Weird slot', 'zh') === '12 月 1 日Weird slot', '未知时段原样带上');

const zh = orderConfirmParams('abcdef123456', { userName: '小明', locale: 'zh', deliveryDate: '2026-09-10', deliveryTime: 'Lunch (11AM-1PM)' });
ok(zh.locale === 'zh' && zh.params[0] === '小明' && zh.params[1] === '123456', '中文单：名字 + 短号');
ok(orderConfirmParams('x', { userName: 'ebby cheong', locale: 'en' }).params[0] === 'Ebby Cheong', '订单确认名字规整');
const en = orderConfirmParams('xyz', { userName: '', locale: 'en', deliveryDate: '2026-09-10', deliveryTime: 'Dinner (5PM-8PM)' });
ok(en.locale === 'en' && en.params[0] === 'there' && en.params[1] === 'XYZ', '英文单没名字 → there，短号大写');
ok(orderConfirmParams('x', { locale: 'fr' }).locale === 'zh', '未知 locale → 中文');
ok(orderConfirmParams('x', { userName: 'A'.repeat(100), locale: 'zh' }).params[0].length === 60, '名字截 60');
ok(ORDER_CONFIRM_TEMPLATE.zh === 'order_confirmed_zh_v1' && ORDER_CONFIRM_TEMPLATE.en === 'order_confirmed_en_v1', '模板名与 wa-templates.mjs 一致');
ok(shortId('abc') === 'ABC' && shortId('') === '', 'shortId 兜底');

ok(normalizePhone('0165119118') === '60165119118', '本地号 → 60');
ok(normalizePhone('+60 16-511 9118') === '60165119118', '带符号');
ok(normalizePhone('12345') === '' && normalizePhone('') === '', '不合法 → 空');
delete process.env.WA_ORDER_CONFIRM;
ok(!isOrderConfirmEnabled(), '默认关');
process.env.WA_ORDER_CONFIRM = '1';
ok(isOrderConfirmEnabled(), 'WA_ORDER_CONFIRM=1 才开');
delete process.env.WA_ORDER_CONFIRM;

// ── 每周菜单群发变量 ─────────────────────────────────────────
const dish = (id: number, nameEn: string): MenuItem => ({ id, name: `菜${id}`, nameEn } as unknown as MenuItem);
const week = (ids: number[], daily: number[] = []): MenuWeek => ({ daily, days: { 1: ids, 2: [], 3: [], 4: [], 5: [] } } as unknown as MenuWeek);
const menu = [dish(1, 'Chicken Chop'), dish(2, 'Surf & Turf'), dish(3, 'Lemon Salmon'), dish(4, 'Natto Bowl'), dish(5, 'Curry')];

let p = broadcastTemplateParams({ monday: '2026-09-14', week: week([1, 2]), prevWeek: week([1]), menu, name: 'Ebby' });
ok(p[0] === 'Ebby', '{{1}} 名字');
ok(p[1] === '14 Sep – 18 Sep', '{{2}} 周一到周五');
ok(p[2] === 'New this week: Surf & Turf', '{{3}} 一道新菜');
p = broadcastTemplateParams({ monday: '2026-09-14', week: week([1, 2, 3]), prevWeek: week([1]), menu, name: '' });
ok(p[0] === 'there', '没名字 → there');
ok(p[2] === 'New this week: Surf & Turf and Lemon Salmon', '菜名含 & 时连接词用 and');
p = broadcastTemplateParams({ monday: '2026-09-14', week: week([1, 3]), prevWeek: week([1]), menu, name: 'A' });
ok(p[2] === 'New this week: Lemon Salmon', '不含 & 的单个新菜');
p = broadcastTemplateParams({ monday: '2026-09-14', week: week([1, 3, 4]), prevWeek: week([1]), menu, name: 'A' });
ok(p[2] === 'New this week: Lemon Salmon & Natto Bowl', '两道新菜用 &');
p = broadcastTemplateParams({ monday: '2026-09-14', week: week([1, 3, 4, 5]), prevWeek: week([1]), menu, name: 'A' });
ok(p[2] === 'New this week: Lemon Salmon, Natto Bowl & 1 more', '三道以上折叠');
p = broadcastTemplateParams({ monday: '2026-09-14', week: week([1]), prevWeek: week([1]), menu, name: 'A' });
ok(p[2] === 'All your favourites are back on the menu', '没新菜的兜底句');
p = broadcastTemplateParams({ monday: '2026-09-14', week: week([1, 3]), prevWeek: null, menu, name: 'A' });
ok(p[2] === 'All your favourites are back on the menu', '没有上周排期 → 不标新菜');
p = broadcastTemplateParams({ monday: '2026-09-14', week: week([1], [3]), prevWeek: week([1]), menu, name: 'A' });
ok(p[2] === 'New this week: Lemon Salmon', '常驻（daily）里的新菜也算');
p = broadcastTemplateParams({ monday: '2026-09-28', week: week([1, 3]), prevWeek: week([1]), menu, name: 'A' });
ok(p[1] === '28 Sep – 2 Oct', '跨月日期段');
ok(!/\n/.test(p.join('')), '变量里没有换行（Meta 禁）');
p = broadcastTemplateParams({ monday: '2026-09-14', week: week([1]), prevWeek: week([1]), menu, name: '  ebby   cheong ' });
ok(p[0] === 'Ebby Cheong', '群发名字规整');

// ── Full menu 讲哪一周（输入 UTC 毫秒，按 MYT 判）───────────────
const myt = (s: string) => Date.parse(s + '+08:00');
ok(broadcastWeekFor(myt('2026-09-09T22:00:00')) === '2026-09-07', '周三晚 → 本周一');
ok(broadcastWeekFor(myt('2026-09-07T10:00:00')) === '2026-09-07', '周一 → 本周一');
ok(broadcastWeekFor(myt('2026-09-11T05:59:00')) === '2026-09-07', '周五截单前 → 本周一');
ok(broadcastWeekFor(myt('2026-09-11T06:00:00')) === '2026-09-14', '周五 06:00 起 → 下周一');
ok(broadcastWeekFor(myt('2026-09-12T12:00:00')) === '2026-09-14', '周六 → 下周一');
ok(broadcastWeekFor(myt('2026-09-13T23:30:00')) === '2026-09-14', '周日深夜 → 下周一');
ok(broadcastWeekFor(myt('2026-09-14T00:30:00')) === '2026-09-14', '周一凌晨（UTC 还是周日）→ 本周一');

// ── 称呼规整 ────────────────────────────────────────────────
ok(properName('ebby cheong') === 'Ebby Cheong', '小写 → 首字母大写');
ok(properName('TAN AH KOW') === 'Tan Ah Kow', '全大写 → 首字母大写');
ok(properName('mary-ann lee') === 'Mary-Ann Lee', '连字符两段都处理');
ok(properName('陈小明') === '陈小明', '中文原样');
ok(properName('') === 'there' && properName(null, '朋友') === '朋友', '空 → 兜底');
ok(properName('a'.repeat(100)).length === 60, '截 60');

console.log(`✓ dogfood-wa-templates ${n} 条全过`);
