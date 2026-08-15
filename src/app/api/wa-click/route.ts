import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/wa-click —— 「客户点了碗妈发的下单链接」的公开回传口。
 *
 * 为什么必须是公开端点：调用方是客户浏览器里的 /o 页，那里放不了 N8N_API_KEY。
 * 所以这里**不接受手机号，只接受一个不可枚举的 clickToken**（lead 建立时随机生成）。
 * 最坏情况：有人猜中 token 把一条 lead 误标成 clicked —— 后果仅仅是少发一次追单，
 * 不泄露任何客户资料，也建不了单、扣不了库存。
 *
 * 这条数据回答的是整个 v3 方案里唯一没验证过的假设：**客户到底肯不肯点链接。**
 * 两周后 clicked / engaged 的比值就是答案。
 */

let adminDb: FirebaseFirestore.Firestore | null = null;
async function getDb() {
  if (adminDb) return adminDb;
  const { getAdminDb } = await import('@/lib/firebase-admin');
  adminDb = getAdminDb();
  return adminDb;
}

export async function POST(req: NextRequest) {
  let token = '';
  try {
    const body = await req.json();
    token = String(body?.t || '').trim();
  } catch {
    /* 畸形 body 当没 token 处理 */
  }
  // token 形状固定（两段 base36），先在内存里挡掉明显的乱试，不去打 Firestore
  if (!/^[a-z0-9]{8,32}$/.test(token)) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  try {
    const db = await getDb();
    const q = await db.collection('waLeads').where('clickToken', '==', token).limit(1).get();
    if (q.empty) return NextResponse.json({ ok: false }, { status: 200 });

    const doc = q.docs[0];
    const d = doc.data() as Record<string, any>;
    const now = Date.now();
    const patch: Record<string, any> = {
      clickCount: (Number(d.clickCount) || 0) + 1,
      lastClickAtMs: now,
      updatedAtMs: now,
    };
    // 首次点击才升级状态 —— 已成交/已关闭的 lead 不该被一次回访拉回 clicked
    if (!d.clickedAtMs) patch.clickedAtMs = now;
    if (d.status === 'engaged') patch.status = 'clicked';
    await doc.ref.update(patch);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error('[wa-click] failed:', err);
    // 埋点失败绝不能影响客户下单 —— 一律回 200
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
