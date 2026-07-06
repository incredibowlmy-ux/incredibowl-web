import { randomBytes } from 'crypto';

// Public tracking-page credential attached to each order doc.
// Separate from the Firestore doc id: the doc id is used as an auth subject
// by payment/confirm APIs and must never appear in a shareable WA link.
// Leaking a trackToken only exposes order status + live driver position.
const TOKEN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const TOKEN_LENGTH = 16;

export function generateTrackToken(): string {
    const bytes = randomBytes(TOKEN_LENGTH);
    let token = '';
    for (let i = 0; i < TOKEN_LENGTH; i++) {
        token += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
    }
    return token;
}

// Status → timeline step index for the customer tracking page.
// cancelled is handled separately (no timeline).
export const TRACK_STEPS = ['confirmed', 'preparing', 'delivering', 'delivered'] as const;

export function trackStepIndex(status: string): number {
    // pending shows as step 0 not-yet-reached (awaiting confirmation)
    const idx = (TRACK_STEPS as readonly string[]).indexOf(status);
    return idx;
}
