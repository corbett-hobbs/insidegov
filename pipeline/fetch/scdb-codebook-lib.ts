/**
 * Pure parser for the Supreme Court Database's online codebook (`http://scdb.wustl.edu/documentation.php?var=<name>`): each
 * variable's page lists its values as table rows of a code and a label after a "Values:" heading. `scdb-codebook.ts` fetches
 * the pages and writes `pipeline/reference/scdb-codebook.json`; the decision pages read labels from that file only.
 */

/** The SCDB variables the decision pages label. States share one list (`petitionerState`), courts one (`caseSource`). */
export const CODEBOOK_VARS = [
  "issue",
  "petitioner",
  "petitionerState",
  "caseSource",
  "jurisdiction",
  "certReason",
  "lcDisposition",
  "caseDisposition",
  "partyWinning",
  "declarationUncon",
  "lawType",
  "lawSupp",
  "authorityDecision1",
] as const;
export type CodebookVar = (typeof CODEBOOK_VARS)[number];

export const codebookUrl = (v: string) => `http://scdb.wustl.edu/documentation.php?var=${v}`;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const unescape = (s: string): string =>
  s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
const text = (cell: string): string => unescape(cell.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

/** `{ "<code>": "<label>" }` from one variable's page. Throws when the page has no value table. */
export function parseCodebookPage(html: string, name: string): Record<string, string> {
  const start = html.indexOf("Values:");
  if (start < 0) throw new Error(`codebook ${name}: no "Values:" section`);
  // The value table ends where the right-hand sidebar column starts.
  const end = html.indexOf('width="25%"', start);
  const body = html.slice(start, end < 0 ? undefined : end);
  const out: Record<string, string> = {};
  for (const row of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...row[1]!.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => text(m[1]!)).filter(Boolean);
    if (cells.length >= 2 && /^\d+$/.test(cells[0]!)) out[cells[0]!] = cells[1]!;
  }
  if (Object.keys(out).length === 0) throw new Error(`codebook ${name}: value table is empty`);
  return out;
}
