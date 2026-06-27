/**
 * Single source of truth for the Google Business Profile rating shown across the
 * site: the FeedbackSection review wall, the PromoBanner trust signal, and the
 * Restaurant `aggregateRating` structured data. When the GBP rating or count
 * changes, update the two numbers HERE — every surface follows automatically.
 */
export const GOOGLE_RATING_VALUE = "5.0";
export const GOOGLE_REVIEW_COUNT = 35;

/**
 * Link customers tap to read the reviews on Google itself (credibility — proves
 * the wall isn't fabricated). The Maps search URL reliably resolves to the GBP
 * listing. For a direct reviews deep-link, replace with the Place ID form:
 *   https://search.google.com/local/reviews?placeid=YOUR_PLACE_ID
 */
export const GOOGLE_REVIEWS_URL =
  "https://www.google.com/maps/search/?api=1&query=Incredibowl%20Pearl%20Suria%20Residence%20Jalan%20Klang%20Lama";
