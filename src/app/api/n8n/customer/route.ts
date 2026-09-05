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
    const uid = userSnap ? userSnap.id : `manual_${phoneDigits}`; // 券/credit 仍按这个主 uid 查

    // ⚠️ 手动单的 userId 用的是**本地号码格式**（`manual_0125230066`），而 WhatsApp
    // webhook 传进来的 msg.from 是国际格式（`60125230066`）。只拼 `manual_${digits}`
    // 会得到 `manual_60125230066` —— 对不上任何一笔，全库 266 笔手动单客户对 bot
    // 完全隐形，「老客一键复购」会对几乎所有纯 WhatsApp 老客退化成陌生人接待。
    // 两种格式都查（单字段 in 查询，自动索引，不需要建复合索引）。
    const localDigits = phoneDigits.startsWith('60') ? `0${phoneDigits.slice(2)}` : phoneDigits;
    const uidCandidates = Array.from(new Set([
      ...(userSnap ? [userSnap.id] : []),
      `manual_${phoneDigits}`,
      `manual_${localDigits}`,
    ])).slice(0, 10); // Firestore in 查询上限，实际最多 3 个

    // ── 并行查：订单 / 餐券 / 加料 credit / 碗妈对话档案（waLeads）──
    const now = Date.now();
    const [ordersQ, vouchersQ, addonCredits, leadSnap] = await Promise.all([
      // 等值查询不需要复合索引；单客户订单量小，内存排序即可
      db.collection('orders').where('userId', 'in', uidCandidates).limit(300).get(),
      userSnap
        ? db.collection('mealVouchers')
            .where('userId', '==', uid)
            .where('status', '==', 'available')
            .get()
        : Promise.resolve(null),
      userSnap
        ? import('@/lib/addonCreditUtils').then(m => m.getAvailableAddonCredits(db, uid)).catch(() => [])
        : Promise.resolve([]),
      // v4：对话记录 + 客户备注 + 人工接管状态都在 waLeads/{国际格式号码}
      db.collection('waLeads').doc(phoneDigits).get().catch(() => null),
    ]);
    const lead = (leadSnap && leadSnap.exists ? leadSnap.data() : {}) as Record<string, any>;
    const { renderTurnsBlock, renderProfileBlock } = await import('@/lib/waWebhook');
    const recentTurnsBlock = renderTurnsBlock(lead.turns, now, 12);
    const profileBlock = renderProfileBlock(lead.profile);
    const humanUntil = Number(lead.humanUntil) || 0;

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
        rawItems: Array.isArray(o.items) ? o.items : [],
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

    // ── 一键复购链接 ────────────────────────────────────
    // 老客剧本的核心：「还是老样子吗？点这里 30 秒付好」。名字→dish id 的映射
    // 和「这道菜下个配送日到底还能不能点」都在服务端算完，n8n 只负责把链接发出去
    // ——让 bot 自己拼 URL / 自己判断可点性，就是 v2 报错菜单那类事故的老路。
    const lastOrder = all
      .filter(o => o.deliveryDate < today && o.status !== 'cancelled')
      .sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate))[0];
    let reorder: {
      items: { dishId: number; name: string; qty: number }[];
      meal: 'lunch' | 'dinner';
      url: string; urlEn: string; summary: string; dropped: string[];
    } | null = null;
    if (lastOrder) {
      const { weeklyMenu } = await import('@/data/weeklyMenu');
      const picked: { dishId: number; name: string; qty: number }[] = [];
      const dropped: string[] = [];
      for (const it of lastOrder.rawItems) {
        const nm = String((it as any)?.name || '');
        if (!nm || nm.trimStart().startsWith('↳')) continue; // 加料行不参与复购链接
        const dish = weeklyMenu.find(d => !d.retired && !d.hidden && (d.name === nm || d.nameEn === nm));
        const qty = Math.max(1, Math.floor(Number((it as any)?.quantity) || 1));
        if (!dish) { dropped.push(nm); continue; }
        picked.push({ dishId: dish.id, name: dish.name, qty });
      }
      // ⚠️ 这里**故意不判**「这道菜下个配送日能不能点」。判它需要一份 MYT 正确的
      // 配送日计算，而 computeMenuDates 是客户端函数（用本地 getHours，服务器跑在
      // UTC 上会差 8 小时）——再抄一份日期逻辑正是 memory 里记的事故根因。
      // /o 页收到链接后会把每道菜落到它各自的最近可点日，点不了的还会明确告诉客户。
      // 判断留在唯一有正确时钟的地方。
      if (picked.length) {
        const meal: 'lunch' | 'dinner' = lastOrder.mealType === 'dinner' ? 'dinner' : 'lunch';
        const qs = `items=${picked.map(p => `${p.dishId}x${p.qty}`).join(',')}&meal=${meal}&ref=wa`;
        reorder = {
          items: picked, meal, dropped,
          summary: picked.map(p => `${p.name}×${p.qty}`).join(' + '),
          url: `${SITE}/o?${qs}`,
          urlEn: `${SITE}/en/o?${qs}`,
        };
      }
    }

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
    // 客户备注紧跟档案（同属「关于这个人」的信息）；对话记录单独一个字段，
    // 由 n8n Context Builder 放到提示词里它该在的位置。
    if (profileBlock) lines.push(profileBlock);

    return NextResponse.json({
      found,
      profile: {
        name, isMember: !!userSnap, addressText, hasVerifiedCoords,
        totalOrders, totalSpent: Number(totalSpent.toFixed(2)),
      },
      waProfile: (lead.profile && typeof lead.profile === 'object') ? lead.profile : {},
      recentTurns: Array.isArray(lead.turns) ? lead.turns.slice(-12) : [],
      recentTurnsBlock,
      human: humanUntil > now,
      humanUntil,
      vouchers: { available: voucherCount, soonestExpiry: soonestExpiryMs ? ymdKL(soonestExpiryMs) : null },
      addonCredits: (addonCredits as any[]).map(c => ({ addonId: c.addonId, name: c.addonName, remaining: c.remaining })),
      activeOrders: active,
      recentOrders: recent,
      reorder,
      contextBlock: lines.join('\n'),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    console.error('[n8n/customer] failed:', err);
    // bot 链路 fail-open：给一个不会误导的空档案块，别把整条客服链拖挂
    return NextResponse.json({
      found: false,
      error: err?.message || 'lookup failed',
      contextBlock: '【客户档案】查询暂时失败 —— 不要假设客户身份，正常接待即可。',
      recentTurnsBlock: '【最近对话】（记录暂时读不到 —— 按客户这条消息本身回答，别假装记得之前聊过什么）',
    }, { status: 200 });
  }
}
