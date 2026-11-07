import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { refreshCounts } from "./counts";
import { parseDraftBlock } from "./issue";

/**
 * Rewrites a draft issue's Length section from its current text (run by social-counts.yml when the issue is edited):
 *
 *   pnpm exec tsx pipeline/insights/update-counts.ts --issue 343
 *
 * An edit made with the workflow's own token does not trigger the workflow again, so this cannot loop.
 */
const issue = process.argv[process.argv.indexOf("--issue") + 1];
if (!issue) throw new Error("pass --issue N");
const gh = (args: string[]) => execFileSync("gh", args, { encoding: "utf8" }).trim();
const { body } = JSON.parse(gh(["issue", "view", issue, "--json", "body"])) as { body: string };
const block = parseDraftBlock(body);
if (!block) {
  console.log(`issue ${issue}: no readable draft block (is the JSON still valid?); left as it is`);
  process.exit(0);
}
const next = refreshCounts(body, block);
if (next === body) {
  console.log(`issue ${issue}: lengths already current`);
} else {
  const file = join(tmpdir(), `social-counts-${issue}.md`);
  writeFileSync(file, next);
  gh(["issue", "edit", issue, "--body-file", file]);
  console.log(`issue ${issue}: lengths updated`);
}
