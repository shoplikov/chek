import { test } from "node:test";
import assert from "node:assert/strict";
import { aboveUsAverage, cheaperElsewhere, cheaperSwap, computeFindings, lineAccountable, priceUp, type RuleInput } from "./findings";
import { catalog, line, matched, obs, product, receipt } from "./testkit";

const cereal = (code: string, name: string, size = 500) => product(code, { name, size, quantityText: `${size} g`, categories: ["en:plant-based-foods", "en:breakfasts", "en:breakfast-cereals", "en:corn-flakes"] });
const input = (c: ReturnType<typeof catalog>, l: ReturnType<typeof line>, code: string | null, storeIds = [1]): RuleInput => ({
  receipt: receipt([l]), line: l, match: code ? matched(l.line, code) : undefined, catalog: c, storeLocationIds: storeIds, refDate: "2026-11-01",
});

test("cheaper_elsewhere fires at 5% cheaper at another store, with that observation as evidence", () => {
  const c = catalog([cereal("A", "Corn Flakes")], [obs("A", 1, 4.0), obs("A", 2, 3.8)]);
  const f = cheaperElsewhere(input(c, line(1, "CORN FLKS", 4.0), "A"));
  assert.ok(f);
  assert.equal(f.savingOnThisReceipt, 0.2);
  assert.equal(f.evidence.sourceType, "open_prices");
  assert.equal(f.evidence.price, 3.8);
  assert.equal(f.evidence.sourceLabel, "Sprouts Farmers Market, Sunnyvale");
});

test("cheaper_elsewhere does not fire just under the threshold, or for the same store, or for old observations", () => {
  assert.equal(cheaperElsewhere(input(catalog([cereal("A", "x")], [obs("A", 2, 3.81)]), line(1, "X", 4.0), "A")), null);
  assert.equal(cheaperElsewhere(input(catalog([cereal("A", "x")], [obs("A", 1, 2.0)]), line(1, "X", 4.0), "A")), null);
  assert.equal(cheaperElsewhere(input(catalog([cereal("A", "x")], [obs("A", 2, 2.0, "2026-01-01")]), line(1, "X", 4.0), "A")), null);
});

test("no comparisons with stores when the receipt's store is unknown", () => {
  const c = catalog([cereal("A", "x")], [obs("A", 2, 1.0)]);
  assert.equal(cheaperElsewhere(input(c, line(1, "X", 4.0), "A", [])), null);
});

test("cheaper_swap: same store, same specific category, a shared name word, 15% lower unit price", () => {
  const c = catalog([cereal("A", "Honey Corn Flakes"), cereal("B", "Corn Flakes Cereal", 600)], [obs("A", 1, 5.0), obs("B", 1, 3.0, "2026-11-01", 600)]);
  const f = cheaperSwap(input(c, line(1, "HNY CRN FLKS", 5.0), "A"));
  assert.ok(f);
  assert.equal(f.targetProductCode, "B");
  // paid 1.00/100 g, swap 0.50/100 g, 500 g bought -> 2.50
  assert.equal(f.savingOnThisReceipt, 2.5);
  assert.equal(f.evidence.price, 3.0);
});

test("cheaper_swap does not fire at 14% cheaper, or across unrelated names", () => {
  const c1 = catalog([cereal("A", "Corn Flakes"), cereal("B", "Corn Flakes Store")], [obs("A", 1, 5.0), obs("B", 1, 4.3)]);
  assert.equal(cheaperSwap(input(c1, line(1, "X", 5.0), "A")), null);
  const c2 = catalog([cereal("A", "Corn Flakes"), cereal("B", "Granola Bites")], [obs("A", 1, 5.0), obs("B", 1, 1.0)]);
  assert.equal(cheaperSwap(input(c2, line(1, "X", 5.0), "A")), null);
});

test("price_up uses the user's own earlier receipt as evidence", () => {
  const c = catalog([cereal("A", "x")], []);
  const now = line(1, "CORN FLKS", 4.4);
  const prev = receipt([line(1, "CORN FLKS", 4.0)], { id: "old", purchasedAt: "2026-10-01" });
  const f = priceUp({ ...input(c, now, "A"), receipt: receipt([now]) }, [{ receipt: prev, line: prev.lines[0], productCode: "A" }]);
  assert.ok(f);
  assert.equal(f.savingOnThisReceipt, 0.4);
  assert.equal(f.evidence.sourceType, "own_receipt");
  assert.equal(f.evidence.price, 4.0);
  const flat = priceUp({ ...input(c, line(1, "CORN FLKS", 4.19), "A") }, [{ receipt: prev, line: prev.lines[0], productCode: "A" }]);
  assert.equal(flat, null, "4.75% is under the 5% threshold");
});

test("above_us_average compares per BLS unit and labels the source BLS", () => {
  const eggs = product("E", { name: "Large Eggs", size: null, sizeFamily: null, quantityText: "12 eggs", categories: ["en:farming-products", "en:eggs", "en:chicken-eggs"] });
  const c = catalog([eggs], []);
  const f = aboveUsAverage(input(c, line(1, "LG EGGS", 3.0), "E"));
  assert.ok(f);
  assert.equal(f.evidence.sourceType, "bls");
  assert.equal(f.savingOnThisReceipt, 0.68);
  assert.equal(aboveUsAverage(input(c, line(1, "LG EGGS", 2.5), "E")), null, "7.8% is under the 10% threshold");
});

test("no double counting: one finding per line, the largest; headline is their sum", () => {
  const c = catalog(
    [cereal("A", "Honey Corn Flakes"), cereal("B", "Corn Flakes Cereal"), cereal("C", "Bran Flakes")],
    [obs("A", 1, 5.0), obs("A", 2, 4.0), obs("B", 1, 2.0), obs("C", 1, 3.0), obs("C", 2, 2.0)],
  );
  const r = receipt([line(1, "HNY CRN FLKS", 5.0), line(2, "BRAN FLKS", 3.0)]);
  const { best, headlineSaving } = computeFindings(r, [matched(1, "A"), matched(2, "C")], c, [1], []);
  assert.equal(best.length, 2);
  assert.equal(best[0].type, "cheaper_swap"); // 3.00 beats elsewhere 1.00 on line 1
  assert.equal(headlineSaving, Math.round(best.reduce((s, f) => s + f.savingOnThisReceipt, 0) * 100) / 100);
  assert.equal(headlineSaving, 4.0);
});

test("every finding carries evidence; none for unmatched lines or non-USD receipts", () => {
  const c = catalog([cereal("A", "x")], [obs("A", 2, 1.0)]);
  const r = receipt([line(1, "X", 4.0), line(2, "MYSTERY", 9.0)]);
  const { findings } = computeFindings(r, [matched(1, "A"), { line: 2, productCode: null, confidence: 0.3, reason: "low_confidence" }], c, [1], []);
  assert.ok(findings.length > 0 && findings.every(f => f.evidence && f.evidence.sourceRef));
  assert.ok(findings.every(f => f.line === 1));
  assert.equal(computeFindings({ ...r, currency: "EUR" }, [matched(1, "A")], c, [1], []).findings.length, 0);
});

test("when the sum check fails only lines with consistent printed math are used", () => {
  const r = receipt([line(1, "A", 4.0), line(2, "B", 2.0, { qty: 2, unitPrice: 1.0 })], { sumCheckPassed: false });
  assert.equal(lineAccountable(r, r.lines[0]), false);
  assert.equal(lineAccountable(r, r.lines[1]), true);
});
