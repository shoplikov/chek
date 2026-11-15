import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Reference data, loaded once into memory from data/*.json (built by the seed scripts).
 * ponytail: in-memory JSON; move to Postgres when user receipts start feeding the price base.
 */
export type Product = {
  code: string; name: string; brands: string | null;
  size: number | null; sizeFamily: "g" | "ml" | null; quantityText: string | null; categories: string[];
};
export type PriceObs = {
  id: number; productCode: string; locationId: number; price: number; date: string;
  discounted: boolean; unitPrice: number | null;
};
export type Location = { id: number; name: string; city: string | null; postcode: string | null; lat: number; lon: number };
export type BlsSeries = {
  id: string; item: string; unitLabel: string; categories: string[];
  perUnit: { amount: number; family: "g" | "ml" | "count" };
  months: { month: string; value: number }[];
};
export type Catalog = {
  products: Map<string, Product>;
  pricesByProduct: Map<string, PriceObs[]>;
  pricesByLocation: Map<number, PriceObs[]>;
  locations: Map<number, Location>;
  productsByCategory: Map<string, string[]>; // most specific category tag -> product codes
  bls: { cpi: { id: string; item: string; months: { month: string; value: number }[] }; prices: BlsSeries[] };
  priceCount: number;
};

let cached: Catalog | null = null;

function read<T>(file: string): T {
  return JSON.parse(readFileSync(join(process.cwd(), "data", file), "utf8")) as T;
}

/** Tags that say nothing about what a product is (junk, or too broad to compare within). */
const BROAD = new Set([
  "en:undefined", "en:groceries", "en:snacks", "en:salty-snacks", "en:sweet-snacks", "en:frozen-foods", "en:frozen-desserts",
  "en:beverages", "en:sweetened-beverages", "en:meals", "en:cooking-helpers", "en:condiments", "en:sauces", "en:dips",
  "en:confectioneries", "en:plant-based-foods", "en:plant-based-foods-and-beverages", "en:cereals-and-their-products",
  "en:fruits-and-vegetables-based-foods", "en:dried-products", "en:dried-products-to-be-rehydrated", "en:dehydrated-beverages",
  "en:biscuits-and-cakes", "en:coffees", "en:desserts", "en:dairies", "en:fermented-foods", "en:canned-foods", "en:spreads",
  "en:breakfasts", "en:beverages-and-beverages-preparations", "en:hot-beverages", "en:appetizers", "en:herbs-and-spices",
  "en:cheeses", "en:fermented-milk-products", "en:milks", "en:meats", "en:prepared-meats", "en:fishes", "en:seafood",
]);
const validTag = (t: string) => /^[a-z]{2}:[a-z0-9-]+$/.test(t);

/** Usable category tags of a product, general to specific, junk removed. */
export const usableCategories = (p: Product) => p.categories.filter(validTag).map(t => t.toLowerCase()).filter(t => t !== "en:undefined" && t !== "en:groceries");

/** The most specific category, if it is specific enough to compare products within. */
export const specificCategory = (p: Product): string | null => {
  const tags = usableCategories(p);
  const last = tags.at(-1);
  return last && !BROAD.has(last) ? last : null;
};

export function buildCatalog(
  products: Product[], prices: PriceObs[], locations: Location[], bls: Catalog["bls"],
): Catalog {
  const c: Catalog = {
    products: new Map(products.map(p => [p.code, p])),
    pricesByProduct: new Map(), pricesByLocation: new Map(),
    locations: new Map(locations.map(l => [l.id, l])),
    productsByCategory: new Map(), bls, priceCount: prices.length,
  };
  for (const p of prices) {
    if (!c.pricesByProduct.has(p.productCode)) c.pricesByProduct.set(p.productCode, []);
    c.pricesByProduct.get(p.productCode)!.push(p);
    if (!c.pricesByLocation.has(p.locationId)) c.pricesByLocation.set(p.locationId, []);
    c.pricesByLocation.get(p.locationId)!.push(p);
  }
  for (const p of products) {
    const cat = specificCategory(p);
    if (!cat) continue;
    if (!c.productsByCategory.has(cat)) c.productsByCategory.set(cat, []);
    c.productsByCategory.get(cat)!.push(p.code);
  }
  return c;
}

export function getCatalog(): Catalog {
  if (cached) return cached;
  const products = read<{ products: Product[] }>("products.json").products;
  const prices = read<{ prices: PriceObs[] }>("prices.json").prices;
  const locations = read<{ locations: Location[] }>("locations.json").locations;
  const bls = read<Catalog["bls"]>("bls.json");
  cached = buildCatalog(products, prices, locations, bls);
  return cached;
}

const norm = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * The demo-area locations a receipt's store refers to. A chain name with a city picks the
 * branches in that city; without a city, every demo-area branch of that chain.
 */
export function resolveStore(c: Catalog, store: { name: string; city: string | null }): Location[] {
  const name = norm(store.name);
  if (!name) return [];
  const chain = [...c.locations.values()].filter(l => {
    const ln = norm(l.name);
    const first = ln.split(" ")[0];
    return name.includes(ln) || ln.includes(name) || (first.length >= 4 && name.split(" ").includes(first));
  });
  if (!store.city) return chain;
  const city = norm(store.city);
  const inCity = chain.filter(l => l.city && norm(l.city) === city);
  return inCity;
}

export const storeLabel = (l: Location) => `${l.name}, ${l.city ?? ""}`.replace(/, $/, "");

/** A public page for a product's prices on Open Prices. */
export const productUrl = (code: string) => `https://prices.openfoodfacts.org/products/${code}`;
