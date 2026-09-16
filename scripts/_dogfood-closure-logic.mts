// Dogfood: 停业日 / 只送午餐 / 复工日推导 / 时段拒收
import { isDateClosed, isDinnerClosedOn, isLunchClosedOn, nextOpenDayAfter, upcomingClosures, upcomingDinnerClosedDates } from '@/data/blockedDates';
import { isSlotOrderableOn, isOrderDateValid } from '@/lib/cartDateUtils';

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? '✅' : '❌'} ${label}  got=${JSON.stringify(got)}${ok ? '' : ` want=${JSON.stringify(want)}`}`);
};

// 整天停业
eq('8/28 周五 未停业', isDateClosed('2026-08-28'), false);
eq('8/31 周一 停业', isDateClosed('2026-08-31'), true);
eq('9/01 停业', isDateClosed('2026-09-01'), true);
eq('9/02 停业', isDateClosed('2026-09-02'), true);
eq('9/03 未停业', isDateClosed('2026-09-03'), false);

// 只送午餐
eq('8/28 晚市关', isDinnerClosedOn('2026-08-28'), true);
eq('8/27 晚市开', isDinnerClosedOn('2026-08-27'), false);

// 复工日从数据推（不写死）
eq('9/02 之后第一个可送日 = 9/03 周四', nextOpenDayAfter('2026-09-02'), '2026-09-03');

// 时段校验
eq('8/28 晚餐 拒收', isSlotOrderableOn('2026-08-28', 'Dinner (5PM-8PM)').ok, false);
eq('8/28 午餐 放行', isSlotOrderableOn('2026-08-28', 'Lunch (11AM-1PM)').ok, true);
eq('8/27 晚餐 放行', isSlotOrderableOn('2026-08-27', 'Dinner (5PM-8PM)').ok, true);
eq('中文「晚餐」也认', isSlotOrderableOn('2026-08-28', '晚餐 5PM-8PM').ok, false);

// 只送晚餐（9/18 周五关午市）
eq('9/18 午市关', isLunchClosedOn('2026-09-18'), true);
eq('9/18 晚市开', isDinnerClosedOn('2026-09-18'), false);
eq('9/18 整天没关', isDateClosed('2026-09-18'), false);
eq('9/17 午市开', isLunchClosedOn('2026-09-17'), false);
eq('9/18 午餐 拒收', isSlotOrderableOn('2026-09-18', 'Lunch (11AM-1PM)').ok, false);
eq('9/18 中文「午餐」也拒', isSlotOrderableOn('2026-09-18', '午餐 11AM-1PM').ok, false);
eq('9/18 晚餐 放行', isSlotOrderableOn('2026-09-18', 'Dinner (5PM-8PM)').ok, true);
eq('9/17 午餐 放行', isSlotOrderableOn('2026-09-17', 'Lunch (11AM-1PM)').ok, true);
eq('9/25 午餐 放行', isSlotOrderableOn('2026-09-25', 'Lunch (11AM-1PM)').ok, true);

// 整日停业仍由 isOrderDateValid 挡
eq('8/31 整日 拒收', isOrderDateValid('2026-08-31').ok, false);
eq('8/28 日期 放行', isOrderDateValid('2026-08-28').ok, true);

// 横幅数据
console.log('\n横幅（以 2026-08-20 为今天）:');
console.log('  停业:', JSON.stringify(upcomingClosures('2026-08-20')));
console.log('  只午餐:', JSON.stringify(upcomingDinnerClosedDates('2026-08-20')));

console.log(fail === 0 ? '\n🎉 全部通过' : `\n💥 ${fail} 条失败`);
process.exit(fail === 0 ? 0 : 1);
