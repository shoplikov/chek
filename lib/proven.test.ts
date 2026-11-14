import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyPledges } from "./proven";
import { line, matched, product, receipt } from "./testkit";
import type { Pledge } from "./types";

const products = new Map([
  ["A", product("A", { name: "Brand Flakes", size: 500 })],
  ["B", product("B", { name: "Store Flakes", size: 500 })],
  ["C", product("C", { name: "Other Pack", size: 700 })],
  ["N", product("N", { name: "No Size", size: null, sizeFamily: null })],
]);
const get = (c: string) => products.get(c);

const swap = (over: Partial<Pledge> = {}): Pledge => ({
  id: "p1", createdAt: "2026-11-01", fromReceiptId: "r0", isSample: false, kind: "cheaper_swap",
  productCode: "A", targetProductCode: "B", categoryTag: null, fromStore: "Safeway", targetStore: null,
  paidPrice: 5.0, paidUnitPrice: 1.0, expectedSaving: 2.5, label: "Switch to Store Flakes", ...over,
});

test("swap pledge proven: (unit price then - now) x amount bought now", () => {
  const r = receipt([line(1, "STORE FLKS", 3.0, { qty: 2, unitPrice: 1.5 })], { id: "r1", purchasedAt: "2026-11-08", store: { name: "SAFEWAY #1234", city: null, state: null } });
  const items = verifyPledges([swap()], r, [matched(1, "B")], get);
  assert.equal(items.length, 1);
  // then 1.00/100 g, now 1.50/500 g = 0.30/100 g; 500 g x 2 bought -> (0.70 x 5) x 2 = 7.00
  assert.equal(items[0].status, "saved");
  assert.equal(items[0].saving, 7.0);
  assert.equal(items[0].then.sourceType, "own_receipt");
  assert.equal(items[0].now.sourceType, "own_receipt");
});

test("elsewhere pledge proven at a different store: (paid then - paid now) x qty", () => {
  const p = swap({ kind: "cheaper_elsewhere", targetProductCode: "A", targetStore: "Sprouts Farmers Market, Sunnyvale", paidUnitPrice: null });
  const r = receipt([line(1, "BRND FLKS", 4.0)], { purchasedAt: "2026-11-08", store: { name: "Sprouts Farmers Market", city: "Sunnyvale", state: "CA" } });
  const items = verifyPledges([p], r, [matched(1, "A")], get);
  assert.equal(items[0].saving, 1.0);
  assert.equal(verifyPledges([p], { ...r, store: { name: "Safeway", city: null, state: null } }, [matched(1, "A")], get).length, 0, "same store does not prove an elsewhere pledge");
});

test("paying more gives status paid_more and zero saving", () => {
  const r = receipt([line(1, "STORE FLKS", 6.0)], { purchasedAt: "2026-11-08" });
  const [item] = verifyPledges([swap()], r, [matched(1, "B")], get);
  assert.equal(item.status, "paid_more");
  assert.equal(item.saving, 0);
  assert.equal(item.extraPaid, 1.0);
});

test("unknown unit price and different pack sizes give nothing", () => {
  const p = swap({ targetProductCode: "C", paidUnitPrice: null });
  const r = receipt([line(1, "OTHER", 3.0)], { purchasedAt: "2026-11-08" });
  assert.equal(verifyPledges([p], r, [matched(1, "C")], get).length, 0);
  const p2 = swap({ targetProductCode: "N", paidUnitPrice: 1.0 });
  assert.equal(verifyPledges([p2], r, [matched(1, "N")], get).length, 0);
});

test("receipts on or before the pledge date are ignored", () => {
  const r = receipt([line(1, "STORE FLKS", 3.0)], { purchasedAt: "2026-11-01" });
  assert.equal(verifyPledges([swap()], r, [matched(1, "B")], get).length, 0);
});

test("one item per pledge per receipt, even if the product appears twice", () => {
  const r = receipt([line(1, "STORE FLKS", 3.0), line(2, "STORE FLKS", 3.0)], { purchasedAt: "2026-11-08" });
  assert.equal(verifyPledges([swap()], r, [matched(1, "B"), matched(2, "B")], get).length, 1);
});

test("a receipt without the product yields nothing", () => {
  const r = receipt([line(1, "MILK", 3.0)], { purchasedAt: "2026-11-08" });
  assert.equal(verifyPledges([swap()], r, [{ line: 1, productCode: null, confidence: 0, reason: "no_candidate" }], get).length, 0);
});
