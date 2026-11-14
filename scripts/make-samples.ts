/**
 * Builds the SAMPLE receipts (PNG images in public/samples/) and the DEMO history
 * (data/demo-history.json) from the real reference data in data/.
 *
 * What is real: every line price is an Open Prices observation for that product at that
 * store (the demo history moves those prices week to week, see `weekPrice`).
 * What is ours: which products are on each receipt, quantities, dates, and the layout.
 * Product codes are never printed; the app has to read and match the image like any upload.
 *
 * Run: npx tsx scripts/make-samples.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { getCatalog, storeLabel, type PriceObs, type Product } from "../lib/catalog";
import { cheaperSwap, withinAge } from "../lib/findings";
import type { Pledge, Receipt, ReceiptLine } from "../lib/types";

const c = getCatalog();
const TAX_RATE_MV = 0.09125; // Mountain View / Sunnyvale / Los Altos combined sales tax rate

// ---------- receipt text helpers ----------

/** Deterministic receipt-style name: upper case, long words lose inner vowels, about 18 chars. */
export function receiptName(p: Product): string {
  const brand = (p.brands ?? "").split(",")[0].replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/)[0] ?? "";
  const words = p.name.replace(/[^A-Za-z0-9% ]/g, " ").split(/\s+/).filter(Boolean);
  const abbr = (w: string) => (w.length > 5 ? (w[0] + w.slice(1).replace(/[AEIOUaeiou]/g, "")).slice(0, 6) : w);
  const nameHasBrand = brand && words.some(w => w.toLowerCase() === brand.toLowerCase());
  const parts = [...(brand && !nameHasBrand && brand.length <= 9 ? [brand] : []), ...words].map(abbr);
  let out = parts.join(" ").toUpperCase();
  if (out.length > 18) out = out.slice(0, 18).trim();
  return out;
}

const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
const r2 = (n: number) => Math.round(n * 100) / 100;

function obsAt(code: string, locationId: number, refDate: string): PriceObs {
  const o = (c.pricesByProduct.get(code) ?? []).find(x => x.locationId === locationId);
  if (!o) throw new Error(`no price for ${code} at ${locationId}`);
  if (!withinAge(o.date, refDate)) console.warn(`  note: ${code} observation ${o.date} is outside the age window for ${refDate}`);
  return o;
}

type Item = { code: string; qty?: number; price?: number };
type Truth = { line: number; productCode: string | null };

function buildReceipt(id: string, store: { name: string; city: string; state: string }, date: string, locationId: number | null, items: Item[], opts: { bagFee?: boolean; isSample?: boolean } = {}) {
  const lines: ReceiptLine[] = []; const truth: Truth[] = [];
  for (const it of items) {
    const p = c.products.get(it.code)!;
    const price = it.price ?? obsAt(it.code, locationId!, date).price;
    const qty = it.qty ?? 1;
    const taxable = p.categories.some(t => /sodas|carbonated|energy-drinks/.test(t));
    lines.push({ line: lines.length + 1, rawName: receiptName(p), qty, unitPrice: qty > 1 ? price : null, lineTotal: r2(price * qty), discount: 0, taxable });
    truth.push({ line: lines.length, productCode: it.code });
  }
  if (opts.bagFee) { lines.push({ line: lines.length + 1, rawName: "CA BAG FEE", qty: 1, unitPrice: null, lineTotal: 0.1, discount: 0, taxable: false }); truth.push({ line: lines.length, productCode: null }); }
  const subtotal = r2(lines.reduce((s, l) => s + l.lineTotal, 0));
  const tax = r2(lines.filter(l => l.taxable).reduce((s, l) => s + l.lineTotal, 0) * TAX_RATE_MV);
  const receipt: Receipt = {
    id, store, purchasedAt: date, currency: "USD", lines, subtotal, tax, total: r2(subtotal + tax),
    sumCheckPassed: true, isSample: opts.isSample ?? true,
  };
  return { receipt, truth };
}

// ---------- rendering ----------

function receiptSvg(r: Receipt, address: string): string {
  const W = 576, lh = 30, pad = 28; const rows: { t: string; right?: string; center?: boolean; bold?: boolean }[] = [];
  rows.push({ t: r.store.name.toUpperCase(), center: true, bold: true });
  rows.push({ t: address.toUpperCase(), center: true });
  rows.push({ t: `${r.store.city?.toUpperCase()}, ${r.store.state}`, center: true });
  rows.push({ t: "*** SAMPLE RECEIPT ***", center: true, bold: true });
  rows.push({ t: `DATE ${r.purchasedAt!.slice(5, 7)}/${r.purchasedAt!.slice(8, 10)}/${r.purchasedAt!.slice(0, 4)}   ${String(8 + (hash(r.id) % 10)).padStart(2, "0")}:${String(hash(r.id) % 60).padStart(2, "0")}` });
  rows.push({ t: "-".repeat(38) });
  for (const l of r.lines) {
    if (l.qty > 1) { rows.push({ t: l.rawName, right: "" }); rows.push({ t: `  ${l.qty} @ ${l.unitPrice!.toFixed(2)}`, right: `${l.lineTotal.toFixed(2)}${l.taxable ? " T" : ""}` }); }
    else rows.push({ t: l.rawName, right: `${l.lineTotal.toFixed(2)}${l.taxable ? " T" : ""}` });
  }
  rows.push({ t: "-".repeat(38) });
  rows.push({ t: "SUBTOTAL", right: r.subtotal!.toFixed(2) });
  rows.push({ t: "TAX", right: r.tax!.toFixed(2) });
  rows.push({ t: "**** BALANCE", right: r.total.toFixed(2), bold: true });
  rows.push({ t: `ITEMS ${r.lines.length}` });
  rows.push({ t: "" });
  rows.push({ t: "THANK YOU FOR SHOPPING", center: true });
  rows.push({ t: "SAMPLE - NOT A REAL PURCHASE", center: true });
  const H = pad * 2 + rows.length * lh;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const text = rows.map((row, i) => {
    const y = pad + (i + 1) * lh - 8; const w = row.bold ? "bold" : "normal";
    if (row.center) return `<text x="${W / 2}" y="${y}" text-anchor="middle" font-weight="${w}">${esc(row.t)}</text>`;
    return `<text x="${pad}" y="${y}" font-weight="${w}">${esc(row.t)}</text>` + (row.right ? `<text x="${W - pad}" y="${y}" text-anchor="end" font-weight="${w}">${esc(row.right)}</text>` : "");
  }).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#fbfaf6"/><g font-family="DejaVu Sans Mono, Liberation Mono, monospace" font-size="21" fill="#222">${text}</g></svg>`;
}

async function render(r: Receipt, address: string, file: string) {
  // Slight rotation and grey background, so the vision model sees something photo-like.
  const png = await sharp(Buffer.from(receiptSvg(r, address))).png().toBuffer();
  const meta = await sharp(png).metadata();
  await sharp({ create: { width: meta.width! + 80, height: meta.height! + 80, channels: 3, background: "#8a8f96" } })
    .composite([{ input: await sharp(png).rotate(-1.2, { background: "#8a8f96" }).toBuffer(), left: 30, top: 30 }])
    .jpeg({ quality: 88 }).toFile(file);
}

// ---------- the samples ----------

const SAFEWAY_MV = 3998;
const MV = { name: "Safeway", city: "Mountain View", state: "CA" };

// Week 1 basket at Safeway Mountain View. Chosen so the live engine finds swaps, cheaper
// stores and no-saving lines alike; which ones it finds is computed at scan time.
const WEEK1: Item[] = [
  { code: "0025500304014" },            // Folgers Classic Roast 9.6 oz
  { code: "0031200029317" },            // Ocean Spray Craisins 20 oz
  { code: "0041129077825" },            // Classico Roasted Garlic sauce
  { code: "0013562000043" },            // Annie's shells & white cheddar
  { code: "0041390000829" },            // Kikkoman soy sauce 10 fl oz
  { code: "0036192122152" },            // Santa Cruz organic lemon juice
  { code: "0762111206251" },            // Starbucks Breakfast Blend
  { code: "0025317775304" },            // Applegate beef hot dogs
  { code: "0027000390054", qty: 2 },    // Hunt's tomato sauce 8 oz
  { code: "0009542031695" },            // Lindt 78%
  { code: "0028400200684" },            // Lay's Honey BBQ
  { code: "0021000658862" },            // Kraft Deluxe
  { code: "0024600010030" },            // Morton iodized salt
  { code: "0038000222658" },            // Pop-Tarts
];
const SWAPPED_IN_WEEK2 = ["0025500304014", "0031200029317", "0041129077825"];

/** The cheaper product the live engine suggests for a Week 1 line (same rule code as the app). */
function engineSwapTarget(code: string, refDate: string): Item {
  const o = obsAt(code, SAFEWAY_MV, refDate);
  const line: ReceiptLine = { line: 1, rawName: "", qty: 1, unitPrice: null, lineTotal: o.price, discount: 0, taxable: null };
  const f = cheaperSwap({ receipt: {} as Receipt, line, match: { line: 1, productCode: code, confidence: 1, reason: "matched" }, catalog: c, storeLocationIds: [SAFEWAY_MV], refDate });
  if (!f?.targetProductCode) throw new Error(`no swap for ${code}`);
  return { code: f.targetProductCode, price: f.evidence.price };
}

/** Pick lines for another store from its own observations: a few with savings, the rest plain. Deterministic. */
function autoBasket(locationId: number, refDate: string, n: number): Item[] {
  const obs = (c.pricesByLocation.get(locationId) ?? [])
    .filter(o => withinAge(o.date, refDate))
    .map(o => ({ o, p: c.products.get(o.productCode)! }))
    .filter(({ p }) => p.size && /^[\x20-\x7e]+$/.test(p.name) && p.name.length <= 40 && p.brands)
    .sort((a, b) => hash(a.p.code) - hash(b.p.code));
  const seen = new Set<string>(); const out: Item[] = [];
  for (const { p } of obs) {
    const nm = receiptName(p);
    if (seen.has(nm)) continue;
    seen.add(nm); out.push({ code: p.code });
    if (out.length >= n) break;
  }
  return out;
}

async function main() {
  mkdirSync("public/samples", { recursive: true });
  const samples: { id: string; title: string; subtitle: string; file: string; store: string; total: number; truth: Truth[] }[] = [];

  const add = async (id: string, title: string, subtitle: string, built: ReturnType<typeof buildReceipt>, address: string) => {
    const file = `${id}.jpg`;
    await render(built.receipt, address, `public/samples/${file}`);
    samples.push({ id, title, subtitle, file, store: `${built.receipt.store.name}, ${built.receipt.store.city}`, total: built.receipt.total, truth: built.truth });
    console.log(id, built.receipt.lines.length, "lines, total", built.receipt.total);
  };

  const w1 = buildReceipt("sample-week1", MV, "2026-11-01", SAFEWAY_MV, WEEK1, { bagFee: true });
  await add("week1", "Week 1", "Safeway, Mountain View · 15 lines", w1, "570 N Shoreline Blvd");

  const week2Items = WEEK1.map(it => (SWAPPED_IN_WEEK2.includes(it.code) ? engineSwapTarget(it.code, "2026-11-01") : it));
  const w2 = buildReceipt("sample-week2", MV, "2026-11-08", SAFEWAY_MV, week2Items, { bagFee: true });
  await add("week2", "Week 2 (follow-up)", "Same store, one week later · 3 items switched", w2, "570 N Shoreline Blvd");

  const wfm = buildReceipt("sample-wfm", { name: "Whole Foods Market", city: "Sunnyvale", state: "CA" }, "2026-10-25", 4117, autoBasket(4117, "2026-10-25", 12), { bagFee: true });
  await add("wfm", "Whole Foods", "Whole Foods Market, Sunnyvale · 13 lines", wfm, "777 Sunnyvale Saratoga Rd");

  const sf = buildReceipt("sample-smartfinal", { name: "Smart & Final extra!", city: "Mountain View", state: "CA" }, "2026-10-30", 4190, autoBasket(4190, "2026-10-30", 12), {});
  await add("smartfinal", "Smart & Final", "Smart & Final extra!, Mountain View · 12 lines", sf, "2310 Homestead Rd");

  // A store outside the demo area: Safeway shelf prices on a receipt from a store we have no data for.
  const out = buildReceipt("sample-outside", { name: "Riverside Market", city: "Columbus", state: "OH" }, "2026-11-03", null,
    WEEK1.slice(9).map(it => ({ ...it, price: obsAt(it.code, SAFEWAY_MV, "2026-11-01").price })), {});
  await add("outside", "Store outside our area", "Columbus, Ohio · no price data yet", out, "12 Main St");

  writeFileSync("data/samples.json", JSON.stringify({
    note: "SAMPLE receipts generated by scripts/make-samples.ts. `truth` (the real product per line) is used only by the evals, never by the scan pipeline.",
    samples,
  }, null, 1));

  // ---------- demo history: one household, 8 weekly Safeway receipts + 3 Sprouts receipts ----------
  const cpi = c.bls.cpi.months;
  const cpiAt = (date: string) => (cpi.find(m => m.month === date.slice(0, 7)) ?? cpi.at(-1)!).value;
  const start = "2026-09-20";
  const dateOf = (week: number) => new Date(Date.parse(start) + (week - 1) * 7 * 864e5).toISOString().slice(0, 10);
  /**
   * Week-to-week price: the observed price x the real CPI food-at-home change since week 1
   * x a small deterministic per-product offset of -2%..+2% that changes every second week.
   */
  const weekPrice = (base: number, code: string, week: number) =>
    r2(base * (cpiAt(dateOf(week)) / cpiAt(dateOf(1))) * (1 + (((hash(code) + Math.floor(week / 2)) % 5) - 2) / 100));

  const swaps = ["0025500304014", "0031200029317", "0013562000043"]; // pledged after week 2; the third is never followed
  const elsewhereCode = "0041390000829";                              // Kikkoman: pledged "buy at Sprouts"
  const swapTargets = Object.fromEntries(swaps.map(code => [code, engineSwapTarget(code, "2026-11-01")]));
  const SPROUTS = 4393;
  const PAID_MORE_CODE = swapTargets["0031200029317"].code;          // this switch later costs more

  const receipts: Receipt[] = [];
  const pledges: Pledge[] = [];
  for (let week = 1; week <= 8; week++) {
    const date = dateOf(week);
    const items: Item[] = WEEK1.filter(it => !(week >= 3 && it.code === elsewhereCode)).map(it => {
      let code = it.code; let base = obsAt(it.code, SAFEWAY_MV, "2026-11-01").price;
      if (week >= 3 && (code === swaps[0] || code === swaps[1])) { const t = swapTargets[code]; code = t.code; base = t.price!; }
      let price = weekPrice(base, code, week);
      // Documented exception: from week 7 the cranberry swap costs 10% more per 100 g than the
      // original did, so the history contains one "this switch cost you more" case.
      if (code === PAID_MORE_CODE && week >= 7) {
        const orig = c.products.get("0031200029317")!, tgt = c.products.get(code)!;
        price = r2((obsAt("0031200029317", SAFEWAY_MV, "2026-11-01").price / orig.size!) * tgt.size! * 1.1);
      }
      return { code, qty: it.qty, price };
    });
    receipts.push(buildReceipt(`demo-safeway-w${week}`, MV, date, null, items, { bagFee: true }).receipt);
    if (week >= 4 && week % 2 === 0) {
      const sprouts = [{ code: elsewhereCode, price: weekPrice(obsAt(elsewhereCode, SPROUTS, "2026-11-01").price, elsewhereCode, week) }];
      receipts.push(buildReceipt(`demo-sprouts-w${week}`, { name: "Sprouts Farmers Market", city: "Sunnyvale", state: "CA" }, dateOf(week), null, sprouts, {}).receipt);
    }
    if (week === 2) {
      const w2 = receipts.at(-1)!;
      const lineOf = (code: string) => w2.lines[WEEK1.findIndex(it => it.code === code)];
      for (const code of swaps) {
        const p = c.products.get(code)!, t = c.products.get(swapTargets[code].code)!; const l = lineOf(code);
        const paid = (l.lineTotal - l.discount) / l.qty;
        pledges.push({
          id: `demo-pledge-${code}`, createdAt: date, fromReceiptId: w2.id, isSample: true, kind: "cheaper_swap",
          productCode: code, targetProductCode: t.code, categoryTag: p.categories.at(-1) ?? null,
          fromStore: "Safeway", targetStore: null, paidPrice: paid, paidUnitPrice: p.size ? r2((paid / p.size) * 100 * 100) / 100 : null,
          expectedSaving: 0, label: `Switch to ${t.name}`,
        });
      }
      const l = lineOf(elsewhereCode); const p = c.products.get(elsewhereCode)!;
      pledges.push({
        id: `demo-pledge-${elsewhereCode}`, createdAt: date, fromReceiptId: w2.id, isSample: true, kind: "cheaper_elsewhere",
        productCode: elsewhereCode, targetProductCode: elsewhereCode, categoryTag: p.categories.at(-1) ?? null,
        fromStore: "Safeway", targetStore: storeLabel(c.locations.get(SPROUTS)!), paidPrice: l.lineTotal / l.qty, paidUnitPrice: null,
        expectedSaving: 0, label: `Buy ${p.name} at ${storeLabel(c.locations.get(SPROUTS)!)}`,
      });
    }
  }
  writeFileSync("data/demo-history.json", JSON.stringify({
    note: "DEMO history generated by scripts/make-samples.ts: one household's receipts and pledges. Prices start from real Open Prices observations; see weekPrice() for how they move. Everything shown from it is computed by the live code.",
    receipts, pledges,
  }, null, 1));
  console.log("demo history:", receipts.length, "receipts,", pledges.length, "pledges");
}

main().catch(e => { console.error(e); process.exit(1); });
