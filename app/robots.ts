import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // The data API and the MCP endpoint are for programs, and a crawler paging through them is pure origin transfer.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/v1/", "/mcp"] },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
