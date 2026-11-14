import { test } from "node:test";
import assert from "node:assert/strict";
import { abbreviates, applyGuards, candidates, priceGuardOk } from "./match";
import { catalog, line, obs, product } from "./testkit";

const c = catalog(
  [product("A", { name: "Organic Baby Spinach", brands: "O Organics" }), product("B", { name: "Whole Milk", brands: "Lucerne" }), product("C", { name: "Spinach Dip", brands: "Dips Co" })],
  [obs("A", 1, 4.0), obs("B", 1, 5.0), obs("C", 2, 3.0)],
);

test("abbreviations are recognised", () => {
  assert.ok(abbreviates("spnch", "spinach"));
  assert.ok(!abbreviates("pnch", "spinach"));
});

test("candidate search finds the product from an abbreviated name and prefers the receipt's store", () => {
  const list = candidates(c, "O ORG BBY SPNCH", [1]);
  assert.equal(list[0].code, "A");
});

test("guards: choice must be a listed candidate, confidence at least 0.8, price within 3x", () => {
  const lines = [line(1, "BBY SPNCH", 4.5), line(2, "BBY SPNCH", 4.5), line(3, "BBY SPNCH", 40), line(4, "BBY SPNCH", 4.5)];
  const cands = new Map([[1, [c.products.get("A")!]], [2, [c.products.get("A")!]], [3, [c.products.get("A")!]], [4, [c.products.get("A")!]]]);
  const m = applyGuards(c, lines, cands, [
    { line: 1, choice: 1, confidence: 0.9 },
    { line: 2, choice: 1, confidence: 0.79 },
    { line: 3, choice: 1, confidence: 0.95 },
    { line: 4, choice: 7, confidence: 0.99 },
  ]);
  assert.deepEqual(m.map(x => x.reason), ["matched", "low_confidence", "price_guard", "no_candidate"]);
  assert.equal(m[0].productCode, "A");
  assert.ok(m.slice(1).every(x => x.productCode === null));
});

test("price guard accepts within 3x of any reference price", () => {
  assert.ok(priceGuardOk(c, line(1, "X", 11.9), "A"));
  assert.ok(!priceGuardOk(c, line(1, "X", 12.1), "A"));
  assert.ok(!priceGuardOk(c, line(1, "X", 1.3), "A"));
});
