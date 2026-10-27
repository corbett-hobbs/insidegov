import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { faqFile, type FaqFile } from "../../lib/news-types";
import { FAQ_APPROVED_LABEL, parseFaqBlock } from "./issue";
import { readQuestionList } from "./questions";
import { verifyItem } from "./verify";

/**
 * Publishes an approved FAQ draft: reads the issue's hidden block (with any edits the owner made), re-runs every check against
 * the sources as they read now, and only if all pass writes `pipeline/output/faq_<page>.json`. Run by
 * .github/workflows/faq-publish.yml when the `faq-approved` label is added; the workflow opens the pull request.
 *
 *   pnpm faq:publish -- --issue 412
 *   pnpm faq:publish -- --body-file faq-drafts/economy.issue.md --force     # from a local body, without the label
 *
 * Exits 1, writing nothing, when the issue is not approved or any answer fails; the reasons go to stdout (and to
 * --report-file F for the workflow's issue comment).
 */

const arg = (flag: string) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined);
const issue = arg("--issue");
const bodyFile = arg("--body-file");
const reportFile = arg("--report-file");

let body: string;
if (issue) {
  const v: { body: string; labels: { name: string }[] } = JSON.parse(execFileSync("gh", ["issue", "view", issue, "--json", "body,labels"], { encoding: "utf8" }));
  if (!v.labels.some((l) => l.name === FAQ_APPROVED_LABEL) && !process.argv.includes("--force")) throw new Error(`issue ${issue} does not have the ${FAQ_APPROVED_LABEL} label`);
  body = v.body;
} else if (bodyFile) body = readFileSync(bodyFile, "utf8");
else throw new Error("--issue N or --body-file F");

const fail = (lines: string[]) => {
  console.log(lines.join("\n"));
  if (reportFile) writeFileSync(reportFile, lines.join("\n"));
  process.exit(1);
};

const draft = parseFaqBlock(body);
if (!draft) fail(["The issue's hidden `faq-draft` block is missing or no longer parses (check the JSON if it was edited)."]);
const list = readQuestionList(draft!.page);
const failures: string[] = [];
for (const it of draft!.groups.flatMap((g) => g.items)) {
  const v = await verifyItem(it, list);
  if (!v.ok) failures.push(`- \`${it.id}\` ${it.q}: ${v.reason}`);
}
if (failures.length) fail([`Not published: ${failures.length} answer${failures.length === 1 ? "" : "s"} failed the checks. Fix the answer in the block (or delete the item) and re-add the \`${FAQ_APPROVED_LABEL}\` label.`, "", ...failures]);

// Groups keep the question list's order (the page's own row order), whatever order the block has them in.
const order = list.groups.map((g) => g.row);
const out: FaqFile = faqFile.parse({
  asOf: draft!.asOf,
  groups: [...draft!.groups].filter((g) => g.items.length).sort((a, b) => order.indexOf(a.row) - order.indexOf(b.row)),
});
const file = `pipeline/output/faq_${draft!.page}.json`;
writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
const n = out.groups.reduce((s, g) => s + g.items.length, 0);
console.log(`faq:publish  ${n} answers → ${file}`);
if (reportFile) writeFileSync(reportFile, `All ${n} answers passed the checks again; wrote \`${file}\`.`);
