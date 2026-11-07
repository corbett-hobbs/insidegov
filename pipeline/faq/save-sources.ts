import { FAQ_PAGES, readQuestionList } from "./questions";
import { readSource } from "./sources";

/**
 * Reads every source on every question list, refreshing the committed copies in `pipeline/raw/faq-sources/` that publishing
 * and the re-check fall back on when a site refuses GitHub's runners. Run from a machine that can reach the sites (BLS does
 * not answer GitHub), then commit the copies.
 *
 *   pnpm faq:sources
 */
const seen = new Set<string>();
let failed = 0;
for (const page of FAQ_PAGES)
  for (const g of readQuestionList(page).groups)
    for (const q of g.questions)
      for (const s of q.sources) {
        if (seen.has(s.url)) continue;
        seen.add(s.url);
        try {
          const r = await readSource(s);
          console.log(`  ${r.saved ? `saved copy (${r.saved})` : "read"}  ${s.url}`);
        } catch (err) {
          failed++;
          console.log(`  FAILED  ${(err as Error).message}`);
        }
      }
console.log(`faq:sources  ${seen.size - failed} of ${seen.size} sources read`);
if (failed) process.exit(1);
