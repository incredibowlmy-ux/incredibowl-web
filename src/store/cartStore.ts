import { create } from 'zustand';

export interface CartItem {
    id: string | number;
    name: string;
    nameEn?: string;
    price: number;
    quantity: number;
    image: string;
    options?: any;
    selectedDate?: string;
    selectedTime?: string;
}

interface CartStore {
    items: CartItem[];
    isOpen: boolean;
    addItem: (item: Omit<CartItem, 'quantity'>, options?: any) => void;
    removeItem: (id: string | number) => void;
    updateQuantity: (id: string | number, delta: number) => void;
    toggleCart: () => void;
    clearCart: () => void;
    getCartTotal: () => number;
    getCartCount: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
    items: [],
    isOpen: false,
    addItem: (item, options) => {
        set((state) => {
            const cartItemId = options?.cartItemId || item.id;
            const existing = state.items.find((i: any) => i.id === cartItemId);

            if (existing) {
                return {
                    items: state.items.map((i: any) =>
                        i.id === cartItemId ? { ...i, quantity: i.quantity + 1 } : i
                    ),
                    isOpen: true
                };
            }
            return { items: [...state.items, { ...item, id: cartItemId, quantity: 1, ...options }], isOpen: true };
        });
    },
    removeItem: (id) => set((state) => ({ items: state.items.filter(i => i.id !== id) })),
    updateQuantity: (id, delta) => set((state) => ({
        items: state.items.map(item => {
            if (item.id === id) {
                const newQty = item.quantity + delta;
                return newQty > 0 ? { ...item, quantity: newQty } : item;
            }
            return item;
        }).filter(item => item.quantity > 0)
    })),
    toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),
    clearCart: () => set({ items: [] }),
    getCartTotal: () => get().items.reduce((total, item) => total + item.price * item.quantity, 0),
    getCartCount: () => get().items.reduce((count, item) => count + item.quantity, 0),
}));
