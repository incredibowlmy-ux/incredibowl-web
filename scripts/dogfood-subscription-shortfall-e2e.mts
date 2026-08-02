/**
 * Dogfood E2E：周订阅 preview 打真接口 —— 券不够 → 差额按原价现金收。
 *
 * 只读（preview 是 dry-run，不写库）。用真 admin token 打本地 dev server，
 * 拿真订阅 + 真券余额，核对一组无论券够不够都必须成立的不变式：
 *   · vouchersUsed = min(有, 需)          —— 有多少用多少，不多扣
 *   · cashUnits    = 需 − vouchersUsed    —— 剩下的份一份不漏地转现金
 *   · Σ 每天 vCount = vouchersUsed        —— 天级与汇总对得上
 *   · cashDue = originalTotal − coverage − upgradeCoverage + deliveryFee
 *   · 券不足时 canConfirm 仍为 true       —— 本次改动的核心行为
 *   · WhatsApp 文案不出现负数余券
 *
 * 跑法（先 npm run dev）：
 *   node --import ./scripts/_register-alias.mjs scripts/dogfood-subscription-shortfall-e2e.mts [weekStart]
 */

import admin from 'firebase-admin';
import fs from 'node:fs';

const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
const API_KEY = 'AIzaSyBSTpQdHv0XkijnWcLN8Ys8eNusdaNbgDc';
const BASE = process.env.BASE || 'http://localhost:3000';
const WEEK_START = process.argv[2] || '2026-08-03';

let pass = 0, fail = 0;
const check = (ok: boolean, msg: string, extra = '') => {
    if (ok) { pass++; console.log(`  ✅ ${msg}`); }
    else { fail++; console.log(`  ❌ ${msg}${extra ? ' — ' + extra : ''}`); }
};
const round2 = (n: number) => Number(n.toFixed(2));

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });

const adminUser = await admin.auth().getUserByEmail('incredibowl.my@gmail.com');
const customToken = await admin.auth().createCustomToken(adminUser.uid);
const signIn = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
}).then(r => r.json());
if (!signIn.idToken) { console.error('铸 token 失败', signIn); process.exit(1); }

const res = await fetch(`${BASE}/api/admin/subscriptions/week`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signIn.idToken}` },
    body: JSON.stringify({ action: 'preview', weekStart: WEEK_START }),
});
const data = await res.json();
if (!res.ok) { console.error('preview 失败', data); process.exit(1); }
console.log(`weekStart=${WEEK_START} · ${data.previews.length} 个 active 订阅\n`);

let shortfallSeen = 0;
for (const p of data.previews) {
    const usable = p.days.filter((d: any) => !d.blocked);
    console.log(`■ ${p.name} — 需 ${p.vouchersNeeded} 份 / 有 ${p.vouchersAvailable} 券 / 用 ${p.vouchersUsed} 券`
        + (p.cashUnits > 0 ? ` · ⚠️ ${p.cashUnits} 份原价现金 RM ${p.cashUnitsAmount.toFixed(2)}` : '')
        + ` · 现金合计 RM ${p.cashTotal.toFixed(2)}`);
    for (const d of usable) {
        console.log(`    ${d.date} ${d.items.map((i: any) => `${i.name}×${i.quantity}`).join('、')}`
            + ` | ${d.vCount}券抵${d.coverage.toFixed(2)}`
            + (d.cashUnits > 0 ? ` | ${d.cashUnits}份原价${d.cashUnitsAmount.toFixed(2)}` : '')
            + (d.upgradeCoverage > 0 ? ` | 储值抵${d.upgradeCoverage.toFixed(2)}` : '')
            + ` | 现金${d.cashDue.toFixed(2)}`);
    }

    check(p.vouchersUsed === Math.min(p.vouchersAvailable, p.vouchersNeeded),
        `用券 = min(有 ${p.vouchersAvailable}, 需 ${p.vouchersNeeded})`, `实得 ${p.vouchersUsed}`);
    check(p.cashUnits === p.vouchersNeeded - p.vouchersUsed,
        `现金份 = 需 − 用券 = ${p.vouchersNeeded - p.vouchersUsed}`, `实得 ${p.cashUnits}`);
    check(usable.reduce((s: number, d: any) => s + d.vCount, 0) === p.vouchersUsed, '天级 vCount 之和 = 汇总用券数');
    check(usable.reduce((s: number, d: any) => s + d.units.length, 0) === p.vouchersNeeded, '天级份数之和 = 需券数');
    check(round2(usable.reduce((s: number, d: any) => s + d.cashUnitsAmount, 0)) === p.cashUnitsAmount, '天级现金份金额之和 = 汇总');

    const badDay = usable.find((d: any) =>
        Math.abs(d.cashDue - round2(d.originalTotal - d.coverage - d.upgradeCoverage + d.deliveryFee)) > 0.001);
    check(!badDay, 'cashDue = originalTotal − coverage − 储值抵 + 运费（逐天）',
        badDay ? `${badDay.date}: ${badDay.cashDue} ≠ ${round2(badDay.originalTotal - badDay.coverage - badDay.upgradeCoverage + badDay.deliveryFee)}` : '');

    // 每份主菜非此即彼：要么用券要么收现金，绝不漏也绝不重
    const unitSplitOk = usable.every((d: any) =>
        d.units.filter((u: any) => u.useVoucher).length === d.vCount
        && d.units.filter((u: any) => !u.useVoucher).length === d.cashUnits);
    check(unitSplitOk, '每份主菜非券即现金，不漏不重');

    // 券优先抵贵的：任一现金份的券面值 ≤ 任一用券份的券面值
    const vv = usable.flatMap((d: any) => d.units.filter((u: any) => u.useVoucher).map((u: any) => u.voucherValue));
    const cv = usable.flatMap((d: any) => d.units.filter((u: any) => !u.useVoucher).map((u: any) => u.voucherValue));
    check(vv.length === 0 || cv.length === 0 || Math.min(...vv) >= Math.max(...cv),
        '券优先抵贵的菜（现金份都是便宜的）', `用券最低 ${Math.min(...vv)} vs 现金最高 ${Math.max(...cv)}`);

    // 付现金的份不该产生 top-up 补差需求（那是白扣客户升级储值）
    const ghostTopUp = usable.find((d: any) => {
        const need = d.upgradeNeeds.filter((n: any) => n.source === 'topup')
            .reduce((s: number, n: any) => s + n.count, 0);
        const real = d.units.filter((u: any) => u.useVoucher && u.topUpAddonId && u.voucherTopUp > 0).length;
        return need !== real;
    });
    check(!ghostTopUp, 'top-up 补差只按「用券的份」登记', ghostTopUp ? ghostTopUp.date : '');

    check(!p.whatsappText.includes('剩 -'), 'WhatsApp 文案没有负数余券');

    if (p.cashUnits > 0) {
        shortfallSeen++;
        check(p.alreadyCreated || p.canConfirm === true, '券不足仍可确认建单（本次改动核心）');
        check(p.warnings.some((w: string) => w.includes('按原价现金收')), '预览有「按原价现金收」提示');
        check(p.whatsappText.includes('按原价现金结'), 'WhatsApp 文案说明了现金份');
    } else {
        check(!p.warnings.some((w: string) => w.includes('餐券不足')), '券够时不该有餐券不足警告');
    }
    console.log('');
}

console.log(shortfallSeen > 0
    ? `（真实数据里有 ${shortfallSeen} 个客户券不足，走了新路径）`
    : '（真实数据里所有客户券都够 —— 券不足路径由 dogfood-subscription-voucher-shortfall.mts 覆盖）');
console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} 过 / ${fail} 挂`);
process.exit(fail === 0 ? 0 : 1);
