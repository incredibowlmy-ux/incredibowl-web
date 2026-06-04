"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';

// localStorage key for the cached profile. Stored as { uid, data } so a cached
// profile is ONLY ever applied to the user it belongs to — a different (or
// logged-out) user never sees the previous user's address/phone (PII safety on
// shared devices).
const PROFILE_CACHE_KEY = 'incredibowl-profile';

interface AuthContextValue {
    currentUser: FirebaseUser | null;
    userProfile: any | null;
    authLoading: boolean;
    /** Re-fetch the authoritative profile from Firestore (call after the user
     *  edits their address/phone so every consumer reflects it immediately). */
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
    currentUser: null,
    userProfile: null,
    authLoading: true,
    refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

function readCache(): { uid: string; data: any } | null {
    try {
        const raw = localStorage.getItem(PROFILE_CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function writeCache(uid: string, data: any) {
    try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ uid, data })); } catch { /* quota / private mode */ }
}

function clearCache() {
    try { localStorage.removeItem(PROFILE_CACHE_KEY); } catch { /* ignore */ }
}

/**
 * App-wide auth + profile source of truth. Lives in the root layout, so it
 * initializes Firebase Auth ONCE and survives client-side route navigation —
 * the old per-page subscription reset currentUser/userProfile on every page
 * change, which is why the cart lost the address/phone until a refresh.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [userProfile, setUserProfile] = useState<any | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    // Mirror of the latest user for async guards (avoid applying a stale fetch
    // to a user who changed mid-flight).
    const userRef = useRef<FirebaseUser | null>(null);

    const refreshProfile = useCallback(async () => {
        const user = userRef.current;
        if (!user) return;
        try {
            const { getUserProfile } = await import('@/lib/auth');
            const data = await getUserProfile(user.uid);
            if (userRef.current?.uid !== user.uid) return;
            setUserProfile(data);
            if (data) writeCache(user.uid, data);
        } catch (e) {
            console.warn('[AuthProvider] refreshProfile failed', e);
        }
    }, []);

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;
        let cancelled = false;

        const init = () => {
            if (cancelled) return;
            import('@/lib/auth').then(({ onAuthChange, getUserProfile }) => {
                if (cancelled) return;
                unsubscribe = onAuthChange(async (user) => {
                    userRef.current = user;
                    setCurrentUser(user);
                    setAuthLoading(false);

                    if (!user) {
                        // Logout / no session: drop everything (PII safety).
                        setUserProfile(null);
                        clearCache();
                        return;
                    }

                    // Instant paint: if the cache belongs to THIS user, show it
                    // right away so the cart doesn't wait on a Firestore round-trip.
                    const cached = readCache();
                    if (cached && cached.uid === user.uid) {
                        setUserProfile(cached.data);
                    }

                    // Always reconcile with the authoritative Firestore copy.
                    try {
                        const data = await getUserProfile(user.uid);
                        if (userRef.current?.uid !== user.uid) return;
                        setUserProfile(data);
                        if (data) writeCache(user.uid, data);
                    } catch (e) {
                        console.warn('[AuthProvider] profile fetch failed', e);
                    }
                });
            });
        };

        // Defer Firebase Auth init off the critical render path (keeps the
        // first-paint perf win the old code had). The difference: this runs in
        // the root layout, which does not unmount on navigation, so init happens
        // once instead of being repeatedly scheduled-and-cancelled while the
        // user clicks between pages.
        const w = window as typeof window & {
            requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
            cancelIdleCallback?: (handle: number) => void;
        };
        const handle = w.requestIdleCallback
            ? w.requestIdleCallback(init, { timeout: 3000 })
            : window.setTimeout(init, 1500);

        return () => {
            cancelled = true;
            if (w.cancelIdleCallback) w.cancelIdleCallback(handle);
            else clearTimeout(handle);
            unsubscribe?.();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ currentUser, userProfile, authLoading, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
}
