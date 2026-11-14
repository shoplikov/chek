import { getCatalog } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const c = getCatalog();
  return Response.json({ ok: true, products: c.products.size, prices: c.priceCount, locations: c.locations.size });
}
