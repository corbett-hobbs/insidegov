import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { DATASETS, loadDataset } from "../datasets";
import { buildDrafts } from "../drafts";
import { releaseFor } from "../freshness";
import { NEWS_LABEL } from "../issue";
import { localDate } from "../schedule";
import type { Insight, Series } from "../types";
import { tariffContext, tariffPartners, seriesContext } from "./charts";
import { classifyStory } from "./classify";
import { FEEDS, type FeedId, fetchHeadlines } from "./feeds";
import { NEWS_FRESH_HOURS, NEWS_MAX_PER_RUN, type Story, type WatchState, findStories, inCooldown, newsId, partnersFor, pruneState, recentlyRejected } from "./match";
import { COUNTRY_ALIASES, MIN_PARTNER_IMPORTS, NEWS_TOPICS } from "./topics";

/**
 * The news watcher: reads the headline feeds, finds topics the site has data on that are in the news right now, checks
 * each is a real story (Claude API, when a key is set), and drafts a context chart for it. Run every 15 minutes by
 * .github/workflows/social-news.yml through .github/actions/social-drafts; nothing is posted here. The drafts become
 * `social-draft` + `social-news` issues, and an approved one posts within minutes (schedule.ts pickNews).
 *
 *   pnpm insights:news                         # watch once, write drafts to social-drafts/news
 *   pnpm insights:news -- --no-llm             # keyword rules only, template captions
 *   pnpm insights:news -- --github             # skip stories already drafted (reads issue titles with gh)
 *
 * --out DIR      where drafts go (default social-drafts/news)
 * --feeds LIST   whitehouse,outlets (default: SOCIAL_NEWS_SOURCES, else both; news/feeds.ts)
 * --now ISO      pretend it is this moment (headline recency, freshness)
 * --state FILE   stories the relevance check turned down, read and rewritten (so they are not asked about every run)
 */

try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local (CI passes the secret as an env var) */
}

const arg = (flag: string) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined);
const outDir = arg("--out") ?? "social-drafts/news";
const useLlm = !process.argv.includes("--no-llm") && Boolean(process.env.ANTHROPIC_API_KEY);
// "google" was the news searches' name before the outlets' own feeds replaced them; a repo variable may still say it.
const feeds = (arg("--feeds") || process.env.SOCIAL_NEWS_SOURCES || FEEDS.join(",")).split(",").map((f) => (f.trim() === "google" ? "outlets" : f.trim())) as FeedId[];
for (const f of feeds) if (!FEEDS.includes(f)) throw new Error(`unknown feed ${f} (one of ${FEEDS.join(", ")})`);
const now = arg("--now") ?? new Date().toISOString();
const stateFile = arg("--state");
const state: WatchState = stateFile && existsSync(stateFile) ? { rejected: {}, ...(JSON.parse(readFileSync(stateFile, "utf8") || "{}") as Partial<WatchState>) } : { rejected: {} };
const today = localDate(now);
const output = (line: string) => process.env.GITHUB_OUTPUT && appendFileSync(process.env.GITHUB_OUTPUT, `${line}\n`);

// Draft ids already used (open or closed: a rejected story stays rejected), for the cooldown.
let earlier: string[] = [];
if (process.argv.includes("--github")) {
  // A failed listing must not turn into a flood of duplicates: without it, nothing is drafted this run.
  const titles = JSON.parse(execFileSync("gh", ["issue", "list", "--label", NEWS_LABEL, "--state", "all", "--limit", "300", "--json", "title"], { encoding: "utf8" })) as { title: string }[];
  earlier = titles.flatMap((t) => t.title.match(/\[(news:[^\]]+)\]$/)?.[1] ?? []);
}

const headlines = await fetchHeadlines(feeds);
const partners = partnersFor(tariffPartners(MIN_PARTNER_IMPORTS), COUNTRY_ALIASES);
const stories = findStories(headlines, NEWS_TOPICS, partners, now);
console.log(`insights:news  ${headlines.length} headlines from ${feeds.join(", ")}, ${stories.length} stories in the news: ${stories.map((s) => `${s.key} (${s.sources.length} sources${s.official ? ", official" : ""})`).join(", ") || "none"}`);

const client = useLlm ? new Anthropic({ maxRetries: 4 }) : null;
const seriesById = new Map<string, Series>();
for (const d of DATASETS) for (const s of loadDataset(d).series) seriesById.set(s.id, s);

/** The context chart for a story, stamped with its news trigger and freshness. */
function insightFor(story: Story, reason: string): Insight | null {
  const id = newsId(story.key, today);
  const lead = story.topic.lead(story.country?.name);
  const b = story.topic.build;
  let insight: Insight | null;
  if (b.kind === "tariff") insight = tariffContext(story.country, { lead, id });
  else {
    const series = seriesById.get(b.seriesId);
    insight = series ? seriesContext(series, { years: b.years, peak: b.peak, lead, id }) : null;
  }
  if (!insight) return null;
  const expiresAt = new Date(Date.parse(now) + NEWS_FRESH_HOURS * 3_600_000).toISOString();
  // The release is when the watcher saw the story; the data's own period is stated in the caption (its date fact).
  const release = { ...releaseFor(insight.frequency, insight.period, today, false), lagged: false, expiresOn: localDate(expiresAt) };
  return {
    ...insight,
    score: insight.score * story.score,
    release,
    news: { topic: story.topic.id, key: story.key, seenAt: now, expiresAt, headlines: story.headlines.slice(0, 8), reason },
  };
}

// Most notable first: one story per topic (Canada tariffs and tariffs in general are the same news), none drafted in
// the last few days, none the check turned down in the last few hours, at most NEWS_MAX_PER_RUN.
const picked: Insight[] = [];
for (const story of stories) {
  if (picked.length >= NEWS_MAX_PER_RUN) break;
  if (picked.some((p) => p.news!.topic === story.topic.id) || inCooldown(story.key, earlier, today)) continue;
  if (recentlyRejected(story, state, now)) {
    console.log(`  skip  ${story.key}: turned down at ${state.rejected[story.key]!.at} (${state.rejected[story.key]!.reason})`);
    continue;
  }
  let reason = story.official ? "an official White House document" : `${story.sources.length} publishers in the last hours: ${story.sources.slice(0, 4).join(", ")}`;
  if (client) {
    const d = await classifyStory(client, story);
    console.log(`  ${d.relevant ? "take" : "skip"}  ${story.key}: ${d.reason}`);
    if (!d.relevant) {
      state.rejected[story.key] = { at: now, official: story.official, reason: d.reason };
      continue;
    }
    reason = `${reason}. Relevance check: ${d.reason}`;
  }
  const insight = insightFor(story, reason);
  if (insight) picked.push(insight);
  else console.log(`  skip  ${story.key}: no data for its chart`);
}
if (stateFile) writeFileSync(stateFile, `${JSON.stringify(pruneState(state, now), null, 2)}\n`);

if (picked.length === 0) {
  console.log("insights:news  nothing to draft");
  output("count=0");
  process.exit(0);
}
const { drafts, dropped } = await buildDrafts(picked, { outDir, useLlm });
for (const d of dropped) console.log(`  dropped ${d}`);
console.log(`insights:news  ${drafts.length} drafts in ${outDir}`);
output(`count=${drafts.length}`);
