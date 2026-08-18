/**
 * 守住 dashboard 备餐单那两张「蛋」手抄表与 webapp 配方的一致性。
 * 跑：node scripts/dogfood-dashboard-egg-map.mjs
 *     （改 Desktop 那份后先跑这个，再 npm run sync:dashboard）
 *
 * 背景：蛋型（荷包蛋 / 温泉蛋 / 卤蛋 / 马铃薯煎蛋）这个信息**只存在于 dashboard**
 * —— webapp 配方按采购 SKU 记「鸡蛋(生)」，不区分做法。所以这两张表删不掉，只能
 * 用测试焊住：
 *   ① ADDON_EGGS：dashboard 不展开的含蛋加料，每份颗数必须等于 webapp 配方
 *   ② ADDON_EGGS 漏登记：webapp 有蛋、dashboard 既不展开也没登记 → 鸡蛋合计算 0
 *   ③ DISH_DEFAULT_EGGS：菜品自带蛋的总颗数必须等于 webapp 配方
 *
 * 2026-08-18 建这个脚本时 ② 抓到 3 道漏登记的菜（纳豆月见海苔饭 2 颗等），
 * 那正是老板发现「套餐的蛋没算进备餐单」时一并挖出来的。
 */
import fs from 'node:fs'; import vm from 'node:vm';

const SRC = process.env.DASH || 'C:/Users/User/Desktop/Incredibowl Services/incredibowl-dashboard.html';
const HTML = fs.readFileSync(SRC, 'utf-8').split('\n');
const at = (re, from = 0) => { for (let i = from; i < HTML.length; i++) if (re.test(HTML[i])) return i + 1; throw new Error(`dashboard 里找不到 ${re}`); };
const slice = (a, b) => HTML.slice(a - 1, b).join('\n');
const s1 = at(/^        const ADDON_SEED = \[/), e1 = at(/^        function canonicalAddonId/) + 2;
const s2 = at(/^        const COMBO_CONTENTS = \{/), e2 = at(/^        function isComboAddon/);
const s3 = at(/^        const WEB_LABEL_TO_ADDON_ID = \{/), e3 = at(/^        \};/, s3);
const s4 = at(/^        const ADDON_PRICE_SUFFIX_RE/), e4 = at(/^        function lookupAddonId/) + 10;
const s5 = at(/^            const DISH_DEFAULT_EGGS = \{/), e5 = at(/^            const EGG_ICON/);
const ctx = { console, out: {} };
vm.createContext(ctx);
vm.runInContext([slice(s1, e1), slice(s2, e2), slice(s3, e3), slice(s4, e4), slice(s5, e5)].join('\n\n')
  + '\n; Object.assign(out,{ADDON_SEED,COMBO_CONTENTS,WEB_LABEL_TO_ADDON_ID,ADDON_EGGS,DISH_DEFAULT_EGGS,canonicalAddonId,lookupAddonId});', ctx);
const { ADDON_SEED, COMBO_CONTENTS, WEB_LABEL_TO_ADDON_ID, ADDON_EGGS, DISH_DEFAULT_EGGS, canonicalAddonId, lookupAddonId } = ctx.out;

const { addOnRecipes, dishRecipes, COMBO_COMPONENTS } = await import('../src/data/dishIngredients.ts');
const { weeklyMenu } = await import('../src/data/weeklyMenu.ts');
const retiredDishes = new Set(weeklyMenu.filter(d => d.retired).map(d => d.name));

// 已退役、只留给在途订单聚合的含蛋加料 —— dashboard 既不展开也不数它们的蛋，
// 那是刻意的：下不了单了，翻旧账不值得多维护一张表。新退役的套餐加到这里。
const RETIRED_ADDONS = new Set([
  '阿嫲下饭王套',   // taucu-pork-combo，2026-08-01 换方案A 退役；2026-06-01 起 0 销量
]);
const EGG_NAMES = new Set(['鸡蛋(生)', '温泉蛋']);   // 卤蛋/荷包蛋等都按 鸡蛋(生) 采购
const eggsIn = lines => lines.filter(l => EGG_NAMES.has(l.name)).reduce((s, l) => s + l.qty, 0);
const labelToId = new Map(Object.entries(WEB_LABEL_TO_ADDON_ID));
const seedName = id => { const h = ADDON_SEED.find(x => x.id === id); return h ? h.name : null; };

let pass = 0; const fails = [];
const ok = m => { pass++; console.log(`  ✅ ${m}`); };
const bad = m => { fails.push(m); console.log(`  ❌ ${m}`); };

console.log('① / ② 含蛋加料：dashboard 要么展开它，要么在 ADDON_EGGS 登记对的颗数');
const seenIds = new Set();
for (const [label, lines] of Object.entries(addOnRecipes)) {
  const eggs = eggsIn(lines);
  if (eggs <= 0) continue;
  const id = canonicalAddonId(lookupAddonId(labelToId, label) || label);
  if (seenIds.has(id)) continue; seenIds.add(id);
  if (COMBO_CONTENTS[id]) continue;                       // dashboard 会拆它 → 蛋由组成项计
  if (COMBO_COMPONENTS[label]) {                          // webapp 认得是套餐，dashboard 不认
    bad(`「${label}」webapp 登记了组成、dashboard 的 COMBO_CONTENTS 没有 → 备餐单不拆它，蛋算 0`);
    continue;
  }
  if (RETIRED_ADDONS.has(label.split(" (")[0])) continue;   // 剥掉 "(原价 RM ...)" 后缀再比
  const disp = seedName(id);
  if (!disp) continue;                                    // 不在 dashboard 加料表里（纯网页/退役标签）
  const per = ADDON_EGGS[disp];
  if (!per) bad(`「${disp}」每份 ${eggs} 颗蛋，但 ADDON_EGGS 没登记 → 鸡蛋合计算 0`);
  else if (Math.abs(per - eggs) > 1e-6) bad(`「${disp}」ADDON_EGGS 写 ${per} 颗，配方是 ${eggs} 颗`);
  else ok(`${disp} ${per} 颗/份`);
}

console.log('\n③ 菜品自带蛋：DISH_DEFAULT_EGGS 总颗数 == webapp 配方');
for (const r of dishRecipes) {
  const eggs = eggsIn(r.ingredients);
  if (eggs <= 0) continue;
  if (retiredDishes.has(r.name)) continue;   // 退役菜下不了单，不必登记
  const dmap = DISH_DEFAULT_EGGS[r.name];
  if (!dmap) { bad(`「${r.name}」每份 ${eggs} 颗蛋，DISH_DEFAULT_EGGS 没登记 → 鸡蛋合计少算`); continue; }
  const got = Object.values(dmap).reduce((s, v) => s + v, 0);
  if (Math.abs(got - eggs) > 1e-6) bad(`「${r.name}」表里 ${got} 颗，配方 ${eggs} 颗`);
  else ok(`${r.name} ${got} 颗/份（${Object.entries(dmap).map(([k, v]) => `${k}×${v}`).join('、')}）`);
}

console.log(`\n${fails.length ? '❌' : '✅'} ${pass} 通过 / ${fails.length} 失败`);
process.exit(fails.length ? 1 : 0);
