/**
 * Builds the reference price base from Open Prices (Open Food Facts), ODbL.
 * Reads the daily dumps (cached under .cache/), keeps USD product prices at demo-area
 * stores, keeps the most recent observation per (product, store), and writes data/*.json.
 *
 * Run: npx tsx scripts/seed-open-prices.ts
 */
import { createReadStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { execFileSync } from "node:child_process";

const CACHE = ".cache";
const BASE = "https://prices.openfoodfacts.org/data";
const DUMPS = ["locations.jsonl.gz", "prices.jsonl.gz", "products.jsonl.gz"];
const DEMO_CITIES = ["Mountain View", "Sunnyvale", "Los Altos"];
const MIN_STORE_PRICES = 150; // a store with fewer observations adds noise, not coverage

type Loc = { id: number; osm_name: string; osm_address_city: string | null; osm_address_postcode: string | null; osm_address_country_code: string | null; osm_lat: string; osm_lon: string; price_count: number };
type PriceRow = { id: number; product_code: string | null; location_id: number; price: string; price_is_discounted: boolean; price_without_discount: string | null; currency: string; date: string; type: string; duplicate_of: number | null };
type ProductRow = { code: string; product_name: string | null; brands: string | null; product_quantity: number | string | null; product_quantity_unit: string | null; quantity: string | null; categories_tags: string[] | null };

async function* lines(file: string) {
  const rl = createInterface({ input: createReadStream(`${CACHE}/${file}`).pipe(createGunzip()), crlfDelay: Infinity });
  for await (const l of rl) if (l.trim()) yield JSON.parse(l);
}

function ensureDumps() {
  mkdirSync(CACHE, { recursive: true });
  for (const f of DUMPS) {
    if (existsSync(`${CACHE}/${f}`)) continue;
    console.log(`downloading ${f}`);
    execFileSync("curl", ["-sSfL", "-o", `${CACHE}/${f}`, `${BASE}/${f}`]);
  }
}

/** Normalise a pack size to grams or millilitres; null when unknown. */
export function packSize(qty: number | string | null, unit: string | null): { amount: number; family: "g" | "ml" } | null {
  const q = Number(qty);
  if (!q || !isFinite(q) || q <= 0 || !unit) return null;
  const u = unit.toLowerCase().trim();
  const table: Record<string, [number, "g" | "ml"]> = {
    g: [1, "g"], kg: [1000, "g"], mg: [0.001, "g"], oz: [28.3495, "g"], lb: [453.592, "g"],
    ml: [1, "ml"], l: [1000, "ml"], cl: [10, "ml"], dl: [100, "ml"], "fl oz": [29.5735, "ml"], floz: [29.5735, "ml"], gal: [3785.41, "ml"],
  };
  const t = table[u];
  return t ? { amount: q * t[0], family: t[1] } : null;
}

async function main() {
  ensureDumps();
  const downloadedAt = new Date().toISOString().slice(0, 10);

  const locations: Loc[] = [];
  for await (const d of lines("locations.jsonl.gz") as AsyncGenerator<Loc>) {
    if (d.osm_address_country_code === "US" && DEMO_CITIES.includes(d.osm_address_city ?? "") && d.price_count >= MIN_STORE_PRICES) locations.push(d);
  }
  const locIds = new Set(locations.map(l => l.id));

  // Latest observation per (product_code, location).
  const latest = new Map<string, PriceRow>();
  for await (const p of lines("prices.jsonl.gz") as AsyncGenerator<PriceRow>) {
    if (!locIds.has(p.location_id) || p.currency !== "USD" || p.type !== "PRODUCT" || !p.product_code || p.duplicate_of) continue;
    const price = Number(p.price);
    if (!(price > 0 && price < 500)) continue;
    const key = `${p.product_code}|${p.location_id}`;
    const prev = latest.get(key);
    if (!prev || p.date > prev.date || (p.date === prev.date && p.id > prev.id)) latest.set(key, p);
  }
  const codes = new Set([...latest.values()].map(p => p.product_code!));

  const products: Record<string, { code: string; name: string; brands: string | null; size: number | null; sizeFamily: "g" | "ml" | null; quantityText: string | null; categories: string[] }> = {};
  for await (const p of lines("products.jsonl.gz") as AsyncGenerator<ProductRow>) {
    if (!codes.has(p.code) || !p.product_name) continue;
    const s = packSize(p.product_quantity, p.product_quantity_unit);
    products[p.code] = {
      code: p.code, name: p.product_name.trim(), brands: p.brands?.trim() || null,
      size: s ? Math.round(s.amount * 10) / 10 : null, sizeFamily: s?.family ?? null,
      quantityText: p.quantity, categories: p.categories_tags ?? [],
    };
  }

  const prices = [...latest.values()]
    .filter(p => products[p.product_code!])
    .map(p => {
      const prod = products[p.product_code!];
      const price = Number(p.price);
      return {
        id: p.id, productCode: p.product_code!, locationId: p.location_id, price, date: p.date,
        discounted: p.price_is_discounted,
        unitPrice: prod.size ? Math.round((price / prod.size) * 100 * 10000) / 10000 : null, // per 100 g / 100 ml
      };
    })
    .sort((a, b) => a.productCode.localeCompare(b.productCode) || a.locationId - b.locationId);

  const usedCodes = new Set(prices.map(p => p.productCode));
  for (const c of Object.keys(products)) if (!usedCodes.has(c)) delete products[c];

  const locOut = locations
    .filter(l => prices.some(p => p.locationId === l.id))
    .map(l => ({ id: l.id, name: l.osm_name, city: l.osm_address_city, postcode: l.osm_address_postcode, lat: Number(l.osm_lat), lon: Number(l.osm_lon) }))
    .sort((a, b) => a.id - b.id);

  // Decision-point statistics: products priced at 2+ stores within each age window.
  const today = Date.parse(downloadedAt);
  const windows = [30, 60, 90, 180, 270, 365, 450, 540, 730];
  const multiStore = (days: number) => {
    const by = new Map<string, Set<number>>();
    for (const p of prices) if ((today - Date.parse(p.date)) / 864e5 <= days) {
      if (!by.has(p.productCode)) by.set(p.productCode, new Set());
      by.get(p.productCode)!.add(p.locationId);
    }
    return [...by.values()].filter(s => s.size >= 2).length;
  };
  const stats = windows.map(w => ({ days: w, productsAt2PlusStores: multiStore(w) }));
  const dates = prices.map(p => p.date).sort();
  const perStore = locOut.map(l => ({ store: `${l.name}, ${l.city}`, id: l.id, prices: prices.filter(p => p.locationId === l.id).length }));

  mkdirSync("data", { recursive: true });
  const header = { source: "Open Prices (Open Food Facts), https://prices.openfoodfacts.org", licence: "ODbL 1.0", downloadedAt };
  writeFileSync("data/locations.json", JSON.stringify({ ...header, locations: locOut }, null, 1));
  writeFileSync("data/products.json", JSON.stringify({ ...header, products: Object.values(products) }));
  writeFileSync("data/prices.json", JSON.stringify({ ...header, prices }));
  writeFileSync("data/open-prices-stats.json", JSON.stringify({ downloadedAt, dateRange: [dates[0], dates.at(-1)], perStore, windows: stats }, null, 1));

  console.log({ locations: locOut.length, products: Object.keys(products).length, prices: prices.length, dateRange: [dates[0], dates.at(-1)] });
  console.table(perStore);
  console.table(stats);
}

main().catch(e => { console.error(e); process.exit(1); });
