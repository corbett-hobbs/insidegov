import { apiJson, preflight } from "@/lib/api-http";
import { attribution, catalog } from "@/lib/api-service";
import { absoluteUrl } from "@/lib/site";

/** `/api/v1` — the front door: what this is, how to credit it, and the dataset list. Prerendered at build. */
export function GET() {
  return apiJson({
    name: "InsideGov data API",
    version: "v1",
    attribution,
    docs: absoluteUrl("/api"),
    openapi: absoluteUrl("/api/v1/openapi.json"),
    mcp: absoluteUrl("/mcp"),
    datasets: catalog(),
  });
}

export const OPTIONS = preflight;
