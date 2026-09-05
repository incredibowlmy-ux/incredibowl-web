"use client";

/**
 * 可搜索的菜品选择器 — 模仿 dashboard 手动录单的菜品下拉：
 * 搜索框 + 按天分组 + 显示价格。
 * /admin/multi-day 与 /admin/subscriptions 的模板编辑器共用。
 *
 * 传入 `weekday`（1–5）时按「那天供应的菜」置顶成第一组并高亮 —— 排周五的
 * 单不用再滚到列表最底下找周五特餐（老板 2026-08-09 提的）。其余分组照
 * 原顺序跟在下面，特殊安排仍可选别天的菜。
 *
 * 暂别（retired）菜也列出来带标注 —— 手动单允许下，服务端会给警告。
 *
 * 数据直接读 weeklyMenu（排期唯一来源），换菜改 weeklyMenu.ts 上线后
 * 这里自动跟上，不需要另外同步一份表。
 */

import React, { useMemo, useState } from 'react';
import { weeklyMenu } from '@/data/weeklyMenu';
import { servesOnWeekday } from '@/lib/cartDateUtils';

const WD_CN: Record<number, string> = { 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五' };

const DISH_GROUP_ORDER: { day: string; label: string }[] = [
    { day: 'Daily / 常驻', label: '常驻 · 每日供应' },
    { day: 'Mon / 周一', label: '周一' },
    { day: 'Tue / 周二', label: '周二' },
    { day: 'Wed / 周三', label: '周三' },
    { day: 'Thu / 周四', label: '周四' },
    { day: 'Fri / 周五', label: '周五' },
];

interface PickerDish { name: string; price: number; retired: boolean; note?: string }
interface PickerGroup { label: string; highlight?: boolean; dishes: PickerDish[] }

/** 分组：无 weekday = 原来的固定顺序；有 weekday = 当天供应的置顶。 */
function buildGroups(weekday?: number): PickerGroup[] {
    const live = weeklyMenu.filter(d => !d.hidden);

    if (!weekday || !WD_CN[weekday]) {
        return DISH_GROUP_ORDER
            .map(({ day, label }) => ({
                label,
                dishes: live.filter(d => d.day === day)
                    .map(d => ({ name: d.name, price: d.price, retired: !!d.retired })),
            }))
            .filter(g => g.dishes.length > 0);
    }

    // 置顶组 = 这天真能下单的菜（当日特餐 + 全周常驻 + 限这天的常驻菜）。
    // 判定走 servesOnWeekday —— 与 /api/submit-order 的拒收规则同一个函数。
    const todayNames = new Set(
        live.filter(d => !d.retired && servesOnWeekday(d, weekday)).map(d => d.name));

    const top: PickerGroup = {
        label: `${WD_CN[weekday]}供应`,
        highlight: true,
        dishes: live.filter(d => todayNames.has(d.name))
            .map(d => ({ name: d.name, price: d.price, retired: false })),
    };

    // 其余照原顺序列出（含暂别菜、别天的特餐、这天不供应的限日常驻菜），
    // 标注供应日 —— 选到不是当天的菜时一眼看得出来。
    const rest = DISH_GROUP_ORDER
        .map(({ day, label }) => ({
            label,
            dishes: live.filter(d => d.day === day && !todayNames.has(d.name))
                .map(d => ({
                    name: d.name,
                    price: d.price,
                    retired: !!d.retired,
                    note: (!d.retired && d.availableWeekdays?.length)
                        ? `限${d.availableWeekdays.map(w => WD_CN[w] ?? '').join('/')}`
                        : undefined,
                })),
        }))
        .filter(g => g.dishes.length > 0);

    return top.dishes.length > 0 ? [top, ...rest] : rest;
}

/** 那天的主打菜（WEEKLY_SCHEDULE 该天第一道）；没有就退回第一道常驻菜。 */
export function defaultDishForWeekday(weekday?: number): string {
    if (weekday && WD_CN[weekday]) {
        const primary = weeklyMenu.find(
            d => !d.hidden && !d.retired && d.weekday === weekday && d.isPrimary);
        if (primary) return primary.name;
        const anyToday = weeklyMenu.find(
            d => !d.hidden && !d.retired && servesOnWeekday(d, weekday));
        if (anyToday) return anyToday.name;
    }
    return weeklyMenu.find(d => !d.hidden && !d.retired)?.name ?? '';
}

export default function DishPicker({ value, onChange, weekday }: {
    value: string;
    onChange: (name: string) => void;
    /** 1–5：按这天供应的菜置顶。省略 = 固定顺序（旧行为）。 */
    weekday?: number;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const allGroups = useMemo(() => buildGroups(weekday), [weekday]);
    const q = query.trim().toLowerCase();
    const groups = allGroups
        .map(g => ({ ...g, dishes: q ? g.dishes.filter(d => d.name.toLowerCase().includes(q)) : g.dishes }))
        .filter(g => g.dishes.length > 0);
    return (
        <div className="relative flex-1 min-w-[160px]">
            <input
                value={open ? query : value}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => { setOpen(true); setQuery(''); }}
                onBlur={() => setOpen(false)}
                placeholder="搜菜名或选择 (e.g. 鸡 / 蒸花肉)"
                className="w-full px-2 py-1 border rounded-lg text-xs font-bold"
            />
            {open && (
                // onMouseDown preventDefault：别让点选先触发 input blur 把下拉关掉
                <div onMouseDown={e => e.preventDefault()}
                    className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                    {groups.length === 0 && <p className="px-3 py-2 text-xs text-gray-400 font-bold">没匹配到菜</p>}
                    {groups.map(g => (
                        <div key={g.label}>
                            <p className={`px-3 pt-2 pb-1 text-[10px] font-black sticky top-0 ${g.highlight
                                ? 'text-primary bg-primary/10' : 'text-gray-400 bg-[#F5F3EF]'}`}>
                                {g.label}
                            </p>
                            {g.dishes.map(d => (
                                <button key={d.name} type="button"
                                    onClick={() => { onChange(d.name); setOpen(false); }}
                                    className={`w-full text-left px-3 py-2 text-xs font-bold hover:bg-primary/10 ${d.name === value ? 'text-primary' : ''}`}>
                                    {d.name} <span className="text-gray-400">· RM {d.price.toFixed(2)}</span>
                                    {d.retired && <span className="text-amber-500"> · 暂别</span>}
                                    {d.note && <span className="text-gray-400"> · {d.note}</span>}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
