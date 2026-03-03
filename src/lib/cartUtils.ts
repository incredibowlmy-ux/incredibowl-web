import { CartBundle } from '@/types';

export function calcCartTotal(cart: CartBundle[]): number {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function calcCartCount(cart: CartBundle[]): number {
    return cart.length;
}

export function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidMyPhone(phone: string): boolean {
    return /^(\+?6?01)[0-9]{8,9}$/.test(phone.replace(/[\s\-()]/g, ''));
}
