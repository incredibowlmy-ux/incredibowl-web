import { NextRequest } from 'next/server';
import { corsPreflight, adminJson, verifyAdminEmail } from '@/lib/adminApi';
import { weeklyMenu, dishVoucherValue, type MenuItem } from '@/data/weeklyMenu';
import { isDishBlockedOn, isDateClosed } from '@/data/blockedDates';
import { claimMealVouchers, countAvailableVouchers } from '@/lib/mealVoucherUtils';
import { getAvailableAddonCredits, claimAddonCredits } from '@/lib/addonCreditUtils';
import { getPrepaidAddonOption, PREPAID_ADDON_OPTIONS } from '@/data/addOnsConfig';
import { DISH_ADDONS_BY_NAME, DEFAULT_ADDON_OPTIONS } from '@/data/dishAddonMap.generated';

/**
 * POST /api/admin/subscriptions/week — 常客周计划的「生成预览 / 确认建单」。
 *
 * { action: 'preview', weekStart: 'YYYY-MM-DD' }            → 所有 active 订阅的下周单预览
 * { action: 'confirm', weekStart, subscriptionId }          → 按订阅模板批量建单 + FIFO 扣券
 *
 * 逻辑镜像自 scripts/create-*-week-orders.mjs（LeeYin/Kelly 每周脚本的产品化）：
 *   - 订单 schema 与脚本一字不差（isManual + channel:whatsapp + batchTag +
 *     mealVoucherAllocatedRevenue 摊销 + createdAt 落在配送日 04:00Z）
 *   - 扣券改用生产共享的 claimMealVouchers（原子事务，FIFO 最早到期先用）
 *   - 预付储值自动抵扣：高价菜升级补差（dish.topUpAddonId）+ 计划里手选的
 *     可预付加料（PREPAID_ADDON_OPTIONS 白名单）都先用客户储值抵，缺口收现金
 *   - 幂等：batchTag = sub-<weekStart>-<subscriptionId>，已存在即拒绝
 *
 * confirm 不接受客户端传来的价格/菜单 —— 一切从订阅模板 + DISH_CATALOG 现价
 * 重新计算，预览和确认永远同源。要改菜先改订阅再重新预览。
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

// 加料储值抵扣映射：加料选择器 label → 预付 addonId。老订阅模板的 addOns 只存了
// label 没存 id，靠这张表回溯（例：选择器叫「换糙米」，预付名叫「白饭换糙米」，
// 都指 brown-rice）。只收 PREPAID_ADDON_OPTIONS 白名单里的 id —— 同名的
// alacarte 变体（sunny-egg-alacarte 等）不会被误映射成可抵扣。
const PREPAID_LABEL_TO_ID = new Map<string, string>();
for (const opts of [...Object.values(DISH_ADDONS_BY_NAME), DEFAULT_ADDON_OPTIONS]) {
  for (const o of opts) if (getPrepaidAddonOption(o.id)) PREPAID_LABEL_TO_ID.set(o.label, o.id);
}
for (const o of PREPAID_ADDON_OPTIONS) PREPAID_LABEL_TO_ID.set(o.name, o.id);

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface PlannedItem {
  name: string;
  price: number;
  quantity: number;
  addOns: { id?: string; label: string; price: number; quantity: number }[];
}

interface PlannedDay {
  date: string;
  weekday: number;
  meal: 'lunch' | 'dinner';
  time: string;
  items: PlannedItem[];
  vCount: number;        // 本单消耗餐券张数（= 主菜总份数）
  coverage: number;      // 餐券抵扣的面值 RM（Σ dishVoucherValue × qty）
  originalTotal: number; // 菜金小计（含加料）
  cashDue: number;       // 现金应收 = originalTotal − coverage − upgradeCoverage + deliveryFee
  /**
   * 本天可用预付储值抵的需求：高价菜 top-up（dish.topUpAddonId × 份数，
   * source='topup'）+ 计划里手选的可预付加料（荷包蛋/加饭等，source='addon'）。
   */
  upgradeNeeds: { addonId: string; count: number; unitRM: number; source: 'topup' | 'addon' }[];
  /** allocateUpgradeCredits 分配结果：实际用掉的 credit。 */
  upgradeUsed: { addonId: string; count: number }[];
  /** 被预付升级 credit 覆盖的 top-up 金额 RM（已从 cashDue 扣除）。 */
  upgradeCoverage: number;
  warnings: string[];
  blocked: boolean;      // 有硬伤（菜不存在/当日停业等）→ confirm 时整天跳过
}

/** 按订阅模板 + 当前菜单目录推演一周的单。preview 与 confirm 共用。 */
function buildWeekPlan(sub: any, weekStart: string): { days: PlannedDay[]; warnings: string[] } {
  const topWarnings: string[] = [];
  const days: PlannedDay[] = [];
  const plan: Record<string, any> = sub.plan || {};

  for (let wd = 1; wd <= 5; wd++) {
    const entry = plan[String(wd)];
    if (!entry || entry.skip) continue;
    const date = addDays(weekStart, wd - 1);
    const warnings: string[] = [];
    let blocked = false;

    if (isDateClosed(date)) { warnings.push(`${date} 整日停业（CLOSED_DATES）`); blocked = true; }

    const items: PlannedItem[] = [];
    // key = addonId|unitRM|source：同一储值不同来源/单价分开记，抵扣金额才精确；
    // allocateUpgradeCredits 的余额池按 addonId 共享，不受 key 拆分影响。
    const upgradeNeeds = new Map<string, { addonId: string; count: number; unitRM: number; source: 'topup' | 'addon' }>();
    let vCount = 0, coverage = 0, originalTotal = 0;

    for (const raw of entry.items ?? []) {
      const qty = Math.max(1, Math.floor(Number(raw.qty) || 1));
      const dish: MenuItem | undefined = weeklyMenu.find(d => d.name === raw.dishName);
      if (!dish) { warnings.push(`「${raw.dishName}」不在菜品目录`); blocked = true; continue; }
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
      vCount += qty;
      coverage += dishVoucherValue(dish.price, dish) * qty;
      originalTotal += dish.price * qty + addOnSum;

      if (dish.topUpAddonId && (dish.voucherTopUp ?? 0) > 0) {
        const key = `${dish.topUpAddonId}|${dish.voucherTopUp}|topup`;
        const prev = upgradeNeeds.get(key);
        if (prev) prev.count += qty;
        else upgradeNeeds.set(key, { addonId: dish.topUpAddonId, count: qty, unitRM: dish.voucherTopUp!, source: 'topup' });
      }

      // 手选加料若在可预付白名单里（荷包蛋/温泉蛋/加饭…），也登记成储值需求：
      // 客户有储值就自动抵、不收现金；没储值走缺口逻辑照旧收现金。
      // 老模板没存 addon id → 按 label 回溯。price<=0 的不抵（白抵储值还不减钱）。
      for (const a of addOns) {
        if (a.price <= 0) continue;
        const creditId = a.id && getPrepaidAddonOption(a.id) ? a.id : PREPAID_LABEL_TO_ID.get(a.label);
        if (!creditId) continue;
        const key = `${creditId}|${a.price}|addon`;
        const prev = upgradeNeeds.get(key);
        if (prev) prev.count += a.quantity;
        else upgradeNeeds.set(key, { addonId: creditId, count: a.quantity, unitRM: a.price, source: 'addon' });
      }
    }

    if (items.length === 0) { topWarnings.push(`周${WD_CN[wd]} 没有可用主菜，整天跳过`); continue; }

    coverage = round2(coverage);
    originalTotal = round2(originalTotal);
    const deliveryFee = Number(sub.deliveryFeePerDelivery) || 0;
    days.push({
      date, weekday: wd,
      meal: entry.meal === 'dinner' ? 'dinner' : 'lunch',
      time: String(entry.time || (entry.meal === 'dinner' ? '19:00' : '12:00')),
      items, vCount, coverage, originalTotal,
      cashDue: round2(originalTotal - coverage + deliveryFee),
      upgradeNeeds: [...upgradeNeeds.values()],
      upgradeUsed: [],
      upgradeCoverage: 0,
      warnings, blocked,
    });
  }
  return { days, warnings: topWarnings };
}

/**
 * 把客户账上的预付储值（升级 credit salmon-upgrade/wagyu-upgrade + 加料储值
 * sunny-egg/extra-rice…）按日期顺序分给非 blocked 天的需求：填
 * upgradeUsed/upgradeCoverage 并把 cashDue 扣掉被覆盖的部分。
 * preview 与 confirm 用同一份分配逻辑（同源），
 * 两边各自现拉一次余额 —— 只要中间没人动 credit，结果一致。
 * 返回不足清单（addonId → 还差几个），给 preview 出警告。
 */
function allocateUpgradeCredits(
  days: PlannedDay[],
  available: Map<string, number>,
): Map<string, number> {
  const shortfall = new Map<string, number>();
  for (const d of days) {
    if (d.blocked) continue;
    for (const need of d.upgradeNeeds) {
      const remaining = available.get(need.addonId) ?? 0;
      const take = Math.min(remaining, need.count);
      if (take > 0) {
        available.set(need.addonId, remaining - take);
        // 按 addonId 合并：claimAddonCredits 不接受同一 addonId 重复行
        //（同一批次文档会被重复规划扣减）。
        const used = d.upgradeUsed.find(u => u.addonId === need.addonId);
        if (used) used.count += take;
        else d.upgradeUsed.push({ addonId: need.addonId, count: take });
        d.upgradeCoverage = round2(d.upgradeCoverage + take * need.unitRM);
        d.cashDue = round2(d.cashDue - take * need.unitRM);
      }
      if (take < need.count) {
        shortfall.set(need.addonId, (shortfall.get(need.addonId) ?? 0) + (need.count - take));
      }
    }
  }
  return shortfall;
}

/** 生成给老板复制转发的 WhatsApp 确认消息（保持老板的号、老板的人情味）。 */
function whatsappText(sub: any, days: PlannedDay[], vouchersLeftAfter: number): string {
  const lines = days.filter(d => !d.blocked).map(d => {
    const dishes = d.items.map(it => `${it.name}${it.quantity > 1 ? `×${it.quantity}` : ''}`).join(' + ');
    const addons = d.items.flatMap(it => it.addOns).map(a => a.label).filter(Boolean);
    return `周${WD_CN[d.weekday]}（${d.date.slice(5).replace('-', '/')}）${d.meal === 'dinner' ? '晚餐' : '午餐'}：${dishes}${addons.length ? ` +${addons.join('+')}` : ''}`;
  });
  const usableDays = days.filter(d => !d.blocked);
  const totalV = usableDays.reduce((s, d) => s + d.vCount, 0);
  const totalCash = round2(usableDays.reduce((s, d) => s + d.cashDue, 0));
  const totalUpgrade = usableDays.reduce((s, d) => s + d.upgradeUsed.reduce((x, u) => x + u.count, 0), 0);
  return `${sub.name} 你好！碗妈下周给你排的菜 🍛\n${lines.join('\n')}\n\n共扣 ${totalV} 张餐券（用完剩 ${vouchersLeftAfter} 张）${totalUpgrade > 0 ? `，预付储值抵 ${totalUpgrade} 份加料/升级` : ''}${totalCash > 0 ? `，加料/补差现金 RM ${totalCash.toFixed(2)}` : ''}。\n没问题回 OK，想换哪天直接说 👌`;
}

export async function OPTIONS() { return corsPreflight(); }

export async function POST(req: NextRequest) {
  const adminEmail = await verifyAdminEmail(req);
  if (!adminEmail) return adminJson({ error: '未授权' }, 401);

  const body = await req.json().catch(() => null);
  const action = body?.action;
  const weekStart: string = String(body?.weekStart || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return adminJson({ error: 'weekStart 需为 YYYY-MM-DD' }, 400);
  if (new Date(`${weekStart}T00:00:00`).getDay() !== 1) return adminJson({ error: 'weekStart 必须是周一' }, 400);

  const db = await getDb();

  // ── 预览 ─────────────────────────────────────────────
  if (action === 'preview') {
    const snap = await db.collection('subscriptions').where('active', '==', true).get();
    const previews = [];
    for (const doc of snap.docs) {
      const sub = { id: doc.id, ...doc.data() } as any;
      const { days, warnings } = buildWeekPlan(sub, weekStart);

      // 预付储值（高价菜升级补差 + 加料储值）——有就自动抵，现金只收缺口
      if (days.some(d => !d.blocked && d.upgradeNeeds.length > 0)) {
        const credits = await getAvailableAddonCredits(db, sub.userId);
        const availMap = new Map(credits.map(c => [c.addonId, c.remaining]));
        const initial = new Map(availMap);
        const shortfall = allocateUpgradeCredits(days, availMap);
        for (const [addonId, miss] of shortfall) {
          // 升级补差（topup）不足永远提醒；普通加料客户本来就没储值 = 正常现金
          // 加料，不吵 —— 只在「有储值但不够」时提醒。
          const fromTopUp = days.some(d => !d.blocked
            && d.upgradeNeeds.some(n => n.addonId === addonId && n.source === 'topup'));
          if (!fromTopUp && (initial.get(addonId) ?? 0) === 0) continue;
          const name = getPrepaidAddonOption(addonId)?.name || addonId;
          warnings.push(`预付「${name}」不足：还差 ${miss} 份，差额按现金收`);
        }
      }

      const vouchersNeeded = days.filter(d => !d.blocked).reduce((s, d) => s + d.vCount, 0);
      const vouchersAvailable = await countAvailableVouchers(db, sub.userId);
      if (vouchersAvailable < vouchersNeeded) {
        warnings.push(`⛔ 餐券不足：需 ${vouchersNeeded} 张，只有 ${vouchersAvailable} 张 —— 先卖新券包或减天数`);
      }
      const batchTag = `sub-${weekStart}-${sub.id}`;
      const existing = await db.collection('orders').where('batchTag', '==', batchTag).limit(1).get();
      const userDoc = await db.collection('users').doc(sub.userId).get();
      if (!userDoc.exists) warnings.push(`users/${sub.userId} 不存在 —— 先用「卖餐券」流程建档`);

      previews.push({
        subscriptionId: sub.id,
        name: sub.name, phone: sub.phone, userId: sub.userId,
        days,
        vouchersNeeded, vouchersAvailable,
        cashTotal: round2(days.filter(d => !d.blocked).reduce((s, d) => s + d.cashDue, 0)),
        warnings,
        alreadyCreated: !existing.empty,
        canConfirm: existing.empty && vouchersAvailable >= vouchersNeeded && days.some(d => !d.blocked),
        whatsappText: whatsappText(sub, days, vouchersAvailable - vouchersNeeded),
        batchTag,
      });
    }
    return adminJson({ weekStart, previews });
  }

  // ── 确认建单 ─────────────────────────────────────────
  if (action === 'confirm') {
    const subscriptionId = String(body?.subscriptionId || '');
    if (!subscriptionId) return adminJson({ error: '缺 subscriptionId' }, 400);

    const subSnap = await db.collection('subscriptions').doc(subscriptionId).get();
    if (!subSnap.exists) return adminJson({ error: '订阅不存在' }, 404);
    const sub = { id: subSnap.id, ...subSnap.data() } as any;

    const batchTag = `sub-${weekStart}-${subscriptionId}`;
    const existing = await db.collection('orders').where('batchTag', '==', batchTag).limit(1).get();
    if (!existing.empty) return adminJson({ error: `batchTag=${batchTag} 已建过单，拒绝重复` }, 409);

    const { days } = buildWeekPlan(sub, weekStart);
    const usable = days.filter(d => !d.blocked);
    if (usable.length === 0) return adminJson({ error: '本周没有可建的单（全部被硬伤拦下），看预览的警告' }, 400);

    // 预付储值（升级补差 + 加料储值）：现拉余额按日期分配（与 preview 同一份
    // 逻辑），有多少抵多少，缺口照旧收现金 —— 不足不拦确认。
    if (usable.some(d => d.upgradeNeeds.length > 0)) {
      const credits = await getAvailableAddonCredits(db, sub.userId);
      allocateUpgradeCredits(days, new Map(credits.map(c => [c.addonId, c.remaining])));
    }

    const vouchersNeeded = usable.reduce((s, d) => s + d.vCount, 0);
    const available = await countAvailableVouchers(db, sub.userId);
    if (available < vouchersNeeded) {
      return adminJson({ error: `餐券不足：需 ${vouchersNeeded} 张，只有 ${available} 张` }, 400);
    }

    const { FieldValue, Timestamp } = await import('firebase-admin/firestore');
    const created: { orderId: string; date: string; voucherIds: string[] }[] = [];

    // 每天一单：先 FIFO 扣券（原子事务）再写订单。中途失败会留下已建的前几
    // 天 —— batchTag 幂等锁保证不会重复整周，剩余天数看 error 手动补。
    for (const d of usable) {
      const orderRef = db.collection('orders').doc();
      // 先扣升级 credit 再扣餐券：credit 靠上面的现拉分配，撞到并发不足会
      // throw —— 此时餐券还没动，中断面更小。
      const addonClaim = d.upgradeUsed.length > 0
        ? await claimAddonCredits(db, sub.userId, d.upgradeUsed, orderRef.id)
        : { recognizedRevenueRM: 0, lines: [] };
      const claim = await claimMealVouchers(db, sub.userId, d.vCount, orderRef.id);
      const deliveryFee = Number(sub.deliveryFeePerDelivery) || 0;
      await orderRef.set({
        userId: sub.userId, userName: sub.name, userPhone: sub.phone, userEmail: '',
        userAddress: sub.address,
        items: d.items,
        // 现金应收：菜金 − 餐券面值 − 预付升级覆盖（口径 = dashboard 手动单，
        // 预付加料是现金折扣不是 RM0 行项目）
        total: round2(d.originalTotal - d.coverage - d.upgradeCoverage),
        originalTotal: d.originalTotal,
        deliveryFee,
        deliveryZone: sub.deliveryZone || 'within2km',
        deliveryDistanceKm: Number(sub.deliveryDistanceKm) || 0,
        deliveryTier: sub.deliveryTier || 'near',
        deliveryDate: d.date, deliveryTime: d.time,
        paymentMethod: 'qr', receiptUploaded: true, status: 'confirmed',
        isManual: true, channel: 'whatsapp', mealType: d.meal,
        note: `手动录入 · whatsapp · 餐券抵扣 · 周订阅自动生成`,
        batchTag,
        subscriptionId,
        mealVoucherDiscount: d.coverage,
        mealVouchersUsed: d.vCount,
        claimedMealVoucherIds: claim.ids,
        mealVoucherAllocatedRevenue: claim.allocatedTotalRM,
        ...(addonClaim.lines.length > 0 ? {
          addonCreditsUsed: addonClaim.lines.map(l => ({ addonId: l.addonId, count: l.count })),
          addonCreditsAllocatedRevenue: addonClaim.recognizedRevenueRM,
        } : {}),
        redemptionRecordedBy: adminEmail,
        // createdAt 落在配送日中午（04:00Z = KL 12:00），与手写周脚本一致，
        // 让按日营收报表把摊销记在出餐当天。
        createdAt: Timestamp.fromDate(new Date(`${d.date}T04:00:00Z`)),
        updatedAt: FieldValue.serverTimestamp(),
      });
      created.push({ orderId: orderRef.id, date: d.date, voucherIds: claim.ids });

      // 与 dashboard 手动单同款扣库存（老板拍板 2026-07-05：提前单也建单即扣）：
      // dishStock 宽松扣（可到 0 不阻挡）+ ingredientStock best-effort。
      // 绝不能影响已建的单/已扣的券 —— 全部吞错误只留日志。
      try {
        const dishItems = d.items
          .map(it => {
            const dish = weeklyMenu.find(x => x.name === it.name);
            return dish ? { dishId: dish.id, qty: it.quantity, name: it.name } : null;
          })
          .filter((x): x is { dishId: number; qty: number; name: string } => x !== null);
        const { decrementDishStockLenient } = await import('@/lib/stockUtils');
        await decrementDishStockLenient(db, dishItems);
        const { consumeIngredientStock } = await import('@/lib/ingredientStock');
        await consumeIngredientStock(db, d.items, { source: '周订阅建单', orderId: orderRef.id });
      } catch (err) {
        console.error(`[subscriptions] 扣库存失败（订单 ${orderRef.id} 已建，不受影响）:`, err);
      }
    }

    console.log(`[subscriptions] ${adminEmail} 为 ${sub.name} 建 ${created.length} 单（${batchTag}）`);
    return adminJson({ ok: true, batchTag, created, skippedDays: days.filter(d => d.blocked).map(d => d.date) });
  }

  return adminJson({ error: 'action 必须是 preview 或 confirm' }, 400);
}
