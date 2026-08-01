// 给老板手动建的 vouchers/FIRST5 补上 firstOrderOnly:true。
//
// 背景：2026-08-02 老板在 Firestore Console 手动建了 FIRST5（discount 5 /
// maxUses 50 / expiresAt 11-02，全部正确），唯独漏了 firstOrderOnly。缺了它
// 老客户也能领这个「首单」码 —— 而首单码的全部意义就是拉新客。
//
// 为什么不用 seed-first-order-promo.mjs：那个脚本检测到文档已存在就直接返回，
// 故意不覆盖（防止把 usedCount 清零、把已发出去的码改掉）。这里要的是「只补
// 一个缺失字段，其余一律不碰」，是另一件事。
//
// 安全约束：
//   · 只写 firstOrderOnly（和顺手补齐其他 108 个文档都有的 code 元数据字段）
//   · discount / maxUses / expiresAt / usedCount / isUsed 一律不碰
//   · usedCount > 0 直接拒绝执行 —— 码一旦流通出去就不能再改规则，
//     否则已经拿到码的客户结账时会突然被拒，这种事必须人工决定
//
// ⚠️ 写生产 Firestore，默认 dry-run。
//
// Usage:
//   node scripts/patch-first5-first-order-only.mjs            # 只看要改什么
//   node scripts/patch-first5-first-order-only.mjs --apply    # 真写
import admin from 'firebase-admin';
import fs from 'node:fs';

const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
const APPLY = process.argv.includes('--apply');
const CODE = 'FIRST5';

if (!fs.existsSync(KEY)) {
    console.error(`✗ 找不到 service account key: ${KEY}`);
    process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf8'))) });
const db = admin.firestore();

const run = async () => {
    const ref = db.collection('vouchers').doc(CODE);
    const snap = await ref.get();

    console.log(`\n目标：vouchers/${CODE}`);
    console.log(`模式：${APPLY ? '✍️  APPLY（真写）' : '👀 DRY RUN（不写）'}\n`);

    if (!snap.exists) {
        console.error(`✗ vouchers/${CODE} 不存在。先建文档，或跑 seed-first-order-promo.mjs --apply。\n`);
        process.exitCode = 1;
        return;
    }

    const cur = snap.data() || {};
    const used = typeof cur.usedCount === 'number' ? cur.usedCount : (cur.isUsed ? 1 : 0);

    if (used > 0) {
        console.error(`✗ 这个码已经被用过 ${used} 次 —— 拒绝改规则。`);
        console.error(`  已经拿到码的客户会在结账时突然被拒（「此优惠码只限首次下单使用」）。`);
        console.error(`  确实要改请人工在 Console 操作，并想好怎么跟已领取的客户交代。\n`);
        process.exitCode = 1;
        return;
    }

    const patch = {};
    if (cur.firstOrderOnly !== true) patch.firstOrderOnly = true;
    if (typeof cur.code !== 'string' || !cur.code) patch.code = CODE;  // 其余 108 个文档都有，纯元数据

    if (!Object.keys(patch).length) {
        console.log('✅ 已经是正确状态，无需改动。\n');
        return;
    }

    console.log('将补上（其余字段一律不碰）：');
    for (const [k, v] of Object.entries(patch)) {
        console.log(`   ${k}: ${JSON.stringify(cur[k])} → ${JSON.stringify(v)}`);
    }
    console.log('\n保持不变：');
    for (const k of ['discount', 'maxUses', 'usedCount', 'isUsed', 'expiresAt']) {
        console.log(`   ${k} = ${k === 'expiresAt' && cur[k]?.toDate
            ? cur[k].toDate().toLocaleString('sv-SE', { timeZone: 'Asia/Kuala_Lumpur' }).slice(0, 16) + ' MYT'
            : JSON.stringify(cur[k])}`);
    }

    if (!APPLY) {
        console.log('\n👀 dry run 结束，什么都没写。确认无误后加 --apply 再跑一次。\n');
        return;
    }

    await ref.set(patch, { merge: true });

    const after = (await ref.get()).data() || {};
    console.log(`\n✅ 已写入。回读校验：firstOrderOnly = ${JSON.stringify(after.firstOrderOnly)} (${typeof after.firstOrderOnly})`);
    console.log(`   discount=${after.discount} maxUses=${after.maxUses} usedCount=${after.usedCount}（确认没被动过）\n`);
};

run()
    .catch((e) => { console.error('✗ 失败:', e); process.exitCode = 1; })
    // gRPC 连接不关会吊住进程（既有教训：别用 process.exit，会截断写入）
    .finally(() => admin.app().delete());
