import { collection, addDoc, getDocs, query, orderBy, where, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export interface OrderItem {
    name: string;
    nameEn?: string;
    price: number;
    quantity: number;
    image?: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'delivered' | 'cancelled';

export interface OrderData {
    userId: string;
    userName: string;
    userEmail: string;
    userPhone: string;
    userAddress: string;
    items: OrderItem[];
    total: number;          // food after voucher discount (NOT including delivery)
    originalTotal?: number; // food before voucher (subtotal)
    promoCode?: string;
    promoDiscount?: number;
    deliveryFee?: number;          // RM amount applied to this order doc (only on part 1 if multi-part)
    deliveryZone?: 'within2km' | 'outside2km';
    deliveryDistanceKm?: number;
    deliveryDate: string;
    deliveryTime: string;
    paymentMethod: 'qr' | 'fpx' | 'curlec';
    receiptUploaded: boolean;
    receiptUrl?: string;
    razorpayPaymentId?: string;
    razorpayOrderId?: string;
    razorpaySignature?: string;
    status: OrderStatus;
    note?: string;
    isMultiPart?: boolean;
    partIndex?: number;
    totalParts?: number;
    groupId?: string;
}

// Submit a new order (points NO LONGER awarded here)
export const submitOrder = async (orderData: OrderData): Promise<string> => {
    // Sanitize data: Firestore does not allow 'undefined' values
    const sanitizedData = Object.entries(orderData).reduce((acc: any, [key, value]) => {
        if (value !== undefined) {
            acc[key] = value;
        }
        return acc;
    }, {});

    const ordersRef = collection(db, "orders");
    const docRef = await addDoc(ordersRef, {
        ...sanitizedData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    // We only update lastOrderAt here, NO POINTS yet!
    const userRef = doc(db, "users", orderData.userId);
    await updateDoc(userRef, {
        lastOrderAt: serverTimestamp(),
    });

    return docRef.id;
};

// Get all orders (for admin)
export const getAllOrders = async () => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Get orders by date
export const getOrdersByDate = async (date: string) => {
    const q = query(
        collection(db, "orders"),
        where("deliveryDate", "==", date),
        orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Get all users (for admin)
export const getAllUsers = async () => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Get orders for a specific user (for client order history)
// Note: no orderBy to avoid needing a composite index - sort client-side instead
export const getUserOrders = async (userId: string) => {
    const q = query(
        collection(db, "orders"),
        where("userId", "==", userId)
    );
    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Sort by createdAt descending (client-side)
    return orders.sort((a: any, b: any) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
    });
};
