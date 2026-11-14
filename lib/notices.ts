import { CONFIG } from "./config";
import { round2 } from "./findings";
import type { CheckNotice, Receipt } from "./types";

/** Things worth a second look on the receipt itself. Never added to savings. Pure. */
export function receiptNotices(r: Receipt): CheckNotice[] {
  const out: CheckNotice[] = [];
  const seen = new Map<string, number>();
  for (const l of r.lines) {
    if (l.qty !== 1) continue;
    const k = `${l.rawName.trim().toUpperCase()}|${l.lineTotal.toFixed(2)}`;
    if (seen.has(k)) out.push({ kind: "possible_double_scan", line: l.line, amountAtStake: round2(l.lineTotal - l.discount), text: `Possible double scan: ${l.rawName} appears twice at $${l.lineTotal.toFixed(2)}. Check your bag.` });
    else seen.set(k, l.line);
  }
  for (const l of r.lines) {
    if (l.unitPrice == null) continue;
    const diff = round2(l.lineTotal - l.qty * l.unitPrice);
    if (Math.abs(diff) > CONFIG.SUM_CHECK_TOLERANCE_USD) out.push({ kind: "line_math_mismatch", line: l.line, amountAtStake: Math.abs(diff), text: `${l.rawName}: ${l.qty} x $${l.unitPrice.toFixed(2)} is $${(l.qty * l.unitPrice).toFixed(2)}, but the line says $${l.lineTotal.toFixed(2)}.` });
  }
  return out;
}
