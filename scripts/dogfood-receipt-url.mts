/**
 * Dogfood: 付款截图 URL 白名单（lib/receiptUrl）。
 *
 * 守的是 07-26 审计 P3-3：receiptUrl 原样落库后被 ownerNotify 渲染成老板通知里的
 * <a href>，escapeHtml 挡不住 javascript: / data: 协议。
 */
import { isAllowedReceiptUrl } from '../src/lib/receiptUrl.ts';

let pass = 0, fail = 0;
const t = (label: string, cond: boolean) => { cond ? pass++ : fail++; console.log(`  ${cond ? '✓' : '✗'} ${label}`); };

// ── 真实来源：Firebase Storage getDownloadURL ────────────────────────
t('firebasestorage 下载地址 → 放行', isAllowedReceiptUrl(
  'https://firebasestorage.googleapis.com/v0/b/incredibowl.appspot.com/o/receipts%2Fabc.jpg?alt=media&token=x'));
t('storage.googleapis.com → 放行', isAllowedReceiptUrl(
  'https://storage.googleapis.com/incredibowl.appspot.com/receipts/abc.jpg'));

// ── 空值：FPX / 餐券单本来就没有截图，该不该有由调用方判断 ──────────
t('undefined → 放行', isAllowedReceiptUrl(undefined));
t('null → 放行', isAllowedReceiptUrl(null));
t('空串 → 放行', isAllowedReceiptUrl(''));

// ── 协议注入（这就是要挡的）────────────────────────────────────────
t('javascript: → 拒', !isAllowedReceiptUrl('javascript:alert(document.cookie)'));
t('data: → 拒', !isAllowedReceiptUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='));
t('vbscript: → 拒', !isAllowedReceiptUrl('vbscript:msgbox(1)'));
t('file: → 拒', !isAllowedReceiptUrl('file:///C:/Windows/System32/config'));

// ── 域名伪装 ────────────────────────────────────────────────────────
t('http（非 https）的白名单域 → 拒', !isAllowedReceiptUrl('http://firebasestorage.googleapis.com/x.jpg'));
t('攻击者域 → 拒', !isAllowedReceiptUrl('https://evil.example.com/x.jpg'));
t('子域伪装 firebasestorage.googleapis.com.evil.com → 拒',
  !isAllowedReceiptUrl('https://firebasestorage.googleapis.com.evil.com/x.jpg'));
t('把白名单域塞进 path → 拒', !isAllowedReceiptUrl('https://evil.com/firebasestorage.googleapis.com/x.jpg'));
t('把白名单域塞进 userinfo → 拒', !isAllowedReceiptUrl('https://firebasestorage.googleapis.com@evil.com/x.jpg'));

// ── 垃圾输入 ────────────────────────────────────────────────────────
t('不是字符串 → 拒', !isAllowedReceiptUrl({ toString: () => 'https://firebasestorage.googleapis.com/x' }));
t('数字 → 拒', !isAllowedReceiptUrl(123));
t('无法解析的串 → 拒', !isAllowedReceiptUrl('not a url'));
t('相对路径 → 拒', !isAllowedReceiptUrl('/receipts/abc.jpg'));

console.log(`\n结果：${pass} 通过 / ${fail} 失败\n`);
process.exit(fail === 0 ? 0 : 1);
