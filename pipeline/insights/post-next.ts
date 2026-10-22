import { execFileSync } from "node:child_process";
import * as bsky from "./bluesky";
import { checkCaption } from "./caption";
import { SITE_URL } from "./chart";
import { APPROVED_LABEL, type DraftBlock, EXPIRED_LABEL, POSTED_LABEL, parseDraftBlock } from "./issue";
import { type Posted, type QueueItem, SLOTS, type SlotName, pickNext, slotAt } from "./schedule";
import * as x from "./x";

/**
 * One scheduler slot: read the queue (open issues labelled `social-approved`), expire stale drafts, pick at most one
 * post (schedule.ts), and post it to every enabled platform. Run by .github/workflows/social-post.yml.
 *
 *   pnpm insights:post -- --slot morning --dry-run      # print what would happen, change nothing
 *   pnpm insights:post                                  # --slot auto: whichever slot it is now in Pacific time, if any
 *
 * Posts only when SOCIAL_POSTING_ENABLED=true; a platform is enabled when its secrets are set:
 *   Bluesky: BLUESKY_HANDLE, BLUESKY_APP_PASSWORD
 *   X:       X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET  (X_INCLUDE_LINK=true to add the link)
 * Each platform gets a `posted-<platform>` label; the issue closes as `social-posted` once every enabled one has it.
 * The caption is re-checked against the draft's facts first, so an edited caption cannot add a number.
 */

type Platform = "bluesky" | "x";
const arg = (flag: string) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined);
// --slot auto (the scheduled runs): the slot this moment falls in, Pacific time; the cron fires at both UTC hours a
// slot can land on across daylight saving, and the off one exits here.
const slotArg = arg("--slot") ?? "auto";
const slot = (slotArg === "auto" ? slotAt(new Date().toISOString()) : slotArg) as SlotName | null;
if (!slot) {
  console.log(`insights:post  not a posting slot in Pacific time (${SLOTS.map((s) => `${s.localHour}:00`).join(", ")} on weekdays); nothing to do`);
  process.exit(0);
}
if (!SLOTS.some((s) => s.name === slot)) throw new Error(`--slot is auto or one of ${SLOTS.map((s) => s.name).join(", ")}`);
const enabled = process.env.SOCIAL_POSTING_ENABLED === "true" && !process.argv.includes("--dry-run");
const blueskyCreds = process.env.BLUESKY_HANDLE && process.env.BLUESKY_APP_PASSWORD ? { handle: process.env.BLUESKY_HANDLE, password: process.env.BLUESKY_APP_PASSWORD } : null;
const xCreds = x.xCredsFromEnv();
const platforms: Platform[] = [...(blueskyCreds ? (["bluesky"] as const) : []), ...(xCreds ? (["x"] as const) : [])];
const live = enabled && platforms.length > 0;

const gh = (args: string[]) => execFileSync("gh", args, { encoding: "utf8" }).trim();
const act = (what: string, args: string[]) => (live ? gh(args) : console.log(`  [dry run] ${what}`));

type Issue = { number: number; body: string; labels: { name: string }[]; closedAt?: string };
const approved = JSON.parse(gh(["issue", "list", "--label", APPROVED_LABEL, "--state", "open", "--limit", "300", "--json", "number,body,labels"])) as Issue[];
const posted = JSON.parse(gh(["issue", "list", "--label", POSTED_LABEL, "--state", "closed", "--limit", "100", "--json", "body,closedAt"])) as Issue[];

const blocks = new Map<string, { issue: Issue; block: DraftBlock }>();
const queue: QueueItem[] = [];
for (const issue of approved) {
  const block = parseDraftBlock(issue.body);
  if (!block) {
    console.log(`  #${issue.number}: no readable draft block, skipped`);
    continue;
  }
  // Already on every enabled platform (a partly posted draft stays queued for the rest).
  const done = issue.labels.map((l) => l.name);
  if (platforms.length && platforms.every((p) => done.includes(`posted-${p}`))) continue;
  const key = String(issue.number);
  blocks.set(key, { issue, block });
  const r = block.release;
  queue.push({
    key,
    id: block.id,
    kind: block.kind,
    dataset: block.dataset,
    seriesId: block.series_id,
    period: block.period,
    score: block.score,
    frequency: block.frequency ?? "monthly",
    // The intro has no release: always fresh.
    releasedOn: r?.releasedOn ?? "0000-01-01",
    expiresOn: r?.expiresOn ?? "9999-12-31",
  });
}
const history: Posted[] = posted.flatMap((i) => {
  const b = parseDraftBlock(i.body);
  return b && i.closedAt ? [{ dataset: b.dataset, postedAt: i.closedAt }] : [];
});

const now = new Date().toISOString();
const decision = pickNext(queue, history, now, slot);
console.log(`insights:post  ${slot} slot, ${queue.length} queued, platforms: ${platforms.join(", ") || "none configured"}${live ? "" : " (DRY RUN)"}`);

for (const q of [...decision.expired, ...decision.superseded]) {
  const why = decision.expired.includes(q) ? "it went stale before a slot was free (newer data is out or due)" : "a newer draft for the same series is approved";
  console.log(`  expire #${q.key} ${q.id}: ${why}`);
  act(`label #${q.key} ${EXPIRED_LABEL} and close`, ["issue", "close", q.key, "--comment", `Not posted: ${why}.`]);
  act(`label #${q.key}`, ["issue", "edit", q.key, "--add-label", EXPIRED_LABEL, "--remove-label", APPROVED_LABEL]);
}

if (!decision.post) {
  console.log(`  nothing to post: ${decision.reason}`);
  process.exit(0);
}
const { issue, block } = blocks.get(decision.post.key)!;
console.log(`  next: #${issue.number} ${block.id} (${decision.reason})`);

if (block.kind !== "intro") {
  const errors = checkCaption(block.caption, block.facts, { lagged: block.release?.lagged });
  if (errors.length) {
    console.log(`  caption fails the check: ${errors.join("; ")}`);
    act(`comment on #${issue.number}`, ["issue", "comment", String(issue.number), "--body", `Not posted: the caption fails the check (${errors.join("; ")}). Fix \`caption\` in the block and it will be picked up at the next slot.`]);
    process.exit(0);
  }
}

const links: string[] = [];
const succeeded: Platform[] = [];
const todo = platforms.filter((p) => !issue.labels.some((l) => l.name === `posted-${p}`));
for (const p of todo.length ? todo : (["bluesky", "x"] as Platform[])) {
  if (!live) {
    const text = block.kind === "intro" ? block.thread![p].join("\n---\n") : p === "x" ? xText(block) : `${block.caption}\n\n${block.link}`;
    console.log(`  [dry run] ${p} would post:\n${text.replace(/^/gm, "    ")}${block.image_url ? `\n    [image] ${block.image_url}` : ""}`);
    continue;
  }
  try {
    links.push(`${p === "x" ? "X" : "Bluesky"}: ${p === "bluesky" ? await postBluesky(block) : await postX(block)}`);
    gh(["label", "create", `posted-${p}`, "--color", "0E8A16", "--force"]);
    gh(["issue", "edit", String(issue.number), "--add-label", `posted-${p}`]);
    succeeded.push(p);
  } catch (err) {
    console.log(`  ${p} failed: ${(err as Error).message}`);
    gh(["issue", "comment", String(issue.number), "--body", `Posting to ${p} failed; it will be retried at the next slot.\n\n\`\`\`\n${(err as Error).message}\n\`\`\``]);
  }
}
if (live && links.length) {
  gh(["issue", "comment", String(issue.number), "--body", `Posted.\n\n${links.map((l) => `- ${l}`).join("\n")}`]);
  const nowDone = new Set([...issue.labels.map((l) => l.name), ...succeeded.map((p) => `posted-${p}`)]);
  if (platforms.every((p) => nowDone.has(`posted-${p}`))) {
    gh(["label", "create", POSTED_LABEL, "--color", "0E8A16", "--description", "Posted to social media", "--force"]);
    gh(["issue", "edit", String(issue.number), "--add-label", POSTED_LABEL]);
    gh(["issue", "close", String(issue.number)]);
  }
  for (const l of links) console.log(`  posted ${l}`);
}

/** X text: the caption, plus the link only when X_INCLUDE_LINK=true (X charges far more for posts with URLs). */
function xText(b: DraftBlock): string {
  return process.env.X_INCLUDE_LINK === "true" ? `${b.caption}\n\n${b.link}` : b.caption;
}

async function image(b: DraftBlock): Promise<Buffer> {
  const res = await fetch(b.image_url!);
  if (!res.ok) throw new Error(`image ${b.image_url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function postBluesky(b: DraftBlock): Promise<string> {
  const s = await bsky.login(blueskyCreds!.handle, blueskyCreds!.password);
  if (b.kind === "intro") {
    const site = SITE_URL.replace(/^https?:\/\//, "");
    const refs = await bsky.postThread(s, b.thread!.bluesky, [{ text: SITE_URL, uri: SITE_URL }, { text: site, uri: SITE_URL }]);
    await bsky.pinPost(s, refs[0]!);
    return `${bsky.postUrl(s, refs[0]!)} (pinned)`;
  }
  return bsky.postUrl(s, await bsky.postChart(s, b.caption, b.link, await image(b), b.alt));
}

async function postX(b: DraftBlock): Promise<string> {
  if (b.kind === "intro") {
    let parent: string | undefined;
    let first = "";
    for (const text of b.thread!.x) {
      parent = await x.createPost(xCreds!, text, { replyTo: parent });
      first ||= parent;
    }
    return `${x.postUrl(first)} (pin it by hand: X has no API for pinning)`;
  }
  const media = await x.uploadImage(xCreds!, await image(b));
  return x.postUrl(await x.createPost(xCreds!, xText(b), { mediaIds: [media] }));
}
