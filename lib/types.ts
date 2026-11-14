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
  productName?: string;                // the product the reference price is for
};
export type FindingType = "cheaper_elsewhere" | "cheaper_swap" | "price_up" | "above_us_average";
export type Finding = {
  type: FindingType;
  line: number; headline: string; savingOnThisReceipt: number; evidence: Evidence;
  productCode: string | null;          // what was bought (null for rawName-only price_up)
  targetProductCode?: string;          // cheaper_swap: the cheaper product
  targetStore?: string;                // cheaper_elsewhere: the cheaper store
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
  extraPaid: number;                   // > 0 when paid_more
  then: Evidence; now: Evidence;       // both are own_receipt lines
  label: string;
};
export type CheckNotice = {
  kind: "possible_double_scan" | "line_math_mismatch";
  line: number; amountAtStake: number; text: string;
};
export type ScanResult = {
  receipt: Receipt; matches: Match[]; findings: Finding[];
  headlineSaving: number;              // sum of the best finding per line
  coverage: { lines: number; matched: number; withFinding: number };
  proven: ProvenItem[];                // active pledges checked against THIS receipt
  provenSaving: number;                // sum of proven[].saving
  notices: CheckNotice[];
  storeKnown: boolean;                 // store is in the demo area with price data
  storeLocationIds: number[];
};
// What the client keeps per scanned receipt.
export type StoredReceipt = ScanResult & { scannedAt: string };
