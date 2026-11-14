/**
 * Fetches BLS data (public domain): CPI food at home and US city average prices.
 * Series IDs were checked against https://download.bls.gov/pub/time.series/ap/ap.item.
 * The `categories` list maps an Open Food Facts category tag to a series; `perUnit` is the
 * size the BLS price is quoted for, so a product's price can be compared per that size.
 *
 * Run: npx tsx scripts/seed-bls.ts   (2 API calls, cached under .cache/)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

type Series = { id: string; item: string; perUnit: { amount: number; family: "g" | "ml" | "count" }; unitLabel: string; categories: string[] };

const CPI = "CUUR0000SAF11";
const LB = { amount: 453.6, family: "g" as const };
export const SERIES: Series[] = [
  { id: "APU0000708111", item: "Eggs, grade A, large", perUnit: { amount: 12, family: "count" }, unitLabel: "dozen", categories: ["en:chicken-eggs", "en:eggs"] },
  { id: "APU0000709112", item: "Milk, fresh, whole, fortified", perUnit: { amount: 3785.4, family: "ml" }, unitLabel: "gallon", categories: ["en:whole-milks"] },
  { id: "APU0000702111", item: "Bread, white, pan", perUnit: LB, unitLabel: "lb", categories: ["en:white-breads", "en:white-sandwich-breads"] },
  { id: "APU0000710111", item: "Butter, salted, grade AA, stick", perUnit: LB, unitLabel: "lb", categories: ["en:salted-butters"] },
  { id: "APU0000701312", item: "Rice, white, long grain, uncooked", perUnit: LB, unitLabel: "lb", categories: ["en:long-grain-rices", "en:white-rices"] },
  { id: "APU0000717311", item: "Coffee, 100%, ground roast, all sizes", perUnit: LB, unitLabel: "lb", categories: ["en:ground-coffees"] },
  { id: "APU0000715211", item: "Sugar, white, all sizes", perUnit: LB, unitLabel: "lb", categories: ["en:white-sugars", "en:granulated-sugars"] },
  { id: "APU0000710212", item: "Cheddar cheese, natural", perUnit: LB, unitLabel: "lb", categories: ["en:cheddar-cheese"] },
  { id: "APU0000704111", item: "Bacon, sliced", perUnit: LB, unitLabel: "lb", categories: ["en:bacons", "en:sliced-bacons"] },
  { id: "APU0000703112", item: "Ground beef, 100% beef", perUnit: LB, unitLabel: "lb", categories: ["en:ground-beef", "en:minced-beef"] },
  { id: "APU0000710411", item: "Ice cream, prepackaged, bulk, regular", perUnit: { amount: 1892.7, family: "ml" }, unitLabel: "1/2 gallon", categories: ["en:ice-creams-tubs", "en:ice-cream-tubs"] },
  { id: "APU0000718311", item: "Potato chips", perUnit: { amount: 453.6, family: "g" }, unitLabel: "16 oz", categories: ["en:potato-crisps", "en:potato-chips"] },
  { id: "APU0000716141", item: "Peanut butter, creamy, all sizes", perUnit: LB, unitLabel: "lb", categories: ["en:peanut-butters"] },
  { id: "APU0000711211", item: "Bananas", perUnit: LB, unitLabel: "lb", categories: ["en:bananas"] },
  { id: "APU0000712112", item: "Potatoes, white", perUnit: LB, unitLabel: "lb", categories: ["en:potatoes"] },
];

async function fetchCached(name: string, body: object) {
  const file = `.cache/bls-${name}.json`;
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const res = await fetch("https://api.bls.gov/publicAPI/v1/timeseries/data/", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.status !== "REQUEST_SUCCEEDED") throw new Error(`BLS: ${json.status} ${json.message}`);
  mkdirSync(".cache", { recursive: true });
  writeFileSync(file, JSON.stringify(json));
  return json;
}

type BlsPoint = { year: string; period: string; value: string };
const toMonths = (data: BlsPoint[]) =>
  data.filter(d => /^M(0[1-9]|1[0-2])$/.test(d.period))
    .map(d => ({ month: `${d.year}-${d.period.slice(1)}`, value: Number(d.value) }))
    .filter(d => isFinite(d.value))
    .sort((a, b) => a.month.localeCompare(b.month));

async function main() {
  const end = new Date().getFullYear();
  // v1 allows 10 years and 25 series per query; one call for the CPI (36+ months), one for prices.
  const cpi = await fetchCached("cpi", { seriesid: [CPI], startyear: String(end - 3), endyear: String(end) });
  const ap = await fetchCached("ap", { seriesid: SERIES.map(s => s.id), startyear: String(end - 1), endyear: String(end) });

  const byId = new Map<string, BlsPoint[]>(
    [...cpi.Results.series, ...ap.Results.series].map((s: { seriesID: string; data: BlsPoint[] }) => [s.seriesID, s.data]),
  );
  const out = {
    source: "U.S. Bureau of Labor Statistics, https://www.bls.gov (public domain)",
    downloadedAt: new Date().toISOString().slice(0, 10),
    cpi: { id: CPI, item: "CPI-U, food at home, U.S. city average, not seasonally adjusted", months: toMonths(byId.get(CPI) ?? []).slice(-36) },
    prices: SERIES.map(s => ({ ...s, months: toMonths(byId.get(s.id) ?? []) })).filter(s => s.months.length),
  };
  writeFileSync("data/bls.json", JSON.stringify(out, null, 1));
  console.log("CPI months", out.cpi.months.length, out.cpi.months.at(-1));
  for (const s of out.prices) console.log(s.id, s.item, s.months.at(-1));
}

main().catch(e => { console.error(e); process.exit(1); });
