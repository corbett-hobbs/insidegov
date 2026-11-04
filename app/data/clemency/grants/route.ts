import { getClemencyGrants } from "@/lib/clemency-data";

/** `/data/clemency/grants`: every listed grant, newest first, prerendered to static JSON. The list fetches it once, on demand. */
export const dynamic = "force-static";

export function GET() {
  return Response.json(getClemencyGrants(), { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } });
}
