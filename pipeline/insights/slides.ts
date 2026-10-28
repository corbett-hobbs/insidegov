import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { instagramCaption } from "./instagram";
import { APPROVED_LABEL, type DraftBlock, EXPIRED_LABEL, parseDraftBlock } from "./issue";

/**
 * Pulls a draft's Instagram carousel onto this Mac, into the Google Drive folder, so it is on the phone a minute later
 * (Instagram is posted by hand, from the phone):
 *
 *   pnpm insights:slides -- --issue 347            # slide-1.png ... and caption.txt in <Drive>/InsideGov Instagram/<date> <draft>/
 *   pnpm insights:slides -- --intro                # the account's intro carousel, rendered here, into <Drive>/InsideGov Instagram/intro/
 *   pnpm insights:slides -- --issue 347 --out DIR  # a folder of your choosing (or set INSTAGRAM_OUT_DIR)
 *   pnpm insights:slides -- --approved             # every approved draft not fetched yet (what the background job runs)
 *
 * The slides are the ones the draft issue already shows (images on the `social-drafts` branch); the caption is the issue's
 * Instagram text, rebuilt from the issue's current caption, so an edit made in the issue comes through. The Drive folder
 * is the one Google Drive for desktop keeps in sync (found under ~/Library/CloudStorage); without it, files go to
 * ~/Downloads/InsideGov Instagram instead and the command says so. Needs `gh`, signed in, for --issue and --approved.
 *
 * --approved looks at issues labelled `social-approved` (open or closed: posting to X and Bluesky closes them) from the last
 * --since-days days (default 7), skips expired ones and ones already fetched (their numbers are kept in a small state file,
 * INSTAGRAM_SYNC_STATE, default ~/.cache/insidegov-instagram-sync.json), and fetches the rest. A failure leaves that issue for
 * the next run. scripts/install-instagram-sync.sh runs it every five minutes in the background on the Mac.
 */

export const FOLDER = "InsideGov Instagram";

/** The slide image links in a draft issue's body (issue.ts slidesSection), in slide order. */
export function slideUrls(body: string): string[] {
  const found = [...body.matchAll(/<a href="([^"]+-ig-(\d+)\.png)">/g)].map((m) => ({ url: m[1]!, n: Number(m[2]) }));
  return [...new Map(found.map((f) => [f.n, f.url])).entries()].sort((a, b) => a[0] - b[0]).map(([, url]) => url);
}

/** Google Drive for desktop's "My Drive" under ~/Library/CloudStorage (GoogleDrive-<account>), or the older ~/Google Drive; null when neither exists. */
export function driveRoot(home: string, exists: (p: string) => boolean = existsSync, list: (p: string) => string[] = (p) => readdirSync(p)): string | null {
  const storage = join(home, "Library/CloudStorage");
  const accounts = exists(storage) ? list(storage).filter((n) => n.startsWith("GoogleDrive-")).sort() : [];
  for (const a of accounts) {
    const mine = join(storage, a, "My Drive");
    if (exists(mine)) return mine;
  }
  const old = join(home, "Google Drive/My Drive");
  return exists(old) ? old : null;
}

/** "2026-10-29 energy-spr-extreme-low-2026-10-16": the day it was fetched, then the draft's id as a slug. */
export function folderName(block: Pick<DraftBlock, "id">, today: string): string {
  const slug = block.id.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return `${today} ${slug}`;
}

/** Where files go: --out, else INSTAGRAM_OUT_DIR, else the Drive folder, else Downloads (with `fellBack` set). */
export function outputRoot(opts: { out?: string; env?: string; home: string; drive: string | null }): { dir: string; fellBack: boolean } {
  if (opts.out) return { dir: opts.out, fellBack: false };
  if (opts.env) return { dir: opts.env, fellBack: false };
  if (opts.drive) return { dir: join(opts.drive, FOLDER), fellBack: false };
  return { dir: join(opts.home, "Downloads", FOLDER), fellBack: true };
}

const arg = (flag: string) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined);
const gh = (args: string[]) => execFileSync("gh", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).trim();

/** An issue that will never have slides (the intro issue, a draft from before carousels): not retried. */
export class SkipIssue extends Error {}

export type ApprovedIssue = { number: number; labels: { name: string }[]; updatedAt: string };

/** The approved issues still to fetch, oldest first (pure, tested). */
export function pending(issues: ApprovedIssue[], synced: number[], now: Date, sinceDays = 7): number[] {
  const cutoff = now.getTime() - sinceDays * 86_400_000;
  return issues
    .filter((i) => i.labels.some((l) => l.name === APPROVED_LABEL) && !i.labels.some((l) => l.name === EXPIRED_LABEL) && !synced.includes(i.number) && Date.parse(i.updatedAt) >= cutoff)
    .map((i) => i.number)
    .sort((a, b) => a - b);
}

const statePath = () => process.env.INSTAGRAM_SYNC_STATE ?? join(homedir(), ".cache/insidegov-instagram-sync.json");

function readState(): number[] {
  try {
    return (JSON.parse(readFileSync(statePath(), "utf8")) as { synced: number[] }).synced;
  } catch {
    return [];
  }
}

function writeState(synced: number[]): void {
  mkdirSync(join(statePath(), ".."), { recursive: true });
  writeFileSync(statePath(), `${JSON.stringify({ synced: [...new Set(synced)].sort((a, b) => a - b) })}\n`);
}

async function fetchApproved(root: string, sinceDays: number): Promise<void> {
  const issues = JSON.parse(gh(["issue", "list", "--label", APPROVED_LABEL, "--state", "all", "--limit", "50", "--json", "number,labels,updatedAt"])) as ApprovedIssue[];
  const synced = readState();
  const todo = pending(issues, synced, new Date(), sinceDays);
  if (!todo.length) {
    console.log("insights:slides  no new approved drafts");
    return;
  }
  for (const n of todo) {
    try {
      await fetchIssue(String(n), root);
      synced.push(n);
    } catch (e) {
      if (e instanceof SkipIssue) {
        console.log(`insights:slides  skipping #${n}: ${e.message}`);
        synced.push(n);
      } else {
        console.log(`insights:slides  #${n} failed, will retry: ${(e as Error).message}`);
      }
    }
    writeState(synced);
  }
}

async function fetchIssue(issue: string, root: string): Promise<string> {
  const { title, body, labels, state } = JSON.parse(gh(["issue", "view", issue, "--json", "title,body,labels,state"])) as { title: string; body: string; labels: { name: string }[]; state: string };
  const block = parseDraftBlock(body);
  if (!block || block.kind === "intro") throw new SkipIssue(`issue ${issue} is not a chart draft (use --intro for the account intro)`);
  const urls = slideUrls(body);
  if (!urls.length) throw new SkipIssue(`issue ${issue} has no Instagram slides: it was drafted before carousels existed`);
  if (!labels.some((l) => l.name === APPROVED_LABEL)) console.log(`note: "${title}" is not labelled ${APPROVED_LABEL} yet (${state.toLowerCase()})`);
  const dir = join(root, folderName(block, new Date().toISOString().slice(0, 10)));
  mkdirSync(dir, { recursive: true });
  for (const [i, url] of urls.entries()) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`could not download slide ${i + 1} (${res.status}): ${url}`);
    writeFileSync(join(dir, `slide-${i + 1}.png`), Buffer.from(await res.arrayBuffer()));
  }
  writeFileSync(join(dir, "caption.txt"), `${instagramCaption(block)}\n`);
  console.log(`insights:slides  ${urls.length} slides and caption.txt for "${title}"`);
  return dir;
}

async function renderIntro(root: string): Promise<string> {
  const { INTRO_INSTAGRAM_CAPTION, introCarousel } = await import("./intro");
  const { renderIntroCarousel } = await import("./carousel");
  const dir = join(root, "intro");
  mkdirSync(dir, { recursive: true });
  const slides = await renderIntroCarousel(introCarousel());
  slides.forEach((png, i) => writeFileSync(join(dir, `slide-${i + 1}.png`), png));
  writeFileSync(join(dir, "caption.txt"), `${INTRO_INSTAGRAM_CAPTION}\n`);
  console.log(`insights:slides  the intro: ${slides.length} slides and caption.txt`);
  return dir;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const issue = arg("--issue");
  if (!issue && !process.argv.includes("--intro") && !process.argv.includes("--approved")) throw new Error("pass --issue N (a draft issue), --approved or --intro");
  const home = homedir();
  const { dir: root, fellBack } = outputRoot({ out: arg("--out"), env: process.env.INSTAGRAM_OUT_DIR, home, drive: driveRoot(home) });
  if (fellBack) console.log("note: no Google Drive folder found (install Google Drive for desktop and sign in); saving to Downloads instead");
  if (process.argv.includes("--approved")) {
    await fetchApproved(root, Number(arg("--since-days") ?? 7));
  } else {
    const dir = issue ? await fetchIssue(issue, root) : await renderIntro(root);
    console.log(`saved to ${dir}`);
  }
}
