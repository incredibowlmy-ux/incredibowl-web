/**
 * src/lib/waSend.ts 纯函数断言：24h 窗口判定 + 未配置时不打网络 + 交互消息的上限校验。
 *   npx tsx scripts/dogfood-wa-send.mts
 *
 * 交互消息的上限（3 个按钮 / 20 字标题 / 10 项列表）如果只靠 Meta 兜，
 * 报错是一句没头没尾的 `#100 Invalid parameter`，老板在收件箱里看不懂也修不了，
 * 所以 buildInteractive 在本地就要给出人话，这里把每条边界钉死。
 */
import assert from 'node:assert/strict';
import {
  lastInboundTs, windowRemainingMs, WA_WINDOW_MS, sendText, sendMedia, sendInteractive,
  markRead, sendTemplate, buildInteractive, isConfigured,
  WA_BUTTON_MAX, WA_LIST_ROW_MAX,
} from '../src/lib/waSend';

let n = 0;
const ok = (cond: boolean, msg: string) => { assert.ok(cond, msg); n++; };
const T = 1_700_000_000_000;

// ── 24h 窗口 ────────────────────────────────────────────────
ok(lastInboundTs([]) === 0, '空 turns → 0');
ok(lastInboundTs(undefined) === 0, '非数组 → 0');
ok(lastInboundTs([{ role: 'out', ts: T }]) === 0, '只有出站 → 0');
ok(lastInboundTs([{ role: 'in', ts: T }, { role: 'out', ts: T + 5 }, { role: 'in', ts: T + 9 }, { role: 'boss', ts: T + 20 }]) === T + 9, '取最后一条客户消息');

ok(windowRemainingMs([{ role: 'in', ts: T }], T + 1000) === WA_WINDOW_MS - 1000, '窗口内剩余');
ok(windowRemainingMs([{ role: 'in', ts: T }], T + WA_WINDOW_MS + 1) < 0, '刚过 24h → 负');
ok(windowRemainingMs([{ role: 'out', ts: T }], T) === 0, '没客户消息 → 0（不允许主动发）');

// ── 未配置 token 时一律不打网络 ────────────────────────────
delete process.env.WA_ACCESS_TOKEN;
ok(!isConfigured(), '没 token → 未配置');
const r = await sendText('60123456789', 'hi');
ok(r.ok === false && r.configured === false, '未配置时 sendText 直接回 configured=false，不打 Meta');
const rm = await sendMedia('60123456789', { kind: 'image', link: 'https://x/y.jpg' });
ok(rm.ok === false && rm.configured === false, '未配置时 sendMedia 不打 Meta');
const ri = await sendInteractive('60123456789', { body: 'hi', buttons: [{ id: 'a', title: 'A' }] });
ok(ri.ok === false && ri.configured === false, '未配置时 sendInteractive 不打 Meta');
const rt = await sendTemplate('60123456789', 'weekly_menu_v1', 'en', ['A']);
ok(rt.ok === false && rt.configured === false, '未配置时 sendTemplate 不打 Meta');
ok((await markRead('wamid.X')) === false, '未配置时 markRead 回 false，不打 Meta');
ok((await markRead('')) === false, '空 msgId 的 markRead 直接 false');

// ── 本地就能拒的错误（配置了 token 也不该打网络）────────────
process.env.WA_ACCESS_TOKEN = 'x';
const e = await sendText('60123456789', '   ');
ok(e.ok === false && e.configured === true && /空文本/.test(e.error || ''), '空文本在本地就拒');

const w = await sendMedia('60123456789', { kind: 'image', link: 'https://www.incredibowl.my/chicken_chop.webp' });
ok(w.ok === false && /webp/.test(w.error || ''), 'webp 图片在本地就拒（Meta 图片消息不收 webp）');
const http = await sendMedia('60123456789', { kind: 'image', link: 'http://insecure/x.jpg' });
ok(http.ok === false && /https/.test(http.error || ''), '非 https 媒体链接在本地就拒');
const badKind = await sendMedia('60123456789', { kind: 'audio' as any, link: 'https://x/y.mp3' });
ok(badKind.ok === false && /image \/ document/.test(badKind.error || ''), '只支持 image / document');
const noTpl = await sendTemplate('60123456789', '  ', 'en');
ok(noTpl.ok === false && /缺模板名/.test(noTpl.error || ''), '空模板名在本地就拒');

// ── buildInteractive：按钮 ─────────────────────────────────
const btn = buildInteractive({ body: '要加饭吗？', buttons: [{ id: 'y', title: '要' }, { id: 'n', title: '不用' }] });
ok(typeof btn === 'object' && (btn as any).type === 'button', '两个按钮 → type=button');
ok((btn as any).action.buttons[0].reply.id === 'y' && (btn as any).action.buttons[0].reply.title === '要', '按钮 id/title 原样带上');
ok((btn as any).body.text === '要加饭吗？', '正文进 body.text');
ok(typeof buildInteractive({ body: '', buttons: [{ id: 'a', title: 'A' }] }) === 'string', '空正文 → 错误字符串');
ok(/最多 3 个/.test(buildInteractive({ body: 'x', buttons: Array.from({ length: WA_BUTTON_MAX + 1 }, (_, i) => ({ id: `b${i}`, title: `B${i}` })) }) as string), '超过 3 个按钮 → 人话错误');
ok(/超过 20 字/.test(buildInteractive({ body: 'x', buttons: [{ id: 'a', title: 'A'.repeat(21) }] }) as string), '按钮标题超 20 字 → 人话错误');
ok(typeof buildInteractive({ body: 'x', buttons: [{ id: 'a', title: '  ' }] }) === 'string', '空按钮文字 → 拒');
ok(/id 不能重复/.test(buildInteractive({ body: 'x', buttons: [{ id: 'a', title: 'A' }, { id: 'a', title: 'B' }] }) as string), '重复按钮 id → 拒');
ok(typeof buildInteractive({ body: 'x' }) === 'string', '既没按钮也没列表 → 拒');
ok(typeof buildInteractive({ body: 'x', buttons: [{ id: 'a', title: 'A' }], list: { button: '选', rows: [{ id: 'r', title: 'R' }] } }) === 'string', '按钮和列表都给 → 拒');

// ── buildInteractive：列表 ─────────────────────────────────
const list = buildInteractive({ body: '本周菜单', list: { button: '看菜', rows: [{ id: 'd1', title: '香煎鸡扒', description: 'RM12.90' }, { id: 'd2', title: '柠檬三文鱼' }] } });
ok(typeof list === 'object' && (list as any).type === 'list', '列表 → type=list');
ok((list as any).action.button === '看菜', '列表按钮文字带上');
ok((list as any).action.sections[0].rows.length === 2, '两项都在');
ok((list as any).action.sections[0].rows[0].description === 'RM12.90', '有说明的带说明');
ok(!('description' in (list as any).action.sections[0].rows[1]), '没说明的不写空 description（Firestore/Meta 都不喜欢 undefined）');
ok(/最多 10 项/.test(buildInteractive({ body: 'x', list: { button: '选', rows: Array.from({ length: WA_LIST_ROW_MAX + 1 }, (_, i) => ({ id: `r${i}`, title: `R${i}` })) } }) as string), '超过 10 项 → 人话错误');
ok(/超过 24 字/.test(buildInteractive({ body: 'x', list: { button: '选', rows: [{ id: 'r', title: 'R'.repeat(25) }] } }) as string), '列表项标题超 24 字 → 人话错误');
ok(/说明超过 72 字/.test(buildInteractive({ body: 'x', list: { button: '选', rows: [{ id: 'r', title: 'R', description: 'D'.repeat(73) }] } }) as string), '列表项说明超 72 字 → 人话错误');
ok((buildInteractive({ body: 'x', list: { button: '这个按钮文字非常非常非常长超过二十个字', rows: [{ id: 'r', title: 'R' }] } }) as any).action.button.length <= 20, '列表按钮文字截断到 20');

delete process.env.WA_ACCESS_TOKEN;
console.log(`✓ dogfood-wa-send ${n} 条全过`);
