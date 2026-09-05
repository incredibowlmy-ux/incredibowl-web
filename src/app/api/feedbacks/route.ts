import { NextResponse } from 'next/server';

/**
 * GET /api/feedbacks — 首页「邻居好评」的已审核评价。
 *
 * 为什么要有这个路由（2026-09-05，实测）：
 *   首页原来用 Firebase **客户端 SDK** 读 feedbacks（lib/feedbacks 的 getDocs）。
 *   Web SDK 一旦初始化 Firestore，就会开一条 Listen 长连接并常驻 ——
 *   页面因此**永远到不了 network idle**，15 秒内主线程任务比屏蔽它时多 26%
 *   （12.7s → 9.4s，iPhone 13 视口 + 4× CPU 节流，各跑 3 次取中位数）。
 *   顺带一提：同一组实测里去掉 Microsoft Clarity 只省约 0.2s CPU、不动 LCP，
 *   所以 Clarity 保留，真正该改的是这里。
 *
 * 数据本来就是公开的（firestore.rules 允许匿名读 status == 'APPROVED'），
 * 这里只是换个搬运方式：服务端 Admin SDK 读一次 → CDN 缓存 10 分钟。
 * 写入（submitFeedback）仍走客户端 SDK —— 那是登录后的一次性动作，
 * 不会在首屏开长连接。
 */

export const revalidate = 600;

export interface FeedbackDTO {
    id: string;
    name: string;
    text: string;
    time: string;
    createdAt: string;
}

export async function GET() {
    try {
        const { getAdminDb } = await import('@/lib/firebase-admin');
        const db = getAdminDb();
        const snap = await db.collection('feedbacks').where('status', '==', 'APPROVED').get();

        const items: FeedbackDTO[] = snap.docs.map(d => {
            const x = d.data() || {};
            return {
                id: d.id,
                name: String(x.name || ''),
                text: String(x.text || ''),
                time: String(x.time || ''),
                createdAt: String(x.createdAt || ''),
            };
        }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return NextResponse.json({ items }, {
            headers: {
                // 评价是审核后才出现的，10 分钟的陈旧完全可以接受；
                // stale-while-revalidate 让回源那一下不落在客户身上。
                'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
            },
        });
    } catch (err) {
        console.error('[api/feedbacks] failed:', err);
        // 首页的评价区拿不到数据只是少一块社会证明，不该让页面报错。
        return NextResponse.json({ items: [], error: 'unavailable' }, { status: 200 });
    }
}
