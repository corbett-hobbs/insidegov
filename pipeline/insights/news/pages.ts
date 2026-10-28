import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Headline } from "../types";
import { type Candidate, LEAN_ORDER, addCompanions, needsCheck, topicOf, type PageNewsFile, type PageStory, STORY_TTL_DAYS, groupCandidates, mergeStories, pageFile, pickHeadlines, sameDevelopment, storyFor } from "./cards";
import { tariffPartners } from "./charts";
import { checkCandidate } from "./classify";
import { fetchDataReleases, fetchOutletHeadlines } from "./feeds";
import { partnersFor } from "./match";
import { ALLSIDES_READ_ON } from "./outlets";
import { type CaseRow, type LawRow, caseTopics, lawTopics } from "./subjects";
import { COUNTRY_ALIASES, MIN_PARTNER_IMPORTS, NEWS_PAGES, type NewsPage, PAGE_CHARTS, PAGE_TOPICS, type PageTopic } from "./topics";

/**
 * The page-level "In the news" builder: reads the outlets' and agencies' feeds, groups headlines into stories about one
 * chart each, checks them (Claude API, when a key is set), keeps the ones at least two outlets ran and writes
 * pipeline/output/news_<page>.json for the pages' "In the news" row (schema: lib/news-types.ts). Run a few times a day
 * by .github/workflows/news-pages.yml; see pipeline/insights/README.md, "In the news on the pages".
 *
 *   pnpm news:pages                    # build and write the files
 *   pnpm news:pages -- --dry-run       # print the stories, write nothing
 *   pnpm news:pages -- --no-llm        # keyword and detail-word rules only (outlets that need the check are left out)
 *
 * --out DIR       where the files are (default pipeline/output); the earlier cards are read from there too
 * --pages LIST    economy,immigration,trade,energy,laws,decisions (default all)
 * --data DIR      where laws.json, laws_meta.json and decisions_cases.json are (default pipeline/output): the laws and
 *                 rulings on the site that are in the news get a card of their own (news/subjects.ts)
 * --now ISO       pretend it is this moment
 * --cache FILE    what earlier runs saw, read and rewritten (default pipeline/.cache/news_pages.json, git-ignored; the
 *                 workflow keeps it in the Actions cache): topic headlines from the last STORY_TTL_DAYS (feeds carry a
 *                 day or two, and one side's outlet may headline a story a day after the other's), and the check's
 *                 answers, so an unchanged story is not asked about every run. Without it a run sees only today's feeds.
 */

try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local (CI passes the secret as an env var) */
}

const arg = (flag: string) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined);
const outDir = arg("--out") ?? "pipeline/output";
const dataDir = arg("--data") ?? "pipeline/output";
const dryRun = process.argv.includes("--dry-run");
const useLlm = !process.argv.includes("--no-llm") && Boolean(process.env.ANTHROPIC_API_KEY);
const now = arg("--now") ?? new Date().toISOString();
const cacheFile = arg("--cache") ?? "pipeline/.cache/news_pages.json";
const pages = (arg("--pages") ?? NEWS_PAGES.join(",")).split(",").map((p) => p.trim()) as NewsPage[];
for (const p of pages) if (!NEWS_PAGES.includes(p)) throw new Error(`unknown page ${p} (one of ${NEWS_PAGES.join(", ")})`);

/** lib/news-types.ts `newsFile`, mirrored here so a file the site would reject is never written. */
const fileSchema = z.object({
  asOf: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]),
  stories: z.array(
    z.object({
      id: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      topic: z.string().min(1),
      chartId: z.string().min(1).optional(),
      groupId: z.string().min(1).optional(),
      headlines: z.array(z.object({ outletId: z.string().regex(/^[a-z0-9]+$/), outlet: z.string().min(1), lean: z.enum(LEAN_ORDER), title: z.string().min(1), url: z.url() })).min(1).max(3),
    }),
  ),
});

/** `chart` is the chart the check picked for a chartless story ("" when none; absent on an answer given before the pick existed). */
type Check = { at: string; keep: string[]; reason: string; chart?: string };
type Cache = { headlines: Headline[]; checks: Record<string, Check> };
const cache: Cache = { headlines: [], checks: {}, ...(existsSync(cacheFile) ? (JSON.parse(readFileSync(cacheFile, "utf8") || "{}") as Partial<Cache>) : {}) };

const [live, releases] = await Promise.all([fetchOutletHeadlines(), fetchDataReleases()]);
const perOutlet = new Map<string, number>();
for (const h of live) perOutlet.set(h.outletId!, (perOutlet.get(h.outletId!) ?? 0) + 1);
const liveUrls = new Set(live.map((h) => h.url));
const headlines = [...live, ...cache.headlines.filter((h) => !liveUrls.has(h.url))];
console.log(`news:pages  ${live.length} outlet headlines from ${perOutlet.size} outlets (+${headlines.length - live.length} remembered), ${releases.length} agency items; leans: AllSides, read ${ALLSIDES_READ_ON}${useLlm ? "" : "; no Claude check (outlets that need it are left out)"}`);

const client = useLlm ? new Anthropic({ maxRetries: 4 }) : null;
const partners = partnersFor(tariffPartners(MIN_PARTNER_IMPORTS), COUNTRY_ALIASES);
const readData = <T,>(file: string): T => JSON.parse(readFileSync(join(dataDir, file), "utf8")) as T;
// A law or ruling on the site that is in the news gets its own topic, ahead of the page's general ones (first match wins).
const subjectTopics: PageTopic[] = [
  ...(pages.includes("laws") ? lawTopics(readData<LawRow[]>("laws.json"), new Map(readData<{ areas: { id: string; group: string }[] }>("laws_meta.json").areas.map((a) => [a.id, a.group])), now) : []),
  ...(pages.includes("decisions") ? caseTopics(readData<CaseRow[]>("decisions_cases.json"), now) : []),
];
const ALL_TOPICS = [...subjectTopics, ...PAGE_TOPICS];
console.log(`news:pages  ${subjectTopics.length} laws and rulings on the site recent enough to be in the news`);
const topics = ALL_TOPICS.filter((t) => pages.includes(t.page));
const usable = (h: Headline) => client !== null || !needsCheck(h);
const candidates = addCompanions(groupCandidates(headlines, topics, partners, now, usable), headlines.filter(usable), ALL_TOPICS, partners, now);

/**
 * The headlines of a candidate that are straight news of one development: the check's answer, else the word rule. For a
 * chartless candidate also the chart the check picked from the page's charts, when one measures what the story is about.
 */
let checksRun = 0;
let checksReused = 0;
async function kept(c: Candidate): Promise<{ headlines: Headline[]; chart?: string }> {
  if (!client) return { headlines: sameDevelopment(c) };
  const key = createHash("sha256").update(c.headlines.map((h) => h.url).sort().join("\n")).digest("hex").slice(0, 20);
  let check = cache.checks[key];
  // An answer saved before the chart pick existed has no `chart`: a chartless story is asked again.
  if (check && (c.topic.chartId || check.chart !== undefined)) checksReused++;
  else {
    checksRun++;
    const answer = await checkCandidate(client, {
      topic: c.topic.label(c.country?.name),
      chart: c.topic.chart,
      country: c.country?.name,
      headlines: c.headlines.map((h) => ({ title: h.title, outlet: h.source, published: h.published })),
      ...(c.topic.chartId ? {} : { pickChart: PAGE_CHARTS[c.topic.page] }),
    });
    if (!answer) {
      console.log(`  check failed for ${c.key}: word rule instead`);
      return { headlines: sameDevelopment({ ...c, headlines: c.headlines.filter((h) => !needsCheck(h)) }) };
    }
    check = { at: now, keep: answer.keep.map((i) => c.headlines[i]!.url), reason: answer.reason, chart: answer.chart ?? "" };
    cache.checks[key] = check;
  }
  return { headlines: c.headlines.filter((h) => check.keep.includes(h.url)), ...(check.chart ? { chart: check.chart } : {}) };
}

const fresh = new Map<NewsPage, PageStory[]>(pages.map((p) => [p, []]));
// Charted stories first: a headline on one of their cards is not repeated on a chartless card of the same page.
const onCards = new Set<string>();
for (const c of [...candidates].sort((a, b) => Number(!a.topic.chartId) - Number(!b.topic.chartId))) {
  const own = c.topic.chartId ? c.headlines : c.headlines.filter((h) => !onCards.has(h.url));
  // A story fewer than two outlets ran can never be shown: no check spent on it.
  if (!pickHeadlines(own)) continue;
  const { headlines: keptHeadlines, chart } = await kept({ ...c, headlines: own });
  const story = storyFor(c, keptHeadlines, releases, chart);
  if (story) {
    fresh.get(c.topic.page)!.push(story);
    for (const h of story.headlines) onCards.add(h.url);
  } else console.log(`  skip  ${c.key} (${c.headlines.length} headlines): fewer than two outlets after the check`);
}

console.log(`Claude checks: ${checksRun} new, ${checksReused} reused from earlier runs`);

const used = new Map<string, number>();
for (const page of pages) {
  const path = join(outDir, `news_${page}.json`);
  const previous = existsSync(path) ? (fileSchema.parse(JSON.parse(readFileSync(path, "utf8"))) as PageNewsFile) : null;
  const file = fileSchema.parse(pageFile(previous, mergeStories(previous?.stories ?? [], fresh.get(page)!, now), now)) as PageNewsFile;
  console.log(`\n${page}: ${file.stories.length} stories (${fresh.get(page)!.length} from this run's feeds)`);
  for (const s of file.stories) {
    console.log(`  ${s.date}  ${s.topic}  → ${s.chartId ?? "(no chart)"}`);
    for (const h of s.headlines) {
      console.log(`      ${h.lean.padEnd(10)} ${h.outlet}: ${h.title}`);
      used.set(h.outlet, (used.get(h.outlet) ?? 0) + 1);
    }
  }
  const text = `${JSON.stringify(file, null, 2)}\n`;
  if (!dryRun && (!existsSync(path) || readFileSync(path, "utf8") !== text)) writeFileSync(path, text);
}
console.log(`\nheadlines on cards by outlet: ${[...used].sort((a, b) => b[1] - a[1]).map(([o, n]) => `${o} ${n}`).join(", ") || "none"}`);

if (!dryRun) {
  const cutoff = Date.parse(now) - STORY_TTL_DAYS * 86_400_000;
  cache.checks = Object.fromEntries(Object.entries(cache.checks).filter(([, c]) => Date.parse(c.at) >= cutoff));
  cache.headlines = headlines.filter((h) => Date.parse(h.published) >= cutoff && topicOf(h.title, ALL_TOPICS, partners));
  mkdirSync(dirname(cacheFile), { recursive: true });
  writeFileSync(cacheFile, `${JSON.stringify(cache, null, 2)}\n`);
}
