import { getDemographicsRoster } from "@/lib/demographics-data";

/**
 * `/data/demographics/members` — every voting member of every Congress since the 73rd as compact arrays (see
 * `DemoRoster`), prerendered to static JSON. The member lists under the demographics charts fetch it once, after the page
 * has loaded.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(getDemographicsRoster(), { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } });
}
