import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from "firebase/firestore";
import { db } from "./firebase";

export interface OrderItem {
    name: string;
    nameEn?: string;
    price: number;
    quantity: number;
    image?: string;
}

export interface OrderData {
    userId: string;
    userName: string;
    userEmail: string;
    userPhone: string;
    userAddress: string;
    items: OrderItem[];
    total: number;
    deliveryDate: string;
    deliveryTime: string;
    paymentMethod: 'qr' | 'fpx';
    receiptUploaded: boolean;
    status: 'pending' | 'confirmed' | 'preparing' | 'delivered' | 'cancelled';
    note?: string;
}

// Submit a new order to Firestore
export const submitOrder = async (orderData: OrderData): Promise<string> => {
    const ordersRef = collection(db, "orders");

    const docRef = await addDoc(ordersRef, {
        ...orderData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    // Update user stats
    const userRef = doc(db, "users", orderData.userId);
    await updateDoc(userRef, {
        totalOrders: increment(1),
        totalSpent: increment(orderData.total),
        points: increment(Math.floor(orderData.total)), // RM 1 = 1 point
        lastOrderAt: serverTimestamp(),
    });

    return docRef.id;
};
