/**
 * Single source of truth for the Google Business Profile rating shown across the
 * site: the FeedbackSection review wall, the PromoBanner trust signal, and the
 * Restaurant `aggregateRating` structured data. When the GBP rating or count
 * changes, update the two numbers HERE — every surface follows automatically.
 */
export const GOOGLE_RATING_VALUE = "5.0";
export const GOOGLE_REVIEW_COUNT = 35;

/**
 * Direct deep-link to the Incredibowl Google reviews list (credibility — lets
 * customers verify the wall isn't fabricated). Built from the GBP Place ID.
 */
export const GOOGLE_REVIEWS_URL =
  "https://search.google.com/local/reviews?placeid=ChIJJdj9aydLzDER2RtkQ-FJvss";
