// READ-ONLY: 每日运营巡检 orchestrator。
//
// 用法:
//   node scripts/daily-check.mjs --dry            只打印，不发 Telegram
//   node scripts/daily-check.mjs --notify         跑完推 Telegram
//   node scripts/daily-check.mjs --only C01,C06   只跑指定检查
//   node scripts/daily-check.mjs --date 2026-09-05  覆盖「目标营业日」基准（补跑用）
//
// 设计铁律（见 tasks/todo-daily-ops-agent.md 第三节）:
//   G1 Telegram 一律纯文本、不传 parse_mode；发送失败必须抛错，不能静默
//   G2 每个 spawn 25s 超时，超时算「探针失效」不算通过
//   G3 每条检查必须回报 scanned/candidates/fired；scanned==0 → 探针失效，绝不当通过
//   G4 白名单硬断言拒绝 --apply/--fix/--commit/--live
//
// 本脚本自己一行写操作都没有。spawn 出去的脚本必须逐个人工确认过只读才准进 REGISTRY。

import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

// ── 常量 ──────────────────────────────────────────────────────────────
const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
const TELEGRAM_CONFIG = 'C:/Users/User/.incredibowl/telegram-config.json';
const BASELINE_PATH = path.resolve('scripts/daily-check-baseline.json');
const REPO = path.resolve('.');
const MAX_DELIVERY_KM = 25; // src/lib/deliveryUtils.ts:135
const ADMIN_EMAILS = ['hello@incredibowl.my', 'incredibowl.my@gmail.com'];
const SPAWN_TIMEOUT_MS = 25_000;
const TG_MAX = 3800;
const BANNED_ARGS = ['--apply', '--fix', '--commit', '--live', '--write', '--force'];
// rollbackDoneAt 是 2026-08-04 才引入的字段。不加下限的话 06/07 月的存量永远归不了零。
const ROLLBACK_ERA_START = '2026-08-04';

// ── CLI ───────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const DRY = has('--dry') || !has('--notify');
const ONLY = (val('--only') || '').split(',').map((s) => s.trim()).filter(Boolean);
const DATE_OVERRIDE = val('--date');

// ── 营业日历（从 src/data/blockedDates.ts 解析，解析不到要抛错不能静默）──
function loadCalendar() {
  const src = fs.readFileSync(path.join(REPO, 'src/data/blockedDates.ts'), 'utf-8');
  const grab = (name) => {
    const m = src.match(new RegExp(`${name}[^=]*=\\s*\\[([\\s\\S]*?)\\]`));
    return m ? [...m[1].matchAll(/'(\d{4}-\d{2}-\d{2})'/g)].map((x) => x[1]) : null;
  };
  const closureBlock = src.match(/CLOSURES[^=]*=\s*\[([\s\S]*?)\];/);
  const closed = closureBlock ? [...closureBlock[1].matchAll(/date:\s*'(\d{4}-\d{2}-\d{2})'/g)].map((x) => x[1]) : null;
  const dinnerClosed = grab('DINNER_CLOSED_DATES');
  // G3：解析器本身也要断言。抓不到就是 blockedDates.ts 结构变了，必须炸而不是当成「没有停业日」。
  if (!closed) throw new Error('解析 CLOSURES 失败 —— blockedDates.ts 结构可能变了');
  if (!dinnerClosed) throw new Error('解析 DINNER_CLOSED_DATES 失败 —— blockedDates.ts 结构可能变了');

  // 暂别/退役的菜。权威源是 weeklyMenu.ts 不是 Firestore menu ——
  // Firestore 那份是派生快照，暂别的菜可能还留在里面（实测 id 22 参峇臭豆就是）。
  const menuSrc = fs.readFileSync(path.join(REPO, 'src/data/weeklyMenu.ts'), 'utf-8');
  const pausedBlock = menuSrc.match(/PAUSED_DISHES[^=]*=\s*\[([\s\S]*?)\];/);
  if (!pausedBlock) throw new Error('解析 PAUSED_DISHES 失败 —— weeklyMenu.ts 结构可能变了');
  const paused = new Set([...pausedBlock[1].matchAll(/id:\s*(\d+)/g)].map((x) => x[1]));
  if (paused.size === 0) throw new Error('PAUSED_DISHES 解析出 0 个 id —— 正则可能失效了，拒绝当成「没有暂别菜」');

  return { closed, dinnerClosed, paused };
}

const ymd = (d) => {
  const kl = new Date(d.getTime() + 8 * 3600_000);
  return kl.toISOString().slice(0, 10);
};
const addDays = (s, n) => {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dowOf = (s) => new Date(s + 'T00:00:00Z').getUTCDay(); // 0=日 6=六

/** 下一个可下单营业日：跳过周末 + CLOSED_DATES。找不到就是日历配错了，要抛错。 */
function nextOpenDayAfter(fromYmd, cal) {
  for (let i = 1; i <= 21; i++) {
    const d = addDays(fromYmd, i);
    const dow = dowOf(d);
    if (dow === 0 || dow === 6) continue;
    if (cal.closed.includes(d)) continue;
    return d;
  }
  throw new Error(`nextOpenDayAfter(${fromYmd}) 21 天内找不到营业日 —— 日历可能配错`);
}

// ── 共享 Firestore 上下文（懒加载，同一集合只拉一次）──────────────────
function makeCtx(db, today, targetDay, cal, baseline) {
  const cache = new Map();
  const load = async (name) => {
    if (!cache.has(name)) cache.set(name, (await db.collection(name).get()).docs);
    return cache.get(name);
  };
  return { db, today, targetDay, cal, baseline, load, now: Date.now() };
}

// ── 检查结果构造器 ────────────────────────────────────────────────────
const pass = (scanned, note, candidates = 0) => ({ status: 'pass', scanned, candidates, fired: 0, lines: [], note });
const fire = (scanned, candidates, lines, action) => ({ status: 'fire', scanned, candidates, fired: lines.length, lines, action });
const probeFail = (why) => ({ status: 'probe_fail', scanned: 0, candidates: 0, fired: 0, lines: [why], action: '查这条检查的数据源是不是变了' });

const short = (id) => '#' + String(id).slice(-6).toUpperCase();
const rm = (n) => 'RM' + Number(n || 0).toFixed(2);
const toMs = (t) => t?.toMillis?.() ?? (t?.toDate?.()?.getTime?.() ?? (t ? new Date(t).getTime() : NaN));
const fmt = (t) => { const m = toMs(t); return Number.isFinite(m) ? new Date(m + 8 * 3600_000).toISOString().slice(0, 16).replace('T', ' ') : '(无时间)'; };

// ── 检查清单 ──────────────────────────────────────────────────────────
const REGISTRY = [
  // ══ P0 ══════════════════════════════════════════════════════════════
  {
    id: 'C01', name: 'FPX 收了钱订单没了', severity: 'P0', kind: 'inline',
    async run(ctx) {
      const docs = await ctx.load('orders');
      if (!docs.length) return probeFail('orders 集合扫到 0 条');
      const lines = [];
      let cand = 0;
      const byUserRecent = new Map();
      for (const d of docs) {
        const o = d.data();
        const ms = toMs(o.createdAt);
        // 缺 createdAt 会被算成 490000h —— 显式要求它存在，不然是脏数据不是超时
        if (o.status === 'pending' && o.paymentMethod === 'fpx') {
          cand++;
          if (!Number.isFinite(ms)) { lines.push(`${short(d.id)} FPX pending 但缺 createdAt（脏数据）`); continue; }
          const ageH = (ctx.now - ms) / 3600_000;
          if (ageH > 1) lines.push(`${short(d.id)} ${o.userName || '?'} ${rm(o.total)} FPX pending ${ageH.toFixed(1)}h · ${o.razorpayOrderId || '无 orderId'}`);
        }
        // 近 24h 被自动超时取消的 —— 这才是真丢钱的终态，要逐笔去 Curlec 核 captured
        if (o.cancelReason === 'fpx-timeout-auto' && Number.isFinite(ms) && ms > ctx.now - 86400_000) {
          cand++;
          lines.push(`${short(d.id)} ${o.userName || '?'} ${rm(o.total)} 已自动超时取消 · ${o.razorpayOrderId || '无 orderId'} → 去 Curlec 核有没有 captured`);
        }
        if (o.needsReview === true || o.latePaymentCaptured === true) {
          cand++;
          lines.push(`${short(d.id)} ${o.userName || '?'} 挂着 needsReview/latePaymentCaptured 兜底标记`);
        }
        // 双标签页征兆：同 userId 10 分钟内两笔 pending
        if (o.status === 'pending' && o.userId && Number.isFinite(ms)) {
          const arr = byUserRecent.get(o.userId) || [];
          arr.push({ id: d.id, ms });
          byUserRecent.set(o.userId, arr);
        }
      }
      for (const [uid, arr] of byUserRecent) {
        if (arr.length < 2) continue;
        arr.sort((a, b) => a.ms - b.ms);
        for (let i = 1; i < arr.length; i++) {
          if (arr[i].ms - arr[i - 1].ms < 600_000) {
            cand++;
            lines.push(`同一 userId ${uid.slice(0, 8)}… 10 分钟内两笔 pending：${short(arr[i - 1].id)} / ${short(arr[i].id)}（双标签页征兆）`);
          }
        }
      }
      return lines.length ? fire(docs.length, cand, lines, '逐笔拿 razorpayOrderId 去 Curlec Dashboard 查 captured') : pass(docs.length);
    },
  },
  {
    id: 'C02', name: '付了钱没拿到券', severity: 'P0', kind: 'inline',
    async run(ctx) {
      const docs = await ctx.load('mealVoucherPurchases');
      if (!docs.length) return probeFail('mealVoucherPurchases 扫到 0 条');
      const vouchers = await ctx.load('mealVouchers');
      const mintedBy = new Map();   // 铸了多少张（含已作废）
      const liveBy = new Map();     // 还在外面的（作废/过期的不算）
      // voided 券是已经收回去的，不是「在外」—— 老板的 FPX 测试单 #RE8JYN 就是
      // 取消后正确 void 掉了券，不排除的话每天误报一条（2026-09-02 实测踩过）。
      const DEAD_VOUCHER = new Set(['voided', 'cancelled', 'expired', 'refunded']);
      for (const v of vouchers) {
        const x = v.data();
        const p = x.purchaseId;
        if (!p) continue;
        mintedBy.set(p, (mintedBy.get(p) || 0) + 1);
        if (!DEAD_VOUCHER.has(x.status)) liveBy.set(p, (liveBy.get(p) || 0) + 1);
      }
      const lines = [];
      let cand = 0;
      for (const d of docs) {
        const p = d.data();
        // addon-topup 是预付加料 credits，本来就不铸券 —— 实测 13 条异常里 8 条是这个误报
        if (p.bundleSize === 'addon-topup' || p.type === 'addon-topup' || /addon/i.test(String(p.bundleSize || ''))) continue;
        const minted = mintedBy.get(d.id) || (p.voucherIds?.length ?? 0);
        const expect = Number(p.voucherCount ?? p.bundleSize ?? 0);
        if (p.status === 'paid') {
          cand++;
          if (minted === 0) lines.push(`${short(d.id)} ${p.userName || '?'} ${rm(p.amountPaid)} 已标 paid 却 0 张券 —— 严重孤儿`);
          else if (expect && minted !== expect) lines.push(`${short(d.id)} ${p.userName || '?'} 应铸 ${expect} 实铸 ${minted} 张（数量不符）`);
        } else if (p.status === 'pending' && p.razorpayOrderId && !p.razorpayPaymentId) {
          cand++;
          const ageD = (ctx.now - toMs(p.createdAt)) / 86400_000;
          lines.push(`${short(d.id)} ${p.userName || '?'} ${rm(p.amountPaid)} FPX 卡 pending ${ageD.toFixed(0)} 天 · ${p.razorpayOrderId}`);
        } else if (p.status === 'cancelled') {
          const live = liveBy.get(d.id) || 0;
          if (live > 0) {
            cand++;
            lines.push(`${short(d.id)} ${p.userName || '?'} 已取消却有 ${live} 张券仍可用（共铸 ${minted} 张）`);
          }
        }
      }
      return lines.length ? fire(docs.length, cand, lines, '去 Curlec 核这笔有没有 captured；严禁无 paymentId 直接补券') : pass(docs.length);
    },
  },
  {
    id: 'C03', name: '取消回补没封口', severity: 'P0', kind: 'inline',
    async run(ctx) {
      const docs = await ctx.load('orders');
      if (!docs.length) return probeFail('orders 扫到 0 条');
      const lines = [];
      let cand = 0;
      for (const d of docs) {
        const o = d.data();
        const day = o.deliveryDate || '';
        // 时代下限必须卡在「回补发生的时间」上，不是 deliveryDate ——
        // #PJKF86 是 08-02 取消、08-04 送达，卡 deliveryDate 会把一笔
        // 早于字段引入日的老单天天报出来（2026-09-02 实测踩过）。
        const rbDay = o.rollbackAt ? new Date(toMs(o.rollbackAt) + 8 * 3600_000).toISOString().slice(0, 10) : null;
        const cancelDay = o.cancelledAt ? new Date(toMs(o.cancelledAt) + 8 * 3600_000).toISOString().slice(0, 10) : day;
        if (o.rollbackAt && o.status && !['cancelled', 'refunded'].includes(o.status)) {
          cand++; lines.push(`${short(d.id)} 有 rollbackAt 但状态是 ${o.status} —— 已回补的单被复活`);
        }
        if (o.status === 'cancelled' && o.rollbackAt && !o.rollbackDoneAt && rbDay && rbDay >= ROLLBACK_ERA_START) {
          cand++; lines.push(`${short(d.id)} ${day} 取消回补只做了一半（回补于 ${rbDay}，无 rollbackDoneAt）`);
        }
        if (o.status === 'cancelled' && !o.rollbackAt && cancelDay >= ROLLBACK_ERA_START) {
          cand++; lines.push(`${short(d.id)} ${day} 取消了但完全没有回补标记（取消于 ${cancelDay}）`);
        }
      }
      return lines.length ? fire(docs.length, cand, lines, 'Dashboard 查这几单的券/库存有没有退回去') : pass(docs.length);
    },
  },
  {
    id: 'C06', name: '订单卡在配送中', severity: 'P0', kind: 'inline',
    async run(ctx) {
      const docs = await ctx.load('orders');
      if (!docs.length) return probeFail('orders 扫到 0 条');
      const delivering = docs.filter((d) => d.data().status === 'delivering');
      const byBatch = new Map();
      const grabNoBatch = [];
      for (const d of delivering) {
        const o = d.data();
        if (!o.batchId) { grabNoBatch.push({ id: d.id, o }); continue; }
        const arr = byBatch.get(o.batchId) || [];
        arr.push({ id: d.id, o });
        byBatch.set(o.batchId, arr);
      }
      const lines = [];
      for (const [bid, arr] of byBatch) {
        // 按批次聚合成一条，别让 5 个子判据各出一行
        const oldest = Math.min(...arr.map((x) => toMs(x.o.deliveringAt || x.o.updatedAt) || ctx.now));
        const ageH = (ctx.now - oldest) / 3600_000;
        if (ageH > 4) lines.push(`批次 ${bid.slice(0, 8)}… ${ageH.toFixed(1)}h · 还有 ${arr.length} 单未收尾：${arr.map((x) => short(x.id)).join(' ')}`);
      }
      // Grab 单结构性无 batchId，自动收尾永远碰不到 —— 单独分组，只报过夜的
      const staleGrab = grabNoBatch.filter((x) => {
        const ms = toMs(x.o.grabAssignedAt || x.o.updatedAt);
        return Number.isFinite(ms) && (ctx.now - ms) / 3600_000 > 8;
      });
      if (staleGrab.length) {
        lines.push(`Grab 单卡过夜 ${staleGrab.length} 单（无 batchId，自动收尾碰不到）：${staleGrab.map((x) => short(x.id)).join(' ')}`);
      }
      return lines.length
        ? fire(docs.length, delivering.length, lines, 'Dashboard 配送页手动收尾')
        : pass(docs.length, `delivering ${delivering.length} 单，均未超时`);
    },
  },
  {
    id: 'C05', name: '目标日排期菜售罄 / 库存为负', severity: 'P0', kind: 'inline',
    async run(ctx) {
      const stock = await ctx.load('dishStock');
      if (!stock.length) return probeFail('dishStock 扫到 0 条');
      const menu = await ctx.load('menu');
      if (!menu.length) return probeFail('menu 集合扫到 0 条 —— 无法交叉排期，拒绝当成通过');
      const dow = dowOf(ctx.targetDay);
      // Firestore menu 的 weekday 是字符串 'Mon'..'Fri' / 'Daily'（2026-08-28 实地核过），不是数字
      const DOW_TAG = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const tag = DOW_TAG[dow];
      // 只看目标日真的排了的、且没退役/没隐藏的菜。不交叉的话每天固定 2 条误报。
      const scheduled = new Map();
      for (const m of menu) {
        const x = m.data();
        if (x.retired === true || x.hidden === true || x.active === false) continue;
        // 暂别菜按 weeklyMenu.ts 的 PAUSED_DISHES 排除 —— Firestore menu 里还留着它们
        if (ctx.cal.paused.has(String(m.id))) continue;
        const wd = String(x.weekday ?? x.day ?? '');
        if (wd && wd !== 'Daily' && wd !== tag) continue;
        scheduled.set(String(m.id), x.name || x.dishName || m.id);
      }
      // G3：目标日一道菜都没排到 = 交叉不上，绝不能当「没有售罄的菜」放过。
      // 这正是本仓库最贵的事故族（匹配不上就当没有）在巡检自身上的复现。
      if (scheduled.size === 0) return probeFail(`目标日 ${ctx.targetDay}（周${'日一二三四五六'[dow]}）在 menu 集合里排到 0 道菜 —— 交叉不上，拒绝当通过`);
      const lines = [];
      let cand = 0;
      for (const s of stock) {
        const v = s.data();
        const remaining = Number(v.remaining ?? 0);
        if (remaining < 0) { cand++; lines.push(`${v.dishName || s.id} 库存为负 ${remaining} —— 一扣一补凭空印货`); continue; }
        if (!scheduled.has(String(s.id))) continue;
        cand++;
        if (remaining <= 0) lines.push(`${scheduled.get(String(s.id))} ${ctx.targetDay} 排了但 remaining=0 —— 网站已灰掉，当日主推静默下架`);
      }
      return lines.length ? fire(stock.length, cand, lines, 'Dashboard 库存页补 remaining，或确认就是要停售') : pass(stock.length, `目标日 ${ctx.targetDay} 排期 ${scheduled.size} 道`, cand);
    },
  },
  {
    id: 'D09', name: '管理员邮箱冒名', severity: 'P0', kind: 'inline',
    async run(ctx) {
      const users = await ctx.load('users');
      if (!users.length) return probeFail('users 扫到 0 条');
      const lines = [];
      let cand = 0;
      const byEmail = new Map();
      for (const u of users) {
        const e = String(u.data().email || '').toLowerCase().trim();
        if (!ADMIN_EMAILS.includes(e)) continue;
        cand++;
        const arr = byEmail.get(e) || [];
        arr.push(u.id);
        byEmail.set(e, arr);
      }
      for (const [e, ids] of byEmail) {
        if (ids.length > 1) lines.push(`管理员邮箱 ${e} 对应 ${ids.length} 个 uid：${ids.join(' ')} —— 冒名可读写整库`);
      }
      // G3：这条的探针是「ADMIN_EMAILS 至少命中老板自己」。一个都没命中说明 email 字段口径变了。
      if (cand === 0) return probeFail('users 里一个 ADMIN_EMAILS 都没命中 —— email 字段口径可能变了');
      return lines.length ? fire(users.length, cand, lines, '立刻查这个 uid 是谁；adminApi.ts 仍是纯字符串比对不查 email_verified') : pass(users.length);
    },
  },
  {
    id: 'D10', name: '配送硬上限 / 距离字段被改写', severity: 'P0', kind: 'inline',
    async run(ctx) {
      const orders = await ctx.load('orders');
      const users = await ctx.load('users');
      if (!orders.length || !users.length) return probeFail('orders/users 扫到 0 条');
      const lines = [];
      let cand = 0;
      const cutoff = addDays(ctx.today, -30);
      for (const d of orders) {
        const o = d.data();
        if ((o.deliveryDate || '') < cutoff) continue;
        if (o.deliveryMethod === 'pickup' || o.isManual === true) continue;
        const km = Number(o.deliveryDistanceKm ?? NaN);
        cand++;
        // 不判「km>2.5 却免运」—— 满额免运是正常业务（thresholdForDistance 按档给门槛，
        // 还有 grandfathering 老客）。要判得准就得完整重实现费率阶梯，重实现出来的口径
        // 一旦和 deliveryUtils.ts 漂移，这条检查本身就成了错误来源。
        // 只留能确定判断的：超过硬上限还送 = 无论门槛怎么算都不该发生。
        if (Number.isFinite(km) && km > MAX_DELIVERY_KM) {
          lines.push(`${short(d.id)} ${o.deliveryDate} ${o.userName || '?'} ${km.toFixed(1)}km 超过 ${MAX_DELIVERY_KM}km 硬上限却收了单`);
        }
      }
      for (const u of users) {
        const x = u.data();
        const km = Number(x.addressDistanceKm ?? NaN);
        if (x.address && Number.isFinite(km) && km === 0) {
          cand++; lines.push(`用户 ${x.name || u.id.slice(0, 8)} 有地址但 addressDistanceKm=0`);
        }
      }
      return lines.length ? fire(orders.length + users.length, cand, lines, 'firestore.rules 的 userSafeFields 仍含 addressDistanceKm/deliveryZone —— 客户端可自改') : pass(orders.length + users.length, null, cand);
    },
  },
  {
    id: 'C09a', name: '停业日残单', severity: 'P0', kind: 'inline',
    async run(ctx) {
      const docs = await ctx.load('orders');
      if (!docs.length) return probeFail('orders 扫到 0 条');
      const lines = [];
      let cand = 0;
      for (const d of docs) {
        const o = d.data();
        const day = o.deliveryDate || '';
        if (day < ctx.today) continue;
        if (['cancelled', 'refunded'].includes(o.status)) continue;
        cand++;
        if (ctx.cal.closed.includes(day)) lines.push(`${short(d.id)} ${day} 是停业日却有单 · ${o.userName || '?'} ${rm(o.total)}`);
        else if (ctx.cal.dinnerClosed.includes(day) && (o.mealSlot === 'dinner' || o.slot === 'dinner')) {
          lines.push(`${short(d.id)} ${day} 只送午餐却收了晚餐单 · ${o.userName || '?'}`);
        }
      }
      return lines.length ? fire(docs.length, cand, lines, 'CLOSED_DATES 只挡新单，这些旧单要人工联系客户改期') : pass(docs.length);
    },
  },

  // ══ P1 ══════════════════════════════════════════════════════════════
  {
    // 存量 21 条（2026-08-28 实测），是慢性问题不是当天事故 —— 只报比昨天新增的。
    // 客户改了地址就下不了单（submit-order 直接拒收），而客户端不会告诉你有多少人卡着 = 隐形流失。
    id: 'D24', name: '地址改了没重验（隐形流失）', severity: 'P1', kind: 'inline',
    async run(ctx) {
      const users = await ctx.load('users');
      if (!users.length) return probeFail('users 扫到 0 条');
      const stuck = [];
      for (const u of users) {
        const x = u.data();
        // 必须跟 submit-order/route.ts:385-386 用一模一样的比较语义（两边都 trim），
        // 否则一个尾部空格就会把正常客户报成「下不了单」（2026-09-02 实测踩过）。
        const verified = typeof x.addressVerifiedText === 'string' ? x.addressVerifiedText.trim() : '';
        const current = typeof x.address === 'string' ? x.address.trim() : '';
        if (verified && current && verified !== current) {
          stuck.push(`${x.name || x.phone || u.id.slice(0, 8)}`);
        }
      }
      const prev = Number(ctx.baseline?.D24?.known ?? -1);
      if (prev < 0) return pass(users.length, `${stuck.length} 位卡着（未设 baseline，先记数不报）`, stuck.length);
      const delta = stuck.length - prev;
      return delta > 0
        ? fire(users.length, stuck.length, [`比 baseline 新增 ${delta} 位卡在「地址已改未重验」：${stuck.slice(-delta).join(' · ')}`], '这些人下单会被拒收且不会来问，主动联系或帮他们重验')
        : pass(users.length, `${stuck.length} 位卡着（baseline ${prev}，无新增）`, stuck.length);
    },
  },
  {
    id: 'C08', name: '下一个营业日零单', severity: 'P1', kind: 'inline',
    async run(ctx) {
      const docs = await ctx.load('orders');
      if (!docs.length) return probeFail('orders 扫到 0 条');
      const live = docs.filter((d) => {
        const o = d.data();
        return o.deliveryDate === ctx.targetDay && !['cancelled', 'refunded'].includes(o.status);
      });
      // 目标日离今天太远时，零单是正常的（客户前一天才下单，06:00 截单）。
      // 长假后的第一个营业日可能在 6 天后，那时报「零单」是纯噪声。
      const daysOut = Math.round((new Date(ctx.targetDay) - new Date(ctx.today)) / 86400_000);
      if (daysOut > 2) return pass(docs.length, `${ctx.targetDay} 还有 ${daysOut} 天，零单属正常（已有 ${live.length} 单）`, live.length);
      // 只报 0，不设比例线 —— 仓库里没有单量方差数据，拍阈值没依据
      if (live.length === 0) {
        return fire(docs.length, 0, [`${ctx.targetDay} 一单都没有 —— 也可能是建单链路挂了`], '开网站自己下一单试试，确认下单链路通不通');
      }
      return pass(docs.length, `${ctx.targetDay} 已有 ${live.length} 单`, live.length);
    },
  },
  {
    id: 'C10', name: '临期餐券', severity: 'P1', kind: 'inline',
    async run(ctx) {
      const vouchers = await ctx.load('mealVouchers');
      if (!vouchers.length) return probeFail('mealVouchers 扫到 0 条');
      const purchases = await ctx.load('mealVoucherPurchases');
      const nameOf = new Map();
      for (const p of purchases) nameOf.set(p.id, p.data().userName || '');
      // 到期前最后一个可下单营业日 —— 不是数天数。下周 08-31~09-02 全休，
      // 09-01 到期的券实际最后可用日就是 08-28。
      const lines = [];
      let cand = 0;
      const horizon = addDays(ctx.today, 21);
      for (const v of vouchers) {
        const x = v.data();
        if (x.status !== 'available') continue;
        const expMs = toMs(x.expiresAt);
        if (!Number.isFinite(expMs)) continue;
        const exp = new Date(expMs + 8 * 3600_000).toISOString().slice(0, 10);
        cand++;
        // 餐券没有到期扫描器，过期券 status 会一直停在 available
        if (exp < ctx.today) { lines.push(`${nameOf.get(x.purchaseId) || x.userName || '?'} 有券已过期（${exp}）但仍标 available`); continue; }
        if (exp > horizon) continue;
        let lastUsable = null;
        for (let i = 0; i <= 21; i++) {
          const d = addDays(ctx.today, i);
          if (d > exp) break;
          const dow = dowOf(d);
          if (dow === 0 || dow === 6) continue;
          if (ctx.cal.closed.includes(d)) continue;
          lastUsable = d;
        }
        if (!lastUsable) lines.push(`${nameOf.get(x.purchaseId) || x.userName || '?'} 券 ${exp} 到期，但到期前已无可下单营业日`);
        else if (lastUsable <= addDays(ctx.today, 3)) lines.push(`${nameOf.get(x.purchaseId) || x.userName || '?'} 券 ${exp} 到期，最后可用日 ${lastUsable}`);
      }
      // 同一客户多张券压成一行
      const grouped = [...new Set(lines)];
      return grouped.length ? fire(vouchers.length, cand, grouped, '发一条 WhatsApp 提醒他们用掉') : pass(vouchers.length, `available ${cand} 张，均不临期`);
    },
  },
  {
    id: 'C12', name: 'QR pending 占库存 / 买券待审', severity: 'P1', kind: 'inline',
    async run(ctx) {
      const orders = await ctx.load('orders');
      const purchases = await ctx.load('mealVoucherPurchases');
      if (!orders.length) return probeFail('orders 扫到 0 条');
      const lines = [];
      let cand = 0;
      // 两个超时清理器都只扫 fpx，QR pending 结构性永不清理
      for (const d of orders) {
        const o = d.data();
        if (o.status !== 'pending' || o.paymentMethod !== 'qr') continue;
        cand++;
        const ageH = (ctx.now - toMs(o.createdAt)) / 3600_000;
        if (ageH > 6) lines.push(`${short(d.id)} ${o.userName || '?'} QR pending ${ageH.toFixed(0)}h —— 一直占着限量库存`);
      }
      for (const p of purchases) {
        const x = p.data();
        if (x.status !== 'pending-review') continue;
        cand++;
        lines.push(`${short(p.id)} ${x.userName || '?'} ${rm(x.amountPaid)} 买券收据待审 —— 两条通知通道都够不到这个状态`);
      }
      return lines.length ? fire(orders.length + purchases.length, cand, lines, 'Dashboard 确认收款或取消释放库存') : pass(orders.length + purchases.length);
    },
  },
  {
    id: 'C09b', name: '配送数据缺口', severity: 'P1', kind: 'inline',
    async run(ctx) {
      const docs = await ctx.load('orders');
      if (!docs.length) return probeFail('orders 扫到 0 条');
      const cutoff = addDays(ctx.today, -28);
      let noAddr = 0, noKm = 0, unclassified = 0, cand = 0;
      const samples = [];
      for (const d of docs) {
        const o = d.data();
        if ((o.deliveryDate || '') < cutoff) continue;
        if (['cancelled', 'refunded'].includes(o.status)) continue;
        cand++;
        const method = o.deliveryMethod;
        // 未来单（含今天，可能还在路上）本来就还没定配送方式，不算「未分类」。
        // 2026-09-02 实测：21 单「未分类」全是 09-03/09-04/09-09 的未送单，
        // 照着报会诱导人跑 --rest-self，把未来单批量标成自送、污染配送成本。
        const notDeliveredYet = (o.deliveryDate || '') >= ctx.today;
        if (!method) { if (!notDeliveredYet) unclassified++; continue; }
        if (method !== 'self') continue;
        // 字段名是 userAddress / deliveryDistanceKm —— 2026-08-28 实地核过，别改成猜的
        if (!o.userAddress) { noAddr++; samples.push(`${short(d.id)} 自送但无地址`); continue; }
        const km = Number(o.deliveryDistanceKm ?? NaN);
        if (!Number.isFinite(km) || km <= 0) noKm++;
      }
      const lines = [];
      // 报绝对条数，不用占比阈值。self 无地址零容忍（历史全库只有 3 单）
      if (noAddr > 0) lines.push(`自送无地址 ${noAddr} 单（零容忍）：${samples.slice(0, 3).join(' · ')}`);
      if (noKm > 3) lines.push(`自送缺距离 ${noKm} 单 —— 配送成本会被算成 0`);
      if (unclassified > 20) lines.push(`未分类配送方式 ${unclassified} 单 —— 跑 sync-grab-receipts 补`);
      return lines.length
        ? fire(docs.length, cand, lines, '跑 npm 里的 sync-grab-receipts 然后 --rest-self')
        : pass(docs.length, `近 28 天 ${cand} 单：无地址 ${noAddr} · 缺 km ${noKm} · 未分类 ${unclassified}`, cand);
    },
  },

  // ══ spawn 现有只读脚本 ══════════════════════════════════════════════
  {
    id: 'C11p', name: '价格漂移', severity: 'P1', kind: 'spawn',
    cmd: 'npm', args: ['run', '--silent', 'check:prices'],
    // 这个脚本本来就带 exit code 约定：1=漂移 2=探针失效
    parse: (code, out) => code === 0 ? pass(1, '价格一致')
      : code === 2 ? probeFail('check:prices 自己报探针失效')
      : fire(1, 1, out.split('\n').filter((l) => l.trim()).slice(-8), '跑 npm run sync:prices'),
  },
  {
    id: 'D17', name: 'Firestore menu 排期漂移', severity: 'P1', kind: 'spawn',
    cmd: 'node', args: ['scripts/check-firestore-menu-days.mjs'],
    parse: (code, out) => {
      if (!out.trim()) return probeFail('check-firestore-menu-days 无输出');
      // active/price 的差异是正常的，不要报
      const bad = out.split('\n').filter((l) => /不一致|缺|漂移|mismatch|missing/i.test(l) && !/active|price/i.test(l));
      return bad.length ? fire(1, bad.length, bad.slice(0, 8), '跑 npm run sync:menu') : pass(1);
    },
  },
  {
    id: 'C07', name: '餐券/加料池 MFRS15 闭合', severity: 'P1', kind: 'spawn',
    cmd: 'node', args: ['scripts/audit-voucher-revenue-closure.mjs'],
    // 这个脚本永远 exit 0，必须 parse 🔴 标记
    parse: (code, out, baseline) => {
      if (!out.trim()) return probeFail('audit-voucher-revenue-closure 无输出');
      const red = out.split('\n').filter((l) => l.includes('🔴'));
      const known = new Set(baseline?.C07?.knownRed || []);
      const fresh = red.filter((l) => ![...known].some((k) => l.includes(k)));
      return fresh.length ? fire(1, red.length, fresh.slice(0, 6), '查这笔券/credit 的批次扣减对不对') : pass(1, `已知差额 ${red.length} 条在 baseline 内`);
    },
  },
  {
    // 2026-09-05 新增。webhook 收到 payment.captured 却对不上任何 mealVoucherPurchases
    // 或 orders 时，以前静默返回 200 —— 钱收了、没人知道。现在 webhook 会往
    // unmatchedPayments 落一条，这里每天扫。**空集合 = 健康**，所以 scanned 借用
    // orders 的条数（G3 规定 scanned=0 一律当探针失效，不能用 0）。
    id: 'C13', name: 'webhook 收到钱但对不上订单', severity: 'P0', kind: 'inline',
    async run(ctx) {
      const orders = await ctx.load('orders');
      if (!orders.length) return probeFail('orders 集合扫到 0 条（探针借它当基数）');
      let docs;
      try {
        docs = (await ctx.db.collection('unmatchedPayments').get()).docs;
      } catch (e) {
        return probeFail(`读 unmatchedPayments 失败：${e.message}`);
      }
      const lines = [];
      for (const d of docs) {
        const p = d.data();
        if (p.resolved === true) continue;   // 人工核完后手动打 resolved:true 即可静音
        const when = fmt(p.receivedAt);
        lines.push(`${p.razorpayPaymentId || d.id} · rzpOrder ${p.razorpayOrderId || '?'} · ${p.eventType || '?'} · ${when}`);
      }
      return lines.length
        ? fire(orders.length, docs.length, lines, '拿 paymentId 去 Curlec 查这笔钱属于谁，补单或退款；处理完把该 doc 打 resolved:true')
        : pass(orders.length, `unmatchedPayments 空（${docs.length} 条历史全已 resolved）`);
    },
  },
];

// ── spawn 执行器（G2 超时 + G4 参数硬断言）────────────────────────────
function runSpawn(check) {
  for (const a of check.args) {
    if (BANNED_ARGS.includes(String(a).toLowerCase())) {
      throw new Error(`G4 违规：检查 ${check.id} 的参数含 ${a} —— 巡检只准只读`);
    }
  }
  return new Promise((resolve) => {
    let out = '', done = false;
    // Windows 上只有 npm/npx 这类 .cmd 包装器需要 shell；对 node 用 shell 会让
    // 参数里的括号/大括号被 cmd 二次解析（实测会让子进程秒退且伪装成成功）。
    const needsShell = process.platform === 'win32' && /^(npm|npx|yarn|pnpm)$/i.test(check.cmd);
    const p = spawn(check.cmd, check.args, { cwd: REPO, shell: needsShell });
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      try { p.kill(); } catch {}
      resolve({ code: -1, out, timedOut: true });
    }, SPAWN_TIMEOUT_MS);
    p.stdout.on('data', (b) => { out += b; });
    p.stderr.on('data', (b) => { out += b; });
    p.on('close', (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ code, out, timedOut: false });
    });
    p.on('error', (e) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ code: -2, out: out + '\n' + e.message, timedOut: false });
    });
  });
}

// ── Telegram（G1：纯文本、必须抛错）──────────────────────────────────
async function sendTelegram(text) {
  if (!fs.existsSync(TELEGRAM_CONFIG)) throw new Error(`找不到 ${TELEGRAM_CONFIG}`);
  // telegram-config.json 带 UTF-8 BOM，JSON.parse 会直接抛
  // "Unexpected token '﻿'" —— 2026-09-02 实测踩过（Meta 上报成功了但通知发不出去）。
  // 凡是读这个文件的地方都要剥 BOM。
  const { botToken, chatId } = JSON.parse(fs.readFileSync(TELEGRAM_CONFIG, 'utf-8').replace(/^﻿/, ''));
  const body = text.length > TG_MAX ? `${text.slice(0, TG_MAX)}\n…（已截断）` : text;
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // 不传 parse_mode —— 地址/备注里的 & < > 会让 HTML 模式整条 400
    body: JSON.stringify({ chat_id: chatId, text: body, disable_web_page_preview: true }),
  });
  if (!res.ok) throw new Error(`Telegram 发送失败 ${res.status}: ${await res.text()}`);
}

// ── 主流程 ────────────────────────────────────────────────────────────
const t0 = Date.now();
const baseline = fs.existsSync(BASELINE_PATH) ? JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8')) : {};
const cal = loadCalendar();
const today = ymd(new Date());
const targetDay = DATE_OVERRIDE || nextOpenDayAfter(today, cal);

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();
const ctx = makeCtx(db, today, targetDay, cal, baseline);

const selected = REGISTRY.filter((c) => !ONLY.length || ONLY.includes(c.id));
const results = [];

for (const check of selected) {
  let r;
  try {
    if (check.kind === 'inline') {
      r = await check.run(ctx);
    } else {
      const { code, out, timedOut } = await runSpawn(check);
      r = timedOut ? probeFail(`spawn 超过 ${SPAWN_TIMEOUT_MS / 1000}s 被掐掉`) : check.parse(code, out, baseline);
    }
  } catch (e) {
    r = probeFail(`检查抛错：${e.message}`);
  }
  // G3：扫到 0 条一律算探针失效，绝不当通过
  if (r.status === 'pass' && r.scanned === 0) r = probeFail('scanned=0');
  results.push({ ...check, ...r });
}

await admin.app().delete();

const fired = results.filter((r) => r.status === 'fire');
const broken = results.filter((r) => r.status === 'probe_fail');
const passed = results.filter((r) => r.status === 'pass');
const p0 = fired.filter((r) => r.severity === 'P0');
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
const totalScanned = results.reduce((n, r) => n + (r.scanned || 0), 0);

let msg;
if (!fired.length && !broken.length) {
  msg = `✅ ${today} 巡检通过 · ${results.length} 项 · 扫 ${totalScanned.toLocaleString()} doc · ${elapsed}s（目标日 ${targetDay}）`;
} else {
  const head = `${p0.length ? '🔴' : '🟠'} ${today} 巡检 ${p0.length} 红 ${fired.length - p0.length} 黄${broken.length ? ` ${broken.length} 探针失效` : ''} · ${results.length} 项（目标日 ${targetDay}）`;
  const blocks = [];
  for (const r of [...fired].sort((a, b) => (a.severity === 'P0' ? -1 : 1) - (b.severity === 'P0' ? -1 : 1))) {
    blocks.push(`${r.severity === 'P0' ? '🔴' : '🟠'} ${r.name}\n` + r.lines.slice(0, 6).map((l) => `   ${l}`).join('\n') + (r.lines.length > 6 ? `\n   …另 ${r.lines.length - 6} 条` : '') + (r.action ? `\n   → ${r.action}` : ''));
  }
  for (const r of broken) blocks.push(`⚠️ 探针失效：${r.name}\n   ${r.lines[0]}\n   → ${r.action}`);
  msg = [head, '', ...blocks, '', `其余 ${passed.length} 项通过 · ${elapsed}s`].join('\n');
}

console.log(msg);
console.log('\n──────── 明细 ────────');
for (const r of results) {
  const tag = r.status === 'pass' ? '✅' : r.status === 'fire' ? (r.severity === 'P0' ? '🔴' : '🟠') : '⚠️';
  console.log(`${tag} ${r.id} ${r.name} · scanned=${r.scanned} candidates=${r.candidates} fired=${r.fired}${r.note ? ` · ${r.note}` : ''}`);
}

if (!DRY) {
  await sendTelegram(msg);
  console.log('\n✓ 已推 Telegram');
} else {
  console.log('\n（--dry：未发送）');
}

// 退出码必须能区分「跑完了但有异常」和「根本没跑起来」——两者都用 1 的话
// PS 层会把 node 崩溃当成「巡检正常发现了问题」，警报永远不会响。
//   0  = 全通过，报告已发（或 --dry）
//   10 = 有 P0 / 探针失效，报告已发
//   其它（含 node 自己崩掉的 1）= 没跑成功，报告没发出去 → PS 层顶上
process.exitCode = (p0.length || broken.length) ? 10 : 0;
