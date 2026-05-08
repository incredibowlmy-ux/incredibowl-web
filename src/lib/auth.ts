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

// Sign in with Google. referralCode is only honoured on first-time signup
// (saveUserProfile only validates/mints when the user doc doesn't exist yet).
export const signInWithGoogle = async (referralCode?: string) => {
    console.log('[signInWithGoogle] start', { referralCode });
    const result = await signInWithPopup(auth, googleProvider);
    console.log('[signInWithGoogle] popup ok', { uid: result.user.uid, email: result.user.email });
    const profileResult = await saveUserProfile(result.user, undefined, undefined, undefined, referralCode);
    console.log('[signInWithGoogle] saveUserProfile returned', profileResult);
    return {
        user: result.user,
        voucherCode: profileResult?.voucherCode,
        referralRejectedReason: profileResult?.referralRejectedReason,
    };
};

// Sign in with Facebook (same referral semantics as Google).
export const signInWithFacebook = async (referralCode?: string) => {
    const result = await signInWithPopup(auth, facebookProvider);
    const profileResult = await saveUserProfile(result.user, undefined, undefined, undefined, referralCode);
    return {
        user: result.user,
        voucherCode: profileResult?.voucherCode,
        referralRejectedReason: profileResult?.referralRejectedReason,
    };
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
    const profileResult = await saveUserProfile(result.user, displayName, phone, address, referralCode);
    return {
        user: result.user,
        voucherCode: profileResult?.voucherCode,
        referralRejectedReason: profileResult?.referralRejectedReason,
    };
};

// Sign out
export const logout = async () => {
    await signOut(auth);
};

// Save user profile to Firestore. Returns the RM 10 voucher code minted
// by the server when a valid referral was supplied, so the caller can
// surface it to the user. If a referral was attempted but rejected,
// returns referralRejectedReason so the caller can warn the user.
export const saveUserProfile = async (user: User, displayName?: string, phone?: string, address?: string, referralCode?: string): Promise<{ voucherCode?: string; referralRejectedReason?: string } | undefined> => {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    console.log('[saveUserProfile] entry', { uid: user.uid, hasReferral: !!referralCode, referralCodeRaw: referralCode });
    if (!userSnap.exists()) {
        console.log('[saveUserProfile] new user → will validate referral if provided');
        const ownReferralCode = 'IB-' + user.uid.slice(0, 6).toUpperCase();

        // Validate referral code via server. Endpoint also enforces
        // anti-self-referral (uid + phone match) and only accepts referrals
        // from customers who already have ≥ 1 confirmed order.
        // On success, the server mints a RM 10 first-order voucher for us.
        let validatedReferral: string | null = null;
        let mintedVoucherCode: string | undefined;
        let referralRejectedReason: string | undefined;
        if (referralCode) {
            const code = referralCode.trim().toUpperCase();
            console.log('[saveUserProfile] validating code', code);
            if (!/^IB-[A-Z0-9]{4,8}$/.test(code)) {
                console.warn('[saveUserProfile] code format invalid');
                referralRejectedReason = '推荐码格式不正确';
            } else {
                try {
                    const token = await user.getIdToken();
                    console.log('[saveUserProfile] POST /api/validate-referral …');
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
                    console.log('[saveUserProfile] validate-referral response', { status: res.status, data });
                    if (res.ok && data.valid) {
                        validatedReferral = data.code;
                        mintedVoucherCode = data.voucherCode;
                    } else {
                        const reasonMap: Record<string, string> = {
                            not_found: '推荐码不存在',
                            self_referral: '不能使用自己的推荐码',
                            referrer_no_orders: '推荐人需先完成至少 1 笔订单',
                            phone_match: '推荐码无效（手机号与推荐人相同）',
                            format: '推荐码格式不正确',
                        };
                        referralRejectedReason = (data.message as string) || reasonMap[data.reason as string] || '推荐码无效';
                    }
                } catch (e) {
                    console.error('[saveUserProfile] referral validation threw', e);
                    referralRejectedReason = '推荐码验证失败，请稍后到「会员中心」联系客服';
                }
            }
        } else {
            console.log('[saveUserProfile] no referral provided, skipping');
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

        return { voucherCode: mintedVoucherCode, referralRejectedReason };
    } else {
        // Backfill phoneNormalized for legacy users on every login.
        const existing = userSnap.data();
        const merge: Record<string, unknown> = { lastLoginAt: serverTimestamp() };
        if (existing.phone && !existing.phoneNormalized) {
            merge.phoneNormalized = normalizePhone(existing.phone);
        }
        await setDoc(userRef, merge, { merge: true });

        // Backfill referralCode via server (Rules block client writes to it).
        // Users who predate the referral system have no referralCode field,
        // which makes them invisible to /api/validate-referral.
        if (!existing.referralCode) {
            try {
                const token = await user.getIdToken();
                console.log('[saveUserProfile] backfilling referralCode for legacy user');
                const res = await fetch('/api/init-referral-code', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                console.log('[saveUserProfile] init-referral-code response', { status: res.status, data });
            } catch (e) {
                console.warn('[saveUserProfile] referralCode backfill failed:', e);
            }
        }
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
