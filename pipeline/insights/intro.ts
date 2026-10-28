import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { siteInfo } from "../../lib/site-info";
import { type IntroSlide, renderIntroCarousel } from "./carousel";
import { SITE_URL } from "./chart";
import { lengthSection } from "./counts";
import { loadDataset } from "./datasets";
import { APPROVED_LABEL, DRAFT_LABEL, INTRO_LABEL, type DraftBlock, blockComment } from "./issue";

/**
 * The first thing each account posts: a short thread introducing InsideGov and what the account will post, pinned on
 * Bluesky (X has no API for pinning: pin it by hand). The scheduler posts it before any chart (schedule.ts, rule 1).
 *
 *   pnpm insights:intro              # opens the intro issue for approval (label it social-approved to queue it)
 *   pnpm insights:intro -- --print   # just print the thread
 *   pnpm insights:intro -- --instagram social-drafts/intro   # the Instagram intro carousel (slides + caption.txt), posted by hand
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

/**
 * The Instagram intro: a carousel instead of a thread, drawn from the About page (app/about/page.tsx) and ending on a
 * personal note, since the account's first followers include people who worked on the original InsideGov at Graphiq.
 * Keep it in step with the About page when either changes.
 */
const FIRST_NAME = siteInfo.builderName.split(" ")[0]!;

/** The cover's trend lines: real series, about ten years, no numbers (the slide names them only). */
function coverSparks(): { label: string; points: number[] }[] {
  const pick = (dataset: "gas" | "energy" | "trade", id: string, label: string) => {
    const s = loadDataset(dataset).series.find((x) => x.id === id)!;
    const from = `${Number(s.points.at(-1)!.date.slice(0, 4)) - 10}${s.points.at(-1)!.date.slice(4)}`;
    return { label, points: s.points.filter((p) => p.date >= from).map((p) => p.value) };
  };
  return [pick("gas", "gas.regular", "Gas prices, weekly"), pick("energy", "energy.spr", "Strategic Petroleum Reserve"), pick("trade", "trade.deficit", "Goods trade deficit, monthly")];
}

export function introCarousel(): IntroSlide[] {
  return [
    {
      kind: "cover",
      title: "The data behind the headlines",
      sub: "Charts straight from official government records on the presidency, Congress, and the Supreme Court.",
      sparks: coverSparks(),
    },
    {
      kind: "text",
      kicker: "Why it exists",
      title: "News gives you the number, but rarely the context.",
      paragraphs: [
        "You read that something spiked or dropped, but it’s hard to find how it compares to last year—or to the last administration.",
        "InsideGov puts the historical chart in one place, so you can see the trend for yourself.",
      ],
    },
    {
      kind: "list",
      kicker: "What it covers",
      title: "The questions it answers",
      items: [
        "How gas prices, jobs, and the deficit actually moved from one administration to the next.",
        "Who the U.S. trades with and how tariffs have shifted over time.",
        "Executive orders signed by each president, broken down by topic.",
        "Supreme Court rulings and how the ideological center of the bench has moved.",
      ],
    },
    {
      kind: "list",
      kicker: "On this account",
      title: "What you’ll see here",
      items: [
        "When a topic hits the news, a look at how it has changed over the years—from trade deficits to border encounters.",
        "Monthly breakdowns when new data drops, with a quick note on why the numbers moved.",
        "Every figure checked and linked directly to its primary source.",
      ],
    },
    {
      kind: "list",
      kicker: "How to read it",
      title: "The ground rules",
      items: [
        "Every number comes from a named public source. The code and data are fully open.",
        "Charts include context notes on what is being measured—and what to watch out for.",
        "The charts show what the records say, not an opinion on who caused it.",
        "Independent and self-funded. No outside advocacy or institutional backing.",
      ],
    },
    {
      kind: "text",
      kicker: "Who’s behind it",
      title: `Hi, I’m ${FIRST_NAME}`,
      paragraphs: [
        "I studied international politics at Georgetown’s School of Foreign Service and spent time working in a U.S. Senate press office.",
        "Back in 2013, I launched the original InsideGov at Graphiq before Amazon acquired us in 2017. If we crossed paths back then, you’ll likely recognize the name.",
        "Bringing it back is a labor of love. It’s good to see you here.",
      ],
      sign: `${site} · link in bio`,
    },
  ];
}

/** The post's caption (Instagram: no clickable links, so it points to the bio). Revised by the owner, 2026-10-28. */
export const INTRO_INSTAGRAM_CAPTION = [
  "Back when Graphiq was running, some of you might remember InsideGov. I’ve completely rebuilt it from the ground up as a passion project: just clean charts of the data behind the news, pulled straight from official government records.",
  "Moving forward, I’ll be posting a chart whenever a major topic like tariffs or gas prices hits the news, or when key monthly numbers drop. Every figure is checked against the primary source.",
  `Take a look at the full charts and datasets at ${site} (link in bio).`,
  "#govdata #dataviz #publicdata",
].join("\n\n");

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
    lengthSection(block),
    "",
    `**To approve:** add the \`${APPROVED_LABEL}\` label. To change the wording, edit \`thread\` in the block below (Bluesky: 300 characters a post; X: 280, a link counts as 23).`,
    "",
    blockComment(block),
    "",
  ].join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const block = introBlock();
  const igDir = process.argv.includes("--instagram") ? process.argv[process.argv.indexOf("--instagram") + 1] : undefined;
  if (igDir) {
    mkdirSync(igDir, { recursive: true });
    const slides = await renderIntroCarousel(introCarousel());
    slides.forEach((png, i) => writeFileSync(join(igDir, `intro-ig-${i + 1}.png`), png));
    writeFileSync(join(igDir, "intro-caption.txt"), `${INTRO_INSTAGRAM_CAPTION}\n`);
    console.log(`insights:intro  ${slides.length} slides and intro-caption.txt in ${igDir}`);
  } else if (process.argv.includes("--print")) {
    console.log(introIssueBody(block));
  } else {
    const gh = (args: string[]) => execFileSync("gh", args, { encoding: "utf8" }).trim();
    gh(["label", "create", DRAFT_LABEL, "--color", "C5DEF5", "--description", "Social post draft awaiting review (pipeline/insights)", "--force"]);
    gh(["label", "create", APPROVED_LABEL, "--color", "0E8A16", "--description", "Approved for posting: queued for the next slot (pipeline/insights)", "--force"]);
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
