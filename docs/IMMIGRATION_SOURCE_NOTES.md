# Immigration enforcement — source notes (Phase 1 findings)

Written 2026-09-30 during the ICE-removals data session. Everything here was
checked against the live ICE / DHS documents (snapshots in `pipeline/raw/ice/`);
the survey's claims that could not be verified are marked.

## 1. Primary-series gate — inventory of ICE-only removals

**Verdict: the series runs continuously FY2003–FY2025 with no gaps, all from ICE
documents.** FY2026 (the year in progress on 2026-09-30) has no ICE-published
file and is absent. The series does **not** have one definition throughout — see
the definition changes below; they are annotated per row (`note_ids`).

| FY | Removals | Status | Primary source (ICE) | Also printed in |
| --- | ---: | --- | --- | --- |
| 2003 | 157,080 | final | FOIA #16-06761 table, `Removals-AOR-FY2003-2016.xlsx` | — |
| 2004 | 175,106 | final | same table | — |
| 2005 | 180,189 | final | same table | — |
| 2006 | 207,776 | final | same table | — |
| 2007 | 291,060 | final | same table | — |
| 2008 | 369,221 | final | same table | — |
| 2009 | 389,834 | final | same table | — |
| 2010 | 392,862 | final | same table | — |
| 2011 | 396,906 | final | same table | — |
| 2012 | 409,849 | final | same table | — |
| 2013 | 368,644 | final | same table | FY2013 report; FY2014 report |
| 2014 | 315,943 | final | same table | FY2014 report |
| 2015 | 235,413 | final | same table | FY2015 ERO report |
| 2016 | 240,255 | final | same table | FY2016 report page |
| 2017 | 226,119 | final | FY2017 ERO report page | FY2018 report |
| 2018 | 256,085 | final | FY2018 ERO report | FY2019 report |
| 2019 | 267,258 | final | FY2019 ERO report | FY2020 report |
| 2020 | 185,884 | final | FY2020 ERO report | FY2020 report table |
| 2021 | 59,011 | final | FY2024 annual report, Figure 23 (bar label) | — (see below) |
| 2022 | 72,177 | final | ICE 2022 Year in Review page | FY2024 report chart |
| 2023 | 142,580 | final | FY2023 annual-report release | FY2024 report chart |
| 2024 | 271,484 | final | FY2024 annual report | FY2027 budget overview |
| 2025 | 442,637 | **preliminary** | ICE FY2027 budget overview (DHS-hosted) | — |
| 2026 | — | **missing** | no ICE file | — |

- **Earliest year: FY2003.** ICE began operating March 1, 2003, so FY2003 is a
  part-year ICE count (the earlier months were INS/Customs). The FOIA table is the
  only ICE document that covers FY2003–FY2006; ICE publishes no annual report for
  those years. Its title says "For Official Use Only/Pre-decisional" but it is
  published on ice.gov (the FOIA reading room).
- **No gap affects an administration**, so the decision gate did not trigger. The
  only missing year is FY2026 (in progress; Trump's second term already has
  FY2025 as its first attributed year).

### Definition and reporting changes (every one is a note in `enforcement_notes.json`)

1. **Returns excluded before FY2007, included from FY2007.** ICE's FOIA table:
   "Starting in FY2007 Removals data include returns." (Returns = voluntary
   returns, voluntary departures, withdrawals under docket control.) FY2003–06 are
   removals only. **This is a real break in the middle of the series.** ICE's
   current glossary still says "ICE removal data includes returns."
   *Contradicts the survey's framing:* "ICE removals" is not "removals under an
   order" in the strict sense — it never was, from FY2007 on.
2. **October 5 lock and "lag."** Since FY2009 ICE locks totals ~Oct 5; later
   closures count toward the next year. ICE also prints alternate "excluding lag"
   totals (FY2009 387,790 … FY2013 363,144 … FY2016 235,524). We use the headline
   figure only. Two ICE documents therefore print different numbers for some years
   (e.g. FY2013: 368,644 vs 363,144); they are two measures, not a restatement.
3. **FY2010** excludes 76,732 expedited removals ICE closed on behalf of CBP.
4. **June 1, 2013:** voluntary returns / expedited removals not detained by ICE
   are no longer ICE removals (CBP publishes them).
5. **Title 42 (Mar 2020 – May 11, 2023):** expulsions are excluded from the count
   (62,545 in FY2023), depressing FY2020–23.
6. **May 12, 2023:** expedited removals turned over from Border Patrol and flown
   by ICE Air are included.

**Not verified: "ICE began reporting apprehension location in FY2013."** ICE's
FY2012 interim table already splits "Border Removals" as a priority category and
its FY2007 criminal/non-criminal split goes back further. No note was added for
it. The FY2013 interior (133,551) + border (235,093) = 368,644 split is confirmed
and validated at transform time.

### Disagreements and restatements found

- **FY2016 / FY2017 text.** The FY2018 report's prose reads "from 226,119 to
  256,085 in FY2018" for a FY2016–FY2018 figure; 226,119 is FY2017 (confirmed by
  the FY2017 report and the FY2018 table row "Total 226,119 256,085"). FY2016 is
  240,255 in the FY2016 and FY2017 reports and the FOIA table.
- **FY2012:** ICE's mid-year (Aug 2012) tracker showed 366,292 year-to-date; the
  final is 409,849 (FOIA table). Interim documents are not
  used.
- **FY2025:** press figures conflict (442,637 / ~329,000 / ~320,000 / ~340,000
  MPI). Only 442,637 is from ICE (its FY2027 budget overview; measure "returned or
  removed"; FY2024 shown as 271,484, identical to the annual report). The lower
  figures were not traced to ICE files and are not used. No FY2025 annual report
  or locked file exists yet (`iceAnnualReportFY2025.pdf` → 404).
- **FY2021:** ICE's FY2021 annual-report PDF URL (`/doclib/eoy/iceAnnualReportFY2021.pdf`,
  linked from ice.gov) returns 404 (also FY2022, FY2023 PDFs); the number is read
  from the bar label in FY2024's Figure 23 (59,011) and cross-checked by the other
  five bars matching text elsewhere. Flagged `fy2021-read-from-chart`.

## 2. ICE statistics mechanics

- `ice.gov/statistics` hosts four **interactive dashboards** (arrests, detention,
  removals & expulsions, ATD), "updated quarterly" from Dec 31, 2024. They are
  **not downloadable files** (the page offers only a congressionally mandated
  detention spreadsheet, not removals), so no fiscal-year-to-date snapshots are
  fetchable and the survey's "total resets Oct 1 / ~6-week fall gap / early-2026
  stoppage / 356,389 YTD" could **not be verified** — nothing here depends on it.
- Per-year documents live at inconsistent paths (`/removal-statistics/2016`,
  `/doclib/about/offices/ero/pdf/…`, `/sites/default/files/documents/…`,
  `/doclib/eoy/…`); some linked PDFs are dead. URLs are **not stable** → no
  scheduled refresh (see methodology, "Refreshing").
- Historical totals are static once locked ("FY2019–FY2023 data are locked and
  remain static", FY2024 report); FY2024's figure is identical in the annual
  report and the FY2027 budget overview, i.e. it was not revised after year-end.
  How FY2025 will change at lock is unknown → `preliminary`.

## 3. FY2025 and FY2021 administration split

Neither ICE's documents nor the Deportation Data Project give a date-resolved
split we can use. ICE's dashboards chart removals by month, but only as a chart
(FY2024 report Figure 27 is an image; the dashboard is interactive). The
Deportation Data Project (Sep 29, 2025 update) says its late-June release was
wrong (170,000+ FY2024 removals missing, CBP cases wrongly included), recommends
the late-July file, and publishes only weekly charts — no month or Jan-20 totals.
**FY2025 and FY2021 are therefore `blended: true` with no estimated split.**
Only the *calendar-day* share per administration is stored (111 days / 254 days).
(ICE's FY2017 report does split interior removals at Jan 20, 2017 for a part-year
comparison, but not total removals; not used.)

## 4. Presidential terms — reuse

- **Where:** `ADMINISTRATIONS` in `pipeline/transform/administrations.ts`
  (hand-maintained; serialized to `pipeline/output/administrations.json`).
  `termIdForDate` in `lib/indicator-derive.ts` is the existing date→term helper
  (used by the economy page); this track calls it.
- **Shape:** `{term_id (= inauguration date), president, president_slug, party,
  start, end (last day in office, null while serving)}`.
- **Sufficiency check:** covers 1993-01-20 → present, so every fiscal year from
  FY2003 is inside it (the economy page prepends Bush 41 for 1989–93; not needed
  here). Exact start/end dates; Trump's two terms are separate rows
  (`2017-01-20`, `2025-01-20`); party and slug present. Boundaries for Jan 20 of
  2001, 2009, 2017, 2021, 2025 match the inaugurations. A Jan 20 day belongs to the
  incoming president (the table's documented rule).
- **No extension and no discrepancy** — nothing was changed in the table.

## 5. Country of citizenship — Phase A findings (2026-10-01)

- **Where:** only inside ICE's annual ERO reports, as appendix tables (PDF text or
  the ice.gov web page). The ERO statistics dashboards (removals by country exist
  there) have no export, so nothing can be snapshotted from them.
- **Coverage:** FY2014 (FY2014 report App. A), FY2015 (App. C), FY2016–17 (FY2017
  web page App. B), FY2017–18 (FY2018 report App. B), FY2018–19 (FY2019 App. B),
  FY2018–20 (FY2020 App. B), FY2019–24 (FY2024 report appendix). FY2013 is top-10
  only; FY2025 and FY2003–12 have none. **Covered range: FY2014–FY2024**, shorter
  than the national series, so the card's year range is this range; nothing is
  borrowed from OHSS yearbooks (which include CBP).
- **Country × criminality for removals:** not published in any snapshot. The
  statistics page describes arrests and detention by country and criminal history
  (dashboards only). Decision: plain bars.
- **Names:** upper-case in FY2019/20; "Peoples Republic" with/without apostrophe;
  Macedonia → North Macedonia and Swaziland → Eswatini from FY2019; Turkey → Türkiye
  in FY2024; "Congo" and "Dem Rep of the Congo" are separate rows; "Korea" is its own
  row; Unknown, Stateless, Czechoslovakia, Yugoslavia, Serbia and Montenegro,
  Netherlands Antilles, USSR appear as rows; a "Montenegro - Raps" row is zero in
  every year (dropped with other zero rows). Long names wrap onto two lines in the
  FY2020 PDF.
- **Reconciliation:** every country table's rows sum exactly to its printed Total, and
  every covered year sums exactly to the national ICE series (difference 0 in all
  eleven years). Overlapping vintages agree country by country: ICE restated nothing.
- **Definition caveat for the UI:** the country tables carry the same totals as the
  national series, which **include returns from FY2007**. They are not "removals
  under an order of removal" only; copy must not say returns are excluded.

## 6. Breakdowns and other ERO measures — session A findings (2026-10-13)

Data pass for `docs/IMMIGRATION_EXPANSION_PLAN.md` session A, taken **only** from the
ICE/DHS documents already in `pipeline/raw/ice/` (nothing new fetched). 209 values
in the catalog's `values`: 56 quoted from prose or tables, 140 chart bar labels
(in the text extract, but year and category assigned from the rendered PDF page),
13 read from charts that are images with no text layer (page snapshots committed
next to the PDFs). 58 are also printed, identically, by a second ICE document.

### Coverage

| Series (`metric` / agency / criminality) | Fiscal years | Main sources |
| --- | --- | --- |
| Removals by arresting agency (ICE / CBP) | **FY2008–FY2024** | FY2008–12: FY2015 report Fig. 6 (interior/border labels). FY2013–16: each year's own report (text), FY2015 Fig. 6 and FY2017/FY2018 reports agree. FY2017–19: FY2019 report Fig. 14 + FY2018 prose. FY2020–24: FY2024 report Fig. 26 (FY2020 report Fig. 15, an image, agrees for FY2018–20). |
| Removals by criminality, two-way (convicted / not convicted) | FY2013–FY2015 | Each year's own report (text). |
| Removals by criminality, three-way (convicted / pending charges / other immigration violator) | FY2016–FY2024 | FY2016: FY2016 page + FY2018 report (Fig. 11 image for "other"). FY2017–18: FY2018 prose + FY2019 Fig. 16. FY2019–24: FY2019 Fig. 16, FY2024 Fig. 24. |
| Removals, convicted **or** pending (combined only) | FY2025 (preliminary) | FY2027 budget overview performance measure. |
| Interior removals (arresting agency ICE) by criminality, three-way | FY2017–FY2024 | FY2019 Fig. 17; FY2024 Fig. 25 (FY2020 Fig. 20, an image, agrees). |
| ERO administrative arrests, total | FY2016–FY2020, FY2023–FY2024 | FY2018 Fig. 1 (image) for FY2016; prose for the rest. **FY2021–FY2022: no ICE total on file** (see below). |
| ERO administrative arrests by criminality, three-way | FY2016–FY2024 | FY2018 Fig. 2 (image, FY2016); FY2017 page Table 1; FY2019 Fig. 9; FY2024 Fig. 6. |
| Administrative arrests, convicted or pending (combined only) | FY2025 (preliminary) | FY2027 budget overview. |
| At-large arrests, total and by criminality | FY2016–FY2024 | FY2017 page / FY2018 prose; FY2018 Fig. 4 (image, FY2016 split); FY2019 Fig. 10; FY2024 Fig. 8. |
| Detainers issued | FY2016–FY2024 | FY2017 page, FY2018/FY2020/FY2024 prose; FY2019 Fig. 12; FY2024 Fig. 11. |
| Initial book-ins, total and by arresting agency | FY2016–FY2020 | FY2018 prose + Fig. 7 (image, FY2016 split); FY2019 Fig. 1; FY2020 prose + Fig. 1 (image, FY2020 split). |
| Average daily detention population, total | FY2018–FY2025 | FY2020 Fig. 3 (image, FY2018); FY2019/FY2020 prose; FY2027 budget overview for FY2021, FY2022, FY2024, FY2025 (FY2023 also in the FY2023 release). |
| Average daily population by arresting agency | FY2018–FY2024 | FY2019 Fig. 2 (pies); FY2024 Fig. 17. |

Missing years are absent, never zero or interpolated. FY2025 has only removals,
the two combined criminality figures and the detention average (all preliminary);
there is no FY2025 agency split, arrest total, at-large, detainer or book-in figure.

### Checks that tie chart labels to their categories

Every complete breakdown sums to its printed total (69 of them; national removals
for removals). These printed subtotals also had to match the rows they cover,
which is what confirms, in text, that a label was filed under the right category:
FY2016 removals without a conviction 101,586 = pending + other (FY2016 page);
convicted + pending arrests FY2018 138,117, FY2019 123,128, FY2020 93,061, FY2023
73,822 (FY2023 release and FY2024 report), FY2024 81,312 (FY2024 report and budget);
convicted + pending removals FY2024 88,763 (FY2024 report and budget). Prose that
states a related change also agrees with the image-only FY2016 reads: 143,470 −
33,366 = 110,104 arrests; 105,736 − 10,985 = 94,751 convicted arrests.

### Chart-label reads that the text alone gets wrong

- **FY2015 report, Fig. 6 (FY2008–FY2015 interior/border).** For FY2008–FY2012 the
  text layer prints the larger label below the smaller one in a way that reads as
  border-below-interior. The rendered page shows the blue Interior segment at the
  bottom of every bar: interior removals were the **larger** part in FY2008–FY2011
  (e.g. FY2008 234,770 interior, 134,451 border). A text-order reading swaps them.
- **FY2024 report, Fig. 6 (arrests by criminality).** Clustered, not stacked, bars
  on a second axis behind a USBP-encounters area. FY2021's pending (8,813) and
  other (28,650) labels sit in the same text column; read from the page (FY2021
  convicted 36,619, pending 8,813, other 28,650). The chart prints no totals.
- **FY2024 report, Figs. 8, 24, 25.** The FY2021–FY2022 pending-charges segments
  are a few pixels tall; their labels were read from a zoomed render.
- **FY2019 report, Fig. 2 (detention pies).** Labels interleave across the two pies
  in the text ("22,969 (60%)"); FY2018 is ICE 22,969 (54%), CBP 19,219 (46%),
  confirmed by the FY2020 report's Fig. 3.
- **FY2018 and FY2020 reports** have no text layer on any chart. FY2018 is the only
  saved source for several FY2016 values (arrest total and split, at-large split,
  book-in split, other-immigration-violator removals); FY2020 is the only source
  for the FY2018 detention total (42,188) and the FY2020 book-in split. Those 13
  values are `figure` reads with page snapshots. The other FY2018/FY2020 chart
  values match the FY2019 and FY2024 text exactly.

### Disagreements

- **Across report vintages: none.** Every year printed by more than one of the
  FY2018, FY2019, FY2020 and FY2024 reports (FY2016–FY2020 for most series) is the
  same in each. ICE calls FY2019–FY2023 "locked and remain static".
- **FY2014 border removals:** the FY2014 report's prose says 213,179; its bullet,
  its Border Patrol + Field Operations table (205,058 + 8,661) and the FY2015
  report say 213,719, which also completes the national total. 213,719 is used
  (recorded in the catalog's `disagreements`).
- **FY2024 at-large arrests:** the FY2024 report's summary page says 33,243; its
  at-large section and Fig. 8 say 33,242, and Fig. 8's parts sum to 33,242. 33,242
  is used (`disagreements`).
- **FY2024 detention average:** ICE 12,232 + CBP 25,489 = 37,721 (FY2024 report,
  Fig. 17); the budget overview's total is 37,722. Separately rounded averages; the
  only `sum_exceptions` entry. FY2021–FY2023 parts equal the budget totals exactly.
- **FY2015 non-criminal border removals** (not stored): the prose says 90,103 in one
  place and 90,106 in the bullets; 96,045 − (69,478 − 63,539) = 90,106.
- **FY2025 criminality** comes from a measure whose criminal status is "determined
  at the time of booking into custody", not "at the time of the enforcement action"
  as in the annual reports. For FY2024 both give the same numbers (88,763 removals,
  81,312 arrests), so the measures line up for the one year both print.
- The FY2024 report's Fig. 11 caption says "FY 2019 – FY 2024" but the chart also
  shows FY2018 (177,147, matching the FY2018 report).

### Found but not ingested

- **Convicted removals FY2007–FY2008** (102,024; 114,415; FY2014 report): ICE says
  its crime entry screen did not exist before 2011 and capture was limited, and no
  complement is printed. FY2008–FY2012 criminality otherwise exists only as
  percentages (FY2015 report Fig. 1). Not used.
- **Interior removals by criminality before FY2017:** the FY2013–FY2016 reports
  print only the convicted interior count (110,115; 86,923; 63,539; 60,318), not the
  rest, so there is no complete split to store.
- **Arrests, at-large arrests and detainers before FY2016:** the FY2017 page charts
  FY2015, but its images are not in the snapshot; the FY2015 report has only a
  monthly line chart with no labels.
- **FY2021–FY2022 administrative arrest totals:** not printed in any saved document
  (ICE's FY2021/FY2022 annual-report PDFs 404). The three categories are stored; a
  UI may add a complete split, but no total row exists.
- **Initial book-ins FY2021–FY2024:** only a monthly chart without labels, and
  percentages (CBP 68.6% of book-ins in FY2023, 67.4% in FY2024).

## 7. Refugee ceiling vs. admissions — session C source check (2026-10-13)

A separate track from ICE (`refugee_*.json`, methodology in
`docs/REFUGEE_ADMISSIONS_METHODOLOGY.md`). Snapshots in `pipeline/raw/refugee/`; curated values
and quotes in `pipeline/reference/refugee-catalog.json`.

### Sources

| Source | What it gives | Publisher / URL pattern | Format | Stable? | Automate? |
| --- | --- | --- | --- | --- | --- |
| Presidential Determinations, FY1995–FY2027 (37 documents, incl. emergency revisions FY1999, FY2021 ×2, FY2026) | Worldwide ceiling, regional/category/group allocations, revision dates | Federal Register via govinfo: `govinfo.gov/content/pkg/FR-<pub date>/html/<doc no>.htm`; discovered through the Federal Register API (`type=PRESDOCU`, term "refugee admissions") | HTML text (FY2020's allocation table is an image; its text comes from the APP copy) | Yes: API and govinfo URLs are permanent | **Discovery: yes. Values: detect + PR for review, not auto-merge** (see below) |
| Determinations FY1987–FY1994 | Same, older format (private-sector numbers, Orderly Departure Program) | FY1993–94: GPO Public Papers / Weekly Compilation on govinfo. FY1987–92 and FY2020's table: The American Presidency Project (UCSB) copy of the Public Papers | HTML | Fixed history | Never changes; no refresh |
| CRS R47399 (Jan 20, 2023), Table A-1 | Final ceiling FY1981–FY2022 (cross-check, and the only source for FY1981–86, FY1989 final, FY1990) | EveryCRSReport copy (congress.gov returns 403 to scripts) | HTML | Fixed | No refresh |
| State Department Refugee Processing Center (WRAPS): "Refugee Admissions Report as of <date>.xlsx" | Admissions FY1975–present (cumulative sheet, by region); FY2001–present per-year sheets by country of chargeability and month, with year-end regional and worldwide ceilings | `wrapsnet.org/documents/...` → redirects to `rpc.state.gov/documents/...` | XLSX, machine-readable, consistent layout FY2001–FY2026 | **No:** the file name carries the date and changes every month (posted on the 5th) | **Check-and-issue only.** A new month means a new catalog source row; the parser gates fail loudly if the layout changes |
| DHS OHSS Yearbook, refugees FY2024 (Tables 13–14) | Arrivals FY1980–FY2024, by nationality FY2015–FY2024 | `ohss.dhs.gov/system/files/<yyyy-mm>/<date>_ohss_yearbook_refugees_fy<year>.xlsx` | XLSX | No: new path per edition (annual) | Check-and-issue; cross-check only |
| Policy instruments (EOs 13769, 13780, 13815, 14013, 14163, 14204; Proclamations 10949, 10998) | Dated rules for the marker lane | Federal Register via govinfo, as above | HTML | Yes | **Flag only**: curation stays manual |

**Why new determinations are not auto-merged.** The Federal Register API makes discovery
automatic: `pnpm fetch:refugee` writes `raw/refugee/fr-refugee-admissions-index.json` (every
presidential document mentioning "refugee admissions"), and the transform **fails** when that
index lists a document the catalog has neither curated nor recorded in `fr_index_reviewed`. But
the numbers are curated: allocation tables have been dotted leaders, bulleted categories, an image
(FY2020), ranges (FY2024–25) and prose-only group allocations (FY2026–27), and an emergency PD may
restate or add. A scheduled fetch that finds a new PD will therefore open a PR whose gate fails
until someone adds the catalog row (with verbatim quotes), which is the intended behaviour. A future
job could draft that row with the Claude API, never auto-merged.

**Re-running the fetch.** `pnpm fetch:refugee` is idempotent: it downloads only snapshots that are
missing (`--refresh` re-downloads all), rewrites the text extracts deterministically, and writes the
index sorted with stable fields only, so an unchanged source is no diff.

**WRAPS after the January 2025 suspension:** still publishing monthly. The workbook as of
Sept 30, 2026 has FY2026 (16,292 admissions, almost all Africa, i.e. South Africa) and the
17,500 year-end ceiling.

### Coverage

| Series | Covered | Notes |
| --- | --- | --- |
| Ceiling (final) | FY1981–FY2027 | FY1980 missing (Refugee Act transition year; no text or compilation found). FY1981–86, FY1990 from CRS only; FY1989 final from CRS (PD 89-2's 94,000 is the initial) |
| Ceiling (initial) and revisions | FY1987–FY2027 except FY1990 | Revised years: FY1988 (72,500 → 87,500), FY1989 (94,000 → 116,500, revising PD not located), FY1999 (78,000 → 91,000, Kosovo), FY2021 (15,000 → reallocated Apr 16 → 62,500 May 3), FY2026 (7,500 → 17,500, May 21, 2026) |
| Allocations | Same as initial ceiling | Region FY1987–FY2019 and FY2021 (Apr) – FY2025; category FY2020 and FY2021 (Oct); group FY2026–FY2027 |
| Admissions | FY1980–FY2026 (stored from FY1980; State Dept prints from FY1975) | FY2026 preliminary until 90 days after year end |
| Admissions by region | FY1980–FY2026 | |
| By country of chargeability, by month | FY2001–FY2026 | 135 countries |
| Year-end regional ceilings | FY2001–FY2026 | none printed for FY2020 (category year) or FY2026 |

### Agreements and disagreements found

- **Determinations vs. CRS final ceilings:** identical in every year both exist (FY1987–FY2022)
  except FY1989 (CRS 116,500 vs. PD 89-2's 94,000: a revision not located). Gated.
- **Determinations vs. the State Department's year-end worldwide ceiling, FY2001–FY2026:**
  identical every year (including FY2012's 76,000, FY2021's 62,500 and FY2026's 17,500). Gated.
- **Regional allocations vs. year-end regional ceilings:** usually differ (reallocations;
  FY2013 Africa 12,000 → 15,950). Both stored, not gated.
- **CRS admissions (as of Nov 30, 2022) vs. the current State Department vintage:** identical
  except FY2018, 22,615 → 22,676 (+61; the Doe v. Trump settlement counts some later arrivals
  toward FY2018's ceiling).
- **DHS OHSS vs. State Department totals:** within 1.5% every year except FY1992 (+14.7%),
  FY1993 (+4.6%): DHS excludes Amerasian immigrants, which the State Department's Asia column
  includes. DHS rounds to tens.
- **By nationality (OHSS Table 14, FY2015–FY2024):** 119 country-years differ by more than
  rounding, largest Venezuela/Colombia/Costa Rica/Ecuador/Nicaragua in FY2024 and Bhutan/Nepal in
  FY2015–FY2018. DHS uses nationality; the State Department's country column is country of
  chargeability, so the two tables answer slightly different questions. Report only.
- **EO 13769/13780's 50,000 cap on FY2017 entries** does not change the FY2017 ceiling of record
  (110,000; the State Department's FY2017 sheet prints 110,000).

### How the travel bans touch refugee admissions (verified against the texts)

Proclamations 10949 (June 4, 2025; effective June 9) and 10998 (Dec 16, 2025; effective Jan 1,
2026) suspend *entry* of nationals of the listed countries. Each exempts "a refugee who has already
been admitted to the United States" and says nothing in it limits seeking refugee status. The
determinations close the gap: PD 2025-13 (FY2026) makes admissions "subject to" Proclamation 10949,
and PD 2026-14 and PD 2026-24 (FY2027) to Proclamation 10998, alongside EO 14163's suspension. So
for refugees the bans apply through the determinations, on top of a program that has been
suspended since Jan 27, 2025 except case-by-case admissions.

Proclamation 10998's 39 countries: 19 full (the 12 continued, Laos and Sierra Leone moved up, plus
Burkina Faso, Mali, Niger, South Sudan, Syria) and 20 partial (Burundi, Cuba, Togo, Venezuela
continued; 15 added; Turkmenistan narrowed to immigrants), plus Palestinian Authority travel
documents (full, stored as `PSE`).

### Not ingested

- **USCIS adjudication hold (PM-602-0192, Dec 2, 2025), its Jan 1, 2026 widening, the Mar 30,
  2026 partial asylum restart, and the June 5, 2026 D.R.I. ruling:** no uscis.gov or court copy was
  located (only an AILA-hosted reproduction and press summaries). They govern benefit applications
  (asylum, green cards) from people already in the U.S., not refugee admissions, so they sit
  outside this track. A future benefits/asylum track should snapshot the primary texts.
- **Court challenges to EO 14163** (e.g. *Pacito v. Trump*, W.D. Wash.): not tracked; the policy
  table's status means "as the instruments in the catalog stand", with `status_as_of`.
- **The 1980s Federal Register itself:** only whole-issue scans (26–76 MB per day), too large to
  snapshot; FY1981–FY1986 and FY1990 rest on CRS.
- **Proclamation 9645 (Sept 2017 travel ban) and the Oct 2017 eleven-country refugee review:** not
  reviewed in this pass.
