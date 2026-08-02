/**
 * 周订阅（常客周计划）的餐券分配 —— 纯计算，不碰数据库。
 *
 * 从 /api/admin/subscriptions/week 抽出来单放一个文件，是为了让这段「算客户该
 * 付多少钱」的逻辑能被 dogfood 直接 import 真函数跑构造场景（券刚好够 / 差一份 /
 * 一张都没有 / 同一道菜半份用券半份现金），生产数据里凑不齐这些情况。
 *
 * 类型也一并放这儿：buildWeekPlan / allocateUpgradeCredits / whatsappText 仍在
 * route.ts，共用这份定义。
 */

export const round2 = (n: number) => Number(n.toFixed(2));

export interface PlannedItem {
  name: string;
  price: number;
  quantity: number;
  addOns: { id?: string; label: string; price: number; quantity: number }[];
}

export interface UpgradeNeed {
  addonId: string;
  count: number;
  unitRM: number;
  source: 'topup' | 'addon';
}

/**
 * 一份主菜 —— 餐券分配的最小粒度（qty=3 的 item 展开成 3 个 unit）。
 * 券不够时同一道菜可能部分份用券、部分份收现金。
 */
export interface PlannedUnit {
  dishName: string;
  price: number;         // 菜原价（不用券时按这个收现金）
  voucherValue: number;  // 用券时抵掉的面值 = dishVoucherValue(price, dish)
  voucherTopUp: number;  // 用券时要补的差价 RM（0 = 一张券全包）
  topUpAddonId?: string;
  useVoucher: boolean;   // 由 allocateVouchers 填
}

export interface PlannedDay {
  date: string;
  weekday: number;
  meal: 'lunch' | 'dinner';
  time: string;
  items: PlannedItem[];
  units: PlannedUnit[];  // 份级清单（Σ item.quantity 条）
  vCount: number;        // 本单实际消耗餐券张数（券不够时 < units.length）
  coverage: number;      // 餐券抵扣的面值 RM（Σ 用券份的 voucherValue）
  cashUnits: number;     // 没券按原价现金收的主菜份数
  cashUnitsAmount: number; // 上述份数的菜金 RM（Σ price）
  originalTotal: number; // 菜金小计（含加料）
  deliveryFee: number;
  cashDue: number;       // 现金应收 = originalTotal − coverage − upgradeCoverage + deliveryFee
  /**
   * 本天可用预付储值抵的需求：高价菜 top-up（dish.topUpAddonId × 用券份数，
   * source='topup'）+ 计划里手选的可预付加料（荷包蛋/加饭等，source='addon'）。
   * topup 部分由 allocateVouchers 现算 —— 见该函数注释。
   */
  upgradeNeeds: UpgradeNeed[];
  /** 加料储值需求（与用不用券无关，buildWeekPlan 一次算好不再变）。 */
  addonNeeds: UpgradeNeed[];
  /** allocateUpgradeCredits 分配结果：实际用掉的 credit。 */
  upgradeUsed: { addonId: string; count: number }[];
  /** 被预付升级 credit 覆盖的 top-up 金额 RM（已从 cashDue 扣除）。 */
  upgradeCoverage: number;
  warnings: string[];
  blocked: boolean;      // 有硬伤（菜不存在/当日停业等）→ confirm 时整天跳过
}

/**
 * 把客户手上的餐券分给全周的主菜份，并回填每天的
 * vCount / coverage / cashUnits / upgradeNeeds / cashDue。
 *
 * 老板 2026-08-02 拍板：**券不够不再拦确认** —— 分不到券的份按那道菜的原价
 * 收现金（不打折），且**券优先抵贵的菜、便宜的那几份走现金**，客户最省。
 * 排序键 = voucherValue（一张券真正抵掉的钱）而非 price：三文鱼 24.90 的券面值
 * 是 19.90（另补 RM5），与豆酱焖花肉 19.90 用券省的钱一样多，price 只作同额时
 * 的次键让顺序符合直觉。sort 稳定 → 完全同价的份保持周一→周五，结果可复现。
 *
 * ⚠️ 必须在 allocateUpgradeCredits **之前**跑：本函数会重置 upgradeUsed /
 * upgradeCoverage / cashDue，反过来会把储值抵扣抹掉。
 *
 * blocked 天不建单也不占券，但保留「假如建单」的原口径显示，免得预览里
 * 一排删除线的天忽然全变成现金，看着像出事。
 */
export function allocateVouchers(days: PlannedDay[], available: number): void {
  const ranked = days.filter(d => !d.blocked).flatMap(d => d.units)
    .sort((a, b) => b.voucherValue - a.voucherValue || b.price - a.price);
  let left = Math.max(0, Math.floor(available));
  for (const u of ranked) {
    u.useVoucher = left > 0;
    if (left > 0) left--;
  }

  for (const d of days) {
    const voucherUnits = d.blocked ? d.units : d.units.filter(u => u.useVoucher);
    const cashUnits = d.blocked ? [] : d.units.filter(u => !u.useVoucher);
    d.vCount = voucherUnits.length;
    d.coverage = round2(voucherUnits.reduce((s, u) => s + u.voucherValue, 0));
    d.cashUnits = cashUnits.length;
    d.cashUnitsAmount = round2(cashUnits.reduce((s, u) => s + u.price, 0));

    // 高价菜补差只对「用券的份」成立 —— 付原价现金的那份三文鱼是整份售卖，
    // 没有 top-up 概念，绝不能白扣客户的升级储值。
    const topUps = new Map<string, UpgradeNeed>();
    for (const u of voucherUnits) {
      if (!u.topUpAddonId || u.voucherTopUp <= 0) continue;
      const key = `${u.topUpAddonId}|${u.voucherTopUp}`;
      const prev = topUps.get(key);
      if (prev) prev.count += 1;
      else topUps.set(key, { addonId: u.topUpAddonId, count: 1, unitRM: u.voucherTopUp, source: 'topup' });
    }
    d.upgradeNeeds = [...topUps.values(), ...d.addonNeeds];
    d.upgradeUsed = [];
    d.upgradeCoverage = 0;
    d.cashDue = round2(d.originalTotal - d.coverage + d.deliveryFee);
  }
}
