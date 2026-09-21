// 2026-09-22 老板拍板：dashboard 加料选单拿掉奇亚籽布丁、虾仁炒蛋、全部饮品。
// 依据：全部历史 1447 张单里奇亚籽 1 次（05-13）、虾仁炒蛋 1 次（06-04）、饮品 0 次；网站本来就没有。
// 只动「选单」（DISH_ADDON_MAP / DEFAULT_ADDONS / STANDALONE_ORDER）；ADDON_SEED、
// WEB_LABEL_TO_ADDON_ID 等成本归因表保留，旧订单照常能查到价。
//   node scripts/_apply-dashboard-drop-drinks-20260922.mjs <dashboard.html>
import fs from 'node:fs';

const file = process.argv[2];
let html = fs.readFileSync(file, 'utf-8').replace(/\r\n/g, '\n');
if (html.includes('2026-09-22 老板拍板：饮品组不再挂')) { console.log('已套用过，跳过'); process.exit(0); }

const start = html.indexOf('        // 共享饮品组（每道菜都有');
const end = html.indexOf('        function getDishAddons(');
if (start < 0 || end < start) throw new Error('找不到 DRINKS_PILLS … getDishAddons 区段');
let region = html.slice(start, end);

function drop(re, expected) {
    const n = (region.match(re) || []).length;
    if (n !== expected) throw new Error(`${re} 命中 ${n} 次（应为 ${expected}）`);
    region = region.replace(re, '');
}
function replaceOnce(src, anchor, text) {
    const n = src.split(anchor).length - 1;
    if (n !== 1) throw new Error(`锚点出现 ${n} 次（应为 1）：${anchor.slice(0, 80)}`);
    return src.replace(anchor, () => text);
}

// 条数按底版算：DISH_ADDON_MAP 各菜条目 + DEFAULT_ADDONS 各 1 行
const perDish = (region.match(/^\s*\.\.\.DRINKS_PILLS,\n/gm) || []).length;
drop(/^\s*\{ id: 'chia-pudding',\s+label: '奇亚籽布丁', price: 6\.90 \},\n/gm, perDish);
drop(/^\s*\{ id: 'shrimp-egg',\s+label: '虾仁炒蛋', price: 12\.90 \},\n/gm, perDish);
drop(/^\s*\.\.\.DRINKS_PILLS,\n/gm, perDish);
drop(/^\s*\/\/ ─── Drinks ───\n/gm, (region.match(/^\s*\/\/ ─── Drinks ───\n/gm) || []).length);
if (/chia-pudding|'shrimp-egg'|\.\.\.DRINKS_PILLS/.test(region.slice(region.indexOf('const DISH_ADDON_MAP')))) throw new Error('选单里还有残留');

region = replaceOnce(region, `        // 共享饮品组（每道菜都有，跟 webapp 一致）— 改茶价或加新茶只改这一处，
        // 不用同步 9 道菜。
`, `        // 共享饮品组 —— 2026-09-22 老板拍板：饮品组不再挂任何菜（历史 0 单，网站也没有）。
        // 常量留着：scripts/gen-dish-addon-map.mjs 会读它；要恢复就把 ...DRINKS_PILLS 加回
        // DEFAULT_ADDONS / 各菜条目。
`);
region = replaceOnce(region, `标准 à la carte + 饭量 + 饮品，`, `标准 à la carte + 饭量，`);
html = html.slice(0, start) + region + html.slice(end);

// 单点配菜排序表（只有本地 main 有这张表，origin 底版没有就跳过）
if (html.includes('const STANDALONE_ORDER = [')) {
    html = replaceOnce(html, `'shrimp-broccoli-steamed-egg', 'minced-pork-egg', 'shrimp-egg',   // 蛋`,
        `'shrimp-broccoli-steamed-egg', 'minced-pork-egg',                 // 蛋`);
    html = replaceOnce(html, `            'chia-pudding',                                 // 甜品
            'longjing-ice', 'longjing-warm', 'tieguanyin-ice', 'tieguanyin-warm',
            'shuixian-ice', 'shuixian-warm',                // 饮品
`, '');
    html = replaceOnce(html, `汤 → 菜 → 蛋（由便宜到贵）→ 加量小配 → 甜品 → 饮品。`, `汤 → 菜 → 蛋（由便宜到贵）→ 加量小配。`);
}

fs.writeFileSync(file, html);
console.log(`✓ 已套用到 ${file}（每处 ${perDish} 条）`);
