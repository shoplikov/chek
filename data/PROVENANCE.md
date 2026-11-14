# Data provenance

Every reference number in the app comes from one of these files. Nothing here is synthetic.

## Open Prices (Open Food Facts) — `locations.json`, `products.json`, `prices.json`

- Source: daily dumps at https://prices.openfoodfacts.org/data/ (`prices.jsonl.gz`,
  `locations.jsonl.gz`, `products.jsonl.gz`), downloaded 2026-11-15.
- Licence: Open Database License (ODbL) 1.0. Price data © Open Food Facts contributors.
- Filter: currency USD, type PRODUCT, not marked duplicate, price between $0 and $500, at US
  stores in Mountain View, Sunnyvale and Los Altos (California) with at least 150
  observations. For each (product, store) only the most recent observation is kept.
- Result: 21 stores, 20,523 products, 26,062 prices. Observation dates 2024-07-19 to
  2026-11-11. Per-store counts and the age-window table: `open-prices-stats.json`.
- `unitPrice` is price per 100 g or per 100 ml, computed from the product's pack size when
  Open Food Facts records one.
- Built by `scripts/seed-open-prices.ts`.

## U.S. Bureau of Labor Statistics — `bls.json`

- Source: BLS Public Data API v1, downloaded 2026-11-15. Public domain.
- `CUUR0000SAF11`: CPI-U, food at home, U.S. city average (last 36 months).
- Average prices (U.S. city average) for 13 items; series IDs checked against
  https://download.bls.gov/pub/time.series/ap/ap.item.
- BLS publishes no city-level average prices; the app labels these "US average".
- Built by `scripts/seed-bls.ts`.
