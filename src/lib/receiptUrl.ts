/**
 * 付款截图 URL 白名单校验。
 *
 * 为什么（2026-07-26 审计 P3-3）：`receiptUrl` 从请求体原样落进订单文档，再被
 * `ownerNotify` 渲染成老板通知里的 `<a href>`。`escapeHtml` 挡得住尖括号，挡不住
 * `javascript:` / `data:` 这类协议 —— 老板点一下就中招。
 *
 * 合法来源只有一个：顾客在 CartDrawer 里传到 Firebase Storage 后
 * `getDownloadURL()` 拿回来的地址。所以按**域名**白名单，不做通用 URL 校验。
 */

/** Firebase Storage 下载地址的两种形态（SDK 版本 / 配置不同会给不同域）。 */
const ALLOWED_HOSTS = new Set([
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
]);

/**
 * 空值算合法（FPX / 餐券单本来就没有截图，由调用方另行判断「该不该有」）。
 * 非空时必须是 https 且落在白名单域上。
 */
export function isAllowedReceiptUrl(url: unknown): boolean {
  if (url === undefined || url === null || url === '') return true;
  if (typeof url !== 'string') return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  return ALLOWED_HOSTS.has(u.hostname);
}
