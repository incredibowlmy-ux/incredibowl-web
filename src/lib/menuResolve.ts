/**
 * 运行时菜单解析（纯函数 + 小缓存，客户端 / 服务端共用）。
 *
 * 核心问题：weeklyMenu 的形状是「一周」——每道菜一个 weekday。可是老板可以
 * 提前排下周，而网站上周一的卡片在周二之后显示的是**下周一**的日期。所以：
 *   · menuForDate(ymd)      —— 某个具体日期属于哪一周就用哪一周的排期（下单校验用）。
 *   · menuForWeekdayDates() —— 首页那种「周一~周五各取下一次出现的日期」的合成周。
 * 周文档按周一日期存；某周没文档就沿用最近一个更早的周（老板不改也能一直卖）；
 * Firestore 一份都没有才退回代码快照。
 */
import { buildMenu, MENU_SNAPSHOT_WEEK, weeklyMenu, type MenuItem, type MenuWeek } from '@/data/weeklyMenu';
import { getRuntimeData, getRuntimeVersion, type MenuRuntimeData } from '@/lib/menuRuntimeStore';

export const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;
export const CUTOFF_HOUR_MYT = 6;

export function ymdOfUTC(d: Date): string {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function parseYMD(ymd: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!m) return null;
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** 该日期所在周的周一（周六/日算下一周，因为周末不营业、下一餐已是下周）。 */
export function mondayOf(ymd: string): string {
    const d = parseYMD(ymd);
    if (!d) return ymd;
    const wd = d.getUTCDay();
    const delta = wd === 0 ? 1 : wd === 6 ? 2 : 1 - wd;
    d.setUTCDate(d.getUTCDate() + delta);
    return ymdOfUTC(d);
}

/** 日期所属周的排期文档：精确命中 → 最近更早的一周 → 代码快照。 */
/** 排定生效到点了就用排定的那份（老板不用熬夜等低峰改菜单）。 */
function effectiveWeek(doc: MenuWeek & { scheduled?: { at: string } & MenuWeek }, nowMs: number): MenuWeek {
    const s = doc.scheduled;
    if (s && Date.parse(s.at) <= nowMs) return { days: s.days, daily: s.daily, paused: s.paused };
    return doc;
}

export function weekDocFor(data: MenuRuntimeData, ymd: string, nowMs = Date.now()): { monday: string; week: MenuWeek; inherited: boolean } {
    const monday = mondayOf(ymd);
    if (data.source === 'firestore') {
        const exact = data.weeks[monday];
        if (exact) return { monday, week: effectiveWeek(exact, nowMs), inherited: false };
        const earlier = Object.keys(data.weeks).filter(k => k < monday).sort().pop();
        if (earlier) return { monday, week: effectiveWeek(data.weeks[earlier], nowMs), inherited: true };
    }
    return { monday, week: MENU_SNAPSHOT_WEEK, inherited: true };
}

/** 缓存 key 里带「有没有排定已到点」的指纹，到点那刻自动失效。 */
function scheduleStamp(data: MenuRuntimeData, nowMs: number): string {
    return Object.values(data.weeks).map(w => (w.scheduled ? (Date.parse(w.scheduled.at) <= nowMs ? '1' : '0') : '')).join('');
}

const cache = new Map<string, MenuItem[]>();
function cached(key: string, make: () => MenuItem[]): MenuItem[] {
    const hit = cache.get(key);
    if (hit) return hit;
    if (cache.size > 32) cache.clear();
    const v = make();
    cache.set(key, v);
    return v;
}

/** 某个具体日期的完整菜单（严格单周）。下单校验 / 备餐都用它。 */
export function menuForDate(ymd: string, data: MenuRuntimeData = getRuntimeData()): MenuItem[] {
    if (data.source !== 'firestore') return weeklyMenu;
    const now = Date.now();
    const { monday, week } = weekDocFor(data, ymd, now);
    return cached(`d:${getRuntimeVersion()}:${scheduleStamp(data, now)}:${monday}`, () => buildMenu(week, { overrides: data.catalog }));
}

/**
 * 合成周：weekday → 那天下一次出现的日期，各自取所属周的排期。
 * 同一道菜若在两周里排在不同的 weekday，保留日期更早的那次（形状限制：一道菜一个 weekday）。
 */
export function menuForWeekdayDates(dates: Record<number, string>, data: MenuRuntimeData = getRuntimeData()): MenuItem[] {
    if (data.source !== 'firestore') return weeklyMenu;
    const now = Date.now();
    const key = `w:${getRuntimeVersion()}:${scheduleStamp(data, now)}:${[1, 2, 3, 4, 5].map(wd => dates[wd] ?? '').join(',')}`;
    return cached(key, () => {
        const order = [1, 2, 3, 4, 5]
            .filter(wd => dates[wd])
            .sort((a, b) => dates[a].localeCompare(dates[b]));
        if (order.length === 0) {
            return buildMenu(weekDocFor(data, ymdOfUTC(new Date()), now).week, { overrides: data.catalog });
        }
        const base = weekDocFor(data, dates[order[0]], now).week;
        const seen = new Set<number>();
        const claim = (ids: number[]) => ids.filter(id => (seen.has(id) ? false : (seen.add(id), true)));
        const days: Record<number, number[]> = {};
        const daily = claim(base.daily ?? []);
        for (const wd of order) {
            const wk = weekDocFor(data, dates[wd]).week;
            days[wd] = claim(wk.days?.[wd] ?? []);
        }
        const paused = claim(base.paused ?? []);
        return buildMenu({ days, daily, paused }, { overrides: data.catalog });
    });
}

/**
 * 「现在」这一档各 weekday 下一次出现的日期：06:00 MYT 截单后从明天起算，
 * 跳周末，跳整天停业日。服务端（chatbot 菜单）和客户端 hook 共用。
 */
export function nextOccurrenceDates(nowMs = Date.now(), isClosed: (ymd: string) => boolean = () => false): Record<number, string> {
    const now = new Date(nowMs + MYT_OFFSET_MS);
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    if (now.getUTCHours() >= CUTOFF_HOUR_MYT) start.setUTCDate(start.getUTCDate() + 1);
    const out: Record<number, string> = {};
    const cur = new Date(start);
    for (let i = 0; i < 28 && Object.keys(out).length < 5; i++) {
        const wd = cur.getUTCDay();
        const ymd = ymdOfUTC(cur);
        if (wd >= 1 && wd <= 5 && !out[wd] && !isClosed(ymd)) out[wd] = ymd;
        cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return out;
}

export function currentMenu(
    nowMs = Date.now(),
    isClosed?: (ymd: string) => boolean,
    data: MenuRuntimeData = getRuntimeData(),
): MenuItem[] {
    if (data.source !== 'firestore') return weeklyMenu;
    return menuForWeekdayDates(nextOccurrenceDates(nowMs, isClosed), data);
}
