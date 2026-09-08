#!/usr/bin/env node
/**
 * wa-setup.mjs —— 碗妈 WhatsApp 号的「门面」设置：看状态 / 冰破问句 + 指令 / 商家资料。
 *
 * 为什么是脚本而不是我直接跑：这些 POST 会改生产状态，Claude Code 的权限层一律拦，
 * 口头授权无效。老板自己跑，token 只从环境变量进来，不落盘、不打印。
 *
 * 跑法（PowerShell）：
 *   $env:WA_ACCESS_TOKEN='<Meta system-user token>'
 *   node scripts/wa-setup.mjs show                 # 先跑这个：看现状（只读）
 *   node scripts/wa-setup.mjs automation           # dry-run：打印将要写什么
 *   node scripts/wa-setup.mjs automation --apply   # 真写
 *   node scripts/wa-setup.mjs profile              # dry-run
 *   node scripts/wa-setup.mjs profile --apply
 *   跑完： $env:WA_ACCESS_TOKEN=''
 *
 * ⚠️ 冰破问句（prompts）只在客户**第一次**打开对话时显示；已经聊过的老客户看不到，
 *    这是 Meta 的行为，不是没生效。指令（commands）是客户输入 / 时的自动补全，
 *    发出来就是普通文字（如 "/menu"），所以 n8n 的提示词要认得它们。
 */

const GRAPH = 'https://graph.facebook.com/v20.0';
const PHONE_ID = process.env.WA_PHONE_NUMBER_ID || '1019276584602589';
const TOKEN = process.env.WA_ACCESS_TOKEN;

const cmd = (process.argv[2] || '').toLowerCase();
const APPLY = process.argv.includes('--apply');

if (!TOKEN) {
  console.error('❌ 没有 WA_ACCESS_TOKEN。先跑：$env:WA_ACCESS_TOKEN=\'<token>\'');
  process.exit(1);
}

// ──────────────────────────────────────────────────────────────
// 老板可以改的文案（改完重跑 --apply）
// ──────────────────────────────────────────────────────────────

/** 冰破问句：客户首次打开对话看到的气泡，点一下就当文字发出来。最多 4 条，每条 ≤80 字。 */
const PROMPTS = [
  '今天有什么菜？',
  '送到我这里多少运费？',
  '我要下单 🛒',
  "What's on the menu today?",
];

/** 指令：客户打 / 时的自动补全。command_name 不带斜杠，≤32 字。 */
const COMMANDS = [
  { command_name: 'menu', command_description: '看今天 / 本周菜单' },
  { command_name: 'order', command_description: '拿下单链接，30 秒搞定' },
  { command_name: 'fee', command_description: '查你那边的运费和免运门槛' },
  { command_name: 'human', command_description: '找碗妈真人聊' },
];

/** 商家资料。地址是厨房位置（Pearl Suria，不是 Pearl Point）。 */
const PROFILE = {
  messaging_product: 'whatsapp',
  about: '家的味道 · 新鲜采购 · 每日精选 🍲',
  address: 'Pearl Suria, Old Klang Road, Kuala Lumpur',
  description: '每天早上现煮的住家菜，无味精、少油少盐。Pearl Point 一带配送，早上 6 点前下单当天送达。',
  email: 'incredibowl.my@gmail.com',
  websites: ['https://www.incredibowl.my'],
  vertical: 'RESTAURANT',
};

// ──────────────────────────────────────────────────────────────

async function get(path, fields) {
  const url = `${GRAPH}/${path}${fields ? `?fields=${encodeURIComponent(fields)}` : ''}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(`${res.status} ${j?.error?.message || 'unknown'}`);
  return j;
}

async function post(path, body, form = false) {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json',
    },
    body: form ? new URLSearchParams(body).toString() : JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(`${res.status} ${j?.error?.message || 'unknown'}${j?.error?.error_user_msg ? ' — ' + j.error.error_user_msg : ''}`);
  return j;
}

async function show() {
  console.log('\n═══ 号码状态 ═══');
  try {
    const n = await get(PHONE_ID, 'display_phone_number,verified_name,quality_rating,messaging_limit_tier,name_status,code_verification_status,platform_type');
    console.log(`  号码        ${n.display_phone_number}`);
    console.log(`  显示名      ${n.verified_name}（${n.name_status}）`);
    console.log(`  质量评级    ${n.quality_rating}`);
    console.log(`  发送上限    ${n.messaging_limit_tier}   ← Phase B 群发看这个（TIER_250 = 每 24h 最多 250 个新客户）`);
    console.log(`  平台        ${n.platform_type || '—'}`);
  } catch (e) { console.log('  ❌ 读不到号码信息：' + e.message); }

  console.log('\n═══ 会话组件（冰破 / 指令）═══');
  try {
    // 读是号码上的一个**字段**（?fields=conversational_automation），写才是 edge。
    // 当成 edge 读会回 400 (#100) Tried accessing nonexisting field —— 2026-09-09 实测。
    const a = await get(PHONE_ID, 'conversational_automation');
    const d = a.conversational_automation || {};
    console.log(`  欢迎消息    ${d.enable_welcome_message ? '开' : '关'}`);
    console.log(`  冰破问句    ${(d.prompts || []).length ? JSON.stringify(d.prompts) : '（无）'}`);
    console.log(`  指令        ${(d.commands || []).map(c => '/' + c.command_name).join(' ') || '（无）'}`);
  } catch (e) { console.log('  ❌ 读不到会话组件：' + e.message); }

  console.log('\n═══ 商家资料 ═══');
  try {
    const p = await get(`${PHONE_ID}/whatsapp_business_profile`, 'about,address,description,email,websites,vertical,profile_picture_url');
    const d = (p.data && p.data[0]) || p;
    for (const k of ['about', 'address', 'description', 'email', 'websites', 'vertical']) {
      console.log(`  ${k.padEnd(12)}${Array.isArray(d[k]) ? d[k].join(', ') : (d[k] || '（空）')}`);
    }
    console.log(`  头像        ${d.profile_picture_url ? '已设' : '（空）'}`);
  } catch (e) { console.log('  ❌ 读不到商家资料：' + e.message); }
  console.log('');
}

async function automation() {
  console.log('\n将要写入会话组件：');
  console.log('  欢迎消息  开');
  console.log('  冰破问句  ' + PROMPTS.map(p => `「${p}」`).join(' '));
  console.log('  指令      ' + COMMANDS.map(c => `/${c.command_name}（${c.command_description}）`).join('  '));
  console.log('\n⚠️ 冰破问句只对**第一次**打开对话的新客户显示，老客户看不到是正常的。');
  console.log('⚠️ 指令发出来是普通文字（/menu），n8n 提示词要认得 —— 见 tasks/todo-wa-api-features.md A6。');
  if (!APPLY) { console.log('\n（dry-run。确认无误后加 --apply 真写）\n'); return; }
  // Meta 这个端点吃 form-encoded，数组要 JSON 字符串
  const r = await post(`${PHONE_ID}/conversational_automation`, {
    enable_welcome_message: 'true',
    prompts: JSON.stringify(PROMPTS),
    commands: JSON.stringify(COMMANDS),
  }, true);
  console.log('\n✅ 已写入：' + JSON.stringify(r));
  console.log('再跑 `node scripts/wa-setup.mjs show` 复核。\n');
}

async function profile() {
  console.log('\n将要写入商家资料：');
  for (const [k, v] of Object.entries(PROFILE)) {
    if (k === 'messaging_product') continue;
    console.log(`  ${k.padEnd(12)}${Array.isArray(v) ? v.join(', ') : v}`);
  }
  console.log('\n（头像不在这里改 —— 要 resumable upload，老板在手机上换一次更快。）');
  if (!APPLY) { console.log('\n（dry-run。确认无误后加 --apply 真写）\n'); return; }
  const r = await post(`${PHONE_ID}/whatsapp_business_profile`, PROFILE);
  console.log('\n✅ 已写入：' + JSON.stringify(r));
  console.log('再跑 `node scripts/wa-setup.mjs show` 复核。\n');
}

const table = { show, automation, profile };
if (!table[cmd]) {
  console.log('用法：node scripts/wa-setup.mjs <show|automation|profile> [--apply]');
  console.log('  show        只读，打印号码状态 / 会话组件 / 商家资料');
  console.log('  automation  写冰破问句 + 指令');
  console.log('  profile     写商家资料（简介 / 地址 / 网站）');
  process.exit(1);
}
table[cmd]().catch(e => { console.error('❌ ' + e.message); process.exit(1); });
