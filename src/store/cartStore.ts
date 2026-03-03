import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartBundle } from '@/types';

interface CartStore {
    cart: CartBundle[];
    addBundle: (bundle: CartBundle) => void;
    updateBundle: (cartItemId: string, updates: Partial<CartBundle>) => void;
    updateQuantity: (cartItemId: string, delta: number) => void;
    removeFromCart: (cartItemId: string) => void;
    clearCart: () => void;
}

export const useCartStore = create<CartStore>()(
    persist(
        (set) => ({
            cart: [],

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
        }),
        {
            name: 'incredibowl-cart', // localStorage key
        }
    )
);
