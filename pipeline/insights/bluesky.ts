import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { checkCaption } from "./caption";
import { APPROVED_LABEL, POSTED_LABEL, type DraftBlock, parseDraftBlock } from "./issue";

/**
 * Bluesky poster (AT Protocol) for an APPROVED draft issue. Stub, disabled: it posts only when ALL of these hold,
 * and otherwise prints the record it would have posted.
 *   - env SOCIAL_POSTING_ENABLED=true (the social-post workflow passes the repo variable of the same name, unset by default)
 *   - env BLUESKY_HANDLE and BLUESKY_APP_PASSWORD (an app password from Settings > Privacy and security, never the main one)
 *   - the issue has the `social-approved` label and not `social-posted`
 *   - the caption in the issue's hidden block still passes checkCaption against its facts (so an edit cannot add numbers)
 *
 *   pnpm insights:post -- --issue 123        # dry run unless enabled as above
 *
 * Uses the XRPC endpoints directly (no SDK dependency): com.atproto.server.createSession, com.atproto.repo.uploadBlob,
 * com.atproto.repo.createRecord with an app.bsky.feed.post record (link facet + one image with alt text).
 */

const SERVICE = process.env.BLUESKY_SERVICE ?? "https://bsky.social";
export const MAX_GRAPHEMES = 300;

type Blob = { $type: "blob"; ref: { $link: string }; mimeType: string; size: number };

export function graphemes(text: string): number {
  return [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(text)].length;
}

/** The app.bsky.feed.post record: caption, blank line, link (as a link facet, offsets in UTF-8 bytes), one image. */
export function buildPostRecord(caption: string, link: string, image: Blob, alt: string, createdAt: string) {
  const text = `${caption}\n\n${link}`;
  if (graphemes(text) > MAX_GRAPHEMES) throw new Error(`post is ${graphemes(text)} graphemes; Bluesky allows ${MAX_GRAPHEMES}`);
  const byteStart = Buffer.byteLength(`${caption}\n\n`, "utf8");
  return {
    $type: "app.bsky.feed.post",
    text,
    createdAt,
    langs: ["en"],
    facets: [{ index: { byteStart, byteEnd: byteStart + Buffer.byteLength(link, "utf8") }, features: [{ $type: "app.bsky.richtext.facet#link", uri: link }] }],
    embed: { $type: "app.bsky.embed.images", images: [{ alt: alt.slice(0, 2000), image, aspectRatio: { width: 1200, height: 675 } }] },
  };
}

async function xrpc<T>(method: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${SERVICE}/xrpc/${method}`, init);
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

export async function postToBluesky(block: DraftBlock, png: Buffer, creds: { handle: string; password: string }): Promise<string> {
  const session = await xrpc<{ accessJwt: string; did: string }>("com.atproto.server.createSession", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: creds.handle, password: creds.password }),
  });
  const auth = { Authorization: `Bearer ${session.accessJwt}` };
  const { blob } = await xrpc<{ blob: Blob }>("com.atproto.repo.uploadBlob", { method: "POST", headers: { ...auth, "Content-Type": "image/png" }, body: new Uint8Array(png) });
  const record = buildPostRecord(block.caption, block.link, blob, block.alt, new Date().toISOString());
  const created = await xrpc<{ uri: string }>("com.atproto.repo.createRecord", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ repo: session.did, collection: "app.bsky.feed.post", record }),
  });
  // at://did/app.bsky.feed.post/<rkey> -> the public URL
  return `https://bsky.app/profile/${creds.handle}/post/${created.uri.split("/").at(-1)}`;
}

async function main() {
  const arg = (flag: string) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined);
  const issue = arg("--issue");
  if (!issue) throw new Error("pass --issue N");
  const gh = (args: string[]) => execFileSync("gh", args, { encoding: "utf8" }).trim();
  const data = JSON.parse(gh(["issue", "view", issue, "--json", "body,labels,state"])) as { body: string; labels: { name: string }[]; state: string };
  const labels = data.labels.map((l) => l.name);
  if (!labels.includes(APPROVED_LABEL)) throw new Error(`issue ${issue} is not labelled ${APPROVED_LABEL}`);
  if (labels.includes(POSTED_LABEL)) {
    console.log(`issue ${issue} is already ${POSTED_LABEL}; nothing to do`);
    return;
  }
  const block = parseDraftBlock(data.body);
  if (!block) throw new Error(`issue ${issue} has no readable social-draft block`);
  const errors = checkCaption(block.caption, block.facts);
  if (errors.length) throw new Error(`caption fails the check: ${errors.join("; ")}`);
  const enabled = process.env.SOCIAL_POSTING_ENABLED === "true";
  const handle = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;
  if (!enabled || !handle || !password) {
    const fakeBlob: Blob = { $type: "blob", ref: { $link: "(uploaded image)" }, mimeType: "image/png", size: 0 };
    console.log(`DRY RUN (posting disabled: set SOCIAL_POSTING_ENABLED=true, BLUESKY_HANDLE and BLUESKY_APP_PASSWORD). Would post:`);
    console.log(JSON.stringify(buildPostRecord(block.caption, block.link, fakeBlob, block.alt, new Date().toISOString()), null, 2));
    return;
  }
  const res = await fetch(block.image_url);
  if (!res.ok) throw new Error(`image ${block.image_url}: HTTP ${res.status}`);
  const url = await postToBluesky(block, Buffer.from(await res.arrayBuffer()), { handle, password });
  gh(["issue", "comment", issue, "--body", `Posted to Bluesky: ${url}`]);
  gh(["label", "create", POSTED_LABEL, "--color", "0E8A16", "--description", "Posted to social media", "--force"]);
  gh(["issue", "edit", issue, "--add-label", POSTED_LABEL]);
  gh(["issue", "close", issue]);
  console.log(`posted ${url}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
