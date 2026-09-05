#!/usr/bin/env node
/**
 * CI 的 dogfood 跑器 —— `npm run dogfood`
 *
 * 这个仓库没有测试框架，验证靠 scripts/ 里几十个 dogfood-* 脚本，而它们从来
 * 只在有人想起来的时候手跑。2026-09-05 建 CI 时实测发现
 * `dogfood-new-customer-gift` 有一条断言已经红了不知道多久 —— 备餐加料的输出
 * 格式在 6423a0e 改过，断言没跟上，没人看见。**这就是要有这个文件的理由。**
 *
 * 设计取舍：
 *   **自动发现 + 显式跳过名单**，不是白名单。新写的 dogfood 自动进 CI；要排除
 *   必须在下面 SKIP 里写清理由。反过来（白名单）会让新脚本默默不跑，等于没测。
 *
 *   跳过的只有两类：需要 Firebase 凭据的（CI 里永远不会有私钥），和需要本地
 *   服务的。纯逻辑脚本一律跑。
 *
 * 用法：
 *   node scripts/run-dogfood.mjs            跑全部（跳过 SKIP）
 *   node scripts/run-dogfood.mjs --list     只列出会跑哪些、跳哪些
 *   node scripts/run-dogfood.mjs cart repricing   只跑名字含这些关键词的
 *
 * 退出码：0 = 全过；1 = 有脚本失败或超时。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const scriptsDir = path.join(repoRoot, 'scripts');
const TIMEOUT_MS = 120_000;

// 直接拿 tsx 的 JS 入口用 node 跑，不走 `npx` + shell：Windows 上 spawn 一个
// .cmd 必须开 shell，而开了 shell 参数不转义（Node 的 DEP0190）。这里的脚本名
// 是我们自己 readdir 出来的，但不给 shell 一个可乘之机更省事。
const tsxCli = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
if (!fs.existsSync(tsxCli)) {
  console.error(`✗ 找不到 tsx（${tsxCli}）。先跑 npm ci / npm install。`);
  process.exit(1);
}

/**
 * 不进 CI 的脚本 → 理由。理由必须具体到「缺什么」，这样以后有人补上环境就
 * 知道能不能删掉这一行。
 */
const SKIP = {
  // ── 需要 Firebase Admin 凭据（CI 里永远不放私钥）──────────────────
  'dogfood-addon-topup-no-voucher.mjs': '要 Firebase Admin 凭据',
  'dogfood-customers-peggy.mjs': '要 Firebase Admin 凭据（读真实客户）',
  'dogfood-delivery-tracking.mjs': '要 Firebase Admin 凭据',
  'dogfood-first-order-promo.mjs': '要 Firebase Admin 凭据',
  'dogfood-first-order-promo.mts': '要 Firebase Admin 凭据',
  'dogfood-multi-day-check.mjs': '要 Firebase Admin 凭据',
  'dogfood-multi-day-confirm.mjs': '要 Firebase Admin 凭据',
  'dogfood-multi-day.mjs': '要 Firebase Admin 凭据',
  'dogfood-order-rollback.mts': '要 Firebase Admin 凭据（且会写测试数据）',
  'dogfood-subscription-shortfall-e2e.mts': '要 Firebase Admin 凭据',
  'dogfood-subscription-two-meals.mjs': '要 Firebase Admin 凭据',
  'dogfood-subscription-upgrade-credits.mjs': '要 Firebase Admin 凭据',
  'dogfood-voucher-exclusion.mts': '要 Firebase Admin 凭据',
  'dogfood-web-addon-credits.mjs': '要 Firebase Admin 凭据',
  // ── 需要本地服务 ────────────────────────────────────────────────
  'dogfood-n8n-v3-scripts.mjs': '要本地 n8n 在 127.0.0.1:4007',
};

const args = process.argv.slice(2);
const listOnly = args.includes('--list');
const filters = args.filter(a => !a.startsWith('--'));

const all = fs.readdirSync(scriptsDir)
  .filter(f => /^dogfood-.+\.(mts|mjs)$/.test(f))
  .sort();

// 探针自检：跑器本身「什么都没找到」时必须红，不能安静地报全过。
// 这是 daily-check 那条 G3 规则（scanned=0 一律当探针失效）的同一个道理 ——
// 一个只跑 0 个测试的绿色 CI 比没有 CI 更坏，因为它让人以为有网。
// 门槛设在「明显不对」的量级上，不追着实际数量走（否则每加一个脚本就要改这里）。
const MIN_RUNNABLE = 10;
if (all.length === 0) {
  console.error('✗ scripts/ 里一个 dogfood-* 都没有 —— 探针本身坏了，不当通过。');
  process.exit(1);
}

const skipped = all.filter(f => SKIP[f]);
let queue = all.filter(f => !SKIP[f]);
if (filters.length) queue = queue.filter(f => filters.some(k => f.includes(k)));

console.log(`dogfood: 发现 ${all.length} 个，跑 ${queue.length} 个，跳过 ${skipped.length} 个`);
for (const f of skipped) console.log(`  ⏭  ${f} — ${SKIP[f]}`);
if (filters.length) console.log(`  （--filter: ${filters.join(', ')}）`);
console.log('');

if (listOnly) {
  for (const f of queue) console.log(`  ▶ ${f}`);
  process.exit(0);
}

if (queue.length === 0) {
  console.error('✗ 过滤后没有脚本可跑。');
  process.exit(1);
}
if (!filters.length && queue.length < MIN_RUNNABLE) {
  console.error(`✗ 只发现 ${queue.length} 个可跑的 dogfood（少于 ${MIN_RUNNABLE}）——`);
  console.error('  多半是 scripts/ 没被完整 checkout，或者有人把脚本挪走/加进了 SKIP。');
  console.error('  绿色但只跑几个测试的 CI 比没有 CI 更坏，所以这里直接判失败。');
  process.exit(1);
}

const failures = [];
for (const f of queue) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [tsxCli, path.join('scripts', f)], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
  });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const timedOut = r.error && r.error.code === 'ETIMEDOUT';
  const ok = !timedOut && r.status === 0;
  console.log(`  ${ok ? '✓' : '✗'} ${f.padEnd(46)} ${secs}s`);
  if (!ok) {
    failures.push(f);
    const out = `${r.stdout || ''}${r.stderr || ''}`.trimEnd();
    const tail = out.split('\n').slice(-25).join('\n');
    console.log(timedOut ? `      ⏱ 超过 ${TIMEOUT_MS / 1000}s 被掐掉` : `      exit=${r.status}`);
    if (tail) console.log(tail.split('\n').map(l => `      │ ${l}`).join('\n'));
  }
}

console.log('');
if (failures.length) {
  console.error(`✗ ${failures.length}/${queue.length} 个 dogfood 失败：${failures.join(', ')}`);
  process.exit(1);
}
console.log(`✓ ${queue.length} 个 dogfood 全部通过`);
