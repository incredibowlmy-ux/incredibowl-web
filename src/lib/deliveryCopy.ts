/**
 * Single source of truth for customer-facing delivery-fee copy.
 *
 * All strings are DERIVED from the numeric constants in deliveryUtils.ts —
 * the same constants that actually charge the fee — so the copy shown in
 * NavBar / Hero / DeliveryWidget / FAQ / Footer can never drift from what
 * the checkout really charges. Change the fee in deliveryUtils.ts and every
 * surface updates together.
 *
 * Blog posts / SEO metadata intentionally keep their own prose (long-form,
 * indexed content) — update those by hand when pricing changes.
 */
import {
    INNER_NEAR_RADIUS_KM,
    NEAR_RADIUS_KM,
    MID_RADIUS_KM,
    DELIVERY_FEE_INNER_NEAR_RM,
    DELIVERY_FEE_OUTER_NEAR_RM,
    DELIVERY_FEE_MID_RM,
    DELIVERY_FEE_FAR_RM,
    FREE_DELIVERY_THRESHOLD_NEAR_RM,
    FREE_DELIVERY_THRESHOLD_OUTER_NEAR_RM,
    FREE_DELIVERY_THRESHOLD_MID_RM,
} from "./deliveryUtils";

export interface DeliveryTierCopy {
    /** e.g. "2.5km 内" */
    rangeZh: string;
    /** e.g. "Within 2.5km" */
    rangeEn: string;
    /** base fee in RM */
    fee: number;
    /**
     * Free-delivery threshold in RM, or null when the tier has none (far —
     * RM 18 flat). Every surface that renders this MUST branch on null rather
     * than printing "满 RM null 免运".
     */
    freeOver: number | null;
}

export const DELIVERY_TIER_COPY: DeliveryTierCopy[] = [
    {
        rangeZh: `${INNER_NEAR_RADIUS_KM}km 内`,
        rangeEn: `Within ${INNER_NEAR_RADIUS_KM}km`,
        fee: DELIVERY_FEE_INNER_NEAR_RM,
        freeOver: FREE_DELIVERY_THRESHOLD_NEAR_RM,
    },
    {
        rangeZh: `${INNER_NEAR_RADIUS_KM}–${NEAR_RADIUS_KM}km`,
        rangeEn: `${INNER_NEAR_RADIUS_KM}–${NEAR_RADIUS_KM}km`,
        fee: DELIVERY_FEE_OUTER_NEAR_RM,
        freeOver: FREE_DELIVERY_THRESHOLD_OUTER_NEAR_RM,
    },
    {
        rangeZh: `${NEAR_RADIUS_KM}–${MID_RADIUS_KM}km`,
        rangeEn: `${NEAR_RADIUS_KM}–${MID_RADIUS_KM}km`,
        fee: DELIVERY_FEE_MID_RM,
        freeOver: FREE_DELIVERY_THRESHOLD_MID_RM,
    },
    {
        rangeZh: `${MID_RADIUS_KM}km 以上`,
        rangeEn: `Beyond ${MID_RADIUS_KM}km`,
        fee: DELIVERY_FEE_FAR_RM,
        freeOver: null, // flat — no basket size waives it
    },
];

/** "满 RM 20 免运" or "不设免运" for the flat far tier. */
export const freeOverPhraseZh = (t: DeliveryTierCopy) =>
    t.freeOver === null ? "固定运费·不设免运" : `满 RM ${t.freeOver} 免运`;
export const freeOverPhraseEn = (t: DeliveryTierCopy) =>
    t.freeOver === null ? "flat rate, no free-delivery threshold" : `free over RM ${t.freeOver}`;

/** "2.5km 内 RM 3 满 20 免运 · … · 7.5km 以上 RM 18 固定运费·不设免运" */
export const DELIVERY_SUMMARY_ZH = DELIVERY_TIER_COPY
    .map((t) => `${t.rangeZh} RM ${t.fee} ${freeOverPhraseZh(t)}`)
    .join(" · ");

/** "Within 2.5km RM 3 (free over RM 20) · ..." */
export const DELIVERY_SUMMARY_EN = DELIVERY_TIER_COPY
    .map((t) => `${t.rangeEn} RM ${t.fee} (${freeOverPhraseEn(t)})`)
    .join(" · ");

// 2026-07-29: 7.5km+ is served again (RM 18 flat, Grab-fulfilled), so the old
// "not delivered" note became a lie. Kept under the same export name so every
// consuming surface (footer, FAQ, terms, blog JSON-LD) flips together.
export const BEYOND_DELIVERY_NOTE_ZH = `${MID_RADIUS_KM}km 以上 RM ${DELIVERY_FEE_FAR_RM} 固定运费（Grab 配送，不设免运）`;
export const BEYOND_DELIVERY_NOTE_EN = `Beyond ${MID_RADIUS_KM}km — RM ${DELIVERY_FEE_FAR_RM} flat (delivered by Grab, no free-delivery threshold)`;

/** Where the km radii are measured from — without this, "2.5km 内" is ambiguous. */
export const DISTANCE_BASIS_ZH = "距离以 Pearl Point（碗妈厨房）为起点计算";
export const DISTANCE_BASIS_EN = "Distances measured from Pearl Point (BowlMama's kitchen)";

// ── Long-form / SEO prose fragments ─────────────────────────────────────────
// Used by layout metadata, /order landing pages, blog posts and their JSON-LD
// so long-form copy can never drift from the real fee schedule either.

/** "2.5km 内 RM 3（满 RM 20 免运）" — bracketed style used in prose/metadata */
export const tierProseZh = (t: DeliveryTierCopy) =>
    `${t.rangeZh} RM ${t.fee}（${freeOverPhraseZh(t)}）`;
export const tierProseEn = (t: DeliveryTierCopy) =>
    `${t.rangeEn} RM ${t.fee} (${freeOverPhraseEn(t)})`;

/** All four tiers, bracketed style. */
export const DELIVERY_PROSE_ZH = DELIVERY_TIER_COPY.map(tierProseZh).join(" · ");
export const DELIVERY_PROSE_EN = DELIVERY_TIER_COPY.map(tierProseEn).join(" · ");

/** First two tiers only — for length-constrained metadata descriptions. */
export const DELIVERY_PROSE_SHORT_ZH = DELIVERY_TIER_COPY.slice(0, 2).map(tierProseZh).join(" · ");
export const DELIVERY_PROSE_SHORT_EN = DELIVERY_TIER_COPY.slice(0, 2).map(tierProseEn).join(" · ");

/** Named tiers for prose that interpolates a single tier's numbers. */
export const TIER_INNER = DELIVERY_TIER_COPY[0];
export const TIER_OUTER = DELIVERY_TIER_COPY[1];
export const TIER_MID = DELIVERY_TIER_COPY[2];
export const TIER_FAR = DELIVERY_TIER_COPY[3];

// ── Coverage areas ──────────────────────────────────────────────────────────
// Single source for the neighbourhoods we serve — used by the trust strip,
// footer, FAQ and SEO metadata/JSON-LD (areaServed). Update here only.
export const COVERAGE_AREAS = [
    "Old Klang Road",
    "OUG",
    "Taman Desa",
    "Kuchai Lama",
    "Bukit Jalil",
    "Sri Petaling",
];

/** "Old Klang Road · OUG · Taman Desa · Kuchai Lama · Bukit Jalil · Sri Petaling" */
export const COVERAGE_AREAS_TEXT = COVERAGE_AREAS.join(" · ");
