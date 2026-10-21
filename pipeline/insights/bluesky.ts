/**
 * Bluesky poster (AT Protocol), called by post-next.ts. Uses the XRPC endpoints directly (no SDK dependency):
 *   com.atproto.server.createSession   log in with the handle and an APP PASSWORD (never the account password)
 *   com.atproto.repo.uploadBlob        the chart PNG
 *   com.atproto.repo.createRecord      an app.bsky.feed.post (link facets, one image with alt text, replies for threads)
 *   com.atproto.repo.getRecord/putRecord on app.bsky.actor.profile/self to pin the intro thread
 */

const SERVICE = process.env.BLUESKY_SERVICE ?? "https://bsky.social";
export const MAX_GRAPHEMES = 300;

export type Blob = { $type: "blob"; ref: { $link: string }; mimeType: string; size: number };
export type StrongRef = { uri: string; cid: string };
export type Session = { accessJwt: string; did: string; handle: string };

export function graphemes(text: string): number {
  return [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(text)].length;
}

/** Link facets (offsets in UTF-8 bytes) for each `text` that appears in the post, pointing at `uri`. */
export function linkFacets(text: string, links: { text: string; uri: string }[]) {
  return links.flatMap((l) => {
    const at = text.indexOf(l.text);
    if (at < 0) return [];
    const byteStart = Buffer.byteLength(text.slice(0, at), "utf8");
    return [{ index: { byteStart, byteEnd: byteStart + Buffer.byteLength(l.text, "utf8") }, features: [{ $type: "app.bsky.richtext.facet#link", uri: l.uri }] }];
  });
}

/** The app.bsky.feed.post record for a chart: caption, blank line, link (as a facet), one image. */
export function buildPostRecord(caption: string, link: string, image: Blob, alt: string, createdAt: string) {
  const text = `${caption}\n\n${link}`;
  if (graphemes(text) > MAX_GRAPHEMES) throw new Error(`post is ${graphemes(text)} graphemes; Bluesky allows ${MAX_GRAPHEMES}`);
  return {
    $type: "app.bsky.feed.post",
    text,
    createdAt,
    langs: ["en"],
    facets: linkFacets(text, [{ text: link, uri: link }]),
    embed: { $type: "app.bsky.embed.images", images: [{ alt: alt.slice(0, 2000), image, aspectRatio: { width: 1200, height: 675 } }] },
  };
}

async function xrpc<T>(method: string, init: RequestInit & { query?: Record<string, string> }): Promise<T> {
  const qs = init.query ? `?${new URLSearchParams(init.query)}` : "";
  const res = await fetch(`${SERVICE}/xrpc/${method}${qs}`, init);
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

export async function login(handle: string, password: string): Promise<Session> {
  return xrpc<Session>("com.atproto.server.createSession", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: handle, password }),
  });
}

const auth = (s: Session) => ({ Authorization: `Bearer ${s.accessJwt}` });

async function createPostRecord(s: Session, record: object): Promise<StrongRef> {
  return xrpc<StrongRef>("com.atproto.repo.createRecord", {
    method: "POST",
    headers: { ...auth(s), "Content-Type": "application/json" },
    body: JSON.stringify({ repo: s.did, collection: "app.bsky.feed.post", record }),
  });
}

export function postUrl(s: Session, ref: StrongRef): string {
  return `https://bsky.app/profile/${s.handle}/post/${ref.uri.split("/").at(-1)}`;
}

export async function postChart(s: Session, caption: string, link: string, png: Buffer, alt: string): Promise<StrongRef> {
  const { blob } = await xrpc<{ blob: Blob }>("com.atproto.repo.uploadBlob", { method: "POST", headers: { ...auth(s), "Content-Type": "image/png" }, body: new Uint8Array(png) });
  return createPostRecord(s, buildPostRecord(caption, link, blob, alt, new Date().toISOString()));
}

/** Posts `texts` as a thread (each a reply to the one before); `links` become facets wherever they appear. */
export async function postThread(s: Session, texts: string[], links: { text: string; uri: string }[]): Promise<StrongRef[]> {
  const refs: StrongRef[] = [];
  for (const text of texts) {
    if (graphemes(text) > MAX_GRAPHEMES) throw new Error(`thread post is ${graphemes(text)} graphemes; Bluesky allows ${MAX_GRAPHEMES}`);
    const reply = refs.length ? { root: refs[0], parent: refs.at(-1) } : undefined;
    refs.push(await createPostRecord(s, { $type: "app.bsky.feed.post", text, createdAt: new Date().toISOString(), langs: ["en"], facets: linkFacets(text, links), ...(reply ? { reply } : {}) }));
  }
  return refs;
}

/** Pins a post on the profile (the profile record's `pinnedPost`), keeping the rest of the profile as it is. */
export async function pinPost(s: Session, ref: StrongRef): Promise<void> {
  const cur = await xrpc<{ value: Record<string, unknown>; cid: string }>("com.atproto.repo.getRecord", {
    method: "GET",
    query: { repo: s.did, collection: "app.bsky.actor.profile", rkey: "self" },
  });
  await xrpc("com.atproto.repo.putRecord", {
    method: "POST",
    headers: { ...auth(s), "Content-Type": "application/json" },
    body: JSON.stringify({ repo: s.did, collection: "app.bsky.actor.profile", rkey: "self", record: { ...cur.value, pinnedPost: ref }, swapRecord: cur.cid }),
  });
}
