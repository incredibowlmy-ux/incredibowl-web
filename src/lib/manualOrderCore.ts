/**
 * 手动单共享核心 —— multi-day-orders（dashboard 多日手动单）与
 * n8n/wa-order（碗妈 WhatsApp bot 下单）共用的计划推演 + 落库逻辑。
 *
 * 2026-08-01 从 src/app/api/admin/multi-day-orders/route.ts 原样抽出
 * （Next.js route 文件不允许导出非 handler，所以只能搬到 lib 共享）。
 * buildPlan / 落库字段口径 = 权威口径，改动必须同时想清楚两个调用方。
 */

import { weeklyMenu, type MenuItem } from '@/data/weeklyMenu';
import { isDishBlockedOn, isDateClosed } from '@/data/blockedDates';

export const round2 = (n: number) => Number(n.toFixed(2));
export const WD_CN = ['日', '一', '二', '三', '四', '五', '六'];

// 与 dashboard 手动录单同一套值（moPaymentPills），报表按这些值分桶
export const PAYMENT_METHODS = ['cash', 'qr', 'fpx', 'card', 'ewallet'] as const;

export interface PlannedItem {
  name: string;
  price: number;         // 实收单价（特批时 = 老板填的数）
  /** 目录价 —— 只在 price 被特批覆盖时才写，报表/回看能分辨这单是特价 */
  listPrice?: number;
  quantity: number;
  addOns: { id?: string; label: string; price: number; quantity: number }[];
}

export interface BuildPlanOpts {
  /**
   * 允许 items[].price 覆盖目录价（主菜特批价）。只有 dashboard 多日单显式打开
   * （admin 亲手填）；wa-order 走默认 false —— AI 报的价一律不信，永远按目录价。
   */
  allowPriceOverride?: boolean;
}

export interface PlannedDay {
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
export function todayKL(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

/** 按提交的天数 + 当前菜单目录推演。preview 与 confirm 共用。 */
export function buildPlan(
  rawDays: any[],
  deliveryFeePerDelivery: number,
  opts: BuildPlanOpts = {},
): { days: PlannedDay[]; errors: string[] } {
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

      // 加料价 clamp ≥ 0：负价注入直接归零（wa-order 在上游已按 ADD_ON_PRICES
      // 权威定价；dashboard 多日单传的是它自己目录表的价 —— 这里只挡恶意值不改口径）
      const addOns = (raw.addOns ?? []).map((a: any) => ({
        ...(a.id ? { id: String(a.id) } : {}),
        label: String(a.label ?? ''),
        price: Math.max(0, Number(a.price) || 0),
        quantity: Math.max(1, Math.floor(Number(a.quantity) || 1)),
      }));
      const addOnSum = addOns.reduce((s: number, a: any) => s + a.price * a.quantity, 0);

      // 主菜特批价：与目录价不同才算覆盖，留 listPrice + 警告（预览里一眼看出这单是特价）。
      // 无效值（非数字/负数）不悄悄吞掉 —— 回落目录价并警告，免得老板以为改成功了。
      let price = dish.price;
      let listPrice: number | undefined;
      if (opts.allowPriceOverride && raw?.price !== undefined && raw?.price !== null && raw?.price !== '') {
        const p = Number(raw.price);
        if (!Number.isFinite(p) || p < 0) {
          warnings.push(`「${dish.name}」单价「${raw.price}」无效，已按目录价 RM ${dish.price.toFixed(2)}`);
        } else if (Math.abs(p - dish.price) > 0.001) {
          price = round2(p);
          listPrice = dish.price;
          warnings.push(`「${dish.name}」特批价 RM ${price.toFixed(2)}（目录价 RM ${dish.price.toFixed(2)}）`);
        }
      }

      // listPrice 用条件展开：Firestore 默认拒绝 undefined 字段值
      items.push({ name: dish.name, price, quantity: qty, addOns, ...(listPrice !== undefined ? { listPrice } : {}) });
      originalTotal += price * qty + addOnSum;
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

/**
 * userId 归属：显式传入 > 电话匹配的真实账号（跳过 mergedInto 匿名壳）> manual_<电话> 兜底。
 * 不查真实账号会把同一客户劈成 manual_* + 真实 uid 两个档案（统计/会员历史全失真）。
 */
export async function resolveManualUserId(
  db: FirebaseFirestore.Firestore,
  explicitUserId: string,
  phone: string,
): Promise<string> {
  let userId = String(explicitUserId || '').trim();
  if (!userId) {
    const { normalizePhone } = await import('@/lib/phoneUtils');
    const normalized = normalizePhone(phone);
    if (normalized) {
      const { findUserByNormalizedPhone } = await import('@/lib/adminUserLookup');
      const match = await findUserByNormalizedPhone(db, normalized);
      if (match) userId = match.id;
    }
    if (!userId) userId = `manual_${phone.replace(/\D/g, '')}`;
  }
  return userId;
}

export interface WriteManualOrdersOpts {
  db: FirebaseFirestore.Firestore;
  usableDays: PlannedDay[];          // 已过滤 blocked
  userId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  deliveryZone: 'within2km' | 'outside2km';
  deliveryDistanceKm: number;
  deliveryTier: 'near' | 'mid' | 'far';
  paymentMethod: string;             // 调用方先按 PAYMENT_METHODS 校验
  batchTag: string;
  createdBy: string;
  noteBase: string;                  // 如「手动录入 · whatsapp · 多日批量」
  custNote?: string;
  /** 每天的运费（multi-day 各天同价；wa-order 各天按免运门槛独立算） */
  feeForDay: (d: PlannedDay) => number;
  stockSource: string;               // 扣库存日志来源标签
  /** 额外字段（如 wa-order 的 trackToken），按天生成 */
  perOrderExtras?: (d: PlannedDay) => Record<string, unknown>;
}

/**
 * confirm 落库循环 —— 字段口径与 2026-08-01 前 multi-day-orders 内联版逐字段一致：
 * status=confirmed、isManual、channel=whatsapp、createdAt=配送日 04:00Z（KL 12:00，
 * 按日营收记在出餐当天）、建单即扣两层库存（吞错误，绝不影响已建的单）。
 */
export async function writeManualOrderDays(
  opts: WriteManualOrdersOpts,
): Promise<{ orderId: string; date: string }[]> {
  const {
    db, usableDays, userId, customerName, customerPhone, customerAddress,
    deliveryZone, deliveryDistanceKm, deliveryTier, paymentMethod,
    batchTag, createdBy, noteBase, custNote, feeForDay, stockSource, perOrderExtras,
  } = opts;

  const { FieldValue, Timestamp } = await import('firebase-admin/firestore');
  const created: { orderId: string; date: string }[] = [];

  for (const d of usableDays) {
    const orderRef = db.collection('orders').doc();
    await orderRef.set({
      userId, userName: customerName, userPhone: customerPhone, userEmail: '',
      userAddress: customerAddress,
      items: d.items,
      total: d.originalTotal,
      originalTotal: d.originalTotal,
      deliveryFee: feeForDay(d),
      deliveryZone,
      deliveryDistanceKm,
      deliveryTier,
      deliveryDate: d.date, deliveryTime: d.time,
      paymentMethod, receiptUploaded: true, status: 'confirmed',
      isManual: true, channel: 'whatsapp', mealType: d.meal,
      note: `${noteBase}${custNote ? ` · ${custNote}` : ''}`,
      batchTag,
      createdBy,
      // createdAt 落在配送日中午（04:00Z = KL 12:00），与周订阅/手写脚本一致，
      // 让按日营收报表把菜金记在出餐当天。
      createdAt: Timestamp.fromDate(new Date(`${d.date}T04:00:00Z`)),
      updatedAt: FieldValue.serverTimestamp(),
      ...(perOrderExtras ? perOrderExtras(d) : {}),
    });
    created.push({ orderId: orderRef.id, date: d.date });

    // 与 dashboard 手动单同款扣库存（老板拍板 2026-07-05：提前单也建单即扣）：
    // dishStock 宽松扣（可到 0 不阻挡）+ ingredientStock best-effort。
    // 绝不能影响已建的单 —— 全部吞错误只留日志。
    try {
      const dishItems = d.items
        .map(it => {
          const dish = weeklyMenu.find(x => x.name === it.name);
          return dish ? { dishId: dish.id, qty: it.quantity, name: it.name } : null;
        })
        .filter((x): x is { dishId: number; qty: number; name: string } => x !== null);
      const { decrementDishStockLenient } = await import('@/lib/stockUtils');
      const deducted = await decrementDishStockLenient(db, dishItems);
      const { consumeIngredientStock } = await import('@/lib/ingredientStock');
      await consumeIngredientStock(db, d.items, { source: stockSource, orderId: orderRef.id });
      // 把**实扣量**记在订单上：lenient 扣减在库存见底时扣不满，取消/删除时
      // 若按 items 的 qty 全额回补就会凭空印货。有这条记录，回补才退得准。
      // 同时它也是「这单确实扣过库存」的凭据，比拿 createdAt 猜纪元可靠
      // （手动单的 createdAt 是配送日 12:00，还能被编辑改写）。
      await orderRef.update({
        stockDeducted: deducted,
        stockDeductedIngredients: true,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.error(`[manualOrderCore] 扣库存失败（订单 ${orderRef.id} 已建，不受影响）:`, err);
    }
  }

  return created;
}
