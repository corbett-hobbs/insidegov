import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Draft } from "./drafts";
import { APPROVED_LABEL, DRAFT_LABEL, NEWS_LABEL, issueBody, issueTitle } from "./issue";
import { slotLabel } from "./schedule";

/**
 * Opens one GitHub issue per draft in a folder written by run.ts. Skips a draft that already has an issue (open or
 * closed: a rejected draft stays rejected), found by its id in the title. Never posts anything.
 *
 *   pnpm insights:issues -- --dir social-drafts/latest --image-base-url https://raw.githubusercontent.com/OWNER/REPO/social-drafts/images
 *   pnpm insights:issues -- --dir social-drafts/latest --dry-run      # print titles and bodies, call nothing
 *
 * --data-pr URL   link the data-refresh PR the drafts came from
 * --summary-file F write a plain-text list of the issues opened (the notification email's body)
 * Needs `gh` with GH_TOKEN (issues: write) unless --dry-run.
 */

const arg = (flag: string) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined);
const dir = arg("--dir") ?? "social-drafts/latest";
const dryRun = process.argv.includes("--dry-run");
const imageBase = (arg("--image-base-url") ?? dir).replace(/\/$/, "");
const dataPr = arg("--data-pr") || undefined;
const summaryFile = arg("--summary-file");
const runUrl = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : undefined;

const gh = (args: string[]) => execFileSync("gh", args, { encoding: "utf8" }).trim();

const drafts: Draft[] = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Draft)
  .sort((a, b) => b.score - a.score);
if (drafts.length === 0) {
  console.log(`insights:issues  no drafts in ${dir}`);
  process.exit(0);
}

let existing: string[] = [];
if (!dryRun) {
  gh(["label", "create", DRAFT_LABEL, "--color", "C5DEF5", "--description", "Social post draft awaiting review (pipeline/insights)", "--force"]);
  gh(["label", "create", APPROVED_LABEL, "--color", "0E8A16", "--description", "Approved for posting: queued for the next slot (pipeline/insights)", "--force"]);
  if (drafts.some((d) => d.news)) gh(["label", "create", NEWS_LABEL, "--color", "D93F0B", "--description", "News-linked draft: posts within minutes of approval, expires within a day (pipeline/insights/news)", "--force"]);
  existing = JSON.parse(gh(["issue", "list", "--label", DRAFT_LABEL, "--state", "all", "--limit", "500", "--json", "title"])).map((i: { title: string }) => i.title);
}

let opened = 0;
const summary: string[] = [];
for (const d of drafts) {
  const title = issueTitle(d);
  if (existing.some((t) => t.endsWith(`[${d.id}]`))) {
    console.log(`  exists   ${d.id}`);
    continue;
  }
  const body = issueBody(d, `${imageBase}/${d.image}`, { dataPr, runUrl });
  const labels = d.news ? `${DRAFT_LABEL},${NEWS_LABEL}` : DRAFT_LABEL;
  const bodyFile = join(dir, `${d.slug}.issue.md`);
  writeFileSync(bodyFile, body);
  if (dryRun) {
    console.log(`\n=== DRY RUN: would run gh issue create --label ${labels} --title ${JSON.stringify(title)} --body-file ${bodyFile}\n${body}`);
  } else {
    const url = gh(["issue", "create", "--title", title, "--label", labels, "--body-file", bodyFile]);
    console.log(`  opened   ${url}`);
    const by = d.news ? ` (in the news: ${d.news.headlines[0]?.title ?? d.news.key}; approve by ${slotLabel(d.news.expiresAt)})` : d.release ? ` (queue by ${d.release.expiresOn})` : "";
    summary.push(`- ${d.headline}${by}\n  ${url}`);
  }
  opened++;
}
if (summaryFile && summary.length) writeFileSync(summaryFile, `${summary.length} new social ${summary.length === 1 ? "draft" : "drafts"} to review:\n\n${summary.join("\n")}\n`);
console.log(`insights:issues  ${opened} ${dryRun ? "issues would be opened (dry run)" : "issues opened"}, ${drafts.length - opened} already had one`);
