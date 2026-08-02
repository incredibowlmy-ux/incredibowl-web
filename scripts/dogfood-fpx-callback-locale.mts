/**
 * Dogfood：FPX 回跳按语言落地（src/app/api/payment/fpx-callback/route.ts）
 *
 * 修的洞：这个路由原来 5 条 redirect 全部写死 `/`。英文客户从 /en 结账、从银行
 * 回来一律落在中文首页 —— /en 那份英文成功弹窗（en/page.tsx:407）明明早就写好，
 * 只是永远没机会执行。付款失败弹窗同理，英文客户吃一屏中文报错。
 *
 * 直接调路由处理函数断言 Location 头，不需要起服务器。
 *
 * 跑法：node --import ./scripts/_register-alias.mjs scripts/dogfood-fpx-callback-locale.mts
 */

import crypto from 'node:crypto';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = '') {
    if (cond) { pass++; console.log(`  ✅ ${name}`); }
    else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
}

process.env.RAZORPAY_KEY_SECRET = 'dogfood_secret';
const { GET, POST } = await import('@/app/api/payment/fpx-callback/route');

const ORIGIN = 'https://www.incredibowl.my';
const PID = 'pay_DOGFOOD001';
const OID = 'order_DOGFOOD001';
const goodSig = crypto.createHmac('sha256', 'dogfood_secret').update(`${OID}|${PID}`).digest('hex');
const badSig = crypto.createHmac('sha256', 'wrong_secret').update(`${OID}|${PID}`).digest('hex');

const loc = async (res: any) => String(res.headers.get('location'));

/** 模拟银行回跳（测试模式的 GET 形态） */
const hitGet = (localeQs: string, sig: string | null) => {
    const u = new URL(`${ORIGIN}/api/payment/fpx-callback${localeQs}`);
    if (sig) {
        u.searchParams.set('razorpay_payment_id', PID);
        u.searchParams.set('razorpay_order_id', OID);
        u.searchParams.set('razorpay_signature', sig);
    }
    return GET(new Request(u.toString()) as any);
};

/** 生产形态：Razorpay POST form-encoded */
const hitPost = (localeQs: string, sig: string | null) => {
    const body = new URLSearchParams();
    if (sig) {
        body.set('razorpay_payment_id', PID);
        body.set('razorpay_order_id', OID);
        body.set('razorpay_signature', sig);
    }
    return POST(new Request(`${ORIGIN}/api/payment/fpx-callback${localeQs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    }) as any);
};

console.log('\n=== 1. 成功回跳（GET / 测试模式）===');
const enOk = await loc(await hitGet('?locale=en', goodSig));
check('英文单落 /en', new URL(enOk).pathname === '/en', enOk);
check('支付参数原样带过去', enOk.includes(`fpx_pid=${PID}`) && enOk.includes('fpx_ok=1') && enOk.includes(`fpx_sig=${goodSig}`));
const zhOk = await loc(await hitGet('?locale=zh', goodSig));
check('中文单落 /', new URL(zhOk).pathname === '/', zhOk);

console.log('\n=== 2. 成功回跳（POST / 生产形态）===');
const enOkPost = await loc(await hitPost('?locale=en', goodSig));
check('英文单落 /en', new URL(enOkPost).pathname === '/en', enOkPost);
const zhOkPost = await loc(await hitPost('?locale=zh', goodSig));
check('中文单落 /', new URL(zhOkPost).pathname === '/', zhOkPost);

console.log('\n=== 3. 失败路径也要分语言 ===');
const enCancel = await loc(await hitGet('?locale=en', null));
check('取消：英文单落 /en', new URL(enCancel).pathname === '/en', enCancel);
check('取消：带 fpx_error=cancelled', enCancel.includes('fpx_error=cancelled'));
const enInvalid = await loc(await hitGet('?locale=en', badSig));
check('签名不符：英文单落 /en', new URL(enInvalid).pathname === '/en', enInvalid);
check('签名不符：带 fpx_error=invalid', enInvalid.includes('fpx_error=invalid'));
const zhInvalid = await loc(await hitGet('?locale=zh', badSig));
check('签名不符：中文单落 /', new URL(zhInvalid).pathname === '/', zhInvalid);

console.log('\n=== 4. locale 丢失 / 被乱填 → 一律回落中文 ===');
for (const [label, qs] of [['无 locale 参数', ''], ['空值', '?locale='], ['乱填', '?locale=zh-Hans-x'], ['大小写不符', '?locale=EN']] as const) {
    const l = await loc(await hitGet(qs, goodSig));
    check(`${label} → /`, new URL(l).pathname === '/', l);
}

console.log('\n⚠️ 仍需真机实测：Razorpay 是否在所有支付方式下都原样回传 callback_url 上的');
console.log('   ?locale —— 若被吞掉，英文客户落在 `/`，由 page.tsx 读 localStorage');
console.log('   快照的兜底重定向接手（那条路径不依赖第三方）。');

console.log(`\n${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
