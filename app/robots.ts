import type { MetadataRoute } from "next";
import { getLandmarkDecisionRefs } from "@/lib/decision-page-data";
import { decisionPath, DECISIONS_BASE_PATH } from "@/lib/decision-url";
import { getLandmarkLawRefs } from "@/lib/law-details-data";
import { lawPath, LAWS_BASE_PATH } from "@/lib/law-url";
import { absoluteUrl } from "@/lib/site";

/**
 * Only the landmark laws and cases are meant to be found in search. The other ~19k law and case pages render in a function on
 * first request, so a crawler walking them is pure origin transfer. Disallow the two page trees and Allow back the landmark
 * pages (the longest matching rule wins) and the share images, which link previews fetch from the same paths. The list pages
 * (`/congress/laws`, `/supreme-court/decisions`) have no trailing slash and stay crawlable.
 */
export default function robots(): MetadataRoute.Robots {
  const landmarks = [
    ...getLandmarkLawRefs().map((l) => lawPath(l.lawId, l.title)),
    ...getLandmarkDecisionRefs().map((d) => decisionPath(d.caseId, d.name)),
  ];
  return {
    rules: {
      userAgent: "*",
      allow: ["/", ...landmarks, `${LAWS_BASE_PATH}/*/*/opengraph-image`, `${DECISIONS_BASE_PATH}/*/*/opengraph-image`],
      // The data API and the MCP endpoint are for programs, and a crawler paging through them is pure origin transfer.
      disallow: ["/api/v1/", "/mcp", `${LAWS_BASE_PATH}/`, `${DECISIONS_BASE_PATH}/`],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
