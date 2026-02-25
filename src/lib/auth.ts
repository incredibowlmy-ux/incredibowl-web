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
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, increment } from "firebase/firestore";
import { auth, db } from "./firebase";

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
        await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: displayName || user.displayName || "Guest",
            photoURL: user.photoURL || null,
            phone: phone || null,
            address: address || null,
            referralCode: ownReferralCode,
            referredBy: referralCode || null,
            referralBonusAwarded: false,
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            totalOrders: 0,
            totalSpent: 0,
            points: 0,
        });
    } else {
        await setDoc(userRef, {
            lastLoginAt: serverTimestamp(),
        }, { merge: true });
    }
};

// Update user profile (phone, address, etc.)
export const updateUserProfile = async (uid: string, data: { phone?: string; address?: string; displayName?: string }) => {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
        ...data,
        updatedAt: serverTimestamp(),
    });
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
