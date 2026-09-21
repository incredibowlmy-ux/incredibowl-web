// 2026-09-22 本周菜单全部补齐两档套餐 —— dashboard 锚点替换（可重放到任一底版）。
//   node apply-dashboard-combos.mjs <dashboard.html>
import fs from 'node:fs';

const file = process.argv[2];
let html = fs.readFileSync(file, 'utf-8');
if (html.includes("'scallion-chicken-rice-king-combo'")) { console.log('已套用过，跳过'); process.exit(0); }

function insertAfter(anchor, text, expected = 1) {
    const n = html.split(anchor).length - 1;
    if (n !== expected) throw new Error(`锚点出现 ${n} 次（应为 ${expected}）：${anchor.slice(0, 80)}`);
    html = html.split(anchor).join(anchor + text);
}
function replaceOnce(anchor, text) {
    const n = html.split(anchor).length - 1;
    if (n !== 1) throw new Error(`锚点出现 ${n} 次（应为 1）：${anchor.slice(0, 80)}`);
    html = html.replace(anchor, () => text);
}

const STD_BLOCK = `
                { id: 'less-rice',     label: '少饭', price: 0.00 },
                { id: 'extra-rice',    label: '加饭', price: 2.00 },
                { id: 'brown-rice',    label: '换糙米', price: 2.00 },
                { id: 'sunny-egg',     label: '荷包蛋', price: 2.50 },
                { id: 'onsen-egg',     label: '温泉蛋', price: 3.00 },
                { id: 'potato-egg',    label: '马铃薯煎蛋', price: 4.00 },
                { id: 'broccoli-egg',  label: '蒜蓉西兰花炒蛋', price: 10.90 },
                { id: 'shrimp-egg',    label: '虾仁炒蛋', price: 12.90 },
                { id: 'extra-edamame', label: '毛豆仁 (25g)', price: 2.50 },
                { id: 'extra-corn',    label: '甜玉米 (30g)', price: 2.50 },
                { id: 'chia-pudding',  label: '奇亚籽布丁', price: 6.90 },
                ...DRINKS_PILLS,
            ],`;
const dishBlock = (key, comment, a, b) => `
            '${key}': [
                // ${comment}
                // 2026-09-22 补两档套餐（与 webapp dishCombos 同步）；登记后 DEFAULT_ADDONS 兜底失效，标准块照惯例抄全。
                { id: '${a[0]}', label: '${a[1]}', price: ${a[2]} },
                { id: '${b[0]}', label: '${b[1]}', price: ${b[2]} },${STD_BLOCK}`;

// 1. ADDON_SEED
insertAfter(`{ id: 'chicken-chop-rice-combo',     name: '鸡扒干饭套',           price: 7.00,  category: '套餐组合' },  // 芝麻蜜汁鸡扒：C 档（A 档复用古早味下饭套）`, `
            // 2026-09-22 本周菜单全部补齐两档套餐（老板拍板，规则同 09-21）；#38 共用三文鱼两套、#14/#26 补挂鸡扒干饭套，不新增 id
            { id: 'scallion-chicken-rice-king-combo', name: '葱油下饭套',       price: 12.90, category: '套餐组合' },  // #34 葱油鸡腿：西兰花炒蛋+荷包蛋+加饭，原价 15.40
            { id: 'scallion-chicken-rice-combo', name: '葱油鸡干饭套',         price: 7.00,  category: '套餐组合' },  // #34 葱油鸡腿：C 档（碗里有西兰花）
            { id: 'oyster-fish-rice-king-combo', name: '蚝油下饭套',           price: 12.90, category: '套餐组合' },  // #35 蚝油鱼片：西兰花炒蛋+荷包蛋+加饭，原价 15.40
            { id: 'oyster-fish-rice-combo',      name: '蚝油鱼片干饭套',       price: 5.90,  category: '套餐组合' },  // #35 蚝油鱼片：荷包蛋+加饭+毛豆25g，原价 7.00
            { id: 'potato-pork-rice-king-combo', name: '土豆焖肉下饭套',       price: 12.90, category: '套餐组合' },  // #36 土豆焖五花肉：西兰花炒蛋+荷包蛋+加饭，原价 15.40
            { id: 'potato-pork-rice-combo',      name: '土豆焖肉干饭套',       price: 5.90,  category: '套餐组合' },  // #36 土豆焖五花肉：荷包蛋+加饭+毛豆25g，原价 7.00（碗里有马铃薯，不用 C 档）
            { id: 'wagyu-slice-rice-king-combo', name: '和牛片下饭套',         price: 12.90, category: '套餐组合' },  // #37 马铃薯炖和牛片：西兰花炒蛋+荷包蛋+加饭，原价 15.40
            { id: 'wagyu-slice-rice-combo',      name: '和牛片干饭套',         price: 5.90,  category: '套餐组合' },  // #37 马铃薯炖和牛片：荷包蛋+加饭+毛豆25g，原价 7.00
            { id: 'sambal-rice-king-combo',      name: '参峇下饭套',           price: 12.90, category: '套餐组合' },  // #22 参峇：西兰花炒蛋+荷包蛋+加饭，原价 15.40
            { id: 'sambal-rice-combo',           name: '参峇干饭套',           price: 5.90,  category: '套餐组合' },  // #22 参峇：荷包蛋+加饭+毛豆25g，原价 7.00
            { id: 'yam-rice-king-combo',         name: '山药下饭套',           price: 12.90, category: '套餐组合' },  // #12 山药云耳：第二档，西兰花炒蛋+荷包蛋+加饭，原价 15.40
            { id: 'greek-rice-king-combo',       name: '柠香鸡胸下饭套',       price: 12.90, category: '套餐组合' },  // #3 希腊鸡胸：第二档，西兰花炒蛋+荷包蛋+加饭，原价 15.40`);

// 2. COMBO_CONTENTS
insertAfter(`            'chicken-chop-rice-combo':      ['potato-egg', 'sunny-egg', 'extra-rice'],`, `
            // 2026-09-22 本周菜单全部补齐两档套餐
            'scallion-chicken-rice-king-combo': ['broccoli-egg', 'sunny-egg', 'extra-rice'],
            'scallion-chicken-rice-combo':  ['potato-egg', 'sunny-egg', 'extra-rice'],
            'oyster-fish-rice-king-combo':  ['broccoli-egg', 'sunny-egg', 'extra-rice'],
            'oyster-fish-rice-combo':       ['sunny-egg', 'extra-rice', 'extra-edamame'],
            'potato-pork-rice-king-combo':  ['broccoli-egg', 'sunny-egg', 'extra-rice'],
            'potato-pork-rice-combo':       ['sunny-egg', 'extra-rice', 'extra-edamame'],
            'wagyu-slice-rice-king-combo':  ['broccoli-egg', 'sunny-egg', 'extra-rice'],
            'wagyu-slice-rice-combo':       ['sunny-egg', 'extra-rice', 'extra-edamame'],
            'sambal-rice-king-combo':       ['broccoli-egg', 'sunny-egg', 'extra-rice'],
            'sambal-rice-combo':            ['sunny-egg', 'extra-rice', 'extra-edamame'],
            'yam-rice-king-combo':          ['broccoli-egg', 'sunny-egg', 'extra-rice'],
            'greek-rice-king-combo':        ['broccoli-egg', 'sunny-egg', 'extra-rice'],`);

// 3. WEB_LABEL_TO_ADDON_ID
insertAfter(`            '鸡扒干饭套 (原价 RM 8.50)': 'chicken-chop-rice-combo',`, `
            // 2026-09-22 本周菜单全部补齐两档套餐
            '葱油下饭套 (原价 RM 15.40)': 'scallion-chicken-rice-king-combo',
            '葱油鸡干饭套 (原价 RM 8.50)': 'scallion-chicken-rice-combo',
            '蚝油下饭套 (原价 RM 15.40)': 'oyster-fish-rice-king-combo',
            '蚝油鱼片干饭套 (原价 RM 7.00)': 'oyster-fish-rice-combo',
            '土豆焖肉下饭套 (原价 RM 15.40)': 'potato-pork-rice-king-combo',
            '土豆焖肉干饭套 (原价 RM 7.00)': 'potato-pork-rice-combo',
            '和牛片下饭套 (原价 RM 15.40)': 'wagyu-slice-rice-king-combo',
            '和牛片干饭套 (原价 RM 7.00)': 'wagyu-slice-rice-combo',
            '参峇下饭套 (原价 RM 15.40)': 'sambal-rice-king-combo',
            '参峇干饭套 (原价 RM 7.00)': 'sambal-rice-combo',
            '山药下饭套 (原价 RM 15.40)': 'yam-rice-king-combo',
            '柠香鸡胸下饭套 (原价 RM 15.40)': 'greek-rice-king-combo',`);

// 4. PACKING_COMBO_EXTRA_RICE（12 套全部含加饭）
insertAfter(`            'salmon-rice-king-combo', 'salmon-rice-combo',
            'chicken-chop-rice-combo',`, `
            // 2026-09-22 本周菜单全部补齐两档套餐（12 套全部含加饭）
            'scallion-chicken-rice-king-combo', 'scallion-chicken-rice-combo',
            'oyster-fish-rice-king-combo', 'oyster-fish-rice-combo',
            'potato-pork-rice-king-combo', 'potato-pork-rice-combo',
            'wagyu-slice-rice-king-combo', 'wagyu-slice-rice-combo',
            'sambal-rice-king-combo', 'sambal-rice-combo',
            'yam-rice-king-combo', 'greek-rice-king-combo',`);

// 5. DISH_ADDON_MAP —— 已有条目补挂（dashboard 菜 id：'1' = webapp #14 金黄鸡扒）
insertAfter(`                { id: 'chicken-chop-rice-king-combo', label: '古早味下饭套', price: 12.90 },  // 2026-08-16 换互补型（旧古早味大满贯三件套鸡扒版退役，不再可选）`, `
                { id: 'chicken-chop-rice-combo',      label: '鸡扒干饭套', price: 7.00 },  // 2026-09-22 补第二档（同 #33 C 档）`, 2);
insertAfter(`                { id: 'surf-turf-super-combo', label: '海陆澎湃三件套', price: 11.40 },`, `
                { id: 'yam-rice-king-combo',   label: '山药下饭套', price: 12.90 },  // 2026-09-22 补第二档`);
insertAfter(`                { id: 'greek-protein-bomb-combo',  label: '蛋白质核弹三件套', price: 15.90 },`, `
                { id: 'greek-rice-king-combo',     label: '柠香鸡胸下饭套', price: 12.90 },  // 2026-09-22 补第二档`);
replaceOnce(`                // webapp 无自定义 add-on section，沿用默认 alacarte + drinks
`, `                // 2026-09-22 补两档套餐（与 webapp dishCombos 同步）
                { id: 'sambal-rice-king-combo', label: '参峇下饭套', price: 12.90 },
                { id: 'sambal-rice-combo',      label: '参峇干饭套', price: 5.90 },
`);

// 新条目：#34 #35 #36 #37 #38（dashboard 菜 id 与 webapp 相同）
const MAP_END = `
        };

        // 通用配菜：每道菜都能加`;
const newBlocks =
    dishBlock('34', '阿嫲葱油鸡腿饭 — RM 19.90（碗里有西兰花 → 第二档 C 档）',
        ['scallion-chicken-rice-king-combo', '葱油下饭套', '12.90'], ['scallion-chicken-rice-combo', '葱油鸡干饭套', '7.00']) +
    dishBlock('35', '阿嫲蚝油姜蒜鱼片饭 — RM 19.90（不配荷包蛋，老板 09-16 定）',
        ['oyster-fish-rice-king-combo', '蚝油下饭套', '12.90'], ['oyster-fish-rice-combo', '蚝油鱼片干饭套', '5.90']) +
    dishBlock('36', '家常土豆焖五花肉 — RM 19.90（碗里有马铃薯 → 第二档走干饭套）',
        ['potato-pork-rice-king-combo', '土豆焖肉下饭套', '12.90'], ['potato-pork-rice-combo', '土豆焖肉干饭套', '5.90']) +
    dishBlock('37', '马铃薯炖和牛片 — RM 24.90，餐券抵扣需补 RM 5（碗里有马铃薯 → 第二档走干饭套）',
        ['wagyu-slice-rice-king-combo', '和牛片下饭套', '12.90'], ['wagyu-slice-rice-combo', '和牛片干饭套', '5.90']) +
    dishBlock('38', '柚香香煎三文鱼饭 — RM 24.90，餐券抵扣需补 RM 5；与 #21/#32 共用三文鱼两套',
        ['salmon-rice-king-combo', '三文鱼下饭套', '12.90'], ['salmon-rice-combo', '三文鱼干饭套', '7.00']);
replaceOnce(MAP_END, newBlocks + MAP_END);

fs.writeFileSync(file, html);
console.log('✓ 已套用到', file);
