/**
 * 服务端：从 Firestore 读菜单运行时数据 → 灌进 menuRuntimeStore。
 *
 * 三个集合（全部仅 admin 读写，前端走 API）：
 *   menuWeeks/{周一 YYYY-MM-DD}   { days:{1..5:[id]}, daily:[id], paused:[id] }
 *   menuCatalog/{webappId}        { price?, hidden? }
 *   menuClosures/{YYYY-MM-DD}     { closed?, reason?, dinnerClosed?, blockedDishIds? }
 *
 * 缓存 30s（每个 serverless 实例各自一份），dashboard 写入后调 invalidate 让
 * 本实例立刻重读；其它实例最多晚 30s。一份周文档都没有（还没 seed）→ 视为
 * snapshot，整站继续吃代码常量，deploy 早于 seed 也不会出事。
 */
import type { Firestore } from 'firebase-admin/firestore';
import {
    setRuntimeData, getRuntimeData, EMPTY_RUNTIME,
    type MenuRuntimeData, type MenuWeekDoc, type DishOverrideDoc, type ClosureDoc,
} from '@/lib/menuRuntimeStore';

export const MENU_COLLECTIONS = {
    weeks: 'menuWeeks',
    catalog: 'menuCatalog',
    closures: 'menuClosures',
} as const;

const TTL_MS = 30_000;
let loadedAt = 0;
let inflight: Promise<MenuRuntimeData> | null = null;

const isYmd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const numArr = (v: unknown): number[] =>
    Array.isArray(v) ? v.map(Number).filter(n => Number.isInteger(n) && n > 0) : [];

export function normalizeWeekDoc(raw: Record<string, unknown> | undefined): MenuWeekDoc {
    const daysRaw = (raw?.days ?? {}) as Record<string, unknown>;
    const days: Record<number, number[]> = {};
    for (const wd of [1, 2, 3, 4, 5]) days[wd] = numArr(daysRaw[String(wd)] ?? daysRaw[wd]);
    const doc: MenuWeekDoc = { days, daily: numArr(raw?.daily), paused: numArr(raw?.paused) };
    if (typeof raw?.updatedBy === 'string') doc.updatedBy = raw.updatedBy;
    const sch = raw?.scheduled as Record<string, unknown> | undefined;
    if (sch && typeof sch.at === 'string' && !Number.isNaN(Date.parse(sch.at))) {
        const sDaysRaw = (sch.days ?? {}) as Record<string, unknown>;
        const sDays: Record<number, number[]> = {};
        for (const wd of [1, 2, 3, 4, 5]) sDays[wd] = numArr(sDaysRaw[String(wd)] ?? sDaysRaw[wd]);
        doc.scheduled = { at: sch.at, days: sDays, daily: numArr(sch.daily), paused: numArr(sch.paused) };
        if (typeof sch.updatedBy === 'string') doc.scheduled.updatedBy = sch.updatedBy;
    }
    const ua = raw?.updatedAt as { toDate?: () => Date } | string | undefined;
    if (typeof ua === 'string') doc.updatedAt = ua;
    else if (ua && typeof ua.toDate === 'function') doc.updatedAt = ua.toDate().toISOString();
    return doc;
}

export function normalizeOverride(raw: Record<string, unknown> | undefined): DishOverrideDoc {
    const o: DishOverrideDoc = {};
    if (typeof raw?.price === 'number' && Number.isFinite(raw.price) && raw.price > 0) o.price = raw.price;
    if (typeof raw?.hidden === 'boolean') o.hidden = raw.hidden;
    if (Array.isArray(raw?.recommendedAddOns)) {
        const ids = (raw.recommendedAddOns as unknown[]).filter((x): x is string => typeof x === 'string' && !!x).slice(0, 3);
        if (ids.length) o.recommendedAddOns = ids;
    }
    const since = raw?.recommendedSince as { toDate?: () => Date } | string | undefined;
    if (typeof since === 'string') o.recommendedSince = since;
    else if (since && typeof since.toDate === 'function') o.recommendedSince = since.toDate().toISOString();
    return o;
}

export function normalizeClosure(raw: Record<string, unknown> | undefined): ClosureDoc {
    const c: ClosureDoc = {};
    if (raw?.closed === true) c.closed = true;
    if (raw?.reason === 'holiday' || raw?.reason === 'soldout') c.reason = raw.reason;
    if (raw?.dinnerClosed === true) c.dinnerClosed = true;
    const b = numArr(raw?.blockedDishIds);
    if (b.length) c.blockedDishIds = b;
    return c;
}

export async function readMenuRuntime(db: Firestore): Promise<MenuRuntimeData> {
    const [weeksSnap, catSnap, cloSnap] = await Promise.all([
        db.collection(MENU_COLLECTIONS.weeks).get(),
        db.collection(MENU_COLLECTIONS.catalog).get(),
        db.collection(MENU_COLLECTIONS.closures).get(),
    ]);
    const weeks: Record<string, MenuWeekDoc> = {};
    weeksSnap.forEach(d => { if (isYmd(d.id)) weeks[d.id] = normalizeWeekDoc(d.data()); });
    const catalog: Record<string, DishOverrideDoc> = {};
    catSnap.forEach(d => {
        const o = normalizeOverride(d.data());
        if (Object.keys(o).length) catalog[d.id] = o;
    });
    const closures: Record<string, ClosureDoc> = {};
    cloSnap.forEach(d => {
        if (!isYmd(d.id)) return;
        const c = normalizeClosure(d.data());
        if (Object.keys(c).length) closures[d.id] = c;
    });
    const seeded = Object.keys(weeks).length > 0;
    return { source: seeded ? 'firestore' : 'snapshot', weeks, catalog, closures, loadedAt: Date.now() };
}

/** 读（带 30s 缓存）并灌进 store。失败时保留上一份，绝不让菜单消失。 */
export async function loadMenuRuntime(opts: { force?: boolean } = {}): Promise<MenuRuntimeData> {
    const fresh = Date.now() - loadedAt < TTL_MS;
    if (!opts.force && fresh && getRuntimeData() !== EMPTY_RUNTIME) return getRuntimeData();
    if (inflight) return inflight;
    inflight = (async () => {
        try {
            const { getAdminDb } = await import('@/lib/firebase-admin');
            const data = await readMenuRuntime(getAdminDb());
            setRuntimeData(data);
            loadedAt = Date.now();
            return data;
        } catch (err) {
            console.error('[menuRuntime] load failed, keeping previous data:', err);
            return getRuntimeData();
        } finally {
            inflight = null;
        }
    })();
    return inflight;
}

/** dashboard 写入后调用：本实例下一次读立刻回源。 */
export function invalidateMenuRuntime(): void {
    loadedAt = 0;
}
