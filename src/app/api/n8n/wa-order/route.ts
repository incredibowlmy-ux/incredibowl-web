import { NextRequest, NextResponse } from 'next/server';
import { ADD_ON_PRICES } from '@/data/addOnsConfig';
import { resolveAddon, resolveDishName } from '@/lib/waOrderResolve';
import {
  buildPlan, resolveManualUserId, writeManualOrderDays,
  round2, WD_CN, type PlannedDay,
} from '@/lib/manualOrderCore';
import {
  distanceFromPearlPointKm, zoneFromDistance, isBeyondServiceRange,
  resolveDeliveryFee, freeDeliveryShortfall, thresholdForDistance,
  type DeliveryZone,
} from '@/lib/deliveryUtils';
import { generateTrackToken } from '@/lib/trackingUtils';

/**
 * POST /api/n8n/wa-order — 碗妈 WhatsApp bot 的下单闭环（服务端权威计价）。
 *
 * 链路：AI 收齐菜+日期+地址 → action:draft（现价重算 + 运费按距离/门槛算 +
 * 存草稿）→ 碗妈用 summaryText 报单发 QR → 客户传付款截图转发老板 →
 * 老板引用截图回「1」→ n8n 调 action:confirm → 复用 manualOrderCore
 * 落 confirmed 手动单（与 dashboard 多日手动单同一套字段口径 + 扣两层库存）。
 *
 * actions:
 *   draft   { phone, customerName, address? | lat/lng?, days[], note? }
 *           地址可省略 —— 省略时用会员档案的已验证地址+坐标（老客零重复输入）。
 *           菜/加料一律服务端定价：菜=weeklyMenu 现价，加料=ADD_ON_PRICES
 *           （id 从 DISH_ADDONS_BY_NAME 按中文名解析），绝不信 AI 报价。
 *   peek    { phone }            → 最新 pending 草稿摘要（付款截图转发老板时带上）
 *   confirm { phone, draftId? }  → 按草稿冻结价建单（不重算 —— 客户按草稿付的款），
 *           batchTag 幂等，重复「1」返回 alreadyConfirmed 不重复建单。
 *   void    { phone }            → 客户反悔，作废 pending 草稿。
 *
 * 业务失败一律 HTTP 200 + { ok:false, error }（n8n 工具链对非 2xx 不友好）；
 * 只有鉴权/格式错误才回 4xx/5xx。
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

const DRAFTS = 'waOrderDrafts';
const DRAFT_TTL_MS = 24 * 3600 * 1000;
const MAX_DAYS = 7;
const MAX_ITEMS_PER_DAY = 12;
const MAX_QTY = 20;

const biz = (payload: Record<string, unknown>) => NextResponse.json(payload); // 业务结果恒 200

// ── 内联 geocode（与 check-delivery 同参数；repo 里本就是各调用点内联的模式）──
async function geocodeAddress(address: string): Promise<
  { ok: true; lat: number; lng: number; formatted: string } | { ok: false; error: string }
> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return { ok: false, error: '地图服务未配置' };
  const params = new URLSearchParams({
    address, region: 'my', components: 'country:MY',
    bounds: '3.04,101.62|3.13,101.72', key: apiKey,
  });
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    if (data.status === 'ZERO_RESULTS') return { ok: false, error: '找不到这个地址，请客户补 condo 名或路名' };
    if (data.status !== 'OK' || !data.results?.length) return { ok: false, error: '地址解析失败，请稍后重试' };
    const top = data.results[0];
    return { ok: true, lat: top.geometry.location.lat, lng: top.geometry.location.lng, formatted: top.formatted_address };
  } catch {
    return { ok: false, error: '地图服务无响应' };
  }
}

/** 草稿里冻结的每天计划（PlannedDay + 该天运费） */
interface DraftDay extends PlannedDay {
  deliveryFeeRM: number;
}

function draftSummaryText(days: DraftDay[], cashDue: number): string {
  const usable = days.filter(d => !d.blocked);
  const lines = usable.map(d => {
    const dishes = d.items.map(it => `${it.name}${it.quantity > 1 ? `×${it.quantity}` : ''}`).join(' + ');
    const addons = d.items.flatMap(it => it.addOns)
      .map(a => `${a.label}${a.quantity > 1 ? `×${a.quantity}` : ''}`);
    const fee = d.deliveryFeeRM > 0 ? `运费 RM ${d.deliveryFeeRM.toFixed(2)}` : '免运费';
    return `周${WD_CN[d.weekday]}（${d.date.slice(5).replace('-', '/')}）${d.meal === 'dinner' ? '晚餐' : '午餐'}：${dishes}${addons.length ? ` +${addons.join('+')}` : ''}（菜品 RM ${d.originalTotal.toFixed(2)}，${fee}）`;
  });
  return `${lines.join('\n')}\n合计：RM ${cashDue.toFixed(2)}`;
}

async function loadDraft(db: FirebaseFirestore.Firestore, phoneDigits: string, draftId?: string) {
  if (draftId) {
    const snap = await db.collection(DRAFTS).doc(draftId).get();
    if (!snap.exists) return null;
    // draftId 必须属于该电话 —— 防止串号确认到别人的草稿
    if (String(snap.data()!.phoneDigits || '') !== phoneDigits) return null;
    return { id: snap.id, data: snap.data()! };
  }
  // 等值双条件不需要复合索引；量小，内存排序取最新
  const q = await db.collection(DRAFTS)
    .where('phoneDigits', '==', phoneDigits)
    .where('status', '==', 'pending')
    .get();
  if (q.empty) return null;
  const docs = q.docs
    .map(d => ({ id: d.id, data: d.data() }))
    .sort((a, b) => (b.data.createdAtMs || 0) - (a.data.createdAtMs || 0));
  return docs[0];
}

export async function POST(req: NextRequest) {
  // ── Auth：本路由能建 confirmed 订单，比 /api/n8n/menu 更硬 ——
  // 只收 Authorization 头（?key= 会漏进访问/代理日志）+ 常数时间比较
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

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: '请求格式错误' }, { status: 400 });

  const action = String(body.action || '');
  const phoneRaw = String(body.phone || '').trim();
  const phoneDigits = phoneRaw.replace(/\D/g, '');
  if (!phoneDigits) return NextResponse.json({ error: '缺 phone' }, { status: 400 });

  const db = await getDb();

  // ════════ peek：最新待付草稿（付款截图转发老板时带摘要）════════
  if (action === 'peek') {
    const draft = await loadDraft(db, phoneDigits);
    if (!draft || (draft.data.expiresAtMs || 0) < Date.now()) return biz({ found: false });
    return biz({
      found: true,
      draftId: draft.id,
      customerName: draft.data.customerName || '',
      cashDue: draft.data.cashDue || 0,
      summaryText: draft.data.summaryText || '',
      ageMinutes: Math.round((Date.now() - (draft.data.createdAtMs || Date.now())) / 60000),
    });
  }

  // ════════ void：客户反悔，作废 pending 草稿 ════════
  if (action === 'void') {
    const q = await db.collection(DRAFTS)
      .where('phoneDigits', '==', phoneDigits)
      .where('status', '==', 'pending')
      .get();
    for (const doc of q.docs) {
      await doc.ref.update({ status: 'voided', voidedAtMs: Date.now() });
    }
    return biz({ ok: true, voided: q.size });
  }

  // ════════ confirm：老板收款后建单（草稿冻结价，不重算）════════
  if (action === 'confirm') {
    let draft: { id: string; data: FirebaseFirestore.DocumentData } | null = null;
    if (body.draftId) {
      draft = await loadDraft(db, phoneDigits, String(body.draftId));
    } else {
      // pending / confirming / confirmed 都要能找到 —— 老板连发「1」或 n8n 重试
      // 必须拿到同一张草稿做幂等应答，而不是回「没有草稿」。
      const q = await db.collection(DRAFTS)
        .where('phoneDigits', '==', phoneDigits)
        .where('status', 'in', ['pending', 'confirming', 'confirmed'])
        .get();
      const docs = q.docs.map(x => ({ id: x.id, data: x.data() }))
        .sort((a, b) => (b.data.createdAtMs || 0) - (a.data.createdAtMs || 0));
      draft = docs[0] || null;
    }
    if (!draft) return biz({ ok: false, error: '没有待付订单草稿（客户可能没走碗妈下单流程）' });

    const d = draft.data;
    const draftRef = db.collection(DRAFTS).doc(draft.id);

    if (d.status === 'confirmed') {
      return biz({ ok: true, alreadyConfirmed: true, created: d.createdOrders || [], cashDue: d.cashDue || 0, summaryText: d.summaryText || '' });
    }
    if ((d.expiresAtMs || 0) < Date.now()) return biz({ ok: false, error: '草稿已过期（超 24 小时），请客户重新下单' });

    // batchTag 兜底幂等（与 multi-day 同款查重；也兜住 confirming 卡死后的重试）
    const existing = await db.collection('orders').where('batchTag', '==', d.batchTag).limit(1).get();
    if (!existing.empty) {
      await draftRef.update({ status: 'confirmed', confirmedAtMs: Date.now() });
      return biz({ ok: true, alreadyConfirmed: true, created: d.createdOrders || [], cashDue: d.cashDue || 0, summaryText: d.summaryText || '' });
    }

    // 原子认领 pending→confirming：并发的第二个 confirm（老板连点「1」/n8n 超时重试）
    // 在这里被挡下，绝不双建单双扣库存；进程崩掉卡死的 confirming 3 分钟后可重领。
    const claim = await db.runTransaction(async tx => {
      const snap = await tx.get(draftRef);
      const cur = snap.data() || {};
      const staleClaim = cur.status === 'confirming'
        && Date.now() - (Number(cur.confirmingAtMs) || 0) > 3 * 60 * 1000;
      if (cur.status === 'pending' || staleClaim) {
        tx.update(draftRef, { status: 'confirming', confirmingAtMs: Date.now() });
        return 'claimed';
      }
      return String(cur.status || 'unknown');
    });
    if (claim !== 'claimed') {
      if (claim === 'confirmed') {
        return biz({ ok: true, alreadyConfirmed: true, created: d.createdOrders || [], cashDue: d.cashDue || 0, summaryText: d.summaryText || '' });
      }
      if (claim === 'confirming') {
        return biz({ ok: false, error: '这张草稿正在建单中（可能几秒前刚确认过一次），稍等片刻到 dashboard 核对即可，别重复确认' });
      }
      return biz({ ok: false, error: `草稿状态是 ${claim}，不能确认` });
    }

    // 可下单性（CLOSED/BLOCKED）沿用草稿冻结时的判定 —— 客户已按草稿金额付款，
    // 24h 窗口内新增的停业日不在这里重拦，交给老板在 dashboard 看到后人工处理。
    const days = (Array.isArray(d.days) ? d.days : []) as DraftDay[];
    const usable = days.filter(x => !x.blocked);
    if (usable.length === 0) {
      await draftRef.update({ status: 'pending' }); // 放回去，别把草稿卡死在 confirming
      return biz({ ok: false, error: '草稿里没有可建单的天' });
    }

    const draftLat = Number(d.lat), draftLng = Number(d.lng);
    const hasCoords = Number.isFinite(draftLat) && Number.isFinite(draftLng) && !(draftLat === 0 && draftLng === 0);

    const created = await writeManualOrderDays({
      db, usableDays: usable,
      userId: d.userId || `manual_${phoneDigits}`,
      customerName: String(d.customerName || ''),
      customerPhone: String(d.phone || phoneRaw),
      customerAddress: String(d.address || ''),
      deliveryZone: (d.zone === 'outside2km' ? 'outside2km' : 'within2km'),
      deliveryDistanceKm: Number(d.distanceKm) || 0,
      deliveryTier: ['near', 'mid', 'far'].includes(d.tier) ? d.tier : 'near',
      paymentMethod: 'qr',
      batchTag: String(d.batchTag),
      createdBy: 'bowlmama-bot',
      noteBase: '手动录入 · whatsapp · 碗妈bot下单',
      custNote: String(d.note || ''),
      feeForDay: (day) => Number((day as DraftDay).deliveryFeeRM) || 0,
      stockSource: 'WA碗妈bot',
      // 与网页单看齐：trackToken 建单即发；草稿坐标一并落单（路线规划第一层直接命中，
      // 位置 pin 下的单地址是「坐标定位 …」占位串，没有坐标 Geocoding 会失配）
      perOrderExtras: () => ({
        trackToken: generateTrackToken(),
        ...(hasCoords ? { deliveryLat: draftLat, deliveryLng: draftLng } : {}),
      }),
    });

    await draftRef.update({ status: 'confirmed', confirmedAtMs: Date.now(), createdOrders: created });

    console.log(`[wa-order] confirm：${d.customerName}（${phoneDigits}）建 ${created.length} 单（${d.batchTag}）`);
    return biz({ ok: true, created, cashDue: d.cashDue || 0, summaryText: d.summaryText || '' });
  }

  // ════════ draft：服务端计价 + 存草稿 ════════
  if (action === 'draft') {
    const customerName = String(body.customerName || '').trim();
    if (!customerName) return biz({ ok: false, error: '缺客户姓名' });
    const rawDays: any[] = Array.isArray(body.days) ? body.days : [];
    if (rawDays.length === 0) return biz({ ok: false, error: '至少要一天的菜' });
    if (rawDays.length > MAX_DAYS) return biz({ ok: false, error: `一次最多排 ${MAX_DAYS} 天` });

    // ── 会员档案（地址兜底 + 老客免运 grandfathering）──
    const { normalizePhone } = await import('@/lib/phoneUtils');
    const { findUserByNormalizedPhone } = await import('@/lib/adminUserLookup');
    const normalized = normalizePhone(phoneRaw);
    const userSnap = normalized ? await findUserByNormalizedPhone(db, normalized) : null;
    const user = userSnap ? (userSnap.data() as Record<string, any>) : null;
    const customerCreatedAtMs: number | null =
      user?.createdAt && typeof user.createdAt.toMillis === 'function' ? user.createdAt.toMillis() : null;

    // ── 地址/坐标：显式坐标 > 显式地址(geocode) > 会员已验证地址 ──
    let lat: number | null = null, lng: number | null = null;
    let addressText = String(body.address || '').trim();
    let formattedAddress = '';
    const bodyLat = Number(body.lat), bodyLng = Number(body.lng);
    if (Number.isFinite(bodyLat) && Number.isFinite(bodyLng) && bodyLat !== 0 && bodyLng !== 0) {
      lat = bodyLat; lng = bodyLng;
      if (!addressText) addressText = `坐标定位 ${bodyLat.toFixed(5)}, ${bodyLng.toFixed(5)}`;
      formattedAddress = addressText;
    } else if (addressText.length >= 4) {
      const geo = await geocodeAddress(addressText);
      if (!geo.ok) return biz({ ok: false, error: geo.error });
      lat = geo.lat; lng = geo.lng; formattedAddress = geo.formatted;
    } else if (user && typeof user.addressLat === 'number' && typeof user.addressLng === 'number' && user.address) {
      lat = user.addressLat; lng = user.addressLng;
      addressText = String(user.address);
      formattedAddress = String(user.addressFormatted || user.address);
    } else {
      return biz({ ok: false, error: '缺配送地址（客户不是会员或会员档案没有已验证地址），请先问客户要地址' });
    }

    const distanceKm = distanceFromPearlPointKm(lat!, lng!);
    if (isBeyondServiceRange(distanceKm)) {
      return biz({ ok: false, error: `地址距离 ${distanceKm.toFixed(1)}km，超出 25km 配送上限`, outside: true, distanceKm: round2(distanceKm) });
    }
    const zone: DeliveryZone = zoneFromDistance(distanceKm);

    // ── 菜 + 加料解析（服务端定价，绝不信 AI 报价）──
    const addonWarnings: string[] = [];
    const planDays = rawDays.map((entry: any) => {
      const rawItems: any[] = Array.isArray(entry?.items) ? entry.items : [];
      if (rawItems.length > MAX_ITEMS_PER_DAY) {
        addonWarnings.push(`${entry?.date || ''} 菜品超过 ${MAX_ITEMS_PER_DAY} 项，只保留了前 ${MAX_ITEMS_PER_DAY} 项 —— 请人工核对`);
      }
      const items = rawItems.slice(0, MAX_ITEMS_PER_DAY).map((it: any) => {
        const dishName = resolveDishName(it?.dish ?? it?.dishName ?? it?.name);
        const qty = Math.min(MAX_QTY, Math.max(1, Math.floor(Number(it?.qty ?? it?.quantity) || 1)));
        const addOns = (Array.isArray(it?.addOns) ? it.addOns : []).map((a: any) => {
          const rawName = String(a?.name ?? a?.label ?? a?.id ?? '').trim();
          const aQty = Math.min(MAX_QTY, Math.max(1, Math.floor(Number(a?.qty ?? a?.quantity) || 1)));
          const opt = resolveAddon(dishName, rawName);
          if (!opt) {
            addonWarnings.push(`加料「${rawName}」在「${dishName}」下没匹配到，已忽略 —— 请人工核对`);
            return null;
          }
          const price = ADD_ON_PRICES[opt.id] ?? opt.price; // 权威价优先，生成表兜底
          return { id: opt.id, label: opt.label, price, quantity: aQty };
        }).filter(Boolean);
        return { dishName, qty, addOns };
      });
      return { date: String(entry?.date || ''), meal: entry?.meal === 'dinner' ? 'dinner' : 'lunch', time: entry?.time, items };
    });

    const { days, errors } = buildPlan(planDays, 0); // 运费下面按距离/门槛逐天算
    if (errors.length) return biz({ ok: false, error: errors.join('；') });
    if (days.length === 0) return biz({ ok: false, error: '没有可用的天' });

    // ── 每天运费：与网站同源 resolveDeliveryFee（含 05-16 前老客 ≤2km 免运）──
    const draftDays: DraftDay[] = days.map(d => {
      const resolved = resolveDeliveryFee(distanceKm, zone, d.originalTotal, customerCreatedAtMs);
      const fee = resolved ? resolved.fee : 0;
      return { ...d, deliveryFeeRM: round2(fee), cashDue: round2(d.originalTotal + fee) };
    });
    const usable = draftDays.filter(d => !d.blocked);
    if (usable.length === 0) {
      return biz({ ok: false, error: `全部日期被拦下：${draftDays.flatMap(d => d.warnings).join('；') || '看警告'}` });
    }

    const foodTotal = round2(usable.reduce((s, d) => s + d.originalTotal, 0));
    const deliveryTotal = round2(usable.reduce((s, d) => s + d.deliveryFeeRM, 0));
    const cashDue = round2(foodTotal + deliveryTotal);

    // 免运差额提示（给 AI 做自然加购话术；只提示第一天且差 ≤ RM15 才有意义）
    let upsellHint = '';
    const firstDay = usable[0];
    const shortfall = freeDeliveryShortfall(distanceKm, firstDay.originalTotal);
    const threshold = thresholdForDistance(distanceKm);
    if (firstDay.deliveryFeeRM > 0 && threshold !== null && shortfall > 0 && shortfall <= 15) {
      upsellHint = `菜品再加 RM ${shortfall.toFixed(2)}（满 RM ${threshold}）当天就免运费`;
    }

    const resolvedTierRaw = resolveDeliveryFee(distanceKm, zone, 0, customerCreatedAtMs)?.tier ?? 'near';
    const tier = resolvedTierRaw === 'free' ? 'near' : resolvedTierRaw; // 订单 doc 只收 near/mid/far

    const userId = await resolveManualUserId(db, userSnap ? userSnap.id : '', phoneRaw);

    // 新草稿顶掉旧的 pending（避免老板确认到过期草稿）
    const stale = await db.collection(DRAFTS)
      .where('phoneDigits', '==', phoneDigits)
      .where('status', '==', 'pending')
      .get();
    for (const doc of stale.docs) {
      await doc.ref.update({ status: 'superseded', supersededAtMs: Date.now() });
    }

    // 时间戳+电话尾号+随机，杜绝同毫秒两客户撞 tag（撞了第二单会被幂等查重吞掉）
    const batchTag = `wa-${Date.now()}-${phoneDigits.slice(-4)}${Math.random().toString(36).slice(2, 6)}`;
    const summaryText = draftSummaryText(draftDays, cashDue);
    const warnings = [...addonWarnings, ...draftDays.flatMap(d => d.warnings)];

    const { FieldValue } = await import('firebase-admin/firestore');
    const ref = await db.collection(DRAFTS).add({
      phone: phoneRaw, phoneDigits, phoneNormalized: normalized || '',
      userId, customerName,
      address: addressText, formattedAddress, lat, lng,
      distanceKm: round2(distanceKm), zone, tier,
      days: JSON.parse(JSON.stringify(draftDays)), // 冻结价（客户按这个数付款）
      foodTotal, deliveryTotal, cashDue,
      warnings,
      note: String(body.note || '').trim(),
      paymentMethod: 'qr',
      status: 'pending', batchTag,
      source: 'bowlmama-bot',
      summaryText,
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + DRAFT_TTL_MS,
      createdAt: FieldValue.serverTimestamp(),
    });

    console.log(`[wa-order] draft：${customerName}（${phoneDigits}）RM ${cashDue}（${ref.id}）`);
    return biz({
      ok: true,
      draftId: ref.id, batchTag,
      cashDue, foodTotal, deliveryTotal,
      distanceKm: round2(distanceKm), tier,
      summaryText, warnings, upsellHint,
      skippedDays: draftDays.filter(d => d.blocked).map(d => d.date),
      memberMatched: !!userSnap,
      addressUsed: addressText,
    });
  }

  return NextResponse.json({ error: 'action 必须是 draft / peek / confirm / void' }, { status: 400 });
}
