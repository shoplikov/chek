/**
 * npm run eval:match — matching precision and recall on the sample receipts, where the true
 * product per line is known from the generator. Parses each image live, then matches.
 * A match counts as correct if it is the true code, or a product with the same name, brand and
 * size (Open Food Facts sometimes lists one product under two barcodes).
 */
import { readFileSync } from "node:fs";
import { getCatalog, resolveStore } from "../lib/catalog";
import { matchReceipt } from "../lib/match";
import { parseReceipt } from "../lib/parse";
import { listSamples } from "../lib/samples";

const c = getCatalog();
const same = (a: string, b: string) => {
  if (a === b) return true;
  const x = c.products.get(a), y = c.products.get(b);
  return !!x && !!y && x.name.toLowerCase() === y.name.toLowerCase() && x.brands === y.brands && x.size === y.size;
};
let tp = 0, fp = 0, truthCount = 0;
const wrong: string[] = [];
const rows: Record<string, string | number>[] = [];
for (const s of listSamples()) {
  const r = await parseReceipt(readFileSync(`public/samples/${s.file}`).toString("base64"), "image/jpeg", true);
  const m = await matchReceipt(c, r, resolveStore(c, r.store).map(l => l.id));
  let stp = 0, sfp = 0;
  const st = s.truth.filter(t => t.productCode).length;
  for (const t of s.truth) {
    const got = m.find(x => x.line === t.line);
    if (!got?.productCode) continue;
    if (t.productCode && same(got.productCode, t.productCode)) stp++;
    else {
      sfp++;
      const truthName = t.productCode ? c.products.get(t.productCode)?.name : "none";
      wrong.push(`${s.id} line ${t.line} "${r.lines[t.line - 1]?.rawName}": got ${c.products.get(got.productCode)?.name} (${got.productCode}), truth ${truthName} (${t.productCode})`);
    }
  }
  tp += stp; fp += sfp; truthCount += st;
  rows.push({ sample: s.id, lines: s.truth.length, truthProducts: st, matched: stp + sfp, correct: stp, wrong: sfp });
}
console.table(rows);
const precision = tp / Math.max(1, tp + fp), recall = tp / Math.max(1, truthCount);
console.log(`precision ${(precision * 100).toFixed(1)}% (wrong matches ${(100 - precision * 100).toFixed(1)}%), recall ${(recall * 100).toFixed(1)}%`);
for (const w of wrong) console.log("  wrong:", w);
