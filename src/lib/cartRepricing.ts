/**
 * 购物车快照重定价 —— 菜单调价后，旧购物车不再带着旧价去结账。
 *
 * 事故（2026-07-27）：2f50b8c 把柠香三文鱼饭 23.90 → 24.90，一位餐券客户
 * 几天前就把这道菜加进了购物车。CartBundle 存 localStorage，里面的
 * `dish` 是加入那天的快照、`price` 是加入那天算好的数字，两者都停在 23.90。
 * 结账时 /api/submit-order 按现价重算 24.90，价格验证不通过直接拒收 ——
 * 客户看到「价格验证失败」这种开发者语言，付不了款。
 *
 * 服务端不能让步（这道校验同时是防篡改闸门），所以客户端必须自己刷新：
 * 页面加载 rehydrate 时按 dish.id 回 weeklyMenu 现查，把 dish 快照和 price
 * 一起刷成现价。
 *
 * ⚠️ 这里的公式必须与两处逐字一致，否则刷完照样被拒：
 *   · AddOnModal 加入购物车：dish.price × dishQty + Σ(加料单价 × 数量)
 *   · /api/submit-order：getDishPrice(dish.price) × dishQty + Σ(ADD_ON_PRICES × 数量)
 * 取服务端那份（getDishPrice + ADD_ON_PRICES）—— 服务端是唯一权威。
 */

import { ADD_ON_PRICES } from '@/data/addOnsConfig';
import { getDishPrice } from '@/data/promoConfig';
import { weeklyMenu, type MenuItem } from '@/data/weeklyMenu';
import type { CartBundle } from '@/types';

/** 一条被改过价的购物车项（金额 = 该项小计，不是单价）。 */
export interface RepriceChange {
    name: string;
    nameEn?: string;
    from: number;
    to: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * 按当前菜单重算整个购物车。
 *
 * · 菜已从目录整个删掉 → 原样保留，交给 CartDrawer 的清理逻辑报「已下架」，
 *   在这里悄悄改价反而会掩盖问题。
 * · 没有任何变化 → 返回原数组（引用不变），调用方可以据此跳过 setState。
 */
export function repriceCart(
    cart: CartBundle[],
    menu: MenuItem[] = weeklyMenu,
): { cart: CartBundle[]; changes: RepriceChange[] } {
    const byId = new Map(menu.map(d => [d.id, d]));
    const changes: RepriceChange[] = [];
    let dirty = false;

    const next = (cart || []).map(bundle => {
        const live = byId.get(bundle?.dish?.id);
        if (!live) return bundle;

        const addOns = (bundle.addOns || []).map(a => {
            const livePrice = ADD_ON_PRICES[a.item?.id];
            if (livePrice === undefined || livePrice === a.item?.price) return a;
            return { ...a, item: { ...a.item, price: livePrice } };
        });
        const addOnsTotal = addOns.reduce(
            (s, a) => s + (a.item?.price || 0) * (a.quantity || 0), 0,
        );
        const price = round2(getDishPrice(live.price) * (bundle.dishQty || 1) + addOnsTotal);

        // dish 快照整体比对：价格之外，voucherTopUp / topUpAddonId / 文案
        // 也可能变过，而餐券抵扣和预付加料抵扣都直接读这份快照。
        const dishStale = JSON.stringify(live) !== JSON.stringify(bundle.dish);
        const priceStale = Math.abs(price - (bundle.price || 0)) > 0.001;
        if (!dishStale && !priceStale) return bundle;

        dirty = true;
        if (priceStale) {
            changes.push({ name: live.name, nameEn: live.nameEn, from: bundle.price || 0, to: price });
        }
        return { ...bundle, dish: live, addOns, price };
    });

    return { cart: dirty ? next : cart, changes };
}
