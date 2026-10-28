import { appendFileSync, readFileSync } from "node:fs";
import { eventInsightsAt, newDates, newMonthEnds, releaseEstimator, selectInsights, seriesInsightsAt } from "./collect";
import { DATASETS, loadAdministrations, loadDataset } from "./datasets";
import { buildDrafts } from "./drafts";
import { stampRelease } from "./freshness";
import { withBreakdown } from "./breakdown";
import { withWhy } from "./why";
import type { DatasetId, Insight, Series } from "./types";

/**
 * Drafts for what a data refresh added. Run by the freshness workflows (via .github/actions/social-drafts) after the
 * transform, while HEAD still holds the data from before the refresh:
 *
 *   pnpm insights:draft -- --datasets energy --since-ref HEAD --out "$RUNNER_TEMP/social-drafts"
 *   pnpm insights:draft -- --datasets gas,trade --since 2026-09-01 --no-llm     # by date instead of by git ref
 *
 * --since-ref REF   periods newer than the data at REF are new (the workflow default)
 * --since DATE      periods after DATE are new
 * --fresh           drop insights already past their freshness window (the scheduler would only expire them)
 * --exclude-file F  ids (one per line) that already have a draft issue; dropped before picking, so a repeat run
 *                   neither re-captions them nor lets them crowd out something new (the daily catch-up, social-catchup.yml)
 * --max N           drafts at most (default 3 per dataset)
 * --no-llm          template captions only (also the fallback when ANTHROPIC_API_KEY is unset)
 *
 * Writes drafts to --out (default social-drafts/latest) and, under GitHub Actions, `count=<n>` to $GITHUB_OUTPUT.
 * Nothing is posted: .github/actions/social-drafts opens one issue per draft for a human to approve.
 */

try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local (CI passes the secret as an env var) */
}

const arg = (flag: string) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined);
const datasets = (arg("--datasets") ?? DATASETS.join(",")).split(",") as DatasetId[];
for (const d of datasets) if (!DATASETS.includes(d)) throw new Error(`unknown dataset ${d} (one of ${DATASETS.join(", ")})`);
const sinceRef = arg("--since-ref");
const since = arg("--since");
if (!sinceRef && !since) throw new Error("pass --since-ref REF or --since YYYY-MM-DD");
const outDir = arg("--out") ?? "social-drafts/latest";
const max = Number(arg("--max") ?? 3 * datasets.length);
const freshOnly = process.argv.includes("--fresh");
const excludeFile = arg("--exclude-file");
const exclude = new Set(excludeFile ? readFileSync(excludeFile, "utf8").split("\n").map((l) => l.trim()).filter(Boolean) : []);
// An insight's id is `<series>:<kind>:<date>`. A draft for a newer date of the same series and kind supersedes an older
// one (schedule.ts), so an older insight is not drafted once the newer one has an issue, however it was dealt with.
const splitId = (id: string) => [id.slice(0, id.lastIndexOf(":")), id.slice(id.lastIndexOf(":") + 1)] as const;
const newestDrafted = new Map<string, string>();
for (const id of exclude) {
  const [key, date] = splitId(id);
  if (date > (newestDrafted.get(key) ?? "")) newestDrafted.set(key, date);
}
const alreadyDrafted = (i: Insight) => {
  const [key, date] = splitId(i.id);
  return (newestDrafted.get(key) ?? "") >= date;
};
const useLlm = !process.argv.includes("--no-llm") && Boolean(process.env.ANTHROPIC_API_KEY);

const admins = loadAdministrations();
const today = new Date().toISOString().slice(0, 10);
const insights: Insight[] = [];
const allSeries: Series[] = [];
for (const d of datasets) {
  const now = loadDataset(d);
  allSeries.push(...now.series);
  const prev = sinceRef ? loadDataset(d, sinceRef) : null;
  for (const s of now.series) {
    const after = prev ? (prev.series.find((p) => p.id === s.id)?.points.at(-1)?.date ?? "") : since!;
    insights.push(...seriesInsightsAt(s, admins, newDates(s, after)));
  }
  for (const e of now.events) {
    const after = prev ? (prev.events.find((p) => p.id === e.id)?.events.at(-1)?.date ?? "") : since!;
    if (!e.events.some((x) => x.date > after)) continue;
    // Month ends between the previous newest record and today: a month counts once it is over.
    insights.push(...eventInsightsAt(e, admins, newMonthEnds(after, today)));
  }
}

// A freshness workflow sees the data the day it comes out, so today is the release date (freshness.ts). Drafting by
// date (--since) cannot know it, so it estimates.
const estimate = releaseEstimator(allSeries);
const stamp = (i: Insight) => (sinceRef ? stampRelease(i, today, false) : stampRelease(i, estimate(i), true));
const candidates = insights.filter((i) => !alreadyDrafted(i)).map(stamp).filter((i) => !freshOnly || i.release!.expiresOn >= today);
if (exclude.size || freshOnly) console.log(`insights:draft  ${insights.length - candidates.length} of ${insights.length} set aside (${exclude.size} ids already drafted${freshOnly ? ", stale ones dropped" : ""})`);
const picked = selectInsights(candidates, { max, perSeries: 2, perDataset: 3 }).map((i) => withWhy(withBreakdown(i, allSeries)));
console.log(`insights:draft  ${insights.length} insights in ${datasets.join(", ")}, ${picked.length} picked, captions by ${useLlm ? "Claude" : "template"}`);
const { drafts, dropped } = picked.length ? await buildDrafts(picked, { outDir, useLlm }) : { drafts: [], dropped: [] };
for (const d of dropped) console.log(`  dropped ${d}`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `count=${drafts.length}\n`);
