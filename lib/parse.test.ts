import { test } from "node:test";
import assert from "node:assert/strict";
import { sumCheck } from "./parse";
import { line } from "./testkit";

test("sum check passes when lines minus discounts plus tax equal the total", () => {
  const r = { lines: [line(1, "A", 3.99), line(2, "B", 2.5, { discount: 0.5 })], subtotal: null, tax: 0.36, total: 6.35 };
  assert.equal(sumCheck(r).passed, true);
});

test("sum check passes on the subtotal when the total includes something else", () => {
  const r = { lines: [line(1, "A", 3.99), line(2, "B", 2.01)], subtotal: 6.0, tax: null, total: 9.99 };
  assert.equal(sumCheck(r).passed, true);
});

test("sum check fails beyond two cents and passes within", () => {
  const base = { lines: [line(1, "A", 1.1), line(2, "B", 2.2)], subtotal: null, tax: 0 };
  assert.equal(sumCheck({ ...base, total: 3.32 }).passed, true);
  assert.equal(sumCheck({ ...base, total: 3.33 }).passed, false);
});

test("sum check treats discounts as positive regardless of sign", () => {
  const r = { lines: [line(1, "A", 5, { discount: -1 })], subtotal: null, tax: 0, total: 4 };
  assert.equal(sumCheck(r).passed, true);
});
