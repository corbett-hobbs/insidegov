# Green cards and naturalizations — methodology

The first part of the legal-immigration track (plan: `docs/IMMIGRATION_EXPANSION_PLAN.md`, sessions
E–K). The Immigration page's green-card section (`components/immigration/Lpr*`) reads it. Source check and findings:
`docs/IMMIGRATION_SOURCE_NOTES.md` §8. Schemas: `lib/lpr-entities.ts`. Pipeline: `pnpm fetch:ohss` →
`pipeline/transform/lpr-run.ts` (pure logic in `lpr.ts`, names in `lpr-country-names.ts`) →
`lib/lpr-data.ts` (server-only reader) → `lib/lpr-derive.ts` (payload and invariants) →
`lib/lpr-types.ts` (client-safe shapes).

## What the two numbers are

All from the DHS Office of Homeland Security Statistics (OHSS), which compiles USCIS and State
Department records.

- **Green cards (persons obtaining lawful permanent resident status, "LPRs"):** people who became
  permanent residents in the fiscal year, counted when DHS grants the status. Either **new arrivals**
  or **adjustments of status**; OHSS: *"type of admission distinguishes new arrivals (who receive
  admission to the United States at the same time as admission to LPR status) and adjustments of
  status (who are already within the United States)."* Not the number of immigrant visas the State
  Department issues, and not entries: *"This report reflects admissions at a port of entry rather
  than the number of visas that the Department of State issues."*
- **Class of admission:** *"Class of admission refers to category of admission to LPR status rather
  than admission to the United States."* Refugees and asylees appear here in the year they adjust to
  permanent residence (usually a year or more after arriving), so this is not the refugee track's
  admissions count.
- **Naturalizations:** people who became U.S. citizens through Form N-400 in the fiscal year. OHSS:
  naturalizations *"are limited to applicants aged 18 and older and do not represent a complete
  count of persons who obtained citizenship status in each reporting year"* (children deriving
  citizenship from a parent are not counted), and *"Numbers reflect changes in received and
  processed naturalization applications, which may be affected by limited resources for application
  processing or pending applications from prior years."*

Green cards and naturalizations are different units (a person usually naturalizes five or more years
after a green card). Never add them, stack them or put them on one axis as parts of one total. Never
combine either with visas issued, I-94 entries, ICE removals or refugee admissions.

## Coverage

| Series | Years | Source (newest edition covering the year) | Notes |
| --- | --- | --- | --- |
| LPRs, total | FY1977–FY2025 | Yearbook FY2024 Table 1 (FY1977–FY1998), the class tables below (FY1999–FY2024), quarterly FY2025 | Table 1 runs back to 1820; the series starts at the first full Sept-30 fiscal year after the 15-month FY1976 |
| LPRs by major class (7) | FY1999–FY2025 | Yearbook Table 6: FY2008 edition (FY1999–FY2007), FY2017 (FY2008–FY2012), FY2022 (FY2013–FY2014), FY2024 (FY2015–FY2024); quarterly Table 1B (FY2025) | eras below |
| LPRs: new arrivals vs. adjustments, and each × class | FY1999–FY2025 | same tables | FY2013–FY2019 revised by the FY2020 edition (restatement below) |
| LPRs by country | FY1999–FY2024 by **birth**; FY2025 by **nationality** | Yearbook Table 3 (same editions as the classes); quarterly Table 1A | never compare the two bases country by country |
| Naturalizations, total | FY1977–FY2025 | Yearbook FY2024 Table 21 (FY1977–FY2024); quarterly Table 3 (FY2025) | Table 21 runs back to 1907 |
| Naturalizations by country | FY1999–FY2024 by birth; FY2025 by nationality | Yearbook naturalization by-country tables (FY2008, FY2017, FY2022, FY2024 editions); quarterly Table 3 | |

**Status.** FY1977–FY2024 are `final` (the FY2024 Yearbook, posted June 2026, is the newest).
FY2025 is `preliminary`: only the quarterly report covers it (posted 06/04/2026) and quarterly figures
are revised in the Yearbook (FY2024's report said 1,356,760 new LPRs; the Yearbook says 1,364,090).

**Rounding.** OHSS now rounds published cells to the nearest ten. Rounded here: green-card totals
FY1977–FY1998 and everything FY2015–FY2024 (FY2024 Yearbook), every naturalization total
FY1977–FY2024 (FY2024 Yearbook), and FY2025 (quarterly reports are rounded from FY2023). Green-card
detail FY1999–FY2014 comes from editions that printed exact counts. Each row carries `rounding` (10 or null), so
parts may differ from a rounded total by up to five per cell.

## Data model

Outputs (`pipeline/output/`, one JSON row per line):

| File | One row per | Notes |
| --- | --- | --- |
| `lpr_series.json` | (period, metric, admission_type, class) | `metric` `lpr` / `naturalizations`; `admission_type` `new_arrival` / `adjustment` / null (all); `class` one of the seven / null (all). National totals have both null. `value`, `status`, provenance (`source`, `table`, `edition`, `member`, `sheet`, `cells`, `method`, `rounding`), `note_ids`, presidential attribution. |
| `lpr_by_country.json` | (fy, metric, basis, country_key) | `kind` `country` / `other` (XOT, "All other countries") / `unknown` (XUN) / `withheld` (XWH); rows add up to the year's printed total; zero rows are not stored. |
| `lpr_by_region.json` | (fy, metric, basis, region) | OHSS's own continents (Africa, Asia, Europe, North America, Oceania, South America, Unknown) read from the REGION section printed above the countries in the same table the by-country rows come from (same basis and status); never assigned here. North America includes Mexico, Central America and the Caribbean. Rows add up to the printed total (within rounding); zero regions are not stored. |
| `lpr_notes.json` | note | definitions, eras, caveats, restatements, coverage, each with a fiscal-year range and, where it rests on a document, a verbatim quote checked against the snapshot. |
| `lpr_report.json` | — | which table each year came from, residual and withheld values, every vintage comparison, refugee cross-check, source hashes. |

**Provenance.** Every value is machine-read from a workbook snapshot and names the table and the
cell(s), in A1 notation, it came from (`cells`). `method` is `printed` (one cell), `sum` (printed
classes grouped into `other`, or two country rows merged into one key) or `residual` (a printed total
minus printed parts, used only where OHSS withheld a part as "D").

**Classes.** The six major classes as printed — immediate relatives of U.S. citizens, family-
sponsored preferences, employment-based preferences, diversity, refugees, asylees — and `other`, the
sum of every other printed class. Printed rows are matched by label (`MAJOR_CLASSES`,
`OTHER_CLASS_ROWS` in `lpr.ts`); a label the code does not know fails the build. Sub-classes (spouses,
children, parents; first–fifth preferences) are checked against their class but not stored.

**Country keys.** The trade crosswalk's `country_code` (ISO alpha-3 and former entities), via
`LPR_ALIASES` (which extends the refugee and ICE aliases). Former states stay as printed: Soviet Union
(SUN), Czechoslovakia (CSK), Yugoslavia (YUG), Serbia and Montenegro (SCG), Netherlands Antilles (ANT).
Places the trade crosswalk lacks get ISO codes as special entities: United States (USA), American
Samoa (ASM), U.S. Virgin Islands (VIR), Isle of Man (IMN), Saint Martin (MAF). The FY2008 edition's
"Korea" (both Koreas) is filed under KOR, as the FY2017 edition files the same numbers.

**Presidents.** A fiscal year belongs to the administration in office on Sept 30 (`blended` and
calendar days per administration, as in the ICE and refugee tracks). Years before 1993 use the
historical presidents table (`lib/troops-presidents.ts`); no new terms table. No per-president
averages: class schemes and counting rules change across eras.

## Eras and definition changes

| Years | Change | How it is handled |
| --- | --- | --- |
| FY1999–FY2007 vs. FY2008 on | The FY2008 edition prints NACARA and HRIFA as their own classes and has no rows for Iraqi/Afghan special immigrants or trafficking and crime victims; later editions add those rows (both victim rows "not available" for FY2008) and fold NACARA and HRIFA into "Other". | All are in `other`, so the six major classes stay comparable (note `lpr-other-classes-by-edition`). |
| FY2008 | The FY2017 edition moves 1,770 people from employment fourth preference ("special immigrants") into classes grouped as other. | Restatement `fy2008-special-immigrants`; the newer edition is used. |
| FY2013–FY2019 | From the FY2020 edition on, more adjustments and fewer new arrivals (totals unchanged). | Restatement `fy2020-edition-arrival-adjustment-split`; FY2013 on use post-revision editions; FY2008–FY2012 come from the FY2017 edition, and FY2011–FY2012 are identical before and after the revision. |
| FY1999–FY2008 | Korea printed as one row (both Koreas). | Filed under South Korea (note `korea-before-2009`). |
| FY1999–FY2007 | Guadeloupe, Martinique and French Guiana printed separately; later editions count them under France. | Kept as printed (note `french-overseas-departments`). |
| FY2015 on; FY2023 on (quarterly) | Cells rounded to the nearest ten. | `rounding` per row; sum checks allow the rounding bound. |
| all editions | Label changes only: "legal" → "lawful permanent resident", "alien residents" → "lawful permanent residents" / "noncitizen residents", "aliens of exceptional ability" → "persons of exceptional ability", "Special immigrants" → "Certain special immigrants", "Petitions" → "Applications" for naturalization. | Matched to the same class. |

Before FY1999 the series has totals only (note `no-class-detail-before-1999`). The current class
scheme dates from the Immigration Act of 1990 (effective FY1992); the FY1992–FY1998 class tables exist
only in older `.xls` editions whose layouts were not checked here (see the source notes).

## Validation (fails `pnpm transform`)

- Zod on the catalog and every output row.
- Every table is found by its verbatim title; header years must match the title's range.
- Every cell is a count, "-" (zero), "D" (withheld), "X" or "NA" (no value); a table marked rounded
  must hold only multiples of ten.
- In every class table: sub-classes add up to their class, classes to the total, new arrivals plus
  adjustments to the total for every class; quarterly Q1–Q4 add up to each year (exact, or within
  half a unit per rounded cell).
- In every by-country table: regions add up to the total, the REGION and COUNTRY totals agree, and
  countries plus buckets (and any withheld remainder) add up to the printed total.
- Every country name resolves to a key.
- Every region name is one of OHSS's seven; a year's regions add up to its printed total, and every year with countries has regions on the same basis and status (`assertRegionInvariants`).
- Every national value printed by two Yearbook editions (or by two tables of one edition) agrees
  within rounding, or a catalog `restatements` entry covers it; a restatement that covers nothing
  fails too.
- Quarterly totals within 3% of the Yearbook (a larger gap means a misread table, not a revision).
- Every note's quote is in its source's snapshot.
- `assertLprInvariants` (`lib/lpr-derive.ts`, also run by the transform): years contiguous, only the
  newest preliminary, classes and types add up, countries add up to the national total with one basis
  per year (birth except a preliminary year), and every cited note exists.

A table with a documented printing error is used for its national total only (`defect` in the
catalog): the FY2017 quarterly Table 1B, whose rows below Asylees carry the wrong labels.

Tests: `pipeline/transform/lpr.test.ts` (readers on fixtures, the `.xls` and `.xlsx` readers on the
real snapshots, the build over the real files, each gate) and `lib/lpr-derive.test.ts` (payload and
invariants over the real outputs).

## Refreshing

Detection is automatic; the edit is manual. OHSS posts every edition at a new address and its page
dates are unreliable, so nothing fetches data. Weekly `.github/workflows/ohss-review.yml`
(`pipeline/validate/ohss-staleness.ts`, pure logic and tests in `ohss-lib.ts`) reads the **files each page
lists**, not its dates: the quarterly-report page against the catalog's `ohss-quarterly-fy<year>` sources
(a file for a year the catalog lacks is a new year; one for a year it has is a repost, a restatement
candidate), the next Yearbook edition's page (`/topics/immigration/yearbook/<newest + 1>`, a 404 until
published), and the newest catalogued edition's page for a reposted LPR or naturalization workbook. A new
file opens, refreshes or closes **one** issue (`ohss-review`) and sends a push notification when it is first
opened. A page it cannot read, or one that stops listing the catalog's own files (a layout change), fails the
run instead of passing. Locally: `pnpm exec tsx pipeline/validate/ohss-staleness.ts --report out.md`
(`--drop <source id>` pretends the catalog lacks a source, to see the new-file path). Each refresh is then a
catalog edit:

1. **New quarterly report** (a new fiscal year): add an `ohss-quarterly-fy<year>` source (sheets
   Table 1A, 1B, 2, 3) and its four tables, `pnpm fetch:ohss`, `pnpm transform`. The new year
   appears as preliminary.
2. **New Yearbook** (usually about 18 months after the year ends): add the LPR and naturalization
   workbooks as sources and their tables (`*-total`, `*-class`, `*-birth`). The newest edition
   becomes each year's source automatically; the build then fails on every value it restated
   against older editions until a `restatements` entry records what changed. Update the
   `fy2025-preliminary` note's range when the year turns final.
3. A layout or label change fails loudly (title, header years, unknown class, unknown country).
4. `pnpm fetch:ohss` is idempotent: existing snapshots are kept unless `--refresh`; extracts are
   rewritten deterministically.
