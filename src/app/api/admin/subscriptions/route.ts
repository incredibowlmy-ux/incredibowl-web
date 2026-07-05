import { NextRequest } from 'next/server';
import { corsPreflight, adminJson, verifyAdminEmail } from '@/lib/adminApi';

/**
 * /api/admin/subscriptions — 常客每周订阅模板 CRUD。
 *
 * 一份 subscription = 一个餐券常客的每周固定吃法（周几吃什么、几点送、默认
 * 加料、运费档），是「生成下周订单」（./week 路由）的输入。取代过去每周为
 * 每个常客手写一个 create-<name>-week-orders.mjs 的流程。
 *
 * GET  → 全部订阅列表
 * POST → upsert { id?, ...fields }；{ id, delete: true } 删除
 */

let adminDb: FirebaseFirestore.Firestore | null = null;
async function getDb() {
  if (adminDb) return adminDb;
  const { getAdminDb } = await import('@/lib/firebase-admin');
  adminDb = getAdminDb();
  return adminDb;
}

export interface SubscriptionPlanItem {
  dishName: string;
  qty: number;
  addOns: { label: string; price: number; quantity: number }[];
}

export interface SubscriptionDay {
  skip?: boolean;
  meal: 'lunch' | 'dinner';
  time: string; // '12:00' / '19:00'
  items: SubscriptionPlanItem[];
}

export interface SubscriptionDoc {
  userId: string;
  name: string;
  phone: string;
  address: string;
  deliveryTier: 'near' | 'mid' | 'far';
  deliveryZone: 'within2km' | 'outside2km';
  deliveryDistanceKm: number;
  deliveryFeePerDelivery: number; // RM per delivery applied to each generated order
  active: boolean;
  note?: string;
  // 每周计划，key = weekday '1'..'5'（周一..周五）
  plan: Record<string, SubscriptionDay>;
}

export async function OPTIONS() { return corsPreflight(); }

export async function GET(req: NextRequest) {
  const adminEmail = await verifyAdminEmail(req);
  if (!adminEmail) return adminJson({ error: '未授权' }, 401);

  const db = await getDb();
  const [snap, usersSnap, ordersSnap] = await Promise.all([
    db.collection('subscriptions').orderBy('name').get(),
    db.collection('users').get(),
    // 最近订单 — 聚合每个客户用过的地址/运费/配送区/备注，前端点选填充；
    // userName/userPhone 用来补「只有手动单、没有 users 档案」的客户进名录
    db.collection('orders').orderBy('createdAt', 'desc').limit(1200)
      .select('userId', 'userName', 'userPhone', 'userAddress', 'deliveryFee', 'deliveryZone', 'deliveryDistanceKm', 'note', 'deliveryDate', 'status', 'partIndex')
      .get(),
  ]);
  const subscriptions = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // 按客户去重聚合历史配送信息（最新在前，每人最多 5 组）。
  // 多段单运费只挂 part 1，后续 part 会产生假的 RM0 选项 → 跳过。
  const optionsByUser = new Map<string, { _k: string; address: string; fee: number; zone: string; distanceKm: number; note: string; lastDate: string }[]>();
  for (const d of ordersSnap.docs) {
    const v = d.data() || {};
    if (v.status === 'cancelled') continue;
    if (Number(v.partIndex) > 1) continue;
    const uid = String(v.userId || '');
    const address = String(v.userAddress || '').trim();
    if (!uid || !address) continue;
    // 「手动录入 · whatsapp…」是 dashboard 系统标记不是客户备注 → 不带出
    const rawNote = String(v.note || '').trim();
    const opt = {
      address,
      fee: Number(v.deliveryFee) || 0,
      zone: v.deliveryZone === 'outside2km' ? 'outside2km' : v.deliveryZone === 'within2km' ? 'within2km' : '',
      distanceKm: Number(v.deliveryDistanceKm) || 0,
      note: rawNote.startsWith('手动录入') ? '' : rawNote,
      lastDate: String(v.deliveryDate || ''),
    };
    const key = `${opt.address}|${opt.fee}|${opt.zone}|${opt.note}`;
    const list = optionsByUser.get(uid) ?? [];
    if (list.length >= 5 || list.some(o => o._k === key)) continue;
    list.push({ ...opt, _k: key });
    optionsByUser.set(uid, list);
  }

  // 轻量客户名录 — 前端「新建常客」搜索自动填充用。userId=真实 uid，
  // 与餐券归属一致（手填 manual_电话 常与券的实际 owner 不符 → 扣券失败）。
  const customers = usersSnap.docs
    .map(d => {
      const v = d.data() || {};
      return {
        userId: d.id,
        name: String(v.displayName || v.name || ''),
        phone: String(v.phone || ''),
        address: String(v.address || ''),
        deliveryDistanceKm: Number(v.deliveryDistanceKm) || 0,
        orderOptions: (optionsByUser.get(d.id) ?? []).map(({ _k, ...o }) => o),
      };
    })
    .filter(c => c.name || c.phone);

  // 补「只在订单里出现过、users 集合没档案」的客户（dashboard 手动单的
  // manual_<电话> 客户，如 Peggy）—— 姓名/电话/地址取最近一单（docs 已按
  // createdAt 倒序，首见即最新）。否则联想搜不到这些老客。
  const knownIds = new Set(customers.map(c => c.userId));
  for (const d of ordersSnap.docs) {
    const v = d.data() || {};
    if (v.status === 'cancelled') continue;
    const uid = String(v.userId || '');
    if (!uid || knownIds.has(uid)) continue;
    const name = String(v.userName || '').trim();
    const phone = String(v.userPhone || '').trim();
    if (!name && !phone) continue;
    knownIds.add(uid);
    customers.push({
      userId: uid,
      name, phone,
      address: String(v.userAddress || ''),
      deliveryDistanceKm: Number(v.deliveryDistanceKm) || 0,
      orderOptions: (optionsByUser.get(uid) ?? []).map(({ _k, ...o }) => o),
    });
  }
  return adminJson({ subscriptions, customers });
}

export async function POST(req: NextRequest) {
  const adminEmail = await verifyAdminEmail(req);
  if (!adminEmail) return adminJson({ error: '未授权' }, 401);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return adminJson({ error: '无效请求体' }, 400);

  const db = await getDb();
  const { FieldValue } = await import('firebase-admin/firestore');

  if (body.delete === true) {
    if (!body.id) return adminJson({ error: '删除需要 id' }, 400);
    await db.collection('subscriptions').doc(String(body.id)).delete();
    return adminJson({ ok: true, deleted: body.id });
  }

  // ── 校验（admin-only 路由，校验以防误录而非防攻击）──
  const errs: string[] = [];
  if (!body.userId || typeof body.userId !== 'string') errs.push('缺 userId');
  if (!body.name) errs.push('缺 name');
  if (!body.phone) errs.push('缺 phone');
  if (!body.address) errs.push('缺 address');
  if (!['near', 'mid', 'far'].includes(body.deliveryTier)) errs.push('deliveryTier 必须是 near/mid/far');
  const plan = body.plan && typeof body.plan === 'object' ? body.plan : {};
  for (const [wd, day] of Object.entries<any>(plan)) {
    if (!['1', '2', '3', '4', '5'].includes(wd)) { errs.push(`plan 的 key 必须是 1-5，收到 ${wd}`); continue; }
    if (day?.skip) continue;
    if (!['lunch', 'dinner'].includes(day?.meal)) errs.push(`周${wd} meal 必须是 lunch/dinner`);
    if (!Array.isArray(day?.items) || day.items.length === 0) errs.push(`周${wd} 至少要有一道主菜`);
    for (const it of day?.items ?? []) {
      if (!it?.dishName) errs.push(`周${wd} 有主菜缺 dishName`);
      if (!(Number(it?.qty) >= 1)) errs.push(`周${wd} ${it?.dishName ?? ''} qty 必须 ≥1`);
    }
  }
  if (errs.length) return adminJson({ error: errs.join('；') }, 400);

  const doc: Record<string, unknown> = {
    userId: String(body.userId).trim(),
    name: String(body.name).trim(),
    phone: String(body.phone).trim(),
    address: String(body.address).trim(),
    deliveryTier: body.deliveryTier,
    deliveryZone: body.deliveryZone === 'outside2km' ? 'outside2km' : 'within2km',
    deliveryDistanceKm: Number(body.deliveryDistanceKm) || 0,
    deliveryFeePerDelivery: Number(body.deliveryFeePerDelivery) || 0,
    active: body.active !== false,
    note: String(body.note ?? ''),
    plan,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: adminEmail,
  };

  if (body.id) {
    await db.collection('subscriptions').doc(String(body.id)).set(doc, { merge: false });
    return adminJson({ ok: true, id: body.id });
  }
  const ref = await db.collection('subscriptions').add({ ...doc, createdAt: FieldValue.serverTimestamp() });
  return adminJson({ ok: true, id: ref.id });
}
