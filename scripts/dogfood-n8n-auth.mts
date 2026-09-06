/**
 * src/lib/n8nAuth.ts 的断言：两把钥匙任一通过、都没配拒绝、长度相同但内容不同拒绝。
 *   npx tsx scripts/dogfood-n8n-auth.mts
 */
import assert from 'node:assert/strict';
import { bearerMatches, bearerFrom, n8nBearerOk } from '../src/lib/n8nAuth';

const H = (auth?: string) => ({ get: (n: string) => (n.toLowerCase() === 'authorization' ? (auth ?? null) : null) });
let n = 0;
const ok = (cond: boolean, msg: string) => { assert.ok(cond, msg); n++; };

ok(bearerMatches('abc', ['abc']), '单钥匙命中');
ok(bearerMatches('abc', ['zzz', 'abc']), '第二把命中');
ok(!bearerMatches('abc', ['abd']), '同长不同值拒');
ok(!bearerMatches('abc', ['ab']), '不同长拒');
ok(!bearerMatches('abc', [undefined, '']), '候选全空拒');
ok(!bearerMatches('', ['']), '空对空也拒（fail-closed）');

ok(bearerFrom(H('Bearer xyz')) === 'xyz', '取 Bearer 值');
ok(bearerFrom(H('bearer xyz')) === 'xyz', '大小写不敏感');
ok(bearerFrom(H()) === '', '无头 → 空串');

process.env.N8N_API_KEY = 'key-A';
process.env.N8N_INBOUND_SECRET = 'key-B';
ok(n8nBearerOk(H('Bearer key-A')), 'N8N_API_KEY 通过');
ok(n8nBearerOk(H('Bearer key-B')), 'N8N_INBOUND_SECRET 通过（AI 工具节点走这把）');
ok(!n8nBearerOk(H('Bearer key-C')), '第三把拒');
delete process.env.N8N_API_KEY; delete process.env.N8N_INBOUND_SECRET;
ok(!n8nBearerOk(H('Bearer key-A')), '两把都没配 → 拒');
ok(!n8nBearerOk(H('Bearer ')), '空 Bearer 拒');

console.log(`✓ dogfood-n8n-auth ${n} 条全过`);
