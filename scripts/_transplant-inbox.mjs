// 把「碗妈收件箱」的三个区块从一份 dashboard 移植到另一份（Desktop 源 / 本地 main 的 public 副本）。
//
//   node scripts/_transplant-inbox.mjs --from <新版 html> --base <目标现在应有的旧版 html> --to <目标 html> [--dry]
//
// 为什么不整文件 sync：Desktop 源是所有 session 共用的工作文件，里面常有别人没上线的改动；
// 而 public/ 副本和 Desktop 在收件箱以外的地方本来就不一样。所以只搬收件箱自己的三块：
//   css     「碗妈收件箱」样式块
//   markup  #page-inbox
//   js      「碗妈对话」弹窗 helper + 收件箱脚本（const WA_PROFILE_LABEL … // Centralized launcher 之前）
// 护栏：目标里每个区块必须与 --base 里的逐字相同（换行归一后），否则说明有人动过这块 —— 整份不写、报出第一处差异。
// 已经等于新版的区块跳过（可重复跑）。
import fs from 'node:fs';

const args = process.argv.slice(2);
const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : ''; };
const dry = args.includes('--dry');
const [fromP, baseP, toP] = [val('--from'), val('--base'), val('--to')];
if (!fromP || !baseP || !toP) { console.error('用法见文件头'); process.exit(1); }

const REGIONS = [
    { name: 'css', start: /^\s*\/\* ═+ 碗妈收件箱/, end: /^\s*\/\* ═+ MODAL ═+ \*\// },
    { name: 'markup', start: /<div class="page" id="page-inbox">/, end: /<div class="page" id="page-(?!inbox)/ },
    { name: 'js', start: /^ {8}const WA_PROFILE_LABEL = /, end: /^ {8}\/\/ Centralized launcher/ },
];

const read = (p) => { const raw = fs.readFileSync(p, 'utf8'); return { crlf: raw.includes('\r\n'), lines: raw.replace(/\r\n/g, '\n').split('\n') }; };
function cut(lines, r, label) {
    const s = lines.findIndex(l => r.start.test(l));
    if (s < 0) throw new Error(`${label}：找不到 ${r.name} 区块的开头`);
    const e = lines.findIndex((l, i) => i > s && r.end.test(l));
    if (e < 0) throw new Error(`${label}：找不到 ${r.name} 区块的结尾`);
    if (lines.findIndex((l, i) => i > s && r.start.test(l)) >= 0) throw new Error(`${label}：${r.name} 区块的开头出现了两次`);
    return { s, e, text: lines.slice(s, e).join('\n') };
}

const from = read(fromP), base = read(baseP), to = read(toP);
let out = to.lines.slice();
const report = [];
for (const r of REGIONS) {
    const f = cut(from.lines, r, 'from'), b = cut(base.lines, r, 'base'), t = cut(out, r, 'to');
    if (t.text === f.text) { report.push(`${r.name}: 已是新版，跳过`); continue; }
    if (t.text !== b.text) {
        const tl = t.text.split('\n'), bl = b.text.split('\n');
        const i = tl.findIndex((l, n) => l !== bl[n]);
        console.error(`✖ ${r.name} 区块：目标与 base 不一致（有人动过这块），整份不写。\n  第一处差异在区块内第 ${i + 1} 行（目标文件第 ${t.s + i + 1} 行）：\n  目标: ${String(tl[i]).slice(0, 160)}\n  base: ${String(bl[i]).slice(0, 160)}`);
        process.exit(2);
    }
    out = [...out.slice(0, t.s), ...f.text.split('\n'), ...out.slice(t.e)];
    report.push(`${r.name}: ${b.text.split('\n').length} 行 → ${f.text.split('\n').length} 行`);
}
if (!dry) fs.writeFileSync(toP, out.join(to.crlf ? '\r\n' : '\n'));
console.log(`${dry ? '[dry] ' : ''}${toP}\n  ${report.join('\n  ')}\n  区块外一行没动（${to.lines.length} → ${out.length} 行）`);
