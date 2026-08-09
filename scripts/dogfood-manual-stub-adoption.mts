/**
 * Dogfood: 卖券时接管 manual_<电话> 历史单（lib/manualStubAdoption）
 *
 * 跑法：node scripts/dogfood-manual-stub-adoption.mts
 *
 * 覆盖 2026-08-09 Yan Yuan 那次分裂的原始场景，以及电话形态变体、
 * 认错人防线、LTV 只数已付状态、幂等（第二次跑没得接管）等。
 * 纯函数直打，不碰 Firestore。
 */
import {
    manualUidCandidates,
    computeAdoptionPlan,
    type AdoptableOrder,
} from '../src/lib/manualStubAdoption.ts';

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail = '') {
    if (cond) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
}
function eq(label: string, got: unknown, want: unknown) {
    check(label, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
}

const TARGET = 'gZKCy1NpJl8XFinqOrUw';
const PHONE_RAW = '0102250779';
const PHONE_NORM = '102250779';

console.log('\n=== 1. uid 候选覆盖电话的各种写法 ===');
const cands = manualUidCandidates(PHONE_RAW, PHONE_NORM);
check('含 manual_0102250779（manualOrderCore 兜底写法）', cands.includes('manual_0102250779'));
check('含 manual_102250779（归一后写法）', cands.includes('manual_102250779'));
check('含 manual_60102250779（+60 写法）', cands.includes('manual_60102250779'));
eq('去重后 3 个候选', cands.length, 3);
// 原始输入写成 +60 也好、带空格横杠也好，候选集合必须与上面那批完全一致 ——
// 否则同一个人换个录入写法就又漏接管一次。
eq('带 +60/空格的原始输入 → 同一批候选', manualUidCandidates('+60 10-225 0779', PHONE_NORM).sort(), [...cands].sort());

console.log('\n=== 2. Yan Yuan 原始场景：5 单 delivered，运费 0 ===');
const yanYuan: AdoptableOrder[] = [
    { id: 'o1', userId: 'manual_0102250779', userPhone: PHONE_RAW, status: 'delivered', total: 40.5, deliveryFee: 0, deliveryDate: '2026-06-15' },
    { id: 'o2', userId: 'manual_0102250779', userPhone: PHONE_RAW, status: 'delivered', total: 40.5, deliveryFee: 0, deliveryDate: '2026-06-16' },
    { id: 'o3', userId: 'manual_0102250779', userPhone: PHONE_RAW, status: 'delivered', total: 43.3, deliveryFee: 0, deliveryDate: '2026-06-17' },
    { id: 'o4', userId: 'manual_0102250779', userPhone: PHONE_RAW, status: 'delivered', total: 43.3, deliveryFee: 0, deliveryDate: '2026-06-18' },
    { id: 'o5', userId: 'manual_0102250779', userPhone: PHONE_RAW, status: 'delivered', total: 43.3, deliveryFee: 0, deliveryDate: '2026-06-19' },
];
const p1 = computeAdoptionPlan(yanYuan, { targetUserId: TARGET, phoneNormalized: PHONE_NORM });
eq('5 单全接管', p1.orders.length, 5);
eq('LTV 单数 5', p1.ltvOrderCount, 5);
eq('LTV 金额 210.90（与实际归并结果一致）', p1.ltvSpentAdded, 210.9);
eq('零跳过', p1.skipped.length, 0);

console.log('\n=== 3. LTV 只数已付状态，但单照样接管 ===');
const mixed: AdoptableOrder[] = [
    { id: 'c1', userId: 'manual_0102250779', status: 'cancelled', total: 50, deliveryFee: 3 },
    { id: 'p1', userId: 'manual_0102250779', status: 'pending', total: 50, deliveryFee: 3 },
    { id: 'd1', userId: 'manual_0102250779', status: 'delivering', total: 20, deliveryFee: 3 },
    { id: 'k1', userId: 'manual_0102250779', status: 'confirmed', total: 10, deliveryFee: 0 },
];
const p2 = computeAdoptionPlan(mixed, { targetUserId: TARGET, phoneNormalized: PHONE_NORM });
eq('4 单都改归属（历史完整性）', p2.orders.length, 4);
eq('只有 delivering + confirmed 计 LTV', p2.ltvOrderCount, 2);
eq('金额 = 23 + 10', p2.ltvSpentAdded, 33);
check('cancelled 单标记为不计 LTV', p2.orders.find(o => o.id === 'c1')?.countsForLtv === false);

console.log('\n=== 4. 认错人防线 ===');
const wrong: AdoptableOrder[] = [
    { id: 'w1', userId: 'manual_0102250779', userPhone: '0123456789', status: 'delivered', total: 99 },
    { id: 'ok', userId: 'manual_0102250779', status: 'delivered', total: 20 }, // 早期单没写 userPhone → 信 uid
    { id: 'real', userId: 'someRealUid', status: 'delivered', total: 30 },
    { id: 'self', userId: TARGET, status: 'delivered', total: 30 },
];
const p3 = computeAdoptionPlan(wrong, { targetUserId: TARGET, phoneNormalized: PHONE_NORM });
eq('只接管 1 单', p3.orders.map(o => o.id), ['ok']);
eq('3 单被跳过', p3.skipped.length, 3);
check('电话不符的单给出原因', /不符/.test(p3.skipped.find(s => s.id === 'w1')?.reason || ''));
check('非 manual_ 单不动', /不是 manual_/.test(p3.skipped.find(s => s.id === 'real')?.reason || ''));
check('已在目标 uid 下的单不重复计', /已经在目标/.test(p3.skipped.find(s => s.id === 'self')?.reason || ''));

// 目标账号本身就是 manual_<电话>（纯 WhatsApp 老客一直没注册）：自己的单别自己接管自己
const selfTarget = computeAdoptionPlan(
    [{ id: 's1', userId: 'manual_0102250779', userPhone: PHONE_RAW, status: 'delivered', total: 40 }],
    { targetUserId: 'manual_0102250779', phoneNormalized: PHONE_NORM },
);
eq('目标就是 manual_ 档时零接管', [selfTarget.orders.length, selfTarget.ltvSpentAdded], [0, 0]);
check('理由说得准', /已经在目标/.test(selfTarget.skipped[0]?.reason || ''));

console.log('\n=== 5. 幂等：接管过一轮后再跑 ===');
// 真实世界里第二次跑时，这些单的 userId 已经是 TARGET，压根查不出来；
// 就算硬塞进来也必须零接管、零 LTV。
const afterFirstRun: AdoptableOrder[] = yanYuan.map(o => ({ ...o, userId: TARGET, userIdMergedFrom: 'manual_0102250779' }));
const p4 = computeAdoptionPlan(afterFirstRun, { targetUserId: TARGET, phoneNormalized: PHONE_NORM });
eq('零接管', p4.orders.length, 0);
eq('LTV 不再加', p4.ltvSpentAdded, 0);

console.log('\n=== 6. 空/边界 ===');
const p5 = computeAdoptionPlan([], { targetUserId: TARGET, phoneNormalized: PHONE_NORM });
eq('没有历史单 → 空计划', [p5.orders.length, p5.ltvOrderCount, p5.ltvSpentAdded], [0, 0, 0]);
const p6 = computeAdoptionPlan(
    [{ id: 'nf', userId: 'manual_0102250779', status: 'delivered', total: 19.9, deliveryFee: 3.35 }],
    { targetUserId: TARGET, phoneNormalized: PHONE_NORM },
);
eq('浮点尘埃收到分', p6.ltvSpentAdded, 23.25);
const p7 = computeAdoptionPlan(
    [{ id: 'nt', userId: 'manual_0102250779', status: 'delivered' }],
    { targetUserId: TARGET, phoneNormalized: PHONE_NORM },
);
eq('缺 total/deliveryFee 当 0 不炸', p7.ltvSpentAdded, 0);

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} 过 / ${fail} 挂\n`);
process.exit(fail === 0 ? 0 : 1);
