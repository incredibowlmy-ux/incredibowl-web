'use client';
/**
 * 客户端：把运行时菜单接进 React。
 *
 * · useSyncExternalStore 订阅 menuRuntimeStore；服务端 / hydration 快照永远是
 *   build-time 的 weeklyMenu，所以预渲染 HTML 与首次客户端渲染逐字一致，不会
 *   hydration mismatch。fetch 回来后 store 版本 +1 → 订阅组件重渲染。
 * · fetch /api/menu 全页只发一次（模块级去重），失败静默，网站继续吃快照。
 * · 返回的 menu 是「合成周」（各 weekday 下一次出现的日期各取所属周的排期），
 *   与首页 menuDates 的语义一致。具体日期校验请用 menuForDate()。
 */
import { useEffect, useSyncExternalStore } from 'react';
import { weeklyMenu, type MenuItem } from '@/data/weeklyMenu';
import { isDateClosed } from '@/data/blockedDates';
import { subscribeRuntime, setRuntimeData, getRuntimeVersion, type MenuRuntimeData } from '@/lib/menuRuntimeStore';
import { currentMenu } from '@/lib/menuResolve';

let fetchStarted = false;

export function ensureMenuRuntimeLoaded(): void {
    if (fetchStarted || typeof window === 'undefined') return;
    fetchStarted = true;
    fetch('/api/menu')
        .then(r => (r.ok ? r.json() : null))
        .then((d: MenuRuntimeData | null) => {
            if (d && d.source === 'firestore' && d.weeks && d.catalog && d.closures) setRuntimeData(d);
        })
        .catch(() => { /* fail-open: keep snapshot */ });
}

const getServerSnapshot = () => weeklyMenu;
const getClientSnapshot = () => currentMenu(Date.now(), isDateClosed);
const getVersion = () => getRuntimeVersion();

export interface MenuRuntime {
    /** 合成周菜单（形状 = weeklyMenu）。 */
    menu: MenuItem[];
    /** 每次运行时数据更新 +1；放进 useMemo / useEffect deps 让日期派生值跟着重算。 */
    version: number;
}

export function useMenuRuntime(): MenuRuntime {
    const menu = useSyncExternalStore(subscribeRuntime, getClientSnapshot, getServerSnapshot);
    const version = useSyncExternalStore(subscribeRuntime, getVersion, () => 0);
    useEffect(() => { ensureMenuRuntimeLoaded(); }, []);
    return { menu, version };
}
