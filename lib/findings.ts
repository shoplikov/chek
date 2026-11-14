import { CONFIG } from "./config";
import { type Catalog, type PriceObs, type Product, specificCategory, storeLabel, usableCategories } from "./catalog";
import type { Evidence, Finding, Match, Receipt, ReceiptLine } from "./types";

/** Pure rule functions. Every amount here is computed from the receipt and reference data. */

import { money, paidPrice, round2 } from "./util";
export { money, paidPrice, round2 };

/** Paid price per 100 g / 100 ml, when the product's pack size is known. */
export const paidUnitPrice = (l: ReceiptLine, p: Product | undefined) =>
  p?.size ? (paidPrice(l) / p.size) * 100 : null;

/**
 * A line a finding may use. If the receipt's total did not check out, only lines whose own
 * printed math (qty x unit price = line total) holds are trusted.
 */
export function lineAccountable(r: Receipt, l: ReceiptLine): boolean {
  if (r.sumCheckPassed) return true;
  return l.unitPrice != null && Math.abs(l.qty * l.unitPrice - l.lineTotal) <= CONFIG.SUM_CHECK_TOLERANCE_USD;
}

const DAY = 864e5;
export const withinAge = (obsDate: string, refDate: string) =>
  Math.abs(Date.parse(obsDate) - Date.parse(refDate)) / DAY <= CONFIG.MAX_OBSERVATION_AGE_DAYS;

export const priceUrl = (id: number) => `https://prices.openfoodfacts.org/prices/${id}`;

function opEvidence(c: Catalog, o: PriceObs, unit?: string): Evidence {
  const loc = c.locations.get(o.locationId);
  return {
    sourceType: "open_prices", sourceRef: `open-prices:price:${o.id}`,
    sourceLabel: loc ? storeLabel(loc) : `Open Prices location ${o.locationId}`,
    observedAt: o.date, price: o.price, unit, url: priceUrl(o.id),
    productName: c.products.get(o.productCode)?.name,
  };
}

const STOP = new Set(["and", "with", "the", "of", "in", "a", "organic", "natural", "original", "classic", "style", "flavor", "flavored", "oz", "fl", "lb", "pack", "free"]);
/** Descriptive words of a product name, brand words removed. */
export const nameWords = (p: Product) => {
  const brand = new Set((p.brands ?? "").toLowerCase().split(/[^a-z]+/));
  return p.name.toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 3 && !STOP.has(w) && !brand.has(w))
    .map(w => w.replace(/(ies)$/, "y").replace(/(?<=[^s])s$/, ""));
};

export type RuleInput = {
  receipt: Receipt; line: ReceiptLine; match: Match | undefined;
  catalog: Catalog; storeLocationIds: number[]; refDate: string;
};

export function cheaperElsewhere({ line, match, catalog, storeLocationIds, refDate }: RuleInput): Finding | null {
  if (!match?.productCode || storeLocationIds.length === 0) return null;
  const paid = paidPrice(line);
  const best = (catalog.pricesByProduct.get(match.productCode) ?? [])
    .filter(o => !storeLocationIds.includes(o.locationId) && withinAge(o.date, refDate))
    .filter(o => o.price <= paid * (1 - CONFIG.ELSEWHERE_MIN_PCT))
    .sort((a, b) => a.price - b.price || b.date.localeCompare(a.date))[0];
  if (!best) return null;
  const saving = round2((paid - best.price) * line.qty);
  if (saving <= 0) return null;
  const ev = opEvidence(catalog, best);
  const prod = catalog.products.get(match.productCode);
  return {
    type: "cheaper_elsewhere", line: line.line, productCode: match.productCode, targetStore: ev.sourceLabel,
    paid: round2(paid), paidUnit: paidUnitPrice(line, prod), productName: prod?.name ?? null, categoryTag: prod ? specificCategory(prod) : null,
    savingOnThisReceipt: saving, evidence: ev,
    headline: `${ev.productName ?? line.rawName} was ${money(best.price)} at ${ev.sourceLabel} (you paid ${money(paid)}).`,
  };
}

export function cheaperSwap({ line, match, catalog, storeLocationIds, refDate }: RuleInput): Finding | null {
  if (!match?.productCode || storeLocationIds.length === 0) return null;
  const bought = catalog.products.get(match.productCode);
  const paidUnit = paidUnitPrice(line, bought);
  const cat = bought && specificCategory(bought);
  if (!bought || !paidUnit || !cat || usableCategories(bought).length < CONFIG.SWAP_MIN_CATEGORY_DEPTH) return null;
  const boughtWords = nameWords(bought);
  const candidates: { o: PriceObs; p: Product }[] = [];
  for (const code of catalog.productsByCategory.get(cat) ?? []) {
    if (code === bought.code) continue;
    const p = catalog.products.get(code)!;
    if (p.sizeFamily !== bought.sizeFamily || !p.size) continue;
    if (!nameWords(p).some(w => boughtWords.includes(w))) continue; // must share a word: "ice cream" with "ice cream"
    const ratio = p.size / bought.size!;
    if (ratio > CONFIG.SWAP_MAX_SIZE_RATIO || ratio < 1 / CONFIG.SWAP_MAX_SIZE_RATIO) continue;
    for (const o of catalog.pricesByProduct.get(code) ?? []) {
      if (!storeLocationIds.includes(o.locationId) || !o.unitPrice || !withinAge(o.date, refDate)) continue;
      if (o.unitPrice <= paidUnit * (1 - CONFIG.SWAP_MIN_PCT)) candidates.push({ o, p });
    }
  }
  const best = candidates.sort((a, b) => a.o.unitPrice! - b.o.unitPrice! || b.o.date.localeCompare(a.o.date))[0];
  if (!best) return null;
  // Saving: the same amount of product as bought, at the cheaper product's unit price.
  const saving = round2(((paidUnit - best.o.unitPrice!) * bought.size! / 100) * line.qty);
  if (saving <= 0) return null;
  const unit = bought.sizeFamily === "g" ? "per 100 g" : "per 100 ml";
  const ev = opEvidence(catalog, best.o, `${money(best.o.unitPrice!)} ${unit}`);
  return {
    type: "cheaper_swap", line: line.line, productCode: bought.code, targetProductCode: best.p.code,
    paid: round2(paidPrice(line)), paidUnit: paidUnit, productName: bought.name, targetName: best.p.name, categoryTag: cat,
    savingOnThisReceipt: saving, evidence: ev,
    headline: `${best.p.name} costs ${money(best.o.unitPrice!)} ${unit} at this store; you paid ${money(paidUnit)} ${unit} for ${bought.name}.`,
  };
}

/** Earlier receipt lines the user stored, with their matches. */
export type HistoryLine = { receipt: Receipt; line: ReceiptLine; productCode: string | null };

export function priceUp(input: RuleInput, history: HistoryLine[]): Finding | null {
  const { receipt, line, match } = input;
  const now = paidPrice(line);
  const sameStore = (r: Receipt) => r.store.name.trim().toLowerCase() === receipt.store.name.trim().toLowerCase();
  const prev = history
    .filter(h => h.receipt.id !== receipt.id && h.receipt.purchasedAt && receipt.purchasedAt && h.receipt.purchasedAt < receipt.purchasedAt)
    .filter(h => (match?.productCode && h.productCode === match.productCode)
      || (sameStore(h.receipt) && h.line.rawName.trim().toUpperCase() === line.rawName.trim().toUpperCase()))
    .sort((a, b) => b.receipt.purchasedAt!.localeCompare(a.receipt.purchasedAt!))[0];
  if (!prev) return null;
  const then = paidPrice(prev.line);
  if (!(then > 0) || now < then * (1 + CONFIG.UP_MIN_PCT)) return null;
  const saving = round2((now - then) * line.qty);
  if (saving <= 0) return null;
  return {
    type: "price_up", line: line.line, productCode: match?.productCode ?? null, savingOnThisReceipt: saving,
    paid: round2(now), paidUnit: null, productName: match?.productCode ? input.catalog.products.get(match.productCode)?.name ?? null : null,
    evidence: {
      sourceType: "own_receipt", sourceRef: `receipt:${prev.receipt.id}:line:${prev.line.line}`,
      sourceLabel: `Your receipt, ${prev.receipt.store.name}`, observedAt: prev.receipt.purchasedAt!, price: round2(then),
      productName: prev.line.rawName,
    },
    headline: `${line.rawName} went up from ${money(then)} to ${money(now)} since ${prev.receipt.purchasedAt}.`,
  };
}

/** How many eggs (or other counted items) a pack holds, from its quantity text. */
const countFromText = (t: string | null) => {
  const m = t?.match(/(\d+)\s*(?:ct|count|eggs?|pcs?|pack)\b/i);
  return m ? Number(m[1]) : null;
};

export function aboveUsAverage({ line, match, catalog }: RuleInput): Finding | null {
  if (!match?.productCode) return null;
  const p = catalog.products.get(match.productCode);
  if (!p) return null;
  const series = catalog.bls.prices.find(s => s.categories.some(cat => p.categories.includes(cat)));
  if (!series) return null;
  const amount = series.perUnit.family === "count" ? countFromText(p.quantityText) : p.sizeFamily === series.perUnit.family ? p.size : null;
  if (!amount) return null;
  const latest = series.months.at(-1)!;
  const paidPerUnit = (paidPrice(line) / amount) * series.perUnit.amount;
  if (paidPerUnit < latest.value * (1 + CONFIG.AVG_MIN_PCT)) return null;
  const saving = round2((paidPerUnit - latest.value) * (amount / series.perUnit.amount) * line.qty);
  if (saving <= 0) return null;
  return {
    type: "above_us_average", line: line.line, productCode: p.code, savingOnThisReceipt: saving,
    paid: round2(paidPrice(line)), paidUnit: paidUnitPrice(line, p), productName: p.name,
    evidence: {
      sourceType: "bls", sourceRef: series.id, sourceLabel: "BLS US city average",
      observedAt: latest.month, price: latest.value, unit: `per ${series.unitLabel}`,
      url: `https://data.bls.gov/timeseries/${series.id}`, productName: series.item,
    },
    headline: `You paid ${money(paidPerUnit)} per ${series.unitLabel} for ${p.name}; the US average for ${series.item.toLowerCase()} was ${money(latest.value)} (${latest.month}).`,
  };
}

/** Findings for every line, and the best one per line for the headline (no double counting). */
export function computeFindings(
  receipt: Receipt, matches: Match[], catalog: Catalog, storeLocationIds: number[], history: HistoryLine[],
): { findings: Finding[]; best: Finding[]; headlineSaving: number } {
  const refDate = receipt.purchasedAt ?? new Date().toISOString().slice(0, 10);
  const comparable = receipt.currency === "USD";
  const findings: Finding[] = [];
  for (const line of receipt.lines) {
    if (!lineAccountable(receipt, line) || !comparable || line.qty <= 0) continue;
    const match = matches.find(m => m.line === line.line && m.reason === "matched");
    const input: RuleInput = { receipt, line, match, catalog, storeLocationIds, refDate };
    for (const f of [cheaperElsewhere(input), cheaperSwap(input), priceUp(input, history), aboveUsAverage(input)]) {
      if (f && f.evidence && f.savingOnThisReceipt > 0) findings.push(f);
    }
  }
  const bestByLine = new Map<number, Finding>();
  for (const f of findings) {
    const cur = bestByLine.get(f.line);
    if (!cur || f.savingOnThisReceipt > cur.savingOnThisReceipt) bestByLine.set(f.line, f);
  }
  const best = [...bestByLine.values()].sort((a, b) => b.savingOnThisReceipt - a.savingOnThisReceipt);
  const headlineSaving = round2(best.reduce((s, f) => s + f.savingOnThisReceipt, 0));
  findings.sort((a, b) => b.savingOnThisReceipt - a.savingOnThisReceipt);
  return { findings, best, headlineSaving };
}
