import { createHmac, randomBytes } from "node:crypto";

/**
 * X (Twitter) poster: X API v2 with OAuth 1.0a user context (an app's consumer key/secret plus the account's access
 * token/secret, which do not expire, so the scheduled workflow needs no token refresh).
 *
 *   media: POST /2/media/upload/initialize -> /{id}/append -> /{id}/finalize (category tweet_image)
 *   post:  POST /2/tweets { text, media: { media_ids }, reply: { in_reply_to_tweet_id } }
 *
 * X bills per request (pay-per-use since 2026): a post costs much more when its text has a URL, so by default chart
 * posts carry no link (the chart's footer shows the page address); set X_INCLUDE_LINK=true to add it.
 */

const API = process.env.X_API_BASE ?? "https://api.x.com";

export type XCreds = { consumerKey: string; consumerSecret: string; token: string; tokenSecret: string };

/** RFC 3986 percent-encoding, as OAuth 1.0a requires. */
export function pct(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * The OAuth 1.0a `Authorization` header. `params` are the query-string or form parameters that are part of the
 * signature (JSON and multipart bodies are not).
 */
export function oauthHeader(method: string, url: string, creds: XCreds, params: Record<string, string> = {}, nonce = randomBytes(16).toString("hex"), timestamp = String(Math.floor(Date.now() / 1000))): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: creds.token,
    oauth_version: "1.0",
  };
  const all = { ...params, ...oauth };
  const paramString = Object.keys(all)
    .map((k) => [pct(k), pct(all[k]!)] as const)
    .sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const base = `${method.toUpperCase()}&${pct(url.split("?")[0]!)}&${pct(paramString)}`;
  const signature = createHmac("sha1", `${pct(creds.consumerSecret)}&${pct(creds.tokenSecret)}`).update(base).digest("base64");
  return `OAuth ${Object.entries({ ...oauth, oauth_signature: signature })
    .map(([k, v]) => `${pct(k)}="${pct(v)}"`)
    .join(", ")}`;
}

async function call<T>(creds: XCreds, method: string, path: string, body?: { json?: unknown; form?: FormData }): Promise<T> {
  const url = `${API}${path}`;
  // Query parameters are part of the OAuth signature.
  const headers: Record<string, string> = { Authorization: oauthHeader(method, url, creds, Object.fromEntries(new URL(url).searchParams)) };
  let payload: BodyInit | undefined;
  if (body?.json !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body.json);
  } else if (body?.form) payload = body.form;
  const res = await fetch(url, { method, headers, body: payload });
  const text = await res.text();
  if (!res.ok) throw new Error(`X ${method} ${path}: HTTP ${res.status} ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

export async function uploadImage(creds: XCreds, png: Buffer): Promise<string> {
  const init = await call<{ data: { id: string } }>(creds, "POST", "/2/media/upload/initialize", {
    json: { media_type: "image/png", total_bytes: png.length, media_category: "tweet_image" },
  });
  const id = init.data.id;
  const form = new FormData();
  form.append("segment_index", "0");
  form.append("media", new Blob([new Uint8Array(png)], { type: "image/png" }), "chart.png");
  await call(creds, "POST", `/2/media/upload/${id}/append`, { form });
  let fin = await call<{ data?: { processing_info?: { state: string; check_after_secs?: number } } }>(creds, "POST", `/2/media/upload/${id}/finalize`);
  for (let i = 0; i < 10 && fin.data?.processing_info && fin.data.processing_info.state !== "succeeded"; i++) {
    if (fin.data.processing_info.state === "failed") throw new Error(`X media ${id} failed processing`);
    await new Promise((r) => setTimeout(r, 1000 * (fin.data!.processing_info!.check_after_secs ?? 1)));
    fin = await call(creds, "GET", `/2/media/upload?command=STATUS&media_id=${id}`);
  }
  return id;
}

/** Posts one tweet; returns its id. */
export async function createPost(creds: XCreds, text: string, opts: { mediaIds?: string[]; replyTo?: string } = {}): Promise<string> {
  const res = await call<{ data: { id: string } }>(creds, "POST", "/2/tweets", {
    json: {
      text,
      ...(opts.mediaIds?.length ? { media: { media_ids: opts.mediaIds } } : {}),
      ...(opts.replyTo ? { reply: { in_reply_to_tweet_id: opts.replyTo } } : {}),
    },
  });
  return res.data.id;
}

export const postUrl = (id: string) => `https://x.com/i/web/status/${id}`;

/** X counts every link as 23 characters. */
export function xLength(text: string): number {
  return [...text.replace(/https?:\/\/\S+/g, "x".repeat(23))].length;
}
export const X_MAX = 280;

export function xCredsFromEnv(): XCreds | null {
  const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET } = process.env;
  return X_API_KEY && X_API_SECRET && X_ACCESS_TOKEN && X_ACCESS_TOKEN_SECRET
    ? { consumerKey: X_API_KEY, consumerSecret: X_API_SECRET, token: X_ACCESS_TOKEN, tokenSecret: X_ACCESS_TOKEN_SECRET }
    : null;
}
