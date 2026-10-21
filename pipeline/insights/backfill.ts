import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { eventInsightsAt, newMonthEnds, releaseEstimator, seriesInsightsAt } from "./collect";
import { DATASETS, loadAdministrations, loadDataset } from "./datasets";
import { buildDrafts } from "./drafts";
import { addDays, addMonths } from "./format";
import { stampRelease } from "./freshness";
import { type QueueItem, simulate } from "./schedule";
import type { Insight, Series } from "./types";

/**
 * One-off: replay the last six months as if the pipeline had been running. Every period that came out in that time is
 * run through the detectors on its (estimated) release day, joins the queue, and the scheduler (schedule.ts) picks
 * what posts in each slot, so the replay shows the real cadence: what would have posted, when, and what would have
 * gone stale. Then the most recent `--max` posts are drafted (captioned and rendered) for review.
 *
 *   pnpm insights:backfill                       # Claude captions (ANTHROPIC_API_KEY, or .env.local)
 *   pnpm insights:backfill -- --no-llm           # template captions, no API calls
 *   pnpm insights:backfill -- --months 6 --max 50 --out social-drafts/backfill
 *
 * Writes social-drafts/backfill/index.html (the drafts) and schedule.md (the whole replay). Release dates are
 * estimates (collect.ts releaseEstimator); the freshness workflows know the real ones. Nothing is posted.
 */

try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local */
}

const arg = (flag: string) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined);
const months = Number(arg("--months") ?? 6);
const max = Number(arg("--max") ?? 50);
const min = Number(arg("--min") ?? 30);
const outDir = arg("--out") ?? "social-drafts/backfill";
const useLlm = !process.argv.includes("--no-llm") && Boolean(process.env.ANTHROPIC_API_KEY);

const today = new Date().toISOString().slice(0, 10);
const from = addMonths(`${today.slice(0, 7)}-01`, -months);
const admins = loadAdministrations();
const insights: Insight[] = [];
const allSeries: Series[] = [];
for (const d of DATASETS) {
  const { series, events } = loadDataset(d);
  allSeries.push(...series);
  for (const s of series) {
    // A little before the window too: data for March may come out in May.
    const dates = s.points.filter((p) => p.date >= addMonths(from, -4)).map((p) => p.date);
    // Annual figures come out long after the year ends (ICE's report), so the newest year is always a candidate.
    if (s.frequency === "fiscal_year" && s.points.length) dates.push(s.points.at(-1)!.date);
    insights.push(...seriesInsightsAt(s, admins, [...new Set(dates)]));
  }
  for (const e of events) insights.push(...eventInsightsAt(e, admins, newMonthEnds(addDays(from, -1), today)));
}

const estimate = releaseEstimator(allSeries);
const stamped = insights.map((i) => stampRelease(i, estimate(i), true)).filter((i) => i.release!.releasedOn >= from && i.release!.releasedOn <= today);
const byKey = new Map(stamped.map((i) => [i.id, i] as const));
const items: QueueItem[] = stamped.map((i) => ({
  key: i.id,
  id: i.id,
  kind: i.kind,
  dataset: i.dataset,
  seriesId: i.seriesId,
  period: i.period,
  score: i.score,
  frequency: i.frequency,
  releasedOn: i.release!.releasedOn,
  expiresOn: i.release!.expiresOn,
}));
const intro: QueueItem = { key: "intro", id: "intro", kind: "intro", dataset: "intro", seriesId: "intro", period: "", score: 0, frequency: "monthly", releasedOn: from, expiresOn: "9999-12-31" };
const days = Math.round((Date.parse(today) - Date.parse(from)) / 86_400_000) + 1;
const replay = simulate([intro, ...items], from, days);
const posts = replay.posts.filter((p) => p.item.kind !== "intro");

// The replay, for the cadence: posts per week and per dataset, then every post.
const perWeek = new Map<string, number>();
for (const p of posts) {
  const d = new Date(`${p.at.slice(0, 10)}T00:00:00Z`);
  const monday = addDays(p.at.slice(0, 10), -((d.getUTCDay() + 6) % 7));
  perWeek.set(monday, (perWeek.get(monday) ?? 0) + 1);
}
const perDataset = new Map<string, number>();
for (const p of posts) perDataset.set(p.item.dataset, (perDataset.get(p.item.dataset) ?? 0) + 1);
const schedule = [
  `# Posting replay, ${from} to ${today}`,
  "",
  `${posts.length} posts in ${days} days from ${items.length} candidate insights (release dates estimated). ${replay.expired.length} went stale or were superseded before a slot was free. Rules: pipeline/insights/schedule.ts.`,
  "",
  "## Posts per week (week starting Monday)",
  "",
  ...[...perWeek].sort().map(([w, n]) => `- ${w}: ${"#".repeat(n)} ${n}`),
  "",
  "## Posts per dataset",
  "",
  ...[...perDataset].sort((a, b) => b[1] - a[1]).map(([d, n]) => `- ${d}: ${n}`),
  "",
  "## Every post",
  "",
  "| When (UTC) | Slot | Dataset | Kind | Released | Draft |",
  "| --- | --- | --- | --- | --- | --- |",
  ...replay.posts.map((p) => `| ${p.at.slice(0, 16).replace("T", " ")} | ${p.slot} | ${p.item.dataset} | ${p.item.kind} | ${p.item.releasedOn} | ${p.item.kind === "intro" ? "Intro thread" : byKey.get(p.item.id)!.template.replace(/\|/g, "\\|")} |`),
  "",
].join("\n");

const recent = posts.slice(-max).reverse().map((p) => byKey.get(p.item.id)!);
console.log(`insights:backfill  replayed ${from}..${today}: ${posts.length} posts from ${items.length} insights; drafting the last ${recent.length}, captions by ${useLlm ? "Claude" : "template"}`);
const { drafts, dropped } = await buildDrafts(recent, { outDir, useLlm });
writeFileSync(join(outDir, "schedule.md"), schedule);
for (const d of dropped) console.log(`  dropped ${d}`);
console.log(`insights:backfill  ${drafts.length} drafts in ${outDir} (open index.html; schedule.md has the replay)${drafts.length < min ? ` - fewer than ${min}` : ""}`);
