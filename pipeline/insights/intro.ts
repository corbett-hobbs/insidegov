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

const POST_1 = `The news runs on numbers—tariffs, deportations, deficits, Supreme Court rulings—but rarely comes with the charts. InsideGov (${site}) pulls straight from official public records to put the historical data behind the headlines in one place.`;
const POST_2 =
  "From here on, this account posts a chart the moment fresh government data lands. Expect weekly updates on gas and energy, monthly releases on trade, immigration, and executive orders, and deeper metrics as they drop.";

export const INTRO_THREAD = {
  bluesky: [
    POST_1,
    POST_2,
    "Every chart links directly to the full dataset and its primary government sources. Our numbers are checked, but if you ever spot a discrepancy, corrections are always welcome.",
  ],
  // X posts carry no link by default (it bills more for them), so its third post points to the site instead.
  x: [
    POST_1,
    POST_2,
    "Every chart's full dataset and primary government sources are on the site. Our numbers are checked, but if you ever spot a discrepancy, corrections are always welcome.",
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
