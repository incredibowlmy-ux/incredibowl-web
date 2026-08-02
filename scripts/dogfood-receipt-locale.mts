/**
 * Dogfood：收据邮件 / 老板提醒按订单语言渲染（src/lib/receiptEmail.ts + ownerNotify.ts）
 *
 * 背景：这两封信都在服务端发，触发方可能是 Razorpay webhook 或老板在 dashboard
 * 手动确认 QR 单 —— 那时候没有浏览器、没有 Accept-Language，语言只能读订单文档上
 * 的 `locale`（由 /api/submit-order 在下单那一刻盖章）。
 *
 * 做法：劫持 global.fetch 截下发往 Resend / Telegram 的 payload，不真发信、不需要
 * API key 之外的任何东西，然后逐条断言语言正确。渲染出来的 HTML 会落到
 * scratchpad，可以直接用浏览器打开肉眼验收。
 *
 * 跑法：node --import ./scripts/_register-alias.mjs scripts/dogfood-receipt-locale.mts
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = '') {
    if (cond) { pass++; console.log(`  ✅ ${name}`); }
    else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
}

// ── fetch 劫持：截下 payload，永远不出网 ──────────────────────
interface Captured { url: string; body: any }
const captured: Captured[] = [];
const realFetch = global.fetch;
global.fetch = (async (url: any, init: any) => {
    captured.push({ url: String(url), body: JSON.parse(String(init?.body ?? '{}')) });
    return new Response('{"id":"dogfood"}', { status: 200 });
}) as typeof fetch;

// 让两个模块都走「已配置」分支
process.env.RESEND_API_KEY = 'dogfood-fake-key';
process.env.TELEGRAM_BOT_TOKEN = 'dogfood-fake-token';
process.env.TELEGRAM_OWNER_CHAT_ID = '123456';

const { sendOrderReceiptEmails } = await import('@/lib/receiptEmail');
const { notifyOwnerNewQrOrder } = await import('@/lib/ownerNotify');

// ── 测试订单：同一张单，只有 locale 不同 ─────────────────────
const baseData = (locale?: 'zh' | 'en') => ({
    userName: 'Alex Tan',
    userEmail: 'dogfood@incredibowl.my',
    userPhone: '60123456789',
    userAddress: 'Pearl Suria, Old Klang Road',
    items: [
        { name: '柠香香煎三文鱼饭', nameEn: 'Lemon Pan-Seared Salmon Rice', price: 24.9, quantity: 3 },
        { name: '↳ 加饭', nameEn: '↳ Extra rice', price: 2, quantity: 1 },
    ],
    total: 76.7,
    deliveryFee: 5,
    deliveryDate: '2026-08-04',
    deliveryTime: 'Lunch (11AM-1PM)',
    paymentMethod: 'fpx',
    ...(locale ? { locale } : {}),   // 不传 = 本次上线前的旧单
});

const OUT_DIR = join(process.env.TEMP || '.', 'incredibowl-receipt-dogfood');
mkdirSync(OUT_DIR, { recursive: true });

async function renderReceipt(locale?: 'zh' | 'en') {
    captured.length = 0;
    await sendOrderReceiptEmails([{ id: 'abc123JWPCKY', data: baseData(locale) }]);
    const sent = captured.find(c => c.url.includes('resend.com'));
    if (!sent) throw new Error(`locale=${locale ?? '(缺失)'} 没有发出任何邮件`);
    const file = join(OUT_DIR, `receipt-${locale ?? 'legacy'}.html`);
    writeFileSync(file, sent.body.html, 'utf8');
    return { subject: String(sent.body.subject), html: String(sent.body.html), file };
}

console.log('\n=== 1. 中文订单（locale: zh）===');
const zh = await renderReceipt('zh');
check('主题是中文', zh.subject.includes('订单确认'), zh.subject);
check('抬头「订单确认」', zh.html.includes('🍛 订单确认'));
check('正文中文问候', zh.html.includes('碗妈已收到你的订单'));
check('菜名用中文', zh.html.includes('柠香香煎三文鱼饭'));
check('不出现英文菜名', !zh.html.includes('Lemon Pan-Seared'));
check('时段「午餐」', zh.html.includes('午餐 11AM–1PM'));
check('付款方式「FPX 网上银行」', zh.html.includes('FPX 网上银行'));
check('合计口径不变（76.70 + 5.00 = 81.70）', zh.html.includes('RM 81.70'));

console.log('\n=== 2. 英文订单（locale: en）===');
const en = await renderReceipt('en');
check('主题是英文', en.subject.includes('Order confirmed'), en.subject);
check('抬头 Order Confirmed', en.html.includes('🍛 Order Confirmed'));
check('正文英文问候', en.html.includes('BowlMama has received your order'));
check('菜名用 nameEn', en.html.includes('Lemon Pan-Seared Salmon Rice'));
check('加料也用 nameEn', en.html.includes('↳ Extra rice'));
check('时段 Lunch', en.html.includes('Lunch 11AM–1PM'));
check('付款方式 FPX online banking', en.html.includes('FPX online banking'));
check('Total / Delivery 表头是英文', en.html.includes('Total (incl. delivery)') && en.html.includes('Delivery'));
check('金额与中文版逐分一致', en.html.includes('RM 81.70'));
// 整封信里除了品牌 slogan「家的味道」和碗妈落款，不该再有中文
const enBodyCjk = en.html
    .replace(/Incredibowl · 家的味道 · incredibowl.my/g, '')
    .match(/[一-鿿]/g);
check('英文版正文无残留中文', !enBodyCjk, enBodyCjk ? `残留：${enBodyCjk.join('')}` : '');

console.log('\n=== 3. 旧单回归（无 locale 字段）===');
const legacy = await renderReceipt(undefined);
check('缺 locale → 与 locale=zh 渲染逐字一致', legacy.html === zh.html);
check('主题也回落中文', legacy.subject === zh.subject);

console.log('\n=== 4. 老板 QR 提醒：只标语言，正文保持中文 ===');
captured.length = 0;
await notifyOwnerNewQrOrder([{ id: 'abc123JWPCKY', data: { ...baseData('en'), paymentMethod: 'qr' } }]);
const tg = captured.find(c => c.url.includes('telegram.org'));
check('Telegram 发出', !!tg);
check('英文客户被标出', String(tg?.body?.text || '').includes('客户语言：English'));
check('提醒正文仍是中文', String(tg?.body?.text || '').includes('新 QR 订单待核对收款'));
captured.length = 0;
await notifyOwnerNewQrOrder([{ id: 'abc123JWPCKY', data: { ...baseData('zh'), paymentMethod: 'qr' } }]);
const tgZh = captured.find(c => c.url.includes('telegram.org'));
check('中文客户不加这行噪音', !String(tgZh?.body?.text || '').includes('客户语言'));

global.fetch = realFetch;
console.log(`\n渲染结果已写到：${OUT_DIR}`);
console.log(`\n${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
