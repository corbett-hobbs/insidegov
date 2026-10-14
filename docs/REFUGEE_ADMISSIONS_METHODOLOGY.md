# Refugee admissions — methodology

Data for a future refugee card on `/presidency/immigration` (no UI yet). Source check and
coverage: `docs/IMMIGRATION_SOURCE_NOTES.md` §7. Schemas: `lib/refugee-entities.ts`. Pipeline:
`pnpm fetch:refugee` → `pipeline/transform/refugee-run.ts` (pure logic in `refugee.ts`).

## What the two numbers are

- **Ceiling:** the most refugees the President authorizes for a fiscal year in the annual
  Presidential Determination (PD) under INA §207 ("the admission of up to N refugees"), after
  consultation with Congress. It is a maximum, not a quota or target. An emergency PD (§207(b))
  can raise it or reallocate it during the year.
- **Admissions:** refugees resettled from abroad through the U.S. Refugee Admissions Program, as
  counted by the State Department's Refugee Processing Center (WRAPS), by fiscal year of arrival.

Only refugees. Asylum seekers (who ask for protection from inside the U.S. or at the border),
Temporary Protected Status holders and parolees are different statuses and are never counted or
mixed in. DHS's yearbook refugee arrivals are a cross-check only.

## Outputs (`pipeline/output/`)

| File | One row per | Notes |
| --- | --- | --- |
| `refugee_series.json` | fiscal year, FY1980–FY2027 | `ceiling` (in force at year end), `ceiling_initial`, `ceiling_revised`, `ceiling_source_kind` (`determination` / `compilation`), `admissions`, `share_of_ceiling`, statuses, presidential attribution |
| `refugee_determinations.json` | determination (dated) | sequence within the year, ceiling and previous ceiling, allocations with printed labels and region group, `allocation_text` for group allocations |
| `refugee_regions.json` | (fiscal year, region group) | admissions vs. the first PD's allocation, the allocation in force after the last PD, and the State Department's year-end regional ceiling (FY2001 on) |
| `refugee_by_country.json` | (fiscal year, country_key), FY2001 on | country of **chargeability** (see caveats), keyed like trade and ICE |
| `refugee_monthly.json` | (fiscal year, month), FY2001 on | national admissions by month |
| `refugee_policy.json` | instrument | the dated suspension / restriction table for a marker lane |
| `refugee_notes.json` | note | definitions, caveats and coverage, each with its fiscal-year range |
| `refugee_report.json` | — | coverage, revised years, source kinds, every cross-check, source hashes |

## Ceilings

- **Source order.** The PD text (Federal Register via govinfo for FY1995 on; GPO Public Papers /
  Weekly Compilation for FY1993–94; the American Presidency Project's copy of the Public Papers
  for FY1987–92) wherever it was located. Otherwise CRS Report R47399, Table A-1, which compiles
  the *final* ceiling from the PDs (FY1981–FY1986, FY1990, and FY1989's final). FY1980 has no
  ceiling: the Refugee Act took effect mid-year and no text or compilation was found. Missing is
  missing.
- **Revisions are dated rows.** Every PD of a year is a row in `refugee_determinations.json`; the
  series carries the first (`ceiling_initial`) and the one in force at year end (`ceiling`).
  Revised years: FY1988, FY1989, FY1999, FY2021, FY2026.
- **Allocations.** Each printed line is stored with its label and mapped to a comparable
  `region_group`: `africa`, `east_asia`, `europe` (every European label: "Eastern Europe/Soviet
  Union", "Former Soviet Union/Eastern Europe", "Europe", "NIS/Baltics", "Kosovo Crisis",
  "Europe and Central Asia"...), `latin_america_caribbean`, `near_east_south_asia`,
  `unallocated`, `private_sector` (FY1987–FY1995 privately funded numbers), `category` (FY2020 and
  FY2021 until April: kinds of refugee, not regions) and `group` (FY2026–FY2027: "primarily
  Afrikaners", no numbers, kept as verbatim `allocation_text`). FY2024–FY2025 allocations are
  ranges (`min`/`max`). The PD's allocation is a starting point: reserves are assigned and numbers
  moved between regions during the year, so `year_end_ceiling` (State Department, FY2001 on) is
  what to compare admissions with when it exists.
- **Not stored:** the asylee-adjustment numbers older PDs also authorize (not part of the
  refugee ceiling), and in-country processing designations.

## Admissions

From the State Department workbook "Refugee Admissions Report as of <date>": the Cumulative
Summary sheet (FY1975 on, by region; stored from FY1980) and one sheet per year FY2001 on (by
country of chargeability and month, with year-end regional and worldwide ceilings). Kosovo and the
former Soviet Union columns belong to `europe`; PSI is `private_sector`. A year is `preliminary`
until 90 days after it ends (FY2026 now): later vintages have revised recent years slightly.

## Attribution to presidents

Same rule as the ICE series: a fiscal year belongs to the administration in office on Sept 30,
with `blended` and calendar days per administration. The series starts in 1979, before
`administrations.json` (1993 on), so the transform prepends `HISTORICAL_ADMINISTRATIONS`
(`lib/troops-presidents.ts`, already used by the troops and economy pages) — no new terms table.
Blended years: FY1981, FY1989, FY1993, FY2001, FY2009, FY2017, FY2021, FY2025. **FY2025's
ceiling (125,000) was set by the outgoing administration**; 37,596 of its 38,102 admissions
arrived October–January, and January itself is split by the Jan 20 inauguration, so the monthly
rows show the change without assigning admissions to a president. No per-president averages.

## Policy table

Rules, not counts: suspensions (EO 13769, EO 13780, EO 14163), resumption/expansion (EO 13815,
EO 14013), a country exclusion written into a PD (FY2021: Somalia, Syria, Yemen), priority (EO
14204, Afrikaners), and entry restrictions that the PDs make refugee admissions subject to
(Proclamations 10949 and 10998). Each row has signed/effective/ended dates, what ended it, a
plain-English summary, its effect on refugees, keyed countries with full/partial/excluded level,
and `status` as of `status_as_of`. Court status is not tracked. Curation is manual.

## Caveats a UI must carry

- A ceiling is a maximum; it is not a quota, and admissions below it are not a "shortfall".
- FY2020–FY2021 were depressed by the COVID-19 pandemic as well as policy.
- From Jan 27, 2025 refugee entry is suspended except case-by-case; FY2026–FY2027 admissions are
  overwhelmingly Afrikaners from South Africa.
- Country of chargeability (and region by nationality) is not always the country fled.
- Ceilings FY1981–FY1986 and FY1990 come from a CRS compilation, and FY1980 has none.

## Validation (fails `pnpm transform`)

Zod on the catalog and every output row. Every curated number's quote must appear verbatim in the
snapshot's text extract and contain the number. A PD's allocations must sum to its ceiling (ranges
must bracket it); an emergency PD that adds numbers must move the ceiling by exactly that much; the
first PD of a year must be the annual one. CRS's final ceiling must equal the last PD wherever both
exist (FY1989 is the one documented exception, `UNLOCATED_REVISIONS`). The State Department's
year-end worldwide ceiling must equal the last PD, FY2001–FY2026. In the workbook: region columns
sum to each year's total, countries to their region, regions to the grand total, months to the
year, and each year sheet to the cumulative summary. Every country name must resolve to a key
(`REFUGEE_ALIASES`). Every policy event's countries must appear in its quotes. And every Federal
Register document mentioning "refugee admissions" must be a catalog source or listed in
`fr_index_reviewed`, so a new PD cannot go unnoticed. DHS and CRS admissions differences are
reported, not gated. Tests: `pipeline/transform/refugee.test.ts` (parsers on fixtures, the build
over the real files, and each gate).

## Refreshing

Manual today; Session D automates detection.

1. `pnpm fetch:refugee` (idempotent; needs `unzip`). It snapshots any missing catalog source and
   refreshes `raw/refugee/fr-refugee-admissions-index.json` from the Federal Register API.
2. **New determination:** `pnpm transform` fails, naming it. Add its Federal Register document as
   a source (`role: determination`), a `determinations` row with verbatim quotes for the ceiling
   and each allocation, and fetch again. Unrelated documents go in `fr_index_reviewed` with a
   reason. New EOs or proclamations that restrict refugee entry go in `policy_events`.
3. **New month or year of admissions:** the State Department renames the workbook monthly. Add the
   new file as the `admissions` source (replacing the old one), fetch, transform, and review the
   diff. The parser fails loudly on a layout change.
4. **New DHS yearbook:** replace the `cross_check` source; differences show in the report.
