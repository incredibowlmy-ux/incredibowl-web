import { collection, addDoc, getDocs, getDoc, query, orderBy, where, serverTimestamp, doc, updateDoc, increment } from "firebase/firestore";
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
    total: number;
    originalTotal?: number;
    promoCode?: string;
    promoDiscount?: number;
    deliveryDate: string;
    deliveryTime: string;
    paymentMethod: 'qr' | 'fpx';
    receiptUploaded: boolean;
    receiptUrl?: string;
    status: OrderStatus;
    note?: string;
}

// Submit a new order (points NO LONGER awarded here)
export const submitOrder = async (orderData: OrderData): Promise<string> => {
    const ordersRef = collection(db, "orders");
    const docRef = await addDoc(ordersRef, {
        ...orderData,
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

// Update order status and AWARD POINTS if confirmed
export const updateOrderStatus = async (orderId: string, status: OrderStatus, orderData?: any) => {
    const orderRef = doc(db, "orders", orderId);

    // If status is changing to 'confirmed', award points now!
    if (status === 'confirmed' && orderData) {
        const userRef = doc(db, "users", orderData.userId);
        await updateDoc(userRef, {
            totalOrders: increment(1),
            totalSpent: increment(orderData.total),
            points: increment(Math.floor(orderData.total ?? 0)), // RM 1 = 1 point
        });

        // Check referral bonus (only on first confirmed order)
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();
        if (userData?.referredBy && !userData?.referralBonusAwarded) {
            const referralCode = userData.referredBy; // e.g. "IB-A1B2C3"
            // Find the referrer by their referralCode
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("referralCode", "==", referralCode));
            const referrerSnap = await getDocs(q);
            if (!referrerSnap.empty) {
                const referrerDoc = referrerSnap.docs[0];
                // Award 50 points to referrer
                await updateDoc(doc(db, "users", referrerDoc.id), {
                    points: increment(50),
                });
                // Award 50 points to new user
                await updateDoc(userRef, {
                    points: increment(50),
                    referralBonusAwarded: true,
                });
            }
        }
    }

    await updateDoc(orderRef, {
        status,
        updatedAt: serverTimestamp(),
    });
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
