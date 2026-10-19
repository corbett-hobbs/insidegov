import { getProductsCodes, getProductsPayload } from "@/lib/trade-products-data";
import { ALL_PRODUCTS } from "@/lib/trade-products";

/**
 * `/data/trade/products/<country_code>` (or `/all`): one partner's goods by HS chapter and top headings, every
 * year from 2010, prerendered to static JSON at build. The "What the U.S. trades" card fetches it when the
 * Country filter picks a partner (`all` on first paint). Static, so no server function reads the 12 MB of
 * product files (next.config.ts keeps them out of every function's trace).
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return [ALL_PRODUCTS, ...getProductsCodes()].map((code) => ({ code }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = getProductsPayload(code);
  if (!body) return new Response("Not found", { status: 404 });
  return Response.json(body, { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } });
}
