import { getEnduseCodes, getEndusePayload } from "@/lib/trade-enduse-data";
import { ALL_PRODUCTS } from "@/lib/trade-products";

/**
 * `/data/trade/enduse/<country_code>` (or `/all`): one partner's goods by Census end-use category, every year from
 * 2010, prerendered to static JSON at build. The "By use" view of the "What the U.S. trades" card fetches it the
 * first time someone switches to that view, and again when the Country filter picks a partner. Static, like
 * `/data/trade/products/[code]`, so no server function reads the 14 MB of end-use files.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return [ALL_PRODUCTS, ...getEnduseCodes()].map((code) => ({ code }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = getEndusePayload(code);
  if (!body) return new Response("Not found", { status: 404 });
  return Response.json(body, { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } });
}
