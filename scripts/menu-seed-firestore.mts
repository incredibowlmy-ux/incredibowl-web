/**
 * 一次性：把代码里的菜单快照（三张排期表 + 停业日）写进 Firestore，
 * 让 dashboard「菜单排期」页有起点。之后 Firestore 是权威，别再跑第二次
 * （再跑会把老板在 dashboard 改的东西压回代码快照 —— 除非你就是要这样，加 --force）。
 *
 *   npx tsx scripts/menu-seed-firestore.mts            # dry-run，只打印
 *   npx tsx scripts/menu-seed-firestore.mts --commit   # 真写
 *   npx tsx scripts/menu-seed-firestore.mts --commit --week 2026-09-14
 */
import admin from 'firebase-admin';
import fs from 'node:fs';
import { MENU_SNAPSHOT_WEEK, DISH_CATALOG_ALL } from '@/data/weeklyMenu';
import { CLOSURES, DINNER_CLOSED_DATES, BLOCKED_DATES } from '@/data/blockedDates';
import { mondayOf, ymdOfUTC, MYT_OFFSET_MS } from '@/lib/menuResolve';
import { MENU_COLLECTIONS } from '@/lib/menuRuntime.server';

const COMMIT = process.argv.includes('--commit');
const FORCE = process.argv.includes('--force');
// --week-only：只写那一周的排期文档，不碰 menuClosures（老板在 dashboard 设的停业日不被快照压掉）。
// 「老板在聊天里发菜单 → 我改 weeklyMenu.ts 三表 → 推上线」走的就是这条：
//   npx tsx scripts/menu-seed-firestore.mts --commit --force --week 2026-09-14 --week-only
const WEEK_ONLY = process.argv.includes('--week-only');
const weekArg = process.argv[process.argv.indexOf('--week') + 1];
const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';

const monday = /^\d{4}-\d{2}-\d{2}$/.test(weekArg ?? '')
    ? mondayOf(weekArg)
    : mondayOf(ymdOfUTC(new Date(Date.now() + MYT_OFFSET_MS)));

const nameOf = (id: number) => DISH_CATALOG_ALL.find(d => d.id === id)?.name ?? `#${id}`;

console.log(`周文档 ${MENU_COLLECTIONS.weeks}/${monday}`);
for (const wd of [1, 2, 3, 4, 5]) {
    console.log(`  周${'一二三四五'[wd - 1]}: ${(MENU_SNAPSHOT_WEEK.days[wd] ?? []).map(nameOf).join('、') || '—'}`);
}
console.log(`  常驻: ${MENU_SNAPSHOT_WEEK.daily.map(nameOf).join('、')}`);
console.log(`  暂别: ${MENU_SNAPSHOT_WEEK.paused.map(nameOf).join('、')}`);

const closures: Record<string, Record<string, unknown>> = {};
for (const c of CLOSURES) closures[c.date] = { ...(closures[c.date] ?? {}), closed: true, reason: c.reason };
for (const d of DINNER_CLOSED_DATES) closures[d] = { ...(closures[d] ?? {}), dinnerClosed: true };
for (const [id, dates] of Object.entries(BLOCKED_DATES)) {
    for (const d of dates) {
        const prev = (closures[d]?.blockedDishIds as number[] | undefined) ?? [];
        closures[d] = { ...(closures[d] ?? {}), blockedDishIds: [...prev, Number(id)] };
    }
}
console.log(`停业日 ${MENU_COLLECTIONS.closures}: ${Object.keys(closures).sort().join(', ') || '（无）'}`);

if (!COMMIT) { console.log('\n(dry-run) 加 --commit 才写。'); process.exit(0); }

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();
const now = admin.firestore.FieldValue.serverTimestamp();

const existing = await db.collection(MENU_COLLECTIONS.weeks).limit(1).get();
if (!existing.empty && !FORCE) {
    console.error(`✗ ${MENU_COLLECTIONS.weeks} 已有文档 —— Firestore 已是权威，seed 会覆盖老板的改动。确定要覆盖加 --force。`);
    process.exit(1);
}

const batch = db.batch();
batch.set(db.collection(MENU_COLLECTIONS.weeks).doc(monday), {
    days: Object.fromEntries([1, 2, 3, 4, 5].map(wd => [String(wd), MENU_SNAPSHOT_WEEK.days[wd] ?? []])),
    daily: MENU_SNAPSHOT_WEEK.daily,
    paused: MENU_SNAPSHOT_WEEK.paused,
    updatedAt: now, updatedBy: 'menu-seed-firestore',
});
if (!WEEK_ONLY) {
    for (const [date, doc] of Object.entries(closures)) {
        batch.set(db.collection(MENU_COLLECTIONS.closures).doc(date), { ...doc, updatedAt: now, updatedBy: 'menu-seed-firestore' });
    }
}
await batch.commit();
console.log(`✓ 已写入${WEEK_ONLY ? '（只写周文档，停业日未动）' : ''}。网站约 1 分钟内生效。`);
