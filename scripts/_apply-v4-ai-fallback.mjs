#!/usr/bin/env node
/**
 * 线上热修（2026-09-10 凌晨 Gemini 503 事故）：给 v4 主流程的 AI Agent 加「重试 + 错误分支兜底」，
 * 并把 Error Handler 的报警文案补上真正的错误详情。
 *
 *   node scripts/_apply-v4-ai-fallback.mjs        只读：列出要改的东西，不改
 *   node scripts/_apply-v4-ai-fallback.mjs go     执行：PUT 两个 workflow 并重新发布
 *
 * 改动来源是 build-n8n-v4.mjs 生成的 JSON（单一来源，别在这里手写节点）：
 *   · AI Agent：retryOnFail / maxTries / waitBetweenTries / onError=continueErrorOutput
 *   · 新节点：AI Down Build / AI Down Reply / Log Reply · 兜底 / AI Down Boss WA / Lead Alert · 兜底 / AI Down Telegram
 *   · Telegram 节点的 chatId / 凭据照抄线上「Boss Alert Telegram」（JSON 里是占位符）
 *   · Error Handler：只换 Telegram 报警的 text
 */
import fs from 'node:fs';
const SP = 'C:/Users/User/AppData/Local/Temp/claude/c--Users-User--gemini-antigravity-scratch-incredibowl-web/68f27a10-8bfd-4dd0-a8d7-29062a009e82/scratchpad';
const KEY = fs.readFileSync(`${SP}/n8n.key`, 'utf8').trim();
const BASE = 'https://n8n-e8dc.srv1458700.hstgr.cloud/api/v1/workflows';
const WF_MAIN = 'Xg9wYxuqYNalx9ZV';
const WF_ERR = 'HQXyFV7FnEqQ3G0N';
const GO = process.argv[2] === 'go';

const gen = JSON.parse(fs.readFileSync('n8n-workflows/bowlmama-v4-main.json', 'utf8'));
const genErr = JSON.parse(fs.readFileSync('n8n-workflows/bowlmama-v4-error.json', 'utf8'));
const NEW_NODES = ['AI Down Build', 'AI Down Reply', 'Log Reply · 兜底', 'AI Down Boss WA', 'Lead Alert · 兜底', 'AI Down Telegram'];

const api = async (path, method = 'GET', body) => {
  const r = await fetch(`${BASE}${path}`, { method, headers: { 'X-N8N-API-KEY': KEY, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${j.message || JSON.stringify(j).slice(0, 300)}`);
  return j;
};
const putAndRepublish = async (id, wf, patchedNodes, patchedConns) => {
  const body = { name: wf.name, nodes: patchedNodes, connections: patchedConns, settings: wf.settings, staticData: wf.staticData ?? null };
  let updated;
  try { updated = await api(`/${id}`, 'PUT', body); }
  catch (e) {
    console.log('  PUT 带完整 settings 被拒，改用白名单 settings 重试：', e.message.slice(0, 120));
    const s = wf.settings || {}; body.settings = { executionOrder: s.executionOrder, errorWorkflow: s.errorWorkflow, timezone: s.timezone };
    for (const k of Object.keys(body.settings)) if (body.settings[k] === undefined) delete body.settings[k];
    updated = await api(`/${id}`, 'PUT', body);
  }
  console.log(`  PUT ok：versionId=${updated.versionId?.slice(0, 8)} active=${updated.active}`);
  if (wf.active && (updated.activeVersionId !== updated.versionId || !updated.active)) {
    await api(`/${id}/deactivate`, 'POST');
    const a = await api(`/${id}/activate`, 'POST');
    console.log(`  重新发布 ok：active=${a.active} activeVersionId=${a.activeVersionId?.slice(0, 8)}`);
  }
};

// ── 主流程 ──
const wf = await api(`/${WF_MAIN}`);
const liveAgent = wf.nodes.find(n => n.name === 'AI Agent');
const liveTg = wf.nodes.find(n => n.name === 'Boss Alert Telegram');
if (!liveAgent || !liveTg) throw new Error('线上找不到 AI Agent / Boss Alert Telegram');
const genAgent = gen.nodes.find(n => n.name === 'AI Agent');
const already = wf.nodes.some(n => n.name === 'AI Down Build');
console.log(`主流程现状：active=${wf.active} 节点=${wf.nodes.length} AI Agent retryOnFail=${liveAgent.retryOnFail ?? '(无)'} onError=${liveAgent.onError ?? '(无)'} 兜底链已装=${already}`);

const nodes = wf.nodes.filter(n => !NEW_NODES.includes(n.name)).map(n => JSON.parse(JSON.stringify(n)));
const agent = nodes.find(n => n.name === 'AI Agent');
for (const k of ['retryOnFail', 'maxTries', 'waitBetweenTries', 'onError']) agent[k] = genAgent[k];
for (const name of NEW_NODES) {
  const n = JSON.parse(JSON.stringify(gen.nodes.find(x => x.name === name)));
  if (!n) throw new Error(`生成的 JSON 里没有 ${name}，先跑 build-n8n-v4.mjs`);
  if (n.type === 'n8n-nodes-base.telegram') { n.parameters.chatId = liveTg.parameters.chatId; n.credentials = liveTg.credentials; }
  nodes.push(n);
}
const conns = JSON.parse(JSON.stringify(wf.connections));
for (const name of ['AI Agent', ...NEW_NODES]) {
  if (gen.connections[name]) conns[name] = gen.connections[name]; else delete conns[name];
}
console.log(`  将写入：AI Agent retryOnFail=${agent.retryOnFail} maxTries=${agent.maxTries} wait=${agent.waitBetweenTries}ms onError=${agent.onError}；新增/覆盖节点 ${NEW_NODES.length} 个；AI Agent 输出 ${conns['AI Agent'].main.length} 路`);

// ── Error Handler ──
const ewf = await api(`/${WF_ERR}`);
const liveErrTg = ewf.nodes.find(n => n.type === 'n8n-nodes-base.telegram');
const genErrTg = genErr.nodes.find(n => n.type === 'n8n-nodes-base.telegram');
if (!liveErrTg || !genErrTg) throw new Error('Error Handler 里找不到 Telegram 节点');
const errNodes = ewf.nodes.map(n => JSON.parse(JSON.stringify(n)));
errNodes.find(n => n.type === 'n8n-nodes-base.telegram').parameters.text = genErrTg.parameters.text;
console.log(`Error Handler 现状：active=${ewf.active} 文案已含错误详情=${String(liveErrTg.parameters.text).includes('description')}`);

if (!GO) { console.log('\n（只读。执行：node scripts/_apply-v4-ai-fallback.mjs go）'); process.exit(0); }

console.log('\n→ 更新主流程');
await putAndRepublish(WF_MAIN, wf, nodes, conns);
console.log('→ 更新 Error Handler');
await putAndRepublish(WF_ERR, ewf, errNodes, ewf.connections);

const after = await api(`/${WF_MAIN}`);
const a = after.nodes.find(n => n.name === 'AI Agent');
const ok = a.retryOnFail === true && a.onError === 'continueErrorOutput' && NEW_NODES.every(n => after.nodes.some(x => x.name === n)) && after.active;
console.log(ok ? '\n✅ 完成：AI Agent 重试 + 兜底链已上线' : '\n❌ 复核不通过，去 n8n 后台看');
process.exit(ok ? 0 : 1);
