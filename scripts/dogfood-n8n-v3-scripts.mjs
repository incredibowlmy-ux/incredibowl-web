/**
 * dogfood-n8n-v3-scripts.mjs —— 把 v3 workflow 里的 Code 节点真的跑起来。
 *
 * 校验脚本只查图结构和语法；这个脚本把 Router / Greeting Builder / Message Gate /
 * Build Nudge 抠进 vm，喂**真实 API 响应 + 真实客户号码**，打印客户实际会收到的每个字。
 * n8n workflow 最容易出的事故不是语法错，是「话术拼出来是空的 / 少一行 / 语言不对」。
 *
 * 跑法：先起本地服务（N8N_API_KEY=xxx npx next start -p 4007），再
 *   node scripts/dogfood-n8n-v3-scripts.mjs http://localhost:4007 xxx
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const BASE = process.argv[2] || 'http://localhost:4007';
const KEY = process.argv[3] || 'dogfood_local_key';
const H = { Authorization: `Bearer ${KEY}` };
const DIR = new URL('../n8n-workflows/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const wf = JSON.parse(readFileSync(DIR + 'bowlmama-v3-main.json', 'utf8'));
const codeOf = n => wf.nodes.find(x => x.name === n).parameters.jsCode;

let pass = 0, fail = 0;
const check = (l, c, d = '') => { c ? (pass++, console.log(`  OK  ${l}`)) : (fail++, console.log(`  XX  ${l}${d ? ' — ' + d : ''}`)); };

/** 造一个 n8n 风格的执行环境。nodes = { 节点名: [{json}] } */
function runNode(code, inputItems, nodes) {
  const wrap = arr => ({ first: () => arr[0], all: () => arr, isEmpty: () => arr.length === 0 });
  const ctx = {
    $input: wrap(inputItems),
    $: name => {
      if (!(name in nodes)) throw new Error(`workflow 引用了未提供的节点 $('${name}')`);
      return wrap(nodes[name]);
    },
    $getWorkflowStaticData: () => ({}),
    $env: {},
    console, JSON, Date, Number, String, Object, Array, Math, RegExp, Boolean, isNaN, parseInt, parseFloat,
  };
  return vm.runInNewContext(`(function(){${code}})()`, ctx, { timeout: 5000 });
}

const waMsg = (from, text, extra = {}) => ({
  json: { body: { entry: [{ changes: [{ value: {
    contacts: [{ profile: { name: extra.profileName || 'Test User' } }],
    messages: [{ id: 'wamid.' + Math.random().toString(36).slice(2), from, type: 'text', text: { body: text } }],
  } }] }] } },
});

const api = async p => (await fetch(BASE + p, { headers: H })).json();

console.log('拉真实 API 数据…');
const menu = await api('/api/n8n/menu');
const custNew = await api('/api/n8n/customer?phone=60999888777');
const custOld = await api('/api/n8n/customer?phone=60125230066');
console.log(`  菜单 ${menu.delivery_label} | 老客 ${custOld.profile && custOld.profile.name} | 复购 ${(custOld.reorder && custOld.reorder.summary) || '(无)'}\n`);

// ── 1. Router ────────────────────────────────────────
console.log('=== 1. Router 分类 ===');
const routerCases = [
  ['hi, what do you have today?', 'en', 'retail'],
  ['你好，今天有什么菜', 'zh', 'retail'],
  ['我要订 30 份公司午餐', 'zh', 'catering'],
  ['do you do catering for 25 pax?', 'en', 'catering'],
  ['Hi 请问 delivery 到 Pearl Suria 吗', 'zh', 'retail'],
  ['need 40 packs for office meeting', 'en', 'catering'],
  ['多少钱', 'zh', 'retail'],
];
for (const [text, lang, intent] of routerCases) {
  const [out] = runNode(codeOf('Router'), [waMsg('60111222333', text)], {});
  check(`「${text}」 -> ${out.json.lang}/${out.json.intent}`,
    out.json.lang === lang && out.json.intent === intent, `期望 ${lang}/${intent}`);
}
{
  const [out] = runNode(codeOf('Router'), [waMsg('60165014501', '随手一条')], {});
  check('老板直发 -> boss_direct（不误回「只能处理文字」）', out.json.route === 'boss_direct');
}

// ── 2. Greeting Builder ──────────────────────────────
console.log('\n=== 2. 首触话术（客户真实会收到的字）===');
const lead = { clickToken: 'abc123token', phone: '60111222333' };
function greet(text, cust, menuJson = menu) {
  const [r] = runNode(codeOf('Router'), [waMsg('60111222333', text)], {});
  const [g] = runNode(codeOf('Greeting Builder'), [{ json: {} }], {
    Router: [r],
    'Lead Touch': [{ json: { lead } }],
    'Get Menu Greet': [{ json: menuJson }],
    'Get Customer Greet': [{ json: cust }],
  });
  return g.json;
}

const gNew = greet('hi 今天有什么', custNew);
console.log('\n--- 新客（中文）---\n' + gNew.reply + '\n');
check('新客剧本 kind=new', gNew.kind === 'new');
check('  含 RM5 钩子', gNew.reply.includes('RM5'));
check('  含下单链接 + lead token', gNew.reply.includes('/o?ref=wa&lead=abc123token'));
check('  含真实菜名（不是编的）', menu.dishes.some(d => gNew.reply.includes(d.name)));
// 配送情境是**情境化**的：周末说「下单后周一送达」，工作日过了 6 点说「已过截单」。
// 断言它就是 API 那一句，而不是死等「6 点」两个字 —— 周末提 6 点截单反而误导客户。
check('  含配送情境（与 API 同源，非硬编码）', gNew.reply.includes(menu.delivery_context));

const gNewEn = greet('hi what do you have', custNew);
console.log('--- 新客（英文）---\n' + gNewEn.reply + '\n');
check('英文客户收到英文', /Welcome to BowlMama/.test(gNewEn.reply));
check('  英文链接走 /en/o', gNewEn.reply.includes('/en/o?ref=wa'));
check('  英文版不混中文', !/[一-鿿]/.test(gNewEn.reply));
check('  英文配送情境与中文同源同语义（周末不会只说 6am cutoff）',
  gNewEn.reply.includes(menu.delivery_context_en));

const gOld = greet('今天有什么', custOld);
console.log('--- 老客（真实客户）---\n' + gOld.reply + '\n');
check('老客剧本 kind=returning', gOld.kind === 'returning');
check('  叫得出名字', custOld.profile && gOld.reply.includes(custOld.profile.name));
check('  含上次点的菜', custOld.reorder && gOld.reply.includes(custOld.reorder.summary));
check('  含预填复购链接', gOld.reply.includes('items='));

const gCat = greet('我要订 30 份公司午餐', custNew);
console.log('--- 团餐 ---\n' + gCat.reply + '\n');
check('团餐剧本 kind=catering', gCat.kind === 'catering');
check('  说清不是 buffet', gCat.reply.includes('buffet'));
check('  说清附餐具', gCat.reply.includes('餐具'));
check('  说清 ±15 分钟准点', gCat.reply.includes('15'));
check('  说清可开公司收据', gCat.reply.includes('收据'));
check('  只问 3 样', gCat.reply.includes('①') && gCat.reply.includes('③'));
check('  绝不主动提素食/清真（老板要求）', !/素食|清真|halal/i.test(gCat.reply));

const gCatEn = greet('do you do catering for 25 pax?', custNew);
check('英文团餐走英文剧本', gCatEn.kind === 'catering' && /bento-style/.test(gCatEn.reply));

const gDown = greet('你好', custNew, { error: 'boom' });
check('菜单 API 挂了 -> 不编菜名，走安抚 + 求救', gDown.kind === 'menu_down' && gDown.escalate === true);
check('  兜底文案里没有任何菜名', !menu.dishes.some(d => gDown.reply.includes(d.name)));

// ── 3. Message Gate ──────────────────────────────────
console.log('\n=== 3. 防抖闸门（只回一条 + 看到全部内容）===');
const [rGate] = runNode(codeOf('Router'), [waMsg('60111222333', '送 Pearl Suria')], {});
const nodesGate = { 'Lead Touch': [{ json: { lead: { lastMsgMs: 1000 } } }], Router: [rGate] };

const drop = runNode(codeOf('Message Gate'), [{ json: { isLatest: false } }], nodesGate);
check('客户连发时，不是最后一条 -> 静默退出（客户只会收到一条回复）', drop.length === 0);

const merged = runNode(codeOf('Message Gate'),
  [{ json: { isLatest: true, mergedText: '我要订两份\n送 Pearl Suria' } }], nodesGate);
check('胜出的那条拿到**合并后**的全文（v2 的关键行为，不能丢）',
  merged.length === 1 && merged[0].json.text === '我要订两份\n送 Pearl Suria', merged[0] && merged[0].json.text);
check('  并标记 merged=true', merged[0].json.merged === true);

const solo = runNode(codeOf('Message Gate'), [{ json: { isLatest: true, mergedText: '' } }], nodesGate);
check('只有一条消息时 -> 就用它自己', solo.length === 1 && solo[0].json.text === '送 Pearl Suria');

const readFail = runNode(codeOf('Message Gate'), [{ json: {} }], nodesGate);
check('lead 端点挂了 -> 放行并按自己这条处理（宁可多回，绝不吃掉客户消息）',
  readFail.length === 1 && readFail[0].json.text === '送 Pearl Suria');

// ── 3b. Context Builder：新喂的资料真的进得了 prompt 吗 ──
console.log('\n=== 3b. Context Builder（自取/回复时间/包伙食/成分/覆盖区域）===');
function buildContext(menuJson = menu, custJson = custNew, lang = 'zh') {
  const [c] = runNode(codeOf('Context Builder'), [{ json: {} }], {
    'Get Live Menu': [{ json: menuJson }],
    'Get Promo': [{ json: { active: false } }],
    'Get Dishes': [{ json: { dish_id: 'natto', name_zh: '纳豆月见海苔饭', price: 16.9, active: true } }],
    'Get Customer': [{ json: custJson }],
    'Message Gate': [{ json: { phone: '60111', text: '有猪肉吗', lang, intent: 'retail' } }],
    'Lead Touch': [{ json: { lead: { clickToken: 'tk' } } }],
  });
  return c.json;
}
const ctx = buildContext();
check('覆盖区域进了上下文', ctx.coverage_text === menu.coverage_text, ctx.coverage_text);
check('  含 OUG / Taman Desa（之前 bot 答不了「送 OUG 吗」）',
  /OUG/.test(ctx.coverage_text) && /Taman Desa/.test(ctx.coverage_text));
check('逐道菜成分进了上下文', /纳豆月见海苔饭：/.test(ctx.ingredients_block));
check('  真实成分不是编的', ctx.ingredients_block.includes('温泉蛋'));
check('成分边界说明跟着数据走', /过敏/.test(ctx.ingredients_note) && /求救老板/.test(ctx.ingredients_note));
check('包伙食三档全在', /5 张 RM92.50/.test(ctx.package_block)
  && /10 张 RM180.00/.test(ctx.package_block) && /20 张 RM350.00/.test(ctx.package_block));
check('  折扣是现算的「最高省 X%」而不是写死',
  ctx.package_block.includes(`最高省 ${menu.meal_packages.max_save_percent}%`), ctx.package_block.split('\n')[0]);
check('  有效期 30/30/60 天都说清楚',
  /5 张[^\n]*30 天/.test(ctx.package_block) && /20 张[^\n]*60 天/.test(ctx.package_block));
check('买券链接（中文）', ctx.package_url === menu.meal_packages.buy_url);
check('英文客户拿到英文买券链接',
  buildContext(menu, custNew, 'en').package_url === menu.meal_packages.buy_url_en);

// 菜单 API 挂掉时，绝不让 AI 凭菜名猜成分 / 编包伙食价格
const ctxDown = buildContext({ error: 'boom' });
check('菜单挂了 -> 成分块变成「求救老板」而不是空/瞎猜', /求救老板/.test(ctxDown.ingredients_block));
check('菜单挂了 -> 包伙食块也求救，不报任何价格',
  /求救老板/.test(ctxDown.package_block) && !/RM/.test(ctxDown.package_block), ctxDown.package_block);

// prompt 本身有没有把这些字段用上
const prompt = wf.nodes.find(n => n.name === 'AI Agent').parameters.options.systemMessage;
for (const f of ['coverage_text', 'ingredients_block', 'ingredients_note', 'package_block', 'package_url']) {
  check(`prompt 引用了 ${f}`, prompt.includes(`$json.${f}`));
}
check('prompt 写了自取 Pearl Suria 大堂 + RM2', /Pearl Suria Residence/.test(prompt) && /RM2/.test(prompt));
check('  并明确「自取不要发下单链接」（网站会照收运费）',
  /不要发下单链接/.test(prompt));
check('prompt 写了人工回复时间 8am-8pm', /早上 8 点 – 晚上 8 点/.test(prompt));
check('prompt 写死了餐券与折扣码互斥（否则客户结账被拒）',
  /不能再叠 RM 折扣码/.test(prompt));
check('prompt 写死了过敏必须求救', /一提「\*\*过敏\*\*」|过敏[^\n]*求救老板/.test(prompt));

// ── 4. 追单文案 ──────────────────────────────────────
console.log('\n=== 4. 追单文案 ===');
const fu = JSON.parse(readFileSync(DIR + 'bowlmama-v3-followup.json', 'utf8'));
const nudgeCode = fu.nodes.find(n => n.name === 'Build Nudge').parameters.jsCode;
const nudges = runNode(nudgeCode, [{ json: { leads: [
  { phone: '60111', lang: 'zh', intent: 'retail', clickToken: 'tk1', nudgeIndex: 1 },
  { phone: '60112', lang: 'zh', intent: 'retail', clickToken: 'tk2', nudgeIndex: 2 },
  { phone: '60113', lang: 'en', intent: 'retail', clickToken: 'tk3', nudgeIndex: 1 },
  { phone: '60114', lang: 'zh', intent: 'catering', clickToken: 'tk4', nudgeIndex: 1 },
] } }], {});
check('4 条 lead -> 4 条追单', nudges.length === 4);
nudges.forEach(n => console.log(`\n  [${n.json.intent}/${n.json.lang} 第${n.json.nudgeIndex}次]\n  ${n.json.text.replace(/\n/g, '\n  ')}`));
check('\n两次追单文案不一样（同一句发两遍=骚扰）', nudges[0].json.text !== nudges[1].json.text);
check('第一次带链接', nudges[0].json.text.includes('/o?ref=wa&lead=tk1'));
check('英文 lead 收英文', !/[一-鿿]/.test(nudges[2].json.text));
check('团餐追单不发零售自助链接（团餐要报价不是自助下单）', !nudges[3].json.text.includes('/o?ref=wa'));

console.log(`\n${'─'.repeat(52)}\n通过 ${pass} · 失败 ${fail}`);
process.exit(fail ? 1 : 0);
