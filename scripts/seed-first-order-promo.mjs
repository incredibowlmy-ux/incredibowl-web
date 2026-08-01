// 建立「首单立减 RM 5」的公开优惠码 —— 网站自助领取用（不再强制走 WhatsApp）。
//
// 背景：改版前「首单立减 RM 5」只写在退出弹窗和底部条的 WhatsApp 话术里，
// 新客必须离开网站私聊碗妈、等人工发码。现在首页可以一键领取，码存进
// localStorage，打开购物车自动填入并自动套用。这个脚本负责把码本身建进
// Firestore —— 没有它，前端一切照常但套用时会回「优惠码无效」。
//
// 码的语义（全部由服务端 src/lib/voucherValidation.ts 执行）：
//   discount        5        减 RM 5（服务端权威，客户端只显示）
//   maxUses         2000     全局总次数上限，防失控
//   firstOrderOnly  true     users.totalOrders > 0 的老客直接拒（新加的判定）
//   expiresAt       null     不设到期；要停就把 maxUses 改成 usedCount
//
// 每人一次由既有逻辑保证，不需要额外字段：
//   ① users/{uid}.vouchersUsed 含此码 → 拒
//   ② 同一个 phoneNormalized 的另一个账号用过 → 拒（挡住匿名访客换 uid 重刷）
//
// ⚠️ 这是写生产 Firestore 的操作，默认 dry-run。老板确认后再加 --apply。
//
// Usage:
//   node scripts/seed-first-order-promo.mjs            # dry run，只打印将写入什么
//   node scripts/seed-first-order-promo.mjs --apply    # 真写
import admin from 'firebase-admin';
import fs from 'node:fs';

const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
const APPLY = process.argv.includes('--apply');

// ⚠️ 必须与 src/lib/firstOrderPromo.ts 的 FIRST_ORDER_PROMO_CODE 完全一致。
const CODE = 'FIRST5';
const DISCOUNT_RM = 5;
// 50 = 与既有全部公开码一致（BOWL5 / FBOOK5 / INSTA5 / OUG5… 都是 50）。
// 最大敞口 RM 250。BOWL5 实际跑到 17/50、JUNBOWL5 到 16/50，说明 50 对
// 现在的流量是够用的量级。用满了在 Console 调大即可，比一开始就开 2000
// 安全 —— 首单码天然可以被换手机号重复领，上限是唯一的硬止损。
const MAX_USES = 50;

const payload = {
    discount: DISCOUNT_RM,
    maxUses: MAX_USES,
    usedCount: 0,
    isUsed: false,
    firstOrderOnly: true,
    // 审计用，validateVoucher 不读
    label: '首单立减 RM5（网站自助领取）',
    createdBy: 'seed-first-order-promo.mjs',
};

if (!fs.existsSync(KEY)) {
    console.error(`✗ 找不到 service account key: ${KEY}`);
    process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf8'))) });
const db = admin.firestore();

const run = async () => {
    const ref = db.collection('vouchers').doc(CODE);
    const snap = await ref.get();

    console.log(`\n优惠码：${CODE}`);
    console.log(`模式：${APPLY ? '✍️  APPLY（真写）' : '👀 DRY RUN（不写）'}`);

    if (snap.exists) {
        const cur = snap.data() || {};
        console.log('\n⚠️  这个码已经存在，脚本不会覆盖它（避免把 usedCount 清零、把已发出去的码改掉）。');
        console.log('\n体检 —— 服务端 validateVoucher 实际会怎么读这个文档：\n');

        // ⚠️ 每一条都对应 src/lib/voucherValidation.ts 里的一个 typeof 判断。
        // 手动在 Console 建文档时把 number 填成 string 不会报错，只会静默
        // 走进 fallback —— discount 变 RM1、maxUses 变 1 次。所以查类型比查值重要。
        const problems = [];
        const show = (k) => `${JSON.stringify(cur[k])} (${cur[k] === undefined ? 'missing' : typeof cur[k]})`;

        console.log(`   discount        = ${show('discount')}`);
        if (typeof cur.discount !== 'number') {
            problems.push(`discount 不是 number → 服务端 fallback 到 RM 1，客户只会减 1 块（客户端仍显示 RM 5，套用时报「优惠金额不一致」直接拒单）`);
        } else if (cur.discount !== DISCOUNT_RM) {
            problems.push(`discount = ${cur.discount}，但网站文案写的是 RM ${DISCOUNT_RM} → 金额对不上会被 submit-order 拒收`);
        }

        console.log(`   maxUses         = ${show('maxUses')}`);
        if (typeof cur.maxUses !== 'number' || cur.maxUses <= 0) {
            problems.push(`maxUses 不是正 number → 服务端 fallback 到 1，全站只有第一个客户能用，之后一律「此优惠码已被使用」`);
        }

        console.log(`   usedCount       = ${show('usedCount')}`);
        if (cur.usedCount !== undefined && typeof cur.usedCount !== 'number') {
            problems.push(`usedCount 不是 number → 按 isUsed 兜底计数，用量统计会失真`);
        }

        console.log(`   firstOrderOnly  = ${show('firstOrderOnly')}`);
        if (cur.firstOrderOnly !== true) {
            problems.push(`firstOrderOnly 不是布尔 true（字符串 "true" 也不算）→ 老客户照样能领首单码`);
        }

        console.log(`   expiresAt       = ${show('expiresAt')}`);
        if (cur.expiresAt !== undefined && typeof cur.expiresAt?.toDate !== 'function') {
            problems.push(`expiresAt 存在但不是 Firestore Timestamp → 过期检查被跳过，这个码永不过期`);
        }

        const used = typeof cur.usedCount === 'number' ? cur.usedCount : (cur.isUsed ? 1 : 0);
        const max = typeof cur.maxUses === 'number' && cur.maxUses > 0 ? cur.maxUses : 1;
        const disc = typeof cur.discount === 'number' ? cur.discount : 1;
        console.log(`\n   → 实际生效：每单减 RM ${disc}，已用 ${used}/${max} 次，最大敞口 RM ${(disc * max).toFixed(2)}`);

        if (problems.length) {
            console.log(`\n   ❗ 发现 ${problems.length} 个问题：`);
            problems.forEach((p, i) => console.log(`      ${i + 1}. ${p}`));
            console.log('\n   修法：在 Firestore Console 点开 vouchers/' + CODE + ' 逐个字段改类型；');
            console.log('        或（还没人用过时）直接删掉整个文档再跑 --apply 重建。');
        } else {
            console.log('\n   ✅ 全部字段类型正确，服务端会按预期执行。');
        }
        console.log('');
        return;
    }

    console.log('\n将写入 vouchers/' + CODE + '：');
    console.log(JSON.stringify(payload, null, 2));

    if (!APPLY) {
        console.log('\n👀 dry run 结束，什么都没写。确认无误后加 --apply 再跑一次。\n');
        return;
    }

    await ref.set({ ...payload, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    console.log(`\n✅ 已建立 vouchers/${CODE}\n`);
};

run()
    .catch((e) => { console.error('✗ 失败:', e); process.exitCode = 1; })
    // gRPC 连接不关会吊住进程（既有教训：别用 process.exit，会截断写入）
    .finally(() => admin.app().delete());
