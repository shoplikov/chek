import { test } from "node:test";
import assert from "node:assert/strict";
import { guaranteeCounter } from "./guarantee";
import { personalInflation } from "./inflation";
import { receiptNotices } from "./notices";
import { line, matched, receipt } from "./testkit";

const cpi = [{ month: "2026-09", value: 300 }, { month: "2026-10", value: 303 }];

test("personal inflation: Laspeyres over common products, with the BLS change for the same months", () => {
  const early = receipt([line(1, "A", 2), line(2, "B", 3), line(3, "C", 5)], { id: "e", purchasedAt: "2026-09-10" });
  const late = receipt([line(1, "A", 2.2), line(2, "B", 3.3), line(3, "C", 5.5)], { id: "l", purchasedAt: "2026-10-10" });
  const m = [matched(1, "a"), matched(2, "b"), matched(3, "c")];
  const inf = personalInflation([{ receipt: early, matches: m }, { receipt: late, matches: m }], cpi);
  assert.ok(inf.ok);
  assert.equal(Math.round(inf.personal * 1000) / 1000, 0.1);
  assert.equal(Math.round(inf.official!.change * 1000) / 1000, 0.01);
});

test("personal inflation needs 3 common products and 14 days", () => {
  const a = receipt([line(1, "A", 2), line(2, "B", 3)], { id: "e", purchasedAt: "2026-09-10" });
  const b = receipt([line(1, "A", 2.2), line(2, "B", 3.3)], { id: "l", purchasedAt: "2026-10-10" });
  const m = [matched(1, "a"), matched(2, "b")];
  assert.equal(personalInflation([{ receipt: a, matches: m }, { receipt: b, matches: m }], cpi).ok, false);
  const c = receipt(a.lines.concat(line(3, "C", 1)), { id: "x", purchasedAt: "2026-09-10" });
  const d = receipt(b.lines.concat(line(3, "C", 1)), { id: "y", purchasedAt: "2026-09-20" });
  const m3 = [...m, matched(3, "c")];
  assert.equal(personalInflation([{ receipt: c, matches: m3 }, { receipt: d, matches: m3 }], cpi).ok, false);
});

test("guarantee counter sums proven and found savings for this calendar month only", () => {
  const now = new Date("2026-11-15T12:00:00Z");
  const g = guaranteeCounter([
    { purchasedAt: "2026-11-02", scannedAt: "2026-11-02", provenSaving: 5, headlineSaving: 9 },
    { purchasedAt: "2026-11-09", scannedAt: "2026-11-09", provenSaving: 3.5, headlineSaving: 4 },
    { purchasedAt: "2026-10-30", scannedAt: "2026-11-01", provenSaving: 100, headlineSaving: 100 },
  ], now);
  assert.equal(g.proven, 8.5);
  assert.equal(g.found, 13);
  assert.equal(g.met, false);
});

test("notices flag double scans and line math, and carry the amount at stake", () => {
  const r = receipt([line(1, "MILK", 3.99), line(2, "MILK", 3.99), line(3, "EGGS", 5.0, { qty: 2, unitPrice: 2.0 })]);
  const n = receiptNotices(r);
  assert.equal(n.filter(x => x.kind === "possible_double_scan").length, 1);
  assert.equal(n.find(x => x.kind === "line_math_mismatch")!.amountAtStake, 1.0);
});
