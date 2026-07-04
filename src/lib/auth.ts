import {
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInAnonymously,
    linkWithPopup,
    GoogleAuthProvider,
    FacebookAuthProvider,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    User,
    updateProfile
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import { normalizePhone } from "./phoneUtils";

export { normalizePhone };

// Providers
const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();

// Sign in with Google.
export const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    await saveUserProfile(result.user);
    return result.user;
};

// Sign in with Facebook.
export const signInWithFacebook = async () => {
    const result = await signInWithPopup(auth, facebookProvider);
    await saveUserProfile(result.user);
    return result.user;
};

// Sign in with Email/Password
export const loginWithEmail = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    // Ensure a Firestore user doc exists. Social logins already call this;
    // email login historically did not, so accounts that exist in Firebase
    // Auth but were never given a users/{uid} doc would hit "No document to
    // update" the moment they tried to save their profile. saveUserProfile is
    // a no-op (just refreshes lastLoginAt) when the doc already exists.
    try { await saveUserProfile(result.user); } catch (e) { console.warn('[loginWithEmail] ensure profile doc failed', e); }
    return result.user;
};

// Send a password-reset email. Firebase delivers a link that opens its hosted
// reset page (no extra UI needed on our side). Throws on invalid-email; we
// intentionally treat "user-not-found" as success in the caller to avoid
// leaking which emails are registered.
export const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
};

// Register with Email/Password
export const registerWithEmail = async (
    email: string,
    password: string,
    displayName: string,
    phone: string,
    address: string,
) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName });
    await saveUserProfile(result.user, displayName, phone, address);
    return result.user;
};

// 访客快速下单：静默创建 Firebase 匿名账号 —— 用户零弹窗、零注册，但服务端
// 整条 uid 安全链路（submit-order 强制 uid、Firestore 规则、支付状态机）照常
// 生效。⚠️ 需在 Firebase Console → Authentication → Sign-in method 启用
// Anonymous，否则抛 auth/operation-not-allowed（调用方需兜底提示走 Google）。
export const signInAsGuest = async () => {
    const result = await signInAnonymously(auth);
    await saveUserProfile(result.user);
    return result.user;
};

// 把匿名访客「原地升级」成 Google 账号：同一个 uid，订单历史无缝保留，
// 不产生孤儿账号。若该 Google 账号已注册过会抛 auth/credential-already-in-use
// （两个身份没法自动合并），调用方提示联系碗妈人工处理。
export const linkGuestToGoogle = async () => {
    const u = auth.currentUser;
    if (!u || !u.isAnonymous) throw new Error('当前不是访客账号');
    const result = await linkWithPopup(u, googleProvider);
    await setDoc(doc(db, "users", result.user.uid), {
        email: result.user.email,
        displayName: result.user.displayName || 'Guest',
        photoURL: result.user.photoURL || null,
        updatedAt: serverTimestamp(),
    }, { merge: true });
    return result.user;
};

// Sign out
export const logout = async () => {
    await signOut(auth);
};

// Save user profile to Firestore. Creates the users/{uid} doc on first
// sign-in; on subsequent logins just refreshes lastLoginAt (and backfills
// phoneNormalized for legacy docs).
export const saveUserProfile = async (user: User, displayName?: string, phone?: string, address?: string): Promise<void> => {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: displayName || user.displayName || "Guest",
            photoURL: user.photoURL || null,
            phone: phone || null,
            phoneNormalized: normalizePhone(phone),
            address: address || null,
            vouchersUsed: [],
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            totalOrders: 0,
            totalSpent: 0,
            points: 0,
        });
    } else {
        // Backfill phoneNormalized for legacy users on every login.
        const existing = userSnap.data();
        const merge: Record<string, unknown> = { lastLoginAt: serverTimestamp() };
        if (existing.phone && !existing.phoneNormalized) {
            merge.phoneNormalized = normalizePhone(existing.phone);
        }
        await setDoc(userRef, merge, { merge: true });
    }
};

// Update user profile (phone, address, geocoded delivery zone, etc.)
export const updateUserProfile = async (
    uid: string,
    data: {
        phone?: string;
        address?: string;
        displayName?: string;
        addressLat?: number;
        addressLng?: number;
        addressDistanceKm?: number;
        deliveryZone?: 'within2km' | 'outside2km';
        addressFormatted?: string;
        addressVerifiedAt?: unknown;
        addressVerifiedText?: string;  // verbatim text the user typed when geocoding ran
    }
) => {
    const userRef = doc(db, "users", uid);
    const payload: Record<string, unknown> = {
        ...data,
        updatedAt: serverTimestamp(),
    };
    if (typeof data.phone === 'string') {
        payload.phoneNormalized = normalizePhone(data.phone);
    }
    // setDoc + merge (upsert) instead of updateDoc: updateDoc throws
    // "No document to update" when the users/{uid} doc is missing. An upsert
    // creates it on the spot and is a plain field-merge when it already exists,
    // so saving a profile can never hard-fail on a missing doc.
    await setDoc(userRef, payload, { merge: true });
};

// Get user profile from Firestore
export const getUserProfile = async (uid: string) => {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    return userSnap.exists() ? userSnap.data() : null;
};

// Listen to auth state changes
export const onAuthChange = (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, callback);
};
