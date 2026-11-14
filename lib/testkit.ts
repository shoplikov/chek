import { buildCatalog, type Catalog, type PriceObs, type Product } from "./catalog";
import type { Match, Receipt, ReceiptLine } from "./types";

/** Small in-memory fixtures for the unit tests. */
export const product = (code: string, over: Partial<Product> = {}): Product => ({
  code, name: `Product ${code}`, brands: "Brand", size: 500, sizeFamily: "g", quantityText: "500 g",
  categories: ["en:plant-based-foods", "en:cereals-and-their-products", "en:breakfast-cereals"], ...over,
});
let id = 1;
export const obs = (productCode: string, locationId: number, price: number, date = "2026-11-01", size = 500): PriceObs =>
  ({ id: id++, productCode, locationId, price, date, discounted: false, unitPrice: Math.round((price / size) * 100 * 10000) / 10000 });

export function catalog(products: Product[], prices: PriceObs[]): Catalog {
  return buildCatalog(products, prices, [
    { id: 1, name: "Safeway", city: "Mountain View", postcode: null, lat: 0, lon: 0 },
    { id: 2, name: "Sprouts Farmers Market", city: "Sunnyvale", postcode: null, lat: 0, lon: 0 },
  ], {
    cpi: { id: "CUUR0000SAF11", item: "cpi", months: [{ month: "2026-09", value: 300 }, { month: "2026-10", value: 303 }] },
    prices: [{ id: "APU0000708111", item: "Eggs, grade A, large", unitLabel: "dozen", categories: ["en:chicken-eggs"], perUnit: { amount: 12, family: "count" }, months: [{ month: "2026-10", value: 2.32 }] }],
  });
}

export const line = (n: number, rawName: string, lineTotal: number, over: Partial<ReceiptLine> = {}): ReceiptLine =>
  ({ line: n, rawName, qty: 1, unitPrice: null, lineTotal, discount: 0, taxable: null, ...over });

export const receipt = (lines: ReceiptLine[], over: Partial<Receipt> = {}): Receipt => ({
  id: "r1", store: { name: "Safeway", city: "Mountain View", state: "CA" }, purchasedAt: "2026-11-01", currency: "USD",
  lines, subtotal: null, tax: 0, total: Math.round(lines.reduce((s, l) => s + l.lineTotal - l.discount, 0) * 100) / 100,
  sumCheckPassed: true, isSample: false, ...over,
});

export const matched = (lineNo: number, productCode: string): Match => ({ line: lineNo, productCode, confidence: 0.95, reason: "matched" });
