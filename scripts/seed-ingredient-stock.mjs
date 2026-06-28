// Seed / sync the `ingredientStock` collection from the recipe master data.
//
// Enumerates every distinct ingredient across dishRecipes + addOnRecipes
// (src/data/dishIngredients.ts) and creates ONE doc per ingredient
// (id = ingredient name) with { onHand, unit, threshold, updatedAt }.
//
//   - New ingredient  → created with onHand 0 (boss 盘点 fills it in).
//   - Existing doc    → onHand is PRESERVED (never clobber a real count);
//                       only `unit` is refreshed if the recipe unit changed.
//
// Run with Node 24 native TS type-stripping (dishIngredients.ts has no imports).
//
// Usage:
//   node --experimental-strip-types scripts/seed-ingredient-stock.mjs           # dry run
//   node --experimental-strip-types scripts/seed-ingredient-stock.mjs --apply   # write
import admin from 'firebase-admin';
import fs from 'node:fs';
import { dishRecipes, addOnRecipes } from '../src/data/dishIngredients.ts';

const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
const APPLY = process.argv.includes('--apply');

// Firestore doc ids can't contain "/" (e.g. "PD51/60 虾"). Encode it; the real
// name lives in the `name` field. KEEP IN SYNC with ingredientDocId() in
// src/lib/ingredientStock.ts.
const docId = (name) => name.replace(/\//g, '__');

// ── Collect distinct (name → unit) from all recipes ──
const master = new Map(); // name → unit (first seen wins; warn on conflict)
const addLine = (l) => {
  if (!l?.name) return;
  const prev = master.get(l.name);
  if (prev && prev !== l.unit) console.warn(`⚠️ 单位冲突: ${l.name} 同时出现 ${prev} 与 ${l.unit}（取 ${prev}）`);
  if (!prev) master.set(l.name, l.unit);
};
for (const r of dishRecipes) (r.ingredients || []).forEach(addLine);
for (const lines of Object.values(addOnRecipes)) (lines || []).forEach(addLine);

console.log(`配方里共 ${master.size} 种原料：`);
for (const [name, unit] of [...master].sort((a, b) => a[0].localeCompare(b[0], 'zh'))) {
  console.log(`  ${name}  [${unit}]`);
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();
const { FieldValue } = admin.firestore;

const snap = await db.collection('ingredientStock').get();
// Key by the real `name` field (fallback to doc id for legacy docs).
const existing = new Map(snap.docs.map(d => [d.data()?.name || d.id, d.data()]));

let toCreate = 0, toUpdateUnit = 0, untouched = 0;
const plan = [];
for (const [name, unit] of master) {
  const cur = existing.get(name);
  if (!cur) { plan.push({ name, unit, action: 'create' }); toCreate++; }
  else if (cur.unit !== unit) { plan.push({ name, unit, action: 'unit', from: cur.unit }); toUpdateUnit++; }
  else untouched++;
}
const orphans = [...existing.keys()].filter(n => !master.has(n));

console.log(`\n计划：新建 ${toCreate} · 改单位 ${toUpdateUnit} · 不变 ${untouched}`);
plan.forEach(p => console.log(`  ${p.action === 'create' ? '＋新建' : '~改单位'} ${p.name} [${p.unit}]${p.from ? ` (原 ${p.from})` : ''}`));
if (orphans.length) console.log(`  ⚠️ 配方里已没有但库存仍存在（不动，自行决定删否）: ${orphans.join(', ')}`);

if (!APPLY) { console.log('\n[DRY RUN] 未写入。加 --apply 正式执行。'); process.exit(0); }

const batch = db.batch();
for (const p of plan) {
  const ref = db.collection('ingredientStock').doc(docId(p.name));
  if (p.action === 'create') {
    batch.set(ref, { name: p.name, onHand: 0, unit: p.unit, updatedAt: FieldValue.serverTimestamp() });
  } else {
    batch.set(ref, { name: p.name, unit: p.unit, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
}
await batch.commit();
console.log(`✅ 已写入：新建 ${toCreate} · 改单位 ${toUpdateUnit}（现有 onHand 全部保留）。`);
process.exit(0);
