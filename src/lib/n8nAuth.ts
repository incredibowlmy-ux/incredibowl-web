/**
 * n8n → 网站 的 Bearer 鉴权（/api/n8n/* 里给 AI 工具节点用的两个接口）。
 *
 * 为什么接受两把钥匙：
 *   n8n 的「HTTP Request Tool」节点（挂在 AI Agent 下的工具）**不支持 Bearer 凭据类型**，
 *   只支持 Header Auth 等（2026-09-07 上线首晚实测：`The type httpBearerAuth is not supported`，
 *   AI Agent 一初始化就炸）。普通 HTTP Request 节点支持 Bearer，所以其余节点照旧用 N8N_API_KEY。
 *   工具节点改走 Header Auth，复用 relay 那把「WA relay inbound (v4)」凭据（值就是
 *   `Bearer <N8N_INBOUND_SECRET>`），网站这边对应也认它。两把钥匙都只在 Vercel ↔ n8n 之间流转，
 *   没有扩大到第三方。
 */
import { timingSafeEqual } from 'node:crypto';

/** 纯函数，方便 dogfood：supplied 与任一非空候选常量时间相等即通过。 */
export function bearerMatches(supplied: string, candidates: ReadonlyArray<string | undefined>): boolean {
  const b = Buffer.from(supplied);
  for (const c of candidates) {
    if (!c) continue;
    const a = Buffer.from(c);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

/** 从 Authorization 头取 Bearer 值；没有就是空串。 */
export function bearerFrom(headers: { get(name: string): string | null }): string {
  return headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
}

/** 两把钥匙都没配 → 一律拒（fail-closed）。 */
export function n8nBearerOk(headers: { get(name: string): string | null }): boolean {
  return bearerMatches(bearerFrom(headers), [process.env.N8N_API_KEY, process.env.N8N_INBOUND_SECRET]);
}
