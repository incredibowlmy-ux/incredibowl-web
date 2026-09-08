import { NextResponse } from 'next/server';
import { corsify, corsPreflight } from '@/lib/adminApi';
import { EMPTY_RUNTIME } from '@/lib/menuRuntimeStore';

/**
 * GET /api/menu — 公开读菜单运行时数据（排期周 / 价格覆盖 / 停业日）。
 *
 * 客户端 hydration 后 fetch 一次（与 /api/dish-stock 同模式，不用 Firestore
 * Listen）。返回的是原始 override 数据，不是算好的菜单 —— 菜名 / 图 / 描述
 * 仍在 bundle 里，客户端用 buildMenu 合成，所以这个响应只有几 KB。
 * fail-open：读失败回 snapshot 标记，网站继续吃代码常量。
 * CORS：dashboard（file://）也读它来渲染「菜单排期」页。
 */
export const dynamic = 'force-dynamic';

export function OPTIONS() {
    return corsPreflight();
}

export async function GET() {
    try {
        const { loadMenuRuntime } = await import('@/lib/menuRuntime.server');
        const data = await loadMenuRuntime();
        return corsify(NextResponse.json(data, {
            headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=60' },
        }));
    } catch (err) {
        console.error('menu GET error:', err);
        return corsify(NextResponse.json(EMPTY_RUNTIME, { headers: { 'Cache-Control': 'no-store' } }));
    }
}
