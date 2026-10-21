import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { SITE_URL } from "./chart";
import { APPROVED_LABEL, DRAFT_LABEL, INTRO_LABEL, type DraftBlock, blockComment } from "./issue";

/**
 * The first thing each account posts: a short thread introducing InsideGov and what the account will post, pinned on
 * Bluesky (X has no API for pinning: pin it by hand). The scheduler posts it before any chart (schedule.ts, rule 1).
 *
 *   pnpm insights:intro              # opens the intro issue for approval (label it social-approved to queue it)
 *   pnpm insights:intro -- --print   # just print the thread
 *
 * Edit the thread here or in the issue's hidden block before approving. Limits: Bluesky 300 graphemes a post; X 280
 * characters, a link counting as 23. X charges more for a post with a link, so only the first X post has one.
 */

const site = SITE_URL.replace(/^https?:\/\//, "");

export const INTRO_THREAD = {
  bluesky: [
    `This is InsideGov (${site}): the U.S. government's own data in one place. Gas prices, energy, trade and tariffs, border encounters and deportations, the deficit, executive orders, the laws Congress passes and Supreme Court decisions.`,
    "From here on, this account posts a chart when new government data comes out. Weekly data (gas prices, the oil reserve) shows up most often; monthly releases (energy, trade, border encounters, executive orders, laws) each month or so; quarterly and yearly figures when they land.",
    "Every number in a post is checked against the source data, a person reviews each post before it goes out, and each one links to the page with the full data and its sources. Corrections are welcome.",
  ],
  x: [
    `This is InsideGov: the U.S. government's own data in one place. Gas prices, energy, trade, border encounters, the deficit, executive orders, the laws Congress passes and Supreme Court decisions. ${SITE_URL}`,
    "From here on, this account posts a chart when new government data comes out. Weekly data (gas prices, the oil reserve) shows up most often; monthly releases (energy, trade, border, executive orders, laws) each month or so; yearly figures when they land.",
    "Every number in a post is checked against the source data, and a person reviews each post before it goes out. The full data and sources are on the site. Corrections are welcome.",
  ],
};

export function introBlock(): DraftBlock {
  return {
    id: "intro",
    kind: "intro",
    dataset: "intro",
    series_id: "intro",
    period: "",
    score: 0,
    caption: INTRO_THREAD.bluesky[0]!,
    link: SITE_URL,
    image_url: null,
    alt: "",
    facts: [],
    release: null,
    thread: INTRO_THREAD,
  };
}

export function introIssueBody(block: DraftBlock): string {
  const t = block.thread!;
  return [
    "The account's first post: a thread introducing InsideGov, posted before any chart and pinned on Bluesky (pin it by hand on X).",
    "",
    "**Bluesky**",
    "",
    ...t.bluesky.flatMap((p, i) => [`${i + 1}. ${p}`, ""]),
    "**X**",
    "",
    ...t.x.flatMap((p, i) => [`${i + 1}. ${p}`, ""]),
    `**To approve:** add the \`${APPROVED_LABEL}\` label. To change the wording, edit \`thread\` in the block below (Bluesky: 300 characters a post; X: 280, a link counts as 23).`,
    "",
    blockComment(block),
    "",
  ].join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const block = introBlock();
  if (process.argv.includes("--print")) {
    console.log(introIssueBody(block));
  } else {
    const gh = (args: string[]) => execFileSync("gh", args, { encoding: "utf8" }).trim();
    gh(["label", "create", INTRO_LABEL, "--color", "D4C5F9", "--description", "The account intro thread (pipeline/insights)", "--force"]);
    const open = JSON.parse(gh(["issue", "list", "--label", INTRO_LABEL, "--state", "all", "--json", "number"])) as unknown[];
    if (open.length) {
      console.log("insights:intro  an intro issue already exists; edit that one");
    } else {
      const file = join(tmpdir(), "social-intro.issue.md");
      writeFileSync(file, introIssueBody(block));
      console.log(gh(["issue", "create", "--title", "Social intro thread [intro]", "--label", `${DRAFT_LABEL},${INTRO_LABEL}`, "--body-file", file]));
    }
  }
}
