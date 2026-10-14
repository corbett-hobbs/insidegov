import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";

/**
 * Summarises what changed in `raw/refugee/fr-refugee-admissions-index.json` (the Federal Register listing of
 * presidential documents that mention "refugee admissions") between two copies, as markdown for the refresh PR.
 * Used by .github/workflows/refugee-freshness.yml. Prints nothing to the data; writes only the summary file.
 *
 * Usage: tsx pipeline/fetch/refugee-index-diff.ts <previous.json> <current.json> <summary.md>
 */
const row = z.object({
  title: z.string(),
  document_number: z.string(),
  citation: z.string().nullable(),
  publication_date: z.string(),
  signing_date: z.string().nullable(),
  subtype: z.string().nullable(),
  presidential_document_number: z.string().nullable(),
});
type Row = z.infer<typeof row>;

export function diffIndex(prev: Row[], next: Row[]): { added: Row[]; removed: Row[]; changed: { before: Row; after: Row }[] } {
  const before = new Map(prev.map((r) => [r.document_number, r]));
  const after = new Map(next.map((r) => [r.document_number, r]));
  return {
    added: next.filter((r) => !before.has(r.document_number)),
    removed: prev.filter((r) => !after.has(r.document_number)),
    changed: next.flatMap((r) => {
      const b = before.get(r.document_number);
      return b && JSON.stringify(b) !== JSON.stringify(r) ? [{ before: b, after: r }] : [];
    }),
  };
}

const line = (r: Row) => `- ${r.presidential_document_number ? `${r.subtype ?? "Document"} ${r.presidential_document_number}` : r.document_number} (${r.publication_date}${r.citation ? `, ${r.citation}` : ""}): ${r.title} (\`${r.document_number}\`) https://www.federalregister.gov/d/${r.document_number}`;

export function summarise(d: ReturnType<typeof diffIndex>): string {
  const out: string[] = [];
  if (d.added.length) out.push(`**New documents mentioning "refugee admissions" (${d.added.length}):**`, "", ...d.added.map(line), "");
  if (d.removed.length) out.push(`**Removed from the listing (${d.removed.length}):**`, "", ...d.removed.map(line), "");
  if (d.changed.length) out.push(`**Metadata changed (${d.changed.length}):**`, "", ...d.changed.map((c) => line(c.after)), "");
  return out.length ? out.join("\n") : "No change to the index (the diff is in the other raw files).\n";
}

if (process.argv[1]?.endsWith("refugee-index-diff.ts")) {
  const [prevPath, nextPath, outPath] = process.argv.slice(2);
  const read = (p: string) => z.array(row).parse(JSON.parse(readFileSync(p, "utf8")));
  const summary = summarise(diffIndex(read(prevPath), read(nextPath)));
  writeFileSync(outPath, summary);
  console.log(summary);
}
