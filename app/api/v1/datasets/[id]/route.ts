import { apiError, apiJson, preflight } from "@/lib/api-http";
import { logApiCall } from "@/lib/api-log";
import { describe } from "@/lib/api-service";

/** `/api/v1/datasets/<id>` — one dataset's description: grain, units, sources, every field with its type, and three sample rows. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  logApiCall("rest", { route: "describe", dataset: id.slice(0, 60) }, request);
  const body = describe(id);
  if (!body) return apiError(404, `Unknown dataset "${id}". List them at /api/v1/datasets.`);
  return apiJson(body);
}

export const OPTIONS = preflight;
