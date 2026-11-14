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

export function personalInflation(history: ReceiptWithMatches[], cpi: { month: string; value: number }[]): Inflation {
  const dated = history.filter(h => h.receipt.purchasedAt).sort((a, b) => a.receipt.purchasedAt!.localeCompare(b.receipt.purchasedAt!));
  if (dated.length < 2) return { ok: false, reason: "not enough history yet" };
  const early = dated[0], late = dated[dated.length - 1];
  const days = (Date.parse(late.receipt.purchasedAt!) - Date.parse(early.receipt.purchasedAt!)) / 864e5;
  if (days < CONFIG.INFLATION_MIN_DAYS) return { ok: false, reason: "not enough history yet" };
  const a = basket(early), b = basket(late);
  let then = 0, now = 0, common = 0;
  for (const [k, v] of a) {
    const w = b.get(k);
    if (!w) continue;
    then += v.price * v.qty; now += w.price * v.qty; common++;
  }
  if (common < CONFIG.INFLATION_MIN_COMMON_PRODUCTS || then <= 0) return { ok: false, reason: "not enough history yet" };
  const fromMonth = early.receipt.purchasedAt!.slice(0, 7), toMonth = late.receipt.purchasedAt!.slice(0, 7);
  const f = cpi.find(c => c.month === fromMonth), t = cpi.find(c => c.month === toMonth);
  return {
    ok: true, personal: now / then - 1, common, from: early.receipt.purchasedAt!, to: late.receipt.purchasedAt!,
    official: f && t ? { change: t.value / f.value - 1, fromMonth, toMonth } : null,
  };
}
