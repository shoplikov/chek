# Chek — build spec for one autonomous session

Written 2026-11-15 00:40 (+05); revised 01:00 (proven savings replaces the weekly plan). Submission deadline: 2026-11-15 12:00 (+05). Target: a
deployed, working app by 08:00, leaving the humans two hours to test before a 10:00 freeze.

**How to use this file.** It is self-contained: it was written on another machine, so
assume you have nothing but this file, an empty folder, and the tools on this computer.
Start the session with: *"Read BUILD_SPEC.md and build it exactly as specified. Work
autonomously until section 18 is complete."*

You are building this alone, in one session, without asking questions after pre-flight.
Read this whole file before writing code. Where it says "verify", do the check and adapt;
the spec was written from research, not from a running system. When the spec and reality
disagree, reality wins: record what you found and what you chose in `docs/DECISIONS.md`
and keep going. Times are in Almaty time (+05). If you start late, keep the order of work
and take the cut lines in section 16 earlier; stop adding features at 08:00.

## Context: who judges this and how

This is a 24-hour hackathon entry (Business Cup 2.0). Knowing how it is judged explains
most decisions below.

- **The jury tests alone.** Between 12:00 and 15:00 on 15 November, jurors open the public
  link in a browser, on desktop or phone, with no one from the team present. They try
  their own inputs and the built-in samples, and they read the code in the repository.
  There is no live demo. The link must stay up until the end of 15 November.
- **Pass or fail:** the product must be B2C (the individual pays), must run in a browser
  (no native app, nothing to install), and the team must submit a deck, the link and a
  public repository. You own the link and the repository.
- **Scoring:** Product & engineering 40% (does the key scenario really work end to end,
  on real input, with clean readable code); Value & retention 20% (what the user pays
  for, why they come back); Problem & user 15%; Business potential 15%; Originality 10%.
- **Rules the organizers stated, which this spec implements:**
  - The jury must complete the main scenario with no sign-up, no login and no real
    payment. Anonymous sessions and `localStorage` are fine.
  - The core value must be real: "hardcoded" means a result written in advance that does
    not depend on the input. Sample or seed data is welcome if it runs through the real
    product logic and is labelled as sample; the flow must also work on real input.
  - A product whose value is one LLM call is a "ChatGPT wrapper" and scores badly. Code
    doing the calculation, with accumulated user data, counts as real.
  - A working paywall with a clear price is the minimum; a Stripe test-mode checkout with
    the test card shown on screen is a plus. A pricing page alone is not enough.
  - At least one return mechanic must be built and working (here: the switch list and
    proven savings, personal inflation, the guarantee counter).
  - The audience is adults aged 25–45 in the United States. The UI is in English.
  - Only buttons in the main flow need to work; remove the rest.
  - No secrets in the repository; do not collect personal data you do not need.
  - A simple architecture that works beats a complex one that is unfinished.
  - The product must be built during the event; commit history may be inspected.
- **The team's own headline principle:** "no invented price". It is the product's main
  claim to originality, so a single unsourced number would undo it.

## 0. What you are building

**Chek**: a mobile-first web app. A US shopper photographs a grocery receipt and sees, in
about 10 seconds, where they paid more than they had to, with a cited source for every
number.

**Done means all of this is true on a public HTTPS URL:**
1. Tapping a sample receipt runs the live pipeline and shows a headline amount and
   findings, each with evidence (store, price, date, source).
2. Uploading any receipt photo works the same way; a receipt from a store with no price
   data is parsed, sum-checked and shown with "no price data for this store yet".
3. A paywall with a visible price hides part of the result; a test-mode checkout unlocks it.
4. The user can mark findings "I'll switch next time". A later receipt (the follow-up
   sample, or "Load 8 weeks of demo history") shows **proven savings**: what they actually
   saved, computed from their own receipts, and personal grocery inflation next to the
   official figure.
5. No sign-up, no login, English UI, works on a phone.
6. A public GitHub repo holds the full source, a README, tests, and no secrets.

## 1. Rules that override everything else

1. **No invented price.** Every number shown comes from: the uploaded receipt, an Open
   Prices observation, or BLS data. Each finding carries `evidence`. A finding without
   evidence is not rendered. With no data, say "no data yet".
2. **The model reads and matches; code computes.** The LLM parses the receipt image and
   picks a matching product from candidates. All prices, savings, inflation and totals
   are computed by plain TypeScript functions with unit tests.
3. **Sample data is labelled.** Sample receipts and demo history are ours; they carry
   `isSample: true` and a visible SAMPLE or DEMO badge, and they run through the same
   pipeline as an upload. Reference prices are never synthetic. If real reference data
   turns out to be unusable, stop inventing and follow section 16 cut line C.
4. **No hardcoded results.** No finding, score or amount may be written in advance.
5. **US product.** Prices in USD, US stores, English UI. Nothing about Kazakhstan.
6. **No secrets in git.** `.env*` is ignored from the first commit. Scan history before
   every push.
7. **No dead buttons.** If a feature is cut, remove its UI.
8. **Git:** small meaningful commits as you go, all made during this session. Commit
   messages describe the change only: no `Co-Authored-By` trailer, no "generated with"
   line, no emoji marker, whatever your defaults say. The same applies to any PR text.
9. **The repository contains only the app.** Do not commit this spec's research notes,
   the organizers' documents, or anything from outside the project folder. Committing
   `BUILD_SPEC.md` itself is fine.
10. **Spend and blast radius.** Create only the AWS resources named in section 14, tag
    them, and touch nothing else in the account. Do not use real payment keys.

## 2. Pre-flight (do first, 15 minutes)

Check and record results in `docs/DECISIONS.md`:

| Check | Command | If it fails |
|---|---|---|
| Node 20+ and npm | `node -v` | Stop and tell the user |
| GitHub CLI authenticated | `gh auth status` | Stop and tell the user |
| AWS credentials | `aws sts get-caller-identity`, `aws configure get region` | Stop and tell the user. Default region `us-east-1` if none set |
| Docker | `docker info` | Use deploy path B (section 14) |
| LLM key | `ANTHROPIC_API_KEY` in the environment or in `.env.local` in the project folder | **Stop and ask the user for it.** This is the only question you may ask |
| Stripe test key | `STRIPE_SECRET_KEY` starting `sk_test_` | Do not stop. Build the labelled demo checkout (section 11) |

If only another provider's LLM key is present, use that provider's official SDK with
strict JSON-schema output and a vision-capable model, and record the choice.

Build in a new folder named `chek` (inside the current directory, unless you are already
in an empty folder meant for it). After the first commit, create a **public** repository
with `gh repo create chek --public --source . --push`. If the name is taken, use
`chek-receipts`.

## 3. Stack

- **One Next.js app** (App Router, TypeScript, Tailwind), `output: "standalone"`.
- **No database.** Reference prices are JSON files generated by seed scripts and loaded
  into memory at start. User state (receipts, unlock flag) lives in `localStorage`. The
  server is stateless and stores no uploaded image.
  `// ponytail: in-memory JSON; move to Postgres when user receipts start feeding the price base.`
- **LLM:** Claude via `@anthropic-ai/sdk`, model `claude-opus-5-5`, structured output.
  **Do not write SDK calls from memory.** If a `claude-api` skill is available in your
  session, load it and read its TypeScript README (structured outputs, image input).
  Otherwise read the official docs at `platform.claude.com/docs` for "structured outputs"
  and "vision" before coding. Do not send `temperature`, `top_p` or `top_k` (current
  models reject them). Check `stop_reason` for `refusal` and treat it as an error shown
  to the user. The documented pattern for schema-constrained output is:

  ```ts
  import Anthropic from "@anthropic-ai/sdk";
  import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY
  const res = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    system,
    messages: [{ role: "user", content }],  // content: text and image blocks
    output_config: { format: zodOutputFormat(Schema) },
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("llm_no_output");
  ```

  An image goes in `content` as a base64 image block; confirm its exact shape in the
  docs. If parsing is too slow, try `output_config.effort: "low"` for the match call
  only, and re-run the evals before keeping it.
- **Payments:** Stripe Checkout, test mode.
- **Tests:** Node's built-in runner via `npx tsx --test`.
- **Deploy:** one container on AWS App Runner (section 14).

## 4. Repo layout

```
app/
  page.tsx                 # home: upload, sample receipts, "how to test" for the jury
  result/page.tsx          # headline, findings, evidence, switch buttons, lock
  history/page.tsx         # switch list, proven savings, guarantee counter, inflation, receipts
  unlock/page.tsx  unlock/success/page.tsx
  api/scan/route.ts        # image -> Receipt -> matches -> findings
  api/checkout/route.ts  api/checkout/verify/route.ts
  api/health/route.ts
lib/
  types.ts
  parse.ts                 # vision call + sum check
  match.ts                 # candidates + LLM pick + guards
  findings.ts              # pure rule functions
  proven.ts  inflation.ts  guarantee.ts # pure (notices.ts if 7.5 is built)
  catalog.ts               # loads data/*.json into memory
  llm.ts                   # one wrapper: callJSON(system, content, zodSchema)
  guard.ts                 # rate limit, size caps
  store.ts                 # localStorage
  config.ts                # all thresholds
  *.test.ts
scripts/
  seed-open-prices.ts      # downloads and filters reference prices, writes data/
  seed-bls.ts
  make-samples.ts          # builds sample receipts and demo history from data/
  eval-parse.ts  eval-match.ts  smoke.ts
data/                      # generated, committed, each file has a provenance header
  locations.json  products.json  prices.json  bls.json  PROVENANCE.md
public/samples/*.png
prompts/*.md               # prompts live in files, not inline
docs/DECISIONS.md
Dockerfile  .env.example  README.md
```

## 5. Reference data (seed scripts)

### 5.1 Open Prices (the price base) — verified live on 2026-11-15

Open Food Facts' Open Prices is a crowd-sourced database of real shelf and receipt prices.
Facts confirmed by live calls:

- `GET https://prices.openfoodfacts.org/api/v1/prices?currency=USD&size=N` works without
  auth. Response keys: `items, page, pages, size, total`. `total` for USD was 47,875.
- Each price item includes: `id, product_code, price, price_is_discounted,
  price_without_discount, price_per, currency, location_id, date, type`, plus nested
  `product` (`code, product_name, brands, product_quantity, product_quantity_unit,
  categories_tags`) and nested `location` (`id, osm_name, osm_address_city,
  osm_address_postcode, osm_address_country_code, osm_lat, osm_lon, price_count`).
  `product_name` and `category_tag` on the price row itself are often null; use the
  nested product.
- `GET /api/v1/locations?osm_address_country__like=United%20States&order_by=-price_count&size=15`
  works. Top US stores by price count:

| location id | Store | City | Prices |
|---|---|---|---|
| 3998 | Safeway | Mountain View 94043 | 13,917 |
| 4191 | Nob Hill Foods | Mountain View 94040 | 4,054 |
| 5032 | Safeway | Mountain View 94040 | 3,792 |
| 4117 | Whole Foods Market | Sunnyvale 94086 | 3,726 |
| 4152 | Draeger's | Los Altos 94022 | 1,859 |
| 4393 | Sprouts Farmers Market | Sunnyvale 94087 | 1,673 |
| 4190 | Smart & Final extra! | Mountain View 94040 | 1,614 |
| 4058 | Whole Foods Market | Los Altos 94022 | 1,527 |
| 4120 | Costco | Mountain View 94043 | 1,063 |
| 3999 | Trader Joe's | Mountain View 94040 | 653 |
| 4031 | Target | Sunnyvale 94086 | 573 |

- Daily bulk dumps exist (gzipped JSONL), not yet downloaded or inspected:
  `https://prices.openfoodfacts.org/data/prices.jsonl.gz`, `locations.jsonl.gz`,
  `products.jsonl.gz`.
- Data licence: ODbL; the source must be credited.

**Not verified — check before relying on them:** other filter names on `/prices`
(`location_id`, `date__gte`, `order_by`, `page`), maximum page size, rate limits, the
dump's field layout, and any public web URL for a single price or product.

**`scripts/seed-open-prices.ts` must:**
1. Prefer the dumps; fall back to paging the API politely (one request at a time, small
   delay, cache responses on disk under `.cache/`, which is git-ignored).
2. Keep prices where `currency = USD`, `type = PRODUCT`, the location is in the **demo
   area**: the locations in the table above (Mountain View, Sunnyvale, Los Altos). This
   is the "South Bay" demo area. Record the final list in `data/locations.json`.
3. For each (product_code, location) keep the most recent observation. Record `date`.
4. Compute `unitPrice` when `product_quantity` and unit are present, normalised to
   per 100 g or per 100 ml.
5. Write `data/products.json`, `data/prices.json`, `data/locations.json`, and
   `data/PROVENANCE.md` with: download date, source URLs, counts per store, the date
   range of observations, the number of products priced at 2+ stores, and the ODbL credit.
6. Print a summary. **Decision point:** look at the date distribution and at how many
   products have prices at 2 or more stores. Set `MAX_OBSERVATION_AGE_DAYS` in
   `lib/config.ts` to the smallest window that keeps at least 300 such products (the
   team's brief wanted 30 days; the data is older, so expect a much larger window).
   Record the numbers and the choice in `docs/DECISIONS.md` and the README. The UI always
   shows the observation date next to a price.

Footer on every page: "Price data: Open Prices (Open Food Facts), ODbL. US averages: U.S.
Bureau of Labor Statistics."

### 5.2 BLS (official averages and inflation) — verified live on 2026-11-14

- Public API, no key for v1 (25 queries/day, 25 series per query); public domain, cite BLS.
- `CUUR0000SAF11` = CPI, food at home, US city average, monthly. Verified value for
  October 2026: 322.876.
- `APU0000708111` = eggs, grade A large, per dozen, US city average. Verified: $2.320.
- About 44 food items have a current US city average price. Geography is US and four
  regions; there is no city level. BLS warns against place-to-place comparison.

**`scripts/seed-bls.ts` must** fetch `CUUR0000SAF11` for the last 36 months and 10–20
average-price series you can map confidently to a product category and a unit (eggs per
dozen, milk per gallon, bread per lb, bananas per lb, chicken per lb, ground beef per lb,
butter, rice, coffee, sugar, and similar). Look the series IDs up from BLS; do not guess
them. Write `data/bls.json` with series ID, item text, unit, month and value. Make as few
API calls as possible and cache them.

## 6. Types (`lib/types.ts`)

```ts
export type ReceiptLine = {
  line: number; rawName: string; qty: number; unitPrice: number | null;
  lineTotal: number; discount: number; taxable: boolean | null;
};
export type Receipt = {
  id: string; store: { name: string; city: string | null; state: string | null };
  purchasedAt: string | null;          // ISO date
  currency: string;                    // "USD" expected; anything else => no comparisons
  lines: ReceiptLine[]; subtotal: number | null; tax: number | null; total: number;
  sumCheckPassed: boolean; isSample: boolean;
};
export type Match = {
  line: number; productCode: string | null; confidence: number; // 0..1
  reason: "matched" | "no_candidate" | "low_confidence" | "price_guard";
};
export type Evidence = {
  sourceType: "own_receipt" | "open_prices" | "bls";
  sourceRef: string;                   // e.g. "open-prices:price:28372" or BLS series id
  sourceLabel: string;                 // "Safeway, Mountain View" or "BLS US city average"
  observedAt: string; price: number; unit?: string; url?: string;
};
export type Finding = {
  type: "cheaper_elsewhere" | "cheaper_swap" | "price_up" | "above_us_average";
  line: number; headline: string; savingOnThisReceipt: number; evidence: Evidence;
};
// A finding the user chose to act on. Stored in localStorage, sent with later scans.
export type Pledge = {
  id: string; createdAt: string; fromReceiptId: string; isSample: boolean;
  kind: "cheaper_swap" | "cheaper_elsewhere";
  productCode: string;                 // what they bought
  targetProductCode: string;           // swap target; same as productCode for "elsewhere"
  categoryTag: string | null;
  fromStore: string; targetStore: string | null;   // targetStore set for "elsewhere"
  paidPrice: number; paidUnitPrice: number | null; // what they paid then
  expectedSaving: number;              // the finding's savingOnThisReceipt
  label: string;                       // "Switch to <product>" / "Buy <product> at <store>"
};
// One pledge confirmed (or not) by one later receipt. Computed by code on every scan.
export type ProvenItem = {
  pledgeId: string; receiptId: string; line: number;
  status: "saved" | "paid_more";
  saving: number;                      // > 0 when saved; 0 when paid_more
  then: Evidence; now: Evidence;       // both are own_receipt lines
};
export type CheckNotice = {            // optional feature, section 7.5
  kind: "possible_double_scan" | "line_math_mismatch";
  line: number; amountAtStake: number; text: string;
};
export type ScanResult = {
  receipt: Receipt; matches: Match[]; findings: Finding[];
  headlineSaving: number;              // sum of the best finding per line
  coverage: { lines: number; matched: number; withFinding: number };
  proven: ProvenItem[];                // active pledges checked against THIS receipt
  provenSaving: number;                // sum of proven[].saving
  notices: CheckNotice[];              // empty if 7.5 is not built
};
```

Never include card numbers, loyalty numbers or cashier names in any type.

### 6.1 Config (`lib/config.ts`) — every threshold lives here, none in rule code

```ts
export const CONFIG = {
  PRICE_MONTHLY_USD: 4.99,
  GUARANTEE_THRESHOLD_USD: 20,     // of PROVEN savings per calendar month
  ELSEWHERE_MIN_PCT: 0.05,
  SWAP_MIN_PCT: 0.15,
  UP_MIN_PCT: 0.05,
  AVG_MIN_PCT: 0.10,
  MATCH_MIN_CONFIDENCE: 0.8,
  PRICE_GUARD_RATIO: 3,            // reject a match if paid price is >3x or <1/3 of every reference
  MAX_OBSERVATION_AGE_DAYS: 0,     // set in step 3 from the data; see 5.1
  SUM_CHECK_TOLERANCE_USD: 0.02,
  MAX_IMAGE_BYTES: 4_000_000,
  MAX_HISTORY_RECEIPTS: 20,
  RATE_LIMIT: { scans: 20, windowMinutes: 10 },
  INFLATION_MIN_COMMON_PRODUCTS: 3,
  INFLATION_MIN_DAYS: 14,
  PLEDGE_MAX_ACTIVE: 30,
};
```

### 6.2 Environment (`.env.example`, committed; real values never committed)

```
ANTHROPIC_API_KEY=       # required
STRIPE_SECRET_KEY=       # optional, sk_test_ only; without it the demo checkout is used
APP_URL=                 # public base URL, used for Stripe return URLs
```

Refuse to start checkout if `STRIPE_SECRET_KEY` does not begin with `sk_test_`.

### 6.3 What the user sees when something goes wrong

| Situation | What to show |
|---|---|
| Image is not a receipt, or unreadable | "We couldn't read a receipt in this photo. Try a flatter, brighter shot, or use a sample." |
| Sum check fails after the retry | The parsed lines, a "Check these lines" notice, and findings only for lines that add up |
| Currency is not USD, or store outside the demo area | The parsed receipt and "No price data for this store yet. Your history starts now." |
| No line matched | "We read N lines but couldn't match them to products we have prices for." |
| LLM error, refusal or timeout | "Something went wrong reading this receipt. Nothing was saved. Try again." |
| Rate limit hit | "Too many scans from this network. Try again in a few minutes." |

Never show a finding, an amount or a score in any of these cases unless it was computed.

## 7. Pipeline

### 7.1 Parse (`lib/parse.ts`)
- Client downsizes the photo to at most 1600 px on the long side, JPEG, before upload.
  Server rejects bodies over 4 MB.
- One vision call with a strict schema returns the `Receipt` fields. Prompt in
  `prompts/parse.md`: transcribe only what is printed; do not expand abbreviations; do
  not output payment card, loyalty or cashier details; discounts as positive numbers on
  the line they apply to; set `total` from the printed total.
- **Sum check in code:** `sum(lineTotal − discount) + tax` equals `total` within $0.02,
  or `sum(lineTotal − discount)` equals `subtotal`. If it fails, retry the call once with
  the mismatch stated. If it still fails, return the receipt with `sumCheckPassed: false`;
  the UI shows "Check these lines" and no finding uses a line the check cannot account for.

### 7.2 Match (`lib/match.ts`)
- Candidates in code: tokenise `rawName`, score catalog products by token and prefix
  overlap against product name and brand, prefer products priced at the receipt's store
  when the store is in the demo area, take the top 15.
- One LLM call per receipt (all lines batched): for each line, choose one candidate
  `productCode` or `null`, with a confidence. Prompt in `prompts/match.md`: "Prefer no
  match to a wrong match. Different size, flavour or fat content is a different product."
- **Guards in code:** the chosen code must be among that line's candidates; drop below
  `MATCH_MIN_CONFIDENCE` (0.8); drop when the paid unit price is more than 3x or less
  than a third of every reference price for that product (`price_guard`).
- Cache by `(store name, rawName)` in memory.

### 7.3 Findings (`lib/findings.ts`, pure functions, one test file each rule)

Paid price for a line = `(lineTotal − discount) / qty`.

| Type | Rule | Evidence |
|---|---|---|
| `cheaper_elsewhere` | Same `productCode` at another demo-area store, observation within `MAX_OBSERVATION_AGE_DAYS`, cheaper by `ELSEWHERE_MIN_PCT` (5%) or more | That Open Prices observation |
| `cheaper_swap` | At the same store, another product sharing the most specific `categories_tag`, same unit family, unit price lower by `SWAP_MIN_PCT` (15%) or more | That observation |
| `price_up` | Same `productCode` (or same store and identical `rawName`) in the user's own earlier receipts, paid price up by `UP_MIN_PCT` (5%) or more | The earlier receipt line |
| `above_us_average` | Product maps to a BLS item with a comparable unit, paid unit price above the latest US average by `AVG_MIN_PCT` (10%) or more | BLS series and month |

- `savingOnThisReceipt` = (paid − reference) × qty, never negative.
- **No double counting:** keep at most one finding per line for the headline, the one
  with the largest saving. `headlineSaving` is the sum of those.
- Do **not** annualise by assuming weekly purchases. A yearly figure may be shown only
  from the user's own history: saving per receipt × receipts per year observed, labelled
  "based on your last N receipts".
- Headlines are generated in code from templates, not by the LLM.
- Label `above_us_average` as "US average", never "your city".

### 7.4 History features (pure)
- **Personal inflation** (`lib/inflation.ts`): for products present in both an early and
  a late receipt, `sum(price_now × qty_then) / sum(price_then × qty_then) − 1`. Needs at
  least 3 common products and 14 days between receipts, else "not enough history yet".
  Official figure: change in `CUUR0000SAF11` between the same two months.
- **Switch list and proven savings** (`lib/proven.ts`) — the product's main loop.
  A finding says what the user *could* save; this proves what they *did* save, from their
  own receipts. It is what makes the guarantee honest.
  1. On the result page, each `cheaper_swap` and `cheaper_elsewhere` finding has a button
     "I'll switch next time". Tapping it stores a `Pledge` in `localStorage` (cap
     `PLEDGE_MAX_ACTIVE`; the user can remove one). The pledges form the **switch list**:
     a short checklist to read before the next shop, grouped by store.
  2. Every scan receives the client's active pledges. `verifyPledges(pledges, receipt,
     matches)` is a pure function that returns `ProvenItem[]` for this receipt:
     - **Swap pledge:** fulfilled if the receipt, from the same store, contains
       `targetProductCode`. `saving = (pledge.paidUnitPrice − paid unit price now) × the
       quantity bought now`, in the same unit (per 100 g or 100 ml). If either unit price
       is unknown, compare pack prices only when both products have the same pack size;
       otherwise return nothing for this pledge (do not guess).
     - **Elsewhere pledge:** fulfilled if the receipt is from a different store than
       `fromStore` and contains `productCode`. `saving = (pledge.paidPrice − paid price
       now) × qty`.
     - If the price now is higher than then: `status: "paid_more"`, `saving: 0`, and the
       UI says so plainly ("This switch cost you $0.40 more this time").
     - If the receipt has neither product: no item for that pledge.
     - A pledge is only checked against receipts dated after `createdAt`.
     - Each pledge yields at most one item per receipt. A pledge stays active and can be
       proven again on later receipts, since each purchase is a real saving.
     - Both `then` and `now` evidence point to the user's own receipt lines.
  3. `provenSaving` for a receipt is the sum of its items' `saving`. The client keeps
     `ScanResult.proven` with each stored receipt.
  4. Proven savings never use reference prices. They are computed only from what the
     user paid then and what they paid now.
- **Guarantee counter** (`lib/guarantee.ts`): the sum of `provenSaving` over receipts
  dated in the current calendar month, against `GUARANTEE_THRESHOLD_USD`. Text: "Proven
  savings this month: $X of $20. If we can't prove $20 in a month, that month is free."
  Underneath, smaller: "Found on your receipts this month: $Y" (the sum of
  `headlineSaving`), so the difference between found and proven is visible. This is a
  counter only; no automated refund is built, and the UI must not claim one happened.

### 7.5 Optional: things worth checking on the receipt itself (`lib/notices.ts`, pure)

Build only if everything through step 9 is deployed. No outside data is used.
- `possible_double_scan`: two lines with identical `rawName` and identical price, each
  with qty 1. Text: "Possible double scan: <name> appears twice at $P. Check your bag."
- `line_math_mismatch`: `qty × unitPrice` differs from `lineTotal` by more than
  `SUM_CHECK_TOLERANCE_USD` when both are printed.
- These are notices, not findings: they appear in their own block, "Worth a second look",
  with the amount at stake. They are **never** added to `headlineSaving`, to proven
  savings or to the guarantee counter, because they are possibilities, not facts.

## 8. API

| Route | In | Out |
|---|---|---|
| `POST /api/scan` | multipart: `image`, or JSON `{ sampleId }`; plus `history: Receipt[]` (matched earlier receipts from the client, max 20) and `pledges: Pledge[]` (active pledges, max 30) | `ScanResult` |
| `POST /api/checkout` | `{}` | `{ url }` |
| `GET /api/checkout/verify?session_id=` | | `{ unlocked: boolean }` |
| `GET /api/health` | | `{ ok: true, products, prices, locations }` |

`sampleId` loads the sample **image** from `public/samples/` and sends it through the same
parse path as an upload. Guards: per-IP limit of 20 scans per 10 minutes
(`// ponytail: per-instance memory; the hard limit is the spend cap on the LLM key`), body
size cap, honest error messages. Never return a canned result when the LLM fails.

## 9. Pages

- **`/` Home.** One line: "Photograph a grocery receipt. See where you overpaid, with
  proof." Upload button (camera on mobile via `<input type="file" accept="image/*"
  capture="environment">`). Three or more sample receipt tiles with a SAMPLE badge. A box
  titled "Testing this without a US receipt?" with four steps: (1) tap the sample
  "Week 1"; (2) tap "I'll switch next time" on two findings, and unlock the rest with
  the test card; (3) tap the sample "Week 2 (follow-up)" to see what those switches
  actually saved; (4) load 8 weeks of demo history. Note: "We have price data for stores in Mountain View,
  Sunnyvale and Los Altos, California. Other stores: your receipt is read and saved, and
  comparisons start when data exists."
- **`/result`.** Headline: "On this receipt you could have paid $X less." Coverage line:
  "We read N lines, matched M, found savings on K." Findings sorted by saving; the first
  is fully visible; tapping a finding expands its evidence (store, price, date, source).
  Each swap or elsewhere finding has an "I'll switch next time" toggle. If this receipt
  confirms earlier pledges, a block at the top: "Proven on this receipt: $X saved" with
  each item showing then and now. Unmatched lines are listed plainly. Sum-check status.
  Notices from 7.5, if built, in a separate "Worth a second look" block. If currency is not USD or the
  store is unknown: the parsed receipt, and "No price data for this store yet. Your
  history starts now."
- **Lock.** If the hidden findings on this receipt add up to at least the monthly price,
  blur them and show "Unlock the rest — $4.99/month" with the guarantee line ("If we
  can't prove $20 of savings in a month, that month is free"). Otherwise
  show everything and say "Nothing here worth charging for. This one is free."
- **`/history`.** In this order: the switch list (active pledges grouped by store, each
  removable; "Read this before your next shop"); proven savings (total, and per pledge:
  times proven, amount, last receipt); the guarantee counter; the inflation card ("Your
  groceries: +N%. Official food-at-home inflation: +M%, BLS, month–month"); the receipt
  list; "Load 8 weeks of demo history" (DEMO badge on every loaded row) and "Clear".
  Free users see the switch list and the proven total; the per-pledge breakdown and the
  inflation history are unlocked with the subscription.
- **`/unlock`, `/unlock/success`.** Price, what is included, test card
  `4242 4242 4242 4242` printed on the page.

Plain, legible, mobile-first. No marketing fluff, no icons that do nothing.

## 10. Samples and demo history (`scripts/make-samples.ts`)

- Build 4–6 sample receipts from real data: pick a demo-area store and 12–20 products it
  has prices for, preferring products that are also priced at another store. Line prices
  are that store's observed prices. Add a plausible tax line (California grocery food is
  mostly untaxed; taxable items exist). Print names as a real receipt would: upper case,
  abbreviated, truncated to about 18 characters, generated by a deterministic function.
  **Do not print product codes on the sample.**
- Render each to a PNG that looks like a thermal receipt (SVG to PNG with `sharp` is
  enough), with "SAMPLE RECEIPT" printed on it. Check that the vision model reads it.
- **Follow-up sample ("Week 2").** For the first sample ("Week 1"), build a second
  receipt at the same store one week later in which three of the items are replaced by
  the cheaper swap the engine would suggest (the real cheaper product at its real
  observed price), and the rest are the same. A juror who pledges those switches on
  Week 1 and then scans Week 2 sees proven savings computed live. If they pledge nothing,
  Week 2 simply shows its own findings; nothing is pre-filled.
- Demo history: 8 receipts for one household over 8 weeks, and the pledges that household
  made (marked `isSample: true`). Weeks 1–2: the original basket. After week 2 the
  household pledges four switches (three swaps in the same store, one item bought at
  another demo-area store). Weeks 3–8: they follow three of the four; on one of those the
  price later rises above the old one, so a "paid more" case appears. Reference items use
  real observed prices; each line's price moves week to week by the real monthly change
  of `CUUR0000SAF11` plus a small deterministic per-product offset documented in the
  script. Stored as `Receipt` and `Pledge` JSON; when loaded, matching, findings,
  `verifyPledges`, the guarantee counter and inflation are all computed by the live code.
- The README states exactly which data is real (reference prices, BLS) and which is
  sample (these receipts and this history).

## 11. Paywall

- Price: **$4.99/month** (a placeholder the team may change in `lib/config.ts`).
- Free: the headline, the first finding with evidence, the switch list, the proven
  total, any notices. Paid: all findings, the proven-savings breakdown, inflation history.
- With `STRIPE_SECRET_KEY`: Checkout Session in `subscription` mode, one line item with
  inline `price_data`, `success_url` back to `/unlock/success?session_id=…`. Read the
  current Stripe docs for the exact call; do not rely on memory. `verify` retrieves the
  session and returns `unlocked` when it is paid. The client stores the flag.
  `// ponytail: client-side flag; fine for a demo with no real money.`
- Without the key: an in-app form titled "Demo checkout — no real payment" that sets the
  same flag. Say so in the README.

## 12. Tests and evals

- Unit tests for: the sum check; each findings rule (fires, does not fire at the
  threshold, never without evidence); no double counting; inflation; guarantee counter;
  `verifyPledges` (swap saved, elsewhere saved, paid more gives zero, unknown unit price
  gives nothing, receipts before the pledge are ignored, one item per pledge per receipt);
  match guards. `npm test` must pass before each deploy.
- `npm run eval:parse`: run every sample image through the parser; report the share where
  the sum check passes and where the parsed total equals the known total.
- `npm run eval:match`: on the sample receipts (where the true product codes are known
  from the generator), report precision and recall of matching. Target: wrong matches
  under 5%. If precision is below target, raise `MATCH_MIN_CONFIDENCE`.
- `npm run smoke -- <url>`: against the deployed URL, scan a sample and assert at least
  one finding with evidence, then check `/api/health`.
- Put the eval numbers in the README. Report them as measured on samples, not on real
  customer receipts. If the user drops real receipt photos into `eval/real/`, include
  them and report separately.

## 13. README (the jury reads it)

What it is; a diagram of the pipeline; how to run locally; where every number comes from;
"What is real and what is sample"; the eval numbers and how to reproduce them; key
dependencies (LLM provider, Stripe, Open Prices, BLS); known limits (one demo area, old
observations, matching recall, proven savings need a later receipt); licence credits. Short and factual.

## 14. Deploy (AWS)

Tag everything `project=chek-hackathon`. Write `scripts/teardown.sh` that deletes what
you created. Record resource names and the URL in `docs/DECISIONS.md`.

**Path A (Docker available): App Runner.**
1. Multi-stage `Dockerfile` for the Next standalone build; `data/` and `public/` copied in.
2. Create an ECR repository, build for `linux/amd64`, push.
3. Create an App Runner service from the image (1 vCPU, 2 GB), port 3000, health check
   `/api/health`, runtime environment variables for the keys, with the ECR access role.
4. Wait for `RUNNING`, run the smoke test against the HTTPS URL App Runner gives.

**Path B (no Docker, or App Runner fails twice):** one small EC2 instance (Amazon Linux,
`t3.small`), security group open on 80 and 443 only, Node installed by user data, the app
run under systemd, Caddy in front for automatic HTTPS on a `<ip>.nip.io` hostname. Verify
HTTPS works before calling it done.

Pass secrets as service environment variables or SSM parameters, never in the image or
the repo. Redeploy after each milestone so a working URL always exists.

## 15. Order of work

| Step | By (+05) | Deliverable |
|---|---|---|
| 1 | 01:15 | Pre-flight done; Next app scaffolded; first commit; public repo |
| 2 | 01:45 | **Hello-world deployed to the public URL.** Deploy early so it is never the last-minute risk |
| 3 | 02:30 | Seed scripts run; `data/` committed with provenance; decision on the age window |
| 4 | 03:30 | Parser with sum check; sample images generated; `eval:parse` runs |
| 5 | 04:15 | Matching with guards; `eval:match` runs |
| 6 | 05:00 | Findings engine with tests; `/api/scan` end to end on a sample |
| 7 | 05:45 | Home and result pages; deployed; smoke test passes |
| 8 | 06:15 | Switch list and proven savings (`verifyPledges` with tests), follow-up sample, guarantee counter |
| 9 | 07:00 | Paywall and checkout; inflation; demo history |
| 9b | 07:30 | README with evals; optional notices (7.5) only if everything above is deployed |
| 10 | 08:00 | Full acceptance pass on the public URL from a phone-sized viewport; final report |

If a step runs more than 30 minutes over, take the next cut and move on.

## 16. Cut lines (in this order)

- **A.** The optional notices (7.5).
- **B.** `above_us_average`, then the "elsewhere" kind of pledge (keep `cheaper_swap`,
  `cheaper_elsewhere` findings, `price_up` and swap pledges, which need only one store).
- **C.** If Open Prices cannot be downloaded or fewer than 100 products are priced at 2+
  demo-area stores: do **not** generate reference prices. Ship parsing, sum check,
  `above_us_average` against BLS, `price_up` and personal inflation from history, and say
  plainly in the UI and README that store-to-store comparison is not available yet.
- **D.** Stripe (use the labelled demo checkout).
- **E.** Last resort only: proven savings. If it must go, remove the switch buttons and
  make the guarantee counter say "Found" instead of "Proven"; never leave a counter that
  claims proof it cannot compute.
- Never cut: the sum check, evidence on every finding, sample labelling, the README,
  the tests for the rules that ship, a working public URL.

## 17. Acceptance (run on the deployed URL; fix or report each failure)

- [ ] Home loads without login on a 390 px wide viewport.
- [ ] Each sample receipt returns a result in under about 20 seconds with a headline and
      at least one finding; every finding expands to store, price, date and source.
- [ ] Scanning the same sample twice gives the same headline amount.
- [ ] `headlineSaving` equals the sum of the displayed best-per-line savings.
- [ ] A non-grocery or non-US image returns the parsed lines or a clear error, no fake
      findings.
- [ ] The lock appears only when the hidden savings reach the monthly price; checkout
      with the test card (or the demo checkout) unlocks and survives a reload.
- [ ] Demo history shows proven savings (including one "paid more" case), an inflation
      figure and the BLS figure with months named; every demo row and demo pledge has a
      DEMO badge; "Clear" removes them.
- [ ] Scan "Week 1", pledge two switches, scan "Week 2": a "Proven on this receipt"
      block appears with then and now prices, and its total equals the sum of its items.
- [ ] Scanning "Week 2" with no pledges shows no proven block.
- [ ] Removing a pledge removes it from the switch list and from later checks.
- [ ] The guarantee counter equals the sum of proven savings on this month's receipts,
      and shows the found amount separately.
- [ ] Footer credits Open Prices and BLS on every page.
- [ ] `npm test` passes; `git log` shows many commits; `git grep` and a history scan find
      no keys; the repo is public and opens without access requests.

## 18. Final report (your last message)

1. The public URL and the repo URL.
2. What works, checked against section 17, item by item. Say plainly what failed.
3. Which cut lines were taken and why.
4. The measured numbers: products, prices, stores, age window chosen, eval results.
5. What is sample data and what is real.
6. AWS resources created and how to remove them.
7. What the humans should test first.
Do not describe anything as working unless you ran it.
