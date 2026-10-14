import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { enforcementRow, iceCatalog } from "../../lib/enforcement-entities";
import { dhsBudgetPageUrl, findIceBudgetPdf, iceSeriesStatus, latestBudgetFiscalYear, renderReport } from "./refresh-lib";

/**
 * Exits 1 when ICE data a human should add is out there or overdue. Checked per series, not just national removals:
 *  - every series in ICE_SERIES (removals, by agency, by criminality, administrative and at-large arrests,
 *    detainers, detention population) must have a `final` row for the fiscal year ICE should have locked by now;
 *  - the next DHS budget overview (it carries earlier actuals for several measures) must not already
 *    be published without being in the catalog.
 * The monthly workflow (.github/workflows/ice-annual-review.yml) runs this and opens ONE issue from `--report`
 * on exit 1. A DHS page that cannot be reached is reported as "could not check", never as a finding (exit 0
 * if nothing else is stale; exit 2 only for a crash). Never edits data and never blocks a deploy.
 *
 * Two kinds of finding: *overdue* (ICE should have locked a year and the catalog lacks it; a reminder, since ICE's
 * addresses are too unstable to see a release) and *published* (DHS's next budget overview is out, a real
 * new-data signal). Only the second is worth a push notification: `--notify-file <path>` is written when it fires.
 *
 * Usage: tsx pipeline/validate/ice-staleness.ts [--report <path>] [--notify-file <path>] [--offline] [--today YYYY-MM-DD]
 */
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  const today = arg("--today") ?? new Date().toISOString().slice(0, 10);
  const rows = z.array(enforcementRow).parse(JSON.parse(readFileSync("pipeline/output/enforcement_series.json", "utf8")));
  const catalog = iceCatalog.parse(JSON.parse(readFileSync("pipeline/reference/ice-removals-catalog.json", "utf8")));

  const lines: string[] = [];
  const unchecked: string[] = [];
  const statuses = iceSeriesStatus(rows, today);
  const stale = statuses.filter((s) => s.stale);
  console.log(`ICE series, expected final through FY${statuses[0].expected} (${today}):`);
  for (const s of statuses) {
    const note = s.skipped ? `skipped (${s.skipped})` : s.stale ? "STALE" : "current";
    console.log(`  ${s.label}: final through ${s.latestFinal ?? "none"}${s.preliminary ? `, preliminary FY${s.preliminary}` : ""} — ${note}`);
  }
  if (stale.length) {
    lines.push(`ICE should have locked FY${stale[0].expected} by now (60 days after the fiscal year ends). These series have no \`final\` row for it:`, "");
    for (const s of stale) {
      lines.push(`- **${s.label}**: final through ${s.latestFinal === null ? "nothing" : `FY${s.latestFinal}`}${s.preliminary ? `; FY${s.preliminary} is carried as preliminary (a budget document, not a locked report)` : ""}`);
    }
    lines.push(
      "",
      'Find ICE\'s annual report or statistics page for the year, add it to `pipeline/reference/ice-removals-catalog.json` with verbatim quotes (chart labels need a `chart` read; see "Breakdowns and other ERO measures" in `docs/IMMIGRATION_ENFORCEMENT_METHODOLOGY.md`), then run `pnpm fetch:ice` and `pnpm transform`. Never fill a gap from CBP or DHS-wide counts.',
    );
  }

  const budgetFy = latestBudgetFiscalYear(catalog.sources.map((s) => s.id));
  if (budgetFy === null) {
    unchecked.push("the catalog has no `dhs-fy<YYYY>-…` budget source, so the next overview cannot be derived");
  } else if (!process.argv.includes("--offline")) {
    const next = budgetFy + 1;
    const url = dhsBudgetPageUrl(next);
    try {
      const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (insidegov freshness check)" } });
      if (res.status === 404) {
        console.log(`DHS FY${next} budget justification: not published yet (404).`);
      } else if (!res.ok) {
        unchecked.push(`${url} returned ${res.status}`);
      } else {
        const pdf = findIceBudgetPdf(await res.text());
        if (pdf) {
          console.log(`DHS FY${next} ICE budget overview: published (${pdf}).`);
          const notifyFile = arg("--notify-file");
          if (notifyFile) writeFileSync(notifyFile, `${pdf}\n`);
          if (lines.length) lines.push("");
          lines.push(
            `**DHS has published the FY${next} ICE budget overview** (${pdf}); the catalog's newest is FY${budgetFy}. It should carry FY${next - 2} actuals for the criminal-history, arrest and detention measures: add it as a source (\`dhs-fy${next}-…\`), replace the \`preliminary\` FY${next - 2} figures, then \`pnpm fetch:ice\` and \`pnpm transform\`. Page: ${url}`,
          );
        } else {
          console.log(`DHS FY${next} budget justification page exists but links no ICE overview yet.`);
        }
      }
    } catch (err) {
      unchecked.push(`${url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  for (const u of unchecked) console.warn(`could not check: ${u}`);
  const found = lines.length > 0;
  const report = arg("--report");
  if (report) writeFileSync(report, renderReport("ICE data needs a human", found ? lines : ["Nothing is stale."], unchecked));
  if (found) {
    console.error("\nStale: see above.");
    process.exit(1);
  }
  console.log("Every ICE series is current.");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(2);
});
