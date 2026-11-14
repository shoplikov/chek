# Decisions

Record of what the spec assumed, what was found, and what was chosen. Times are +05.

## Pre-flight (2026-11-15 01:57)

| Check | Result |
|---|---|
| Node | v22.22.3, npm 10.9.8 |
| GitHub CLI | authenticated |
| AWS | credentials OK; configured region `eu-north-1` |
| Docker | 29.5.3 available |
| LLM key | No `ANTHROPIC_API_KEY`. `OPENAI_API_KEY` present and valid. |
| Stripe | No `STRIPE_SECRET_KEY` → labelled demo checkout (section 11) |

## LLM provider

- Spec prefers Claude. No Anthropic key was available. Amazon Bedrock lists Claude models
  in this account, but invoking them fails: the account has not submitted Anthropic's
  use-case form (and Opus 5.5 is "not available for this account"). Submitting that form is
  a business decision for the account owner, so it was not done here.
- Chosen: OpenAI through the official `openai` SDK with strict JSON-schema structured output
  (`zodResponseFormat`), as the spec allows when only another provider's key exists.
- The client takes an optional `OPENAI_BASE_URL`, so any OpenAI-compatible server (for
  example vLLM serving an open vision model on a GPU instance) can replace it without code
  changes.

## Deploy

- App Runner (path A): `CreateService` returned "Account can't create new App Runner
  services", and App Runner has no endpoint in `eu-north-1`. Took **path B**.
- Path B: one EC2 `t3.small` (Amazon Linux 2023) in `us-east-1`, Elastic IP, security group
  open on 80/443 only (no SSH; administration through SSM Run Command). Docker runs the app
  image (pulled from ECR) and Caddy, which serves automatic HTTPS on
  `54-163-135-214.nip.io`.
- Secrets live in SSM Parameter Store (`/chek/*`, SecureString). The instance role may read
  only `/chek/*`. Secrets are never in the image or the repository.

### AWS resources (all tagged `project=chek-hackathon`, region us-east-1)

| Resource | Name / id |
|---|---|
| ECR repository | `chek` |
| IAM role + instance profile | `chek-ec2` (ECR read-only, SSM core, read `/chek/*`) |
| Security group | `sg-01f501625ff6862f2` (`chek-web`) |
| Elastic IP | `eipalloc-061f86de899028ab7` (54.163.135.214) |
| EC2 instance | `i-037e13021410634c0` (`chek`) |
| SSM parameters | `/chek/OPENAI_API_KEY` |

Public URL: https://54-163-135-214.nip.io. Remove everything with `scripts/teardown.sh`.

## Reference data (Open Prices)

- The dumps (`prices.jsonl.gz`, `locations.jsonl.gz`, `products.jsonl.gz`) download fine.
  The price rows in the dump do **not** carry nested product or location objects (unlike the
  API), so the seed joins the three dumps by `product_code` and `location_id`.
- Demo area: every US store in Mountain View, Sunnyvale and Los Altos with at least 150
  price observations (21 stores), wider than the spec's table of 11, for more coverage.
- Observations from 2024-07-19 to 2026-11-11, almost all from Sep 2025 onwards.
- Products priced at 2+ demo-area stores, by maximum observation age: 30 d: 94, 60 d: 147,
  90 d: 228, **100 d: 387**, 120 d: 528, 180 d: 720, 365 d: 2,465.
- `MAX_OBSERVATION_AGE_DAYS = 100`: the smallest window that keeps at least 300 such products.
  The UI shows the observation date next to every price.

## BLS

- `download.bls.gov` refuses scripted downloads. The series IDs were checked against the
  official item list (`ap.item`) read through a web fetch, then the data fetched with the public
  API v1 (2 calls, cached). Butter (`APU0000710111`) and peanut butter (`APU0000716141`) returned
  no recent months and are dropped. 13 average-price series remain, plus `CUUR0000SAF11`
  (36 months, latest October 2026 = 322.876, matching the spec's verified value).
- The official inflation figure uses the same two months as the user's receipts; when the later
  month is not published yet (November), the latest published month is used and named.

## Model and matching

- Model: `gpt-5.5` for both calls (parse: default effort; match: `reasoning_effort: low`).
  Measured: parse about 5–7 s per sample, match about 3–4 s.
- Each candidate shown to the matcher includes its observed price at the receipt's store when
  one exists. This fixed a size mix-up (two Pop-Tarts pack sizes) without loosening guards.
- `eval:match` counts a match as correct when it is the true barcode or a product with the same
  name, brand and size: Open Food Facts lists some products under two barcodes (e.g. Kraft
  Deluxe 14 oz has two codes, both priced $3.99 at the same Safeway).
- Match results are cached per `(store, rawName)` in memory, so the same receipt gives the same
  result on repeat scans (checked: identical headlines over repeated scans of three samples).

## Findings: "cheaper similar product"

Open Food Facts' "most specific category" is often junk (`en:undefined`, `en:groceries`) or
broad (`en:sauces`, `en:snacks`), which produced swaps like salsa → iodized salt. A swap now
requires all of:
1. a specific category: the last valid tag, not in a list of broad tags, at depth ≥ 3;
2. the same unit family (g or ml), and a pack size within 2.5× of the original;
3. at least one shared descriptive word in the product names (brand words removed).
Thresholds are in `lib/config.ts`. Swaps still show both product names so the user can judge.

## Proven savings

- A pledge counts from the **date of the receipt it was made on**, not the moment of tapping.
  Otherwise the Week 2 sample (dated a week after Week 1, but before "now") could never prove
  anything, and a user scanning last week's receipts today would see the same problem.
- Swap saving = (unit price then − unit price now) × amount bought now, per 100 g/ml. When a
  unit price is unknown, pack prices are compared only for equal pack sizes; else nothing.

## Samples and demo history

- Samples: Week 1 and Week 2 at Safeway Mountain View, Whole Foods Sunnyvale, Smart & Final
  Mountain View, and a store outside the demo area (Columbus, OH). Nob Hill Foods was planned
  but its observations are older than the 100-day window, so Smart & Final replaced it.
- Week 2 replaces 3 Week 1 items by the swap the live engine suggests for them (computed by the
  same `cheaperSwap` function at generation time), at their real observed prices.
- Demo history: 8 weekly Safeway receipts plus 3 small Sprouts receipts (the "buy elsewhere"
  pledge needs receipts from another store), 11 in total. One switch (cranberries) is set to cost
  10% more per 100 g than the original from week 7, so a "paid more" case exists; this is the only
  hand-set price and is documented in `scripts/make-samples.ts`.

## Paywall

- No `STRIPE_SECRET_KEY` exists, so the deployment uses the labelled demo checkout. The Stripe
  code path (subscription Checkout Session with inline `price_data`, verify by `payment_status`)
  is written but untested without a key; it refuses any key not starting with `sk_test_`.

## Not done

- The GPU instance (`g4dn.xlarge`) suggested for self-hosting a model was not used: the OpenAI
  key was available and gives better receipt reading than an open model that fits a T4. The
  `OPENAI_BASE_URL` switch keeps that option open.
