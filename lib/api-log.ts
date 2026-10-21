import "server-only";

/**
 * One structured log line per API or MCP call, for Vercel's runtime logs (filter on `"evt":"insidegov_api"`).
 * No IP, no query values, no body: just which surface, which dataset or tool, and the client's self-declared
 * user agent, so usage can be counted without storing anything about the caller.
 */
export function logApiCall(surface: "rest" | "mcp", detail: Record<string, string | number | null>, request: Request): void {
  try {
    console.log(
      JSON.stringify({
        evt: "insidegov_api",
        surface,
        ...detail,
        ua: (request.headers.get("user-agent") ?? "").slice(0, 80),
      }),
    );
  } catch {
    // Logging must never fail a request.
  }
}
