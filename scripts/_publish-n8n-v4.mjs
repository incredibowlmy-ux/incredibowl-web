#!/usr/bin/env node
/**
 * 把 repo 里重新生成的 v4 JSON 推回 n8n 并重新发布（主流程 + 追单）。
 *
 * 为什么要这一步：build-n8n-v4.mjs 改了 Log Reply 节点（回传 wamid → 收件箱有勾）和
 * 提示词（认 /menu /order /fee /human），但 n8n 跑的还是 09-06 发布的那版，JSON 躺在
 * repo 里不会自己生效。
 *
 *   $env:N8N_API_KEY='<n8n Settings → n8n API 新建的 key>'
 *   node scripts/_publish-n8n-v4.mjs        只读：比对差异，不改
 *   node scripts/_publish-n8n-v4.mjs go     执行：PUT → deactivate → activate → 复核
 *   跑完： $env:N8N_API_KEY=''  并在 n8n 里把这把 key 删掉
 *
 * 做法照 _fix-v4-tool-auth.mjs：PUT 只改草稿，必须 deactivate→activate 才发布新版本。
 * 节点 / 连线整体用生成的 JSON 替换；凭据以线上为准（同名节点若线上有 credentials 就沿用，
 * 避免生成脚本里的凭据 id 与线上不一致时把凭据弄丢）。
 * 主流程失败自动回滚到旧版（PUT 回旧 nodes 再 activate）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KEY = process.env.N8N_API_KEY;
if (!KEY) { console.error("❌ 没有 N8N_API_KEY。n8n → Settings → n8n API → Create，然后 $env:N8N_API_KEY='<key>'"); process.exit(1); }
const BASE = 'https://n8n-e8dc.srv1458700.hstgr.cloud/api/v1/workflows';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GO = process.argv[2] === 'go';

const TARGETS = [
  { id: 'Xg9wYxuqYNalx9ZV', file: 'bowlmama-v4-main.json', label: '主流程',
    verify: wf => {
      const logs = wf.nodes.filter(n => n.name.startsWith('Log Reply'));
      const withId = logs.filter(n => /msgId/.test(JSON.stringify(n.parameters))).length;
      const ai = wf.nodes.find(n => n.name === 'AI Agent');
      const slash = /斜杠指令/.test(ai?.parameters?.options?.systemMessage || '');
      return { ok: withId === logs.length && logs.length > 0 && slash, detail: `Log Reply 带 msgId ${withId}/${logs.length}，提示词含斜杠指令段=${slash}` };
    } },
  { id: 'hLWLTS0XXt3PbaNE', file: 'bowlmama-v4-followup.json', label: '追单',
    verify: wf => {
      const log = wf.nodes.find(n => n.name.startsWith('Log Reply'));
      const ok = !!log && /msgId/.test(JSON.stringify(log.parameters));
      return { ok, detail: `Log Reply 带 msgId=${ok}` };
    } },
];

const api = async (p, method = 'GET', body) => {
  const r = await fetch(`${BASE}${p}`, { method, headers: { 'X-N8N-API-KEY': KEY, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${p} → ${r.status} ${j.message || JSON.stringify(j).slice(0, 300)}`);
  return j;
};

const slimSettings = s => {
  const out = { executionOrder: s?.executionOrder, errorWorkflow: s?.errorWorkflow, timezone: s?.timezone };
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
};

async function putAndPublish(id, name, nodes, connections, settings) {
  const body = { name, nodes, connections, settings, staticData: null };
  let updated;
  try { updated = await api(`/${id}`, 'PUT', body); }
  catch (e) {
    console.log('  PUT 带完整 settings 被拒，改用白名单 settings 重试：', e.message.slice(0, 100));
    body.settings = slimSettings(settings);
    updated = await api(`/${id}`, 'PUT', body);
  }
  console.log(`  PUT ok：versionId=${updated.versionId?.slice(0, 8)} active=${updated.active}`);
  await api(`/${id}/deactivate`, 'POST').catch(() => {});
  const a = await api(`/${id}/activate`, 'POST');
  console.log(`  activate ok：active=${a.active} activeVersionId=${a.activeVersionId?.slice(0, 8)}`);
}

let allOk = true;
for (const t of TARGETS) {
  console.log(`\n═══ ${t.label}（${t.id}）═══`);
  const live = await api(`/${t.id}`);
  const gen = JSON.parse(fs.readFileSync(path.join(ROOT, 'n8n-workflows', t.file), 'utf8'));
  const liveByName = new Map(live.nodes.map(n => [n.name, n]));

  // 凭据以线上为准
  let credKept = 0;
  const nodes = gen.nodes.map(n => {
    const l = liveByName.get(n.name);
    if (l?.credentials) { credKept++; return { ...n, credentials: l.credentials }; }
    return n;
  });
  const genV = t.verify({ nodes });
  const liveV = t.verify(live);
  console.log(`  线上：active=${live.active} 节点 ${live.nodes.length}  ${liveV.detail}`);
  console.log(`  生成：节点 ${nodes.length}（沿用线上凭据 ${credKept} 个）  ${genV.detail}`);
  const missing = gen.nodes.filter(n => !liveByName.has(n.name)).map(n => n.name);
  const extra = live.nodes.filter(n => !gen.nodes.some(g => g.name === n.name)).map(n => n.name);
  if (missing.length) console.log(`  线上没有、生成有：${missing.join(', ')}`);
  if (extra.length) console.log(`  线上有、生成没有（会被去掉）：${extra.join(', ')}`);
  if (!genV.ok) { console.log('  ❌ 生成的 JSON 本身没通过校验，先 node scripts/build-n8n-v4.mjs'); allOk = false; continue; }
  if (liveV.ok) { console.log('  ✅ 线上已经是新版，不用动'); continue; }
  if (!GO) { console.log('  （只读。执行：node scripts/_publish-n8n-v4.mjs go）'); continue; }

  try {
    await putAndPublish(t.id, live.name, nodes, gen.connections, live.settings);
    const after = await api(`/${t.id}`);
    const v = t.verify(after);
    console.log(`  复核：active=${after.active} published=${after.activeVersionId === after.versionId}  ${v.detail}`);
    if (!after.active || !v.ok) throw new Error('复核不过');
    console.log('  ✅ 发布成功');
  } catch (e) {
    allOk = false;
    console.log(`  ❌ ${e.message}`);
    console.log('  ↩ 回滚到旧版…');
    try {
      await putAndPublish(t.id, live.name, live.nodes, live.connections, live.settings);
      console.log('  ↩ 已回滚，bot 仍在旧版上跑');
    } catch (e2) {
      console.log(`  🚨 回滚也失败：${e2.message} —— 立刻把这段发给 Claude，bot 可能停了`);
    }
  }
}
console.log(allOk ? '\n✓ 完成。用测试号发一句「hi」，收件箱里碗妈的气泡应该带勾；再发 /menu 看 bot 认不认。' : '\n✗ 有问题，把上面整段发给 Claude。');
