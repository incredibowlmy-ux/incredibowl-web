import { NextRequest } from 'next/server';
import { corsPreflight, adminJson, verifyAdminEmail } from '@/lib/adminApi';
import { weeklyMenu, type MenuItem } from '@/data/weeklyMenu';
import { isDishBlockedOn, isDateClosed } from '@/data/blockedDates';

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
 */

let adminDb: FirebaseFirestore.Firestore | null = null;
async function getDb() {
  if (adminDb) return adminDb;
  const { getAdminDb } = await import('@/lib/firebase-admin');
  adminDb = getAdminDb();
  return adminDb;
}

const round2 = (n: number) => Number(n.toFixed(2));
const WD_CN = ['日', '一', '二', '三', '四', '五', '六'];

// 与 dashboard 手动录单同一套值（moPaymentPills），报表按这些值分桶
const PAYMENT_METHODS = ['cash', 'qr', 'fpx', 'card', 'ewallet'] as const;

interface PlannedItem {
  name: string;
  price: number;
  quantity: number;
  addOns: { id?: string; label: string; price: number; quantity: number }[];
}

interface PlannedDay {
  date: string;
  weekday: number;       // 0-6（getDay）
  meal: 'lunch' | 'dinner';
  time: string;
  items: PlannedItem[];
  originalTotal: number; // 菜金小计（含加料）
  cashDue: number;       // 现金应收 = originalTotal + deliveryFee
  warnings: string[];
  blocked: boolean;      // 有硬伤（菜不存在/当日停业等）→ confirm 时整天跳过
}

/** KL 今天的 YYYY-MM-DD（服务器可能在 UTC）。 */
function todayKL(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

/** 按提交的天数 + 当前菜单目录推演。preview 与 confirm 共用。 */
function buildPlan(rawDays: any[], deliveryFeePerDelivery: number): { days: PlannedDay[]; errors: string[] } {
  const errors: string[] = [];
  const days: PlannedDay[] = [];
  const today = todayKL();
  const seenSlot = new Set<string>();

  for (const entry of rawDays) {
    const date = String(entry?.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { errors.push(`日期格式不对：「${date || '（空）'}」需为 YYYY-MM-DD`); continue; }
    const wd = new Date(`${date}T00:00:00`).getDay();
    const warnings: string[] = [];
    let blocked = false;

    if (date < today) warnings.push(`${date} 已经过去了（今天 KL ${today}），确认是补录历史单再建`);
    if (wd === 0 || wd === 6) warnings.push(`${date} 是周${WD_CN[wd]}，非常规配送日`);
    if (isDateClosed(date)) { warnings.push(`${date} 整日停业（CLOSED_DATES）`); blocked = true; }

    const meal: 'lunch' | 'dinner' = entry?.meal === 'dinner' ? 'dinner' : 'lunch';
    const slot = `${date}|${meal}`;
    if (seenSlot.has(slot)) warnings.push(`${date} ${meal === 'dinner' ? '晚餐' : '午餐'}出现了两次，会建两张单`);
    seenSlot.add(slot);

    const items: PlannedItem[] = [];
    let originalTotal = 0;

    for (const raw of entry?.items ?? []) {
      const qty = Math.max(1, Math.floor(Number(raw?.qty) || 1));
      const dish: MenuItem | undefined = weeklyMenu.find(d => d.name === raw?.dishName);
      if (!dish) { warnings.push(`「${raw?.dishName ?? ''}」不在菜品目录`); blocked = true; continue; }
      if (dish.retired) warnings.push(`「${dish.name}」已暂别菜单（仍可下，确认前想清楚）`);
      if (dish.hidden) warnings.push(`「${dish.name}」是 hidden 未上架菜`);
      if (isDishBlockedOn(dish.id, date)) { warnings.push(`「${dish.name}」在 ${date} 被停（BLOCKED_DATES）`); blocked = true; }
      if (dish.day !== 'Daily / 常驻' && dish.weekday !== undefined && dish.weekday !== wd) {
        warnings.push(`「${dish.name}」本轮排在周${WD_CN[dish.weekday]}，不是周${WD_CN[wd]}`);
      }
      if (dish.day === 'Daily / 常驻' && Array.isArray(dish.availableWeekdays)
          && dish.availableWeekdays.length > 0 && !dish.availableWeekdays.includes(wd)) {
        warnings.push(`「${dish.name}」只在周${dish.availableWeekdays.map(x => WD_CN[x]).join('、')}供应`);
      }

      const addOns = (raw.addOns ?? []).map((a: any) => ({
        ...(a.id ? { id: String(a.id) } : {}),
        label: String(a.label ?? ''),
        price: Number(a.price) || 0,
        quantity: Math.max(1, Math.floor(Number(a.quantity) || 1)),
      }));
      const addOnSum = addOns.reduce((s: number, a: any) => s + a.price * a.quantity, 0);

      items.push({ name: dish.name, price: dish.price, quantity: qty, addOns });
      originalTotal += dish.price * qty + addOnSum;
    }

    if (items.length === 0 && !blocked) { errors.push(`${date} 没有任何主菜`); continue; }

    originalTotal = round2(originalTotal);
    days.push({
      date, weekday: wd, meal,
      time: String(entry?.time || (meal === 'dinner' ? '19:00' : '12:00')),
      items, originalTotal,
      cashDue: round2(originalTotal + deliveryFeePerDelivery),
      warnings, blocked,
    });
  }

  days.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  return { days, errors };
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
  const userId = String(customer.userId || '').trim() || `manual_${phone.replace(/\D/g, '')}`;
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

    const db = await getDb();
    const existing = await db.collection('orders').where('batchTag', '==', batchTag).limit(1).get();
    if (!existing.empty) return adminJson({ error: `batchTag=${batchTag} 已建过单，拒绝重复（重新生成预览可再建一批）` }, 409);

    const { FieldValue, Timestamp } = await import('firebase-admin/firestore');
    const custNote = String(customer.note || '').trim();
    const created: { orderId: string; date: string }[] = [];

    for (const d of usable) {
      const orderRef = db.collection('orders').doc();
      await orderRef.set({
        userId, userName: name, userPhone: phone, userEmail: '',
        userAddress: String(customer.address).trim(),
        items: d.items,
        total: d.originalTotal,
        originalTotal: d.originalTotal,
        deliveryFee,
        deliveryZone: customer.deliveryZone === 'outside2km' ? 'outside2km' : 'within2km',
        deliveryDistanceKm: Number(customer.deliveryDistanceKm) || 0,
        deliveryTier: ['near', 'mid', 'far'].includes(customer.deliveryTier) ? customer.deliveryTier : 'near',
        deliveryDate: d.date, deliveryTime: d.time,
        paymentMethod, receiptUploaded: true, status: 'confirmed',
        isManual: true, channel: 'whatsapp', mealType: d.meal,
        note: `手动录入 · whatsapp · 多日批量${custNote ? ` · ${custNote}` : ''}`,
        batchTag,
        createdBy: adminEmail,
        // createdAt 落在配送日中午（04:00Z = KL 12:00），与周订阅/手写脚本一致，
        // 让按日营收报表把菜金记在出餐当天。
        createdAt: Timestamp.fromDate(new Date(`${d.date}T04:00:00Z`)),
        updatedAt: FieldValue.serverTimestamp(),
      });
      created.push({ orderId: orderRef.id, date: d.date });
    }

    console.log(`[multi-day-orders] ${adminEmail} 为 ${name} 建 ${created.length} 单（${batchTag}）`);
    return adminJson({ ok: true, batchTag, created, cashTotal, skippedDays: days.filter(d => d.blocked).map(d => d.date) });
  }

  return adminJson({ error: 'action 必须是 preview 或 confirm' }, 400);
}
