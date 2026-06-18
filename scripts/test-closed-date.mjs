// 验证「整天关闭」逻辑：周五 2026-06-19 关闭 → 菜单顺延到下周一 + 周五下单被拒。
// 镜像 dateUtils 的 nextAvail 推进 + cartDateUtils 的 isOrderDateValid 关闭检查。
// 跑：node scripts/test-closed-date.mjs

const CLOSED_DATES = ['2026-06-19'];
const isDateClosed = (ymd) => CLOSED_DATES.includes(ymd);

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

// 镜像 computeMenuDates：从“截单后第二天”出发，跳周末 + 跳关闭日
function nextAvailFrom(startYmd) {
    const d = parse(startYmd);
    if (d.getDay() === 6) d.setDate(d.getDate() + 2);
    else if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    let safety = 14;
    while (safety-- > 0 && isDateClosed(ymd(d))) {
        d.setDate(d.getDate() + 1);
        if (d.getDay() === 6) d.setDate(d.getDate() + 2);
        else if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    }
    return ymd(d);
}

// 镜像 isOrderDateValid 的关闭检查（只测关闭相关分支）
function orderDateState(selectedDate) {
    const d = parse(selectedDate);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) return 'weekend';
    if (isDateClosed(selectedDate)) return 'sold_out';
    return 'ok';
}

let pass = true;
const check = (name, got, exp) => {
    const ok = got === exp;
    if (!ok) pass = false;
    console.log(`${ok ? '✅' : '❌'} ${name}: ${JSON.stringify(got)}${ok ? '' : ` (期望 ${JSON.stringify(exp)})`}`);
};

// 今天周四 6-18 过截单 → 起点是 6-19(周五，关闭) → 应顺延到 6-22(周一)
check('周四过截单 → nextAvail 顺延到下周一', nextAvailFrom('2026-06-19'), '2026-06-22');
// 6-22 是周一，没关闭
check('下周一 6-22 可下单', orderDateState('2026-06-22'), 'ok');
// 周五 6-19 关闭 → sold_out
check('周五 6-19 下单被拒 sold_out', orderDateState('2026-06-19'), 'sold_out');
// 下一个周五 6-26 没关闭 → ok（只关这一个周五，不是永久）
check('下个周五 6-26 照常可下单', orderDateState('2026-06-26'), 'ok');
// 关闭日过后（假设起点是 6-26 周五）→ 不受影响
check('6-26 起点不被顺延', nextAvailFrom('2026-06-26'), '2026-06-26');

// ── Hero 标签：周五售罄顺延周一后，鸡排饭不能再挂「明日特餐」──
function heroLabel(diff, targetWd) {
    const wdCn = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const wdEn = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    let zh = '今日特餐', en = "TODAY'S SPECIAL";
    if (diff === 1) { zh = '明日特餐'; en = "TOMORROW'S SPECIAL"; }
    else if (diff === 2) { zh = '后日特餐'; en = "DAY AFTER SPECIAL"; }
    else if (diff > 2) { zh = `${wdCn[targetWd]}特餐`; en = `${wdEn[targetWd]} SPECIAL`; }
    return { zh, en };
}
// 周四(6-18) → 周一(6-22) = diff 4，targetWd=1(周一)
const lbl = heroLabel(4, 1);
check('Hero 周一标签 zh', lbl.zh, '周一特餐');
check('Hero 周一标签 en', lbl.en, 'MON SPECIAL');
check('Hero 标签不再是「明日特餐」', lbl.zh === '明日特餐', false);

console.log(pass ? '\n✅ 全部通过' : '\n❌ 有失败');
if (!pass) process.exit(1);
