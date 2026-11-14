import { CONFIG } from "./config";
import { round2 } from "./util";

/** The guarantee counter: proven vs found savings on receipts dated in the current month. Pure. */
export type CounterReceipt = { purchasedAt: string | null; scannedAt: string; provenSaving: number; headlineSaving: number };

export function guaranteeCounter(receipts: CounterReceipt[], now: Date) {
  const month = now.toISOString().slice(0, 7);
  const inMonth = receipts.filter(r => (r.purchasedAt ?? r.scannedAt).slice(0, 7) === month);
  const proven = round2(inMonth.reduce((s, r) => s + r.provenSaving, 0));
  const found = round2(inMonth.reduce((s, r) => s + r.headlineSaving, 0));
  return { month, proven, found, threshold: CONFIG.GUARANTEE_THRESHOLD_USD, met: proven >= CONFIG.GUARANTEE_THRESHOLD_USD, receipts: inMonth.length };
}
