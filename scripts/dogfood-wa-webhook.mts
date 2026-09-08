/**
 * dogfood-wa-webhook.mts —— WhatsApp relay 进入层的纯函数验证（不碰网络 / Firestore）。
 *
 * 这一层站在 Meta 和 n8n 中间，错一次就是「客户消息静默消失」或「同一条回两遍」，
 * 而且线上没有 UI 可看。每条规则用固定输入钉死：
 *   验签 / 拆包 / 去重 / 限流 / 人工接管 / 对话记录 / 客户备注白名单 / 老板指令。
 *
 * 跑法：npx tsx scripts/dogfood-wa-webhook.mts
 */
import { createHmac } from 'node:crypto';
import {
  verifyMetaSignature, splitInbound, buildSinglePayload, decideInbound, mytHourKey,
  appendTurn, describeInboundForTurn, renderTurnsBlock, relativeTime,
  mergeProfileFact, renderProfileBlock, parseBossCommand,
  applyStatus, splitStatuses, splitTemplateEvents, describeSendError,
  mediaOfInbound, replyToOfInbound, parseOptOut, optOutReply,
  RATE_LIMIT_PER_HOUR, SEEN_IDS_MAX, TURNS_MAX, SILENT_TYPES,
} from '@/lib/waWebhook';

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${detail ? ` —— ${detail}` : ''}`); }
}

const SECRET = 'test_app_secret_123';
const msg = (from: string, extra: Record<string, any> = {}) => ({
  from, id: 'wamid.' + Math.random().toString(36).slice(2), timestamp: '1757100000', type: 'text', text: { body: 'hi' }, ...extra,
});
const payload = (messages: any[], statuses?: any[]) => ({
  object: 'whatsapp_business_account',
  entry: [{ id: '2664648817254746', changes: [{ field: 'messages', value: {
    messaging_product: 'whatsapp', metadata: { display_phone_number: '60103370197', phone_number_id: '1019276584602589' },
    contacts: messages.map(m => ({ wa_id: m.from, profile: { name: 'N-' + m.from.slice(-3) } })),
    ...(messages.length ? { messages } : {}), ...(statuses ? { statuses } : {}),
  } }] }],
});

console.log('\n=== 1. 验签（X-Hub-Signature-256）===');
{
  const raw = JSON.stringify(payload([msg('60111222333')]));
  const good = 'sha256=' + createHmac('sha256', SECRET).update(raw).digest('hex');
  check('正确签名 → 通过', verifyMetaSignature(raw, good, SECRET));
  check('篡改 body → 拒', !verifyMetaSignature(raw + ' ', good, SECRET));
  check('错的 secret → 拒', !verifyMetaSignature(raw, good, 'wrong'));
  check('没有头 → 拒', !verifyMetaSignature(raw, null, SECRET));
  check('格式不对（无 sha256= 前缀）→ 拒', !verifyMetaSignature(raw, good.slice(7), SECRET));
  check('空 secret → 拒（fail-closed）', !verifyMetaSignature(raw, good, ''));
}

console.log('\n=== 2. 拆包（一个 webhook 多条消息 / statuses 丢弃）===');
{
  const three = splitInbound(payload([msg('60111222333'), msg('60111222333', { text: { body: '第二条' } }), msg('60199988877')]));
  check('1 个 payload 3 条消息 → 拆成 3 份', three.length === 3, String(three.length));
  check('  同一 from 的两条各自保留', three.filter(m => m.from === '60111222333').length === 2);
  check('  第二条文字没丢（v1–v3 只读 messages[0] 会丢）', three[1].message.text.body === '第二条');
  check('  contacts 按 wa_id 配对', three[2].contacts[0]?.wa_id === '60199988877');
  check('  timestamp 转成 ms', three[0].timestampMs === 1757100000 * 1000);
  check('仅 statuses 事件 → 0 份', splitInbound(payload([], [{ id: 'x', status: 'delivered' }])).length === 0);
  check('object 不对 → 0 份', splitInbound({ object: 'page', entry: [] }).length === 0);
  check('畸形 payload → 0 份不抛错', splitInbound(null).length === 0 && splitInbound({ entry: 'x' }).length === 0);

  const single = buildSinglePayload(three[1], { relay: 'v4', receivedAtMs: 1, human: true, humanUntil: 99, throttled: false, humanEndedRecently: false });
  check('还原成 Meta 形状：entry[0].changes[0].value.messages 只有 1 条', single.entry[0].changes[0].value.messages.length === 1);
  check('  带 incredibowl 标记（human=true）', single.entry[0].changes[0].value.incredibowl.human === true);
  check('  Router 读 messages[0].text.body 得到第二条', single.entry[0].changes[0].value.messages[0].text.body === '第二条');
}

console.log('\n=== 3. 去重 / 限流 / 人工接管（decideInbound）===');
{
  const now = Date.parse('2026-09-07T06:30:00+08:00'); // MYT 06:30 周一
  const m1 = { msgId: 'wamid.A' };
  const d1 = decideInbound({}, m1, now);
  check('首次 → 不重复、不限流、非人工', !d1.duplicate && !d1.throttled && !d1.human);
  check('  patch 记下 msgId', (d1.patch.seenMsgIds as string[]).includes('wamid.A'));
  check('  patch 记下小时桶 count=1', (d1.patch.inboundWindow as any).count === 1 && (d1.patch.inboundWindow as any).hourKey === mytHourKey(now));
  check('  小时桶是 MYT（06:30 → 2026-09-07T06）', mytHourKey(now) === '2026-09-07T06');

  const d2 = decideInbound({ seenMsgIds: ['wamid.A'] }, m1, now);
  check('同 msgId 再来 → duplicate（Meta 重试不会回两遍）', d2.duplicate === true);

  const many = Array.from({ length: SEEN_IDS_MAX + 20 }, (_, i) => 'id' + i);
  const d3 = decideInbound({ seenMsgIds: many }, { msgId: 'new' }, now);
  check(`seenMsgIds 封顶 ${SEEN_IDS_MAX}`, (d3.patch.seenMsgIds as string[]).length === SEEN_IDS_MAX && (d3.patch.seenMsgIds as string[]).at(-1) === 'new');

  const atLimit = decideInbound({ inboundWindow: { hourKey: mytHourKey(now), count: RATE_LIMIT_PER_HOUR - 1 } }, { msgId: 'x1' }, now);
  check(`第 ${RATE_LIMIT_PER_HOUR} 条 → 还不限流`, !atLimit.throttled);
  const over = decideInbound({ inboundWindow: { hourKey: mytHourKey(now), count: RATE_LIMIT_PER_HOUR } }, { msgId: 'x2' }, now);
  check(`第 ${RATE_LIMIT_PER_HOUR + 1} 条 → 限流 + 通知客户一次`, over.throttled && over.throttleNotify);
  const over2 = decideInbound({ inboundWindow: { hourKey: mytHourKey(now), count: RATE_LIMIT_PER_HOUR + 5 }, throttleNotifiedHourKey: mytHourKey(now) }, { msgId: 'x3' }, now);
  check('  同一小时再超 → 限流但不再通知', over2.throttled && !over2.throttleNotify);
  const nextHour = decideInbound({ inboundWindow: { hourKey: mytHourKey(now), count: 999 } }, { msgId: 'x4' }, now + 3600 * 1000);
  check('  下一个小时 → 计数归 1，不限流', !nextHour.throttled && (nextHour.patch.inboundWindow as any).count === 1);
  const boss = decideInbound({ inboundWindow: { hourKey: mytHourKey(now), count: 999 } }, { msgId: 'x5' }, now, { exempt: true });
  check('  老板号码豁免', !boss.throttled);

  const human = decideInbound({ humanUntil: now + 60_000 }, { msgId: 'h1' }, now);
  check('humanUntil 在未来 → human=true', human.human && human.humanUntil === now + 60_000);
  const humanEnded = decideInbound({ humanUntil: now - 30 * 60_000 }, { msgId: 'h2' }, now);
  check('humanUntil 30 分钟前过期 → human=false、humanEndedRecently=true', !humanEnded.human && humanEnded.humanEndedRecently);
  const humanOld = decideInbound({ humanUntil: now - 7 * 3600 * 1000 }, { msgId: 'h3' }, now);
  check('humanUntil 7 小时前过期 → humanEndedRecently=false', !humanOld.humanEndedRecently);
  check('无 msgId 也不崩、不去重', !decideInbound({}, { msgId: '' }, now).duplicate);
}

console.log('\n=== 4. 对话记录（turns）===');
{
  const t1 = appendTurn(undefined, 'in', '  你好  ', 1000);
  check('首条 → 1 条，trim 过', t1.length === 1 && t1[0].text === '你好' && t1[0].role === 'in');
  const t2 = appendTurn(t1, 'out', '', 2000);
  check('空文本不追加', t2.length === 1);
  let acc: any = t1;
  for (let i = 0; i < TURNS_MAX + 10; i++) acc = appendTurn(acc, 'out', 'r' + i, 3000 + i);
  check(`封顶 ${TURNS_MAX} 条且保留最新`, acc.length === TURNS_MAX && acc.at(-1).text === 'r' + (TURNS_MAX + 9));
  const longText = 'x'.repeat(2000);
  check('单条截到 600 字', appendTurn([], 'in', longText, 1)[0].text.length === 600);
  const dirty = appendTurn([{ role: 'hacker', text: 'a', ts: 'z' }, { text: 5 }, null], 'in', 'ok', 9);
  check('脏数据：非法 role → sys、非字符串 text 丢掉、null 丢掉', dirty.length === 2 && dirty[0].role === 'sys' && dirty[0].ts === 0);

  check('文字入站 → 原文', describeInboundForTurn({ type: 'text', text: { body: '要两份' } }) === '要两份');
  check('按钮回复 → title', describeInboundForTurn({ type: 'interactive', interactive: { button_reply: { id: 'btn_order', title: '直接下单 🛒' } } }) === '直接下单 🛒');
  check('图片 → [图片] + caption', describeInboundForTurn({ type: 'image', image: { caption: '转账了' } }) === '[图片] 转账了');
  check('定位 → [定位] 地名', describeInboundForTurn({ type: 'location', location: { name: 'Pearl Suria' } }) === '[定位] Pearl Suria');
  check('reaction / sticker / contacts 属于静默类型', SILENT_TYPES.has('reaction') && SILENT_TYPES.has('sticker') && SILENT_TYPES.has('contacts'));
  check('audio / location / image / document 不静默', !SILENT_TYPES.has('audio') && !SILENT_TYPES.has('location') && !SILENT_TYPES.has('image') && !SILENT_TYPES.has('document'));

  const now = Date.parse('2026-09-07T12:00:00+08:00');
  const turns = [
    { role: 'in', text: '当归鸡多少钱', ts: now - 3 * 60_000 },
    { role: 'out', text: 'RM 18.9 哦 ❤️', ts: now - 2 * 60_000 },
    { role: 'boss', text: '今天可以送', ts: now - 26 * 3600 * 1000 },
    { role: 'nudge', text: '还在哦', ts: now - 3 * 24 * 3600 * 1000 },
  ];
  const block = renderTurnsBlock(turns, now);
  check('渲染块带标题', block.startsWith('【最近对话'));
  check('  客户 / 碗妈 角色词正确', block.includes('客户：当归鸡多少钱') && block.includes('碗妈：RM 18.9'));
  check('  老板亲自回 / 自动追单 标出来', block.includes('碗妈（老板亲自回）') && block.includes('碗妈（自动追单）'));
  check('  相对时间：3 分钟前 / 昨天 / 3 天前', block.includes('[3 分钟前]') && block.includes('[昨天]') && block.includes('[3 天前]'));
  check('无记录 → 明确说是第一次对话', renderTurnsBlock([], now).includes('第一次对话'));
  check('limit 只取最近 N 条', renderTurnsBlock(turns, now, 1).split('\n').length === 2);
  check('relativeTime 未来/非法 → [刚刚]', relativeTime(now + 5000, now) === '[刚刚]' && relativeTime(0, now) === '[刚刚]');
}

console.log('\n=== 5. 客户备注白名单 ===');
{
  check('nickname 单值覆盖', mergeProfileFact({ nickname: 'A' }, 'nickname', 'May')?.nickname === 'May');
  check('dropoff 单值', mergeProfileFact({}, 'dropoff', '放 guard house')?.dropoff === '放 guard house');
  check('preferredMeal 归一化 dinner', mergeProfileFact({}, 'preferredMeal', '晚餐')?.preferredMeal === 'dinner');
  check('preferredMeal 归一化 lunch', mergeProfileFact({}, 'preferredMeal', 'Lunch please')?.preferredMeal === 'lunch');
  check('preferredMeal 认不出 → 拒', mergeProfileFact({}, 'preferredMeal', 'brunch') === null);
  check('tag 追加去重', JSON.stringify(mergeProfileFact({ tags: ['办公室客'] }, 'tag', '办公室客')?.tags) === '["办公室客"]');
  check('note 列表封顶 10', (mergeProfileFact({ notes: Array.from({ length: 12 }, (_, i) => 'n' + i) }, 'note', 'new')?.notes as string[]).length === 10);
  check('白名单外 key（email / password）→ 拒', mergeProfileFact({}, 'email', 'a@b.c') === null && mergeProfileFact({}, 'password', 'x') === null);
  check('空值 → 拒', mergeProfileFact({}, 'note', '   ') === null);
  check('值截到 120 字', (mergeProfileFact({}, 'note', 'y'.repeat(500))?.notes as string[])[0].length === 120);
  check('不改入参', (() => { const p = { tags: ['a'] }; mergeProfileFact(p, 'tag', 'b'); return p.tags.length === 1; })());
  const blk = renderProfileBlock({ nickname: 'May', dropoff: '放 guard house', allergy: '花生', preferredMeal: 'dinner', tags: ['住 Pearl Suria'], notes: ['要多饭'] });
  check('渲染块含称呼 / 交接 / 过敏提醒求救 / 时段 / 标签 / 备注',
    blk.includes('称呼：May') && blk.includes('还是放 guard house吗') && blk.includes('求救老板') && blk.includes('晚餐') && blk.includes('住 Pearl Suria') && blk.includes('要多饭'));
  check('空档案 → 空串（不占提示词）', renderProfileBlock({}) === '' && renderProfileBlock(null) === '');
}

console.log('\n=== 6. 老板指令 ===');
{
  check('#pause 60123456789 → pause 120 分钟默认', JSON.stringify(parseBossCommand('#pause 60123456789')) === '{"cmd":"pause","phone":"60123456789","minutes":120}');
  check('#pause 60123456789 45 → 45 分钟', parseBossCommand('#pause 60123456789 45')?.minutes === 45);
  check('#pause 上限 720', parseBossCommand('#pause 60123456789 999')?.minutes === 720);
  check('#暂停 中文别名', parseBossCommand('#暂停 60123456789')?.cmd === 'pause');
  check('#resume / #恢复', parseBossCommand('#resume 60123456789')?.cmd === 'resume' && parseBossCommand('#恢复 60123456789')?.cmd === 'resume');
  check('#status 带 +60 12-345 6789 格式', parseBossCommand('#status +60 12-345 6789')?.phone === '60123456789');
  check('本地格式 0123456789 → 拒（必须 60 开头）', parseBossCommand('#pause 0123456789') === null);
  check('普通文字 → null', parseBossCommand('今天菜单发我') === null && parseBossCommand('') === null);
  check('#pause 没号码 → null', parseBossCommand('#pause') === null);
}

// ────────────────────────────────────────────────────────────
console.log('\n【A0/A1】turn 扩展字段 · 出站回执 · 模板事件');
{
  const T = 1_757_100_000_000;
  // ── extra 字段 ──────────────────────────────────────────
  const withId = appendTurn([], 'out', 'hi', T, { msgId: 'wamid.A' });
  check('appendTurn extra 收下 msgId', withId[0].msgId === 'wamid.A');
  check('没给 extra 时不写 undefined 键（Firestore 拒收 undefined）',
    !('status' in appendTurn([], 'out', 'x', T)[0]) && !('media' in appendTurn([], 'out', 'x', T)[0]));
  const med = appendTurn([], 'in', '[图片]', T, { media: { kind: 'image', id: 'MID1', mime: 'image/jpeg' } });
  check('appendTurn 收下 media', med[0].media?.kind === 'image' && med[0].media?.id === 'MID1');
  check('media kind 不在白名单 → 整个 media 丢掉',
    appendTurn([], 'in', 'x', T, { media: { kind: 'gif' as any } }).at(-1)!.media === undefined);
  check('extra 里的野字段被丢弃',
    (appendTurn([], 'out', 'x', T, { foo: 'bar' } as any).at(-1) as any).foo === undefined);
  // ── 清洗历史数组时保留扩展字段（回归：写新消息会洗掉老回执）──
  const grown = appendTurn(withId, 'in', '收到', T + 10);
  check('追加新 turn 后老 turn 的 msgId 还在', grown[0].msgId === 'wamid.A');
  const readOld = appendTurn([{ role: 'out', text: 'hi', ts: T, msgId: 'wamid.A', status: 'read', statusAtMs: T + 5 }], 'in', 'ok', T + 9);
  check('追加新 turn 后老 turn 的 status 还在', readOld[0].status === 'read' && readOld[0].statusAtMs === T + 5);
  check('非法 status 被洗掉',
    appendTurn([{ role: 'out', text: 'hi', ts: T, status: 'weird' }], 'in', 'ok', T)[0].status === undefined);
  // ── applyStatus 单调 ────────────────────────────────────
  const base = appendTurn([], 'out', 'hi', T, { msgId: 'wamid.A' });
  const sent = applyStatus(base, 'wamid.A', 'sent', undefined, T + 1);
  const deliv = applyStatus(sent, 'wamid.A', 'delivered', undefined, T + 2);
  const read = applyStatus(deliv, 'wamid.A', 'read', undefined, T + 3);
  check('sent → delivered → read 逐级前进', sent[0].status === 'sent' && deliv[0].status === 'delivered' && read[0].status === 'read');
  check('read 之后再来 delivered 不倒退，且返回原引用', applyStatus(read, 'wamid.A', 'delivered', undefined, T + 4) === read);
  check('同一状态重复到达 → 原引用（Meta 会重发回执）', applyStatus(read, 'wamid.A', 'read', undefined, T + 5) === read);
  const failed = applyStatus(read, 'wamid.A', 'failed', '131047 窗口已过', T + 6);
  check('failed 可以覆盖 read 并记 err', failed[0].status === 'failed' && failed[0].err === '131047 窗口已过');
  check('failed 之后不再被 read 覆盖', applyStatus(failed, 'wamid.A', 'read', undefined, T + 7) === failed);
  check('msgId 找不到 → 原引用', applyStatus(read, 'wamid.NOPE', 'read', undefined, T + 8) === read);
  check('空 msgId / 非法 status → 原引用',
    applyStatus(read, '', 'read', undefined, T) === read && applyStatus(read, 'wamid.A', 'clicked', undefined, T) === read);
  check('applyStatus 不改入参', base[0].status === undefined);
  const two = applyStatus(appendTurn(base, 'out', '第二条', T + 20, { msgId: 'wamid.B' }), 'wamid.B', 'read', undefined, T + 21);
  check('多条 turn 时只动对应 msgId 那条', two[1].status === 'read' && two[0].status === undefined);
  check('statusAtMs 记下回执时间', read[0].statusAtMs === T + 3);
  // ── splitStatuses ──────────────────────────────────────
  const stPayload = {
    object: 'whatsapp_business_account',
    entry: [{ id: 'E1', changes: [{ field: 'messages', value: {
      messaging_product: 'whatsapp', metadata: {},
      statuses: [
        { id: 'wamid.A', status: 'delivered', timestamp: '1757100000', recipient_id: '60165119118' },
        { id: 'wamid.B', status: 'failed', timestamp: '1757100005', recipient_id: '+60 12-345 6789',
          errors: [{ code: 131047, title: 'Re-engagement message', error_data: { details: 'Message failed to send because more than 24 hours have passed' } }] },
      ],
    } }] }],
  };
  const evs = splitStatuses(stPayload);
  check('splitStatuses 拆出 2 条', evs.length === 2);
  check('recipient 归一成纯数字', evs[1].recipient === '60123456789');
  check('时间戳秒 → 毫秒', evs[0].ts === 1757100000000);
  check('errors 拆出 code/title/details', evs[1].errCode === 131047 && /Re-engagement/.test(evs[1].errTitle || '') && /24 hours/.test(evs[1].errDetails || ''));
  check('没有 errors 的不带 errCode', evs[0].errCode === undefined);
  check('messages-only 事件 → 0 条回执', splitStatuses(payload([msg('60123456789')])).length === 0);
  check('statuses 事件 → splitInbound 仍是 0 条（进站与回执两条路）', splitInbound(stPayload).length === 0);
  check('非法 status 值被跳过',
    splitStatuses({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: { statuses: [{ id: 'x', status: 'deleted', recipient_id: '60111' }] } }] }] }).length === 0);
  check('缺 id 或 recipient 被跳过',
    splitStatuses({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: { statuses: [{ status: 'read', recipient_id: '60111' }, { id: 'x', status: 'read' }] } }] }] }).length === 0);
  check('非 whatsapp 对象 → 空', splitStatuses({ object: 'page', entry: [] }).length === 0);
  // ── describeSendError ──────────────────────────────────
  check('131047 翻成人话', /24 小时窗口已过/.test(describeSendError({ errCode: 131047 })));
  check('未知码回落到 title', describeSendError({ errCode: 999999, errTitle: 'Weird thing' }) === '999999 Weird thing');
  check('什么都没有 → 未知错误', describeSendError({}) === '未知错误');
  check('describeSendError 截断到 120 字', describeSendError({ errCode: 131047, errDetails: 'x'.repeat(400) }).length <= 120);
  // ── splitTemplateEvents ────────────────────────────────
  const tpl = { object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'message_template_status_update', value: {
    event: 'APPROVED', message_template_id: 1, message_template_name: 'weekly_menu_v1', message_template_language: 'en', reason: 'NONE',
  } }] }] };
  const tevs = splitTemplateEvents(tpl);
  check('splitTemplateEvents 拆出模板审核结果', tevs.length === 1 && tevs[0].name === 'weekly_menu_v1' && tevs[0].event === 'APPROVED');
  check('模板事件不会被当成进站消息或回执', splitInbound(tpl).length === 0 && splitStatuses(tpl).length === 0);
  check('messages 事件 → 0 条模板事件', splitTemplateEvents(payload([msg('60123456789')])).length === 0);
  // ── 入站媒体 / 引用 ────────────────────────────────────
  check('mediaOfInbound 认图片',
    mediaOfInbound({ type: 'image', image: { id: 'MID9', mime_type: 'image/jpeg' } })?.id === 'MID9');
  check('mediaOfInbound 认文件名',
    mediaOfInbound({ type: 'document', document: { id: 'D1', filename: 'menu.pdf' } })?.filename === 'menu.pdf');
  check('纯文字没有 media', mediaOfInbound({ type: 'text', text: { body: 'hi' } }) === undefined);
  check('贴纸不算 media（在 SILENT_TYPES 里）', mediaOfInbound({ type: 'sticker', sticker: { id: 'S1' } }) === undefined);
  check('replyToOfInbound 取 context.id', replyToOfInbound({ context: { id: 'wamid.Q' } }) === 'wamid.Q');
  check('没 context → undefined', replyToOfInbound({ type: 'text' }) === undefined);
}


// ────────────────────────────────────────────────────────────
console.log('\n【B3 前置】群发退订 STOP / START');
{
  check('STOP 退订', parseOptOut('STOP') === 'stop');
  check('小写 stop / 带句号 / 带空格', parseOptOut('stop') === 'stop' && parseOptOut(' Stop. ') === 'stop');
  check('unsubscribe / 退订 / 取消订阅', parseOptOut('unsubscribe') === 'stop' && parseOptOut('退订') === 'stop' && parseOptOut('取消订阅') === 'stop');
  check('START / 订阅 → 重新订阅', parseOptOut('START') === 'start' && parseOptOut('订阅') === 'start');
  check("整句里含 stop 不算退订（don't stop sending）", parseOptOut("don't stop sending") === null);
  check('「停止发送」认，「停」不认', parseOptOut('停止发送') === 'stop' && parseOptOut('停') === null);
  check('普通对话不误伤', parseOptOut('今天有什么菜') === null && parseOptOut('') === null && parseOptOut(undefined) === null);
  check('退订回执双语且提到 START', /START/.test(optOutReply('stop')) && /退订/.test(optOutReply('stop')));
  check('订阅回执提到 STOP', /STOP/.test(optOutReply('start')));
}
console.log(`\n${'─'.repeat(52)}`);
console.log(`通过 ${pass} · 失败 ${fail}`);
if (fail > 0) process.exit(1);
