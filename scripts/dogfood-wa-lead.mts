/**
 * dogfood-wa-lead.mts —— 追单排程 + 碗数口径的纯函数验证（不碰 Firestore、不发网络）。
 *
 * 为什么这两块必须单测：
 *  · 追单排程是**唯一**会主动骚扰真实客户的逻辑。算错 = 凌晨给人发广告。
 *    老板 2026-08-16 明确否决了 05:15 那一档，这里逐条把规矩钉死。
 *  · 碗数口径决定团餐档期。算错 = bot 替老板接下厨房做不出的单。
 *    实测 2026-07-16 那张单是 1 碗 + 8 条加料行，天真的 sum 会算成 11。
 *
 * 跑法：npx tsx scripts/dogfood-wa-lead.mts
 */

import {
  computeNextNudge, shiftOutOfQuietHours, isWithinWindow, mytClock, mytHour,
  NUDGE2_HOUR, MAX_NUDGES, WINDOW_MS, NUDGE1_DELAY_MS,
} from '@/lib/waLeadSchedule';
import { bowlsInOrder, isAddonLine } from '@/lib/bowlCount';

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${detail ? ` —— ${detail}` : ''}`); }
}

/** 造一个 MYT 墙上时钟时刻（YYYY-MM-DD HH:mm，UTC+8）。 */
function myt(ymd: string, hh: number, mm = 0): number {
  return new Date(`${ymd}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+08:00`).getTime();
}
function fmt(ms: number | null): string {
  if (ms === null) return '(不追)';
  const d = new Date(ms + 8 * 3600 * 1000);
  return `${d.toISOString().slice(0, 10)} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

console.log('\n=== 1. MYT 时钟工具 ===');
{
  const t = myt('2026-08-17', 14, 30);
  check('mytHour 读的是 MYT 墙上钟点，不是 UTC', mytHour(t) === 14, `得到 ${mytHour(t)}`);
  check('mytClock 同日 21:00', fmt(mytClock(t, 21)) === '2026-08-17 21:00', fmt(mytClock(t, 21)));
  check('mytClock 次日 09:00', fmt(mytClock(t, 9, 0, 1)) === '2026-08-18 09:00', fmt(mytClock(t, 9, 0, 1)));
}

console.log('\n=== 2. 静默时段保护（22:00–09:00 不发）===');
{
  check('14:35 正常时段原样', fmt(shiftOutOfQuietHours(myt('2026-08-17', 14, 35))) === '2026-08-17 14:35');
  check('22:05 → 次日 09:00', fmt(shiftOutOfQuietHours(myt('2026-08-17', 22, 5))) === '2026-08-18 09:00',
    fmt(shiftOutOfQuietHours(myt('2026-08-17', 22, 5))));
  check('02:00 → 当天 09:00', fmt(shiftOutOfQuietHours(myt('2026-08-18', 2, 0))) === '2026-08-18 09:00',
    fmt(shiftOutOfQuietHours(myt('2026-08-18', 2, 0))));
  check('09:00 边界不推迟', fmt(shiftOutOfQuietHours(myt('2026-08-18', 9, 0))) === '2026-08-18 09:00');
  check('21:59 边界仍算正常', fmt(shiftOutOfQuietHours(myt('2026-08-17', 21, 59))) === '2026-08-17 21:59');
}

console.log('\n=== 3. 第 1 次追单 = 客户消息 +35 分钟 ===');
{
  const t = myt('2026-08-17', 14, 0);
  const n1 = computeNextNudge({ lastMsgMs: t, nudgeCount: 0 });
  check('14:00 来消息 → 14:35 追', fmt(n1) === '2026-08-17 14:35', fmt(n1));
  check('延迟常量就是 35 分钟', NUDGE1_DELAY_MS === 35 * 60 * 1000);

  const late = myt('2026-08-17', 23, 40);
  check('23:40 来消息 → 次日 09:00（不半夜发）',
    fmt(computeNextNudge({ lastMsgMs: late, nudgeCount: 0 })) === '2026-08-18 09:00',
    fmt(computeNextNudge({ lastMsgMs: late, nudgeCount: 0 })));

  const dawn = myt('2026-08-18', 3, 10);
  check('03:10 来消息 → 当天 09:00',
    fmt(computeNextNudge({ lastMsgMs: dawn, nudgeCount: 0 })) === '2026-08-18 09:00',
    fmt(computeNextNudge({ lastMsgMs: dawn, nudgeCount: 0 })));
}

console.log('\n=== 4. 第 2 次追单 = 21:00（⛔ 老板否决 05:15）===');
{
  const t = myt('2026-08-17', 14, 0);
  const n2 = computeNextNudge({ lastMsgMs: t, nudgeCount: 1, lastNudgeMs: myt('2026-08-17', 14, 35) });
  check('14:00 的客户 → 当晚 21:00 追第二次', fmt(n2) === '2026-08-17 21:00', fmt(n2));
  check('第二次绝不落在凌晨 05:15', n2 !== null && mytHour(n2) === NUDGE2_HOUR, fmt(n2));

  // 傍晚来的客户：19:35 刚追过，21:00 只隔 1h25m → 顺延，且顺延后超窗就放弃
  const eve = myt('2026-08-17', 19, 0);
  const n2eve = computeNextNudge({ lastMsgMs: eve, nudgeCount: 1, lastNudgeMs: myt('2026-08-17', 19, 35) });
  check('19:00 的客户不会在 21:00 被连着戳（间隔<3h → 顺延后超窗 → 不追）',
    n2eve === null, fmt(n2eve));

  // 21:30 来的客户：今晚 21:00 已过 → 明晚 21:00，仍在 24h 窗口内
  const night = myt('2026-08-17', 21, 30);
  const n2night = computeNextNudge({ lastMsgMs: night, nudgeCount: 1, lastNudgeMs: myt('2026-08-18', 9, 0) });
  check('21:30 的客户 → 次日 21:00（今晚那班已开走）', fmt(n2night) === '2026-08-18 21:00', fmt(n2night));
  check('  且仍在 24h 窗口内', n2night !== null && n2night <= night + WINDOW_MS);
}

console.log('\n=== 5. 24h 客服窗口是硬边界（第一阶段不上 template）===');
{
  const t = myt('2026-08-17', 10, 0);
  check('窗口内 = true', isWithinWindow(t, myt('2026-08-18', 9, 59)));
  check('窗口外 = false', !isWithinWindow(t, myt('2026-08-18', 10, 1)));

  // 09:50 来消息 → 第二次本该是次日 21:00，但那时窗口已关 → 放弃
  const morning = myt('2026-08-17', 9, 50);
  const n2m = computeNextNudge({ lastMsgMs: morning, nudgeCount: 1, lastNudgeMs: myt('2026-08-17', 10, 25) });
  check('09:50 客户当晚 21:00 仍在窗口内 → 追', fmt(n2m) === '2026-08-17 21:00', fmt(n2m));
}

console.log('\n=== 6. 追单上限 2 次 ===');
{
  const t = myt('2026-08-17', 14, 0);
  check('MAX_NUDGES = 2', MAX_NUDGES === 2);
  check('已追 2 次 → 不再排', computeNextNudge({ lastMsgMs: t, nudgeCount: 2, lastNudgeMs: t }) === null);
  check('已追 3 次（脏数据）→ 不再排', computeNextNudge({ lastMsgMs: t, nudgeCount: 3, lastNudgeMs: t }) === null);
  check('lastMsgMs 非法 → 不排（不拿脏数据发消息）', computeNextNudge({ lastMsgMs: 0, nudgeCount: 0 }) === null);
  check('lastMsgMs NaN → 不排', computeNextNudge({ lastMsgMs: NaN, nudgeCount: 0 }) === null);
}

console.log('\n=== 7. 全天扫一遍：任何时刻来的客户都不会在静默时段被打扰 ===');
{
  let bad = 0;
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 17, 41, 59]) {
      const t = myt('2026-08-17', h, m);
      for (const [count, last] of [[0, 0], [1, t + NUDGE1_DELAY_MS]] as const) {
        const n = computeNextNudge({ lastMsgMs: t, nudgeCount: count, lastNudgeMs: last });
        if (n === null) continue;
        const hh = mytHour(n);
        if (hh >= 22 || hh < 9) { bad++; console.log(`     ⚠️ ${fmt(t)} → ${fmt(n)}`); }
        if (n > t + WINDOW_MS) { bad++; console.log(`     ⚠️ 超窗 ${fmt(t)} → ${fmt(n)}`); }
      }
    }
  }
  check('96 个时刻 × 2 轮，零条落在静默时段或窗口外', bad === 0, `${bad} 条违规`);
}

console.log('\n=== 8. 碗数口径（团餐档期的地基）===');
{
  check('↳ 开头 = 加料行', isAddonLine({ name: '↳ 加饭 (150g)' }));
  check('普通菜名不是加料行', !isAddonLine({ name: '家乡白萝卜焖花肉' }));

  // 真实样本：2026-07-16 那张单 —— 1 碗 + 8 条加料行，天真 sum 会算成 11
  const realWeb = [
    { name: '香煎金黄鸡扒饭', quantity: 1 },
    { name: '↳ 加香煎金鸡扒 (150g)', quantity: 2 },
    { name: '↳ 清甜水煮毛豆仁 (25g)', quantity: 1 },
    { name: '↳ 金黄甜玉米 (30g)', quantity: 1 },
    { name: '↳ 加饭 (150g)', quantity: 3 },
    { name: '↳ 荷包蛋', quantity: 1 },
    { name: '↳ 马铃薯煎蛋', quantity: 1 },
    { name: '↳ 蒜蓉西兰花炒蛋', quantity: 1 },
  ];
  const naive = realWeb.reduce((s, i) => s + i.quantity, 0);
  check(`网页单：真实 1 碗（天真 sum 会得 ${naive}）`, bowlsInOrder(realWeb) === 1, String(bowlsInOrder(realWeb)));

  // 真实样本：2026-08-21 Sasha 32 份团餐（单一菜）
  check('团餐单一菜 32 份', bowlsInOrder([{ name: '马铃薯炖花肉片', quantity: 32 }]) === 32);
  // 真实样本：2026-07-10 Abbie 22+10
  check('团餐两道菜 22+10 = 32',
    bowlsInOrder([{ name: '香煎金黄鸡扒饭', quantity: 22 }, { name: '家乡豆酱焖花肉', quantity: 10 }]) === 32);
  // 手动单：加料嵌在 addOns 里，item.quantity 本身就是碗数
  check('手动单嵌套 addOns 不影响碗数',
    bowlsInOrder([{ name: '家乡白萝卜焖花肉', quantity: 13, addOns: [{ name: '温泉蛋', quantity: 5 }] }]) === 13);

  check('items 缺失 → 0（不抛错）', bowlsInOrder(undefined) === 0);
  check('items 非数组 → 0', bowlsInOrder('boom' as unknown) === 0);
  check('畸形行被跳过', bowlsInOrder([null, { name: 'x' }, { name: 'y', quantity: -3 }, { name: 'z', quantity: 2 }]) === 2);
}

console.log(`\n${'─'.repeat(52)}`);
console.log(`通过 ${pass} · 失败 ${fail}`);
if (fail > 0) process.exit(1);
