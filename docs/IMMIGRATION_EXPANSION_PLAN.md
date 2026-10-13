# Immigration page — expansion plan

Written 2026-10-13. `/presidency/immigration` currently shows two things: the ICE
removals timeline (FY2003–FY2025) and the removals-by-country card (FY2014–FY2024).
This plan adds what ICE has already published in documents we have saved in
`pipeline/raw/ice/`. It is split into sessions, each with a model and an effort
level. Copy a session's prompt into a new Claude Code session.

| Session | What | Model | Effort | Depends on |
| --- | --- | --- | --- | --- |
| A | Data pass: extract ICE breakdowns from saved reports | **Opus 5.5** | **High** | — |
| A′ | *(only if A ran on Sonnet)* Review A's extracted values | Opus 5.5 | High | A |
| B | UI: enforcement-process card + criminal-history card | Sonnet 5.5 | Medium | A |
| C | *(later)* Refugee ceiling vs. admissions | Opus 5.5 for data, Sonnet for UI | High / Medium | — |

**Status (2026-10-13):** A is done, on Opus 5.5, so A′ is not needed. The breakdown
series are in `pipeline/output/enforcement_series.json`; coverage, chart-label reads
and disagreements are in `docs/IMMIGRATION_SOURCE_NOTES.md` §6, and the data model
in the methodology's "Breakdowns and other ERO measures". Two findings for B:
interior/border runs back to FY2008 (not FY2016), and there is no printed
administrative-arrest total for FY2021–FY2022.

---

## Background (shared by all sessions)

### Why these charts

The page is thin because the methodology only admits ICE's own documents. But
the ICE reports already saved hold about 30 charts and tables the page doesn't
use: the FY2015, FY2018, FY2019 and FY2020 ERO reports and the FY2024 annual
report. Extracting them needs no new fetching and fits the existing provenance
rules and build checks.

### Ranked visualizations (from the planning discussion)

1. **Interior vs. border removals.** Removals split by arresting agency: ICE's
   own officers vs. Border Patrol handoffs.
2. **Criminal history of removals and arrests.** Convicted / pending charges /
   no known record.
3. **Refugee ceiling vs. admissions by president.** Session C, a separate source.
4. **ICE interior enforcement.** Administrative arrests, at-large arrests,
   detainers, average daily detention population.
5. Policy markers on the timeline (not planned yet: needs curation beyond
   executive orders).
6. Monthly Border Patrol encounters (not planned: different agency).
7. Immigration court backlog (not planned).
8. Long-run removals + returns across all of DHS (not planned: conflicts with the
   ICE-only rule).
9. FY2026 live detention tracker (not planned: would need ongoing snapshots).

**1 and 4 are one story.** #4 is the activity before removal (arrests →
detention); #1 is the outcome (removals, interior vs. border). Proposed design:
one card that runs **arrests → detention → removals**, plus a separate
criminal-history card (#2).

### Still ruled out

These stay out, per `docs/IMMIGRATION_ENFORCEMENT_METHODOLOGY.md`:

- per-president averages;
- any estimated FY2025 Biden/Trump split;
- combining ICE with CBP or DHS-wide counts in one chart.

### Coverage past FY2024

ICE has not published an FY2025 annual report (404 as of 2026-09-30). The DHS
FY2027 ICE budget overview (`pipeline/raw/ice/dhs-fy2027-ice-budget.txt`,
"Strategic Context" performance measures, around lines 380–440) does carry FY2025
actuals:

| Measure | FY2024 | FY2025 |
| --- | ---: | ---: |
| Total returns + removals | 271,484 | 442,637 (already ingested) |
| Removals of people with convictions or pending charges | 88,763 | 166,939 |
| ICE arrests of people with convictions or pending charges | 81,312 | 167,651 |
| Average daily detention population (FY2021–FY2025 in that table) | 37,722 | 48,706 |

What that means for each chart:

- **Criminal history:** extends to FY2025, partly. It has convicted + pending
  charges combined, with no split between them and no "no known record" figure.
- **Detention population:** extends to FY2025.
- **Interior vs. border:** stops at FY2024.
- **Total arrests, at-large arrests, detainers:** stop at FY2024.

All FY2025 values are `preliminary` (budget measures, not locked annual-report
figures). The FY2028 budget overview (expected around spring 2027) should carry
FY2026 for the same measures.

---

## Session A — data pass (Opus 5.5, high effort)

> **Prompt:**
>
> Read `docs/IMMIGRATION_EXPANSION_PLAN.md` (this file),
> `docs/IMMIGRATION_SOURCE_NOTES.md`, `docs/IMMIGRATION_ENFORCEMENT_METHODOLOGY.md`,
> `lib/enforcement-entities.ts`, `pipeline/transform/enforcement.ts`,
> `pipeline/transform/enforcement-run.ts` and
> `pipeline/reference/ice-removals-catalog.json` before writing anything.
>
> Extend the ICE enforcement track with breakdown series taken **only from ICE/DHS
> documents already saved in `pipeline/raw/ice/`**. Don't fetch anything new.
>
> **Series to extract** (as many fiscal years as the documents support; record the
> real coverage of each):
>
> 1. Removals by arresting agency: ICE ERO vs. CBP/USBP.
>    - Sources: FY2018 report Fig. 10, FY2020 Fig. 15, FY2024 Fig. 26.
>    - Also FY2013's interior/border split, which is already validated.
>    - Check whether FY2014–FY2016 exist in the FY2014/FY2015 reports or the 2016
>      removal-statistics page.
> 2. Removals by criminality: convicted / pending charges / other immigration
>    violators.
>    - Sources: FY2018 Fig. 11, FY2020 Fig. 19, FY2024 Fig. 24.
>    - Interior removals by criminality: FY2018 Fig. 5, FY2020 Fig. 20,
>      FY2024 Fig. 25.
>    - Earlier years where ICE prints convicted vs. non-convicted (FY2013–FY2016).
> 3. ERO administrative arrests, total and by criminality.
>    - Sources: FY2018 Figs. 1–2, FY2019 Fig. 9, FY2020 Fig. 9, FY2024 Fig. 6.
>    - FY2015's report may give FY2014–15.
> 4. At-large administrative arrests by criminality.
>    - Sources: FY2018 Figs. 3–4, FY2019 Fig. 10, FY2020 Fig. 11, FY2024 Fig. 8.
> 5. Detainers issued.
>    - Sources: FY2018 Fig. 8, FY2020 Fig. 13, FY2024 Fig. 11.
> 6. Average daily detention population, total and by arresting agency.
>    - Sources: FY2019 Fig. 2, FY2020 Fig. 3, FY2024 Figs. 17–18.
>    - Initial book-ins by arresting agency where available.
> 7. FY2025 values from the FY2027 budget overview's performance measures:
>    - convicted + pending removals and arrests;
>    - average daily population (FY2021–FY2025).
>    - Mark them `preliminary` with their own note, and record that they are
>      combined convicted + pending only.
>
> **Rules:**
>
> - **Follow the existing pattern:** catalog entries, a verbatim evidence quote
>   per value that must appear in the text extract, Zod schemas, build-failing
>   checks.
> - **Extend the existing series rather than inventing a parallel structure.**
>   Prefer adding metrics and/or a breakdown dimension to
>   `enforcement_series.json`. Keep `scope = ice` required; nothing from CBP or
>   DHS-wide counts.
> - **Assign chart labels carefully.** Many values are bar labels that
>   `pdftotext` scatters across the page. For each, confirm which fiscal year and
>   category it belongs to by reading the surrounding layout (and the PDF page if
>   the text is ambiguous). The evidence check can't catch a real number filed
>   under the wrong year or category.
> - **Gates:**
>   - Parts sum to the printed total wherever ICE prints one.
>   - Removals-by-agency and removals-by-criminality each sum to the national
>     `removals` value for that year (or document exactly why not, e.g. rounding
>     or later data runs).
>   - Overlapping reports agree for shared years. On a disagreement, investigate
>     and record which vintage is used; never average.
> - **Category changes:** "pending charges" appears as its own category only from
>   around FY2017. Earlier years are convicted vs. not convicted. Model this
>   explicitly. Don't back-fill a zero.
> - **Definitions:** record ICE's definitions verbatim in notes. In particular,
>   criminality is "as recorded in ICE systems at the time of the enforcement
>   action", convictions include immigration crimes, and "other immigration
>   violators" means no record in ICE systems.
> - **Missing years** stay missing; never interpolate.
>
> **Deliverables:**
>
> - pipeline changes and outputs;
> - tests (extend `lib/immigration-derive.test.ts` /
>   `pipeline/transform/enforcement.test.ts`);
> - updated coverage stats in `enforcement_report.json`;
> - a new section in `docs/IMMIGRATION_SOURCE_NOTES.md` (per-series coverage
>   table, disagreements found, chart-label reads) and in
>   `docs/IMMIGRATION_ENFORCEMENT_METHODOLOGY.md`;
> - the `ARCHITECTURE_MAP.md` rows for any new outputs.
>
> Don't build UI. Run `pnpm transform` and the tests, and report the coverage
> table and any disagreements at the end.

---

## Session A′ — value review (Opus 5.5, high effort; only if A ran on Sonnet)

> **Prompt:**
>
> Read `docs/IMMIGRATION_EXPANSION_PLAN.md`, then review the ICE breakdown series
> added in the last data pass (see the new section in
> `docs/IMMIGRATION_SOURCE_NOTES.md` and the diff to the catalog/outputs).
>
> For every extracted value, independently confirm against the text extract in
> `pipeline/raw/ice/` (and the PDF page where the extract is ambiguous) that it
> belongs to the fiscal year and category it was filed under. Pay particular
> attention to chart bar labels.
>
> List every mismatch with file, figure and the correct reading. Fix confirmed
> errors, rerun `pnpm transform` and the tests, and report what changed.

---

## Session B — UI (Sonnet 5.5, medium effort)

> **Status (2026-10-13): built on branch `feat/immigration-ui-cards`, in a different shape from the prompt below.** After mockups
> (the final design is `docs/mockups/immigration-cards-mockup-v5.html`), the page has: the existing removals chart extended in place (stacked by
> arresting agency, average-detained line on the same axis, colours no longer by president); one criminal-history card
> (All / ICE / Border Patrol and Counts / Share pills, one fixed scale); the country card unchanged at the bottom. Arrests and
> detainers were dropped as too esoteric. The "open question" below was settled: neither combined card nor two cards. See
> `ARCHITECTURE_MAP.md` (Immigration page) for the recorded decisions.

> **Prompt:**
>
> Read `docs/IMMIGRATION_EXPANSION_PLAN.md`, `ARCHITECTURE_MAP.md` (especially
> "Page-level layout rules"), `CLAUDE.md`, the immigration methodology and source
> notes, and the existing components in `components/immigration/` before writing
> anything.
>
> Add two cards to `/presidency/immigration`, below the removals timeline, using
> the breakdown series from session A:
>
> 1. **Enforcement process card:** arrests → detention → removals.
>    - Small multiples or a linked sequence covering:
>      - ERO administrative arrests (with at-large share);
>      - detainers issued;
>      - average daily detention population;
>      - removals split by arresting agency (ICE interior vs. Border Patrol
>        handoffs).
>    - Same fiscal-year window and president colouring as the timeline, driven
>      by the existing filter bar's range.
>    - Shorter coverage than the timeline: show empty slots for missing years.
>      Don't compress the axis.
> 2. **Criminal-history card:** removals (and arrests) by convicted / pending
>    charges / no known record.
>    - Where only convicted vs. not exists (before ~FY2017), show two
>      categories, not a zero third.
>    - FY2025 shows only the combined convicted + pending figure. Draw it
>      dashed/preliminary like FY2025 on the timeline, with no split.
>
> **Rules:**
>
> - **Data notes:** each card gets a collapsed "Data notes" block. It covers:
>   - ICE's criminality definition (recorded in ICE systems at the time of the
>     action; convictions include immigration crimes; "no known record" is not a
>     finding about the person);
>   - "arresting agency" is not strictly interior vs. border;
>   - FY2025 values come from a DHS budget document and are preliminary;
>   - years with no ICE figure are blank, not zero.
> - **Copy:** never combine with CBP/DHS-wide counts in copy or charts. No
>   per-president averages, and no FY2025 Biden/Trump split.
> - **Selected year:** keep the existing selected-year behaviour coherent. A
>   bar click on the timeline should highlight that year in the new cards too.
> - **Page intro and source line:** update the intro in `ImmigrationPageClient`
>   and the source line to mention the new cards.
> - **Mobile:** it must work at phone width.
>
> Verify in the browser preview (light and dark, desktop and mobile), and update
> `ARCHITECTURE_MAP.md` if a new convention is settled.
>
> **Open question to raise with me before building, not decide alone:** one
> combined enforcement-process card vs. two separate cards (removals by agency;
> interior enforcement).

---

## Session C — refugee ceiling vs. admissions (later)

Separate source, separate card. Do a source check first, as in
`IMMIGRATION_SOURCE_NOTES.md`:

- **Ceilings:** the annual Presidential Determination on Refugee Admissions in
  the Federal Register, FY1980 onward, including mid-year revisions.
- **Admissions:** State Department refugee admissions reports. Check the
  current publisher and URLs, and whether 2025 publication changed.

**Caveats to carry:**

- Admissions are counted differently from the ceiling, and some years had
  reserved or unallocated portions.
- Ceilings can be revised mid-year.
- The pandemic depressed FY2020–21 admissions on its own.

Data on Opus (high), UI on Sonnet (medium), same split as A/B.
