import { readFileSync, writeFileSync } from "node:fs";
import { refugeeCatalog } from "../../lib/refugee-entities";
import { renderReport, wrapsAsOf, wrapsListing, yearbookDue, yearbookFiscalYear } from "./refresh-lib";

/**
 * Exits 1 when the State Department has posted a newer "Refugee Admissions Report" workbook than the catalog's
 * `admissions` source, or when the next DHS refugee yearbook is due. Check-and-issue only: the workbook's file
 * name carries its date and changes every month, so the catalog row (id, url, file) has to be swapped by a
 * person (docs/REFUGEE_ADMISSIONS_METHODOLOGY.md, "Refreshing"). The weekly workflow
 * (.github/workflows/refugee-admissions-review.yml) opens ONE issue from `--report`. A page that cannot be
 * read, or one whose layout has no workbook links, is "could not check" and the script exits 2 so the run goes
 * red (a silent pass would hide a broken check). Never edits data.
 *
 * Usage: tsx pipeline/validate/refugee-staleness.ts [--report <path>] [--today YYYY-MM-DD]
 * (`--catalog-as-of YYYY-MM-DD` pretends the catalog's workbook is that old, to see the stale path.)
 */
const PAGE = "https://www.rpc.state.gov/admissions-and-arrivals/";
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  const today = arg("--today") ?? new Date().toISOString().slice(0, 10);
  const catalog = refugeeCatalog.parse(JSON.parse(readFileSync("pipeline/reference/refugee-catalog.json", "utf8")));
  const admissions = catalog.sources.find((s) => s.role === "admissions");
  const have = arg("--catalog-as-of") ?? (admissions ? wrapsAsOf(admissions.url) : null);
  if (!admissions || !have) throw new Error("the catalog has no admissions source with an 'as of <date>' file name");

  const res = await fetch(PAGE, { headers: { "user-agent": "Mozilla/5.0 (insidegov freshness check)" } });
  if (!res.ok) throw new Error(`${PAGE} returned ${res.status}`);
  const listing = wrapsListing(await res.text());
  if (!listing.length) throw new Error(`${PAGE} lists no "Refugee Admissions Report as of …" workbook (layout change?)`);
  const newest = listing[0];
  console.log(`WRAPS: catalog has the workbook as of ${have}; the page's newest is as of ${newest.asOf}.`);

  const lines: string[] = [];
  if (newest.asOf > have) {
    lines.push(
      `**The State Department has posted a newer admissions workbook:** as of ${newest.asOf} (the catalog has ${have}).`,
      `File: ${new URL(newest.href, PAGE).href}`,
      "",
      `Replace the \`admissions\` source in \`pipeline/reference/refugee-catalog.json\` (id, title, url, file, text_file), run \`pnpm fetch:refugee\` and \`pnpm transform\`, and review the diff. The parser fails loudly on a layout change.`,
    );
  }

  const ohss = catalog.sources.find((s) => s.role === "cross_check");
  const ohssFy = ohss ? yearbookFiscalYear(ohss.id) : null;
  if (ohssFy !== null) {
    const { fy, due } = yearbookDue(ohssFy, today);
    console.log(`OHSS yearbook: catalog has FY${ohssFy}; FY${fy} ${due ? "should be out by now" : "is not due yet"}.`);
    if (due) {
      if (lines.length) lines.push("");
      lines.push(
        `**The DHS refugee yearbook for FY${fy} should be out** (the catalog's cross-check is FY${ohssFy}; OHSS posted that edition in August of the following year). Look at https://ohss.dhs.gov/topics/immigration/yearbook, replace the \`cross_check\` source if it is there, and review the differences in \`refugee_report.json\`. It is a cross-check only; nothing is gated on it.`,
      );
    }
  }

  const found = lines.length > 0;
  const report = arg("--report");
  if (report) writeFileSync(report, renderReport("Refugee source data needs a human", found ? lines : ["Nothing is stale."]));
  if (found) {
    console.error("\nStale: see above.");
    process.exit(1);
  }
  console.log("Refugee sources are current.");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(2);
});
