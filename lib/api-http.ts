import "server-only";

/** Browsers on other sites may call the API and the MCP endpoint directly. Read-only, no cookies. */
export const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, accept, mcp-protocol-version, mcp-session-id",
  "access-control-expose-headers": "x-total-count, x-attribution",
  "access-control-max-age": "86400",
};

/** The data changes only when the site is rebuilt, so a CDN may hold an answer for an hour. */
const CACHE_OK = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

/** Vercel functions cannot return more than 4.5 MB; stay under it and say how to ask for less. */
export const MAX_BODY_BYTES = 4_000_000;

export const apiJson = (body: unknown, status = 200): Response =>
  Response.json(body, { status, headers: { ...CORS, "cache-control": status === 200 ? CACHE_OK : "no-store" } });

export const apiError = (status: number, message: string): Response =>
  Response.json({ error: { status, message } }, { status, headers: { ...CORS, "cache-control": "no-store" } });

export const preflight = (): Response => new Response(null, { status: 204, headers: CORS });

export const apiText = (text: string, contentType: string, extra: Record<string, string> = {}): Response =>
  new Response(text, { headers: { ...CORS, "content-type": contentType, "cache-control": CACHE_OK, ...extra } });
