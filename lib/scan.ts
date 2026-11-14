import { getCatalog, resolveStore } from "./catalog";
import { computeFindings, type HistoryLine } from "./findings";
import { matchReceipt } from "./match";
import { receiptNotices } from "./notices";
import { verifyPledges, provenTotal } from "./proven";
import type { Match, Pledge, Receipt, ScanResult } from "./types";

export type HistoryItem = { receipt: Receipt; matches: Match[] };

/** Receipt (already parsed) -> matches -> findings -> proven savings. */
export async function analyse(receipt: Receipt, history: HistoryItem[], pledges: Pledge[], matchesIn?: Match[]): Promise<ScanResult> {
  const c = getCatalog();
  const locations = receipt.currency === "USD" ? resolveStore(c, receipt.store) : [];
  const storeLocationIds = locations.map(l => l.id);
  const matches = matchesIn ?? await matchReceipt(c, receipt, storeLocationIds);
  const historyLines: HistoryLine[] = history.flatMap(h => h.receipt.lines.map(line => ({
    receipt: h.receipt, line, productCode: h.matches.find(m => m.line === line.line && m.reason === "matched")?.productCode ?? null,
  })));
  const { best, headlineSaving } = computeFindings(receipt, matches, c, storeLocationIds, historyLines);
  const today = new Date().toISOString().slice(0, 10);
  const proven = verifyPledges(pledges, receipt, matches, code => c.products.get(code), receipt.purchasedAt ?? today);
  return {
    receipt, matches, findings: best, headlineSaving,
    coverage: { lines: receipt.lines.length, matched: matches.filter(m => m.reason === "matched").length, withFinding: best.length },
    proven, provenSaving: provenTotal(proven), notices: receiptNotices(receipt),
    storeKnown: storeLocationIds.length > 0, storeLocationIds,
  };
}
