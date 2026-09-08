import { NextRequest } from 'next/server';
import { verifyAdminEmail, adminJson, corsPreflight } from '@/lib/adminApi';
import {
    buildMenu, DISH_CATALOG_ALL, MENU_SNAPSHOT_WEEK, type MenuWeek,
} from '@/data/weeklyMenu';
import { isDishOrderableOn } from '@/lib/cartDateUtils';
import { isDateClosed } from '@/data/blockedDates';
import { mondayOf, weekDocFor, currentMenu } from '@/lib/menuResolve';
import type { MenuWeekDoc, ClosureDoc } from '@/lib/menuRuntimeStore';
import { buildBroadcast } from '@/lib/menuBroadcast';
import { ADD_ON_PRICES } from '@/data/addOnsConfig';
import { getRecipeForDish } from '@/data/dishIngredients';
import { categorizeIngredient, getConversionFor } from '@/data/ingredientCatalog';

/**
 * POST /api/admin/menu-config   (admin Bearer token; CORS '*' for the file:// dashboard)
 *
 * dashboard「菜单排期」页的唯一后端。一个 endpoint 多个 action（沿用 callAdminAPI
 * 的 POST-only 约定）：
 *   { action:'get' }                                   → 运行时数据 + 菜品目录（供渲染）
 *   { action:'saveWeek', monday, week:{days,daily,paused} } → 整周替换
 *   { action:'saveDay',  monday, weekday, ids }          → 只改某一天（周文档不存在则先从继承周物化）
 *   { action:'conflicts', monday, week }                 → 不写库，只算「撤菜撞已有订单」
 *   { action:'setDish',  id, price?, hidden? }           → menuCatalog 覆盖 + 镜像 dashboard menu.price
 *   { action:'setClosure', date, closed?, reason?, dinnerClosed?, blockedDishIds? }
 *   { action:'deleteClosure', date }
 *
 * 校验规则 = buildMenu(strict)：id 必须存在、不能重复、hidden 不能排期。
 * 老板手滑 → 400 带中文原因，库里什么都不动。冲突（已有订单点了被撤的菜）
 * 只警告不拦（老板拍板 2026-09-08），随 saveWeek/saveDay 响应一起回。
 */
export function OPTIONS() {
    return corsPreflight();
}

const WEBAPP_TO_DASH: Record<number, number> = { 1: 14, 2: 13, 4: 2, 13: 4, 14: 1 };
const isYmd = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const numArr = (v: unknown): number[] =>
    Array.isArray(v) ? v.map(Number).filter(n => Number.isInteger(n) && n > 0) : [];

function parseWeek(raw: unknown): MenuWeek {
    const r = (raw ?? {}) as Record<string, unknown>;
    const daysRaw = (r.days ?? {}) as Record<string, unknown>;
    const days: Record<number, number[]> = {};
    for (const wd of [1, 2, 3, 4, 5]) days[wd] = numArr(daysRaw[String(wd)] ?? daysRaw[wd]);
    return { days, daily: numArr(r.daily), paused: numArr(r.paused) };
}

/** 用 strict buildMenu 校验；返回错误文案或 null。 */
function validateWeek(week: MenuWeek, overrides: Record<string, { price?: number; hidden?: boolean }>): string | null {
    try {
        // allowUnscheduled：老板从所有列拿掉一道菜 = 下架（网站消失、dashboard 仍可见），不是忘排期。
        buildMenu(week, { strict: true, allowUnscheduled: true, overrides });
    } catch (e) {
        return e instanceof Error ? e.message.replace(/^\[weeklyMenu\]\s*/, '') : '排期不合法';
    }
    // hero 校验：每天第一道 = 首页 hero，必须有实拍图（emoji 占位图上 hero = 首页破图）。
    for (const wd of [1, 2, 3, 4, 5]) {
        const heroId = week.days[wd]?.[0];
        if (heroId === undefined) continue;
        const d = DISH_CATALOG_ALL.find(x => x.id === heroId);
        if (d && !d.image.startsWith('/')) {
            return `「${d.name}」还没有实拍图，不能当${['', '周一', '周二', '周三', '周四', '周五'][wd]}主打 —— 把它移到第二位或先补图`;
        }
    }
    return null;
}

const parseScheduleAt = (v: unknown): string | null => {
    if (typeof v !== 'string' || !v.trim()) return null;
    const t = Date.parse(v);
    if (Number.isNaN(t)) return null;
    return new Date(t).toISOString();
};

/** weeklyMenu 的 day label（'Mon / 周一' | 'Daily / 常驻' …）→ dashboard `menu.day`。 */
function dashDay(label: string): string {
    const m = /^(Mon|Tue|Wed|Thu|Fri|Daily)\b/.exec(label);
    return m ? m[1] : '其他';
}

/**
 * 把「现在」合成周的排期镜像进 dashboard 的 `menu` 集合（手动加单下拉按 day 分组、
 * offMenuThisWeek = 本周暂别）。只更新已存在且名字对得上的文档，绝不碰 price /
 * active / costPrice（与 scripts/sync-menu-to-firestore.mts 同规则，这里是自动版）。
 */
async function mirrorDashboardMenu(db: FirebaseFirestore.Firestore, serverTimestamp: () => unknown): Promise<void> {
    const menu = currentMenu(Date.now(), isDateClosed);
    const snap = await db.collection('menu').get();
    const existing = new Map(snap.docs.map(d => [d.id, d.data() as { name?: string; day?: string; offMenuThisWeek?: boolean }]));
    const batch = db.batch();
    let n = 0;
    for (const d of menu) {
        if (d.day.startsWith('Unscheduled')) continue;
        const dashId = String(WEBAPP_TO_DASH[d.id] ?? d.id);
        const cur = existing.get(dashId);
        if (!cur || (cur.name && cur.name !== d.name)) continue;
        const day = dashDay(d.day);
        const off = !!d.retired;
        if (cur.day === day && !!cur.offMenuThisWeek === off) continue;
        batch.set(db.collection('menu').doc(dashId), { day, offMenuThisWeek: off, updatedAt: serverTimestamp() }, { merge: true });
        n++;
    }
    if (n) await batch.commit();
}

interface Conflict { date: string; dish: string; orders: { id: string; userName: string; qty: number }[] }

/** 该周内已有（未取消）订单点了在新排期下不可下单的菜。 */
async function findConflicts(db: FirebaseFirestore.Firestore, monday: string, week: MenuWeek, overrides: Record<string, { price?: number; hidden?: boolean }>): Promise<Conflict[]> {
    const menu = buildMenu(week, { overrides });
    const byName = new Map(menu.map(d => [d.name, d]));
    const dates: string[] = [];
    const [y, m, d] = monday.split('-').map(Number);
    for (let i = 0; i < 5; i++) {
        const dt = new Date(Date.UTC(y, m - 1, d + i));
        dates.push(dt.toISOString().slice(0, 10));
    }
    const snap = await db.collection('orders')
        .where('deliveryDate', '>=', dates[0]).where('deliveryDate', '<=', dates[4]).get();
    const out = new Map<string, Conflict>();
    snap.forEach(doc => {
        const o = doc.data() as { status?: string; deliveryDate?: string; userName?: string; items?: { name?: string; quantity?: number }[] };
        if (o.status === 'cancelled' || !o.deliveryDate) return;
        for (const it of o.items ?? []) {
            const name = String(it?.name ?? '').trim();
            if (!name || name.startsWith('↳')) continue;
            const dish = byName.get(name);
            if (!dish) continue;
            const check = isDishOrderableOn(dish, o.deliveryDate);
            if (check.ok) continue;
            const key = `${o.deliveryDate}|${name}`;
            const c = out.get(key) ?? { date: o.deliveryDate, dish: name, orders: [] };
            c.orders.push({ id: doc.id, userName: o.userName || '客户', qty: Number(it?.quantity) || 1 });
            out.set(key, c);
        }
    });
    return [...out.values()].sort((a, b) => a.date.localeCompare(b.date) || a.dish.localeCompare(b.dish));
}

export async function POST(req: NextRequest) {
    const email = await verifyAdminEmail(req);
    if (!email) return adminJson({ error: '未授权访问' }, 403);

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return adminJson({ error: '请求格式错误' }, 400); }
    const action = String(body.action ?? '');

    try {
        const { getAdminDb } = await import('@/lib/firebase-admin');
        const { FieldValue } = await import('firebase-admin/firestore');
        const { loadMenuRuntime, invalidateMenuRuntime, MENU_COLLECTIONS } = await import('@/lib/menuRuntime.server');
        const db = getAdminDb();
        const data = await loadMenuRuntime({ force: action === 'get' });

        const catalogView = (rt: typeof data) => DISH_CATALOG_ALL.map(d => {
            const o = rt.catalog[String(d.id)] ?? {};
            return {
                id: d.id, dashId: WEBAPP_TO_DASH[d.id] ?? d.id,
                name: d.name, nameEn: d.nameEn, image: d.image,
                basePrice: d.price, price: o.price ?? d.price,
                hidden: o.hidden ?? !!d.hidden, baseHidden: !!d.hidden,
                recommendedAddOns: o.recommendedAddOns ?? [], recommendedSince: o.recommendedSince ?? null,
                voucherTopUp: d.voucherTopUp ?? 0,
                availableWeekdays: d.availableWeekdays ?? null,
            };
        });

        const respondState = async (extra: Record<string, unknown> = {}) => {
            invalidateMenuRuntime();
            const fresh = await loadMenuRuntime({ force: true });
            // dashboard 手动加单下拉靠 menu.day 分组 —— 保存后顺手镜像，失败不影响主流程。
            try { await mirrorDashboardMenu(db, () => FieldValue.serverTimestamp()); }
            catch (e) { console.warn('[admin/menu-config] mirror menu.day failed:', e); }
            return adminJson({ ok: true, runtime: fresh, catalog: catalogView(fresh), ...extra });
        };

        switch (action) {
            case 'get': {
                return adminJson({ ok: true, runtime: data, catalog: catalogView(data), snapshotWeek: MENU_SNAPSHOT_WEEK });
            }

            case 'conflicts':
            case 'saveWeek': {
                if (!isYmd(body.monday)) return adminJson({ error: 'monday 格式应为 YYYY-MM-DD' }, 400);
                const monday = mondayOf(body.monday);
                const week = parseWeek(body.week);
                const err = validateWeek(week, data.catalog);
                if (err) return adminJson({ error: err }, 400);
                const conflicts = await findConflicts(db, monday, week, data.catalog);
                if (action === 'conflicts') return adminJson({ ok: true, monday, conflicts });
                const daysOut = Object.fromEntries(Object.entries(week.days).map(([k, v]) => [String(k), v]));
                const scheduleAt = parseScheduleAt(body.scheduleAt);
                const ref = db.collection(MENU_COLLECTIONS.weeks).doc(monday);
                if (scheduleAt && Date.parse(scheduleAt) > Date.now()) {
                    // 排定生效：现行排期不动，把新排期挂在 scheduled 上，到点解析层自动换。
                    // 文档不存在（沿用周）→ 先把现行内容物化，否则到点前这周会变空。
                    const live = data.weeks[monday] ?? weekDocFor(data, monday).week;
                    await ref.set({
                        days: Object.fromEntries([1, 2, 3, 4, 5].map(wd => [String(wd), live.days?.[wd] ?? []])),
                        daily: live.daily ?? [], paused: live.paused ?? [],
                        scheduled: { at: scheduleAt, days: daysOut, daily: week.daily, paused: week.paused, updatedBy: email },
                        updatedAt: FieldValue.serverTimestamp(), updatedBy: email,
                    }, { merge: true });
                    return respondState({ monday, conflicts, scheduledAt: scheduleAt });
                }
                await ref.set({
                    days: daysOut, daily: week.daily, paused: week.paused,
                    scheduled: FieldValue.delete(),
                    updatedAt: FieldValue.serverTimestamp(), updatedBy: email,
                }, { merge: true });
                return respondState({ monday, conflicts });
            }

            case 'broadcast': {
                // 每周 WhatsApp 广播文案：排期 + 目录（含运行时价格）→ 老板定稿模板。
                if (!isYmd(body.monday)) return adminJson({ error: 'monday 格式应为 YYYY-MM-DD' }, 400);
                const monday = mondayOf(body.monday);
                const week = body.week ? parseWeek(body.week) : weekDocFor(data, monday).week;
                const prevMonday = (() => { const [y, m, d] = monday.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d - 7)).toISOString().slice(0, 10); })();
                const prev = data.source === 'firestore' ? weekDocFor(data, prevMonday).week : null;
                const menu = buildMenu(week, { overrides: data.catalog });
                const text = buildBroadcast({
                    monday, week, prevWeek: prev, menu,
                    customerName: typeof body.customerName === 'string' ? body.customerName : undefined,
                    forceNewIds: numArr(body.newIds),
                });
                return adminJson({ ok: true, monday, text });
            }

            case 'forecast': {
                // 食材够不够：dashboard 给每道菜「每供应日预计份数」（按近几周销量算），
                // 这里乘配方 × 供应天数，对照 ingredientStock 现有量。只提示不阻挡。
                const week = parseWeek(body.week);
                const demand = (body.demand ?? {}) as Record<string, unknown>;
                const fallback = Number(body.fallbackPerDay) > 0 ? Number(body.fallbackPerDay) : 6;
                const menu = buildMenu(week, { overrides: data.catalog });
                const serveDays = new Map<number, number>();
                for (const id of week.daily ?? []) serveDays.set(id, 5);
                for (const wd of [1, 2, 3, 4, 5]) for (const id of week.days[wd] ?? []) serveDays.set(id, (serveDays.get(id) ?? 0) + 1);
                const need = new Map<string, { unit: string; qty: number; from: Map<string, number> }>();
                const noRecipe: string[] = [];
                const perDish: { id: number; name: string; days: number; perDay: number; total: number }[] = [];
                for (const [id, days] of serveDays) {
                    const d = menu.find(x => x.id === id);
                    if (!d || d.hidden) continue;
                    const perDay = Number(demand[String(id)]) > 0 ? Number(demand[String(id)]) : fallback;
                    const total = perDay * days;
                    perDish.push({ id, name: d.name, days, perDay, total });
                    const recipe = getRecipeForDish(d.name);
                    if (!recipe) { noRecipe.push(d.name); continue; }
                    for (const l of recipe.ingredients) {
                        const cur = need.get(l.name) ?? { unit: l.unit, qty: 0, from: new Map() };
                        cur.qty += l.qty * total;
                        cur.from.set(d.name, (cur.from.get(d.name) ?? 0) + l.qty * total);
                        need.set(l.name, cur);
                    }
                }
                const { getAllIngredientStock } = await import('@/lib/ingredientStock');
                const stock = await getAllIngredientStock(db);
                const lines = [...need.entries()].map(([name, n]) => {
                    const s = stock[name];
                    const onHand = s ? s.onHand : null;
                    const shortfall = onHand === null ? null : Math.max(0, n.qty - onHand);
                    const conv = getConversionFor(name);
                    return {
                        name, unit: n.unit, category: categorizeIngredient(name),
                        needed: Math.round(n.qty * 100) / 100, onHand, tracked: !!s,
                        shortfall: shortfall === null ? null : Math.round(shortfall * 100) / 100,
                        convertFrom: conv ? conv.from : null,
                        from: [...n.from.entries()].sort((a, b) => b[1] - a[1]).map(([dish, q]) => ({ dish, qty: Math.round(q * 100) / 100 })),
                    };
                }).sort((a, b) => (b.shortfall ?? -1) - (a.shortfall ?? -1) || a.name.localeCompare(b.name, 'zh'));
                return adminJson({ ok: true, perDish, lines, noRecipe, fallbackPerDay: fallback });
            }

            case 'cancelSchedule': {
                if (!isYmd(body.monday)) return adminJson({ error: 'monday 格式应为 YYYY-MM-DD' }, 400);
                const monday = mondayOf(body.monday);
                await db.collection(MENU_COLLECTIONS.weeks).doc(monday).set(
                    { scheduled: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp(), updatedBy: email }, { merge: true },
                );
                return respondState({ monday });
            }

            case 'saveDay': {
                if (!isYmd(body.monday)) return adminJson({ error: 'monday 格式应为 YYYY-MM-DD' }, 400);
                const monday = mondayOf(body.monday);
                const weekday = Number(body.weekday);
                if (!(weekday >= 1 && weekday <= 5)) return adminJson({ error: 'weekday 必须是 1–5' }, 400);
                const ids = numArr(body.ids);
                // 周文档不存在 → 从继承周（或代码快照）物化一份再改这一天，
                // 否则其它四天会变空。
                const base: MenuWeekDoc | MenuWeek = data.weeks[monday] ?? weekDocFor(data, monday).week;
                const week: MenuWeek = {
                    days: { ...base.days, [weekday]: ids },
                    daily: [...(base.daily ?? [])],
                    paused: (base.paused ?? []).filter(id => !ids.includes(id)),
                };
                // 被排进这天的菜若还在别的天 → 从别的天移走（老板意图是「挪」）。
                for (const wd of [1, 2, 3, 4, 5]) {
                    if (wd === weekday) continue;
                    week.days[wd] = (week.days[wd] ?? []).filter(id => !ids.includes(id));
                }
                week.daily = week.daily.filter(id => !ids.includes(id));
                const err = validateWeek(week, data.catalog);
                if (err) return adminJson({ error: err }, 400);
                const conflicts = await findConflicts(db, monday, week, data.catalog);
                // merge：不碰挂在文档上的 scheduled（排定生效）。
                await db.collection(MENU_COLLECTIONS.weeks).doc(monday).set({
                    days: Object.fromEntries(Object.entries(week.days).map(([k, v]) => [String(k), v])),
                    daily: week.daily, paused: week.paused,
                    updatedAt: FieldValue.serverTimestamp(), updatedBy: email,
                }, { merge: true });
                return respondState({ monday, conflicts });
            }

            case 'setDish': {
                const id = Number(body.id);
                const dish = DISH_CATALOG_ALL.find(d => d.id === id);
                if (!dish) return adminJson({ error: `菜品不存在: ${body.id}` }, 400);
                const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp(), updatedBy: email };
                if (body.price !== undefined) {
                    const price = Number(body.price);
                    if (!Number.isFinite(price) || price <= 0) return adminJson({ error: '价格必须大于 0' }, 400);
                    patch.price = Math.round(price * 100) / 100;
                }
                if (body.hidden !== undefined) patch.hidden = !!body.hidden;
                if (body.recommendedAddOns !== undefined) {
                    // 「常一起点」推荐：只收 addOnsConfig 认得的 id，≤3 个；空数组 = 撤掉推荐。
                    const ids = Array.isArray(body.recommendedAddOns)
                        ? (body.recommendedAddOns as unknown[]).filter((x): x is string => typeof x === 'string' && x in ADD_ON_PRICES).slice(0, 3)
                        : [];
                    const prev = data.catalog[String(id)]?.recommendedAddOns ?? [];
                    patch.recommendedAddOns = ids;
                    if (ids.length === 0) patch.recommendedSince = FieldValue.delete();
                    else if (ids.join() !== prev.join() || !data.catalog[String(id)]?.recommendedSince) patch.recommendedSince = FieldValue.serverTimestamp();
                }
                await db.collection(MENU_COLLECTIONS.catalog).doc(String(id)).set(patch, { merge: true });
                // 镜像到 dashboard 的 menu 集合（手动加单下拉读它；两套 id 历史遗留）。
                if (typeof patch.price === 'number') {
                    const dashId = WEBAPP_TO_DASH[id] ?? id;
                    await db.collection('menu').doc(String(dashId)).set(
                        { price: patch.price, updatedAt: FieldValue.serverTimestamp() }, { merge: true },
                    );
                }
                return respondState({ id });
            }

            case 'setClosure': {
                if (!isYmd(body.date)) return adminJson({ error: 'date 格式应为 YYYY-MM-DD' }, 400);
                const doc: ClosureDoc & { updatedAt: unknown; updatedBy: string } = {
                    updatedAt: FieldValue.serverTimestamp(), updatedBy: email,
                };
                if (body.closed === true) {
                    doc.closed = true;
                    doc.reason = body.reason === 'holiday' ? 'holiday' : 'soldout';
                } else if (body.dinnerClosed === true) {
                    doc.dinnerClosed = true;
                }
                const blocked = numArr(body.blockedDishIds);
                if (blocked.length) doc.blockedDishIds = blocked;
                if (!doc.closed && !doc.dinnerClosed && !doc.blockedDishIds) {
                    await db.collection(MENU_COLLECTIONS.closures).doc(body.date).delete();
                } else {
                    await db.collection(MENU_COLLECTIONS.closures).doc(body.date).set(doc);
                }
                return respondState({ date: body.date });
            }

            case 'deleteClosure': {
                if (!isYmd(body.date)) return adminJson({ error: 'date 格式应为 YYYY-MM-DD' }, 400);
                await db.collection(MENU_COLLECTIONS.closures).doc(body.date).delete();
                return respondState({ date: body.date });
            }

            default:
                return adminJson({ error: `未知 action: ${action}` }, 400);
        }
    } catch (err) {
        console.error('[admin/menu-config] failed:', err);
        return adminJson({ error: err instanceof Error ? err.message : '操作失败' }, 500);
    }
}
