import type { ReceiptLine } from "./types";

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const money = (n: number) => `$${n.toFixed(2)}`;
/** What one unit on this line cost after discounts. */
export const paidPrice = (l: ReceiptLine) => (l.lineTotal - l.discount) / (l.qty || 1);
