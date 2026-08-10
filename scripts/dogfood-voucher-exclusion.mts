/**
 * Dogfood：DAD5 的互斥码组（用过 BOWL5 / FIRST5 就不能用 DAD5）
 *
 * 用**真的 validateVoucher**（不复刻逻辑）打**真的生产 Firestore**，
 * 拿库里真实用过 BOWL5 / FIRST5 的账号验，不是造假数据。
 *
 * 全程只读：validateVoucher 不写库（核销在 confirm-order 的 claim 里）。
 *
 * 跑法：node --import ./scripts/_register-alias.mjs scripts/dogfood-voucher-exclusion.mts
 */

import admin from 'firebase-admin';
import fs from 'node:fs';
import { validateVoucher } from '@/lib/voucherValidation';

const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
const CODE = 'DAD5';
const EXCLUDED = ['BOWL5', 'FIRST5'];
// 对照码：同为公开 RM5 码，但没写 excludeIfUsed —— 用来证明差异确实来自新字段。
const CONTROL = 'FBOOK5';
// 28 位仿真 uid，故意查不到 users 文档。⚠️ 不能用 __xx__ 形式（Firestore 保留）。
const FAKE_NEW_UID = 'dogfoodNeverExists000000000z';

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf8'))) });
const db = admin.firestore();

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = '') {
    if (cond) { pass++; console.log(`  ✅ ${name}`); }
    else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
}

const run = async () => {
    // ── ⓪ 字段本身写对了没（类型错了不报错，只会静默失效）────────────
    console.log(`\n⓪ vouchers/${CODE} 的 excludeIfUsed 字段`);
    const vSnap = await db.collection('vouchers').doc(CODE).get();
    const raw = vSnap.data()?.excludeIfUsed;
    check('是数组', Array.isArray(raw), `实际 ${JSON.stringify(raw)} (${typeof raw})`);
    check(`内容 = ${JSON.stringify(EXCLUDED)}`,
        JSON.stringify(raw) === JSON.stringify(EXCLUDED), `实际 ${JSON.stringify(raw)}`);

    // ── ① 每个被排斥的码，拿一个真实用过它的账号验 ──────────────────
    for (const ex of EXCLUDED) {
        const users = await db.collection('users')
            .where('vouchersUsed', 'array-contains', ex)
            .limit(1).get();
        if (users.empty) {
            console.log(`\n① ⚠️  库里找不到用过 ${ex} 的账号，这一档无法验证`);
            fail++;
            continue;
        }
        const u = users.docs[0];
        console.log(`\n① 真实用过 ${ex} 的客户（uid ${u.id.slice(0, 8)}…，vouchersUsed=${JSON.stringify(u.data().vouchersUsed)}）`);
        const r = await validateVoucher(db, CODE, { userId: u.id });
        check(`${CODE} 被拒`, !r.ok, JSON.stringify(r));
        check('理由是「新客优惠」互斥', !r.ok && r.error.includes('新客优惠'), !r.ok ? r.error : '');

        // 对照：同一个人拿没有 excludeIfUsed 的公开码，不该被互斥理由拦。
        const c = await validateVoucher(db, CONTROL, { userId: u.id });
        check(`对照 ${CONTROL} 不被互斥理由拦（差异确实来自新字段）`,
            !(!c.ok && c.error.includes('新客优惠')), c.ok ? 'ok' : c.error);
    }

    // ── ② 全新客户（users 文档不存在）—— 必须照常能用 ────────────────
    console.log('\n② 全新客户 / 匿名访客（users 文档不存在，没有 vouchersUsed）');
    const fresh = await validateVoucher(db, CODE, { userId: FAKE_NEW_UID });
    check('放行', fresh.ok, JSON.stringify(fresh));
    check('折扣 = RM 5', fresh.ok && fresh.discount === 5, fresh.ok ? `实际 ${fresh.discount}` : '');

    // ── ③ 真实老客户，但没用过 BOWL5 / FIRST5 —— 也必须能用 ───────────
    const sample = await db.collection('users').where('totalOrders', '>', 0).limit(60).get();
    const clean = sample.docs.find((d) => {
        const used = d.data().vouchersUsed;
        const arr: string[] = Array.isArray(used) ? used : [];
        return !EXCLUDED.some((e) => arr.includes(e)) && !arr.includes(CODE);
    });
    if (!clean) {
        console.log('\n③ ⚠️  抽样 60 个老客里找不到「没用过 BOWL5/FIRST5」的，跳过');
    } else {
        console.log(`\n③ 真实老客户但没用过 BOWL5/FIRST5（uid ${clean.id.slice(0, 8)}…）`);
        const r = await validateVoucher(db, CODE, { userId: clean.id });
        // 可能被同手机号的另一个账号挡住（那是既有的正确行为），只断言「不是互斥理由」。
        check('不被互斥理由拦', !(!r.ok && r.error.includes('新客优惠')), r.ok ? 'ok' : r.error);
    }

    // ── ④ 匿名预检（不传 userId）—— 按设计跳过所有 per-user 判定 ──────
    console.log('\n④ 匿名预检（不传 userId）');
    const anon = await validateVoucher(db, CODE, {});
    check('放行（已知行为：预检只看码本身，结账时会再校验一次）', anon.ok, JSON.stringify(anon));

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  通过 ${pass} / ${pass + fail}  ${fail === 0 ? '✅ 全过' : '❌ 有失败'}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    if (fail > 0) process.exitCode = 1;
};

run()
    .catch((e) => { console.error('✗ 失败:', e); process.exitCode = 1; })
    .finally(() => admin.app().delete());
