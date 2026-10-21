import { appendFileSync } from "node:fs";
import { eventInsightsAt, newDates, newMonthEnds, selectInsights, seriesInsightsAt } from "./collect";
import { DATASETS, loadAdministrations, loadDataset } from "./datasets";
import { buildDrafts } from "./drafts";
import type { DatasetId, Insight } from "./types";

/**
 * Drafts for what a data refresh added. Run by the freshness workflows (via .github/actions/social-drafts) after the
 * transform, while HEAD still holds the data from before the refresh:
 *
 *   pnpm insights:draft -- --datasets energy --since-ref HEAD --out "$RUNNER_TEMP/social-drafts"
 *   pnpm insights:draft -- --datasets gas,trade --since 2026-09-01 --no-llm     # by date instead of by git ref
 *
 * --since-ref REF   periods newer than the data at REF are new (the workflow default)
 * --since DATE      periods after DATE are new
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
const useLlm = !process.argv.includes("--no-llm") && Boolean(process.env.ANTHROPIC_API_KEY);

const admins = loadAdministrations();
const today = new Date().toISOString().slice(0, 10);
const insights: Insight[] = [];
for (const d of datasets) {
  const now = loadDataset(d);
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

const picked = selectInsights(insights, { max, perSeries: 2, perDataset: 3 });
console.log(`insights:draft  ${insights.length} insights in ${datasets.join(", ")}, ${picked.length} picked, captions by ${useLlm ? "Claude" : "template"}`);
const { drafts, dropped } = picked.length ? await buildDrafts(picked, { outDir, useLlm }) : { drafts: [], dropped: [] };
for (const d of dropped) console.log(`  dropped ${d}`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `count=${drafts.length}\n`);
