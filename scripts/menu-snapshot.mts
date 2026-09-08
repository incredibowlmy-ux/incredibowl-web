/**
 * Firestore（权威）→ 代码快照：把 menuWeeks / menuCatalog / menuClosures 反向写回
 * src/data/weeklyMenu.ts 三张表 + 价格、src/data/blockedDates.ts 三张表，然后串
 * sync:prices --fix + sync:dashboard，让 build 校验 / 预渲染 HTML / 离线脚本 /
 * dashboard 两副本 / git 历史都跟上 Firestore。
 *
 *   npx tsx scripts/menu-snapshot.mts                 # 按「今天所属周」快照并同步
 *   npx tsx scripts/menu-snapshot.mts --week 2026-09-14
 *   npx tsx scripts/menu-snapshot.mts --dry-run       # 只打印差异
 *   npx tsx scripts/menu-snapshot.mts --no-sync       # 只改源码，不跑 sync
 *
 * 老板换菜后什么时候跑：随时（低峰更好）。跑完 tsc 过了就 commit 菜单文件。
 */
import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { DISH_CATALOG_ALL, PAUSED_DAY_LABELS, PAUSED_DAY_LABEL_DEFAULT, WEEKDAY_LABEL_OF } from '@/data/weeklyMenu';
import { mondayOf, ymdOfUTC, MYT_OFFSET_MS, weekDocFor } from '@/lib/menuResolve';
import { readMenuRuntime } from '@/lib/menuRuntime.server';

const DRY = process.argv.includes('--dry-run');
const NO_SYNC = process.argv.includes('--no-sync');
const weekArg = process.argv[process.argv.indexOf('--week') + 1];
const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MENU_FILE = path.join(ROOT, 'src/data/weeklyMenu.ts');
const CLOSURE_FILE = path.join(ROOT, 'src/data/blockedDates.ts');

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const data = await readMenuRuntime(admin.firestore());
if (data.source !== 'firestore') {
    console.error('✗ Firestore 里没有 menuWeeks 文档 —— 还没 seed，没东西可快照。');
    process.exit(1);
}

const target = /^\d{4}-\d{2}-\d{2}$/.test(weekArg ?? '') ? weekArg : ymdOfUTC(new Date(Date.now() + MYT_OFFSET_MS));
const { monday, week, inherited } = weekDocFor(data, target);
console.log(`快照周 ${monday}${inherited ? '（沿用更早一周的文档）' : ''}`);

const nameOf = (id: number) => DISH_CATALOG_ALL.find(d => d.id === id)?.name ?? `#${id}`;
const eol = (s: string) => (s.includes('\r\n') ? '\r\n' : '\n');

// ── weeklyMenu.ts ────────────────────────────────────────────────────────────
let menuSrc = fs.readFileSync(MENU_FILE, 'utf8');
const NL = eol(menuSrc);
const menuLF = menuSrc.split('\r\n').join('\n');

const scheduleBlock = [
    'export const WEEKLY_SCHEDULE: Record<number, number[]> = {',
    ...[1, 2, 3, 4, 5].map(wd => {
        const ids = week.days[wd] ?? [];
        const names = ids.map((id, i) => `${nameOf(id)}${i === 0 ? '(主打)' : ''}`).join('、');
        return `    ${wd}: [${ids.join(', ')}],  // ${WEEKDAY_LABEL_OF[wd]}：${names || '—'}`;
    }),
    '};',
].join('\n');
const dailyBlock = `export const DAILY_DISHES: number[] = [${week.daily.join(', ')}];  // ${week.daily.map(nameOf).join('、') || '—'}`;
const pausedBlock = [
    'export const PAUSED_DISHES: { id: number; day: string }[] = [',
    ...week.paused.map(id => `    { id: ${id}, day: '${PAUSED_DAY_LABELS[id] ?? PAUSED_DAY_LABEL_DEFAULT}' },  // ${nameOf(id)}`),
    '];',
].join('\n');

let next = menuLF
    .replace(/export const WEEKLY_SCHEDULE: Record<number, number\[\]> = \{[\s\S]*?\n\};/, scheduleBlock)
    .replace(/export const DAILY_DISHES: number\[\] = \[[^\]]*\];[^\n]*/, dailyBlock)
    .replace(/export const PAUSED_DISHES: \{ id: number; day: string \}\[\] = \[[\s\S]*?\n\];/, pausedBlock);
for (const [k] of [['WEEKLY_SCHEDULE'], ['DAILY_DISHES'], ['PAUSED_DISHES']]) {
    if (!next.includes(`export const ${k}`)) { console.error(`✗ 找不到 ${k} 块，源码形状变了？`); process.exit(1); }
}

// 菜品级：价格覆盖 + hidden（没进任何表又没 hidden 的菜，strict build 会炸 → 补 hidden）。
const scheduled = new Set<number>([...week.daily, ...week.paused, ...[1, 2, 3, 4, 5].flatMap(wd => week.days[wd] ?? [])]);
for (const d of DISH_CATALOG_ALL) {
    const startIdx = next.search(new RegExp(`\\n    \\{\\n(?:[^\\n]*\\n)*?        id: ${d.id},\\n`));
    if (startIdx < 0) { console.warn(`  ! 找不到 id ${d.id} 的目录块，跳过`); continue; }
    const endIdx = next.indexOf('\n    },', startIdx);
    let block = next.slice(startIdx, endIdx);
    const o = data.catalog[String(d.id)] ?? {};
    if (typeof o.price === 'number' && Math.abs(o.price - d.price) > 0.001) {
        block = block.replace(/(\n        price: )[\d.]+(,)/, `$1${o.price.toFixed(2)}$2`);
        console.log(`  价格 ${d.name}: ${d.price} → ${o.price.toFixed(2)}`);
    }
    const wantHidden = o.hidden ?? (!scheduled.has(d.id));
    const hasHidden = /\n        hidden: true,/.test(block);
    if (wantHidden && !hasHidden) {
        block = block.replace(`\n        id: ${d.id},`, `\n        id: ${d.id},\n        hidden: true,  // 未排期（menu-snapshot 自动补）`);
        console.log(`  hidden ${d.name}: 加`);
    } else if (!wantHidden && hasHidden) {
        block = block.replace(/\n        hidden: true,[^\n]*/, '');
        console.log(`  hidden ${d.name}: 去`);
    }
    next = next.slice(0, startIdx) + block + next.slice(endIdx);
}
const menuOut = next.split('\n').join(NL);

// ── blockedDates.ts ──────────────────────────────────────────────────────────
const cloSrc = fs.readFileSync(CLOSURE_FILE, 'utf8');
const CNL = eol(cloSrc);
const cloLF = cloSrc.split('\r\n').join('\n');
const dates = Object.keys(data.closures).sort();
const closuresBlock = [
    'export const CLOSURES: Closure[] = [',
    ...dates.filter(d => data.closures[d].closed).map(d => `    { date: '${d}', reason: '${data.closures[d].reason ?? 'soldout'}' },`),
    '];',
].join('\n');
const dinnerBlock = `export const DINNER_CLOSED_DATES: string[] = [${dates.filter(d => data.closures[d].dinnerClosed && !data.closures[d].closed).map(d => `'${d}'`).join(', ')}];`;
const blockedById: Record<number, string[]> = {};
for (const d of dates) for (const id of data.closures[d].blockedDishIds ?? []) (blockedById[id] ??= []).push(d);
const blockedBlock = [
    'export const BLOCKED_DATES: Record<number, string[]> = {',
    ...Object.entries(blockedById).map(([id, ds]) => `    ${id}: [${ds.map(x => `'${x}'`).join(', ')}],  // ${nameOf(Number(id))}`),
    '};',
].join('\n');
const cloNext = cloLF
    .replace(/export const CLOSURES: Closure\[\] = \[[\s\S]*?\n\];/, closuresBlock)
    .replace(/export const DINNER_CLOSED_DATES: string\[\] = \[[^\]]*\];/, dinnerBlock)
    .replace(/export const BLOCKED_DATES: Record<number, string\[\]> = \{[\s\S]*?\n\};/, blockedBlock);
const cloOut = cloNext.split('\n').join(CNL);

const menuChanged = menuOut !== menuSrc;
const cloChanged = cloOut !== cloSrc;
console.log(`weeklyMenu.ts ${menuChanged ? '有变化' : '无变化'}；blockedDates.ts ${cloChanged ? '有变化' : '无变化'}`);
if (DRY) { console.log('(dry-run) 未写文件。'); process.exit(0); }
if (menuChanged) fs.writeFileSync(MENU_FILE, menuOut);
if (cloChanged) fs.writeFileSync(CLOSURE_FILE, cloOut);

// strict build 自检：直接 import 一次，非法排期会 throw。
const check = spawnSync(process.execPath, [
    path.join(ROOT, 'node_modules/tsx/dist/cli.mjs'), '-e',
    "import('./src/data/weeklyMenu.ts').then(m => console.log('  ✓ weeklyMenu strict build OK，' + m.weeklyMenu.length + ' 条'))",
], { cwd: ROOT, encoding: 'utf8' });
process.stdout.write(check.stdout);
if (check.status !== 0) { console.error(check.stderr); console.error('✗ 快照后的 weeklyMenu.ts 过不了 strict build，请检查。'); process.exit(1); }

if (!NO_SYNC) {
    for (const args of [['run', 'sync:prices'], ['run', 'sync:dashboard']]) {
        console.log(`\n$ npm ${args.join(' ')}`);
        const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
        if (r.status !== 0) { console.error(`✗ npm ${args.join(' ')} 失败`); process.exit(1); }
    }
}
console.log('\n✓ 快照完成。接下来：npx tsc --noEmit → 只 commit 菜单文件（weeklyMenu.ts / blockedDates.ts / dashboard 两副本）。');
