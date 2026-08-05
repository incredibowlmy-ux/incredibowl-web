/**
 * Dogfood: cancelOrderWithRollback —— 真实 Firestore 往返测试。
 *
 * 跑法：node --import ./scripts/_register-alias.mjs scripts/dogfood-order-rollback.mts
 *
 * ⚠️ 会在生产 orders 集合建**临时测试单**（打 __dogfood 标记），并像真下单一样
 * 扣掉 dishStock + ingredientStock，跑完取消回补，最后删掉测试单。
 * 每个用例结束都断言库存回到基线 —— **净影响必须为零**，否则脚本报错。
 * finally 里有兜底清理，中途挂了也不会留垃圾单。
 *
 * 重点验证的是幂等：releaseDishStock 用 increment(+qty)，同一单取消两次
 * 会把库存加两遍 → 超卖。事务守卫必须挡住第二次。
 */
import admin from 'firebase-admin';
import fs from 'node:fs';

const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();

const { cancelOrderWithRollback } = await import('../src/lib/orderRollback.ts');
const { consumeDishStock } = await import('../src/lib/stockUtils.ts');
const { consumeIngredientStock } = await import('../src/lib/ingredientStock.ts');

// 用一道**本来不限量**（没有 dishStock 文档）的在售菜，脚本开头临时给它建一个
// 库存文档、跑完删掉。
// 为什么不用真有文档的那几道：它们的 remaining 是真实销售数字，卖完就是 0，
// consumeDishStock 会直接以「已售罄」拒收（2026-08-05 实测挂在这），而临时抬高
// 它们的库存等于在营业中放开超卖闸门。临时给不限量的菜建文档则零风险 ——
// 测试期间它变成限量 100，跑完文档删除，恢复原样。
const DISH_ID = 23;
const DISH_NAME = '家乡豆酱焖花肉';
const TEST_STOCK = 100;
const ING_PROBE = ['五花肉', '白饭']; // 抽查几个原料，名字对不上会显示 (无文档)

let pass = 0, fail = 0;
const created: string[] = [];
/** 这个 dishStock 文档是本脚本建的吗？是的话 finally 要删掉。 */
let stockDocWasCreated = false;
const t = (label: string, cond: boolean, detail = '') => {
    cond ? pass++ : fail++;
    console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? `  ${detail}` : ''}`);
};

const dishRemaining = async () =>
    Number((await db.collection('dishStock').doc(String(DISH_ID)).get()).data()?.remaining ?? NaN);

const ingSnapshot = async () => {
    const out: Record<string, number | null> = {};
    for (const n of ING_PROBE) {
        const d = await db.collection('ingredientStock').doc(n.replace(/\//g, '__')).get();
        out[n] = d.exists ? Number(d.data()?.onHand ?? 0) : null;
    }
    return out;
};

/** 建一张跟真网页单同构的测试单，并像 submit-order 一样扣两层库存。 */
async function makeOrder(opts: { qty: number; createdAtMs: number; consume: boolean }) {
    const items = [{ name: DISH_NAME, quantity: opts.qty, price: 21.9 }];
    const ref = await db.collection('orders').add({
        __dogfood: true,
        userId: 'dogfood-rollback-test',
        userName: '【测试】回补 dogfood',
        userPhone: '60100000000',
        items,
        total: 21.9 * opts.qty,
        deliveryFee: 0,
        status: 'pending',
        paymentMethod: 'fpx',
        deliveryDate: '2099-01-01',
        deliveryTime: 'Lunch (11AM-1PM)',
        createdAt: admin.firestore.Timestamp.fromMillis(opts.createdAtMs),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    created.push(ref.id);
    if (opts.consume) {
        await consumeDishStock(db, [{ dishId: DISH_ID, qty: opts.qty, name: DISH_NAME }]);
        await consumeIngredientStock(db, items, { orderId: ref.id, source: 'dogfood' });
    }
    return ref.id;
}

try {
    // 临时给这道不限量的菜建库存文档（跑完在 finally 删除，恢复不限量）
    const stockRef = db.collection('dishStock').doc(String(DISH_ID));
    if (!(await stockRef.get()).exists) {
        await stockRef.set({ dishName: DISH_NAME, remaining: TEST_STOCK, __dogfood: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        stockDocWasCreated = true;
        console.log(`（临时给「${DISH_NAME}」建了 dishStock=${TEST_STOCK}，跑完删除）`);
    } else {
        console.log(`⚠️ 「${DISH_NAME}」已有 dishStock 文档，本脚本不会删它，只在其基线上加减`);
    }
    const baseDish = await dishRemaining();
    const baseIng = await ingSnapshot();
    console.log(`\n基线：${DISH_NAME} dishStock=${baseDish}`);
    console.log(`      原料 ${Object.entries(baseIng).map(([k, v]) => `${k}=${v ?? '(无文档)'}`).join('  ')}\n`);
    if (!Number.isFinite(baseDish)) throw new Error(`dishStock/${DISH_ID} 不存在，换一道有限量文档的菜再测`);

    // ── 用例 1：正常取消 → 两层库存都回到基线 ────────────────
    console.log('① 正常取消一单（2 份），两层库存应回到基线');
    const id1 = await makeOrder({ qty: 2, createdAtMs: Date.now(), consume: true });
    const afterConsume = await dishRemaining();
    t('下单后 dishStock 少 2', afterConsume === baseDish - 2, `${baseDish} → ${afterConsume}`);

    const r1 = await cancelOrderWithRollback(db, id1, { reason: 'dogfood-1' });
    t('返回 cancelled=true', r1.cancelled === true);
    t('报告归还 2 份菜', r1.released.dishStock === 2, `实际 ${r1.released.dishStock}`);
    t('报告跑了原料回补', r1.released.ingredientStock === true);
    t('无失败项', r1.failures.length === 0, r1.failures.join(',') || '');
    const afterCancel = await dishRemaining();
    t('dishStock 回到基线', afterCancel === baseDish, `${afterConsume} → ${afterCancel}（基线 ${baseDish}）`);
    const ing1 = await ingSnapshot();
    t('原料回到基线', JSON.stringify(ing1) === JSON.stringify(baseIng),
        Object.entries(ing1).map(([k, v]) => `${k}=${v ?? '-'}`).join(' '));
    const doc1 = (await db.collection('orders').doc(id1).get()).data()!;
    t('订单状态已 cancelled', doc1.status === 'cancelled');
    t('写了 cancelReason', doc1.cancelReason === 'dogfood-1', String(doc1.cancelReason));
    t('打了 rollbackAt 幂等标记', !!doc1.rollbackAt);

    // ── 用例 2：重复取消（本次修复的核心风险）────────────────
    console.log('\n② 同一单再取消两次 —— 库存绝不能被加两遍（超卖风险）');
    const r2 = await cancelOrderWithRollback(db, id1, { reason: 'dogfood-dup' });
    t('第二次返回 cancelled=false（no-op）', r2.cancelled === false);
    t('第二次没归还任何菜', r2.released.dishStock === 0);
    const r3 = await cancelOrderWithRollback(db, id1, { reason: 'dogfood-dup-2' });
    t('第三次同样 no-op', r3.cancelled === false);
    const afterDup = await dishRemaining();
    t('dishStock 仍等于基线（没被加两遍）', afterDup === baseDish, `${afterDup}（基线 ${baseDish}）`);
    const ing2 = await ingSnapshot();
    t('原料仍等于基线', JSON.stringify(ing2) === JSON.stringify(baseIng));
    const doc2 = (await db.collection('orders').doc(id1).get()).data()!;
    t('cancelReason 没被后来的调用覆盖', doc2.cancelReason === 'dogfood-1', String(doc2.cancelReason));

    // ── 用例 3：并发取消（CartDrawer + page.tsx 同时开火）──────
    console.log('\n③ 并发取消同一单 —— 只能有一个赢家');
    const id3 = await makeOrder({ qty: 1, createdAtMs: Date.now(), consume: true });
    const beforeRace = await dishRemaining();
    const results = await Promise.all([
        cancelOrderWithRollback(db, id3, { reason: 'race-a' }),
        cancelOrderWithRollback(db, id3, { reason: 'race-b' }),
        cancelOrderWithRollback(db, id3, { reason: 'race-c' }),
    ]);
    const winners = results.filter(r => r.cancelled).length;
    t('恰好 1 个赢家', winners === 1, `实际 ${winners}`);
    const afterRace = await dishRemaining();
    t('dishStock 只 +1', afterRace === beforeRace + 1, `${beforeRace} → ${afterRace}`);
    t('回到基线', afterRace === baseDish, `${afterRace}（基线 ${baseDish}）`);

    // ── 用例 4：库存纪元之前的老单不回补（防凭空印库存）────────
    console.log('\n④ 2026-06-29 之前的老单：当初没扣过，不能回补');
    const oldMs = Date.parse('2026-05-01T00:00:00Z');
    const id4 = await makeOrder({ qty: 3, createdAtMs: oldMs, consume: false }); // 不扣，模拟老单
    const beforeOld = await dishRemaining();
    const r4 = await cancelOrderWithRollback(db, id4, { reason: 'dogfood-old-era' });
    t('单本身取消成功', r4.cancelled === true);
    t('没归还菜（纪元前）', r4.released.dishStock === 0, `实际 ${r4.released.dishStock}`);
    t('没跑原料回补', r4.released.ingredientStock === false);
    const afterOld = await dishRemaining();
    t('dishStock 纹丝不动', afterOld === beforeOld, `${beforeOld} → ${afterOld}`);

    // ── 用例 5：不存在的订单 ─────────────────────────────────
    console.log('\n⑤ 订单不存在时安全返回，不抛错');
    const r5 = await cancelOrderWithRollback(db, 'this-order-does-not-exist-xyz', { reason: 'dogfood-404' });
    t('返回 cancelled=false 而不是抛错', r5.cancelled === false);

    // ── 用例 6：按 stockDeducted 实扣量回补，而不是按 items 的 qty ──
    // 2026-08-04 E1：lenient 扣减在库存见底时 clamp 到 0，实扣 < qty；旧代码
    // 按 items 全额退 → 凭空印货（超卖）。这里造一张「items 写 3 份、实际只
    // 扣了 1 份」的单，回补必须只退 1。
    console.log('\n⑥ 回补按实扣量（stockDeducted）而非 items 的 qty —— 防凭空印货');
    const base6 = await dishRemaining();
    // 建单时不扣、createdAt 放在纪元前且不写 stockDeductedIngredients —— 这样
    // 食材层会正确跳过（否则回补食材会让最终对账的净影响不为 0），本用例就
    // 纯粹只考察 dishStock 那条路。顺带验证一个设计意图：**有 stockDeducted
    // 就不看纪元**（菜退了），而食材层仍按自己的标记/纪元判断（跳过）。
    const id6 = await makeOrder({ qty: 3, createdAtMs: Date.parse('2026-05-01T00:00:00Z'), consume: false });
    await db.collection('orders').doc(id6).update({ stockDeducted: { [String(DISH_ID)]: 1 } });
    const r6 = await cancelOrderWithRollback(db, id6, { reason: 'dogfood-6' });
    const after6 = await dishRemaining();
    t('只退 1 份（不是 items 的 3 份）', r6.released.dishStock === 1, `报告退了 ${r6.released.dishStock}`);
    t('dishStock 只 +1', after6 === base6 + 1, `${base6} → ${after6}`);
    t('有 stockDeducted 时不受纪元闸限制', r6.released.dishStock > 0);
    t('食材层仍按自己的标记判断 → 跳过', r6.released.ingredientStock === false);
    await db.collection('dishStock').doc(String(DISH_ID)).update({ remaining: base6 });  // 复位

    // ── 用例 7：回补跑到一半进程死掉 → 重试必须**续跑**，不是 no-op 后照删 ──
    // 2026-08-04 P1：rollbackAt 是「开始回补」标记而非「完成」标记。旧代码
    // 见到它就 return，剩下的券和库存永远回不来还报告成功。
    console.log('\n⑦ 半途中断的回补，重试要续补未完成项（P1 核心）');
    const base7 = await dishRemaining();
    const id7 = await makeOrder({ qty: 2, createdAtMs: Date.now(), consume: true });
    const afterConsume7 = await dishRemaining();
    // 假装：事务已翻 cancelled + 打了 rollbackAt，食材补完了，菜品还没补就崩了
    await db.collection('orders').doc(id7).update({
        status: 'cancelled',
        cancelReason: 'dogfood-7-crashed',
        rollbackAt: admin.firestore.FieldValue.serverTimestamp(),
        rollbackProgress: { ingredientStock: true },
    });
    const r7 = await cancelOrderWithRollback(db, id7, { reason: 'dogfood-7-retry', allowNonPending: true });
    const after7 = await dishRemaining();
    t('续跑而不是 no-op（cancelled=true）', r7.cancelled === true);
    t('补上了没补的 2 份菜', r7.released.dishStock === 2, `实际 ${r7.released.dishStock}`);
    t('dishStock 回到基线', after7 === base7, `${afterConsume7} → ${after7}（基线 ${base7}）`);
    const doc7 = (await db.collection('orders').doc(id7).get()).data()!;
    t('封口写了 rollbackDoneAt', !!doc7.rollbackDoneAt);
    t('原 cancelReason 未被重试覆盖', doc7.cancelReason === 'dogfood-7-crashed', String(doc7.cancelReason));
    const r7b = await cancelOrderWithRollback(db, id7, { reason: 'dogfood-7-again', allowNonPending: true });
    t('封口后再调是 no-op', r7b.cancelled === false && r7b.released.dishStock === 0);
    t('dishStock 没被加第三遍', (await dishRemaining()) === base7);
    // 食材：用例里跳过了回补（progress 说已补），手动补平
    await (await import('../src/lib/ingredientStock.ts')).releaseIngredientStock(
        db, [{ name: DISH_NAME, quantity: 2 }] as any, { orderId: id7, source: 'dogfood-7 补平' });

    // ── 用例 8：已 cancelled 但从没回补过的历史单（07-26 统一之前）──
    // 2026-08-04 P3：旧代码把 status==='cancelled' 当「已回补」，这类单会被
    // 静默跳过；资源永远吞掉。现在要拦下并给原因，显式放行才补。
    console.log('\n⑧ 历史 cancelled 单（无 rollbackAt）要拦下，显式放行才回补');
    const base8 = await dishRemaining();
    const id8 = await makeOrder({ qty: 1, createdAtMs: Date.now(), consume: true });
    await db.collection('orders').doc(id8).update({ status: 'cancelled', cancelReason: '07-26前的老取消' });
    const r8 = await cancelOrderWithRollback(db, id8, { reason: 'dogfood-8', allowNonPending: true });
    t('默认被拦下（cancelled=false）', r8.cancelled === false);
    t('给出了原因', !!r8.blockedReason, r8.blockedReason || '(无)');
    t('没有偷偷回补', (await dishRemaining()) === base8 - 1);
    const r8b = await cancelOrderWithRollback(db, id8, { reason: 'dogfood-8-legacy', allowNonPending: true, allowLegacyCancelled: true });
    t('显式放行后正常回补', r8b.cancelled === true && r8b.released.dishStock === 1);
    t('dishStock 回到基线', (await dishRemaining()) === base8);

    // ── 最终对账 ────────────────────────────────────────────
    console.log('\n⑥ 最终对账：全部用例跑完，库存必须精确回到基线');
    const finalDish = await dishRemaining();
    const finalIng = await ingSnapshot();
    t('dishStock 净影响为 0', finalDish === baseDish, `${baseDish} → ${finalDish}`);
    t('ingredientStock 净影响为 0', JSON.stringify(finalIng) === JSON.stringify(baseIng));
} finally {
    // 兜底清理：无论成功失败都删掉测试单
    console.log('\n清理测试单…');
    for (const id of created) {
        try { await db.collection('orders').doc(id).delete(); console.log(`  已删 ${id}`); }
        catch (e) { console.error(`  ⚠️ 删除 ${id} 失败，请手动删：`, e); }
    }
    const leftovers = await db.collection('orders').where('__dogfood', '==', true).get();
    console.log(leftovers.empty ? '  ✅ 无残留测试单' : `  ⚠️ 仍有 ${leftovers.size} 笔残留：${leftovers.docs.map(d => d.id).join(', ')}`);
    // 删掉临时库存文档 → 这道菜恢复「不限量」，绝不能留在库里当成真实限量
    if (stockDocWasCreated) {
        try {
            await db.collection('dishStock').doc(String(DISH_ID)).delete();
            console.log(`  ✅ 已删除临时 dishStock 文档（「${DISH_NAME}」恢复不限量）`);
        } catch (e) {
            console.error(`  ⚠️ 临时 dishStock 文档删除失败，请手动删 dishStock/${DISH_ID}：`, e);
        }
    }
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败\n`);
await admin.app().delete();
process.exit(fail === 0 ? 0 : 1);
