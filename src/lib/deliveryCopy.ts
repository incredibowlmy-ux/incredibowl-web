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
    /** free-delivery threshold in RM */
    freeOver: number;
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
];

/** "2.5km 内 RM 3 满 20 免运 · 2.5–5km RM 5 满 30 免运 · 5–7.5km RM 12 满 45 免运" */
export const DELIVERY_SUMMARY_ZH = DELIVERY_TIER_COPY
    .map((t) => `${t.rangeZh} RM ${t.fee} 满 ${t.freeOver} 免运`)
    .join(" · ");

/** "Within 2.5km RM 3 (free over RM 20) · ..." */
export const DELIVERY_SUMMARY_EN = DELIVERY_TIER_COPY
    .map((t) => `${t.rangeEn} RM ${t.fee} (free over RM ${t.freeOver})`)
    .join(" · ");

export const BEYOND_DELIVERY_NOTE_ZH = `${MID_RADIUS_KM}km 以外暂不配送`;
export const BEYOND_DELIVERY_NOTE_EN = `Beyond ${MID_RADIUS_KM}km — not currently delivered`;
