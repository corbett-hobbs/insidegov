import { getProductUsePayload, getProductUseYears } from "@/lib/trade-product-use-data";

/**
 * `/data/trade/product-use/<year>`: one year's goods by product and use (HS heading x Census end use), both flows, all
 * countries, prerendered to static JSON at build. The "From product to use" card fetches the year on screen the first
 * time it shows (a line tapped in "What the U.S. trades"). Static, like `/data/trade/products/[code]`, so no server
 * function reads the files.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return getProductUseYears().map((y) => ({ year: String(y) }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  const body = /^\d{4}$/.test(year) ? getProductUsePayload(Number(year)) : null;
  if (!body) return new Response("Not found", { status: 404 });
  return Response.json(body, { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } });
}
