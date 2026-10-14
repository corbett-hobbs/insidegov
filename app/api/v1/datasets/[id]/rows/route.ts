import { apiError, apiJson, apiText, MAX_BODY_BYTES, preflight } from "@/lib/api-http";
import { toCsv } from "@/lib/api-query";
import { attribution, query } from "@/lib/api-service";

/**
 * `/api/v1/datasets/<id>/rows` — query a dataset. Filters, `fields`, `sort`, `limit`, `offset`
 * and `format=json|csv`; the grammar is documented in `lib/api-query.ts` and on `/api`.
 */
const LIMITS = { defaultLimit: 100, maxLimit: 5000 };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "json";
  if (format !== "json" && format !== "csv") return apiError(400, `"format" must be json or csv.`);

  const out = query(id, url.searchParams, LIMITS, url);
  if (!out.ok) return apiError(out.status, out.error);

  const tooBig = () =>
    apiError(413, `That answer is over ${MAX_BODY_BYTES / 1_000_000} MB. Ask for fewer rows (limit), fewer columns (fields), or page with offset.`);

  if (format === "csv") {
    const csv = toCsv(out.rows, out.columns);
    if (csv.length > MAX_BODY_BYTES) return tooBig();
    return apiText(csv, "text/csv; charset=utf-8", {
      "x-total-count": String(out.body.total),
      "x-attribution": attribution.text,
      "content-disposition": `inline; filename="${id}.csv"`,
    });
  }

  const body = JSON.stringify(out.body);
  if (body.length > MAX_BODY_BYTES) return tooBig();
  return apiJson(out.body, 200);
}

export const OPTIONS = preflight;
