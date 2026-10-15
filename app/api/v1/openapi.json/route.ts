import { listDatasetDefs } from "@/lib/api-datasets";
import { apiJson, preflight } from "@/lib/api-http";
import { attribution } from "@/lib/api-service";
import { absoluteUrl } from "@/lib/site";

/** `/api/v1/openapi.json` — an OpenAPI 3.1 description for tools that import one (Postman, GPT actions, client generators). */
export function GET() {
  const ids = listDatasetDefs().map((d) => d.id);
  const idParam = { name: "id", in: "path", required: true, description: "Dataset id from /datasets.", schema: { type: "string", enum: ids } };
  const ok = (description: string) => ({ "200": { description } });
  return apiJson({
    openapi: "3.1.0",
    info: {
      title: "InsideGov data API",
      version: "1.0.0",
      description: `Read-only access to the tables behind InsideGov's charts. ${attribution.text} Terms: ${attribution.terms}`,
    },
    servers: [{ url: absoluteUrl("/api/v1") }],
    paths: {
      "/datasets": { get: { operationId: "listDatasets", summary: "List datasets", responses: ok("The catalog.") } },
      "/datasets/{id}": {
        get: {
          operationId: "describeDataset",
          summary: "Describe a dataset: grain, units, sources, every field and its type, sample rows",
          parameters: [idParam],
          responses: ok("The dataset description."),
        },
      },
      "/datasets/{id}/rows": {
        get: {
          operationId: "queryDataset",
          summary: "Query a dataset",
          description:
            "Filter on any field: `field=value` (equals) or `field=low..high` (a range, ends included; `2010..` means 2010 or later, `..2020` means 2020 or earlier). Example: `country_key=MEX&fiscal_year=2010..2020&sort=-fiscal_year`.",
          parameters: [
            idParam,
            { name: "fields", in: "query", description: "Comma-separated columns to return.", schema: { type: "string" } },
            { name: "sort", in: "query", description: "Comma-separated fields; prefix with - for descending.", schema: { type: "string" } },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 5000, default: 100 } },
            { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
            { name: "format", in: "query", schema: { type: "string", enum: ["json", "csv"], default: "json" } },
            {
              name: "filters",
              in: "query",
              description: "Field filters, written as ordinary query parameters (field=value).",
              style: "form",
              explode: true,
              schema: { type: "object", additionalProperties: { type: "string" } },
            },
          ],
          responses: { ...ok("Matching rows, with total, paging and attribution."), "400": { description: "Unknown field or bad parameter." } },
        },
      },
    },
  });
}

export const OPTIONS = preflight;
