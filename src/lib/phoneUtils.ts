/**
 * Normalize a Malaysian phone number for cross-account dedup.
 * Strips non-digits, then trims a "60" country code and leading "0",
 * so "010-337 0197", "01033701 97", and "+60103370197" all collapse
 * to "103370197". Empty / nullish input → "".
 */
export const normalizePhone = (raw: string | null | undefined): string => {
    if (!raw) return '';
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('60') && digits.length > 9) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = digits.slice(1);
    return digits;
};
