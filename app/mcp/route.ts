import { logApiCall } from "@/lib/api-log";
import { CORS, preflight } from "@/lib/api-http";
import { handleMessage, type RpcRequest } from "@/lib/mcp-server";

/**
 * `/mcp` — InsideGov's MCP server (Streamable HTTP, stateless, JSON responses). Point an MCP client
 * at this URL; it exposes list_datasets, describe_dataset and query_dataset over the same tables as
 * `/api/v1`. Documented at `/api`.
 */
const JSON_HEADERS = { ...CORS, "content-type": "application/json", "cache-control": "no-store" };

/** The method, and for tools/call the tool and dataset, of each message in a request body. */
function logMessages(body: unknown, request: Request) {
  for (const m of Array.isArray(body) ? body : [body]) {
    const msg = (m && typeof m === "object" ? m : {}) as { method?: unknown; params?: { name?: unknown; arguments?: { dataset?: unknown; id?: unknown } } };
    const arg = msg.params?.arguments;
    const dataset = arg?.dataset ?? arg?.id;
    logApiCall(
      "mcp",
      {
        method: typeof msg.method === "string" ? msg.method.slice(0, 40) : null,
        tool: typeof msg.params?.name === "string" ? msg.params.name.slice(0, 40) : null,
        dataset: typeof dataset === "string" ? dataset.slice(0, 60) : null,
      },
      request,
    );
  }
}

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reply({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error: the body must be JSON." } }, 400);
  }

  logMessages(body, request);

  if (Array.isArray(body)) {
    const out = body.map((m) => handleMessage(m as RpcRequest)).filter((r) => r !== null);
    return out.length ? reply(out) : new Response(null, { status: 202, headers: CORS });
  }
  const out = handleMessage(body as RpcRequest);
  return out ? reply(out) : new Response(null, { status: 202, headers: CORS });
}

// No server-initiated stream and no sessions to end: tell a client that tries to open one.
const notAllowed = () =>
  new Response("This MCP server answers POST requests only.", { status: 405, headers: { ...CORS, allow: "POST, OPTIONS" } });
export const GET = notAllowed;
export const DELETE = notAllowed;
export const OPTIONS = preflight;
