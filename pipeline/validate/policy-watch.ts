import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { refugeeCatalog } from "../../lib/refugee-entities";
import { frDocumentNumbers, policyCandidates, policyWatchConfig, renderReport, type FrDoc } from "./refresh-lib";

/**
 * Exits 1 when the Federal Register has an immigration- or refugee-related proclamation or executive order that
 * the policy table has neither curated nor recorded as reviewed. Flag only: curation, and court status, stay
 * manual (docs/REFUGEE_ADMISSIONS_METHODOLOGY.md, "Policy table"). The weekly workflow
 * (.github/workflows/immigration-policy-review.yml) opens ONE issue from `--report`.
 *
 * Accounted for already: the refugee catalog's Federal Register sources, its `fr_index_reviewed` list, the
 * documents in the Federal Register index the refugee gate covers (a new PD fails `pnpm transform` by name),
 * and `reviewed` in pipeline/reference/immigration-policy-watch.json. An API failure exits 2 (the run goes red).
 *
 * Usage: tsx pipeline/validate/policy-watch.ts [--report <path>]
 */
const FR_API = "https://www.federalregister.gov/api/v1/documents.json";
const FIELDS = ["title", "document_number", "citation", "publication_date", "presidential_document_number", "html_url"];
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const response = z.object({
  count: z.number(),
  results: z
    .array(
      z.object({
        title: z.string(),
        document_number: z.string(),
        publication_date: z.string(),
        presidential_document_number: z.string().nullable(),
        html_url: z.string().nullable(),
      }),
    )
    .default([]),
});

/** Federal Register search (presidential proclamations and executive orders only) for one full-text term since `since`. */
async function search(term: string, since: string): Promise<FrDoc[]> {
  const params = new URLSearchParams({ per_page: "200", order: "oldest" });
  params.append("conditions[type][]", "PRESDOCU");
  params.append("conditions[presidential_document_type][]", "proclamation");
  params.append("conditions[presidential_document_type][]", "executive_order");
  params.append("conditions[term]", term);
  params.append("conditions[publication_date][gte]", since);
  for (const f of FIELDS) params.append("fields[]", f);
  const res = await fetch(`${FR_API}?${params}`);
  if (!res.ok) throw new Error(`Federal Register search for ${term} -> ${res.status} ${res.statusText}`);
  const body = response.parse(await res.json());
  if (body.results.length !== body.count) throw new Error(`Federal Register search for ${term}: got ${body.results.length} of ${body.count} documents (raise per_page)`);
  return body.results;
}

async function main() {
  const config = policyWatchConfig.parse(JSON.parse(readFileSync("pipeline/reference/immigration-policy-watch.json", "utf8")));
  const catalog = refugeeCatalog.parse(JSON.parse(readFileSync("pipeline/reference/refugee-catalog.json", "utf8")));
  const frIndex = z
    .array(z.object({ document_number: z.string() }))
    .parse(JSON.parse(readFileSync("pipeline/raw/refugee/fr-refugee-admissions-index.json", "utf8")));

  const known = new Set<string>([
    ...frDocumentNumbers(catalog.sources),
    ...catalog.fr_index_reviewed.map((r) => r.document_number),
    ...frIndex.map((r) => r.document_number),
    ...config.reviewed.map((r) => r.document_number),
  ]);

  const hits: { term: string; docs: FrDoc[] }[] = [];
  for (const term of [...config.strong_terms, ...config.broad_terms]) hits.push({ term, docs: await search(term, config.since) });
  const searched = new Set(hits.flatMap((h) => h.docs.map((d) => d.document_number)));
  const candidates = policyCandidates(hits, config, known);
  console.log(`Federal Register since ${config.since}: ${searched.size} presidential documents matched ${hits.length} searches; ${candidates.length} unreviewed candidate(s).`);

  const lines = candidates.length
    ? [
        `The Federal Register has ${candidates.length} presidential proclamation(s) or executive order(s) on immigration or refugees that the policy table has not curated or recorded as reviewed:`,
        "",
        ...candidates.map((d) => `- **${d.presidential_document_number ?? d.document_number}** (${d.publication_date}): ${d.title} — ${d.html_url ?? d.document_number} (\`${d.document_number}\`)`),
        "",
        "For each: if it restricts or reshapes refugee entry or admissions by country, add a row to `policy_events` in `pipeline/reference/refugee-catalog.json` (with its Federal Register document as a source, and verbatim quotes). Otherwise add `{ document_number, reason }` to `reviewed` in `pipeline/reference/immigration-policy-watch.json`. The issue closes itself when nothing is left. Court status stays manual.",
      ]
    : ["Nothing to review."];
  const report = arg("--report");
  if (report) writeFileSync(report, renderReport("Immigration policy documents to review", lines));
  for (const d of candidates) console.error(`  ${d.document_number}  ${d.publication_date}  ${d.title}`);
  if (candidates.length) process.exit(1);
  console.log("Every matching document is in the table or reviewed.");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(2);
});
