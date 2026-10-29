import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { DATASETS, loadDataset } from "../datasets";
import { buildDrafts } from "../drafts";
import { releaseFor } from "../freshness";
import { NEWS_LABEL } from "../issue";
import { localDate } from "../schedule";
import type { Headline, Insight, Series } from "../types";
import { type Candidate, addCompanions, groupCandidates, needsCheck, pickHeadlines, sameDevelopment } from "./cards";
import { balanceContext, tariffContext, tariffPartners, seriesContext } from "./charts";
import { checkCandidate } from "./classify";
import { fetchDataReleases, fetchOutletHeadlines } from "./feeds";
import { NEWS_FRESH_HOURS, NEWS_MAX_PER_RUN, type WatchState, inCooldown, newsId, partnersFor, pruneState } from "./match";
import { planRefreshes, recordDispatch } from "./refresh";
import { type SocialStory, coverageLine, couldDraft, hasRecent, postableCharts, socialStories } from "./social";
import { COUNTRY_ALIASES, MIN_PARTNER_IMPORTS, PAGE_TOPICS } from "./topics";

/**
 * The news watcher: finds the stories the pages' "In the news" cards would show (the same detector, news/cards.ts: the
 * outlets' own feeds, one topic per headline, a story over a few days, the Claude check that keeps one development,
 * the two-outlet rule), and drafts a context chart for each one the site has a series for (social.ts). Run hourly by
 * .github/workflows/social-news.yml through .github/actions/social-drafts; nothing is posted here. The drafts become
 * `social-draft` + `social-news` issues, and an approved one posts within minutes (schedule.ts pickNews).
 *
 *   pnpm insights:news                         # watch once, write drafts to social-drafts/news
 *   pnpm insights:news -- --no-llm             # word rules only, template captions
 *   pnpm insights:news -- --github             # skip stories already drafted (reads issue titles with gh)
 *
 * --out DIR      where drafts go (default social-drafts/news)
 * --now ISO      pretend it is this moment (headline recency, freshness)
 * --state FILE   the Claude check's answers and the refreshes dispatched, read and rewritten
 * --no-dispatch  do not start data refresh workflows (a dry run; they are only started with --github anyway)
 *
 * It also keeps the data fresh: when an agency's release is newer than the data behind a topic's chart, the topic's
 * freshness workflow is dispatched and a story on that topic waits for the data (news/refresh.ts).
 */

try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local (CI passes the secret as an env var) */
}

const arg = (flag: string) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined);
const outDir = arg("--out") ?? "social-drafts/news";
const useLlm = !process.argv.includes("--no-llm") && Boolean(process.env.ANTHROPIC_API_KEY);
const now = arg("--now") ?? new Date().toISOString();
const stateFile = arg("--state");
const state: WatchState = { checks: {}, dispatched: {}, ...(stateFile && existsSync(stateFile) ? (JSON.parse(readFileSync(stateFile, "utf8") || "{}") as Partial<WatchState>) : {}) };
const today = localDate(now);
const output = (line: string) => process.env.GITHUB_OUTPUT && appendFileSync(process.env.GITHUB_OUTPUT, `${line}\n`);

// Draft ids already used (open or closed: a rejected story stays rejected), for the cooldown.
let earlier: string[] = [];
if (process.argv.includes("--github")) {
  // A failed listing must not turn into a flood of duplicates: without it, nothing is drafted this run.
  const titles = JSON.parse(execFileSync("gh", ["issue", "list", "--label", NEWS_LABEL, "--state", "all", "--limit", "300", "--json", "title"], { encoding: "utf8" })) as { title: string }[];
  earlier = titles.flatMap((t) => t.title.match(/\[(news:[^\]]+)\]$/)?.[1] ?? []);
}

const client = useLlm ? new Anthropic({ maxRetries: 4 }) : null;
// The roster outlets only: the end reserves (Mother Jones, Breitbart) back up a page card, they do not start a post.
const headlines = await fetchOutletHeadlines({ includeReserves: false });
const partners = partnersFor(tariffPartners(MIN_PARTNER_IMPORTS), COUNTRY_ALIASES);
const usable = (h: Headline) => client !== null || !needsCheck(h);
const candidates = addCompanions(groupCandidates(headlines, PAGE_TOPICS, partners, now, usable), headlines.filter(usable), PAGE_TOPICS, partners, now);
// Only a story that could be drafted is checked: two outlets, a first headline from the last day, a chart to give it.
const worth = candidates.filter((c) => couldDraft(c.topic) && pickHeadlines(c.headlines) && hasRecent(c.headlines, now));
console.log(`insights:news  ${headlines.length} outlet headlines, ${candidates.length} candidate stories, ${worth.length} worth a check: ${worth.map((c) => c.key).join(", ") || "none"}`);

/** The headlines of a candidate that are straight news of one development: the check's answer (reused when the story is unchanged), else the word rule. */
async function kept(c: Candidate): Promise<{ headlines: Headline[]; chart?: string; reason?: string }> {
  if (!client) return { headlines: sameDevelopment(c) };
  const key = createHash("sha256").update(c.headlines.map((h) => h.url).sort().join("\n")).digest("hex").slice(0, 20);
  let check = state.checks[key];
  if (!check) {
    const answer = await checkCandidate(client, {
      topic: c.topic.label(c.country?.name),
      chart: c.topic.chart,
      country: c.country?.name,
      headlines: c.headlines.map((h) => ({ title: h.title, outlet: h.source, published: h.published })),
      // A chartless story may take one of the page's charts that the site can post.
      ...(c.topic.chartId ? {} : { pickChart: postableCharts(c.topic.page) }),
    });
    if (!answer) {
      console.log(`  check failed for ${c.key}: word rule instead`);
      return { headlines: sameDevelopment({ ...c, headlines: c.headlines.filter((h) => !needsCheck(h)) }) };
    }
    check = { at: now, keep: answer.keep.map((i) => c.headlines[i]!.url), reason: answer.reason, chart: answer.chart ?? "" };
    state.checks[key] = check;
  }
  return { headlines: c.headlines.filter((h) => check.keep.includes(h.url)), ...(check.chart ? { chart: check.chart } : {}), reason: check.reason };
}

const checked: { candidate: Candidate; headlines: Headline[]; chart?: string; reason?: string }[] = [];
for (const c of worth) checked.push({ candidate: c, ...(await kept(c)) });
const charted = socialStories(checked, now);

// Data first: a release newer than the data behind a chart starts that data's refresh, and a story on it waits.
const live = process.argv.includes("--github");
/** When a file last changed on the default branch (null when unknown: nothing is then held or dispatched). */
function updatedAt(file: string): string | null {
  if (!live) return null;
  try {
    return execFileSync("gh", ["api", `repos/{owner}/{repo}/commits?path=${file}&per_page=1`, "--jq", ".[0].commit.committer.date"], { encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
}
const storyItems = charted.map((s) => ({ topicId: s.key, title: s.headlines.at(-1)!.title, source: s.headlines.at(-1)!.source, url: s.headlines.at(-1)!.url, published: s.firstSeen }));
const plan = planRefreshes({ topics: PAGE_TOPICS, releases: live ? await fetchDataReleases() : [], stories: storyItems, now, updatedAt, dispatched: state.dispatched });
for (const d of plan.dispatch) {
  const rec = recordDispatch(state.dispatched[d.workflow], d.release, now);
  if (process.argv.includes("--no-dispatch")) console.log(`  refresh  would dispatch ${d.workflow}: "${d.release.title.slice(0, 80)}" (${d.release.source}) is newer than the data`);
  else {
    try {
      execFileSync("gh", ["workflow", "run", d.workflow], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      state.dispatched[d.workflow] = rec;
      console.log(`  refresh  dispatched ${d.workflow} (${rec.count}): ${d.release.kind === "agency" ? "release" : "story"} "${d.release.title.slice(0, 80)}" (${d.release.source}) is newer than the data`);
    } catch (err) {
      console.log(`  refresh  could not dispatch ${d.workflow}: ${String((err as Error).message).split("\n")[0]}`);
    }
  }
}
const stories = charted.filter((s) => {
  const wait = plan.behind.get(s.key);
  if (wait) console.log(`  hold  ${s.key}: ${wait.release.kind === "agency" ? `${wait.release.source}'s release` : "the news"} is newer than the data; waiting for ${wait.workflow}`);
  return !wait;
});
if (stateFile) writeFileSync(stateFile, `${JSON.stringify(pruneState(state, now), null, 2)}\n`);
console.log(`insights:news  ${stories.length} stories to chart: ${stories.map((s) => `${s.key} (${s.outlets} outlets)`).join(", ") || "none"}`);

const seriesById = new Map<string, Series>();
for (const d of DATASETS) for (const s of loadDataset(d).series) seriesById.set(s.id, s);

/** The context chart for a story, stamped with its news trigger and freshness. */
function insightFor(story: SocialStory): Insight | null {
  const id = newsId(story.key, today);
  const lead = story.build.lead(story.country?.name);
  const b = story.build.build;
  let insight: Insight | null;
  if (b.kind === "tariff") insight = tariffContext(story.country, { lead, id });
  else if (b.kind === "balance") {
    const [bal, imp, exp] = [seriesById.get(b.seriesId), seriesById.get(b.imports), seriesById.get(b.exports)];
    insight = bal && imp && exp ? balanceContext(bal, imp, exp, { years: b.years, peak: b.peak, lead, id, note: b.note }) : null;
  }
  else {
    const series = seriesById.get(b.seriesId);
    insight = series ? seriesContext(series, { years: b.years, peak: b.peak, lead, id, compare: b.compare ? seriesById.get(b.compare.id) : undefined, pair: b.compare }) : null;
  }
  if (!insight) return null;
  const expiresAt = new Date(Date.parse(now) + NEWS_FRESH_HOURS * 3_600_000).toISOString();
  // The release is when the watcher saw the story; the data's own period is stated in the caption (its date fact).
  const release = { ...releaseFor(insight.frequency, insight.period, today, false), lagged: false, expiresOn: localDate(expiresAt) };
  const reason = `${story.outlets} outlets, left to right: ${coverageLine(story.headlines)}${story.reason ? `. Claude check: ${story.reason}` : ""}`;
  return {
    ...insight,
    ...(story.build.note ? { note: [insight.note, story.build.note].filter(Boolean).join("; ") } : {}),
    context: [...insight.context, ...(story.build.context ? [story.build.context] : [])],
    score: insight.score * story.score,
    release,
    news: { topic: story.topic.id, key: story.key, seenAt: now, expiresAt, headlines: story.headlines.slice(0, 8), reason },
  };
}

// Most notable first, none drafted in the last few days, at most NEWS_MAX_PER_RUN.
const picked: Insight[] = [];
for (const story of stories) {
  if (picked.length >= NEWS_MAX_PER_RUN) break;
  if (inCooldown(story.key, earlier, today)) continue;
  const insight = insightFor(story);
  if (insight) picked.push(insight);
  else console.log(`  skip  ${story.key}: no data for its chart`);
}

if (picked.length === 0) {
  console.log("insights:news  nothing to draft");
  output("count=0");
  process.exit(0);
}
const { drafts, dropped } = await buildDrafts(picked, { outDir, useLlm });
for (const d of dropped) console.log(`  dropped ${d}`);
console.log(`insights:news  ${drafts.length} drafts in ${outDir}`);
output(`count=${drafts.length}`);
