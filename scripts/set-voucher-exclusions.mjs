// 给优惠码写「互斥码组」字段 excludeIfUsed —— 挡住同一个客人把几个新客码轮流用一遍。
//
// 背景：`vouchers` 集合里「每个码每人只能用一次」早就有了（users/{uid}.vouchersUsed
// + phoneNormalized 跨账号去重）。但**码与码之间**没有任何关系：一个已经用过
// BOWL5 的老客，照样能领 DAD5 再减 RM 5。老板 2026-08-11 定的规则：
//
//     用过 BOWL5 或 FIRST5 的账号 → DAD5 不生效。
//
// 规则存在**码自己的文档**上，不写死在代码里：validateVoucher 本来就要读这个
// 文档，判定零额外查询；以后加新的互斥关系改这张表跑一次即可，不用发版。
//
// 判定实现：src/lib/voucherValidation.ts —— `excludeIfUsed` 里任何一个码出现在
// users/{uid}.vouchersUsed（或同手机号的另一个账号的 vouchersUsed）里就拒。
// ⚠️ 未登录预检（不传 userId）不做 per-user 判定，这条规则跟 firstOrderOnly 一样
//    在那条路径上整块跳过 —— 结账时会再校验一次，钱不会算错。
//
// ⚠️ 写生产 Firestore，默认 dry-run。确认后再加 --apply。
//
// Usage:
//   node scripts/set-voucher-exclusions.mjs            # dry run，只打印将写什么
//   node scripts/set-voucher-exclusions.mjs --apply    # 真写
import admin from 'firebase-admin';
import fs from 'node:fs';

const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
const APPLY = process.argv.includes('--apply');

// 互斥表：{ 码: [用过这些码就不能用它] }。全部大写，与 doc id 一致。
const EXCLUSIONS = {
    DAD5: ['BOWL5', 'FIRST5'],
};

if (!fs.existsSync(KEY)) {
    console.error(`✗ 找不到 service account key: ${KEY}`);
    process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf8'))) });
const db = admin.firestore();

const run = async () => {
    console.log(`\n模式：${APPLY ? '✍️  APPLY（真写）' : '👀 DRY RUN（不写）'}\n`);

    for (const [code, excludes] of Object.entries(EXCLUSIONS)) {
        const ref = db.collection('vouchers').doc(code);
        const snap = await ref.get();

        if (!snap.exists) {
            console.log(`✗ vouchers/${code} 不存在，跳过（互斥字段没有落脚点）\n`);
            continue;
        }

        const cur = snap.data() || {};
        const before = Array.isArray(cur.excludeIfUsed) ? cur.excludeIfUsed : null;
        console.log(`${code}：`);
        console.log(`   现值 excludeIfUsed = ${JSON.stringify(cur.excludeIfUsed)} (${cur.excludeIfUsed === undefined ? 'missing' : typeof cur.excludeIfUsed})`);
        console.log(`   将写 excludeIfUsed = ${JSON.stringify(excludes)}`);

        // 被排斥的码本身必须存在，否则多半是拼错了 —— 拼错不会报错，只会静默失效。
        for (const ex of excludes) {
            const exSnap = await db.collection('vouchers').doc(ex).get();
            console.log(`      ${exSnap.exists ? '✓' : '❗'} 被排斥码 ${ex} ${exSnap.exists ? '存在' : '在库里不存在 —— 检查拼写，写进去也不会生效'}`);
        }

        if (before && JSON.stringify(before) === JSON.stringify(excludes)) {
            console.log('   → 已经是目标值，无需改动\n');
            continue;
        }

        if (!APPLY) {
            console.log('   → dry run，未写入\n');
            continue;
        }

        // merge 写单字段：绝不碰 usedCount / discount / maxUses / expiresAt。
        await ref.set({ excludeIfUsed: excludes }, { merge: true });
        console.log('   ✅ 已写入\n');
    }

    if (!APPLY) console.log('👀 dry run 结束，什么都没写。确认无误后加 --apply 再跑一次。\n');
};

run()
    .catch((e) => { console.error('✗ 失败:', e); process.exitCode = 1; })
    // gRPC 连接不关会吊住进程（既有教训：别用 process.exit，会截断写入）
    .finally(() => admin.app().delete());
