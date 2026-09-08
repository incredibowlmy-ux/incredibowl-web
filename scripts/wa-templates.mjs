#!/usr/bin/env node
/**
 * wa-templates.mjs —— WhatsApp 模板消息：找 WABA、看清单、提交审核、删除。
 *
 * 模板是**唯一**能突破 24 小时窗口的东西：客户超过 24 小时没说话，自由文本一律被
 * Meta 拒（131047），只有过审的模板发得出去。每周菜单群发、订单确认、把过期对话
 * 重新拉活，全都卡在这一步，而审核要排队，所以要早提交。
 *
 * 跑法（PowerShell）：
 *   $env:WA_ACCESS_TOKEN='<Meta system-user token>'
 *   node scripts/wa-templates.mjs waba            # 第一步：找出 WABA id
 *   $env:WA_WABA_ID='<上一步的 id>'
 *   node scripts/wa-templates.mjs list            # 看现有模板和审核状态
 *   node scripts/wa-templates.mjs submit weekly_menu_v1          # dry-run，打印将提交什么
 *   node scripts/wa-templates.mjs submit weekly_menu_v1 --apply  # 真提交
 *   node scripts/wa-templates.mjs submit all --apply             # 一次交全部
 *   跑完： $env:WA_ACCESS_TOKEN=''
 *
 * 拿到 WABA id 后加进 Vercel（收件箱要用它列已过审模板）：
 *   npx vercel env add WA_WABA_ID production
 *
 * 审核结果会自动推到 Telegram（relay 已接 message_template_status_update 事件）。
 *
 * ⚠️ Meta 常见拒审原因：变量占比过高（正文几乎全是 {{n}}）、UTILITY 里写促销、
 *    example 值缺失或和正文对不上。被拒不要改名重交，先看 rejected_reason。
 */

const GRAPH = 'https://graph.facebook.com/v20.0';
const TOKEN = process.env.WA_ACCESS_TOKEN;
/** Meta business：Incredibowl_MY（memory: project_meta_catalogue_feed）。 */
const BUSINESS_ID = process.env.WA_BUSINESS_ID || '4383381675320005';
/** 正式 WABA（2026-09-09 从 App → API Setup 确认；沙盒是 1092790916611496，别搞混）。 */
const WABA_ID = process.env.WA_WABA_ID || '2664648817254746';

const cmd = (process.argv[2] || '').toLowerCase();
const arg = process.argv[3] || '';
const APPLY = process.argv.includes('--apply');

if (!TOKEN) {
  console.error('❌ 没有 WA_ACCESS_TOKEN。先跑：$env:WA_ACCESS_TOKEN=\'<token>\'');
  process.exit(1);
}

// ──────────────────────────────────────────────────────────────
// 三个模板（老板先读一遍文案再提交）
//
// {{1}} 之类是变量，发送时按顺序填。example 是给审核员看的样例，必填。
// ──────────────────────────────────────────────────────────────
const TEMPLATES = {
  /** 每周菜单群发。MARKETING = 会按条计费，且客户能退订。 */
  weekly_menu_v1: {
    name: 'weekly_menu_v1',
    language: 'en',
    category: 'MARKETING',
    components: [
      {
        type: 'BODY',
        text: "Hi {{1}} 😊 wei ting from Incredibowl here. Next week's menu ({{2}}) is ready — {{3}}. Freshly cooked every morning, no MSG, less oil & salt. Order before 6:00 AM for same-day delivery. Reply STOP anytime to unsubscribe.",
        example: { body_text: [['Ebby', '15 Sep – 19 Sep', 'new this week: Honey Lemon Chicken Chop & Lemon Salmon']] },
      },
      {
        type: 'BUTTONS',
        buttons: [{ type: 'URL', text: 'See menu & order', url: 'https://www.incredibowl.my/o?src=wa_weekly' }],
      },
    ],
  },

  /** 订单确认（中文）。UTILITY = 交易类，便宜且不受营销限流。 */
  order_confirmed_zh_v1: {
    name: 'order_confirmed_zh_v1',
    language: 'zh_CN',
    category: 'UTILITY',
    components: [{
      type: 'BODY',
      text: '你好 {{1}}，订单 #{{2}} 已收到 ✅ 送达：{{3}}。有问题直接回复这条消息。',
      example: { body_text: [['Ebby', '10BFV7', '9 月 10 日午餐 11:00–13:00']] },
    }],
  },

  order_confirmed_en_v1: {
    name: 'order_confirmed_en_v1',
    language: 'en',
    category: 'UTILITY',
    components: [{
      type: 'BODY',
      text: 'Hi {{1}}, order #{{2}} is confirmed ✅ Delivery: {{3}}. Reply here if anything changes.',
      example: { body_text: [['Ebby', '10BFV7', 'Sep 10, lunch 11:00–13:00']] },
    }],
  },

  /** 窗口过期后把对话重新拉活 —— 收件箱在 24h 外唯一能发的东西。 */
  window_reopen_zh_v1: {
    name: 'window_reopen_zh_v1',
    language: 'zh_CN',
    category: 'UTILITY',
    components: [{
      type: 'BODY',
      text: '你好 {{1}}，碗妈这边有关于你订单／询问的更新，回复任意内容我们继续聊 😊',
      example: { body_text: [['Ebby']] },
    }],
  },

  window_reopen_en_v1: {
    name: 'window_reopen_en_v1',
    language: 'en',
    category: 'UTILITY',
    components: [{
      type: 'BODY',
      text: "Hi {{1}}, BowlMama has an update on your order/enquiry — reply anything and we'll continue 😊",
      example: { body_text: [['Ebby']] },
    }],
  },
};

// ──────────────────────────────────────────────────────────────

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${GRAPH}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) {
    throw new Error(`${res.status} ${j?.error?.message || 'unknown'}${j?.error?.error_user_msg ? ' — ' + j.error.error_user_msg : ''}`);
  }
  return j;
}

function needWaba() {
  if (!WABA_ID) {
    console.error('❌ 没有 WA_WABA_ID。先跑 `node scripts/wa-templates.mjs waba` 拿 id，再：');
    console.error("   $env:WA_WABA_ID='<id>'");
    process.exit(1);
  }
  return WABA_ID;
}

async function waba() {
  console.log(`\n在 business ${BUSINESS_ID} 下找 WhatsApp 账号…\n`);
  let found = false;
  for (const edge of ['owned_whatsapp_business_accounts', 'client_whatsapp_business_accounts']) {
    try {
      const r = await api(`${BUSINESS_ID}/${edge}?fields=id,name,timezone_id,message_template_namespace&limit=25`);
      for (const w of r.data || []) {
        found = true;
        console.log(`  ${edge === 'owned_whatsapp_business_accounts' ? '自有' : '客户'}  id=${w.id}  name=${w.name || '—'}`);
      }
    } catch (e) {
      console.log(`  （${edge} 读不到：${e.message}）`);
    }
  }
  // 第二条路：让 token 自己招供。debug_token 的 granular_scopes 里
  // whatsapp_business_management 的 target_ids 就是这把 token 能管的全部 WABA ——
  // 不需要 business_management 权限。2026-09-09 老板抄到沙盒 WABA 后加的。
  if (!found) {
    console.log('  business 边读不到，改问 token 自己能管哪些 WABA…\n');
    try {
      const d = await api(`debug_token?input_token=${encodeURIComponent(TOKEN)}`);
      const scopes = d.data?.granular_scopes || [];
      const ids = new Set();
      for (const s of scopes) {
        if (/^whatsapp_business/.test(s.scope)) for (const t of s.target_ids || []) ids.add(String(t));
      }
      for (const id of ids) {
        try {
          const w = await api(`${id}?fields=name`);
          const p = await api(`${id}/phone_numbers?fields=display_phone_number,verified_name`);
          const phones = (p.data || []).map(x => x.display_phone_number).join('、') || '（无号码）';
          const isTest = /test/i.test(w.name || '') || /^\+1 555/.test(phones);
          console.log(`  ${isTest ? '🧪 沙盒' : '✅ 正式'}  id=${id}  name=${w.name || '—'}  号码：${phones}`);
          if (!isTest) found = true;
        } catch (e) {
          console.log(`  ?  id=${id}（读不到：${e.message}）`);
        }
      }
      if (!ids.size) {
        const waScopes = scopes.filter(s => /^whatsapp_business/.test(s.scope)).map(s => s.scope);
        console.log(waScopes.length
          ? `  token 有 ${waScopes.join(' / ')}，但 Meta 没列 target_ids —— 通常表示不限资产（全部能管），API 列不出清单。`
          : '  token 的 granular_scopes 里没有任何 whatsapp_business 权限。');
        console.log('  → 去 Business Settings → 账户 → WhatsApp 账户 抄正式那个的 ID（名字不带 Test）。');
      }
    } catch (e) {
      console.log('  debug_token 也读不到：' + e.message);
    }
  }
  if (!found) {
    console.log('  正式 WABA 没找到。');
    console.log('  ⚠️ 若报 403 (#200) Requires business_management —— 那是**另一个**权限，');
    console.log('     跟 whatsapp_business_management 不是同一个，列 business 下的账号才需要它。');
    console.log('  不用为它重新生成 token，直接去后台抄 id 更快：');
    console.log('     developers.facebook.com → 你的 App（Incredibowl）→ WhatsApp → API Setup');
    console.log('     那页上「WhatsApp Business Account ID」就是，然后：');
    console.log("     $env:WA_WABA_ID='<那个 id>'");
    console.log('     node scripts/wa-templates.mjs list   ← 用它验证 id 对不对');
  } else {
    console.log('\n下一步：');
    console.log("  $env:WA_WABA_ID='<上面的 id>'");
    console.log('  npx vercel env add WA_WABA_ID production   ← 收件箱列模板要用');
  }
  console.log('');
}

/** 这个 id 到底是不是 WABA？打印节点本身的字段：WABA 会有 name / namespace / 审核状态。 */
async function check() {
  const id = needWaba();
  console.log(`\n查 ${id} 是什么东西…\n`);
  try {
    const w = await api(`${id}?fields=id,name,account_review_status,message_template_namespace,timezone_id,owner_business_info`);
    console.log('  ✅ 这是一个 WhatsApp Business Account：');
    console.log(`     name                 ${w.name || '—'}`);
    console.log(`     account_review_status ${w.account_review_status || '—'}`);
    console.log(`     template namespace   ${w.message_template_namespace || '—'}`);
    console.log(`     owner business       ${w.owner_business_info?.name || '—'} (${w.owner_business_info?.id || '—'})`);
  } catch (e) {
    console.log('  ❌ 读不到 WABA 字段：' + e.message);
    console.log('     → 这个 id 很可能不是 WABA。App ID 是 2144351003028721、号码 ID 是 1019276584602589，都不是。');
  }
  try {
    const p = await api(`${id}/phone_numbers?fields=display_phone_number,verified_name`);
    console.log(`  号码列表：${(p.data || []).map(x => `${x.display_phone_number}（${x.verified_name}）`).join('、') || '（空）'}`);
  } catch (e) {
    console.log('  （phone_numbers 读不到：' + e.message + '）');
  }
  console.log('');
}

async function list() {
  const id = needWaba();
  const r = await api(`${id}/message_templates?fields=name,status,category,language,rejected_reason,quality_score&limit=100`);
  const rows = r.data || [];
  console.log(`\n共 ${rows.length} 个模板：\n`);
  for (const t of rows) {
    const mark = t.status === 'APPROVED' ? '✅' : t.status === 'REJECTED' ? '❌' : '⏳';
    console.log(`  ${mark} ${t.name.padEnd(24)} ${String(t.language).padEnd(6)} ${String(t.category).padEnd(10)} ${t.status}${t.rejected_reason && t.rejected_reason !== 'NONE' ? '  原因：' + t.rejected_reason : ''}`);
  }
  console.log('');
}

async function submit() {
  const id = needWaba();
  const names = arg === 'all' ? Object.keys(TEMPLATES) : [arg];
  if (!names.length || !names[0]) {
    console.error('用法：node scripts/wa-templates.mjs submit <模板名|all> [--apply]');
    console.error('可选：' + Object.keys(TEMPLATES).join(' / '));
    process.exit(1);
  }
  for (const n of names) {
    const t = TEMPLATES[n];
    if (!t) { console.error(`❌ 没有这个模板：${n}`); continue; }
    console.log(`\n─── ${t.name}（${t.language} · ${t.category}）───`);
    for (const c of t.components) {
      if (c.type === 'BODY') console.log('  正文：' + c.text);
      if (c.type === 'BUTTONS') console.log('  按钮：' + c.buttons.map(b => `[${b.text}] → ${b.url}`).join('  '));
    }
    if (!APPLY) { console.log('  （dry-run）'); continue; }
    try {
      const r = await api(`${id}/message_templates`, { method: 'POST', body: t });
      console.log(`  ✅ 已提交，id=${r.id} status=${r.status || 'PENDING'}`);
    } catch (e) {
      console.log(`  ❌ 提交失败：${e.message}`);
    }
  }
  if (!APPLY) console.log('\n（确认文案没问题后加 --apply 真提交）');
  console.log('\n审核结果会自动推 Telegram；也可以随时跑 `list` 看。\n');
}

async function del() {
  const id = needWaba();
  if (!arg) { console.error('用法：node scripts/wa-templates.mjs delete <模板名> --apply'); process.exit(1); }
  if (!APPLY) { console.log(`（dry-run）将删除模板 ${arg}。加 --apply 真删。`); return; }
  await api(`${id}/message_templates?name=${encodeURIComponent(arg)}`, { method: 'DELETE' });
  console.log(`✅ 已删除 ${arg}`);
}

const table = { waba, check, list, submit, delete: del };
if (!table[cmd]) {
  console.log('用法：node scripts/wa-templates.mjs <waba|list|submit|delete> [名字] [--apply]');
  console.log('  waba    找出 WABA id（第一步）');
  console.log('  check   确认 WA_WABA_ID 到底是不是 WABA（提交报 400 时先跑这个）');
  console.log('  list    列出所有模板和审核状态');
  console.log('  submit  提交模板审核：' + Object.keys(TEMPLATES).join(' / ') + ' / all');
  console.log('  delete  删除一个模板');
  process.exit(1);
}
table[cmd]().catch(e => { console.error('❌ ' + e.message); process.exit(1); });
