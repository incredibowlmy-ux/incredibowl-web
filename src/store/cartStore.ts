import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartBundle } from '@/types';
import { repriceCart, type RepriceChange } from '@/lib/cartRepricing';
import { subscribeRuntime } from '@/lib/menuRuntimeStore';

interface CartStore {
    cart: CartBundle[];
    /** 本次 rehydrate 时被菜单调价刷新过的项目（CartDrawer 提示一次后清空）。 */
    repriced: RepriceChange[];
    addBundle: (bundle: CartBundle) => void;
    updateBundle: (cartItemId: string, updates: Partial<CartBundle>) => void;
    updateQuantity: (cartItemId: string, delta: number) => void;
    removeFromCart: (cartItemId: string) => void;
    clearCart: () => void;
    clearRepriced: () => void;
}

export const useCartStore = create<CartStore>()(
    persist(
        (set) => ({
            cart: [],
            repriced: [],

            addBundle: (bundle) =>
                set(state => ({ cart: [...state.cart, bundle] })),

            updateBundle: (cartItemId, updates) =>
                set(state => ({
                    cart: state.cart.map(item =>
                        item.cartItemId === cartItemId ? { ...item, ...updates } : item
                    ),
                })),

            updateQuantity: (cartItemId, delta) =>
                set(state => ({
                    cart: state.cart
                        .map(item => {
                            if (item.cartItemId !== cartItemId) return item;
                            const newQty = item.quantity + delta;
                            return newQty > 0 ? { ...item, quantity: newQty } : item;
                        })
                        .filter(item => item.quantity > 0),
                })),

            removeFromCart: (cartItemId) =>
                set(state => ({
                    cart: state.cart.filter(item => item.cartItemId !== cartItemId),
                })),

            clearCart: () => set({ cart: [] }),

            clearRepriced: () => set({ repriced: [] }),
        }),
        {
            name: 'incredibowl-cart', // localStorage key
            // 只落地 cart —— repriced 是「这次加载发现的调价」，不该跨会话复活。
            partialize: (state) => ({ cart: state.cart }) as any,
            // ⚠️ 唯一的重定价入口。购物车快照存的是加入那天的 dish 和 price，
            // 菜单一调价旧购物车就会被 /api/submit-order 的价格校验拒收
            // （2026-07-27 三文鱼 23.90 → 24.90 事故）。这里在 rehydrate 的
            // 那一刻按现价刷新，NavBar 总额、餐券抵扣、结账提交的价格一次全对齐。
            merge: (persisted, current) => {
                const state = { ...current, ...(persisted as Partial<CartStore>) };
                const { cart, changes } = repriceCart(state.cart || []);
                return { ...state, cart, repriced: changes };
            },
        }
    )
);

// 运行时菜单（Firestore 排期 / 价格覆盖）比 localStorage rehydrate 晚到 ——
// 到位那一刻再按它刷一次购物车，否则旧价会一路带到 /api/submit-order 被拒。
subscribeRuntime(() => {
    const s = useCartStore.getState();
    const { cart, changes } = repriceCart(s.cart || []);
    if (cart !== s.cart) useCartStore.setState({ cart, repriced: [...(s.repriced || []), ...changes] });
});
