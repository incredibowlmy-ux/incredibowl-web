import {
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
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

// Sign in with Google. referralCode is only honoured on first-time signup
// (saveUserProfile only validates when the user doc doesn't exist yet).
// The voucher itself is minted later by /api/claim-referral-voucher,
// triggered after the user fills phone + verifies address.
export const signInWithGoogle = async (referralCode?: string) => {
    console.log('[signInWithGoogle] start', { referralCode });
    const result = await signInWithPopup(auth, googleProvider);
    console.log('[signInWithGoogle] popup ok', { uid: result.user.uid, email: result.user.email });
    const profileResult = await saveUserProfile(result.user, undefined, undefined, undefined, referralCode);
    console.log('[signInWithGoogle] saveUserProfile returned', profileResult);
    return {
        user: result.user,
        referralDeferred: profileResult?.referralDeferred,
        referralRejectedReason: profileResult?.referralRejectedReason,
    };
};

// Sign in with Facebook (same referral semantics as Google).
export const signInWithFacebook = async (referralCode?: string) => {
    const result = await signInWithPopup(auth, facebookProvider);
    const profileResult = await saveUserProfile(result.user, undefined, undefined, undefined, referralCode);
    return {
        user: result.user,
        referralDeferred: profileResult?.referralDeferred,
        referralRejectedReason: profileResult?.referralRejectedReason,
    };
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
    referralCode?: string
) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName });
    const profileResult = await saveUserProfile(result.user, displayName, phone, address, referralCode);
    return {
        user: result.user,
        referralDeferred: profileResult?.referralDeferred,
        referralRejectedReason: profileResult?.referralRejectedReason,
    };
};

// Sign out
export const logout = async () => {
    await signOut(auth);
};

// Save user profile to Firestore. The voucher itself is no longer minted
// here — minting moved to /api/claim-referral-voucher and only fires after
// the user has filled phone + verified address (anti-abuse). This function
// just persists the relationship (referredBy) and surfaces a "deferred"
// hint to the caller so the UI can tell the user how to claim.
export const saveUserProfile = async (user: User, displayName?: string, phone?: string, address?: string, referralCode?: string): Promise<{ referralDeferred?: boolean; referralRejectedReason?: string } | undefined> => {
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
        let referralDeferred = false;
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
                        referralDeferred = true;
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

        return { referralDeferred, referralRejectedReason };
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
    // setDoc + merge (upsert) instead of updateDoc: updateDoc throws
    // "No document to update" when the users/{uid} doc is missing. An upsert
    // creates it on the spot and is a plain field-merge when it already exists,
    // so saving a profile can never hard-fail on a missing doc.
    await setDoc(userRef, payload, { merge: true });
};

// Try to claim a pending referral voucher. Server checks profile is
// complete (phone + verified address) and runs the anti-abuse suite
// (phone uniqueness, address uniqueness). Returns the minted voucher,
// already-claimed status, or a friendly rejection reason.
export const claimReferralVoucher = async (
    user: User,
): Promise<{ voucherCode?: string; alreadyClaimed?: boolean; rejectedReason?: string } | null> => {
    try {
        const token = await user.getIdToken();
        const res = await fetch('/api/claim-referral-voucher', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) return null;
        if (data.alreadyClaimed) return { alreadyClaimed: true };
        if (data.valid && data.voucherCode) return { voucherCode: data.voucherCode };
        if (data.reason) {
            const reasonMap: Record<string, string> = {
                no_referral: '未发现推荐码记录',
                phone_missing: '请先填写手机号',
                address_unverified: '请先确认配送地址',
                referrer_not_found: '推荐人不存在',
                self_referral: '不能领取自己推荐的奖励',
                referrer_no_orders: '推荐人需先完成至少 1 笔订单',
                phone_match: '手机号与推荐人相同',
                phone_already_claimed: '此手机号已被其他账户领取过推荐奖励',
                address_already_claimed: '此地址已被其他账户领取过推荐奖励',
            };
            return {
                rejectedReason: (data.message as string) || reasonMap[data.reason as string] || '推荐奖励无法发放',
            };
        }
        return null;
    } catch (e) {
        console.warn('claimReferralVoucher failed:', e);
        return null;
    }
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
