import "server-only";
import { GROUP_LABEL, listDatasetDefs, type DatasetGroup } from "./api-datasets";
import { paramsFromObject } from "./api-query";
import { attribution, catalog, describe, query } from "./api-service";

/**
 * A stateless MCP server (Streamable HTTP transport, JSON responses) over the same dataset
 * catalog as the REST API. No sessions and no streaming: every POST is a complete JSON-RPC
 * exchange, which is all a read-only tool server needs and what keeps it cheap to host.
 *
 * Tools: list_datasets, describe_dataset, query_dataset. Every tool result carries the
 * attribution line so a model that quotes it is told to credit InsideGov.
 */

const SERVER_INFO = { name: "insidegov", title: "InsideGov", version: "1.0.0" };
const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;

const INSTRUCTIONS = [
  "InsideGov serves the tables behind its charts on U.S. government: the presidency (executive orders, economy, energy, trade, foreign aid, troops abroad, immigration), Congress (ideology scores, laws, committees, net worth) and the Supreme Court.",
  "Start with list_datasets, then describe_dataset for the units, keys and field meanings before querying; many tables are keyed by an id that joins another table (bioguide_id, justice_id, country codes, term_id).",
  "query_dataset filters, sorts and pages one table. Prefer narrow filters and a few fields over large pulls.",
  `When you use these numbers in an answer, credit InsideGov (${attribution.url}) and name the underlying source from the result. Some tables carry extra terms in their "license" field; follow them.`,
  "The charts describe what the records show during a period; they do not establish that a president or party caused it.",
].join(" ");

const MAX_RESULT_CHARS = 60_000;
const MCP_LIMITS = { defaultLimit: 25, maxLimit: 200 };

const TOOLS = [
  {
    name: "list_datasets",
    title: "List InsideGov datasets",
    description:
      "List the datasets available, with what each row is, its source and the chart page it feeds. Optionally filter by group or a search word.",
    inputSchema: {
      type: "object",
      properties: {
        group: { type: "string", enum: ["presidency", "congress", "court"], description: "Limit to one branch of government." },
        search: { type: "string", description: "Word(s) to look for in the dataset's id, title and description, e.g. 'tariff' or 'refugee'." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "describe_dataset",
    title: "Describe a dataset",
    description:
      "Everything needed to query one dataset correctly: what a row is, the units, the source and any extra terms, every field with its type and meaning, the row count and three sample rows.",
    inputSchema: {
      type: "object",
      properties: { dataset: { type: "string", description: "Dataset id from list_datasets." } },
      required: ["dataset"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "query_dataset",
    title: "Query a dataset",
    description:
      "Fetch rows from one dataset. `filters` maps a field to a value: { country_key: 'MEX' } means equals; write a range as 'low..high' with both ends included, e.g. { fiscal_year: '2010..2020' }, and leave one end off for open-ended ('2010..' means 2010 or later). Returns the total match count so you can page with offset.",
    inputSchema: {
      type: "object",
      properties: {
        dataset: { type: "string", description: "Dataset id from list_datasets." },
        filters: {
          type: "object",
          description: "Field filters, e.g. { \"country_key\": \"MEX\", \"fiscal_year\": \"2010..2020\" }.",
          additionalProperties: { type: ["string", "number", "boolean"] },
        },
        fields: { type: "array", items: { type: "string" }, description: "Columns to return. Default: all." },
        sort: { type: "array", items: { type: "string" }, description: "Fields in order; prefix with - for descending, e.g. ['-fiscal_year']." },
        limit: { type: "integer", minimum: 1, maximum: MCP_LIMITS.maxLimit, description: `Rows to return (default ${MCP_LIMITS.defaultLimit}).` },
        offset: { type: "integer", minimum: 0, description: "Rows to skip, for paging." },
      },
      required: ["dataset"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];

type Json = Record<string, unknown>;

const text = (value: unknown, isError = false) => ({
  content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 1) }],
  ...(isError ? { isError: true } : {}),
});

const asString = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function callTool(name: string, args: Json) {
  if (name === "list_datasets") {
    const group = asString(args.group);
    if (group && !(group in GROUP_LABEL)) return text(`Unknown group "${group}". Use presidency, congress or court.`, true);
    const words = (asString(args.search) ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    const defs = new Map(listDatasetDefs().map((d) => [d.id, d]));
    const rows = catalog()
      .filter((d) => !group || d.group === (group as DatasetGroup))
      .filter((d) => {
        const hay = `${d.id} ${d.title} ${d.description} ${d.grain} ${defs.get(d.id)?.page.label ?? ""}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .map(({ id, title, group_label, description, grain, license }) => ({ id, title, group: group_label, description, grain, license }));
    return text({ attribution: attribution.text, count: rows.length, datasets: rows });
  }

  if (name === "describe_dataset") {
    const id = asString(args.dataset);
    if (!id) return text("Provide `dataset`, an id from list_datasets.", true);
    const d = describe(id);
    if (!d) return text(`Unknown dataset "${id}". Call list_datasets for the ids.`, true);
    // The REST links mean nothing to a tool caller; everything else is the same description.
    return text({ ...d, url: undefined, rows_url: undefined, page: undefined });
  }

  if (name === "query_dataset") {
    const id = asString(args.dataset);
    if (!id) return text("Provide `dataset`, an id from list_datasets.", true);
    if (args.filters !== undefined && (typeof args.filters !== "object" || args.filters === null || Array.isArray(args.filters)))
      return text("`filters` must be an object mapping field names to values.", true);
    const params = paramsFromObject({
      filters: args.filters as Json | undefined,
      fields: args.fields,
      sort: args.sort,
      limit: args.limit,
      offset: args.offset,
    });
    const out = query(id, params, MCP_LIMITS, null);
    if (!out.ok) return text(out.error, true);

    const b = out.body;
    let data = b.data;
    const build = (rows: typeof data, note?: string) => ({
      dataset: b.dataset,
      attribution: b.attribution,
      sources: b.sources,
      license: b.license,
      total: b.total,
      offset: b.offset,
      returned: rows.length,
      next_offset: b.offset + rows.length < b.total ? b.offset + rows.length : null,
      data: rows,
      ...(note ? { note } : {}),
    });
    let result = build(data);
    // Keep a single tool result small enough for a model to read: halve the page until it fits.
    while (JSON.stringify(result).length > MAX_RESULT_CHARS && data.length > 1) {
      data = data.slice(0, Math.ceil(data.length / 2));
      result = build(data, "Rows were cut to fit; continue from next_offset, or ask for fewer fields.");
    }
    return text(result);
  }

  return null;
}

export interface RpcRequest {
  jsonrpc?: unknown;
  id?: string | number | null;
  method?: unknown;
  params?: unknown;
}

const rpcError = (id: RpcRequest["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
const rpcResult = (id: RpcRequest["id"], result: unknown) => ({ jsonrpc: "2.0", id: id ?? null, result });

/** One JSON-RPC message in; the response out, or null for a notification (no reply expected). */
export function handleMessage(msg: RpcRequest): Json | null {
  if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return rpcError(msg && typeof msg === "object" ? msg.id : null, -32600, "Invalid JSON-RPC request.");
  }
  const isNotification = msg.id === undefined;
  const params = (msg.params && typeof msg.params === "object" ? msg.params : {}) as Json;

  switch (msg.method) {
    case "initialize": {
      const asked = asString(params.protocolVersion);
      const protocolVersion = PROTOCOL_VERSIONS.find((v) => v === asked) ?? PROTOCOL_VERSIONS[0];
      return rpcResult(msg.id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return isNotification ? null : rpcResult(msg.id, {});
    case "tools/list":
      return rpcResult(msg.id, { tools: TOOLS });
    case "tools/call": {
      const name = asString(params.name);
      if (!name) return rpcError(msg.id, -32602, "tools/call needs a tool `name`.");
      const args = (params.arguments && typeof params.arguments === "object" ? params.arguments : {}) as Json;
      const result = callTool(name, args);
      return result ? rpcResult(msg.id, result) : rpcError(msg.id, -32602, `Unknown tool "${name}".`);
    }
    default:
      if (isNotification || msg.method.startsWith("notifications/")) return null;
      return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}
