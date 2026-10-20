import { getEndusePartnerRows } from "@/lib/trade-enduse-data";
import { getTradeCountryRefs } from "@/lib/trade-data";
import type { EndusePartnersPayload } from "@/lib/trade-enduse";

/**
 * `/data/trade/enduse-partners/<year>`: the top countries behind each end-use category for one year, both flows,
 * prerendered to static JSON at build. The card's "By use" view fetches the year on screen the first time someone
 * opens a line. The sibling of `/data/trade/product-partners/[year]`.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return [...new Set(getEndusePartnerRows().map((r) => r.year))].map((y) => ({ year: String(y) }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  const rows = getEndusePartnerRows().filter((r) => String(r.year) === year);
  if (!/^\d{4}$/.test(year) || rows.length === 0) return new Response("Not found", { status: 404 });
  const used = new Set<string>();
  for (const r of rows) for (const list of Object.values(r.categories)) for (const t of list as readonly (readonly [string, ...number[]])[]) used.add(t[0]);
  const names = Object.fromEntries(getTradeCountryRefs().filter((c) => used.has(c.code)).map((c) => [c.code, c.name]));
  const body: EndusePartnersPayload = { rows, names };
  return Response.json(body, { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } });
}
