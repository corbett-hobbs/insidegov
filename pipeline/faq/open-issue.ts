import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { FAQ_APPROVED_LABEL, FAQ_DRAFT_LABEL, faqDraft, issueBody, issueKey, issueTitle } from "./issue";
import { FAQ_PAGES, type FaqPage } from "./questions";

/**
 * Opens the approval issue for one page's FAQ drafts (`faq-drafts/<page>.json`, from `pnpm faq:draft`). A page has one open
 * draft issue at a time: if one is open, its body is replaced with the new drafts (an approval label already on it is
 * removed, since what was approved has changed). Never publishes anything.
 *
 *   pnpm faq:issue -- --page economy
 *   pnpm faq:issue -- --page economy --dry-run      # print the title and body, call nothing
 *
 * Needs `gh` with GH_TOKEN (issues: write) unless --dry-run.
 */

const arg = (flag: string) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined);
const page = arg("--page") as FaqPage | undefined;
if (!page || !FAQ_PAGES.includes(page)) throw new Error(`--page ${FAQ_PAGES.join(" | ")}`);
const dryRun = process.argv.includes("--dry-run");
const runUrl = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : undefined;
const gh = (args: string[]) => execFileSync("gh", args, { encoding: "utf8" }).trim();

const draft = faqDraft.parse(JSON.parse(readFileSync(`faq-drafts/${page}.json`, "utf8")));
if (draft.groups.length === 0) {
  console.log(`faq:issue  ${page}: no answers passed the checks; no issue opened`);
  process.exit(0);
}
const title = issueTitle(draft);
const bodyFile = `faq-drafts/${page}.issue.md`;
writeFileSync(bodyFile, issueBody(draft, { runUrl }));
if (dryRun) {
  console.log(`=== DRY RUN: ${title}\n${readFileSync(bodyFile, "utf8")}`);
  process.exit(0);
}
gh(["label", "create", FAQ_DRAFT_LABEL, "--color", "C5DEF5", "--description", "FAQ answers awaiting review (pipeline/faq)", "--force"]);
gh(["label", "create", FAQ_APPROVED_LABEL, "--color", "0E8A16", "--description", "Approved: publish these FAQ answers (pipeline/faq)", "--force"]);
const open: { number: number; title: string; url: string }[] = JSON.parse(gh(["issue", "list", "--label", FAQ_DRAFT_LABEL, "--state", "open", "--limit", "100", "--json", "number,title,url"]));
const mine = open.find((i) => i.title.endsWith(issueKey(page)));
if (mine) {
  gh(["issue", "edit", String(mine.number), "--title", title, "--body-file", bodyFile, "--remove-label", FAQ_APPROVED_LABEL]);
  console.log(`faq:issue  ${page}: updated ${mine.url}`);
} else {
  console.log(`faq:issue  ${page}: opened ${gh(["issue", "create", "--title", title, "--label", FAQ_DRAFT_LABEL, "--body-file", bodyFile])}`);
}
