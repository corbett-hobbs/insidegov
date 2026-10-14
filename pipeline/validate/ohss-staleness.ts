import { readFileSync, writeFileSync } from "node:fs";
import { lprCatalog } from "../../lib/lpr-entities";
import {
  QUARTERLY_PAGE,
  compareQuarterly,
  compareYearbookEdition,
  latestYearbookFiscalYear,
  workbookLinks,
  yearbookPageUrl,
  yearbookWorkbooks,
  type YearbookFinding,
} from "./ohss-lib";
import { renderReport } from "./refresh-lib";

/**
 * Exits 1 when OHSS has posted something the green-card/naturalization catalog (`pipeline/reference/lpr-catalog.json`)
 * does not carry: a new quarterly report file, a repost of one the catalog has, the next Yearbook edition, or a
 * reposted workbook of the newest edition. Detect + issue only: OHSS posts every file at a new address and its
 * "last updated" lines are unreliable (docs/IMMIGRATION_SOURCE_NOTES.md §8), so it compares the files each page
 * LISTS with the catalog and never trusts a date. The weekly workflow (.github/workflows/ohss-review.yml) opens
 * ONE issue from `--report`. A page that cannot be read, or that no longer lists the catalog's own files (a layout
 * change), exits 2 so the run goes red rather than passing silently. Never edits data.
 *
 * Usage: tsx pipeline/validate/ohss-staleness.ts [--report <path>] [--drop <source id>] (--drop pretends the
 * catalog lacks that source, to see the new-file path locally).
 */
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const UA = { "user-agent": "Mozilla/5.0 (insidegov freshness check)" };

async function page(url: string): Promise<string | null> {
  const res = await fetch(url, { headers: UA });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.text();
}

async function main() {
  const catalog = lprCatalog.parse(JSON.parse(readFileSync("pipeline/reference/lpr-catalog.json", "utf8")));
  const drop = arg("--drop");
  const sources = catalog.sources.filter((s) => s.id !== drop);

  const lines: string[] = [];

  // Quarterly report page
  const quarterlyHtml = await page(QUARTERLY_PAGE);
  if (!quarterlyHtml) throw new Error(`${QUARTERLY_PAGE} returned 404`);
  const links = workbookLinks(quarterlyHtml);
  if (!links.length) throw new Error(`${QUARTERLY_PAGE} lists no workbooks (layout change?)`);
  const { findings, unlisted } = compareQuarterly(links, sources);
  if (unlisted.length) throw new Error(`${QUARTERLY_PAGE} no longer lists ${unlisted.join(", ")} (layout change, or OHSS moved them)`);
  console.log(`Quarterly report page: ${links.length} workbooks listed, ${findings.length} not in the catalog.`);
  for (const f of findings) {
    lines.push(
      f.kind === "new_year"
        ? `- **New quarterly report file${f.fy ? ` (FY${f.fy})` : ""}:** ${f.url}`
        : `- **Reposted quarterly file for FY${f.fy}** (the catalog's \`${f.replaces}\` points elsewhere): ${f.url}`,
    );
  }
  const quarterlyHow =
    "Add an `ohss-quarterly-fy<year>` source (sheets Table 1A, 1B, 2, 3) and its four tables to `pipeline/reference/lpr-catalog.json`, run `pnpm fetch:ohss` and `pnpm transform`. A repost is a restatement candidate: compare it with the snapshot before replacing it.";

  // Yearbook: the next edition, and the newest edition's own files
  const yearbookLines: string[] = [];
  const latest = latestYearbookFiscalYear(sources);
  if (latest === null) throw new Error("the catalog has no ohss-yearbook-<year>-<topic> source");
  const yearbookFindings: YearbookFinding[] = [];
  const next = latest + 1;
  const nextHtml = await page(yearbookPageUrl(next));
  if (nextHtml) {
    const w = yearbookWorkbooks(nextHtml);
    console.log(`Yearbook FY${next} page: exists; LPR workbook ${w.lpr ? "listed" : "not listed"}, naturalization workbook ${w.naturalizations ? "listed" : "not listed"}.`);
    if (w.lpr || w.naturalizations) {
      yearbookFindings.push({ kind: "new_edition", fy: next, url: w.lpr ?? w.naturalizations ?? undefined });
      yearbookLines.push(`- **The FY${next} Yearbook has LPR/naturalization files:** ${[w.lpr, w.naturalizations].filter(Boolean).join(" and ")}`);
    }
  } else {
    console.log(`Yearbook FY${next} page: not published yet (404).`);
  }
  const latestHtml = await page(yearbookPageUrl(latest));
  if (!latestHtml) throw new Error(`${yearbookPageUrl(latest)} returned 404`);
  const latestWorkbooks = yearbookWorkbooks(latestHtml);
  if (!latestWorkbooks.lpr && !latestWorkbooks.naturalizations) throw new Error(`${yearbookPageUrl(latest)} lists neither the LPR nor the naturalization workbook (layout change?)`);
  for (const f of compareYearbookEdition(latest, latestWorkbooks, sources)) {
    yearbookFindings.push(f);
    yearbookLines.push(`- **Reposted FY${f.fy} Yearbook ${f.topic === "lpr" ? "LPR" : "naturalization"} workbook** (the catalog's \`${f.replaces}\` points elsewhere): ${f.url}`);
  }
  console.log(`Yearbook FY${latest} page: ${yearbookFindings.some((f) => f.kind === "replaced_file") ? "a listed workbook differs from the catalog" : "its LPR and naturalization workbooks match the catalog"}.`);
  const yearbookHow =
    "New edition: add the LPR and naturalization workbooks as sources and their tables (`*-total`, `*-class`, `*-birth`); the build then fails on every value it restated until a `restatements` entry records it, and the `fy<year>-preliminary` note's range changes when the year turns final. See \"Refreshing\" in `docs/LPR_METHODOLOGY.md`.";

  const body: string[] = [];
  if (lines.length) body.push("OHSS's quarterly report page lists files the catalog does not have:", "", ...lines, "", quarterlyHow);
  if (yearbookLines.length) body.push(...(body.length ? [""] : []), "OHSS's Yearbook pages list files the catalog does not have:", "", ...yearbookLines, "", yearbookHow);
  const found = body.length > 0;
  const report = arg("--report");
  if (report) writeFileSync(report, renderReport("Green-card data needs a human", found ? body : ["Nothing new on OHSS's pages."]));
  if (found) {
    console.error("\nNew or changed OHSS files: see above.");
    process.exit(1);
  }
  console.log("The catalog carries every file OHSS lists.");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(2);
});
