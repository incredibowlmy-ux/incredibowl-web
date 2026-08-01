/**
 * Dogfood：FIRST5 首单码的真实判定
 *
 * 用**真的 validateVoucher**（不复刻逻辑）打**真的生产 Firestore**，
 * 确认老板 2026-08-02 手动建的 vouchers/FIRST5 在四种客户身上分别怎么判。
 *
 * 全程只读：validateVoucher 不写库（核销在 confirm-order 的 claim 里，
 * 这里碰不到）。
 *
 * 跑法：node --import ./scripts/_register-alias.mjs scripts/dogfood-first-order-promo.mts
 */

import admin from 'firebase-admin';
import fs from 'node:fs';
import { validateVoucher } from '@/lib/voucherValidation';

const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
const CODE = 'FIRST5';
// 28 位仿真 uid，故意查不到 users 文档。⚠️ 不能用 __xx__ 形式：Firestore
// 保留双下划线包裹的 doc id，getAll 会直接 INVALID_ARGUMENT 抛错。
const FAKE_NEW_UID = 'dogfoodNeverExists000000000z';

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf8'))) });
const db = admin.firestore();

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = '') {
    if (cond) { pass++; console.log(`  ✅ ${name}`); }
    else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
}

const run = async () => {
    // ── ① 全新客户（users 文档不存在，模拟刚建的匿名访客 uid）────────
    console.log('\n① 全新客户 / 匿名访客（users 文档不存在，totalOrders 视为 0）');
    const fresh = await validateVoucher(db, CODE, { userId: FAKE_NEW_UID });
    check('放行', fresh.ok, JSON.stringify(fresh));
    check('折扣 = RM 5', fresh.ok && fresh.discount === 5, fresh.ok ? `实际 ${fresh.discount}` : '');
    check('上限 50', fresh.ok && fresh.maxUses === 50, fresh.ok ? `实际 ${fresh.maxUses}` : '');

    // ── ② 真实老客户（从生产库挑一个 totalOrders 最多的）─────────────
    const vets = await db.collection('users')
        .where('totalOrders', '>', 0)
        .orderBy('totalOrders', 'desc')
        .limit(1).get();
    if (vets.empty) {
        console.log('\n② ⚠️  库里找不到 totalOrders > 0 的用户，跳过（这本身很可疑）');
        fail++;
    } else {
        const vet = vets.docs[0];
        const n = vet.data().totalOrders;
        console.log(`\n② 真实老客户（uid ${vet.id.slice(0, 8)}…，totalOrders=${n}）`);
        const r = await validateVoucher(db, CODE, { userId: vet.id });
        check('被拒', !r.ok, JSON.stringify(r));
        check('理由是「只限首次下单」', !r.ok && r.error.includes('只限首次下单'), !r.ok ? r.error : '');
    }

    // ── ③ 匿名预检（不带 userId，购物车未登录时的 /api/check-voucher）──
    console.log('\n③ 匿名预检（不传 userId — 按设计跳过所有 per-user 判定）');
    const anon = await validateVoucher(db, CODE, {});
    check('放行（预检只看码本身存不存在/过没过期/额度）', anon.ok, JSON.stringify(anon));

    // ── ④ 对照组：BOWL5 没有 firstOrderOnly，老客户应该照样能用 ──────
    if (!vets.empty) {
        console.log('\n④ 对照组 BOWL5（无 firstOrderOnly）— 同一个老客户');
        const r = await validateVoucher(db, 'BOWL5', { userId: vets.docs[0].id });
        const blockedByFirstOrder = !r.ok && r.error.includes('只限首次下单');
        check('不是被「只限首单」拦的（证明 ④ 的差异确实来自新字段）',
            !blockedByFirstOrder, !r.ok ? r.error : 'ok');
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  通过 ${pass} / ${pass + fail}  ${fail === 0 ? '✅ 全过' : '❌ 有失败'}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    if (fail > 0) process.exitCode = 1;
};

run()
    .catch((e) => { console.error('✗ 失败:', e); process.exitCode = 1; })
    .finally(() => admin.app().delete());
