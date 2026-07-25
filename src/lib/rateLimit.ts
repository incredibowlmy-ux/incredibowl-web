/**
 * 公开 / 低成本可调用接口的滥用限流 —— 服务端专用（勿在客户端 import）。
 *
 * 两层，因为在 Vercel 上任何单独一层都不够：
 *
 *   第 1 层 — 内存滑动桶。免费、零延迟，但每个 serverless 实例各有一份 Map，
 *            攻击者只要把请求打散到多个实例就能绕过。它能挡住「一个客户端
 *            狂点」，但**不是**硬上限。
 *   第 2 层 — Firestore 每日计数。所有实例共用同一个 doc，扇出绕不过去，
 *            这才是真正给「上游要花钱的接口」封顶的那一层
 *            （Google Geocoding ≈ USD 5 / 1000 次）。每次调用一个事务，
 *            按本站量级可忽略。
 *
 * ⚠️ 第 2 层**故意 fail-open**：Firestore 挂了的时候，宁可放行也不能让顾客
 * 存不了地址。这是明确的取舍——能把 Firestore 打挂的攻击者，手上的杠杆
 * 比刷我们的地图账单大得多。
 *
 * 清理：计数 doc 带 `expiresAt`，可在 Firebase Console 给 `rateLimits` 集合
 * 配一条 TTL 策略（字段选 expiresAt）自动删。不配也无妨——每人每天 1 个
 * 几十字节的 doc。
 */

import type { Firestore } from 'firebase-admin/firestore';

// ───────────── 第 1 层：内存突发桶 ─────────────

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export interface BurstOptions {
    /** 窗口内允许的最大次数。 */
    max: number;
    /** 窗口长度（毫秒）。 */
    windowMs: number;
}

export interface BurstResult {
    ok: boolean;
    retryAfterSec: number;
}

/**
 * 内存突发限流。`key` 要自带作用域前缀（如 `geocode:uid123`），因为整个
 * 进程共用一个 Map。
 */
export function checkBurst(key: string, opts: BurstOptions): BurstResult {
    const now = Date.now();
    const b = buckets.get(key);
    if (!b || b.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
        // 顺手清掉过期条目，别让 Map 在长跑实例上无限膨胀。
        if (buckets.size > 5000) {
            for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
        }
        return { ok: true, retryAfterSec: 0 };
    }
    if (b.count >= opts.max) {
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
    }
    b.count += 1;
    return { ok: true, retryAfterSec: 0 };
}

// ───────────── 第 2 层：Firestore 每日封顶 ─────────────

/** doc id 不能含 `/`，其余字符 Firestore 都收；顺手掐长度防超长 key。 */
function safeSegment(s: string): string {
    return (s || 'anon').replace(/[/\\]/g, '_').slice(0, 120);
}

/** 马来西亚时间的 YYYYMMDD —— 配额按 MY 自然日重置，跟营业日对齐。 */
function todayKeyMY(): string {
    const my = new Date(Date.now() + 8 * 60 * 60 * 1000);
    return `${my.getUTCFullYear()}${String(my.getUTCMonth() + 1).padStart(2, '0')}${String(my.getUTCDate()).padStart(2, '0')}`;
}

export interface DailyQuotaResult {
    ok: boolean;
    used: number;
    limit: number;
    /** true = Firestore 出错已放行（fail-open），调用方可据此打日志。 */
    degraded: boolean;
}

/**
 * 每日配额（跨实例硬上限）。超额返回 ok:false，**不**自增计数。
 *
 * @param scope 接口名，用于隔离不同接口的配额（如 'geocode'）
 * @param key   身份键（uid 优先，退化到 IP）
 */
export async function checkDailyQuota(
    db: Firestore,
    scope: string,
    key: string,
    limit: number,
): Promise<DailyQuotaResult> {
    const docId = `${safeSegment(scope)}__${safeSegment(key)}__${todayKeyMY()}`;
    const ref = db.collection('rateLimits').doc(docId);
    try {
        const { Timestamp } = await import('firebase-admin/firestore');
        return await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const used = snap.exists ? Number(snap.data()?.count) || 0 : 0;
            if (used >= limit) {
                return { ok: false, used, limit, degraded: false };
            }
            tx.set(ref, {
                count: used + 1,
                scope,
                key,
                // TTL 锚点：48h 后可被 Firestore TTL 策略回收（跨日边界留足余量）
                expiresAt: Timestamp.fromMillis(Date.now() + 48 * 3600_000),
            }, { merge: true });
            return { ok: true, used: used + 1, limit, degraded: false };
        });
    } catch (err) {
        // fail-open —— 见文件头注释。
        console.error(`[rateLimit] daily quota check failed for ${docId} (fail-open):`, err);
        return { ok: true, used: 0, limit, degraded: true };
    }
}

// ───────────── 工具 ─────────────

/** 取客户端 IP —— Vercel 走 x-forwarded-for，第一段是真实来源。 */
export function getClientIp(req: Request): string {
    const xff = req.headers.get('x-forwarded-for');
    if (xff) return xff.split(',')[0].trim();
    return req.headers.get('x-real-ip') || 'anon';
}
