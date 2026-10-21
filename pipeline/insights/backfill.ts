import { eventInsightsAt, newMonthEnds, selectInsights, seriesInsightsAt } from "./collect";
import { DATASETS, loadAdministrations, loadDataset } from "./datasets";
import { buildDrafts } from "./drafts";
import { addDays, addMonths } from "./format";
import type { Insight } from "./types";

/**
 * One-off: scan the last six months of every dataset as if each period had just landed, and write the most notable
 * 30-50 drafts to a local folder for review. Nothing is posted and no issue is opened.
 *
 *   pnpm insights:backfill                       # Claude captions (ANTHROPIC_API_KEY, or .env.local)
 *   pnpm insights:backfill -- --no-llm           # template captions, no API calls
 *   pnpm insights:backfill -- --months 6 --max 50 --out social-drafts/backfill
 *
 * Then open social-drafts/backfill/index.html. Annual series (ICE fiscal years) count their newest year whenever it is.
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
for (const d of DATASETS) {
  const { series, events } = loadDataset(d);
  for (const s of series) {
    const dates = s.points.filter((p) => p.date >= from).map((p) => p.date);
    if (s.frequency === "fiscal_year" && s.points.length) dates.push(s.points.at(-1)!.date);
    insights.push(...seriesInsightsAt(s, admins, [...new Set(dates)]));
  }
  for (const e of events) insights.push(...eventInsightsAt(e, admins, newMonthEnds(addDays(from, -1), today)));
}

const picked = selectInsights(insights, { max, perSeries: 3, perDataset: 18 });
console.log(`insights:backfill  ${insights.length} insights since ${from}, ${picked.length} picked, captions by ${useLlm ? "Claude" : "template"}`);
const { drafts, dropped } = await buildDrafts(picked, { outDir, useLlm });
for (const d of dropped) console.log(`  dropped ${d}`);
console.log(`insights:backfill  ${drafts.length} drafts in ${outDir} (open index.html)${drafts.length < min ? ` - fewer than ${min}` : ""}`);
