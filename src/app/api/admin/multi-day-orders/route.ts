import { NextRequest } from 'next/server';
import { corsPreflight, adminJson, verifyAdminEmail } from '@/lib/adminApi';
import {
  buildPlan, resolveManualUserId, writeManualOrderDays,
  round2, WD_CN, PAYMENT_METHODS, type PlannedDay,
} from '@/lib/manualOrderCore';

/**
 * POST /api/admin/multi-day-orders — 多日手动单（不扣券，正常收钱）。
 *
 * /admin/subscriptions 管「每周固定模板 + 扣餐券」；这里管临时需求：
 * 客户 WhatsApp 说「帮我排周二到周五的饭」，一次录好几天的普通订单，
 * 现金/QR 全额收款，完全不碰餐券。
 *
 * { action: 'preview', customer, days, paymentMethod? }           → dry-run：现价重算 + 警告，不写库
 * { action: 'confirm', customer, days, paymentMethod?, batchTag } → 每天落一张 confirmed 手动单
 *
 * 订单 schema 镜像 subscriptions/week 的 confirm（isManual + channel:whatsapp +
 * batchTag + createdAt 落在配送日 04:00Z = KL 12:00，按日营收记在出餐当天），
 * 只是去掉全部餐券字段：total = originalTotal（菜金全额现金）。
 *
 * confirm 不信客户端价格 —— 菜价一律按 weeklyMenu 现价重算（与 preview 同源）。
 * 幂等：batchTag 由 preview 下发（multi-<时间戳>），confirm 查重拒绝双击重复建单。
 *
 * 2026-08-01：buildPlan / userId 归属 / 落库循环抽到 src/lib/manualOrderCore.ts，
 * 与 /api/n8n/wa-order（碗妈 bot 下单）共享同一套口径；本 route 行为不变。
 */

let adminDb: FirebaseFirestore.Firestore | null = null;
async function getDb() {
  if (adminDb) return adminDb;
  const { getAdminDb } = await import('@/lib/firebase-admin');
  adminDb = getAdminDb();
  return adminDb;
}

/** 给老板复制转发的 WhatsApp 确认消息。 */
function whatsappText(name: string, days: PlannedDay[]): string {
  const usable = days.filter(d => !d.blocked);
  const lines = usable.map(d => {
    const dishes = d.items.map(it => `${it.name}${it.quantity > 1 ? `×${it.quantity}` : ''}`).join(' + ');
    const addons = d.items.flatMap(it => it.addOns).map(a => a.label).filter(Boolean);
    return `周${WD_CN[d.weekday]}（${d.date.slice(5).replace('-', '/')}）${d.meal === 'dinner' ? '晚餐' : '午餐'}：${dishes}${addons.length ? ` +${addons.join('+')}` : ''} — RM ${d.cashDue.toFixed(2)}`;
  });
  const total = round2(usable.reduce((s, d) => s + d.cashDue, 0));
  return `${name} 你好！碗妈帮你排好这几天的菜 🍛\n${lines.join('\n')}\n\n合计 RM ${total.toFixed(2)}（含运费）。\n没问题回 OK，想换哪天直接说 👌`;
}

export async function OPTIONS() { return corsPreflight(); }

export async function POST(req: NextRequest) {
  const adminEmail = await verifyAdminEmail(req);
  if (!adminEmail) return adminJson({ error: '未授权' }, 401);

  const body = await req.json().catch(() => null);
  const action = body?.action;
  const customer = body?.customer && typeof body.customer === 'object' ? body.customer : null;
  const rawDays: any[] = Array.isArray(body?.days) ? body.days : [];

  // ── 校验（admin-only 路由，校验以防误录而非防攻击）──
  const errs: string[] = [];
  if (!customer?.name) errs.push('缺姓名');
  if (!customer?.phone) errs.push('缺电话');
  if (!customer?.address) errs.push('缺地址');
  if (rawDays.length === 0) errs.push('至少要加一天');
  const paymentMethod = String(body?.paymentMethod || 'qr');
  if (!PAYMENT_METHODS.includes(paymentMethod as any)) errs.push(`paymentMethod 必须是 ${PAYMENT_METHODS.join('/')}`);
  if (errs.length) return adminJson({ error: errs.join('；') }, 400);

  const deliveryFee = Number(customer.deliveryFeePerDelivery) || 0;
  const { days, errors } = buildPlan(rawDays, deliveryFee);
  if (errors.length) return adminJson({ error: errors.join('；') }, 400);
  if (days.length === 0) return adminJson({ error: '没有可用的天' }, 400);

  const usable = days.filter(d => !d.blocked);
  const name = String(customer.name).trim();
  const phone = String(customer.phone).trim();
  const db = await getDb();
  const userId = await resolveManualUserId(db, String(customer.userId || ''), phone);
  const cashTotal = round2(usable.reduce((s, d) => s + d.cashDue, 0));

  // ── 预览 ─────────────────────────────────────────────
  if (action === 'preview') {
    return adminJson({
      name, phone, userId, days, cashTotal, paymentMethod,
      canConfirm: usable.length > 0,
      whatsappText: whatsappText(name, days),
      batchTag: `multi-${Date.now()}`,
    });
  }

  // ── 确认建单 ─────────────────────────────────────────
  if (action === 'confirm') {
    const batchTag = String(body?.batchTag || '');
    if (!/^multi-\d{10,}$/.test(batchTag)) return adminJson({ error: 'batchTag 无效 —— 先生成预览' }, 400);
    if (usable.length === 0) return adminJson({ error: '所有天都被硬伤拦下，看预览的警告' }, 400);

    const existing = await db.collection('orders').where('batchTag', '==', batchTag).limit(1).get();
    if (!existing.empty) return adminJson({ error: `batchTag=${batchTag} 已建过单，拒绝重复（重新生成预览可再建一批）` }, 409);

    const created = await writeManualOrderDays({
      db, usableDays: usable, userId,
      customerName: name, customerPhone: phone,
      customerAddress: String(customer.address).trim(),
      deliveryZone: customer.deliveryZone === 'outside2km' ? 'outside2km' : 'within2km',
      deliveryDistanceKm: Number(customer.deliveryDistanceKm) || 0,
      deliveryTier: ['near', 'mid', 'far'].includes(customer.deliveryTier) ? customer.deliveryTier : 'near',
      paymentMethod, batchTag, createdBy: adminEmail,
      noteBase: '手动录入 · whatsapp · 多日批量',
      custNote: String(customer.note || '').trim(),
      feeForDay: () => deliveryFee,
      stockSource: '多日手动单',
    });

    console.log(`[multi-day-orders] ${adminEmail} 为 ${name} 建 ${created.length} 单（${batchTag}）`);
    return adminJson({ ok: true, batchTag, created, cashTotal, skippedDays: days.filter(d => d.blocked).map(d => d.date) });
  }

  return adminJson({ error: 'action 必须是 preview 或 confirm' }, 400);
}
