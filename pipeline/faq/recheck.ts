import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { faqFile } from "../../lib/news-types";
import { FAQ_RECHECK_LABEL } from "./issue";
import { FAQ_PAGES, readQuestionList, type FaqPage } from "./questions";
import { verifyItem } from "./verify";

/**
 * Re-runs the checks on every published FAQ answer against its sources as they read now (and the site's data, for answers
 * that quote it), so an answer a data update or a revised source page has overtaken is caught. Run by
 * .github/workflows/faq-recheck.yml when a page's data files change on main, and weekly.
 *
 *   pnpm faq:recheck                       # every page with a published file; exit 1 if any answer fails
 *   pnpm faq:recheck -- --page immigration
 *   pnpm faq:recheck -- --open-issues      # one `faq-recheck` issue per page with failures (skipped if one is open)
 *
 * A source that cannot be read is reported but does not count as a failure (agency sites go down).
 */

const arg = (flag: string) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined);
const pages = (arg("--page")?.split(",") ?? FAQ_PAGES) as FaqPage[];
const openIssues = process.argv.includes("--open-issues");
const gh = (args: string[]) => execFileSync("gh", args, { encoding: "utf8" }).trim();

let failed = 0;
for (const page of pages) {
  const file = `pipeline/output/faq_${page}.json`;
  if (!existsSync(file)) continue;
  const published = faqFile.parse(JSON.parse(readFileSync(file, "utf8")));
  const items = published.groups.flatMap((g) => g.items);
  if (items.length === 0) continue;
  const list = readQuestionList(page);
  const failures: string[] = [];
  const unreadable: string[] = [];
  for (const it of items) {
    const v = await verifyItem(it, list);
    if (v.ok) continue;
    (v.unreadable ? unreadable : failures).push(`- \`${it.id}\` ${it.q}\n  > ${it.a}\n\n  ${v.reason}`);
  }
  console.log(`faq:recheck  ${page}: ${items.length - failures.length - unreadable.length} pass, ${failures.length} fail, ${unreadable.length} unreadable`);
  for (const f of [...failures, ...unreadable]) console.log(f);
  failed += failures.length;
  if (!openIssues || failures.length === 0) continue;
  gh(["label", "create", FAQ_RECHECK_LABEL, "--color", "D93F0B", "--description", "A published FAQ answer no longer passes its checks (pipeline/faq)", "--force"]);
  const key = `[faq-recheck-${page}]`;
  const open: { title: string; url: string }[] = JSON.parse(gh(["issue", "list", "--label", FAQ_RECHECK_LABEL, "--state", "open", "--json", "title,url"]));
  const existing = open.find((i) => i.title.endsWith(key));
  if (existing) {
    console.log(`  already open: ${existing.url}`);
    continue;
  }
  const body = [
    `${failures.length} published answer${failures.length === 1 ? "" : "s"} in \`${file}\` no longer pass${failures.length === 1 ? "es" : ""} the checks in \`pipeline/faq/check.ts\` against the sources and data as they read now, usually because a figure has been updated.`,
    "",
    ...failures,
    "",
    `**To fix:** redraft (\`pnpm faq:draft -- --page ${page} --only <ids>\`, then \`pnpm faq:issue -- --page ${page}\`) and approve the new draft, or remove the answer from \`${file}\` by hand. Close this issue when done.`,
  ].join("\n");
  const bodyFile = `faq-recheck-${page}.md`;
  writeFileSync(bodyFile, body);
  console.log(`  opened ${gh(["issue", "create", "--title", `FAQ answers to update: ${page} ${key}`, "--label", FAQ_RECHECK_LABEL, "--body-file", bodyFile])}`);
}
if (failed && !openIssues) process.exit(1);
