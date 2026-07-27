/**
 * Dogfood：购物车快照重定价（src/lib/cartRepricing.ts）
 *
 * 重演 2026-07-27 事故：客户几天前把柠香三文鱼饭（当时 RM23.90）加进购物车，
 * 07-26 菜单调价到 RM24.90，客户第二天来结账 → /api/submit-order 用现价重算
 * 得 24.90，与客户端提交的 23.90 对不上，直接拒收。
 *
 * 跑法：node --import ./scripts/_register-alias.mjs scripts/dogfood-cart-repricing.mts
 */

import { repriceCart } from '@/lib/cartRepricing';
import { weeklyMenu } from '@/data/weeklyMenu';
import { ADD_ON_PRICES } from '@/data/addOnsConfig';
import { getDishPrice } from '@/data/promoConfig';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = '') {
    if (cond) { pass++; console.log(`  ✅ ${name}`); }
    else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
}

const SALMON_ID = 21;
const live = weeklyMenu.find(d => d.id === SALMON_ID)!;
if (!live) throw new Error('菜单里找不到 id=21（柠香香煎三文鱼饭），测试前提已变');

/** 服务端 /api/submit-order 的算法，逐字镜像过来做对账基准。 */
function serverBundleTotal(b: any): number {
    const dish = weeklyMenu.find(d => d.id === b.dish.id)!;
    const addOns = (b.addOns || []).reduce(
        (s: number, a: any) => s + (ADD_ON_PRICES[a.item.id] ?? 0) * a.quantity, 0);
    return (getDishPrice(dish.price) * (b.dishQty || 1) + addOns) * (b.quantity || 1);
}

// ── ① 事故重演：旧快照 23.90 / voucherTopUp 4 ────────────────────
console.log('\n① 事故重演（三文鱼 23.90 → 24.90）');
const staleSnapshot = { ...live, price: 23.90, voucherTopUp: 4 };
const cart: any[] = [{
    cartItemId: 'a', dish: staleSnapshot, dishQty: 1, addOns: [],
    selectedDate: '2026-07-28', selectedTime: 'Lunch', price: 23.90, quantity: 1,
}];
const r1 = repriceCart(cart);
check('价格刷成现价 24.90', r1.cart[0].price === 24.90, `实际 ${r1.cart[0].price}`);
check('dish 快照整体换成现货（voucherTopUp 4 → 5）', r1.cart[0].dish.voucherTopUp === 5);
check('topUpAddonId 保持', r1.cart[0].dish.topUpAddonId === 'salmon-upgrade');
check('提示里报出差额', r1.changes.length === 1 && r1.changes[0].from === 23.90 && r1.changes[0].to === 24.90);
check('刷完与服务端算法一致', Math.abs(serverBundleTotal(r1.cart[0]) - r1.cart[0].price) < 0.001);

// ── ② 已经是现价 → 不动引用（避免 setState 死循环）────────────────
console.log('\n② 已是现价：原样返回');
const fresh: any[] = [{
    cartItemId: 'b', dish: live, dishQty: 1, addOns: [],
    selectedDate: '2026-07-28', selectedTime: 'Lunch', price: live.price, quantity: 1,
}];
const r2 = repriceCart(fresh);
check('返回同一个数组引用', r2.cart === fresh);
check('无调价提示', r2.changes.length === 0);

// ── ③ 加料调价也要刷 ──────────────────────────────────────────
console.log('\n③ 加料快照价过期');
const addonId = Object.keys(ADD_ON_PRICES)[0];
const livePrice = ADD_ON_PRICES[addonId];
const r3 = repriceCart([{
    cartItemId: 'c', dish: live, dishQty: 1,
    addOns: [{ item: { id: addonId, name: 'x', price: livePrice + 3 }, quantity: 2 }],
    selectedDate: '2026-07-28', selectedTime: 'Lunch',
    price: live.price + (livePrice + 3) * 2, quantity: 1,
} as any]);
check('加料单价刷成现价', r3.cart[0].addOns[0].item.price === livePrice);
check('小计 = 菜价 + 加料现价 × 数量',
    Math.abs(r3.cart[0].price - (live.price + livePrice * 2)) < 0.001, `实际 ${r3.cart[0].price}`);
check('与服务端算法一致', Math.abs(serverBundleTotal(r3.cart[0]) - r3.cart[0].price) < 0.001);

// ── ④ dishQty / quantity 组合 ────────────────────────────────
console.log('\n④ 2 份主餐 × 2 组');
const r4 = repriceCart([{
    cartItemId: 'd', dish: { ...live, price: 23.90 }, dishQty: 2, addOns: [],
    selectedDate: '2026-07-28', selectedTime: 'Lunch', price: 47.80, quantity: 2,
} as any]);
check('bundle.price = 单价 × dishQty（不含 quantity）', r4.cart[0].price === 49.80, `实际 ${r4.cart[0].price}`);
check('与服务端 bundleTotal 一致（服务端再乘 quantity）',
    Math.abs(serverBundleTotal(r4.cart[0]) - r4.cart[0].price * 2) < 0.001);

// ── ⑤ 菜已从目录删掉 → 不碰，交给 CartDrawer 报「已下架」────────
console.log('\n⑤ 菜已下架：原样保留');
const ghost: any[] = [{
    cartItemId: 'e', dish: { id: 999999, name: '幽灵菜', price: 10 }, dishQty: 1, addOns: [],
    selectedDate: '2026-07-28', selectedTime: 'Lunch', price: 10, quantity: 1,
}];
const r5 = repriceCart(ghost);
check('原样返回不改价', r5.cart === ghost && r5.changes.length === 0);

// ── ⑥ 全菜单回归：任何一道菜的旧价快照都能刷对 ────────────────
console.log('\n⑥ 全菜单回归');
let allOk = true;
for (const d of weeklyMenu) {
    const b: any = {
        cartItemId: `x${d.id}`, dish: { ...d, price: d.price - 1 }, dishQty: 1, addOns: [],
        selectedDate: '2026-07-28', selectedTime: 'Lunch', price: d.price - 1, quantity: 1,
    };
    const out = repriceCart([b]);
    if (Math.abs(out.cart[0].price - serverBundleTotal(out.cart[0])) > 0.001) {
        allOk = false;
        console.log(`     ↳ ${d.name} 对不上：${out.cart[0].price} vs ${serverBundleTotal(out.cart[0])}`);
    }
}
check(`${weeklyMenu.length} 道菜刷完全部与服务端一致`, allOk);

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass}/${pass + fail} 通过`);
process.exit(fail === 0 ? 0 : 1);
