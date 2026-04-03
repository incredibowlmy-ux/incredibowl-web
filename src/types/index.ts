// Re-export existing lib types for convenient single-import access
export type { OrderItem, OrderData, OrderStatus } from '@/lib/orders';
export type { Feedback } from '@/lib/feedbacks';
export type { MenuItem } from '@/data/weeklyMenu';

// Firestore server timestamp shape returned in client reads or Admin SDK
export interface FirestoreTimestamp {
    seconds?: number;
    nanoseconds?: number;
    // Firebase Admin SDK serializes as _seconds/_nanoseconds
    _seconds?: number;
    _nanoseconds?: number;
}

// An order document as returned from Firestore (OrderData + doc id + timestamps)
import type { OrderData } from '@/lib/orders';
export interface AdminOrder extends OrderData {
    id: string;
    createdAt: FirestoreTimestamp | null;
    updatedAt?: FirestoreTimestamp | null;
}

// A user document as stored in Firestore /users/{uid}
export interface AppUser {
    id: string;
    displayName?: string;
    email?: string;
    phone?: string;
    address?: string;
    points: number;
    totalOrders: number;
    totalSpent: number;
    referralCode?: string;
    referredBy?: string;
    referralBonusAwarded?: boolean;
    lastOrderAt?: FirestoreTimestamp;
    createdAt?: FirestoreTimestamp;
}

// A single add-on selection inside a CartBundle
export interface AddOnSelection {
    item: { id: string; name: string; nameEn?: string; price: number };
    quantity: number;
}

// One cart entry (a dish + add-ons bundled together)
import type { MenuItem } from '@/data/weeklyMenu';
export interface CartBundle {
    cartItemId: string;
    dish: MenuItem;
    dishQty: number;
    addOns: AddOnSelection[];
    note?: string;
    selectedDate: string;
    selectedTime: string;
    price: number;
    quantity: number;
}
