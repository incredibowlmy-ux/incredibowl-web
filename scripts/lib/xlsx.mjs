/**
 * 极简 .xlsx 读取器 —— 零依赖（只用 node 内置 zlib），按工作表名取单元格。
 *
 * 为什么自己写：只为了读老板的成本表（Costing v5），装 exceljs/sheetjs 不值得；
 * 而且不落临时目录（不用 unzip 命令），一个函数进一个二维数组出。
 *
 * 读的是**缓存值**（公式格的 <v>），不重算公式 —— 老板表里的合计都是 Excel 存好的。
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

/** 解 zip：返回 { 文件名 -> Buffer }。xlsx 只会用 store(0) / deflate(8)。 */
function unzip(buf) {
  const files = {};
  // 从尾部找 End of Central Directory
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('不是有效的 zip/xlsx（找不到 EOCD）');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('中央目录项签名不对');
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    // 本地头：固定 30 字节 + 文件名 + extra（长度可能与中央目录不同，必须重读）
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    files[name] = method === 0 ? Buffer.from(raw) : zlib.inflateRawSync(raw);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const decode = s => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
  .replace(/&#x([0-9a-fA-F]+);/g, (_, d) => String.fromCharCode(parseInt(d, 16)))
  .replace(/&amp;/g, '&');

const colIndex = ref => {
  const letters = ref.match(/^[A-Z]+/)[0];
  let n = 0;
  for (const c of letters) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
};

/**
 * 读一个工作表。
 * @returns {{r:number, c:string[]}[]}  每行：r = Excel 行号，c[0] 对应 A 列
 *   （只返回有内容的行；空单元格是空字符串）
 */
export function readSheet(xlsxPath, sheetName) {
  const files = unzip(fs.readFileSync(xlsxPath));
  const wb = files['xl/workbook.xml']?.toString('utf8');
  if (!wb) throw new Error('xlsx 里没有 xl/workbook.xml');

  const sheets = [...wb.matchAll(/<sheet\b[^>]*\/>/g)].map(m => m[0]);
  const target = sheets.find(s => decode((s.match(/name="([^"]*)"/) || [])[1] ?? '') === sheetName);
  if (!target) {
    const names = sheets.map(s => decode((s.match(/name="([^"]*)"/) || [])[1] ?? ''));
    throw new Error(`找不到工作表「${sheetName}」。现有：${names.join(' / ')}`);
  }
  const rid = (target.match(/r:id="([^"]+)"/) || [])[1];
  const rels = files['xl/_rels/workbook.xml.rels']?.toString('utf8') ?? '';
  const relRe = new RegExp(`<Relationship[^>]*Id="${rid}"[^>]*Target="([^"]+)"`);
  const relTarget = (rels.match(relRe) || [])[1];
  if (!relTarget) throw new Error(`rels 里找不到 ${rid}`);
  const path = relTarget.startsWith('/') ? relTarget.slice(1)
    : relTarget.startsWith('xl/') ? relTarget : 'xl/' + relTarget;
  const xml = files[path]?.toString('utf8');
  if (!xml) throw new Error(`xlsx 里没有 ${path}`);

  let shared = [];
  const ss = files['xl/sharedStrings.xml']?.toString('utf8');
  if (ss) {
    shared = [...ss.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m =>
      [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => decode(t[1])).join(''));
  }

  const out = [];
  for (const rm of xml.matchAll(/<row[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cm of rm[2].matchAll(/<c r="([A-Z]+\d+)"([^>]*)\/?>(?:([\s\S]*?)<\/c>)?/g)) {
      const attrs = cm[2] || '', inner = cm[3] || '';
      const t = (attrs.match(/t="([^"]+)"/) || [])[1];
      let val = '';
      if (t === 'inlineStr') {
        const m = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
        val = m ? decode(m[1]) : '';
      } else {
        const m = inner.match(/<v>([\s\S]*?)<\/v>/);
        if (m) val = t === 's' ? (shared[+m[1]] ?? '') : decode(m[1]);
      }
      cells[colIndex(cm[1])] = val;
    }
    const c = [];
    for (let i = 0; i < cells.length; i++) c.push(cells[i] ?? '');
    if (c.some(x => x !== '')) out.push({ r: Number(rm[1]), c });
  }
  return out;
}
