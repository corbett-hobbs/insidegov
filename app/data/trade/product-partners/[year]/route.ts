import { getProductPartnerRows } from "@/lib/trade-products-data";
import { getTradeCountryRefs } from "@/lib/trade-data";
import type { ProductPartnersPayload } from "@/lib/trade-products";

/**
 * `/data/trade/product-partners/<year>`: the top countries behind each chapter and top product for one year, both
 * flows, prerendered to static JSON at build. The "What the U.S. trades" card fetches the year on screen the first
 * time someone opens a line. Static, like `/data/trade/products/[code]`, so no server function reads the file.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return [...new Set(getProductPartnerRows().map((r) => r.year))].map((y) => ({ year: String(y) }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  const rows = getProductPartnerRows().filter((r) => String(r.year) === year);
  if (!/^\d{4}$/.test(year) || rows.length === 0) return new Response("Not found", { status: 404 });
  const used = new Set<string>();
  for (const r of rows) for (const lists of [r.chapters, r.headings]) for (const list of Object.values(lists)) for (const t of list as readonly (readonly [string, ...number[]])[]) used.add(t[0]);
  const names = Object.fromEntries(getTradeCountryRefs().filter((c) => used.has(c.code)).map((c) => [c.code, c.name]));
  const body: ProductPartnersPayload = { rows, names };
  return Response.json(body, { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } });
}
