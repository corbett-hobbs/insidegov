import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Draft } from "./drafts";
import { DRAFT_LABEL, issueBody, issueTitle } from "./issue";

/**
 * Opens one GitHub issue per draft in a folder written by run.ts. Skips a draft that already has an issue (open or
 * closed: a rejected draft stays rejected), found by its id in the title. Never posts anything.
 *
 *   pnpm insights:issues -- --dir social-drafts/latest --image-base-url https://raw.githubusercontent.com/OWNER/REPO/social-drafts/images
 *   pnpm insights:issues -- --dir social-drafts/latest --dry-run      # print titles and bodies, call nothing
 *
 * --data-pr URL   link the data-refresh PR the drafts came from
 * Needs `gh` with GH_TOKEN (issues: write) unless --dry-run.
 */

const arg = (flag: string) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined);
const dir = arg("--dir") ?? "social-drafts/latest";
const dryRun = process.argv.includes("--dry-run");
const imageBase = (arg("--image-base-url") ?? dir).replace(/\/$/, "");
const dataPr = arg("--data-pr") || undefined;
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
  existing = JSON.parse(gh(["issue", "list", "--label", DRAFT_LABEL, "--state", "all", "--limit", "500", "--json", "title"])).map((i: { title: string }) => i.title);
}

let opened = 0;
for (const d of drafts) {
  const title = issueTitle(d);
  if (existing.some((t) => t.endsWith(`[${d.id}]`))) {
    console.log(`  exists   ${d.id}`);
    continue;
  }
  const body = issueBody(d, `${imageBase}/${d.image}`, { dataPr, runUrl });
  const bodyFile = join(dir, `${d.slug}.issue.md`);
  writeFileSync(bodyFile, body);
  if (dryRun) {
    console.log(`\n=== DRY RUN: would run gh issue create --label ${DRAFT_LABEL} --title ${JSON.stringify(title)} --body-file ${bodyFile}\n${body}`);
  } else {
    console.log(`  opened   ${gh(["issue", "create", "--title", title, "--label", DRAFT_LABEL, "--body-file", bodyFile])}`);
  }
  opened++;
}
console.log(`insights:issues  ${opened} ${dryRun ? "issues would be opened (dry run)" : "issues opened"}, ${drafts.length - opened} already had one`);
