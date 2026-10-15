import { getLawsSearchIndex } from "@/lib/laws-data";

/**
 * `/data/laws/search` — a word index over every law's full CRS summary (see `lib/laws-search.ts`), prerendered to static
 * JSON. The Every law card fetches it once, the first time someone types in its search box.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(getLawsSearchIndex(), { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } });
}
