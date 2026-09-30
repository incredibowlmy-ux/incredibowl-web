/**
 * 收件箱「已成交 / 已关闭」端到端 smoke —— 打本地 next start（读写的是真 Firestore）。
 * 只用一个合成号码 60000000021，跑完删掉。
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
const PHONE = '60000000021';
const GHOST = '60000000022';   // 从不建文档的号码

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
  ck('算新一轮：回到 engaged', t.newSession === true && d.status === 'engaged', { n: t.newSession, s: d.status });
  ck('追单恢复排程', Number(d.nextNudgeMs) > 0, d.nextNudgeMs);

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
