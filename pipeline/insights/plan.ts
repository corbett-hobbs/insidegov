import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { eventInsightsAt, newMonthEnds, releaseEstimator, seriesInsightsAt } from "./collect";
import { DATASETS, loadAdministrations, loadDataset } from "./datasets";
import { buildDrafts } from "./drafts";
import { addDays, addMonths, fmtDate } from "./format";
import { estimateRelease, releaseFor, stampRelease } from "./freshness";
import { type QueueItem, localDate, simulate, slotLabel } from "./schedule";
import type { Insight, Series } from "./types";

/**
 * The posting plan from tomorrow: what the scheduler (schedule.ts) would post in each weekday slot over the next
 * `--days`, if every draft were approved. It starts from
 *   - drafts that are out and still fresh today (from data already released, estimated release dates), and
 *   - the releases still to come: for every headline series and month-end roundup, the next periods' expected
 *     release dates (period end + the series' typical lag). Each of those always yields at least the routine reading;
 *     anything notable in them is a bonus the plan cannot know yet.
 *
 *   pnpm insights:plan                      # 28 days -> social-drafts/plan.md
 *   pnpm insights:plan -- --days 14 --draft # also caption and render the drafts that are ready now
 *
 * Times are Pacific (the slots' time zone) with Eastern alongside. Nothing is posted.
 */

try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local */
}

const arg = (flag: string) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined);
const days = Number(arg("--days") ?? 28);
const outDir = arg("--out") ?? "social-drafts";
const today = localDate(new Date().toISOString());
const start = addDays(today, 1);
const end = addDays(start, days - 1);
const admins = loadAdministrations();

const ready: Insight[] = [];
const expected: (QueueItem & { label: string })[] = [];
const allSeries: Series[] = [];
for (const d of DATASETS) {
  const { series, events } = loadDataset(d);
  allSeries.push(...series);
  for (const s of series) {
    const dates = s.points.filter((p) => p.date >= addMonths(today, -6)).map((p) => p.date);
    ready.push(...seriesInsightsAt(s, admins, dates));
    if (!s.headline || !s.points.length) continue;
    // The next periods after the newest one, while their expected release falls inside the plan.
    for (let i = 1, period = nextPeriod(s, s.points.at(-1)!.date); i <= 60; i++, period = nextPeriod(s, period)) {
      const releasedOn = estimateRelease(s.frequency, period, s.releaseLagDays);
      if (releasedOn > end) break;
      if (releasedOn < start) continue;
      const r = releaseFor(s.frequency, period, releasedOn, true);
      expected.push({
        key: `expected:${s.id}:${period}`,
        id: `${s.id}:expected:${period}`,
        kind: "expected",
        dataset: s.dataset,
        seriesId: s.id,
        period,
        score: 2 * s.weight,
        frequency: s.frequency,
        releasedOn,
        expiresOn: r.expiresOn,
        label: `Expected: ${s.name}, ${s.frequency === "weekly" ? "week of " : ""}${fmtDate(period, s.frequency === "weekly" ? "day" : s.frequency === "monthly" ? "month" : "fiscal_year")}${r.lagged ? " (newly released)" : ""}`,
      });
    }
  }
  for (const e of events) {
    ready.push(...eventInsightsAt(e, admins, newMonthEnds(addMonths(today, -2), today)));
    for (let m = addMonths(`${start.slice(0, 7)}-01`, 1); addDays(m, -1) <= end; m = addMonths(m, 1)) {
      const monthEnd = addDays(m, -1);
      const releasedOn = addDays(monthEnd, 1);
      if (releasedOn < start) continue;
      expected.push({
        key: `expected:${e.id}:${monthEnd}`,
        id: `${e.id}:expected:${monthEnd}`,
        kind: "expected",
        dataset: e.dataset,
        seriesId: `${e.id}.monthly`,
        period: monthEnd,
        score: 2 * e.weight,
        frequency: "monthly",
        releasedOn,
        expiresOn: releaseFor("monthly", monthEnd, releasedOn, true).expiresOn,
        label: `Expected: ${e.name} ${e.verb} in ${fmtDate(monthEnd, "month")}${["03", "06", "09", "12"].includes(monthEnd.slice(5, 7)) ? ", with the quarterly term comparison" : ""}`,
      });
    }
  }
}

// Drafts already out: estimated release on or before today and still fresh tomorrow.
const estimate = releaseEstimator(allSeries);
const fresh = ready.map((i) => stampRelease(i, estimate(i), true)).filter((i) => i.release!.releasedOn <= today && i.release!.expiresOn >= start);
const byKey = new Map(fresh.map((i) => [i.id, i] as const));
const labels = new Map<string, string>(expected.map((q) => [q.key, q.label]));
const items: QueueItem[] = [
  { key: "intro", id: "intro", kind: "intro", dataset: "intro", seriesId: "intro", period: "", score: 0, frequency: "monthly", releasedOn: start, expiresOn: "9999-12-31" },
  ...fresh.map((i) => ({ key: i.id, id: i.id, kind: i.kind, dataset: i.dataset, seriesId: i.seriesId, period: i.period, score: i.score, frequency: i.frequency, releasedOn: i.release!.releasedOn, expiresOn: i.release!.expiresOn })),
  ...expected,
];
const { posts, expired } = simulate(items, start, days);

const describe = (q: QueueItem) => (q.kind === "intro" ? "**Intro thread** (pinned)" : (labels.get(q.key) ?? byKey.get(q.id)?.template ?? q.id).replace(/\|/g, "\\|"));
const perWeek = new Map<string, number>();
for (const p of posts) {
  const d = localDate(p.at);
  const monday = addDays(d, -((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7));
  perWeek.set(monday, (perWeek.get(monday) ?? 0) + 1);
}
const md = [
  `# Posting plan, ${start} to ${end}`,
  "",
  `If every draft were approved: ${posts.length} posts in ${days} days. Slots: weekdays 9:00 a.m. PT (noon ET), and 1:00 p.m. PT (4:00 p.m. ET) when 3+ are waiting. "Ready" rows are drafts from data already out; "Expected" rows are releases still to come (dates estimated from each source's usual lag), which post at least their routine reading. Rules: pipeline/insights/schedule.ts.`,
  "",
  "## Posts per week (week starting Monday)",
  "",
  ...[...perWeek].sort().map(([w, n]) => `- ${w}: ${"#".repeat(n)} ${n}`),
  "",
  "## The plan",
  "",
  "| When | Topic | Data out | Post |",
  "| --- | --- | --- | --- |",
  ...posts.map((p) => `| ${slotLabel(p.at)} | ${p.item.dataset} | ${p.item.kind === "intro" ? "" : p.item.releasedOn} | ${p.item.kind === "expected" || p.item.kind === "intro" ? describe(p.item) : `Ready: ${describe(p.item)}`} |`),
  "",
  `## Would go stale unposted (${expired.length})`,
  "",
  ...expired.map((q) => `- ${q.releasedOn} ${q.dataset}: ${describe(q)}`),
  "",
].join("\n");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "plan.md"), md);
console.log(`insights:plan  ${start}..${end}: ${posts.length} posts (${posts.filter((p) => p.item.kind !== "expected" && p.item.kind !== "intro").length} ready now, ${posts.filter((p) => p.item.kind === "expected").length} expected releases) -> ${join(outDir, "plan.md")}`);

if (process.argv.includes("--draft")) {
  const now = posts.map((p) => byKey.get(p.item.id)).filter((i): i is Insight => Boolean(i));
  const useLlm = !process.argv.includes("--no-llm") && Boolean(process.env.ANTHROPIC_API_KEY);
  const { drafts, dropped } = await buildDrafts(now, { outDir: join(outDir, "plan"), useLlm });
  for (const d of dropped) console.log(`  dropped ${d}`);
  console.log(`insights:plan  ${drafts.length} ready drafts in ${join(outDir, "plan")} (open index.html)`);
}

/** The period after `date`: next week, next month, next fiscal year. */
function nextPeriod(s: Series, date: string): string {
  if (s.frequency === "weekly") return addDays(date, 7);
  if (s.frequency === "monthly") return addMonths(date, 1);
  return `${Number(date.slice(0, 4)) + 1}-09-30`;
}
