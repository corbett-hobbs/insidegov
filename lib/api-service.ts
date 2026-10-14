import "server-only";
import { ATTRIBUTION_NAME, ATTRIBUTION_TEXT, GROUP_LABEL, listDatasetDefs, loadDataset, type DatasetDef } from "./api-datasets";
import { parseQuery, runQuery, type QueryLimits, type Row } from "./api-query";
import { absoluteUrl } from "./site";
import { docUrl } from "./site-info";

/**
 * What the REST routes and the MCP tools both answer with, so the two surfaces can never
 * disagree about a dataset, a field or a result. Shapes are the public contract: add fields,
 * never rename or remove one (the path says `v1`).
 */

export const attribution = {
  name: ATTRIBUTION_NAME,
  url: absoluteUrl("/"),
  text: ATTRIBUTION_TEXT,
  terms: absoluteUrl("/api"),
};

export const datasetUrl = (id: string) => absoluteUrl(`/api/v1/datasets/${id}`);

/** The catalog row: enough to choose a dataset without loading it. */
export function summarize(def: DatasetDef) {
  return {
    id: def.id,
    title: def.title,
    group: def.group,
    group_label: GROUP_LABEL[def.group],
    description: def.description,
    grain: def.grain,
    page: absoluteUrl(def.page.href),
    sources: def.sources,
    license: def.license ?? null,
    url: datasetUrl(def.id),
  };
}

export const catalog = () => listDatasetDefs().map(summarize);

export function describe(id: string) {
  const ds = loadDataset(id);
  if (!ds) return null;
  const { def } = ds;
  return {
    ...summarize(def),
    units: def.units ?? null,
    methodology: def.doc ? docUrl(def.doc) : null,
    row_count: ds.rows.length,
    fields: ds.fields.map((name) => ({ name, type: ds.types[name], note: def.fieldNotes?.[name] ?? null })),
    sample: ds.rows.slice(0, 3),
    rows_url: `${datasetUrl(def.id)}/rows`,
    attribution,
  };
}

export type QueryOutcome =
  | { ok: true; body: ReturnType<typeof queryBody>; columns: string[]; rows: Row[] }
  | { ok: false; status: 400 | 404; error: string };

function queryBody(def: DatasetDef, total: number, limit: number, offset: number, rows: Row[], nextUrl: string | null) {
  return {
    dataset: def.id,
    title: def.title,
    attribution: attribution.text,
    sources: def.sources,
    license: def.license ?? null,
    total,
    limit,
    offset,
    returned: rows.length,
    next: nextUrl,
    data: rows,
  };
}

/** Runs one query. `selfUrl` is the request URL, used only to build the `next` page link. */
export function query(id: string, params: URLSearchParams, limits: QueryLimits, selfUrl: URL | null): QueryOutcome {
  const ds = loadDataset(id);
  if (!ds) {
    const known = listDatasetDefs().map((d) => d.id).join(", ");
    return { ok: false, status: 404, error: `Unknown dataset "${id}". Datasets: ${known}.` };
  }
  const parsed = parseQuery(params, ds.fields, limits);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
  const { query: q } = parsed;
  const { total, rows } = runQuery(ds.rows, q);

  let next: string | null = null;
  if (selfUrl && q.offset + rows.length < total) {
    const u = new URL(selfUrl);
    u.searchParams.set("offset", String(q.offset + q.limit));
    next = u.toString();
  }
  return {
    ok: true,
    body: queryBody(ds.def, total, q.limit, q.offset, rows, next),
    columns: q.fields ?? ds.fields,
    rows,
  };
}
