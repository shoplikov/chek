import { CONFIG } from "./config";
import { paidPrice } from "./util";
import type { Receipt, Match } from "./types";

/** Personal grocery inflation from the user's own receipts, next to BLS food-at-home CPI. Pure. */

export type ReceiptWithMatches = { receipt: Receipt; matches: Match[] };
export type Inflation =
  | { ok: false; reason: string }
  | { ok: true; personal: number; common: number; from: string; to: string; official: { change: number; fromMonth: string; toMonth: string } | null };

const key = (r: Receipt, m: Match[] , line: number) => {
  const code = m.find(x => x.line === line && x.reason === "matched")?.productCode;
  const raw = r.lines.find(l => l.line === line)!.rawName.trim().toUpperCase();
  return code ? `p:${code}` : `r:${r.store.name.trim().toLowerCase()}|${raw}`;
};

function basket(x: ReceiptWithMatches) {
  const b = new Map<string, { price: number; qty: number }>();
  for (const l of x.receipt.lines) if (l.qty > 0) b.set(key(x.receipt, x.matches, l.line), { price: paidPrice(l), qty: l.qty });
  return b;
}

/**
 * Compares the earliest and latest receipts that share enough products: the widest pair that
 * is at least INFLATION_MIN_DAYS apart with INFLATION_MIN_COMMON_PRODUCTS products in common.
 */
export function personalInflation(history: ReceiptWithMatches[], cpi: { month: string; value: number }[]): Inflation {
  const dated = history.filter(h => h.receipt.purchasedAt).sort((a, b) => a.receipt.purchasedAt!.localeCompare(b.receipt.purchasedAt!));
  const day = (h: ReceiptWithMatches) => Date.parse(h.receipt.purchasedAt!) / 864e5;
  let best: { early: ReceiptWithMatches; late: ReceiptWithMatches; then: number; now: number; common: number } | null = null;
  for (let i = 0; i < dated.length; i++) {
    for (let j = dated.length - 1; j > i; j--) {
      const early = dated[i], late = dated[j];
      if (day(late) - day(early) < CONFIG.INFLATION_MIN_DAYS) break;
      if (best && day(late) - day(early) <= day(best.late) - day(best.early)) break;
      const a = basket(early), b = basket(late);
      let then = 0, now = 0, common = 0;
      for (const [k, v] of a) {
        const w = b.get(k);
        if (!w) continue;
        then += v.price * v.qty; now += w.price * v.qty; common++;
      }
      if (common >= CONFIG.INFLATION_MIN_COMMON_PRODUCTS && then > 0) { best = { early, late, then, now, common }; break; }
    }
  }
  if (!best) return { ok: false, reason: "not enough history yet" };
  const from = best.early.receipt.purchasedAt!, to = best.late.receipt.purchasedAt!;
  const fromMonth = from.slice(0, 7), toMonth = to.slice(0, 7);
  const f = cpi.find(c => c.month === fromMonth), t = cpi.find(c => c.month === toMonth);
  return {
    ok: true, personal: best.now / best.then - 1, common: best.common, from, to,
    official: f && t && fromMonth !== toMonth ? { change: t.value / f.value - 1, fromMonth, toMonth } : null,
  };
}
