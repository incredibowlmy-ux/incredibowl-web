/**
 * 食材改名迁移：「五花肉」→「顶级梅花肉片」（老板 2026-08-10 正名：
 * 马铃薯炖那道用的是梅花/肩胛部位，不是五花）。
 *
 * ingredientStock 的文档 id 就是食材名，改配方名字而不迁库存 =
 * 旧文档变孤儿（余额和 91 条进出记录全部失联），新名字从 0 重新开始。
 *
 * 做法：新建目标文档（带过 onHand/threshold/unit）→ 逐条搬 log 子集合 →
 * 回读校验条数与余额 → 才删旧文档。任一步对不上就中止，不删。
 *
 * 跑法：npx tsx scripts/rename-ingredient-2026-08-10-meihua.mts        （dry-run）
 *       npx tsx scripts/rename-ingredient-2026-08-10-meihua.mts --commit
 */
import admin from 'firebase-admin';
import fs from 'node:fs';

const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();
const { FieldValue } = admin.firestore;

const FROM = '五花肉';
const TO = '顶级梅花肉片';
const COMMIT = process.argv.includes('--commit');

const col = db.collection('ingredientStock');
const fromRef = col.doc(FROM);
const toRef = col.doc(TO);

const fromSnap = await fromRef.get();
if (!fromSnap.exists) { console.error(`中止：找不到「${FROM}」文档`); process.exit(1); }
const data = fromSnap.data()!;

const toSnap = await toRef.get();
if (toSnap.exists) {
  console.error(`中止：「${TO}」已存在（onHand=${toSnap.data()?.onHand}）——` +
    '不自动合并，请人工确认后处理');
  process.exit(1);
}

const logs = await fromRef.collection('log').get();
console.log(`=== 食材改名 ${COMMIT ? '【真写 --commit】' : '【DRY-RUN 预览】'} ===`);
console.log(`  ${FROM} → ${TO}`);
console.log(`  onHand=${data.onHand} unit=${data.unit || '(空)'} threshold=${data.threshold ?? '无'}`);
console.log(`  进出记录 ${logs.size} 条要一起搬`);

// 顺手补 unit：老板用「校正」建档的文档 unit 是空串，界面就不会 g→kg 换算
const unit = data.unit || 'g';
if (!data.unit) console.log(`  ⓘ 原文档 unit 为空 → 补成 '${unit}'`);

if (!COMMIT) { console.log('\n▶ 确认无误后加 --commit 真正执行。'); await admin.app().delete(); process.exit(0); }

// ── 1. 建目标文档 ──
await toRef.set({ ...data, name: TO, unit, renamedFrom: FROM, renamedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() });

// ── 2. 搬 log（保留原 doc id，幂等可重跑）──
let moved = 0;
for (let i = 0; i < logs.docs.length; i += 400) {
  const batch = db.batch();
  for (const d of logs.docs.slice(i, i + 400)) { batch.set(toRef.collection('log').doc(d.id), d.data()); moved++; }
  await batch.commit();
}
console.log(`  已搬 ${moved} 条流水`);

// ── 3. 回读校验：条数 + 余额必须一致，否则不删旧文档 ──
const [checkDoc, checkLogs] = await Promise.all([toRef.get(), toRef.collection('log').get()]);
const okQty = Number(checkDoc.data()?.onHand) === Number(data.onHand);
const okLogs = checkLogs.size === logs.size;
if (!okQty || !okLogs) {
  console.error(`中止（不删旧文档）：余额 ${okQty ? 'OK' : '对不上'} · 流水 ${checkLogs.size}/${logs.size}`);
  process.exit(1);
}
console.log(`  校验通过：余额 ${checkDoc.data()?.onHand} · 流水 ${checkLogs.size} 条`);

// ── 4. 删旧文档（先删子集合再删文档，避免留孤儿子集合）──
for (let i = 0; i < logs.docs.length; i += 400) {
  const batch = db.batch();
  for (const d of logs.docs.slice(i, i + 400)) batch.delete(d.ref);
  await batch.commit();
}
await fromRef.delete();
console.log(`  已删除旧文档「${FROM}」及其子集合`);
console.log('\n✅ 完成。');
await admin.app().delete();
