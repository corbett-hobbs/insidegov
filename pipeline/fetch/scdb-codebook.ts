import { writeFile } from "node:fs/promises";
import { CODEBOOK_VARS, codebookUrl, parseCodebookPage } from "./scdb-codebook-lib";

/**
 * The Supreme Court Database codebook's value labels for the variables the decision pages show (parties, courts, why the
 * Court took the case, the outcome, the legal provision): one page per variable, 13 requests. Manual refresh, not part of
 * `fetch:all`; re-run when SCDB adds codes (the decisions transform fails on a code the file does not have).
 *
 *   pnpm fetch:scdb-codebook
 *
 * Writes `pipeline/reference/scdb-codebook.json`. Exit 2 when the host is unreachable.
 */
const OUT = "pipeline/reference/scdb-codebook.json";

async function main() {
  const vars: Record<string, Record<string, string>> = {};
  for (const v of CODEBOOK_VARS) {
    let res: Response;
    try {
      res = await fetch(codebookUrl(v), { signal: AbortSignal.timeout(60_000) });
    } catch (e) {
      console.error(`GET ${codebookUrl(v)}: ${e instanceof Error ? e.message : e}`);
      process.exit(2);
    }
    if (!res.ok) {
      console.error(`GET ${codebookUrl(v)} -> ${res.status}`);
      process.exit(2);
    }
    // The pages are served as Latin-1.
    const html = new TextDecoder("latin1").decode(await res.arrayBuffer());
    vars[v] = parseCodebookPage(html, v);
    console.log(`  ${v}: ${Object.keys(vars[v]).length} values`);
  }
  const file = {
    _comment: "Value labels from the Supreme Court Database's online codebook, in its own wording (pnpm fetch:scdb-codebook). The decision pages read them through lib/decision-page-derive.ts; caseOrigin uses the caseSource list and every *State variable the petitionerState list, as the codebook does.",
    source: "http://scdb.wustl.edu/documentation.php",
    fetched: new Date().toISOString().slice(0, 10),
    vars,
  };
  await writeFile(OUT, JSON.stringify(file, null, 2) + "\n");
  console.log(`scdb codebook: ${CODEBOOK_VARS.length} variables -> ${OUT}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
