/**
 * 菜单运行时数据的进程内 store（零依赖，客户端 / 服务端共用）。
 *
 * 数据来源只有两种：
 *   · 'snapshot'  —— 还没从 Firestore 读到（build 期、预渲染、fetch 失败）→
 *                    所有 helper 退回 weeklyMenu.ts / blockedDates.ts 的代码常量。
 *   · 'firestore' —— 读到了 → Firestore 是唯一权威，代码常量完全不参与
 *                    （否则老板在 dashboard 取消一个停业日，快照还会把它压回去）。
 *
 * 服务端由 src/lib/menuRuntime.server.ts 每 60s 刷新；客户端由
 * useMenuRuntime() hydration 后 fetch /api/menu 一次。订阅者拿 version 触发重算。
 */
export interface MenuWeekDoc {
    days: Record<number, number[]>;
    daily: number[];
    paused: number[];
    updatedAt?: string;
    updatedBy?: string;
    /**
     * 排定生效：到 `at`（ISO）那一刻自动换成这份排期（老板不用熬夜等低峰）。
     * 解析层 weekDocFor 到点后用它替换 days/daily/paused；文档本体保留旧排期
     * 直到 dashboard 下次保存把它落成正式内容。
     */
    scheduled?: {
        at: string;
        days: Record<number, number[]>;
        daily: number[];
        paused: number[];
        updatedBy?: string;
    };
}
export interface DishOverrideDoc {
    price?: number;
    hidden?: boolean;
}
export interface ClosureDoc {
    /** 整天停业。 */
    closed?: boolean;
    reason?: 'soldout' | 'holiday';
    /** 只关晚市（午餐照送）。与 closed 互斥，closed 优先。 */
    dinnerClosed?: boolean;
    /** 当天停售的单个菜（webapp id）。 */
    blockedDishIds?: number[];
}
export interface MenuRuntimeData {
    source: 'snapshot' | 'firestore';
    /** key = 周一 YYYY-MM-DD */
    weeks: Record<string, MenuWeekDoc>;
    /** key = webapp dish id (string) */
    catalog: Record<string, DishOverrideDoc>;
    /** key = YYYY-MM-DD */
    closures: Record<string, ClosureDoc>;
    loadedAt: number;
}

export const EMPTY_RUNTIME: MenuRuntimeData = {
    source: 'snapshot', weeks: {}, catalog: {}, closures: {}, loadedAt: 0,
};

let data: MenuRuntimeData = EMPTY_RUNTIME;
let version = 0;
const listeners = new Set<() => void>();

export function getRuntimeData(): MenuRuntimeData { return data; }
export function getRuntimeVersion(): number { return version; }
export function setRuntimeData(next: MenuRuntimeData): void {
    data = next;
    version++;
    listeners.forEach(fn => fn());
}
export function subscribeRuntime(fn: () => void): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
}
