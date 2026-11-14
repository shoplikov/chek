/** Every threshold lives here; rule code reads them, never hardcodes them. */
export const CONFIG = {
  PRICE_MONTHLY_USD: 4.99,
  GUARANTEE_THRESHOLD_USD: 20,     // of PROVEN savings per calendar month
  ELSEWHERE_MIN_PCT: 0.05,
  SWAP_MIN_PCT: 0.15,
  SWAP_MIN_CATEGORY_DEPTH: 3,      // a swap needs a specific category, not "snacks"
  SWAP_MAX_SIZE_RATIO: 2.5,        // a swap target's pack is at most 2.5x larger or smaller
  UP_MIN_PCT: 0.05,
  AVG_MIN_PCT: 0.10,
  MATCH_MIN_CONFIDENCE: 0.8,
  PRICE_GUARD_RATIO: 3,            // reject a match if paid price is >3x or <1/3 of every reference
  MAX_OBSERVATION_AGE_DAYS: 100,   // smallest window keeping 300+ products at 2+ stores (docs/DECISIONS.md)
  SUM_CHECK_TOLERANCE_USD: 0.02,
  MAX_IMAGE_BYTES: 4_000_000,
  MAX_HISTORY_RECEIPTS: 20,
  RATE_LIMIT: { scans: 20, windowMinutes: 10 },
  INFLATION_MIN_COMMON_PRODUCTS: 3,
  INFLATION_MIN_DAYS: 14,
  PLEDGE_MAX_ACTIVE: 30,
  MATCH_CANDIDATES: 15,
};
