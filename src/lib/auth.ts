import {
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    FacebookAuthProvider,
    signOut,
    onAuthStateChanged,
    User,
    updateProfile
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import { normalizePhone } from "./phoneUtils";

export { normalizePhone };

// Providers
const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();

// Sign in with Google
export const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    await saveUserProfile(result.user);
    return result.user;
};

// Sign in with Facebook
export const signInWithFacebook = async () => {
    const result = await signInWithPopup(auth, facebookProvider);
    await saveUserProfile(result.user);
    return result.user;
};

// Sign in with Email/Password
export const loginWithEmail = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
};

// Register with Email/Password
export const registerWithEmail = async (
    email: string,
    password: string,
    displayName: string,
    phone: string,
    address: string,
    referralCode?: string
) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName });
    await saveUserProfile(result.user, displayName, phone, address, referralCode);
    return result.user;
};

// Sign out
export const logout = async () => {
    await signOut(auth);
};

// Save user profile to Firestore
export const saveUserProfile = async (user: User, displayName?: string, phone?: string, address?: string, referralCode?: string) => {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        const ownReferralCode = 'IB-' + user.uid.slice(0, 6).toUpperCase();

        // Validate referral code via server. Endpoint also enforces
        // anti-self-referral (uid + phone match) and only accepts referrals
        // from customers who already have ≥ 1 confirmed order.
        // On success, the server mints a RM 10 first-order voucher for us.
        let validatedReferral: string | null = null;
        if (referralCode) {
            const code = referralCode.trim().toUpperCase();
            if (/^IB-[A-Z0-9]{4,8}$/.test(code)) {
                try {
                    const token = await user.getIdToken();
                    const res = await fetch('/api/validate-referral', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                            code,
                            phoneNormalized: normalizePhone(phone) || undefined,
                        }),
                    });
                    const data = await res.json();
                    if (res.ok && data.valid) validatedReferral = data.code;
                } catch (e) {
                    console.warn('Referral validation failed:', e);
                }
            }
        }

        await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: displayName || user.displayName || "Guest",
            photoURL: user.photoURL || null,
            phone: phone || null,
            phoneNormalized: normalizePhone(phone),
            address: address || null,
            referralCode: ownReferralCode,
            referredBy: validatedReferral,
            referralBonusAwarded: false,
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
        referredBy?: string;
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
    await updateDoc(userRef, payload);
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
