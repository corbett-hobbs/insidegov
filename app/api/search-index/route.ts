import { getSiteSearchIndex } from "@/lib/site-search-index";

// Built once at build time; the homepage search fetches it on first focus.
export const dynamic = "force-static";

export function GET() {
  return Response.json(getSiteSearchIndex());
}
