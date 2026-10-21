import { getChapterUsePayload, getChapterUseYears } from "@/lib/trade-chapter-use-data";

/**
 * `/data/trade/chapter-use/<year>`: one year's goods by HS chapter and Census end use, both flows, all countries,
 * prerendered to static JSON at build. "What the U.S. trades" fetches the year on screen the first time a line opens:
 * an opened chapter lists its uses, an opened use its chapters. Static, like `/data/trade/products/[code]`, so no
 * server function reads the files.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return getChapterUseYears().map((y) => ({ year: String(y) }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  const body = /^\d{4}$/.test(year) ? getChapterUsePayload(Number(year)) : null;
  if (!body) return new Response("Not found", { status: 404 });
  return Response.json(body, { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } });
}
