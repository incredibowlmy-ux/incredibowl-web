/**
 * dogfood-n8n-v4-scripts.mjs —— 把 v4 workflow 里的 Code 节点真的跑起来。
 *
 * 校验脚本只查图结构和语法；这个脚本把 Router / Greeting Builder / Message Gate /
 * Context Builder / Parse Boss Intent / Boss Cmd Build+Reply / Build Nudge 抠进 vm，
 * 喂**真实 API 响应 + 真实客户号码**，打印客户实际会收到的每个字。
 * v4 新增覆盖：relay 标记（human / throttled）、按钮回复、老板指令、[bot] 释放、
 * 最近对话 / 付款方式 / 人工刚结束 三块是否真的进了提示词。
 *
 * 跑法：先起本地服务（N8N_API_KEY=xxx npx next start -p 4007），再
 *   node scripts/dogfood-n8n-v4-scripts.mjs http://localhost:4007 xxx
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const BASE = process.argv[2] || 'http://localhost:4007';
const KEY = process.argv[3] || 'dogfood_local_key';
const H = { Authorization: `Bearer ${KEY}` };
const DIR = new URL('../n8n-workflows/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const wf = JSON.parse(readFileSync(DIR + 'bowlmama-v4-main.json', 'utf8'));
const wff = JSON.parse(readFileSync(DIR + 'bowlmama-v4-followup.json', 'utf8'));
const codeOf = (n, w = wf) => w.nodes.find(x => x.name === n).parameters.jsCode;

let pass = 0, fail = 0;
const check = (l, c, d = '') => { c ? (pass++, console.log(`  OK  ${l}`)) : (fail++, console.log(`  XX  ${l}${d ? ' — ' + d : ''}`)); };

/** 造一个 n8n 风格的执行环境。nodes = { 节点名: [{json}] } */
function runNode(code, inputItems, nodes) {
  const wrap = arr => ({ first: () => arr[0], all: () => arr, isEmpty: () => arr.length === 0, item: arr[0] });
  const ctx = {
    $input: wrap(inputItems),
    $: name => {
      if (!(name in nodes)) throw new Error(`workflow 引用了未提供的节点 $('${name}')`);
      return wrap(nodes[name]);
    },
    $getWorkflowStaticData: () => ({}),
    $env: {},
    console, JSON, Date, Number, String, Object, Array, Math, RegExp, Boolean, isNaN, parseInt, parseFloat, encodeURIComponent,
  };
  return vm.runInNewContext(`(function(){${code}})()`, ctx, { timeout: 5000 });
}

/** relay 转发后的单条 payload（带 incredibowl 标记）。 */
const waMsg = (from, text, extra = {}) => ({
  json: { body: { entry: [{ changes: [{ value: {
    contacts: [{ wa_id: from, profile: { name: extra.profileName || 'Test User' } }],
    messages: [extra.message || { id: 'wamid.' + Math.random().toString(36).slice(2), from, type: 'text', text: { body: text }, ...(extra.context ? { context: extra.context } : {}) }],
    incredibowl: { relay: 'v4', human: !!extra.human, humanUntil: extra.humanUntil || 0, throttled: !!extra.throttled, humanEndedRecently: !!extra.humanEndedRecently },
  } }] }] } },
});
const btnMsg = (from, id, title) => waMsg(from, '', { message: { id: 'wamid.b', from, type: 'interactive', interactive: { type: 'button_reply', button_reply: { id, title } } } });

const api = async p => (await fetch(BASE + p, { headers: H })).json();

console.log('拉真实 API 数据…');
const menu = await api('/api/n8n/menu');
const custNew = await api('/api/n8n/customer?phone=60999888777');
const custOld = await api('/api/n8n/customer?phone=60125230066');
console.log(`  菜单 ${menu.delivery_label} | 老客 ${custOld.profile && custOld.profile.name} | 复购 ${(custOld.reorder && custOld.reorder.summary) || '(无)'}\n`);
check('菜单 API 带付款方式（v4 新字段）', typeof menu.payment_text === 'string' && /DuitNow/.test(menu.payment_text) && /COD/.test(menu.payment_text));
check('客户 API 带 recentTurnsBlock（v4 新字段）', typeof custNew.recentTurnsBlock === 'string' && custNew.recentTurnsBlock.startsWith('【最近对话'));

// ── 1. Router ────────────────────────────────────────
console.log('\n=== 1. Router 分类（v3 回归 + v4 新路由）===');
const R = (text, extra) => runNode(codeOf('Router'), [waMsg('60111222333', text, extra)], {})[0].json;
for (const [text, lang, intent] of [
  ['hi, what do you have today?', 'en', 'retail'],
  ['你好，今天有什么菜', 'zh', 'retail'],
  ['我要订 30 份公司午餐', 'zh', 'catering'],
  ['do you do catering for 25 pax?', 'en', 'catering'],
  ['多少钱', 'zh', 'retail'],
]) {
  const out = R(text);
  check(`「${text}」 -> ${out.lang}/${out.intent}/${out.route}`, out.lang === lang && out.intent === intent && out.route === 'customer_text');
}
check('人工接管中的文字 -> human_forward（不进 AI）', R('在吗', { human: true, humanUntil: 123 }).route === 'human_forward');
check('  humanUntil 透传给 Human Forward 用', R('在吗', { human: true, humanUntil: 123 }).humanUntil === 123);
check('限流标记 -> throttled', R('x', { throttled: true }).route === 'throttled');
check('人工中但发图片 -> 仍走 image（付款截图不能丢）',
  runNode(codeOf('Router'), [waMsg('60111222333', '', { human: true, message: { id: 'i', from: '60111222333', type: 'image', image: { id: 'media1', caption: '转了' } } })], {})[0].json.route === 'image');
{
  const b = runNode(codeOf('Router'), [btnMsg('60111222333', 'btn_order', '直接下单 🛒')], {})[0].json;
  check('按钮回复 -> customer_text，title 当 text', b.route === 'customer_text' && b.text === '直接下单 🛒' && b.buttonId === 'btn_order');
  check('  中文 title -> lang zh', b.lang === 'zh');
  const en = runNode(codeOf('Router'), [btnMsg('60111222333', 'btn_fee', 'Delivery fee 🚗')], {})[0].json;
  check('  英文 title -> lang en', en.lang === 'en');
  const close = runNode(codeOf('Router'), [btnMsg('60111222333', 'lead_close', '先不用了 🙏')], {})[0].json;
  check('「先不用了」按钮 -> lead_close', close.route === 'lead_close');
}
for (const type of ['reaction', 'sticker', 'contacts']) {
  const out = runNode(codeOf('Router'), [waMsg('60111222333', '', { message: { id: 's', from: '60111222333', type, [type]: {} } })], {})[0].json;
  check(`${type} -> ignore（不再回「只能处理文字」）`, out.route === 'ignore');
}
{
  const boss = '60165014501';
  check('老板随手一条 -> boss_direct', runNode(codeOf('Router'), [waMsg(boss, '随手一条')], {})[0].json.route === 'boss_direct');
  const cmd = runNode(codeOf('Router'), [waMsg(boss, '#pause 60123456789 45')], {})[0].json;
  check('老板 #pause 60123456789 45 -> boss_cmd / 45 分钟', cmd.route === 'boss_cmd' && cmd.bossCmd.cmd === 'pause' && cmd.bossCmd.minutes === 45 && cmd.bossCmd.phone === '60123456789');
  const st = runNode(codeOf('Router'), [waMsg(boss, '#status +60 12-345 6789')], {})[0].json;
  check('老板 #status +60 12-345 6789 -> boss_cmd status', st.route === 'boss_cmd' && st.bossCmd.cmd === 'status' && st.bossCmd.phone === '60123456789');
  check('老板 #pause 0123456789（本地格式）-> 不是指令，boss_direct', runNode(codeOf('Router'), [waMsg(boss, '#pause 0123456789')], {})[0].json.route === 'boss_direct');
  const quote = runNode(codeOf('Router'), [waMsg(boss, '可以送', { context: { id: 'wamid.alert1' } })], {})[0].json;
  check('老板引用回复 -> boss_reply，contextId 抓到', quote.route === 'boss_reply' && quote.contextId === 'wamid.alert1');
}

// ── 2. Greeting Builder（v3 回归）─────────────────────
console.log('\n=== 2. 首触话术（客户真实会收到的字）===');
const lead = { clickToken: 'abc123token', phone: '60111222333' };
function greet(text, cust, menuJson = menu) {
  const [r] = runNode(codeOf('Router'), [waMsg('60111222333', text)], {});
  const [g] = runNode(codeOf('Greeting Builder'), [{ json: {} }], {
    Router: [r], 'Lead Touch': [{ json: { lead } }], 'Get Menu Greet': [{ json: menuJson }], 'Get Customer Greet': [{ json: cust }],
  });
  return g.json;
}
const gNew = greet('hi 今天有什么', custNew);
console.log('\n--- 新客（中文）---\n' + gNew.reply + '\n');
check('新客剧本 kind=new，带 lang（按钮节点要用）', gNew.kind === 'new' && gNew.lang === 'zh');
check('  含 RM5 钩子 + lead token 链接', gNew.reply.includes('RM5') && gNew.reply.includes('/o?ref=wa&lead=abc123token'));
check('  含真实菜名', menu.dishes.some(d => gNew.reply.includes(d.name)));
const gOld = greet('今天有什么', custOld);
check('老客剧本 kind=returning，叫得出名字', gOld.kind === 'returning' && custOld.profile && gOld.reply.includes(custOld.profile.name));
const gCat = greet('我要订 30 份公司午餐', custNew);
check('团餐剧本 kind=catering（开场不发按钮）', gCat.kind === 'catering');
const gDown = greet('你好', custNew, { error: 'boom' });
check('菜单 API 挂了 -> menu_down + 求救', gDown.kind === 'menu_down' && gDown.escalate === true);

// ── 3. Message Gate（v3 回归）─────────────────────────
console.log('\n=== 3. 防抖闸门 ===');
const [rGate] = runNode(codeOf('Router'), [waMsg('60111222333', '送 Pearl Suria')], {});
const nodesGate = { 'Lead Touch': [{ json: { lead: { lastMsgMs: 1000 } } }], Router: [rGate] };
check('不是最后一条 -> 静默退出', runNode(codeOf('Message Gate'), [{ json: { isLatest: false } }], nodesGate).length === 0);
const merged = runNode(codeOf('Message Gate'), [{ json: { isLatest: true, mergedText: '我要订两份\n送 Pearl Suria' } }], nodesGate);
check('胜出的那条拿到合并全文', merged.length === 1 && merged[0].json.text === '我要订两份\n送 Pearl Suria');

// ── 4. Context Builder：v4 三块 ──────────────────────
console.log('\n=== 4. Context Builder（最近对话 / 付款方式 / 人工刚结束）===');
function buildContext({ menuJson = menu, custJson = custNew, lang = 'zh', touch = { lead: { clickToken: 'tk' } } } = {}) {
  const [c] = runNode(codeOf('Context Builder'), [{ json: {} }], {
    'Get Live Menu': [{ json: menuJson }],
    'Get Promo': [{ json: { active: false } }],
    'Get Dishes': [{ json: { dish_id: 'natto', name_zh: '纳豆月见海苔饭', price: 16.9, active: true } }],
    'Get Customer': [{ json: custJson }],
    'Message Gate': [{ json: { phone: '60111', text: '可以 TnG 吗', lang, intent: 'retail' } }],
    'Lead Touch': [{ json: touch }],
  });
  return c.json;
}
const ctx = buildContext();
check('最近对话块进了上下文（新客 = 第一次对话）', /【最近对话/.test(ctx.recent_turns) && /第一次对话/.test(ctx.recent_turns));
check('付款方式块（中文）来自 API', ctx.payment_block === menu.payment_text);
check('付款方式块（英文）', buildContext({ lang: 'en' }).payment_block === menu.payment_text_en);
check('人工没刚结束 -> human_note 空', ctx.human_note === '');
check('人工刚结束 -> human_note 提醒别重新自我介绍', /别重新自我介绍/.test(buildContext({ touch: { humanEndedRecently: true, lead: {} } }).human_note));
const withTurns = buildContext({ custJson: { ...custNew, recentTurnsBlock: '【最近对话（服务端记录，可信；越下面越新）】\n[3 分钟前] 客户：当归鸡多少钱\n[2 分钟前] 碗妈：RM 18.9' } });
check('有记录时原样注入', /当归鸡多少钱/.test(withTurns.recent_turns));
const ctxCustDown = buildContext({ custJson: { error: 'boom' } });
check('客户 API 挂了 -> 最近对话块变成「读不到，别假装记得」', /别假装记得/.test(ctxCustDown.recent_turns));
const ctxMenuDown = buildContext({ menuJson: { error: 'boom' } });
check('菜单挂了 -> 付款方式块求救而不是瞎编', /求救老板/.test(ctxMenuDown.payment_block));
check('v3 字段全部还在（覆盖区域 / 成分 / 包伙食）', ctx.coverage_text === menu.coverage_text && /纳豆月见海苔饭：/.test(ctx.ingredients_block) && /RM/.test(ctx.package_block));

// prompt 引用
const prompt = wf.nodes.find(n => n.name === 'AI Agent').parameters.options.systemMessage;
for (const f of ['recent_turns', 'human_note', 'payment_block', 'customer_context', 'coverage_text', 'ingredients_block', 'package_block', 'order_url', 'dish_links']) {
  check(`prompt 引用了 $json.${f}`, prompt.includes(`$json.${f}`));
}
check('prompt 教了 remember_customer_fact 的 6 个 key', /nickname/.test(prompt) && /dropoff/.test(prompt) && /preferredMeal/.test(prompt) && /remember_customer_fact/.test(prompt));
check('prompt 说了「找碗妈」按钮要求救', /找碗妈/.test(prompt) && /求救老板/.test(prompt));
check('prompt 说了跨天记忆：别反问「刚才 / 上次」', /跨天/.test(prompt));
check('已删 Window Buffer Memory', !wf.nodes.some(n => n.name === 'Window Buffer Memory'));
check('remember_customer_fact 挂在 AI Agent 的 ai_tool 上', !!wf.connections['remember_customer_fact']?.ai_tool);
check('Webhook 开了 Header Auth', wf.nodes.find(n => n.name === 'Webhook').parameters.authentication === 'headerAuth');
check('Router 不再用 staticData 去重', !codeOf('Router').includes('getWorkflowStaticData'));
check('Google Sheet 日志节点全部 continueRegularOutput', wf.nodes.filter(n => n.type === 'n8n-nodes-base.googleSheets').every(n => n.onError === 'continueRegularOutput'));

// ── 5. 老板引用回复：Parse Boss Intent（Firestore 反查形状）──
console.log('\n=== 5. 老板引用回复 / 指令 ===');
function parseBoss(bossText, lookup) {
  const [r] = runNode(codeOf('Router'), [waMsg('60165014501', bossText, { context: { id: 'wamid.alert1' } })], {});
  return runNode(codeOf('Parse Boss Intent'), [{ json: {} }], { Router: [r], 'Boss Lookup': [{ json: lookup }] })[0].json;
}
const lookup = { found: true, phone: '60111222333', customerMsg: '可以送 OUG 吗', kind: 'escalate' };
const pb = parseBoss('可以送，运费 RM5', lookup);
check('普通回复 -> 转达，客户号码来自 waAlerts', pb.customerPhone === '60111222333' && pb.customerMsg === '可以送 OUG 吗' && !pb.isConfirm && !pb.releaseBot);
check('回「1」-> isConfirm', parseBoss('1', lookup).isConfirm === true);
const rel = parseBoss('好的可以送 [bot]', lookup);
check('回复带 [bot] -> releaseBot，标记已剥掉', rel.releaseBot === true && !/\[bot\]/.test(rel.bossText) && rel.bossText === '好的可以送');
check('只发 [bot] -> 有默认转达话术', parseBoss('[bot]', lookup).bossText.length > 0);
check('[QR] -> needSendQR', parseBoss('[QR] 麻烦付款', lookup).needSendQR === true);

// Boss Cmd Build + Reply
function bossCmd(text, execResult) {
  const [r] = runNode(codeOf('Router'), [waMsg('60165014501', text)], {});
  const [b] = runNode(codeOf('Boss Cmd Build'), [{ json: {} }], { Router: [r] });
  const [rep] = runNode(codeOf('Boss Cmd Reply'), [{ json: {} }], { 'Boss Cmd Build': [b], 'Boss Cmd Exec': [{ json: execResult }] });
  return { body: b.json.body, text: rep.json.text };
}
const p1 = bossCmd('#pause 60123456789 45', { ok: true, humanUntil: Date.now() + 45 * 60000 });
check('#pause -> body action=human minutes=45', p1.body.action === 'human' && p1.body.minutes === 45 && p1.body.phone === '60123456789');
check('  老板收到静音确认 + 怎么恢复', /已静音/.test(p1.text) && /#resume 60123456789/.test(p1.text));
const p2 = bossCmd('#resume 60123456789', { ok: true, wasHuman: true });
check('#resume -> body action=release；确认恢复', p2.body.action === 'release' && /已恢复/.test(p2.text));
const p3 = bossCmd('#resume 60123456789', { ok: true, wasHuman: false });
check('#resume 本来没接管 -> 如实说', /本来就没在/.test(p3.text));
const p4 = bossCmd('#status 60123456789', { found: true, lead: { name: 'May', status: 'engaged', lang: 'zh', nudgeCount: 1, human: false }, turns: [{ role: 'in', text: '在吗' }, { role: 'out', text: '在的 ❤️' }] });
check('#status -> 档案 + 最近对话摘要', /May/.test(p4.text) && /追单 1 次/.test(p4.text) && /客：在吗/.test(p4.text) && /碗：在的/.test(p4.text));
console.log('\n--- #status 老板看到的 ---\n' + p4.text + '\n');
const p5 = bossCmd('#status 60123456789', { found: false });
check('#status 没记录 -> 如实说', /没有任何记录/.test(p5.text));

// ── 6. 追单文案（60 分钟）──────────────────────────
console.log('\n=== 6. 追单文案 ===');
const nudges = runNode(codeOf('Build Nudge', wff), [{ json: { leads: [
  { phone: '60111', lang: 'zh', intent: 'retail', nudgeIndex: 1, clickToken: 'tk' },
  { phone: '60112', lang: 'en', intent: 'retail', nudgeIndex: 1, clickToken: 'tk' },
  { phone: '60113', lang: 'zh', intent: 'retail', nudgeIndex: 2, clickToken: 'tk' },
  { phone: '60114', lang: 'zh', intent: 'catering', nudgeIndex: 1, clickToken: 'tk' },
] } }], {});
console.log(nudges.map(n => `[${n.json.lang}/${n.json.intent}/#${n.json.nudgeIndex}] ${n.json.text}`).join('\n\n') + '\n');
check('第 1 次中文说「一个小时前」（不再是 35 分钟语境）', /一个小时前/.test(nudges[0].json.text));
check('第 1 次英文说 an hour ago', /an hour ago/.test(nudges[1].json.text));
check('第 1 次含链接 + lead token + 「回 1」兜底', /lead=tk/.test(nudges[0].json.text) && /回「1」/.test(nudges[0].json.text));
check('第 2 次文案与第 1 次不同', nudges[2].json.text !== nudges[0].json.text && /21|今晚|明天/.test(nudges[2].json.text));
check('团餐追单不发链接', !/incredibowl\.my\/o/.test(nudges[3].json.text));
check('追单 workflow 有记 turn + 第 1 次按钮节点', wff.nodes.some(n => n.name === 'Log Reply · 追单') && wff.nodes.some(n => n.name === 'Send Nudge Buttons'));

console.log(`\n${'─'.repeat(52)}`);
console.log(`通过 ${pass} · 失败 ${fail}`);
process.exit(fail ? 1 : 0);
