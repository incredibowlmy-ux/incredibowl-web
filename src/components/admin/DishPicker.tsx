"use client";

/**
 * 可搜索的菜品选择器 — 模仿 dashboard 手动录单的菜品下拉：
 * 搜索框 + 按天分组（常驻·每日供应 / 周一~周五）+ 显示价格。
 * /admin/multi-day 与 /admin/subscriptions 的模板编辑器共用。
 * 暂别（retired）菜也列出来带标注 —— 手动单允许下，服务端会给警告。
 */

import React, { useState } from 'react';
import { weeklyMenu } from '@/data/weeklyMenu';

const DISH_GROUP_ORDER: { day: string; label: string }[] = [
    { day: 'Daily / 常驻', label: '常驻 · 每日供应' },
    { day: 'Mon / 周一', label: '周一' },
    { day: 'Tue / 周二', label: '周二' },
    { day: 'Wed / 周三', label: '周三' },
    { day: 'Thu / 周四', label: '周四' },
    { day: 'Fri / 周五', label: '周五' },
];
const DISH_GROUPS = DISH_GROUP_ORDER
    .map(({ day, label }) => ({
        label,
        dishes: weeklyMenu.filter(d => !d.hidden && d.day === day)
            .map(d => ({ name: d.name, price: d.price, retired: !!d.retired })),
    }))
    .filter(g => g.dishes.length > 0);

export default function DishPicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const q = query.trim().toLowerCase();
    const groups = DISH_GROUPS
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
                            <p className="px-3 pt-2 pb-1 text-[10px] font-black text-gray-400 bg-[#F5F3EF] sticky top-0">{g.label}</p>
                            {g.dishes.map(d => (
                                <button key={d.name} type="button"
                                    onClick={() => { onChange(d.name); setOpen(false); }}
                                    className={`w-full text-left px-3 py-2 text-xs font-bold hover:bg-[#FF6B35]/10 ${d.name === value ? 'text-[#FF6B35]' : ''}`}>
                                    {d.name} <span className="text-gray-400">· RM {d.price.toFixed(2)}</span>
                                    {d.retired && <span className="text-amber-500"> · 暂别</span>}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
