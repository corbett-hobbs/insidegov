import { apiJson, preflight } from "@/lib/api-http";
import { attribution, catalog } from "@/lib/api-service";

/** `/api/v1/datasets` — the catalog. Prerendered at build. */
export function GET() {
  return apiJson({ attribution, datasets: catalog() });
}

export const OPTIONS = preflight;
