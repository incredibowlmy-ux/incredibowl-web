/**
 * 收件箱「已成交 / 已关闭」端到端 smoke —— 打本地 next start（读写的是真 Firestore）。
 * 只用合成号码 60000000031 / 32（与测试页的 2x 号段错开），跑完删掉。
 *
 * 跑法（worktree 里）：
 *   N8N_API_KEY=smoke-local npx next start -p 3461     # 另一个终端
 *   npx tsx scripts/_smoke-inbox-ordered.mts
 */
import admin from 'firebase-admin';
import fs from 'node:fs';
import { markLeadsOrdered } from '@/lib/waLeadStatus';

const BASE = process.env.SMOKE_BASE || 'http://localhost:3461';
const N8N_KEY = process.env.SMOKE_N8N_KEY || 'smoke-local';
const API_KEY = 'AIzaSyBSTpQdHv0XkijnWcLN8Ys8eNusdaNbgDc';
const PHONE = '60000000031';
const GHOST = '60000000032';   // 从不建文档的号码

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync('C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json', 'utf-8'))) });
const db = admin.firestore();
const ref = db.collection('waLeads').doc(PHONE);

const adminUser = await admin.auth().getUserByEmail('incredibowl.my@gmail.com');
const customToken = await admin.auth().createCustomToken(adminUser.uid);
const signIn = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true }),
}).then(r => r.json());
if (!signIn.idToken) throw new Error('拿不到 ID token: ' + JSON.stringify(signIn).slice(0, 200));

const post = async (path: string, auth: string, body: unknown) => {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` }, body: JSON.stringify(body) });
  return { http: r.status, ...(await r.json().catch(() => ({}))) } as Record<string, any>;
};
const touch = (text: string) => post('/api/n8n/lead', N8N_KEY, { action: 'touch', phone: PHONE, text, name: 'SMOKE 成交' });
const op = (o: string, phone = PHONE) => post('/api/admin/wa-lead', signIn.idToken, { op: o, phone });
const doc = async () => (await ref.get()).data() as Record<string, any>;

let pass = 0, fail = 0;
const ck = (label: string, cond: boolean, detail: unknown = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); } else { fail++; console.log(`  ❌ ${label} —— ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`); }
};

try {
  await ref.delete();
  console.log('\n=== 1. 手动标记成交 ===');
  let t = await touch('hi');
  let d = await doc();
  ck('touch 建档：engaged', t.ok === true && d.status === 'engaged', t);
  const hadNudge = Number(d.nextNudgeMs) > 0;
  ck('进行中有追单排程（对照组）', hadNudge, d.nextNudgeMs);
  let r = await op('ordered');
  d = await doc();
  ck('op=ordered → status ordered、追单清零、记了时间', r.ok === true && d.status === 'ordered' && d.nextNudgeMs === 0 && d.closedAtMs > 0 && d.closedReason === 'manual', { r, s: d.status, n: d.nextNudgeMs });
  ck('写了一条系统行', d.turns?.at(-1)?.role === 'sys' && /标记成交/.test(d.turns.at(-1).text), d.turns?.at(-1));
  let g = await op('get');
  ck('get 回 status / closedAtMs', g.status === 'ordered' && g.closedAtMs === d.closedAtMs, { s: g.status, c: g.closedAtMs });
  let l = await op('list');
  ck('list 里这条是 ordered（「已成交」tab 认的就是它）', l.rows?.find((x: any) => x.phone === PHONE)?.status === 'ordered');

  console.log('\n=== 2. 成交后客户再发消息（24h 内）===');
  t = await touch('谢谢');
  d = await doc();
  ck('仍是已成交', d.status === 'ordered' && t.lead?.status === 'ordered', { db: d.status, api: t.lead?.status });
  ck('没有重新排追单', d.nextNudgeMs === 0 && t.nextNudgeMs === 0, d.nextNudgeMs);
  ck('不算新一轮（订单号/成交时间没被清）', t.newSession === false && d.closedAtMs > 0, t.newSession);

  console.log('\n=== 3. 成交超过 24h 后再来消息 ===');
  await ref.update({ closedAtMs: Date.now() - 25 * 3600 * 1000 });
  t = await touch('下周菜单有什么');
  d = await doc();
  ck('保护期过了：状态回到 engaged', d.status === 'engaged', d.status);
  ck('但刚聊过（<24h）不当新一轮 —— n8n 走 AI 回答，不发开场白', t.newSession === false, t.newSession);
  ck('追单恢复排程', Number(d.nextNudgeMs) > 0, d.nextNudgeMs);
  await ref.update({ status: 'ordered', closedAtMs: Date.now() - 30 * 3600 * 1000, lastMsgMs: Date.now() - 26 * 3600 * 1000 });
  t = await touch('这周还有鸡扒吗');
  ck('成交已久且 24h 没说过话 → 才是新一轮', t.newSession === true && (await doc()).status === 'engaged', t.newSession);

  console.log('\n=== 4. 关闭 / 重新打开 ===');
  r = await op('close');
  d = await doc();
  ck('op=close → closed、追单清零', r.status === 'closed' && d.status === 'closed' && d.nextNudgeMs === 0, { r, s: d.status });
  r = await op('reopen');
  d = await doc();
  ck('op=reopen → engaged、成交痕迹清掉', r.status === 'engaged' && d.status === 'engaged' && d.closedAtMs === 0 && d.orderId === '', { r, s: d.status });
  await op('close');
  t = await touch('还在吗');
  d = await doc();
  ck('已关闭的客户再来消息 → 自动重开并排追单', d.status === 'engaged' && t.newSession === true && Number(d.nextNudgeMs) > 0, { s: d.status, n: d.nextNudgeMs });

  console.log('\n=== 5. 订单确认自动标成交（confirm-order 调的就是这个函数）===');
  const n = await markLeadsOrdered(db, [
    { id: 'SMOKEORDERabc123', data: { userPhone: '0' + PHONE.slice(2) } },   // 订单上是本地格式
    { id: 'SMOKEORDERabc124', data: { userPhone: PHONE } },                  // 多日单同号码 → 只处理一次
    { id: 'SMOKEORDERghost1', data: { userPhone: GHOST } },                  // 没聊过的客户
    { id: 'SMOKEORDERnophone', data: {} },
  ]);
  d = await doc();
  ck('只标了 1 条', n === 1, n);
  ck('ordered + 订单号 + 追单清零', d.status === 'ordered' && d.orderId === 'SMOKEORDERabc123' && d.nextNudgeMs === 0 && d.closedReason === 'order_confirmed', { s: d.status, o: d.orderId });
  ck('系统行带订单短号', /#ABC123/.test(d.turns?.at(-1)?.text || ''), d.turns?.at(-1));
  ck('没聊过的号码不会凭空建档', !(await db.collection('waLeads').doc(GHOST).get()).exists);
  const turnsBefore = d.turns.length;
  await markLeadsOrdered(db, [{ id: 'SMOKEORDERabc999', data: { userPhone: PHONE } }]);
  d = await doc();
  ck('已成交再来一单：更新订单号、不叠系统行', d.orderId === 'SMOKEORDERabc999' && d.turns.length === turnsBefore, { o: d.orderId, len: d.turns.length });
  g = await op('get');
  ck('get 回 orderId', g.orderId === 'SMOKEORDERabc999', g.orderId);

  console.log('\n=== 7. 列表排序 / pulse（第 1 批）===');
  {
    // 模拟 webhook 收到一张图片：只写 turns + lastInboundAtMs，不碰 lastMsgMs（线上就是这样）
    await ref.update({ lastMsgMs: Date.now() - 48 * 3600 * 1000, bossReadAtMs: Date.now() - 60 * 1000 });
    const before = Date.now();
    await new Promise(res => setTimeout(res, 30));
    const inTs = Date.now();
    const cur = await doc();
    await ref.update({ lastInboundAtMs: inTs, turns: [...cur.turns, { role: 'in', text: '[图片] 付款截图', ts: inTs, msgId: 'wamid.SMOKEIMG' }] });
    l = await op('list');
    const row = l.rows?.find((x: any) => x.phone === PHONE);
    ck('list：图片那条把对话顶上来（activityMs = 图片时间，不是 48 小时前）', row?.activityMs === inTs && row?.lastMsgMs === inTs, { a: row?.activityMs, inTs });
    ck('list：lastInMs / 未读 / full 标记', row?.lastInMs === inTs && row?.unread >= 1 && l.full === true, { lastIn: row?.lastInMs, unread: row?.unread, full: l.full });
    ck('list：比它旧的对话排在后面', l.rows.findIndex((x: any) => x.phone === PHONE) <= l.rows.findIndex((x: any) => x.activityMs < inTs && x.phone !== PHONE) || !l.rows.some((x: any) => x.activityMs < inTs && x.phone !== PHONE));
    let p = await post('/api/admin/wa-lead', signIn.idToken, { op: 'pulse', since: before });
    ck('pulse(since=刚才)：只带回有新客户消息的对话，含这条', p.full === false && p.rows?.some((x: any) => x.phone === PHONE) && p.rows.length < Math.max(2, l.rows.length), { full: p.full, n: p.rows?.length });
    p = await post('/api/admin/wa-lead', signIn.idToken, { op: 'pulse', since: Date.now() + 60 * 1000 });
    ck('pulse(since=未来)：空', Array.isArray(p.rows) && p.rows.length === 0 && typeof p.now === 'number', p.rows?.length);
    p = await post('/api/admin/wa-lead', signIn.idToken, { op: 'pulse', since: 0 });
    ck('pulse(since=0)：等同整份列表', p.full === true && p.rows.length === l.rows.length, { n: p.rows?.length, l: l.rows.length });
    // 没有 lastMsgMs 字段的文档：旧查询 orderBy('lastMsgMs') 会直接漏掉
    await db.collection('waLeads').doc(GHOST).set({ phone: GHOST, name: 'SMOKE 无排序键', lastInboundAtMs: inTs, turns: [{ role: 'in', text: '[语音]', ts: inTs - 1000 }] });
    l = await op('list');
    ck('list：没有 lastMsgMs 的对话也出现', l.rows?.some((x: any) => x.phone === GHOST));
    await db.collection('waLeads').doc(GHOST).delete();
  }

  console.log('\n=== 8. 并发写 turns 不互相覆盖（第 1 批）===');
  {
    const n0 = (await doc()).turns.length;
    const reply = (text: string) => post('/api/n8n/lead', N8N_KEY, { action: 'reply', phone: PHONE, role: 'out', text });
    const rs = await Promise.all([op('human'), reply('并发回复 A'), op('nudgeoff'), reply('并发回复 B'), op('nudgeon'), reply('并发回复 C')]);
    d = await doc();
    const texts = d.turns.slice(n0).map((x: any) => x.text);
    ck('6 个并行写全部成功', rs.every(x => x.ok === true), rs.map(x => x.ok));
    ck('6 条新 turn 一条不少（以前整数组写回会互相盖）', d.turns.length === n0 + 6 && ['并发回复 A', '并发回复 B', '并发回复 C'].every(x => texts.includes(x)), { n0, n: d.turns.length, texts });
    ck('前面的客户消息还在', d.turns.some((x: any) => x.msgId === 'wamid.SMOKEIMG'));
    const note = await post('/api/admin/wa-lead', signIn.idToken, { op: 'note', phone: PHONE, key: 'nickname', value: 'SMOKE 备注' });
    ck('note 仍可用（事务化后）', note.ok === true && (await doc()).profile?.nickname === 'SMOKE 备注', note);
    const badNote = await post('/api/admin/wa-lead', signIn.idToken, { op: 'note', phone: PHONE, key: 'hack', value: 'x' });
    ck('note 非白名单 key → 400', badNote.http === 400, badNote.http);
    await op('release');
  }

  console.log('\n=== 9. 标为未读 / 下单链接 / bot 求救 / 待回复（第 2 批）===');
  {
    await op('reopen');
    await op('read');
    l = await op('list');
    let row = l.rows?.find((x: any) => x.phone === PHONE);
    ck('read 之后未读 0', row?.unread === 0, row?.unread);
    r = await op('unread');
    l = await op('list');
    row = l.rows?.find((x: any) => x.phone === PHONE);
    ck('op=unread → 重新算未读（≥1）', r.ok === true && row?.unread >= 1, { r, unread: row?.unread });

    const link = await op('orderlink');
    d = await doc();
    ck('op=orderlink → 带 ref=wa 和这条对话的 token', link.ok === true && link.url === `https://www.incredibowl.my/o?ref=wa&lead=${d.clickToken}` && /^[a-z0-9]{8,32}$/.test(d.clickToken), link);
    await ref.update({ lang: 'en', clickToken: '' });
    const link2 = await op('orderlink');
    d = await doc();
    ck('没有 token 时补一个；英文客户给 /en/o', /^https:\/\/www\.incredibowl\.my\/en\/o\?ref=wa&lead=[a-z0-9]{16}$/.test(link2.url || '') && d.clickToken === link2.token, link2);
    const click = await fetch(BASE + '/api/wa-click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: link2.token }) });
    d = await doc();
    ck('客户点这个链接 → 对话记下点击（/api/wa-click 认得这个 token）', click.status === 200 && d.clickedAtMs > 0 && d.status === 'clicked', { s: d.status, c: d.clickedAtMs });

    // bot 求救：n8n 的 alert 以前只写 waAlerts，现在也在 lead 上留记号
    const alert = await post('/api/n8n/lead', N8N_KEY, { action: 'alert', phone: PHONE, alertMsgId: 'wamid.SMOKEALERT', customerMsg: 'smoke', kind: 'escalate' });
    l = await op('list');
    row = l.rows?.find((x: any) => x.phone === PHONE);
    ck('alert(escalate) → 列表行 sos / needsReply', alert.ok === true && row?.sos === true && row?.needsReply === true && row?.needsWhy === 'sos', { alert, sos: row?.sos, why: row?.needsWhy });
    await db.collection('waAlerts').doc('wamid.SMOKEALERT').delete();
    // 求救之后客户丢了个定位（n8n 会再发一条 kind=pin 的 alert）→ 求救记号不能被盖掉
    await post('/api/n8n/lead', N8N_KEY, { action: 'alert', phone: PHONE, alertMsgId: 'wamid.SMOKEPIN', customerMsg: 'pin', kind: 'pin' });
    await db.collection('waAlerts').doc('wamid.SMOKEPIN').delete();
    l = await op('list');
    ck('之后来一条 kind=pin 的 alert → 求救红标还在', l.rows?.find((x: any) => x.phone === PHONE)?.needsWhy === 'sos', l.rows?.find((x: any) => x.phone === PHONE)?.needsWhy);
    await post('/api/n8n/lead', N8N_KEY, { action: 'reply', phone: PHONE, role: 'boss', text: '老板从手机回了' });
    l = await op('list');
    row = l.rows?.find((x: any) => x.phone === PHONE);
    ck('老板回过之后求救标记清掉', row?.sos === false && row?.needsReply === false, { sos: row?.sos, why: row?.needsWhy });

    // 人工接管中 + 客户说了最后一句 → 待回复
    await op('human');
    const cur = await doc();
    const ts = Date.now();
    await ref.update({ lastInboundAtMs: ts, turns: [...cur.turns, { role: 'in', text: '在吗', ts }] });
    l = await op('list');
    row = l.rows?.find((x: any) => x.phone === PHONE);
    ck('人工接管中客户说了最后一句 → needsWhy=human', row?.needsWhy === 'human', row?.needsWhy);
    await op('release');

    // 已关闭之后客户发来图片（不经过 touch，库里 status 不会变）→ 列表和线程都显示为进行中
    await op('close');
    const c2 = await doc();
    const ts2 = Date.now() + 5;
    await ref.update({ lastInboundAtMs: ts2, turns: [...c2.turns, { role: 'in', text: '[图片]', ts: ts2, media: { kind: 'image', id: '123456789' } }] });
    l = await op('list');
    row = l.rows?.find((x: any) => x.phone === PHONE);
    const g2 = await op('get');
    ck('关闭后客户发图：库里仍 closed，列表 / 线程显示 engaged，且进「待回复」', (await doc()).status === 'closed' && row?.status === 'engaged' && g2.status === 'engaged' && row?.needsWhy === 'media', { db: (await doc()).status, row: row?.status, get: g2.status, why: row?.needsWhy });
    await op('reopen');

    // 上传发图：本机没有 WA token，验到「参数校验 + 不会把文件当链接发」为止
    const up = await post('/api/admin/wa-lead', signIn.idToken, { op: 'send', phone: PHONE, text: '', media: { kind: 'image', data: 'aGVsbG8=', mime: 'image/jpeg', filename: 'a.jpg' } });
    ck('send(上传)：没配 token → 明确告知未配置，不报 500', up.http === 200 && up.ok === false && up.configured === false, up);
  }

  console.log('\n=== 10. 接管时长（第 3 批）===');
  {
    const t0 = Date.now();
    let h = await post('/api/admin/wa-lead', signIn.idToken, { op: 'human', phone: PHONE, minutes: 1000 });
    ck('接管 1000 分钟（上午点「接管到明早 9 点」）→ 不再被截到 12 小时', Math.abs(h.humanUntil - (t0 + 1000 * 60000)) < 15000, h.humanUntil - t0);
    ck('系统行写成「约 17 小时」而不是 1000 分钟', /约 17 小时/.test((await doc()).turns.at(-1)?.text || ''), (await doc()).turns.at(-1)?.text);
    h = await post('/api/admin/wa-lead', signIn.idToken, { op: 'human', phone: PHONE, minutes: 5000 });
    ck('上限 24 小时', Math.abs(h.humanUntil - (Date.now() + 1440 * 60000)) < 15000, h.humanUntil - Date.now());
    await op('release');
  }

  console.log('\n=== 6. 护栏 ===');
  r = await op('ordered', GHOST);
  ck('没有对话记录的号码 → 404，不建档', r.http === 404 && !(await db.collection('waLeads').doc(GHOST).get()).exists, r);
  r = await post('/api/admin/wa-lead', 'not-a-token', { op: 'ordered', phone: PHONE });
  ck('没登录 → 403', r.http === 403, r.http);
} finally {
  await ref.delete();
  await db.collection('waLeads').doc(GHOST).delete();
  console.log(`\n清理：waLeads/${PHONE} 已删（残留检查：${(await ref.get()).exists ? '还在！' : '无'}）`);
  console.log(`通过 ${pass} · 失败 ${fail}`);
  await admin.app().delete();
  if (fail) process.exit(1);
}
