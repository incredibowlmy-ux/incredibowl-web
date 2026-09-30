/**
 * Dogfood: /driver WhatsApp 顾客按钮的预填消息（src/lib/driverWhatsApp.ts）
 *
 * 跑法：node --import ./scripts/_register-alias.mjs scripts/dogfood-driver-whatsapp.mts
 *
 * 验的是：拼出来的 wa.me 链接经标准 URL 解析回来，消息原文一字不差
 * （中文、emoji、换行不能被编坏），号码规则与改动前一致。
 */
import { etaMessage, etaWhatsAppLink } from '@/lib/driverWhatsApp';

let pass = 0, fail = 0;
function eq(label: string, actual: unknown, expected: unknown) {
    const good = JSON.stringify(actual) === JSON.stringify(expected);
    if (good) pass++; else fail++;
    console.log(`  ${good ? '✓' : '✗'} ${label}\n      → ${JSON.stringify(actual)}${good ? '' : `   ← 期望 ${JSON.stringify(expected)}`}`);
}
function ok(label: string, cond: boolean, detail = '') {
    if (cond) pass++; else fail++;
    console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? `\n      ${detail}` : ''}`);
}

console.log('\n【A】消息内容');
const msg = etaMessage('Amy');
console.log(`\n${msg}\n`);
ok('中文段含「大约还有 10 分钟就送到了」', msg.includes('大约还有 10 分钟就送到了'));
ok('英文段含「about 10 minutes」', msg.includes('about 10 minutes'));
ok('两段都称呼名字', (msg.match(/Hi Amy/g) || []).length === 2);
ok('两段都署名 Wei Ting', msg.includes('我是 Incredibowl 的 Wei Ting') && msg.includes('Wei Ting from Incredibowl here'));
ok('没名字 → 只写 Hi，不出现 undefined/匿名', etaMessage('  ').startsWith('Hi！') && !/undefined|匿名/.test(etaMessage('')));

console.log('\n【B】链接往返解码');
const link = etaWhatsAppLink('012-345 6789', 'Amy');
const u = new URL(link);
eq('host', u.host, 'wa.me');
eq('0 开头换 60', u.pathname, '/60123456789');
eq('text 参数解码回来与原文一字不差', u.searchParams.get('text'), msg);
ok('链接里没有裸空格/换行', !/[\s]/.test(link));
eq('+60 开头保持 60', new URL(etaWhatsAppLink('+60 12-345 6789', 'Amy')).pathname, '/60123456789');
eq('外国号码不被改（+65）', new URL(etaWhatsAppLink('+65 9123 4567', 'Amy')).pathname, '/6591234567');

console.log(`\n${'─'.repeat(50)}`);
console.log(fail === 0 ? `✅ 全绿 ${pass}/${pass + fail}` : `❌ ${fail} 项失败（${pass}/${pass + fail} 通过）`);
process.exit(fail === 0 ? 0 : 1);
