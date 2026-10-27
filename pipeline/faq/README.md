# Frequently asked questions

The page-level "Frequently asked questions" sections (ARCHITECTURE_MAP rule 19) come from here. Modelled on the executive-order
summaries (`pnpm summarize:eos`, `checkEoSummary`) and the social-drafts approval flow (`pipeline/insights/`).

1. **Questions** — `questions/<page>.json`, edited by hand and reviewed like code. 5-8 per page, grouped under the page's chart rows
   or sections, each with the search phrase it came from (Google autocomplete: `suggestqueries.google.com/complete/search?client=firefox&q=...`;
   Google's results page shows a bot check to scripts, so "People also ask" is gathered by hand if at all), its chart ids, its
   sources and an optional brief. Two kinds only: `matters` ("Who…?" / "Why does … matter…?") and `difference` ("What is the
   difference between X and Y?"). A source with `facts` also gets the site's own figures (`facts.ts`); `fetch` reads a PDF or
   API behind a page.
2. **Draft** — `pnpm faq:draft -- --page economy` fetches every source (`sources.ts`: HTML main text, PDFs via `pdftotext`), asks
   Claude to answer from them only, and keeps an answer only if `checkFaqAnswer` (`check.ts`) passes; three tries, then dropped.
   Writes `faq-drafts/<page>.json` (git-ignored). Needs `ANTHROPIC_API_KEY`.
3. **Issue** — `pnpm faq:issue -- --page economy` opens the page's one `faq-draft` issue (or replaces the body of the open one).
   Every answer, its sources and charts, the dropped questions, and a hidden JSON block.
4. **Publish** — adding `faq-approved` runs `.github/workflows/faq-publish.yml`: `pnpm faq:publish -- --issue N` re-checks every
   answer in the block (edits included) against the sources as they read now and writes `pipeline/output/faq_<page>.json`; the
   workflow opens a PR. A failure is commented on the issue and the label removed.
5. **Re-check** — `.github/workflows/faq-recheck.yml` runs `pnpm faq:recheck -- --open-issues` when a page's `dataFiles` change on
   main and weekly, and opens one `faq-recheck` issue per page whose answers no longer pass. A source that cannot be read is
   reported, not counted as a failure.

The drafting workflow (`faq-draft.yml`, manual) runs steps 2-3 in CI.

Adding a page: add it to `FAQ_PAGES`, write `questions/<page>.json` (rows in the page's order), add its `dataFiles` to
`faq-recheck.yml`'s paths (the tests check this), its name to `PAGE_NAME` in `issue.ts`, and it to the `page` options in `faq-draft.yml`.
