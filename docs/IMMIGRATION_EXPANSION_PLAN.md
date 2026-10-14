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
| D | Refresh automation for the refugee and ICE tracks | Sonnet 5.5 | Medium | A, C |
| E | Legal track, pipeline: green cards and naturalizations (OHSS) | **Opus 5.5** | **High** | — |
| F | Legal track, UI: green cards by class, naturalizations, countries of origin | Sonnet 5.5 | Medium | E |
| G | Legal track, pipeline: temporary visas issued (State Dept.) and entries (I-94) | **Opus 5.5** | **High** | E (reuses its raw OHSS snapshot) |
| H | Legal track, UI: temporary visas card | Sonnet 5.5 | Medium | G |
| I | Legal track, pipeline: H-1B (access gate first) | **Opus 5.5** | **High** | — |
| J | Legal track, UI: H-1B card | Sonnet 5.5 | Medium | I |
| K | Refresh automation for the legal track | Sonnet 5.5 | Medium | E, G, I |

Sessions E–K are the **legal immigration track**, added 2026-10-13 (see the section
at the end of this file). It is independent of A–D, and each pipeline session (E, G, I)
can run in parallel with the others. Run every session in its own git worktree, not
the shared checkout.

**Status (2026-10-13):** A is done, on Opus 5.5, so A′ is not needed. The breakdown
series are in `pipeline/output/enforcement_series.json`; coverage, chart-label reads
and disagreements are in `docs/IMMIGRATION_SOURCE_NOTES.md` §6, and the data model
in the methodology's "Breakdowns and other ERO measures". Session D is done (2026-10-13): see "Session D status" below. Two findings for B:
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

**Status (2026-10-13): data pass done**, addendum included. Outputs `refugee_*.json`;

**UI (2026-10-14): built** on the Immigration page as a second section under the ICE cards (one page header and two sub-headers; ceiling chart split by region, country/region map and list, "Who's sent the most refugees"). Decisions and the cards that were mocked and cut are in `ARCHITECTURE_MAP.md`'s Immigration section.
methodology `docs/REFUGEE_ADMISSIONS_METHODOLOGY.md`; source check
`docs/IMMIGRATION_SOURCE_NOTES.md` §7. Findings that change the UI brief:

- Ceilings cover FY1981–FY2027 (FY1980 has none); FY1981–86 and FY1990 come from a CRS
  compilation, so they have no initial ceiling or revision dates.
- The State Department's country column is country of **chargeability**, not nationality.
- The USCIS benefits hold, the asylum restart and the D.R.I. ruling were **not** ingested: no
  primary copy was found, and they concern benefit applications, not refugee admissions.
- For Session D: Federal Register *discovery* is automatic, but a new determination fails the
  build until its catalog row is curated (so: detect + PR for review, not auto-merge). The State
  Department workbook is renamed monthly: check-and-issue.

### Session C addendum (2026-10-13): origins and country restrictions

Added after session C had already started; it was sent to that session directly.

**Extra series to source-check:**

- **Admissions by country of nationality** per fiscal year.
  - Source: State Department Refugee Processing Center (WRAPS) "admissions and
    arrivals" reports, about FY2002 onward.
  - Confirm WRAPS still publishes after the January 2025 suspension.
  - Cross-check against the DHS yearbook's (OHSS) refugee arrivals by
    nationality where they overlap.
  - Key by the ISO alpha-3 `country_code` and reuse the alias approach from
    `removals_by_country`.
- **Regional allocations** from each presidential determination (Africa, East
  Asia, Europe/Central Asia, Latin America/Caribbean, Near East/South Asia,
  unallocated reserve). Presidential determinations cap by region, not by
  country, so this gives allocation vs. admissions by region.
- **Mid-year revisions** as dated rows:
  - FY2026: 7,500, raised to 17,500 by an emergency determination dated
    May 21, 2026.
  - FY2027: 17,500, PD No. 2026-24 (91 FR 63119, Oct 2, 2026).
  - FY2026 and FY2027 allocate "primarily" to Afrikaners (EO 14204) rather than
    by region, and stay subject to EO 14163. Model group allocation explicitly.

**Country restrictions are rules, not counts.** Keep them in a dated policy
table for a marker lane:

- EO 14163 (refugee suspension, Jan 20, 2025);
- the June 2025 travel ban (19 countries, including Afghanistan, Haiti and
  Somalia);
- PP 10998 (39 countries, effective Jan 1, 2026);
- the USCIS processing hold (Dec 2, 2025; widened Jan 1, 2026);
- the partial asylum restart (Mar 30, 2026);
- the D.R.I. ruling vacating the hold (Jun 5, 2026).

Only secondary summaries have been checked so far. Verify each against the
primary text, including how the travel ban applies to refugee admissions.
Give every row an "as of" date.

**Extra caveats:**

- Refugees, asylum seekers and TPS holders are different statuses; only
  refugees go on these charts. Much of the Haiti/Somalia/Afghanistan news is
  about TPS terminations or the travel ban.
- FY2025 had a ceiling set by the Biden administration but almost no
  admissions after Jan 20.
- Nationality is not always the country fled.

---

## Session D — refresh automation (Sonnet 5.5, medium effort; after A and C land)

Goal: as little manual upkeep as each source allows. Automate fully where the
source is stable; elsewhere, detect new data and hand a human a ready-to-review
change.

Existing patterns to reuse (read them first):

- **Fetch, diff, auto-merge:** `.github/workflows/executive-orders-freshness.yml`
  and `energy-freshness.yml`. Fetch, diff against `pipeline/raw/`, open a PR with
  `peter-evans/create-pull-request`, auto-merge only after the full CI gate
  (`.github/actions/gate-and-merge`). Executive orders also call the Claude API
  in CI (`ANTHROPIC_API_KEY` secret), with low-confidence answers stored as
  `needs_review`.
- **Detect, open an issue:** `.github/workflows/ice-annual-review.yml`
  (`pipeline/validate/ice-staleness.ts`) and the `*-review.yml` workflows.
  These open one issue, never edit data and never block a deploy.

| Piece | Target | Pattern |
| --- | --- | --- |
| Refugee ceilings, regional/group allocations, mid-year revisions (Federal Register) | Fully automatic | Fetch, diff, auto-merge PR (stable Federal Register API) |
| Refugee admissions by nationality (WRAPS) | Automatic if session C found stable URLs/formats; otherwise detect + issue | Fetch, diff, PR, or a review issue |
| ICE breakdown series from session A | Detect + issue | Extend `ice-staleness.ts` to every new metric, not just `removals` |
| DHS budget overview (FY2028 onward carries the prior year's actuals) | Detect + issue | Check whether the next year's ICE budget overview has been published |
| Extracting numbers from a new ICE report or budget document | Draft PR, human review | Optional: when the ICE issue opens, a CI job uses the Claude API to draft catalog rows with verbatim quotes and opens a PR. **Never auto-merged**: chart-label reads need a person |
| Country-restriction policy table | Flag only | Weekly Federal Register search for immigration/refugee proclamations and EOs not yet in the table; open a review issue. Curation and court status stay manual |

> **Prompt:**
>
> Read `docs/IMMIGRATION_EXPANSION_PLAN.md` (especially the Session D section),
> `docs/IMMIGRATION_ENFORCEMENT_METHODOLOGY.md` ("Refreshing"), session C's
> refugee methodology and source notes, `.github/workflows/executive-orders-freshness.yml`,
> `.github/workflows/energy-freshness.yml`, `.github/workflows/ice-annual-review.yml`,
> `.github/actions/gate-and-merge` and `pipeline/validate/ice-staleness.ts` before
> writing anything.
>
> Build the refresh automation in the Session D table, reusing those patterns
> rather than inventing new ones.
>
> - **Refugee Federal Register data:** fetch, diff, PR, gate-and-merge,
>   on a weekly schedule.
> - **WRAPS admissions:** automate the same way only if session C's notes say its
>   source is stable; otherwise add a staleness check that opens a review issue.
> - **ICE staleness check:** extend it to cover every metric session A added and
>   the DHS budget overview, still opening one issue and never editing data.
> - **Policy-table watcher:** opens a review issue for new immigration/refugee
>   Federal Register documents not yet in the table.
> - **Draft-PR job (optional):** for the ICE extraction, build it only if it
>   fits the existing Claude-API-in-CI pattern cleanly. It must never auto-merge.
>
> Every workflow must support `workflow_dispatch` and be safe to rerun (no
> duplicate issues or PRs). Never splice another agency's data into the ICE
> series. Document the refresh behaviour in each track's methodology doc and in
> `ARCHITECTURE_MAP.md`. Run each workflow's script locally to show it detects
> correctly in both directions (stale and not stale).

### Session D status (2026-10-13)

Built, each documented in the track's methodology doc and `ARCHITECTURE_MAP.md`:

| Piece | Built as |
| --- | --- |
| Refugee ceilings, allocations, revisions | `.github/workflows/refugee-freshness.yml`: weekly fetch, diff, PR, `gate-and-merge`. A new PD fails the transform by design, so that PR opens "(needs curation)" and is not merged; the allocation tables need quoted numbers a person has to check |
| WRAPS admissions | Not automated (the workbook's file name changes monthly): `refugee-admissions-review.yml` + `pipeline/validate/refugee-staleness.ts`, one issue; also flags the next DHS refugee yearbook |
| ICE series | `ice-staleness.ts` now checks each series in `ICE_SERIES` and the DHS budget overview page; `ice-annual-review.yml` opens, refreshes or closes one issue |
| Policy-table watcher | `immigration-policy-review.yml` + `pipeline/validate/policy-watch.ts`; config and reviewed list in `pipeline/reference/immigration-policy-watch.json` |
| ICE extraction draft PR | **Not built**: no stable URL to fetch, values are chart-label reads that need a person, and it could never be merged unreviewed |

Shared: `.github/actions/open-review-issue` (one issue per label, refreshed on rerun, closed when clean); pure logic and tests in `pipeline/validate/refresh-lib.ts`.

---

# Legal immigration track (sessions E–K)

Added 2026-10-13. Everything above is enforcement (ICE) and refugees. This track adds
**people who come legally**: green cards, naturalizations, temporary visas (tourist,
student, exchange, work) and H-1B. Sources were checked by web search on 2026-10-13
only; **nothing has been downloaded yet**. Each pipeline session therefore starts with
a source check and may stop and report if a source is unusable.

## Background (shared by E–K)

### Sources, and what each one counts

Every source counts something different. Each gets its own chart; **never sum across
them, and never put two in one chart.**

| Measure | Publisher / URL | What it counts | Coverage (verify) | Format |
| --- | --- | --- | --- | --- |
| Green cards (LPRs) by class, country, type of adjustment; naturalizations; refugee arrivals; I-94 admissions | DHS Office of Homeland Security Statistics (OHSS): [Legal Immigration and Adjustment of Status Report](https://ohss.dhs.gov/topics/immigration/legal-immigration-and-adjustment-status-report) and the Yearbook of Immigration Statistics | People who became permanent residents (arrivals with a visa + adjustments inside the US) | Quarterly report FY2016–FY2025 (FY2025 file posted 2026-06-04); Yearbook goes much further back | XLSX |
| Temporary visas **issued**, by visa class and nationality | State Dept. Bureau of Consular Affairs: monthly "NIV Issuances by Nationality and Visa Class" and by post; annual Report of the Visa Office tables | Visa foils issued abroad, not entries | Monthly FY2026 seen; annual back to about the late 1990s | PDF (check for XLSX/CSV) |
| H-1B petitions approved/denied, employer, country, state, NAICS | USCIS [H-1B Employer Data Hub](https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub) | Petition decisions, not people; employers identified by the last 4 digits of their tax ID | FY2009–FY2026 Q3 | Excel/CSV through a Tableau-style download; one news report says the bulk files for FY2024–26 were missing |
| H-1B job offers and wage levels | Dept. of Labor LCA disclosure data | Employer applications (certified positions), not approved workers | about FY2008 onward | XLSX |
| H-1B cap registrations and selections | USCIS cap-season announcements | Registrations | Short series: FY2027 had 211,600 eligible registrations (down 38.5% from 343,981 for FY2026) | Web pages (hand-curated) |
| International students | IIE Open Doors / Fall Snapshot, ICE SEVIS by the Numbers, State F-1 issuance | Enrollment (not visas) | Open Doors 1948–; Fall 2025 new enrollment −17% | Web / XLSX; **not planned** (see "Not planned") |

### Rules for the track (carried from A–D and the page-level rules)

- **One agency and one definition per chart, labeled in the subtitle.** Green cards (OHSS),
  visas issued (State), entries (OHSS I-94) and H-1B petitions (USCIS) are four
  different units. A person can appear in several (an H-1B holder later gets a green card).
- **No per-president averages.** Classes and counting rules change across eras; the
  averages would read as a like-for-like comparison they aren't.
- **Provenance as in the ICE and refugee tracks:** raw snapshots committed under
  `pipeline/raw/<source>/`, a Zod schema at the boundary, build-failing invariants,
  and a reference/catalog file for anything hand-curated (with the source URL and, for
  web pages and PDFs, a verbatim quote that must appear in the saved text; for
  spreadsheets, the sheet and cell range instead of a quote).
- **Fiscal years**, attributed to the administration in office on Sep 30 (the ICE rule,
  `ADMINISTRATIONS` + `termIdForDate`); no second terms table.
- **Preliminary values** (quarterly OHSS before the Yearbook, State's current partial
  year) are marked `preliminary` and drawn dashed and lighter, like ICE FY2025.
- **Missing years stay missing**; never interpolate or back-fill a zero. Category
  schemes that change over time are modelled as eras, not merged silently.
- Output files follow the `refugee_*` shape: `<prefix>_series.json`,
  `<prefix>_notes.json`, `<prefix>_report.json` (plus a by-country file where needed).
  Proposed prefixes: `lpr_` (green cards + naturalizations), `niv_` (visas issued and
  I-94 entries), `h1b_`. Not `legal_`, which would collide with the Congress "laws" track.
- Every pipeline session updates `ARCHITECTURE_MAP.md` (pipeline output rows) and its
  methodology doc; every UI session updates the Immigration section of
  `ARCHITECTURE_MAP.md`.

### Open questions to raise with me, not decide alone

1. **Page length.** `/presidency/immigration` already has an ICE section and a refugee
   section under one page header. A third (and fourth) section may be too long. Before
   F's cards are built, propose either another sub-header on the same page or a split
   into sub-pages, with the nav change that implies.
2. **Order of the sections** on the page (enforcement first, as today, or legal first).
   **Settled (2026-10-13): legal immigration first, then refugees, then enforcement.**
3. **Whether to include H-1B at all** if session I finds the bulk data unusable.

### Not planned

International students (Open Doors / SEVIS; a different publisher and unit), Visa Bulletin
backlogs, immigrant visas issued abroad (a different count from green cards), TPS
and asylum grants (different statuses), and any live or monthly tracker.

---

## Session E — legal track pipeline: green cards and naturalizations (Opus 5.5, high effort)

Source: OHSS. This is also the base for F, and G reuses its raw snapshot.

**Status (2026-10-13): done**, on Opus 5.5. Outputs `lpr_series.json`, `lpr_by_country.json`,
`lpr_notes.json`, `lpr_report.json`; methodology `docs/LPR_METHODOLOGY.md`; source check
`docs/IMMIGRATION_SOURCE_NOTES.md` §8. Findings that change F's brief:

- **Coverage:** green-card and naturalization totals FY1977–FY2025; classes, new arrivals vs.
  adjustments and countries FY1999–FY2025. FY2025 is preliminary (quarterly report only).
- **Country basis changes in the newest year:** the Yearbook (FY1999–FY2024) is by country of
  **birth**, the quarterly report (FY2025) by country of **nationality**. The map/list must label the
  basis and never show a change between FY2024 and FY2025 per country (`rankLprCountries` already
  returns `change: null` there).
- **Naturalizations are N-400 filers aged 18+**, not every new citizen; they follow USCIS processing.
- **Two restatements to footnote:** FY2008 special immigrants (1,770 from employment to other) and the
  FY2013–FY2019 new-arrival/adjustment revision. Totals agree across every edition.
- **Rounding:** FY2015 on and all naturalization totals are rounded to ten; parts may not add exactly.
- `lib/lpr-data.ts` → `getLprPayload()` is ready (years with classes, types, naturalizations, terms,
  notes, countries by year); nothing renders it yet.

> **Prompt:**
>
> Read `docs/IMMIGRATION_EXPANSION_PLAN.md` (the "Legal immigration track" section),
> `docs/DATA_CONVENTIONS.md`, `docs/REFUGEE_ADMISSIONS_METHODOLOGY.md`,
> `docs/IMMIGRATION_SOURCE_NOTES.md` §7, `pipeline/transform/enforcement-run.ts`,
> `pipeline/fetch/ice.ts`, `pipeline/fetch/refugee.ts`, `lib/refugee-entities.ts` and
> `lib/refugee-data.ts` before writing anything. Work in your own git worktree, not
> the shared checkout.
>
> **Phase 1: source check (stop and report if a source is unusable).** Write it up as
> a new section in `docs/IMMIGRATION_SOURCE_NOTES.md`, as session C did.
>
> - Download the OHSS Legal Immigration and Adjustment of Status Report workbooks
>   (FY2016–FY2025) and the Yearbook of Immigration Statistics tables for green cards
>   (LPRs) and naturalizations. Snapshot them under `pipeline/raw/ohss/`; they are
>   small. Record URL, retrieval date and a hash for each.
> - For each table you intend to use, record sheet name, header rows, and the unit
>   (persons admitted/adjusted).
> - Establish **how far back the Yearbook gives a consistent series** for: total LPRs;
>   LPRs by class of admission (family-sponsored, employment-based, immediate
>   relatives of citizens, refugee/asylee, diversity, other); new arrivals vs.
>   adjustments of status; LPRs by country; naturalizations total and by country.
> - Find out what the **country dimension is** (country of birth vs. nationality vs.
>   chargeability). The quarterly report and the Yearbook may differ; document it.
> - Find where the **class taxonomy changes** over the years (laws that created
>   or renamed categories) and model each as an era. Don't back-fill.
> - Decide which fiscal year is the **latest final** one (Yearbook) and which are
>   quarterly-report-only (preliminary). Check the quarterly page's own date
>   inconsistency (footer vs. posting dates).
> - Check whether the same workbooks carry **I-94 admissions** and refugee arrivals;
>   note it for G and do not ingest them here. Cross-check refugee arrivals against
>   `refugee_series.json` where they overlap and record any gap.
>
> **Phase 2: pipeline.**
>
> - `pipeline/fetch/ohss.ts` (download + snapshot, the `ice.ts` pattern), a pure
>   `pipeline/transform/lpr.ts` with `lpr-run.ts` and tests (`lpr.test.ts`), outputs
>   `pipeline/output/lpr_series.json` (one row per fiscal year, metric, dimension
>   value), `lpr_by_country.json`, `lpr_notes.json`, `lpr_report.json`, and a catalog
>   under `pipeline/reference/` for provenance (sheet and cell range per value).
> - Metrics: LPRs total; by class; by arrival vs. adjustment; naturalizations total.
>   By-country for LPRs and naturalizations, keyed by ISO alpha-3 `country_code`
>   (reuse the alias approach from `removals_by_country` and the refugee track;
>   historical entities such as the USSR or Yugoslavia are noted or excluded, not
>   guessed).
> - Zod schemas in `lib/lpr-entities.ts`, server-only `lib/lpr-data.ts`, pure
>   `lib/lpr-derive.ts` with tests over the real files. Build-failing invariants:
>   - classes sum to the printed total for each year;
>   - arrivals + adjustments = total;
>   - country rows sum to the printed total, with an explicit "other / unknown" bucket;
>   - the Yearbook and the quarterly report agree for shared years; on a
>     disagreement record which vintage is used. Never average;
>   - each year has a status (`final` or `preliminary`).
> - Notes (`lpr_notes.json`): era changes in the class scheme, the country basis,
>   FY2020–21 pandemic effects as a factual note (no interpretation), and every
>   restatement found.
>
> **Deliverables:** pipeline and outputs, tests, a source-check section in
> `docs/IMMIGRATION_SOURCE_NOTES.md`, `docs/LPR_METHODOLOGY.md` (coverage table,
> definitions verbatim, refresh behaviour), `ARCHITECTURE_MAP.md` rows. No UI.
> Run `pnpm transform` and the tests; report the coverage table, era changes,
> disagreements, and your recommendation on the F open questions.

---

## Session F — legal track UI: green cards, naturalizations, origins (Sonnet 5.5, medium effort)

> **Prompt:**
>
> Read `docs/IMMIGRATION_EXPANSION_PLAN.md` (the "Legal immigration track" section,
> including its open questions), `ARCHITECTURE_MAP.md` ("Page-level layout rules"
> and the Immigration page section, including the refugee section's recorded
> decisions and the cards that were mocked and cut), `CLAUDE.md`,
> `docs/LPR_METHODOLOGY.md`, and the existing components in
> `components/immigration/` (especially `RemovalsCountryCard`, `RemovalsMap`,
> `RefugeeCeilingCard`, `RefugeeCountryCard`, `RefugeeSection`) before writing
> anything. Work in your own git worktree.
>
> **Mock first.** Produce an HTML mockup under `docs/mockups/` (as session B did)
> and get my sign-off on the layout and the page-length question before building.
> Raise the plan's open questions 1 and 2 with a recommendation; don't decide alone.
>
> **Cards (reuse existing patterns, no forks):**
>
> 1. **Green cards by year** (`charts/StackedBars` or the foreign-aid
>    `SpendingChart` pattern): one bar per fiscal year, stacked by class of admission,
>    with the presidential-term band (rule 10b) and the two-handle year slider
>    (rule 5b). Naturalizations are a second series on the same card; either a
>    line on its own scale or a second panel, whichever the mock settles. Do not
>    plot them on one axis as if they were parts of the same total.
>    - Tooltip with sticky behaviour (rule 6a); preliminary years dashed and lighter;
>      numbered tap-to-pin markers (rule 6) for class-scheme changes and other
>      on-axis notes; anything not tied to a position goes in Data notes (rule 7).
> 2. **Where legal immigrants come from:** the `RemovalsCountryCard` pattern, a choropleth
>    (fixed absolute bins, top three callouts per rule 9a, zoom/pan) and a ranked list
>    with a year picker, green cards by default with a Green cards / Naturalizations
>    toggle. Small countries get the "Not on the map" treatment the other maps use.
>    The selected year follows the same rules as the other cards (slider's last
>    year, bar click sets it).
>
> **Rules:**
>
> - Data notes on each card: what is counted (people becoming permanent residents,
>   not visas issued), arrival vs. adjustment, country basis, class-scheme eras,
>   preliminary years, FY2020–21 as a factual note.
> - Copy never mixes green cards with visas, entries or ICE/refugee counts.
>   No per-president averages.
> - Page intro and source line in `ImmigrationPageClient` mention the new section;
>   use `PageHeader` (no `max-w-*`).
> - Phone width must work. Every control follows the compact pinned-filter-bar rule.
>
> Verify in the browser preview (light and dark, desktop and mobile) and update
> `ARCHITECTURE_MAP.md` with the decisions made.

---

## Session G — legal track pipeline: temporary visas issued and I-94 entries (Opus 5.5, high effort)

Sources: State Dept. consular statistics, plus the I-94 admissions in the OHSS workbooks
snapshotted by E.

> **Prompt:**
>
> Read `docs/IMMIGRATION_EXPANSION_PLAN.md` (the "Legal immigration track" section),
> session E's `docs/LPR_METHODOLOGY.md` and the OHSS section of
> `docs/IMMIGRATION_SOURCE_NOTES.md`, `pipeline/fetch/ice.ts` (PDF → text extract
> pattern), `pipeline/transform/enforcement-run.ts`, and
> `lib/enforcement-entities.ts` before writing anything. Work in your own git worktree.
>
> **Phase 1: source check (stop and report if a source is unusable).**
>
> - **Annual** State Dept. nonimmigrant visa issuance tables by visa class and
>   by nationality (the Report of the Visa Office / "Nonimmigrant Visa Statistics"
>   pages on travel.state.gov): which fiscal years exist, in what format (PDF or
>   spreadsheet), and where they are published now.
> - **Monthly** "NIV Issuances by Nationality and Visa Class" PDFs. The FY2026
>   files (October 2025 onward) exist, but one secondary report says State stopped
>   publishing monthly statistics for about 11 months and resumed in August 2026.
>   Verify against State's own pages which months are missing and whether the annual
>   tables cover FY2025. **A gap stays a gap in the series.**
> - Whether the PDFs extract cleanly with `pdftotext -layout`, and whether the
>   by-nationality tables and the by-class tables agree on the same totals.
> - From E's raw OHSS snapshots: confirm the **I-94 admissions** table (nonimmigrant
>   entries by class of admission) and its coverage.
> - Record the **Visa Waiver Program** limitation (visitors from waiver countries do not
>   need a visitor visa, so visitor visas issued undercounts visitors) and find a
>   primary source for the statement.
>
> **Phase 2: pipeline.**
>
> - `pipeline/fetch/state-niv.ts` snapshots into `pipeline/raw/state-niv/` with a
>   `.txt` extract each; a curated catalog under `pipeline/reference/` (value + verbatim
>   quote or table position, as the ICE catalog does) for anything not machine-parsed.
>   Pure `pipeline/transform/niv.ts`, `niv-run.ts`, tests.
> - Outputs `niv_series.json` (fiscal year × visa class, plus nationality for the
>   classes worth mapping), `niv_entries.json` (I-94 admissions by class, from OHSS),
>   `niv_notes.json`, `niv_report.json`.
> - **Visa class groups** (fixed in code, listed in the methodology): tourist/business
>   (B), students (F, M), exchange (J), temporary workers (H-1B, H-2A, H-2B, L, O, P, TN
>   and similar), diplomats and officials (A, G), crew/transit, other. Keep the
>   underlying class codes in the data; the grouping is a view.
> - Invariants: class rows sum to the printed total for each period; nationality rows
>   sum to the class total (with "other"); where monthly files exist, 12 months sum
>   to the annual table or the difference is documented; annual and monthly vintages
>   agree on shared periods, otherwise record which is used.
> - Country alias handling as in the other tracks; use ISO alpha-3.
>
> **Deliverables:** pipeline, outputs, tests, a source-check section in
> `docs/IMMIGRATION_SOURCE_NOTES.md`, `docs/NIV_METHODOLOGY.md`, and
> `ARCHITECTURE_MAP.md` rows. No UI. Report coverage (including gaps), the
> grouping table, any disagreements, and the Visa Waiver caveat's source.

---

## Session H — legal track UI: temporary visas (Sonnet 5.5, medium effort)

> **Prompt:**
>
> Read `docs/IMMIGRATION_EXPANSION_PLAN.md` (the "Legal immigration track" section),
> `ARCHITECTURE_MAP.md` (page-level rules and the Immigration section, including
> session F's recorded decisions), `CLAUDE.md`, `docs/NIV_METHODOLOGY.md`, and the
> components F added before writing anything. Work in your own git worktree.
>
> **Mock first** under `docs/mockups/` and get sign-off.
>
> **Card:** visas **issued** per fiscal year, stacked by the grouped visa classes,
> in the same chart pattern and the same year slider and term band as F's green-card
> card. Gap years (any months State did not publish) are empty slots, not zeros
> and not a compressed axis. Preliminary or partial years are hatched/dashed. An
> optional second view, by nationality, for one class group (default students):
> choropleth + ranked list on the `RemovalsCountryCard` pattern. Raise with me
> whether to build the nationality view at all after seeing the data.
>
> **Entries card (optional, decide in the mock):** I-94 admissions by class, as its own
> chart. **Never on the same axis or in the same chart as visas issued.**
>
> **Rules:** Data notes covering: visas issued are not entries or people; Visa
> Waiver visitors need no visa and are not counted; the year each class was
> grouped under; gaps in State's publication; FY2020 pandemic and 2025 consular
> pauses as factual notes only (state what was announced, with the date and source;
> no causal claims). Phone width, light and dark, as F. Copy never mixes with
> green-card, ICE or refugee numbers.
>
> Verify in the browser preview and update `ARCHITECTURE_MAP.md`.

---

## Session I — legal track pipeline: H-1B (Opus 5.5, high effort)

The riskiest source. **Do the access gate first and report before building.**

> **Prompt:**
>
> Read `docs/IMMIGRATION_EXPANSION_PLAN.md` (the "Legal immigration track" section),
> `docs/IMMIGRATION_SOURCE_NOTES.md`, `pipeline/fetch/ice.ts`,
> `pipeline/fetch/refugee.ts`, `pipeline/reference/ice-removals-catalog.json` and
> `pipeline/fetch/executive-orders.ts` (the nearest Federal Register fetch) before
> writing anything. Work in your own git worktree.
>
> **Phase 0: access gate. Stop and report before Phase 1.**
>
> - Can the USCIS H-1B Employer Data Hub files for each fiscal year be downloaded
>   **by script** (the "H-1B Employer Data Hub Files" page; direct CSV/XLSX links)? The
>   hub page says FY2009–FY2026 Q3, but one news report says the bulk files for
>   FY2024–26 are missing and the pages are tagged archived. Check each year.
> - Is the DOL LCA disclosure data (XLSX) available for the same years, and from
>   where?
> - Can the cap-season announcements (registrations received, eligible registrations,
>   selected) be found for each year the lottery has existed?
> - Report: what is usable, what is only hand-curatable, what is not available.
>   **If nothing bulk is available, say so and recommend: curated-only (cap registrations
>   plus a handful of annual totals from USCIS reports) or drop the H-1B card.**
>
> **Phase 1: pipeline (after I approve the Phase 0 outcome).**
>
> - Snapshots under `pipeline/raw/h1b/`; pure transform, run script and tests, like E.
> - Series, as far as the sources allow: petitions approved and denied per fiscal
>   year, initial vs. continuing; top countries of birth; top employers (name,
>   approvals) per year; LCA certified positions by wage level (if used);
>   cap registrations, eligible registrations and selections per cycle (hand-curated
>   catalog with source URL and a verbatim quote per value).
> - Note that the hub **counts petitions, not people**, that continuing approvals
>   are not new workers, and that employers are keyed by name plus the last four
>   tax-ID digits; the LCA counts requested positions. These units never share a chart.
> - **Policy marker table** (dated, curated, each row with an "as of" date, verified
>   against the primary text, not secondary summaries): at minimum the Presidential
>   Proclamation requiring an additional $100,000 payment for certain petitions filed
>   at or after Sept 21, 2025, and the wage-weighted selection first used for FY2027.
>   Check for earlier proclamations or rule changes before adding more. Court status
>   stays manual; record only what the primary text says.
> - Invariants: parts sum to totals where printed; overlapping vintages agree or
>   the disagreement is recorded; preliminary partial years are flagged.
>
> **Deliverables:** pipeline, outputs `h1b_series.json`, `h1b_employers.json`,
> `h1b_policy.json`, `h1b_notes.json`, `h1b_report.json`, tests, a source-check
> section in `docs/IMMIGRATION_SOURCE_NOTES.md`, `docs/H1B_METHODOLOGY.md`, and
> `ARCHITECTURE_MAP.md` rows. No UI.

---

## Session J — legal track UI: H-1B (Sonnet 5.5, medium effort)

> **Prompt:**
>
> Read `docs/IMMIGRATION_EXPANSION_PLAN.md` (the "Legal immigration track" section),
> `ARCHITECTURE_MAP.md` (page-level rules and the Immigration section including F's
> and H's decisions), `CLAUDE.md`, `docs/H1B_METHODOLOGY.md`, and the components F
> and H added before writing anything. Work in your own git worktree.
>
> **Mock first** under `docs/mockups/` and get sign-off. Build only what the data
> from session I supports; if session I recommended curated-only, build only (1).
>
> **Cards:**
>
> 1. **Cap registrations vs. the 85,000 cap** per cycle: bars of eligible registrations
>    with the cap marked, selection outcomes in the tooltip, and numbered tap-to-pin
>    markers (rule 6) for the policy table (the $100,000 payment, the wage-weighted
>    selection). Few bars, so label every one.
> 2. **Approvals by year**, initial vs. continuing, with the term band and slider.
> 3. **Who sponsors and where from:** a ranked list of employers and countries for
>    one fiscal year (the `StackedRows` / `RemovalsCountryCard` list pattern with a
>    year picker). India's share is a number in the list, not a callout.
>
> **Rules:** Data notes: petitions, not people; continuing vs. initial; employers keyed
> by name and the last four tax-ID digits (names can merge or split); the hub's
> latest quarter is partial; the cap counts registrations differently from approvals.
> Policy markers come only from the verified table. No causal claims about a policy's
> effect. Phone width, light and dark. Copy never mixes with green cards or visas
> issued.
>
> Verify in the browser preview and update `ARCHITECTURE_MAP.md`.

---

## Session K — legal track refresh automation (Sonnet 5.5, medium effort; after E, G and I land)

Same goal and patterns as session D: as little manual upkeep as each source allows.
Read D's section and the existing workflows first; session D may already have landed,
so reuse whatever it added instead of inventing a second pattern.

| Piece | Target | Pattern |
| --- | --- | --- |
| OHSS quarterly report and Yearbook files (E) | Detect + issue, unless the file list proves stable | The refugee track found State's workbook renamed monthly; assume OHSS file names and the page's dates are unreliable. Compare the files list with the snapshot; open one issue when a new quarter or Yearbook appears |
| State monthly/annual visa PDFs (G) | Fetch + draft PR, human review | File names follow a month-year pattern, so discovery can be automatic; PDF parsing is the risk. Open a draft PR with the snapshot and extract, never auto-merge. Also detect the publishing gap, and state it in the issue |
| H-1B hub, LCA and cap announcements (I) | Detect + issue | The hub's own last-updated quarter; the new cap-season announcement each spring; the DOL file list |
| H-1B / immigration policy table | Flag only | Weekly Federal Register search for immigration proclamations and rules not yet in `h1b_policy.json` (extend the watcher D builds); open a review issue. Curation stays manual |

> **Prompt:**
>
> Read `docs/IMMIGRATION_EXPANSION_PLAN.md` (the Session D and Session K sections),
> `.github/workflows/ice-annual-review.yml`, `pipeline/validate/ice-staleness.ts`,
> `.github/workflows/executive-orders-freshness.yml`, `.github/actions/gate-and-merge`,
> the refugee track's refresh workflows (if session D has landed), and the three
> methodology docs (`LPR`, `NIV`, `H1B`) before writing anything. Work in your own
> git worktree.
>
> Build the refresh automation in the Session K table. Every workflow supports
> `workflow_dispatch`, is safe to rerun (no duplicate issues or PRs), never edits
> data directly except through a reviewed PR, and never blocks a deploy. Add the
> staleness checks as `pipeline/validate/*-staleness.ts` scripts (pure, tested)
> that the workflows call. Run each script locally in both directions (stale and not
> stale) and show the output. Document the refresh behaviour in each methodology
> doc and in `ARCHITECTURE_MAP.md`.

### Session K status (2026-10-14): the green-card piece

Built now that E has landed: `.github/workflows/ohss-review.yml` + `pipeline/validate/ohss-staleness.ts` (pure logic and tests in `ohss-lib.ts`), detect + issue as the table specifies, with a push notification on a new issue. It compares the files OHSS's pages list with `lpr-catalog.json`, never the pages' dates. **Still to do, when their pipelines land:** the State visa PDFs (G, fetch + draft PR), the H-1B hub, LCA and cap announcements (I), and extending `policy-watch.ts` to `h1b_policy.json`.

---

## Suggested order for the legal track

1. **E** (OHSS pipeline), then **F** (green cards, naturalizations, origins).
2. **G** (visas issued + entries), then **H**. G needs only E's raw snapshot.
3. **I** (H-1B, access gate first); build **J** only if the gate passes.
4. **K** last.

E, G and I touch different sources and different files, so they can run side by side
in separate worktrees. F, H and J each edit the shared Immigration page client, so run
those one at a time, or merge between them.
