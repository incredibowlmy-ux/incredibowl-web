/**
 * validate-n8n-workflows.mjs — n8n workflow JSON 结构校验（导入前把关）。
 *
 * 查五类问题：
 *  1. JSON 合法性 + 节点名唯一
 *  2. connections 的源/目标节点都存在
 *  3. 表达式里 $('节点名') 引用的节点必须真实存在（防 typo 静默炸）
 *  4. v1 事故类表达式：以 "==" 开头（会把字面 = 拼进值）或以换行结尾
 *  5. credentials id 必须在已知白名单里，或显式 REPLACE_AFTER_IMPORT 占位
 *
 * 跑法：node scripts/validate-n8n-workflows.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = new URL('../n8n-workflows/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const KNOWN_CREDS = new Set([
  'r40sSPxInxCOtHWS',  // WhatsApp account
  'G1eKfCxWLU9x0zyF',  // Google Sheets account
  'kPDcMzsEk1cRmG33',  // Google Gemini(PaLM) Api account 2
  'ew3zAX6xWGWOdrGO',  // Incredibowl N8N API Key (bearer)
]);
const PLACEHOLDER = 'REPLACE_AFTER_IMPORT';

let problems = 0;
const warn = (file, msg) => { problems++; console.log(`  ❌ [${file}] ${msg}`); };
const info = (msg) => console.log(`  ${msg}`);

function* walkStrings(value, path = '$') {
  if (typeof value === 'string') { yield [path, value]; return; }
  if (Array.isArray(value)) { for (let i = 0; i < value.length; i++) yield* walkStrings(value[i], `${path}[${i}]`); return; }
  if (value && typeof value === 'object') { for (const [k, v] of Object.entries(value)) yield* walkStrings(v, `${path}.${k}`); }
}

const files = readdirSync(DIR).filter(f => f.endsWith('.json'));
if (files.length === 0) { console.error('n8n-workflows/ 没有 JSON'); process.exit(1); }

for (const file of files) {
  console.log(`\n== ${file} ==`);
  let wf;
  try {
    wf = JSON.parse(readFileSync(join(DIR, file), 'utf8'));
  } catch (e) {
    warn(file, `JSON 解析失败：${e.message}`);
    continue;
  }

  const names = wf.nodes.map(n => n.name);
  const nameSet = new Set(names);
  if (nameSet.size !== names.length) {
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    warn(file, `节点名重复：${dup.join(', ')}`);
  }
  info(`节点 ${names.length} 个`);

  // 2. connections 完整性
  let connCount = 0;
  for (const [src, byType] of Object.entries(wf.connections || {})) {
    if (!nameSet.has(src)) warn(file, `connections 源节点不存在：「${src}」`);
    for (const outputs of Object.values(byType)) {
      for (const outputArr of outputs) {
        for (const conn of outputArr || []) {
          connCount++;
          if (!nameSet.has(conn.node)) warn(file, `「${src}」连到不存在的节点「${conn.node}」`);
        }
      }
    }
  }
  info(`连接 ${connCount} 条，全部指向已存在节点${problems ? '（除上述报错外）' : ''}`);

  // 孤儿检查：非 trigger 节点应至少被一条连接指到。
  // 例外：AI 挂件（model/memory/tool）是 ai_* 连接的「源」，天然没有入边。
  const targets = new Set();
  for (const byType of Object.values(wf.connections || {}))
    for (const outputs of Object.values(byType))
      for (const arr of outputs) for (const c of arr || []) targets.add(c.node);
  const triggers = new Set(wf.nodes.filter(n => /webhook|trigger/i.test(n.type)).map(n => n.name));
  const aiAttachments = new Set(
    Object.entries(wf.connections || {})
      .filter(([, byType]) => Object.keys(byType).some(t => t !== 'main'))
      .map(([src]) => src),
  );
  const stickies = new Set(wf.nodes.filter(n => n.type === 'n8n-nodes-base.stickyNote').map(n => n.name));
  for (const n of names) {
    if (!targets.has(n) && !triggers.has(n) && !aiAttachments.has(n) && !stickies.has(n)) {
      warn(file, `孤儿节点（没有任何入边）：「${n}」`);
    }
  }

  // 3+4. 表达式审计
  for (const node of wf.nodes) {
    for (const [path, s] of walkStrings(node.parameters ?? {})) {
      if (s.startsWith('==')) warn(file, `「${node.name}」表达式以 == 开头（v1 事故类，会把字面 = 拼进值）：${path}`);
      if (s.startsWith('=') && /\n$/.test(s)) warn(file, `「${node.name}」表达式以换行结尾：${path}`);
      for (const m of s.matchAll(/\$\(\s*'([^']+)'\s*\)/g)) {
        if (!nameSet.has(m[1])) warn(file, `「${node.name}」引用了不存在的节点 $('${m[1]}')：${path}`);
      }
    }
  }

  // 5. credentials 白名单
  for (const node of wf.nodes) {
    for (const [credType, cred] of Object.entries(node.credentials ?? {})) {
      if (!cred?.id) { warn(file, `「${node.name}」凭据 ${credType} 缺 id`); continue; }
      if (!KNOWN_CREDS.has(cred.id) && cred.id !== PLACEHOLDER) {
        warn(file, `「${node.name}」凭据 id「${cred.id}」不在已知白名单（${credType}）`);
      }
    }
  }
}

console.log(`\n${problems === 0 ? '✅ 全部通过' : `❌ 共 ${problems} 个问题`}`);
process.exit(problems > 0 ? 1 : 0);
