import type { NextConfig } from "next";
import { verticalRedirects } from "./lib/verticals";

const API_TABLES = [
  "./pipeline/output/*.json",
  "./pipeline/output/court/*.json",
  "./pipeline/output/trade_by_country/*.json",
  "./pipeline/output/duties_by_country/*.json",
];

const nextConfig: NextConfig = {
  // Verticals -> sections (lib/verticals.ts): "/<vertical>" redirects to the
  // vertical's default section. A bare "/" is the hub and must not redirect, so
  // the legacy explorer links that used to live at "/" are matched on the
  // query params the explorer reads/writes (chamber, state, show — see
  // lib/use-chamber.ts). Next carries the query string through.
  async redirects() {
    return [
      { source: "/wealth", destination: "/congress/wealth", permanent: true },
      { source: "/executive-orders", destination: "/presidency/executive-orders", permanent: true },
      { source: "/presidency/national-security", destination: "/presidency/troops-abroad", permanent: true },
      ...verticalRedirects().map((r) => ({ ...r, permanent: true })),
      ...["chamber", "state", "show"].map((key) => ({
        source: "/",
        has: [{ type: "query" as const, key }],
        destination: "/congress/ideology",
        permanent: true,
      })),
    ];
  },

  // Several routes render as serverless functions (stale-slug redirects on the
  // profile pages; the OG images, which now render on demand) and read
  // pipeline/output/*.json via fs — a computed path Next's tracer doesn't
  // follow on its own, so include it explicitly.
  outputFileTracingIncludes: {
    "/congress/senators/[bioguide_id]/[name_slug]": ["./pipeline/output/*.json"],
    "/congress/senators/[bioguide_id]/[name_slug]/opengraph-image": [
      "./pipeline/output/*.json",
    ],
    "/congress/house/[bioguide_id]/[name_slug]": ["./pipeline/output/*.json"],
    "/congress/house/[bioguide_id]/[name_slug]/opengraph-image": [
      "./pipeline/output/*.json",
    ],
    "/congress/committees/[committee_id]/[name_slug]": ["./pipeline/output/*.json", "./pipeline/output/committee_bills/*.json"],
    "/congress/committees/[committee_id]/[name_slug]/opengraph-image": [
      "./pipeline/output/*.json",
    ],
    // Law pages read pipeline/output/law_details/<congress>.json by a computed path.
    "/congress/laws/[law_id]/[name_slug]": ["./pipeline/output/*.json", "./pipeline/output/law_details/*.json"],
    "/congress/laws/[law_id]/[name_slug]/opengraph-image": ["./pipeline/output/*.json", "./pipeline/output/law_details/*.json"],
    "/sitemap.xml": ["./pipeline/output/*.json"],
    // The Court pages and the hub card read pipeline/output/court/ via
    // lib/justice-data.ts.
    "/supreme-court/ideology": ["./pipeline/output/court/*.json"],
    "/supreme-court/justices/[justice_id]/[name_slug]": ["./pipeline/output/court/*.json"],
    // Decision pages join the case list, its details and leads (pipeline/output/decisions_*.json), the justices' votes and
    // scores (court/) and the Wikipedia fetch manifests the Decisions payload dates its sources by.
    "/supreme-court/decisions/[case_id]/[name_slug]": ["./pipeline/output/*.json", "./pipeline/output/court/*.json", "./pipeline/raw/wikipedia-cases/*manifest.json"],
    "/supreme-court/decisions/[case_id]/[name_slug]/opengraph-image": ["./pipeline/output/*.json", "./pipeline/output/court/*.json", "./pipeline/raw/wikipedia-cases/*manifest.json"],
    "/": ["./pipeline/output/court/*.json"],
    // The public API and the MCP server load whole tables by name (lib/api-datasets.ts), including the
    // per-year trade and duties shards and the Court files.
    "/api/v1/datasets/[id]": API_TABLES,
    "/api/v1/datasets/[id]/rows": API_TABLES,
    "/mcp": API_TABLES,
  },

  // Loaders that read pipeline/output/ by a computed file name pull the whole directory into every server
  // function. The goods-by-product shards (12 MB, 236 files) are read only at build (the static
  // /data/trade/products/[code] route and the trade page), and carrying them in every function split the bundles
  // past the Hobby plan's 12-function limit. Keep this while no server function reads them; a non-static route
  // that does must drop it and list itself in outputFileTracingIncludes instead.
  outputFileTracingExcludes: {
    "/**": ["./pipeline/output/trade_products/**"],
  },
};

export default nextConfig;
