import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/n8n/customer?phone=60xxxxxxxxx — 碗妈 bot 的客户档案查询。
 *
 * 按来电号码聚合：会员资料（姓名/已验证地址）、餐券余额、预付加料 credit、
 * 进行中订单（含 /track 链接）、近期订单。返回 ready-to-inject 的中文
 * contextBlock（与 /api/n8n/menu 的 today_menu 同思路——服务端拼好，n8n 不拼字）。
 *
 * 隐私边界：n8n 只会用「发消息进来的那个号码」查询，返回的数据只发给
 * 该号码本人 —— bot 永远不拿 A 的号码去答 B 的问题。
 *
 * 查不到会员时兜底查 manual_<digits> 的订单（纯 WhatsApp 老客也有历史）。
 *
 * Auth（与 /api/n8n/menu 同款）：Bearer N8N_API_KEY 或 ?key=。
 */

let adminDb: FirebaseFirestore.Firestore | null = null;
async function getDb() {
  if (adminDb) return adminDb;
  const { getAdminDb } = await import('@/lib/firebase-admin');
  adminDb = getAdminDb();
  return adminDb;
}

const SITE = 'https://www.incredibowl.my';
const ACTIVE_STATUSES = new Set(['pending', 'confirmed', 'delivering']);
const STATUS_ZH: Record<string, string> = {
  pending: '待确认收款',
  confirmed: '已确认 · 备餐中',
  delivering: '配送中',
  delivered: '已送达',
  cancelled: '已取消',
};
const WD_CN = ['日', '一', '二', '三', '四', '五', '六'];

function todayKL(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}
function ymdKL(ms: number): string {
  return new Date(ms + 8 * 3600 * 1000).toISOString().slice(0, 10);
}
function itemsSummary(items: any[]): string {
  if (!Array.isArray(items)) return '';
  return items
    .map(it => `${String(it?.name || '')}${Number(it?.quantity) > 1 ? `×${Number(it.quantity)}` : ''}`)
    .filter(Boolean).join(' + ');
}
function dateZh(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const wd = new Date(`${ymd}T00:00:00`).getDay();
  return `${ymd.slice(5).replace('-', '/')}（周${WD_CN[wd]}）`;
}

export async function GET(req: NextRequest) {
  // ── Auth：返回客户 PII，只收 Authorization 头（?key= 会漏进日志）+ 常数时间比较
  const expected = process.env.N8N_API_KEY;
  if (!expected) {
    return NextResponse.json({ error: 'N8N_API_KEY not configured on server' }, { status: 500 });
  }
  const suppliedKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const { timingSafeEqual } = await import('node:crypto');
  const expBuf = Buffer.from(expected);
  const gotBuf = Buffer.from(suppliedKey);
  if (gotBuf.length !== expBuf.length || !timingSafeEqual(gotBuf, expBuf)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);

  const phoneRaw = String(url.searchParams.get('phone') || '').trim();
  const phoneDigits = phoneRaw.replace(/\D/g, '');
  if (!phoneDigits) return NextResponse.json({ error: '缺 phone' }, { status: 400 });

  try {
    const db = await getDb();
    const { normalizePhone } = await import('@/lib/phoneUtils');
    const { findUserByNormalizedPhone } = await import('@/lib/adminUserLookup');

    const normalized = normalizePhone(phoneRaw);
    const userSnap = normalized ? await findUserByNormalizedPhone(db, normalized) : null;
    const user = userSnap ? (userSnap.data() as Record<string, any>) : null;
    const uid = userSnap ? userSnap.id : `manual_${phoneDigits}`; // 纯 WhatsApp 客户的订单挂在 manual_*

    // ── 并行查：订单 / 餐券 / 加料 credit ──────────────
    const now = Date.now();
    const [ordersQ, vouchersQ, addonCredits] = await Promise.all([
      // 等值查询不需要复合索引；单客户订单量小，内存排序即可
      db.collection('orders').where('userId', '==', uid).limit(300).get(),
      userSnap
        ? db.collection('mealVouchers')
            .where('userId', '==', uid)
            .where('status', '==', 'available')
            .get()
        : Promise.resolve(null),
      userSnap
        ? import('@/lib/addonCreditUtils').then(m => m.getAvailableAddonCredits(db, uid)).catch(() => [])
        : Promise.resolve([]),
    ]);

    // 餐券：available + 未过期（过期靠读取时过滤，库里没有 cron 翻状态）
    let voucherCount = 0;
    let soonestExpiryMs: number | null = null;
    if (vouchersQ) {
      for (const doc of vouchersQ.docs) {
        const exp = doc.data().expiresAt;
        const ms = exp && typeof exp.toMillis === 'function' ? exp.toMillis() : 0;
        if (ms > now) {
          voucherCount++;
          if (soonestExpiryMs === null || ms < soonestExpiryMs) soonestExpiryMs = ms;
        }
      }
    }

    // 订单：进行中（今天起 + 状态活跃）/ 近期（最近 3 单历史）
    const today = todayKL();
    const all = ordersQ.docs.map(doc => {
      const o = doc.data();
      return {
        id: doc.id,
        deliveryDate: String(o.deliveryDate || ''),
        mealType: String(o.mealType || ''),
        deliveryTime: String(o.deliveryTime || ''),
        status: String(o.status || ''),
        items: itemsSummary(o.items),
        trackToken: typeof o.trackToken === 'string' ? o.trackToken : '',
        userName: String(o.userName || ''),
      };
    });
    const active = all
      .filter(o => o.deliveryDate >= today && ACTIVE_STATUSES.has(o.status))
      .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate))
      .slice(0, 8)
      .map(o => ({
        deliveryDate: o.deliveryDate,
        meal: o.mealType === 'dinner' ? '晚餐' : '午餐',
        status: o.status,
        statusZh: STATUS_ZH[o.status] || o.status,
        items: o.items,
        trackUrl: o.trackToken ? `${SITE}/track/${o.trackToken}` : null,
      }));
    const recent = all
      .filter(o => o.deliveryDate < today && o.status !== 'cancelled')
      .sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate))
      .slice(0, 3)
      .map(o => ({ deliveryDate: o.deliveryDate, items: o.items }));

    const found = !!userSnap || all.length > 0;
    const name = user?.displayName || all[0]?.userName || '';
    const addressText = user?.address ? String(user.address) : '';
    const hasVerifiedCoords = typeof user?.addressLat === 'number' && typeof user?.addressLng === 'number';
    const totalOrders = Number(user?.totalOrders) || all.length;
    const totalSpent = Number(user?.totalSpent) || 0;

    // ── contextBlock：直接进 system prompt 的中文块 ────
    const lines: string[] = [];
    if (!found) {
      lines.push('【客户档案】按这个号码没查到任何记录 —— 大概率是新客。热情接待，地址要完整问一遍。');
    } else {
      lines.push('【客户档案】（按来电号码自动查到，仅限回答该客户本人）');
      lines.push(`- ${name ? `${name}` : '（没记录到名字）'}${userSnap ? '，注册会员' : '，WhatsApp 老客（未注册）'}，历史 ${totalOrders} 单${totalSpent > 0 ? `（累计 RM ${totalSpent.toFixed(0)}）` : ''}`);
      if (addressText) {
        lines.push(`- 常用地址：${addressText}${hasVerifiedCoords ? '（已验证）' : ''} —— 下单先确认「还是送这里吗」，客户点头就不用再要地址`);
      }
      if (voucherCount > 0) {
        lines.push(`- 餐券：可用 ${voucherCount} 张${soonestExpiryMs ? `，最早 ${ymdKL(soonestExpiryMs)} 到期` : ''}（注意：餐券单走网站或找老板扣，碗妈这边的 QR 下单是现金全额，别混）`);
      }
      if (Array.isArray(addonCredits) && addonCredits.length > 0) {
        lines.push(`- 预付加料：${addonCredits.map((c: any) => `${c.addonName}×${c.remaining}`).join('、')}`);
      }
      if (active.length > 0) {
        lines.push('- 进行中订单：');
        for (const o of active) {
          lines.push(`  · ${dateZh(o.deliveryDate)}${o.meal} ${o.items} —— ${o.statusZh}${o.trackUrl ? ` 跟踪 ${o.trackUrl}` : ''}`);
        }
      }
      if (recent.length > 0 && active.length === 0) {
        lines.push(`- 上次点过：${recent.map(r => `${dateZh(r.deliveryDate)} ${r.items}`).join('；')}`);
      }
    }

    return NextResponse.json({
      found,
      profile: {
        name, isMember: !!userSnap, addressText, hasVerifiedCoords,
        totalOrders, totalSpent: Number(totalSpent.toFixed(2)),
      },
      vouchers: { available: voucherCount, soonestExpiry: soonestExpiryMs ? ymdKL(soonestExpiryMs) : null },
      addonCredits: (addonCredits as any[]).map(c => ({ addonId: c.addonId, name: c.addonName, remaining: c.remaining })),
      activeOrders: active,
      recentOrders: recent,
      contextBlock: lines.join('\n'),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    console.error('[n8n/customer] failed:', err);
    // bot 链路 fail-open：给一个不会误导的空档案块，别把整条客服链拖挂
    return NextResponse.json({
      found: false,
      error: err?.message || 'lookup failed',
      contextBlock: '【客户档案】查询暂时失败 —— 不要假设客户身份，正常接待即可。',
    }, { status: 200 });
  }
}
