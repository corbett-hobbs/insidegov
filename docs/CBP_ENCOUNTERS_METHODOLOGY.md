# CBP border encounters — methodology

The data track behind the encounters card planned in `docs/CBP_ENCOUNTERS_PLAN.md` (sessions L–N). Source check and
findings: `docs/IMMIGRATION_SOURCE_NOTES.md` §9. Schemas: `lib/encounters-entities.ts`. Pipeline: `pnpm fetch:cbp` →
`pipeline/transform/encounters-run.ts` (pure logic in `encounters.ts`) → `lib/encounters-data.ts` (server-only reader)
→ `lib/encounters-derive.ts` (payload and invariants) → `lib/encounters-types.ts` (client-safe shapes).

**CBP only.** Nothing in this track is summed with, subtracted from or divided by an ICE figure (or any other
agency's). The card sits above the ICE removals chart so the two can be compared year by year, not combined.

## What an encounter is

U.S. Customs and Border Protection counts three things as encounters:

- **Border Patrol apprehensions** (USBP, Title 8): people caught between ports of entry. CBP: *"the physical control or
  temporary detainment of a person by USBP between POEs who is not lawfully in the U.S. which may or may not result in
  an arrest."*
- **Office of Field Operations inadmissibles** (OFO, Title 8): people who came to a port of entry and were found
  inadmissible, including people seeking humanitarian protection and people who withdraw their application and go
  home. It also includes administrative encounters that never lead to removal proceedings, such as ship crews held on
  board and people paroled in at a port.
- **Title 42 expulsions** (both components, March 21, 2020 to May 11, 2023): people turned back under the
  public-health order with no immigration processing.

**Encounters count events, not people.** Someone caught twice is counted twice. CBP has published no fiscal-year count
of unique people: its 2021–2024 monthly updates gave "unique encounters" for single months against a rolling 12-month
window, which cannot be added up to a year. So there is no "unique people" series (the owner's toggle was dropped).
Never call encounters "crossings", "illegal entries" or "migrants who entered", and don't mention got-aways (a
separate CBP estimate, out of scope).

**Scope.** *Nationwide* is every CBP encounter: the northern and southwest land borders, airports and seaports, and
Border Patrol sectors with no land border (CBP: "Nationwide numbers are calculated by adding together Northern Land
Border, Southwest Land Border, and Other regions"). *Southwest* is the Southwest Land Border region: Border Patrol's
southwest sectors and the field offices at southwest land ports. Default to nationwide, which matches ICE's
nationwide removals.

## Coverage and sources

One source per year and component, the same source for both scopes:

| Years | Border Patrol | OFO (ports of entry) | Title 42 |
| --- | --- | --- | --- |
| FY1980–FY2003 | CBP history tables (nationwide FY1925–FY2020, southwest sectors FY1960–FY2020) | **not published** (no rows) | — |
| FY2004–FY2014 | CBP history tables | DHS OHSS, Key Homeland Security Metrics (rounded to tens) | — |
| FY2015–FY2019 | CBP history tables | CBP statistics pages (curated, with quotes) | — |
| FY2020 on | CBP encounters CSVs | CBP encounters CSVs | CSVs, FY2020–FY2023 |

- **Why OFO starts in FY2004.** CBP was created in March 2003; no CBP or DHS source publishes port-of-entry figures
  before FY2004. FY1980–FY2003 are Border Patrol only, and the card draws them differently. They are unpublished, not
  zero.
- **Why OHSS for FY2004–FY2014 (owner, 2026-10-15).** CBP's own OFO figures start in FY2015. OHSS republishes the same
  CBP records back to FY2004, rounded to tens, and agrees with CBP within 1% where both exist (FY2014–FY2024). Starting
  OFO there keeps the encounters card's full detail close to the removals chart's (FY2003 on), so the two cards are not
  misaligned across most of the section. Each OHSS value has `publisher: "DHS OHSS"` and `rounding: 10`.
- **Not used:** OHSS Yearbook Table 33 ("DHS initial enforcement actions") adds HSI administrative arrests from 1952,
  so it is not a Border Patrol series. It and Yearbook Table 36 are cross-checks only.

The newest fiscal year comes from CBP's monthly file while it is in progress: `status: "preliminary"`, with `months`
(the months included). CBP: "Final statistics are available at the conclusion of each fiscal year." No completed year
has changed between CBP's files so far.

## Data model

| File | Grain | Key | Notes |
| --- | --- | --- | --- |
| `pipeline/raw/cbp/*` | one snapshot per source + `<name>.txt` extract; the encounters CSVs; `encounters-vintages.json` | catalog `id` / file | `pnpm fetch:cbp`. Workbook extracts keep Excel row numbers. |
| `pipeline/reference/cbp-encounters-catalog.json` | sources; `printed` (page figures with verbatim quotes, `use: series` or `check`); `exceptions`; notes with quotes and markers | `id` | Curated by hand; the tables and CSVs are machine-read, never typed in. |
| `pipeline/output/encounters_series.json` | one row per `(period, scope, component, authority)` | `period` (fiscal year) + `scope` (`nationwide`/`southwest`) + `component` (`usbp`/`ofo`) + `authority` (`title8`/`title42`) | `value`, `status`, `months`, `detail` (`usbp_only`/`components`/`full`), provenance (`source`, `source_url`, `publisher`, `method`, `location`, `rounding`), `note_ids`, attribution. **No total rows:** a year's total is the sum of its rows for one scope. Missing is absent. |
| `pipeline/output/encounters_monthly.json` | one row per `(fy, month, scope, component, authority)`, FY2020 on | as named | From the same CSV file as the year. |
| `pipeline/output/encounters_notes.json` | one row per note | `id` | `kind`, fiscal-year range, `components`, quotes, and `marker` (date, precision, axis label) for a numbered definition change. |
| `pipeline/output/encounters_report.json` | run summary | — | Coverage, the source of each span of years, CSV overlaps, Title 42 by month, every page and OHSS comparison, exceptions, source hashes. |

**Presidents.** By date, through the `term_id` of the administration in office on Sept 30 (`blended` and
`administration_days` for years that changed hands), with the historical presidents table prepended for years before
1993. No second terms table; no per-president averages.

## Definition changes (numbered markers)

From `encounters_notes.json` (`marker` set), numbered by date:

1. **Port figures begin** (FY2004).
2. **Ship crews counted** (April 2008): before it, OFO figures did not include all crew members held on board.
3. **Title 42 begins** (March 21, 2020; OFO from March 27).
4. **CBP One appointments** (January 2023): from then the OFO count includes people with CBP One port appointments and
   people paroled in at ports (the CHNV parole processes). This is most of the FY2023–FY2024 OFO rise.
5. **Title 42 ends** (May 11, 2023).

Notes without a marker, for the Data notes and year cards:
- The FY1980s–FY2000 peaks counted a different mix of people (mostly Mexican adults given voluntary return, often
  caught several times a year).
- FY2000–FY2001 Border Patrol figures differ between CBP and OHSS (FY2000 by 5.1%), unexplained.
- CBP restated its FY2017 southwest OFO figure (111,275 → 111,601).
- Monthly figures come from live systems; the year in progress is preliminary.

## Validation (fails `pnpm transform`)

- Every curated page figure's verbatim quote is in its source's text extract and contains the figure; every note's
  quotes are in its source.
- **Parts add up to the printed total:** the southwest sectors to the southwest total (FY1960–FY2020); each CBP page's
  OFO plus Border Patrol to its printed total; OHSS's regions to its count, within rounding.
- **Overlapping sources agree:** CBP with CBP exactly (pages against the history tables and the CSVs; the history
  tables against the CSVs in FY2020); CBP with OHSS within `overlap_tolerance` (1%); one CSV file with another for a
  completed year within 1%; the OHSS Yearbook's OFO table with KHSM exactly. Every disagreement beyond that is a catalog
  `exceptions` entry, and an exception no longer needed fails the build. Current exceptions:
  - the FY2025 page misprints FY2024 Border Patrol as 1,577,319 (1,557,319 by its own total, the CSV and OHSS);
  - that page's FY2018 total (683,178) is 2,845 short of its own parts, which OHSS confirms;
  - the FY2017 southwest OFO restatement;
  - FY2000 Border Patrol, CBP vs. OHSS (nationwide and southwest).
- **Schemes never mix within a year:** one level of detail per year, rising monotonically (`usbp_only` → `components`
  → `full`); the same rows nationwide and southwest; one source per year and component; no OFO rows before FY2004.
- **Title 42** rows fall only between March 2020 and May 2023 (checked by month) and only in FY2020–FY2023.
- Each encounters CSV row's encounter type matches the data dictionary (USBP Title 8 = Apprehensions, OFO Title 8 =
  Inadmissibles, Title 42 = Expulsions), regions and components are known, and a completed year has 12 months.
- The southwest never exceeds the nationwide figure; only the newest year is preliminary; years are contiguous.

`lib/encounters-derive.ts` runs the series invariants again when the page builds.

## Refreshing

`pnpm fetch:cbp` is safe to re-run. It snapshots CBP's Nationwide Encounters document page, reads its links, and
downloads the newest area-of-responsibility CSV. CBP posts one around mid-month, named for its four fiscal years and
last month, so the address changes every month. `encounters-vintages.json` keeps one file per range of years:
- a newer month of the same range replaces the older file;
- a new range is added beside the old ones, which are never removed;
- each year is taken from the newest file that has it, so a year that drops out of the newest range still comes from
  an older file;
- the transform fails if any year between FY2020 and the newest is in no file.

The fixed sources (history PDFs, archived CBP pages, OHSS workbooks) download only when missing (`--refresh`
re-downloads). The weekly refresh workflow is session N.
