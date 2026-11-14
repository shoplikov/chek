import type { Product } from "./catalog";
import { paidPrice, round2 } from "./util";
import type { Evidence, Match, Pledge, ProvenItem, Receipt, ReceiptLine } from "./types";

/**
 * Proven savings: what the user actually saved, from their own receipts only.
 * A pledge made on one receipt is checked against a later receipt. Pure.
 */

/** "SAFEWAY #1234" and "Safeway" are the same chain. */
export const chainKey = (name: string) =>
  name.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]+/g, " ").trim().split(/\s+/)[0] ?? "";

const ownEvidence = (r: { id: string; store: string; date: string }, line: number, price: number, name: string, unit?: string): Evidence => ({
  sourceType: "own_receipt", sourceRef: `receipt:${r.id}:line:${line}`, sourceLabel: `Your receipt, ${r.store}`,
  observedAt: r.date, price: round2(price), unit, productName: name,
});

export function verifyPledges(
  pledges: Pledge[], receipt: Receipt, matches: Match[], product: (code: string) => Product | undefined,
  receiptDate = receipt.purchasedAt,
): ProvenItem[] {
  if (!receiptDate) return [];
  const items: ProvenItem[] = [];
  const lineFor = (code: string): ReceiptLine | undefined => {
    const m = matches.find(x => x.productCode === code && x.reason === "matched");
    return m && receipt.lines.find(l => l.line === m.line);
  };
  const sameChain = (a: string, b: string) => chainKey(a) === chainKey(b);
  const nowRef = { id: receipt.id, store: receipt.store.name, date: receiptDate };

  for (const p of pledges) {
    if (receiptDate <= p.createdAt.slice(0, 10)) continue; // only receipts after the pledge
    const thenRef = { id: p.fromReceiptId, store: p.fromStore, date: p.createdAt.slice(0, 10) };

    if (p.kind === "cheaper_swap") {
      if (!sameChain(receipt.store.name, p.fromStore)) continue;
      const line = lineFor(p.targetProductCode);
      if (!line || line.qty <= 0) continue;
      const target = product(p.targetProductCode), original = product(p.productCode);
      const nowPaid = paidPrice(line);
      let diff: number | null = null; let unit: string | undefined; let thenShown = p.paidPrice, nowShown = nowPaid;
      if (p.paidUnitPrice != null && target?.size && target.sizeFamily && (!original || original.sizeFamily === target.sizeFamily)) {
        const nowUnit = (nowPaid / target.size) * 100;
        diff = (p.paidUnitPrice - nowUnit) * (target.size / 100) * line.qty; // per 100 g/ml x amount bought now
        unit = target.sizeFamily === "g" ? "per 100 g" : "per 100 ml";
        thenShown = p.paidUnitPrice; nowShown = nowUnit;
      } else if (original?.size && target?.size && original.size === target.size) {
        diff = (p.paidPrice - nowPaid) * line.qty; // same pack size: compare pack prices
      }
      if (diff == null) continue; // unknown unit price and different packs: do not guess
      items.push(toItem(p, receipt, line, diff, ownEvidence(thenRef, 0, thenShown, p.label, unit), ownEvidence(nowRef, line.line, nowShown, line.rawName, unit)));
    } else {
      if (sameChain(receipt.store.name, p.fromStore)) continue;
      const line = lineFor(p.productCode);
      if (!line || line.qty <= 0) continue;
      const nowPaid = paidPrice(line);
      const diff = (p.paidPrice - nowPaid) * line.qty;
      items.push(toItem(p, receipt, line, diff, ownEvidence(thenRef, 0, p.paidPrice, p.label), ownEvidence(nowRef, line.line, nowPaid, line.rawName)));
    }
  }
  return items;
}

function toItem(p: Pledge, r: Receipt, line: ReceiptLine, diff: number, then: Evidence, now: Evidence): ProvenItem {
  const d = round2(diff);
  return {
    pledgeId: p.id, receiptId: r.id, line: line.line, label: p.label,
    status: d > 0 ? "saved" : "paid_more", saving: d > 0 ? d : 0, extraPaid: d < 0 ? -d : 0, then, now,
  };
}

export const provenTotal = (items: ProvenItem[]) => round2(items.reduce((s, i) => s + i.saving, 0));
