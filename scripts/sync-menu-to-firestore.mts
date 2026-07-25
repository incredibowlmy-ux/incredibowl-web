/**
 * 换菜后一次性把 weeklyMenu.ts 的当周排期推进 dashboard 的 Firestore `menu` 集合。
 *
 *   源头（唯一）：src/data/weeklyMenu.ts 的 `weeklyMenu`（webapp ID 空间，含派生 day/retired）。
 *   目标：Firestore `menu` 集合（dashboard ID 空间，dashboard 读它渲染手动加单下拉）。
 *
 * 只写三样，职责严格分离，绝不越界：
 *   · day             换天（Mon/Tue/…/Daily）
 *   · offMenuThisWeek 本周是否在网站菜单上（暂别/retired=true → 下拉进「本周暂别」组，仍可选）
 *   · 建新菜文档       weeklyMenu 有、Firestore 没有的 → 建档（active:true, costPrice:0）
 *
 * 绝不碰 `active`（= 能否被手动加单，长期退役才 false，如鸡汤；由 MENU_SEED/Settings 管）。
 * 绝不碰 `price`/`costPrice`（老板在 Settings 手动维护，seed 不覆盖）。
 * 绝不删文档。
 *
 * 用法：
 *   node scripts/sync-menu-to-firestore.mts              # dry-run，只打印将要做的改动
 *   node scripts/sync-menu-to-firestore.mts --commit     # 真正写 Firestore
 *
 * Node 24 原生 strip-types，可直接 import weeklyMenu.ts（该文件无运行时依赖）。
 */
import admin from 'firebase-admin';
import fs from 'node:fs';
import { weeklyMenu } from '../src/data/weeklyMenu.ts';

const COMMIT = process.argv.includes('--commit');
const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';

// ── webapp id → dashboard id（历史遗留，dashboard ID 与 webapp ID 不一一对应）──
//    只有下面 5 个不同，其余 identity。改动前用名字校验漂移（见下）。
const WEBAPP_TO_DASH: Record<number, number> = {
    1: 14,  // 酱油鸡全腿
    2: 13,  // 当归蒸鸡全腿
    4: 2,   // 绍兴酒蒸花肉
    13: 4,  // 马铃薯炖花肉片
    14: 1,  // 金黄鸡扒饭
};
const toDashId = (webappId: number): number => WEBAPP_TO_DASH[webappId] ?? webappId;

// weeklyMenu 的 day label（'Mon / 周一' | 'Daily / 常驻' | 'Fri / 周五' …）→ dashboard day key。
function dashDay(dayLabel: string): string {
    const map: Record<string, string> = {
        Mon: 'Mon', Tue: 'Tue', Wed: 'Wed', Thu: 'Thu', Fri: 'Fri',
        Daily: 'Daily', 周一: 'Mon', 周二: 'Tue', 周三: 'Wed', 周四: 'Thu', 周五: 'Fri', 常驻: 'Daily',
    };
    for (const token of dayLabel.split(/[\s/]+/)) {
        if (map[token]) return map[token];
    }
    return '其他';
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();
const Timestamp = admin.firestore.Timestamp;

const snap = await db.collection('menu').get();
const fsById = new Map(snap.docs.map(d => [String(d.id), d.data()]));

const warnings: string[] = [];
const creates: { dashId: string; name: string; day: string; price: number }[] = [];
const updates: { dashId: string; name: string; changes: Record<string, unknown> }[] = [];

// weeklyMenu 里「未排期(hidden)」的不推。retired/scheduled 都推。
for (const item of weeklyMenu) {
    if (item.day.startsWith('Unscheduled')) continue;

    const dashId = String(toDashId(item.id));
    const existing = fsById.get(dashId);
    const desiredDay = dashDay(item.day);
    const desiredOffMenu = item.retired === true;

    // 名字校验：dashboard 文档名字应与 weeklyMenu 一致，不一致=ID 映射漂移，停手报警。
    if (existing && existing.name && existing.name !== item.name) {
        warnings.push(`⚠️ ID 映射漂移：webapp ${item.id}「${item.name}」→ dash ${dashId} 但 Firestore 该 doc 叫「${existing.name}」。跳过，请核对 WEBAPP_TO_DASH。`);
        continue;
    }

    if (!existing) {
        creates.push({ dashId, name: item.name, day: desiredDay, price: item.price });
        continue;
    }

    const changes: Record<string, unknown> = {};
    if (existing.day !== desiredDay) changes.day = desiredDay;
    if ((existing.offMenuThisWeek === true) !== desiredOffMenu) changes.offMenuThisWeek = desiredOffMenu;
    if (Object.keys(changes).length) updates.push({ dashId, name: item.name, changes });
}

// ── 打印计划 ──
const mode = COMMIT ? '【真写 --commit】' : '【DRY-RUN 预览，未写库】';
console.log(`\n=== 菜单同步 Firestore ${mode} ===`);
console.log(`weeklyMenu 排期菜: ${weeklyMenu.filter(i => !i.day.startsWith('Unscheduled')).length} 道；Firestore 现有 menu 文档: ${snap.size}\n`);

if (creates.length) {
    console.log(`🆕 新建文档 (${creates.length}):`);
    for (const c of creates) console.log(`   dash#${c.dashId}  ${c.name}  day=${c.day}  price=RM${c.price}  active=true offMenuThisWeek=false`);
    console.log('');
}
if (updates.length) {
    console.log(`🔀 更新文档 (${updates.length}):`);
    for (const u of updates) console.log(`   dash#${u.dashId}  ${u.name}  ${JSON.stringify(u.changes)}`);
    console.log('');
}
if (!creates.length && !updates.length) console.log('✅ Firestore 已与 weeklyMenu 一致，无需改动。\n');
if (warnings.length) { console.log('── 警告 ──'); warnings.forEach(w => console.log(w)); console.log(''); }

// ── 执行 ──
if (COMMIT && (creates.length || updates.length)) {
    for (const c of creates) {
        await db.collection('menu').doc(c.dashId).set({
            id: Number(c.dashId), name: c.name, price: c.price, costPrice: 0,
            day: c.day, active: true, offMenuThisWeek: false,
            createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
        });
    }
    for (const u of updates) {
        await db.collection('menu').doc(u.dashId).set(
            { ...u.changes, updatedAt: Timestamp.now() }, { merge: true });
    }
    console.log(`✅ 已写入：${creates.length} 新建 + ${updates.length} 更新。\n`);
} else if (!COMMIT && (creates.length || updates.length)) {
    console.log('▶ 确认无误后加 --commit 真正写入。\n');
}

await admin.app().delete();
