import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/admin/wa-media?id=<mediaId> —— 客户在 WhatsApp 里发来的图片/文件的取件口。
 *
 * 为什么要代理而不是把链接直接给浏览器：
 *   Meta 的媒体 URL 有两个特性 —— 只活 5 分钟，且**必须带 access token 才能取**。
 *   把 token 交给浏览器等于把永久 token 泄露给任何能打开 dashboard 的人，所以
 *   由服务端换取一次、把字节流回给已鉴权的老板。
 *
 * 两跳：GET /{media-id} 拿一次性 url → 带 Bearer GET 那个 url → 原样流回。
 *
 * 鉴权与 CORS 同 /api/admin/wa-lead（Desktop 版 dashboard 从 file:// 调）。
 * 注意：浏览器的 <img src> 不会带 Authorization 头，前端必须 fetch + blob URL。
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = ['hello@incredibowl.my', 'incredibowl.my@gmail.com'];
const GRAPH = 'https://graph.facebook.com/v20.0';
/** 媒体最大 100MB（Meta 上限就是这个量级），防止一次请求把函数内存吃穿。 */
const MAX_BYTES = 100 * 1024 * 1024;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function corsify(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;
  try {
    const { getAdminDb } = await import('@/lib/firebase-admin');
    getAdminDb(); // 初始化 admin app
    const { getAuth } = await import('firebase-admin/auth');
    const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
    return !!decoded.email && ADMIN_EMAILS.includes(decoded.email);
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return corsify(NextResponse.json({ error: '未授权访问' }, { status: 403 }));
  }
  const id = (new URL(req.url).searchParams.get('id') || '').trim();
  if (!/^\d{5,40}$/.test(id)) {
    return corsify(NextResponse.json({ error: 'media id 不合法' }, { status: 400 }));
  }
  const token = process.env.WA_ACCESS_TOKEN;
  if (!token) {
    return corsify(NextResponse.json({ error: 'WA_ACCESS_TOKEN 未配置' }, { status: 503 }));
  }

  try {
    const metaRes = await fetch(`${GRAPH}/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    const meta: any = await metaRes.json().catch(() => ({}));
    if (!metaRes.ok || !meta?.url) {
      return corsify(NextResponse.json({ error: `Meta 取不到这个媒体：${meta?.error?.message || metaRes.status}` }, { status: 502 }));
    }
    if (Number(meta.file_size) > MAX_BYTES) {
      return corsify(NextResponse.json({ error: '文件太大，去手机上看' }, { status: 413 }));
    }

    const fileRes = await fetch(String(meta.url), {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!fileRes.ok || !fileRes.body) {
      return corsify(NextResponse.json({ error: `下载失败 ${fileRes.status}` }, { status: 502 }));
    }

    const headers = new Headers(CORS_HEADERS);
    headers.set('Content-Type', String(meta.mime_type || fileRes.headers.get('content-type') || 'application/octet-stream'));
    // private：这是客户发来的内容，不进任何共享缓存
    headers.set('Cache-Control', 'private, max-age=3600');
    const len = fileRes.headers.get('content-length');
    if (len) headers.set('Content-Length', len);
    return new Response(fileRes.body, { status: 200, headers });
  } catch (err: any) {
    console.error('[admin/wa-media] failed:', err);
    return corsify(NextResponse.json({ error: String(err?.message || err).slice(0, 200) }, { status: 500 }));
  }
}
