# Immigration enforcement — methodology

Feeds `/presidency/immigration` (`lib/immigration-data.ts`). Source findings and the year-by-year inventory:
`docs/IMMIGRATION_SOURCE_NOTES.md`. Schemas: `lib/enforcement-entities.ts`.

## What the series is

**ICE removals, by fiscal year (Oct 1 – Sep 30), FY2003–FY2025**, from ICE's own
documents only. Key `(period, metric, scope, arresting_agency, criminality)`; the
national series is `metric = removals` with both breakdowns null, and `scope = ice`
is required on every row (no default, so a CBP or DHS-wide series can never be
spliced in silently). `period` is the year the fiscal year ends in. No member
or `bioguide_id` key; it joins to presidents by date (§ Attribution). The same file
also carries breakdowns of removals and five other ERO measures (§ Breakdowns and
other ERO measures).

A **removal** is DHS's formal term for what is commonly called deportation: the
confirmed departure of a non-citizen from the U.S. enforced by the government.

## What ICE-only includes and excludes

- **Includes** removals ICE carries out of people ICE arrested in the interior
  **and** of people CBP/Border Patrol apprehended at the border and handed to ICE
  (FY2013: 133,551 interior + 235,093 border = 368,644).
- **Excludes** removals executed by CBP itself (expedited removals and voluntary
  returns of people ICE never took into custody — published by CBP), Title 42
  expulsions, and everything DHS-wide.
- **Includes "returns"** from FY2007 on (voluntary returns/departures, withdrawals
  under docket control) — ICE's own definition. FY2003–FY2006 do not.

**Never compare these figures with DHS-wide counts** (e.g. the 438,421 FY2013
figure often quoted), OHSS yearbook tables, CBP data, or DHS press-release
totals ("millions have left"). Different agencies, different inclusions; the press
totals have no published methodology and are never ingested.

## Known reporting changes (annotated per row via `note_ids`)

`enforcement_notes.json` carries each with the fiscal-year range it applies to:
returns excluded before FY2007; returns included from FY2007; the October 5 lock
and "lag" (headline figures only — never the alternate "excluding lag" totals);
FY2010's 76,732 excluded CBP expedited removals; the June 1, 2013 CBP handoff;
Title 42 expulsions excluded (FY2020–23); ICE Air expedited removals included from
May 12, 2023; FY2003 as a part-year (ICE began March 1, 2003); FY2021 read from a
chart; FY2025 from a budget document. A UI should draw the first of these (the
FY2006→FY2007 definition break) as a visible series break, not a trend.

## Attribution to administrations

Computed, never hand-assigned. Tenures come from the single existing table
(`ADMINISTRATIONS` → `administrations.json`; no second terms file) through
`termIdForDate`. A fiscal year is attributed to the administration **in office on
its last day, Sept 30** (`administration_term_id`). Per row:

- `blended` — true if the administration changed within the year;
- `administration_days` — calendar days under each administration (a Jan 20 day
  belongs to the incoming president).

Blended years: **FY2009, FY2017, FY2021, FY2025** (111 days outgoing / 254
incoming each). **The removal count is NOT split** — no ICE source resolves
removals by date (see source notes §3), and nothing is estimated. FY2025 is
therefore attributed to Trump's second term by the Sept 30 rule while ~30% of its
days (and an unknown share of its removals) fall under Biden; a chart must mark
it as blended.

## Status and preliminary years

`final` = ICE has published the figure as a locked year-end total. `preliminary` =
anything ICE has not locked: the in-progress year always, and **FY2025** (taken
from ICE's FY2027 budget overview; no annual report yet). The build fails if a
year that ends on or after the retrieval date is marked `final`. FY2026 is absent
(no ICE file) — missing is missing, never interpolated or filled from another
agency.

## Validation (fails the build, `pnpm transform`)

Zod on the catalog and outputs; every figure's quoted evidence must appear
verbatim in the snapshot's text extract and contain the number; xlsx table values
are checked by column; corroborating documents are checked the same way; ICE's
published FY2013 (368,644) and FY2023 (142,580) are hard anchors; no negatives, no
duplicate key, strictly increasing periods; unknown note ids fail; the breakdown
gates below. Results: `enforcement_report.json` (rows, gaps, status counts, blended
years, which years are corroborated by a second ICE document, which are
single-source, the FY2021 chart read; under `breakdowns`, per-series coverage,
every breakdown against its total, subtotal checks, disagreements and exceptions;
source and figure-snapshot hashes).

## Breakdowns and other ERO measures

Rows of `enforcement_series.json` other than national removals, from the catalog's
`values` (session A of `docs/IMMIGRATION_EXPANSION_PLAN.md`; findings, coverage and
disagreements in `docs/IMMIGRATION_SOURCE_NOTES.md` §6). Same agency rule: every
row is an ICE count from an ICE/DHS document already snapshotted; nothing from CBP
or DHS-wide series.

**Metrics.** `removals`; `administrative_arrests` (ERO arrests for a civil
immigration violation); `at_large_arrests` (the subset made in the community, not
in a jail); `detainers_issued`; `initial_book_ins` (first book-in of a new
detention stay); `detention_adp` (average daily population in ICE detention, an
average, not a count of people). ICE's definitions are quoted verbatim in
`enforcement_notes.json`.

**Two breakdown dimensions** (null = all):

- `arresting_agency`: `ice` or `cbp`, the agency that first apprehended the person.
  A `cbp` row is ICE's count of people CBP handed to ICE, never a CBP figure. It is
  not strictly interior vs. border (CBP includes ports of entry). Through FY2016 ICE
  called the same split interior and border removals (its definitions: identified
  or apprehended by an ICE officer vs. apprehended by CBP while attempting to
  enter); FY2016 is printed under both labels with identical numbers, so FY2008–
  FY2015 interior/border are stored as ICE/CBP with a note.
- `criminality`, as recorded in ICE systems at the time of the enforcement action
  ("other immigration violator" = no record there, not a finding about the
  person; convictions include immigration crimes such as illegal entry and
  reentry). **Two schemes, never mixed in a year:** `convicted` + `not_convicted`
  through FY2015 (ICE printed no pending-charges category; no zero is filled in),
  and `convicted` + `pending_charges` + `other_immigration_violator` from FY2016
  (FY2016 restated three ways in the FY2018 report; it agrees with the FY2016
  report's two-way split). **FY2025** has only `convicted_or_pending`, a combined
  figure from ICE's FY2027 budget overview with no split and no complement: a
  *partial* breakdown, preliminary, with its own note.

Interior removals by criminality are the `removals` rows with `arresting_agency =
ice` and a criminality (FY2017–FY2024).

**Coverage** (details in the source notes): agency split of removals FY2008–FY2024;
removals by criminality FY2013–FY2024 (+ FY2025 combined); interior by criminality
FY2017–FY2024; arrests by criminality FY2016–FY2024 (+ FY2025 combined), arrest
totals FY2016–FY2020 and FY2023–FY2024 (no printed total for FY2021–FY2022);
at-large and detainers FY2016–FY2024; book-ins FY2016–FY2020; detention average
FY2018–FY2025 (by agency to FY2024). A year's status always equals the national
series' status for that year, so FY2025 is preliminary everywhere.

**Evidence.** Each value has a kind: `text` (a verbatim quote containing it),
`chart_label` (a bar label that is in the text extract but whose year and category
were assigned from the rendered PDF page; `chart` records page, figure and the bar
and segment read), or `figure` (an image-only chart; the caption must be in the
extract and a snapshot of the rendered page is committed in `pipeline/raw/ice/`).
The quote check cannot catch a real number filed under the wrong year or category,
so chart labels are also tied down by the sums below.

**Gates (fail `pnpm transform`).** (1) Every quote is in its source and contains
the value; figure snapshots exist. (2) An agency split has both agencies and sums
to the total; a complete criminality scheme sums to its total (the national value
for removals; the agency's own row for interior removals). Where ICE prints no
total (FY2021–FY2022 arrests) the split is reported as unchecked. A mismatch is
allowed only if `sum_exceptions` documents it with the exact numbers and a reason;
the one entry is FY2024 detention, 37,721 vs. 37,722, two separately rounded
averages. A stale exception fails. (3) Printed subtotals (`sum_checks`, e.g.
"81,312 … convicted criminals or had pending criminal charges") equal their rows.
(4) Schemes never mix; a partial figure stands alone with a caveat note. (5) Each
corroborating vintage prints the same number; a number an ICE document prints that
is not used is listed in `disagreements` with its resolution (never averaged).
(6) Statuses match the national year. `assertBreakdownInvariants` re-checks (2),
(4) and (6) at site build.

## By country of citizenship (`removals_by_country.json`)

**Country of citizenship, not destination.** A person removed to a third country is
counted under their own citizenship. Same agency and definition as the national
series above (ICE only; headline totals; returns included from FY2007), so a
fiscal year's countries always sum to that year's value in `enforcement_series.json`
and the two are never combined with any other agency's counts.

**Coverage: FY2014–FY2024, eleven years.** ICE prints a full country table in its
FY2014, FY2015, FY2016/17, FY2017/18, FY2018/19, FY2018–20 and FY2019–24 reports.
FY2013 prints the top ten only and FY2025 has no table at all (no annual report;
the statistics dashboards have no export), so both are absent, not filled from OHSS
or anything else (`uncovered_fiscal_years` in the report). FY2003–FY2012 have no ICE
country-level document.

**Rows.** One per `(fiscal_year, country_key)`: `country_key` is the trade
pipeline's `country_code` (ISO 3166-1 alpha-3). Non-ISO entities ICE counts get
documented codes: `XKX` Kosovo, the former entities `CSK`/`SUN`/`YUG`/`SCG`/`ANT`,
`XUN` Unknown (citizenship not stated or documented), `XST` Stateless, `PSE`
Palestine, and `XKO` "Korea (unspecified)" — ICE prints a "Korea" row beside North
and South Korea and the table does not say which it is, so it is kept apart.
Spelling changes between vintages are an alias table (`ICE_ALIASES`): Burma/Myanmar,
Macedonia/North Macedonia, Swaziland/Eswatini, Turkey/Türkiye, "Congo" (Republic) vs
"Dem Rep of the Congo", "St." names, and upper-case vintages. A name that maps nowhere
fails the build. Countries ICE lists with zero removals in a year have no row.

**Sources.** Each year takes its rows from one document (`source_doc`); `as_of` is the
data run date ICE prints for that year (FY2021–23: the FY2024 report's Sep 30, 2024
currency date, since ICE calls FY2019–23 "locked"). Years that more than one ICE
document prints (FY2017–FY2020, the FY2019–24 table) agree country by country; a
disagreement fails the build.

**Gates (fail `pnpm transform`).** (1) Each table's rows sum to the Total printed in
that table. (2) Each year's rows sum to the national ICE series, zero tolerance — no
unexplained difference exists. (3) Overlapping documents agree. (4) Every ICE name
resolves to a key.

**Review flags.** `needs_review` marks rows whose name wrapped across two printed
lines (FY2020 and the FY2021–24 table: "China, Peoples Republic of", "Micronesia,
Federated States of", …) or where two ICE rows were merged. One known oddity: ICE's
FY2015 table prints "South Korea" twice (105 and 43); the second is probably the
"Korea" row (FY2014: 83, FY2016: 46), but ICE does not say, so both are summed into
South Korea (148) and flagged.

**Not available.** No ICE document crosses country with criminality for removals
(its statistics page offers arrests and detention by country and criminal history
only through interactive dashboards), so there is no criminality breakdown here.

## Refreshing

**Manual, with automatic detection.** ICE's year-end figures are locked once
published, and its URLs are unstable (dead links, new locations each year,
dashboards with no export), so a scheduled scraper would be brittle, so none
fetches. A monthly workflow (`.github/workflows/ice-annual-review.yml`, script
`pipeline/validate/ice-staleness.ts`) checks **each series separately** (`ICE_SERIES`
in `pipeline/validate/refresh-lib.ts`): national removals, removals by arresting
agency, removals by criminal history, administrative arrests, at-large arrests,
detainers and average daily detention population must each have a `final` row for
the fiscal year that should be locked by now (60 days after it ends). A year
carried only as `preliminary` (FY2025's budget-document actuals) counts as not
locked. Initial book-ins are skipped: ICE stopped printing them after FY2020. The
same run asks DHS whether the next ICE budget overview is published (it fetches
`dhs.gov/publication/congressional-budget-justification-fiscal-year-fy-<N+1>`
for the newest `dhs-fy<N>-…` source and looks for the ICE PDF link; the FY2028
overview should carry FY2026 actuals for the criminal-history, arrest and
detention measures). It opens, refreshes or closes **one** issue
(`.github/actions/open-review-issue`), never edits data and never blocks a
deploy; a DHS page it cannot reach is listed as "could not check", not a finding.
Run it locally with `pnpm exec tsx pipeline/validate/ice-staleness.ts --report out.md`
(`--today YYYY-MM-DD` and `--offline` for testing).

**Not automated, on purpose.** Extracting numbers from a new ICE report is not
drafted by the Claude API in CI. The existing executive-orders pattern classifies
text it fetched itself; here there is no stable URL to fetch, the values are
chart-label reads from rendered pages that a person has to check against the
image, and a wrong figure would sit in a locked series. A drafted PR could never
be merged without redoing the read, so the issue's checklist is the hand-off. To add a year
or replace a preliminary one: (1) add the ICE document to `sources` in
`pipeline/reference/ice-removals-catalog.json`, plus a `years` row with a
verbatim quote; (2) `pnpm fetch:ice` (needs `pdftotext` and `unzip`) to snapshot
it and write the text extract; (3) `pnpm transform`; (4) review the diff. For a
breakdown, add `values` entries the same way; a chart label needs `chart` (read it
off the rendered page: `pdftoppm -r 150 -png -f N -l N file.pdf out`), an
image-only chart also a committed page snapshot (`figure_file`), and a printed
subtotal goes in `sum_checks`. When a new annual report restates earlier years,
add it as `corroboration`; if it disagrees, investigate and record it in
`disagreements` rather than averaging. A new country table is added to `COUNTRY_TABLES` in `pipeline/transform/removals-country.ts`. Append
the next inauguration to `ADMINISTRATIONS` first when a new term starts.

## On the page (`/presidency/immigration`)

One full-width bar chart, FY2003–FY2025, colored by the administration in office
for most of each fiscal year. The President dropdown filters to that
administration's years; the y-axis stays fixed. The five definition changes above
are numbered markers on the timeline (dates curated in `ICE_MARKERS`, since the
notes only carry fiscal-year granularity): ICE created Mar 1, 2003; returns
counted from FY2007; returns shift to Border Patrol Jun 1, 2013; Title 42
(Mar 2020 to May 11, 2023, approximate to the month, shaded); ICE Air expedited
removals counted from May 12, 2023. FY2003–FY2006 are hatched (returns not
counted), FY2025 is dashed (preliminary: a DHS budget document, not a locked ICE
release), and FY2026 is an empty slot until ICE locks its counts (around Oct 5).
The page shows ICE only: no CBP actions, no Title 42 expulsions, no per-president
averages, and the FY2013 interior/border split is not displayed.

Build-time checks (`assertEnforcementInvariants`, run by the transform and the
site build, tested in `lib/immigration-derive.test.ts`): contiguous years from
FY2003, at most one preliminary year and only the latest, each year's
administration days sum to 365/366, the majority-days administration equals
`administration_term_id`, `blended_periods` matches the rows, and both report
anchors (FY2013, FY2023) hold.
