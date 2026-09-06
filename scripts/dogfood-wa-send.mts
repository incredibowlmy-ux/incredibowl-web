/**
 * src/lib/waSend.ts 纯函数断言：24h 窗口判定 + 未配置时 sendText 不打网络。
 *   npx tsx scripts/dogfood-wa-send.mts
 */
import assert from 'node:assert/strict';
import { lastInboundTs, windowRemainingMs, WA_WINDOW_MS, sendText, isConfigured } from '../src/lib/waSend';

let n = 0;
const ok = (cond: boolean, msg: string) => { assert.ok(cond, msg); n++; };
const T = 1_700_000_000_000;

ok(lastInboundTs([]) === 0, '空 turns → 0');
ok(lastInboundTs(undefined) === 0, '非数组 → 0');
ok(lastInboundTs([{ role: 'out', ts: T }]) === 0, '只有出站 → 0');
ok(lastInboundTs([{ role: 'in', ts: T }, { role: 'out', ts: T + 5 }, { role: 'in', ts: T + 9 }, { role: 'boss', ts: T + 20 }]) === T + 9, '取最后一条客户消息');

ok(windowRemainingMs([{ role: 'in', ts: T }], T + 1000) === WA_WINDOW_MS - 1000, '窗口内剩余');
ok(windowRemainingMs([{ role: 'in', ts: T }], T + WA_WINDOW_MS + 1) < 0, '刚过 24h → 负');
ok(windowRemainingMs([{ role: 'out', ts: T }], T) === 0, '没客户消息 → 0（不允许主动发）');

delete process.env.WA_ACCESS_TOKEN;
ok(!isConfigured(), '没 token → 未配置');
const r = await sendText('60123456789', 'hi');
ok(r.ok === false && r.configured === false, '未配置时直接回 configured=false，不打 Meta');

process.env.WA_ACCESS_TOKEN = 'x';
const e = await sendText('60123456789', '   ');
ok(e.ok === false && e.configured === true && /空文本/.test(e.error || ''), '空文本在本地就拒');
delete process.env.WA_ACCESS_TOKEN;

console.log(`✓ dogfood-wa-send ${n} 条全过`);
