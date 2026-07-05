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
  const [snap, usersSnap] = await Promise.all([
    db.collection('subscriptions').orderBy('name').get(),
    db.collection('users').get(),
  ]);
  const subscriptions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
      };
    })
    .filter(c => c.name || c.phone);
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
