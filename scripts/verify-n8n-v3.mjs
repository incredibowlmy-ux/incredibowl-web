import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import os from 'node:os';
const DIR = new URL('../n8n-workflows/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
let bad = 0;
const ok = (m) => console.log('  ✅ ' + m);
const no = (m) => { bad++; console.log('  ❌ ' + m); };

// 跑法：node scripts/verify-n8n-v3.mjs        → 查 v3 三件
//       node scripts/verify-n8n-v3.mjs v4     → 查 v4 三件
const VER = process.argv[2] === 'v4' ? 'v4' : 'v3';
for (const f of [`bowlmama-${VER}-main.json`,`bowlmama-${VER}-followup.json`,`bowlmama-${VER}-error.json`]) {
  const wf = JSON.parse(readFileSync(join(DIR,f),'utf8'));
  console.log(`\n== ${f} (${wf.nodes.length} 节点) ==`);

  // 1) 所有 Code 节点 JS 语法
  for (const n of wf.nodes.filter(n=>n.parameters?.jsCode)) {
    const tmp = join(os.tmpdir(), `n8n-code-${n.id}.js`);
    writeFileSync(tmp, n.parameters.jsCode, 'utf8');
    try { execSync(`node --check "${tmp}"`, {stdio:'pipe'}); ok(`Code 语法 OK: ${n.name}`); }
    catch(e){ no(`Code 语法错误: ${n.name}\n${String(e.stderr||e).slice(0,400)}`); }
    finally { try{unlinkSync(tmp);}catch{} }
  }

  // 2) 不该残留的 v2 节点引用
  const all = JSON.stringify(wf);
  for (const dead of ['Debounce Gate','Buffer Append','Buffer Read','Buffer Mark','wa_buffer']) {
    if (all.includes(dead)) no(`仍引用已删除的 v2 部件: ${dead}`); 
  }

  // 3) 每个 $('X') 引用的节点必须存在（validate 已查，这里再确认一次覆盖到表达式）
  const names = new Set(wf.nodes.map(n=>n.name));
  const refs = new Set([...all.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]));
  for (const r of refs) names.has(r) ? null : no(`引用了不存在的节点: $('${r}')`);
  if (refs.size) ok(`${refs.size} 个节点引用全部存在: ${[...refs].join(', ')}`);

  // 4) 连线出度不能超过节点实际输出数（Switch/IF）
  for (const [src, o] of Object.entries(wf.connections)) {
    const node = wf.nodes.find(n=>n.name===src);
    if (!node || !o.main) continue;
    const outs = o.main.length;
    if (node.type==='n8n-nodes-base.if' && outs>2) no(`${src} 是 IF 却接了 ${outs} 个输出`);
    if (node.type==='n8n-nodes-base.switch') {
      const rules = node.parameters?.rules?.values?.length ?? 0;
      const allowed = rules + (node.parameters?.options?.fallbackOutput!==undefined?1:0);
      if (outs > Math.max(rules, allowed)) no(`${src} 有 ${rules} 条规则却接了 ${outs} 个输出`);
      else ok(`${src}: ${rules} 规则 / ${outs} 输出，匹配`);
    }
  }

  // 4b) Wait 节点必须显式声明 unit —— 省略时不按秒算，会变成「客户等 8 小时」
  for (const n of wf.nodes.filter(n => n.type === 'n8n-nodes-base.wait')) {
    n.parameters?.unit
      ? ok(`Wait 节点单位明确: ${n.name} = ${n.parameters.amount} ${n.parameters.unit}`)
      : no(`Wait 节点没写 unit（会被当成小时/天）: ${n.name}`);
  }

  // 5) 孤儿节点（既没有入边也不是触发器）
  const targets = new Set();
  Object.values(wf.connections).forEach(o=>Object.values(o).forEach(arr=>arr.forEach(a=>(a||[]).forEach(c=>targets.add(c.node)))));
  const TRIGGERS = ['n8n-nodes-base.webhook','n8n-nodes-base.scheduleTrigger','n8n-nodes-base.errorTrigger'];
  const orphans = wf.nodes.filter(n=>!targets.has(n.name) && !TRIGGERS.includes(n.type) && !Object.keys(wf.connections).includes(n.name) && n.type!=='n8n-nodes-base.stickyNote');
  orphans.length ? no(`孤儿节点（永不执行）: ${orphans.map(n=>n.name).join(', ')}`) : ok('无孤儿节点');
}
console.log(`\n${bad===0?'✅ 全部通过':'❌ '+bad+' 个问题'}`);
process.exit(bad?1:0);
