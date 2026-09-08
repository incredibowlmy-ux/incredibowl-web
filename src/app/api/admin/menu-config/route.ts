import { NextRequest } from 'next/server';
import { verifyAdminEmail, adminJson, corsPreflight } from '@/lib/adminApi';
import {
    buildMenu, DISH_CATALOG_ALL, type MenuWeek,
} from '@/data/weeklyMenu';
import { isDishOrderableOn } from '@/lib/cartDateUtils';
import { mondayOf, weekDocFor } from '@/lib/menuResolve';
import type { MenuWeekDoc, ClosureDoc } from '@/lib/menuRuntimeStore';

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
        buildMenu(week, { strict: true, overrides });
        return null;
    } catch (e) {
        return e instanceof Error ? e.message.replace(/^\[weeklyMenu\]\s*/, '') : '排期不合法';
    }
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

        const respondState = async (extra: Record<string, unknown> = {}) => {
            invalidateMenuRuntime();
            const fresh = await loadMenuRuntime({ force: true });
            return adminJson({ ok: true, runtime: fresh, ...extra });
        };

        switch (action) {
            case 'get': {
                const catalog = DISH_CATALOG_ALL.map(d => {
                    const o = data.catalog[String(d.id)] ?? {};
                    return {
                        id: d.id, name: d.name, nameEn: d.nameEn, image: d.image,
                        basePrice: d.price, price: o.price ?? d.price,
                        hidden: o.hidden ?? !!d.hidden, baseHidden: !!d.hidden,
                        voucherTopUp: d.voucherTopUp ?? 0,
                        availableWeekdays: d.availableWeekdays ?? null,
                    };
                });
                return adminJson({ ok: true, runtime: data, catalog });
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
                await db.collection(MENU_COLLECTIONS.weeks).doc(monday).set({
                    days: Object.fromEntries(Object.entries(week.days).map(([k, v]) => [String(k), v])),
                    daily: week.daily, paused: week.paused,
                    updatedAt: FieldValue.serverTimestamp(), updatedBy: email,
                });
                return respondState({ monday, conflicts });
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
                await db.collection(MENU_COLLECTIONS.weeks).doc(monday).set({
                    days: Object.fromEntries(Object.entries(week.days).map(([k, v]) => [String(k), v])),
                    daily: week.daily, paused: week.paused,
                    updatedAt: FieldValue.serverTimestamp(), updatedBy: email,
                });
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
