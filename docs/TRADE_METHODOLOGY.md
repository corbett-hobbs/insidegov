# Trade methodology (U.S. Census Bureau)

How `pipeline/fetch/census-trade.ts` → `pipeline/transform/trade.ts` (+ `trade-run.ts`)
turn Census files into the trade track. Schemas: `lib/trade-entities.ts`. Source
findings and the investigation that shaped this: `docs/TRADE_INVESTIGATION.md`.
Same family as the other non-Congress tracks (`DATA_CONVENTIONS.md` §8–§9): there is
no `bioguide_id`; the join key is `country_code`, and time joins are by date.

## What these numbers are

Trade **flows** during a period. A balance or a collected rate describes what the
statistics recorded then; nothing here attributes cause to a president or Congress.
All trade values are $ millions unless a field says whole dollars (duties).

## Series

| Output | What it is | Basis | Window |
| --- | --- | --- | --- |
| `trade_national.json` `basis=bop`, `frequency=annual` | U.S. exports, imports, balance of goods and services (`scope` goods_services / goods / services) | Balance of payments | 1991–2025 (source starts 1960) |
| `trade_national.json` `basis=census`, `scope=goods` | World goods total, monthly, seasonally adjusted (`sa`) and not (`nsa`), plus annual `nsa` | Census | 1991-01 – latest |
| `trade_by_country/<year>.json` | Goods exports and imports per partner: 12 monthly values, annual totals, annual balance | Census | 1991 – latest (source starts 1985) |
| `duties_by_country/<year>.json`, `duties_national.json` | Calculated duties, imports for consumption, derived rate. Each row carries `source`: `census_api` (2010-01 onward, refreshed weekly) or `usitc_dataweb` (**1993-01 – 2009-12**, a frozen one-time pull) | Census (entries) | **1993-01** – latest |
| `trade_products/<country_code>.json`, `trade_products_national.json` | Goods by product: every HS chapter per partner and year, the top 10 headings, special headings apart (see "Goods by product") | Census (goods file basis; duties basis for imports for consumption and duty) | **2010** – latest, year to date for the current year |
| `countries.json` | One row per Census partner code; the `country_code` join key | — | — |

**BOP basis vs Census basis differ by design** (BOP adjusts Census goods for coverage and
timing). 1991 goods: BOP −$76,937M vs Census −$66,723M. They are never reconciled or
mixed; each row says which it is. 2025 goods: BOP −$1,240,941M vs Census −$1,234,619M.

**Monthly goods and services is not built here.** Census's Seasonally Adjusted (Nominal) Data
page appears to list a monthly goods, services and total series (BOP basis) from 1992 (not
verified against the file; see `TRADE_INVESTIGATION.md`). It is out of scope for the first trade
page by decision: the monthly series here is goods only, Census basis. Annual goods and
services (BOP) covers the full window.

## Collected rate: what it is and is not

`rate = CAL_DUT / CON_VAL` from the Census international trade API (`imports/hs`):
**calculated duties** over **imports for consumption, customs value**, per country and month.

- *Calculated* duties are Census's computation from entry data (rate × dutiable value), not
  Treasury's customs receipts. 2025 sums to about $259B here; do not describe it as
  "tariff revenue collected" or compare it to the Monthly Treasury Statement without that caveat.
- **Denominator choice.** Imports for consumption (what is entered for domestic use, the
  population duties are assessed on) in customs value — *not* the general imports in
  `trade_by_country`, which also include goods entering bonded warehouses and trade zones.
  This is why a country's duties-file import value differs from its goods-file imports.
- It is an **average rate on all imports**, so it moves with the mix (zero-duty goods, shifted
  sourcing) as well as with tariff policy. It is not a statutory rate.
- The Census API has nothing before January 2010 (every endpoint returns 204 for 2009-12 and
  earlier). **1993-01 to 2009-12 comes from USITC DataWeb** (next section).
- Months with no import row for a country are 0 (rate `null`); months not yet published are `null`.

## Duties bridge, 1993–2009 (USITC DataWeb)

A **frozen, one-time pull**, not part of `fetch:all` or the freshness workflow, and not
automated. Run by `pnpm fetch:dataweb-duties` (needs `DATAWEB_TOKEN`, a six-month API key from a
DataWeb account) on 2026-10-01; raw files with their query parameters in
`pipeline/raw/dataweb-duties/<year>.json`. Query: Imports for Consumption, Calculated Duties and
Customs Value, all commodities aggregated, monthly, by country and all countries together. The
raw rows use the Census API's tuple shape and Census country codes (DataWeb's country `value`),
so the same transform builds both.

- **Same measure, same basis.** DataWeb serves the Census Bureau's entry data. Over a 36-month overlap
  (2010-01 to 2012-12) every one of 8,280 country-months (230 countries) and all 36 all-countries
  months equal the Census API values to the dollar, for both calculated duties and customs value.
  Tolerance proposed and used: exact for the overlap; the validation tolerance for the bridge
  years is the existing 0.1% country-sum check (measured worst: 0 in every month).
  Gaza Strip and West Bank are in the Census API but not DataWeb's country list; they carry no
  duties before 2010.
- **National cross-check.** DataWeb's 1989 national figures (duties $16,096,409,507; customs value
  $468,012,021,240) equal USITC's published table (1891–2025: $16,096,410K and $468,012,021K). Only
  that year was compared, from the search summary of the table; the PDF could not be fetched. The
  average rate is continuous across the source change (2009 1.37%, 2010 1.36%).
- **Why 1993, not 1991.** USITC states that dutiable value and calculated duties before 1993 are
  **overstated** (not adjusted for the nondutiable part of imports under HTS 9802.00.60 and
  9802.00.80). 1991–92 are therefore not on the same basis as later years and are not included. The
  data exists in DataWeb (1989 on); adding them would need a decision to show them flagged.
- **Granularity.** Monthly by country is available for the whole bridge; nothing is annual-only.
- **A real break to expect, not an artifact:** the average rate falls from 3.2% (1993) to about 1.4% by 2007,
  with a step down in 1995 (3.18% to 2.51%), the years of NAFTA and the Uruguay Round tariff cuts. The UI must not
  describe a 1993 vs 2010 difference as a source effect, or as policy alone (mix matters; see above).
- **Source flag.** `source: "usitc_dataweb"` on every 1993–2009 row (country and national), `"census_api"` from
  2010. A year has exactly one source (the build fails otherwise), so no chart point blends them. The UI can say
  earlier years come from USITC DataWeb.
- Recodes and dissolved states are handled by the existing crosswalk (same Census codes). A DataWeb name that
  is not in DataWeb's country list fails the fetch; none did for 1993–2009.
- Revisions: Census restates history; this pull is a snapshot as of `fetched_at` and is not refreshed.

## "Did tariffs shift trade?" (the scatter)

Built in `lib/trade-scatter.ts`; constants `LATEST_MONTHS = 6`, `BASELINE_YEAR = 2024`.

- **Latest window:** the last six published months of calculated duties (Feb–Jul 2026 at the time of writing).
- **Baseline:** the **same calendar months** of 2024, so seasonality cancels. A window that spans New Year
  takes its baseline across 2023–24 the same way.
- **Across (x):** change in the average calculated duty rate, in percentage points. Rate = total calculated
  duties / total imports for consumption over the window (weighted by imports, not a mean of monthly rates).
- **Up (y):** change in imports for consumption (customs value) over the same windows, in percent. This is
  the rate's own denominator, not the goods-file imports, which also count bonded and trade-zone entries.
- **Plotted only if every month of both windows is published** for that country and the baseline imports are
  positive. Others stay in the table with "not plotted" and the months covered (6 of 236 at the time of writing).
- **Scale:** the vertical axis is a symmetric log (linear within ±50%) from −100% to +1,000%. Anything beyond is
  pinned to the edge as a triangle with its true value in the tooltip; two countries were at the time of writing
  (tiny partners whose imports rose by thousands of percent from a very small base).
- **Reading it:** these are changes in averages. They move with product mix, re-routing through other countries
  and shipment timing as well as tariffs, and say nothing about cause. Bilateral figures can be distorted when
  goods pass through a third country.
- Both windows are 2010 or later, so they use the Census API source only; the DataWeb bridge is not involved.

## Goods by product (HS chapters and headings)

What the U.S. trades with each partner, by product, in dollars, 2010 on. Drawn by the "What the U.S.
trades" card on the trade page (see "The products card" below). Fetch `pipeline/fetch/census-products.ts`; transform
`pipeline/transform/trade-products.ts` (run from `trade-run.ts`); schemas `lib/trade-products-entities.ts`;
chapter names and special-heading labels `lib/trade-hs-chapters.ts`.

**Source.** The Census international trade API, `timeseries/intltrade/exports/hs` and `imports/hs`
(`CENSUS_API_KEY`), annual values per partner per Harmonized System chapter (`COMM_LVL=HS2`) and heading
(`HS4`). Exports: `ALL_VAL` (total exports, domestic and foreign, the goods file's basis). Imports:
`GEN_VAL` (general imports, the goods file's basis), plus `CON_VAL` and `CAL_DUT` (imports for consumption
and calculated duty, the duties file's basis), so a chapter's collected rate is `duties / con_value`. The
API has nothing before 2010; a USITC DataWeb bridge back to 1991 (chapter level) is a possible later step.

**Dollars only.** Quantities exist only at the 10-digit level, in different units per product, and
shipping weight covers vessel and air only, so it misses most Canada and Mexico trade.

**Annual values in one call.** The `_YR` variables are year to date at the month queried, so
`time=from 2010-01 to <latest>` with `MONTH=12&MONTH=<latest month>` returns every calendar year (December)
and the year in progress (latest month) in one response. The year in progress is stored as year to date,
with `months` saying how many months it covers (8 for 2026 at the time of writing).

**Query shape (measured 2026-10-18).** All chapters for all partners in one call fails at the API (a server
error after about 2.5 min), and so does a wildcard such as `I_COMMODITY=85*` at HS4. An explicit list of
codes works, but only **sorted**: the same list unsorted returns 204 ("no data"), so a 204 for a batch is
treated as an error, never as an empty result. Codes are batched, 8 chapters or 24 headings per call, three
calls at a time, about 50 s per batch at that concurrency (12 s alone). A batch that fails is split in half
and retried. Two all-countries calls per flow first list every chapter and heading with trade in the window.
About 130 calls in all: the full 2010-2026 fetch took 50 min (2026-10-18), against about 3,100 calls and 4-5 h for one call per chapter per year. Every response is cached under `products/_cache/` (git-ignored), keyed by its query, so an
interrupted run resumes where it stopped. The fetch checks, before writing anything, that each partner's
headings sum to its chapter (worst gap measured: $0 for every partner, chapter and year, both flows) and that the batched all-countries rows equal the
all-countries call.

**What is committed.** `pipeline/raw/census-trade/products/<flow>/<year>.json`: every chapter row for every
partner, and, at the heading level, every heading for the all-countries row but only each partner's **top 25
goods headings** plus every special heading. Full HS4 detail (about 1,240 headings x 230 partners x 17 years
x 2 flows) would be over 100 MB; the output keeps fewer headings, and 25 leaves room to raise that without a
refetch. `descriptions.json` keeps Census's short descriptions. The API's aggregate codes (a different
numbering from `country.xlsx`) are dropped; partners map to `country_code` through `countries.json`, and recoded
partners (Sudan 7320/7321) are summed, as in the goods file.

**Partner rankings.** Each raw year file also carries `partners`: for the year's top 25 all-countries goods
headings (the "Top products" list), that heading's top 10 partners, as `[CTY_CODE, HS4, ...values]`. These come
from the same batched calls as the headings above, in which the API returns every partner for a heading, so the
ranking is exact. The per-partner top-25 lists cannot give it: a partner keeps only its 25 largest headings, so
for the lower-ranked national headings (rank 15-25, where a top country's value in that heading can be smaller
than Canada's or Mexico's 25th-largest heading) most years' top five could not be proven (553 of 850 lists on the
first attempt). `pnpm fetch:census-products --partners-only` fills the field into the existing files with about ten
calls (new headings that reached a top 25 since the last full fetch only); a full or `--recent` fetch keeps it
current. The transform fails if a year has no rankings, if a top heading has no rows, or if a partner's own file
(where it also lists the heading) differs by a dollar.

**Outputs.**

| File | Grain |
| --- | --- |
| `trade_products/<country_code>.json` | one row per (year, flow) for that partner: `value` (and `con_value`, `duties` for imports), every chapter with trade, the top 10 goods headings, and every special heading in `special` |
| `trade_products_national.json` | the same per (year, flow) for all countries together (the API's all-countries row), top 25 goods headings |
| `trade_products_headings.json` | every heading in either file: chapter, Census's description, special-heading labels by flow |
| `trade_products_partners.json` | one row per (year, flow): the top 5 partners behind each chapter (from the partners' chapter rows: exact) and each all-countries top heading (from the raw `partners` rows: exact), in the same tuples |

Sharded by partner because the page loads one country at a time. Lists are tuples (`[code, value]`, or
`[code, value, con_value, duties]` for imports), largest first, to keep the files small.

**How many headings (N).** Measured over the test years and scaled to 17 years:

| N | All partner files | Largest (China) | gzipped | Headings' share of a partner-year's goods value (median / 10th percentile) |
| --- | --- | --- | --- | --- |
| 5 | 11.1 MB | 102 KB | 44 KB | 57% / 32% |
| **10** | **12.0 MB** | **107 KB** | **47 KB** | **70% / 44%** |
| 15 | 12.8 MB | 113 KB | 49 KB | 76% / 51% |
| 20 | 13.6 MB | 118 KB | 51 KB | 81% / 56% |
| 25 | 14.3 MB | 123 KB | 54 KB | 84% / 61% |

(17 years, both flows, 236 partners; coverage over partner-years with at least $10M of goods. The median
partner file is 46 KB.)

N = 10. The chapters, not the headings, set the file size (N = 5 is already 11.1 MB), so each five more
headings cost only about 0.8 MB in all and 5 KB on the largest file, but they buy only 5-7 points of
coverage, and a card ranks about ten products. The raw files keep 25, so raising N is a one-line change
(`HEADINGS_PER_ROW`) without a refetch. Note for the UI: China's file (107 KB, 47 KB gzipped) is about seven
times the current per-country trade file, so it is better served on its own route than folded into
`/data/trade/countries/[country_code]`.

**Chapter names.** Census's chapter descriptions are truncated capitals ("ELECTRIC MACHINERY ETC; SOUND
EQUIP; TV EQUIP; PTS"); `HS_CHAPTERS` holds a hand-written short name for each of the 96 HS chapters in use
(01-97; 77 is reserved) and the two U.S. special chapters, e.g. "Electronics & electrical equipment",
"Machinery & computers", "Oil, gas, coal & fuels". The build fails on a chapter missing from the table.

**Chapters 98 and 99 and heading 9999.** These are U.S.-only special classification provisions, not kinds of
product. Measured 2025, all countries:

- Imports, chapter 98 ($117B): mostly 9801 returned American goods ($104B) and 9802 American parts returned in
  goods assembled abroad ($8.3B). Chapter 99 is one heading, **9999, Census's estimate of low-value import
  shipments** not filed one by one ($30.1B; China $8.7B).
- Exports, chapter 98 ($66B): mostly **9880, the estimate of low-value export shipments** and late Canadian
  filings ($55.0B), and 9801 repaired imports sent back ($8.9B). There is no export chapter 99.

Decision: both chapters stay in the data, because the published partner totals include them and the chapters
must sum to those totals. They are `kind: "special"` in `HS_CHAPTERS`, named "Special entries (returns,
repairs, low-value estimates)" (98) and "Low-value shipments (estimated)" (99). Their headings are **never
ranked** among a partner's top headings: they sit in each row's `special` list, with plain labels by flow in
`SPECIAL_HEADINGS` (the same code means different things for exports and imports; 9801 is "Repaired imports
sent back" or "Returned American goods"). A card can show them as a footnote ("plus $8.7B in estimated
low-value shipments") rather than as a product. The build fails on a special heading with no label for its flow.

**Validation (fails `pnpm transform`).** Zod on every row, and in `validateProducts` (tolerances `PRODUCTS_TOL`):

- Each partner-year's chapters sum to its `trade_by_country` total (exports and general imports; months 1 to
  `months` for the year in progress) within the larger of $1M and 0.1%. The goods file is in $M rounded per
  month, so a gap of a few hundred thousand dollars is rounding. Measured worst: every full year 2010-2025 agrees to
  within $0.05M for every partner; in the year in progress the worst is $0.25M (Palau imports, the goods file's
  rounding of $0.1M months). **One exception, with its own tolerance (1.5%):** exports to Canada in the year in
  progress. The goods file carries revisions to the year's earlier months that the HS-level API does not have
  yet (Jan-Jul 2026 differ by -$49M to +$608M a month; August, the latest month, is identical; the API's year to
  date equals the sum of its own months). U.S. exports to Canada are compiled from Canadian import records,
  with late receipts added. 2026 through August: chapters $234,176M vs goods file $235,972M (0.76%). Every
  full year matches, so the two agree once the year is revised. Reported in `trade_report.json`.
- Imports: the chapters' calculated duty and imports for consumption sum to `duties_by_country` within 0.05%
  plus $1 per chapter (the same API, so this is close to exact). Measured worst: $0, duties and imports for consumption, every partner-year.
- Partners sum to the all-countries row per chapter-year within 0.2% (or $1M). Measured worst: $0.
- All-countries chapters sum to the World goods total (Census basis, full years) within 0.1%. Measured worst:
  $0.05M (2015 exports).
- Headings never sum past their chapter; no duty without imports for consumption; no duplicate keys; every
  partner is a non-aggregate `countries.json` code; every year from 2010 has both flows; a partner with $1M or
  more of goods trade in a year has product rows; exports and imports cover the same months; the product data
  never covers a month the goods or duties file has not published.

**Refresh.** The weekly `trade-freshness.yml` runs `pnpm fetch:census-products --recent`: the year in progress
and the three before it, so June's annual revisions reach the product files as they reach the goods file.
The 2023-2026 window took 23 min (about 130 calls; a call costs about the same whatever its year range). Older years change only when someone re-runs the full fetch.

**The products card.** Served per partner (and `all`) by the static route `/data/trade/products/[code]`
(`lib/trade-products-data.ts`); the page fetches the file the Country filter needs, all years at once. What it
shows, and why:

- *Ranked by dollars:* ordinary chapters (01-97) with trade, beside the end-use list ("Goods by use") on one dollar
  scale. The files' top headings are no longer shown (the card dropped its "Top products" list); the reader drops them.
  Exports are total exports and imports general imports, the goods file's basis, so a chapter list sums (with the
  special entries) to the partner's total in the cards above.
- *Collected rate per chapter (imports):* calculated duty / imports for consumption (tuple index 3 / index 2). Never
  over general imports, which include goods entering bonded warehouses and trade zones that owe no duty yet.
- *Special entries are a footnote:* chapters 98-99 are summed into one note under the lists, naming the two
  largest special headings by their `SPECIAL_HEADINGS` label ("Neither list includes $109B of special entries,
  shipments recorded by how they were handled rather than what they are. Largest: returned American goods $73.6B,
  low-value shipments (estimated) $25.0B.", all countries, imports, 2026 through August).
- *Heading names:* none are needed any more. The hand-written names table (`lib/trade-hs-headings.ts`, 1,233 headings)
  went with the "Top products" list; it is in git history if a heading level ever returns.
- *Year in progress:* labelled "so far" with its months. Where a partner's year-to-date product total trails the
  goods file by 0.5% or more (on $1B or more), the card's Data notes say so; at the time of writing that is exports
  to Canada, 0.76% below (Census revision timing, above), computed at build so the note follows the data.
- *Before 2010* there is no product data: the card says so and offers 2010, which also moves the partners card
  (they share one year).
- *Top countries behind a line:* with all countries showing, a clicked chapter or product also opens a panel under
  its row with the five countries that sent or took the most of it, on the line's own dollars (bar = share of the
  line; imports add each country's collected rate in that product, exports its share). One small static file per
  year, `/data/trade/product-partners/[year]` (from `trade_products_partners.json`), fetched the first time a line opens, for the year on screen. With
  one country picked there is nothing to break down, so a click only highlights.

## Goods by use (end-use categories)

What the U.S. trades with each partner, in categories a reader recognizes (aircraft, computers, semiconductors, cell
phones, pharmaceuticals, crude oil), in dollars, 2010 on. A second view of the same shipments as "Goods by product",
by what the goods are *used for* instead of by tariff chapter, shown as the "By use" view of the "What the U.S.
trades" card (below, "The By use view"). Fetch
`pipeline/fetch/census-enduse.ts` (library `census-enduse-lib.ts`); transform `pipeline/transform/trade-enduse.ts`
(run from `trade-run.ts`); schemas `lib/trade-enduse-entities.ts`; plain names `lib/trade-enduse-labels.ts`.

**Why this classification.** Company-level trade data is not public (13 U.S.C. § 9), and HS6 subheadings are too
technical to read. Census's end-use classification is the one Census itself publishes in recognizable terms: about
140 categories per flow, from "Soybeans" and "Crude oil" through "Semiconductors" and "Cell phones & household
goods" to "Passenger cars" and "Pharmaceuticals".

**Source.** The Census international trade API, `timeseries/intltrade/exports/enduse` (`E_ENDUSE`) and
`imports/enduse` (`I_ENDUSE`), `COMM_LVL=EU5` (5-digit categories; `EU1` is the five broad groups). The value
variables are the same bases as the HS files: exports `ALL_VAL_YR` (total exports, domestic and foreign); imports
`GEN_VAL_YR` (general imports), `CON_VAL_YR` (imports for consumption) and `CAL_DUT_YR` (calculated duty), so a
category's collected rate is `duties / con_value`. Data starts in January 2010 (2009 returns 204). 138 export and
142 import categories have trade in 2010-2026; 135 and 139 are ranked kinds of goods, the other six are special
entries (below). Dollars only, as for HS.

**Query shape (measured 2026-10-20).** One call per **category** returns every partner and every year:
`COMM_LVL=EU5&<E|I>_ENDUSE=<code>&time=from 2010-01 to <latest>&MONTH=12&MONTH=<latest month>` (about 1.5 s;
280 calls for a full fetch, 75 s at concurrency 3). A call per partner also works, but needs the partner list in
hand; the per-category call discovers new partner codes by itself. The all-countries call (`CTY_CODE=-`, no
category) names every category with trade and carries its description; the category calls' own all-countries rows
are checked against it to the dollar. **The category column must be in `get`**: without it the API answers 204 for
any month, which looks exactly like "not published". The latest published month is probed with a one-category query
for that reason. Responses carry Census's country groupings (codes starting `00`, e.g. `0003` EU, `0014` Pacific
Rim) and a `1XXX` row; none is kept (the groupings are not countries, `1XXX` is not a country: for the one category checked its values equal the `0020` grouping's, and without it the partner rows reproduce the all-countries row exactly).
Only `-` (all countries) and the numeric partner codes are kept. Zero rows are dropped. Each response is cached
under `pipeline/raw/census-trade/enduse/_cache/` (git-ignored) so an interrupted run resumes.

**Raw files** (`pipeline/raw/census-trade/enduse/{exports,imports}/<year>.json` plus `descriptions.json`,
committed): `[CTY_CODE, code, ...values]` one per line, whole dollars as numbers. 17.7 MB for both flows, 2010-2026.
A rerun with an empty cache reproduces them byte for byte (`fetched_at` is carried over while nothing changed).

**Codes differ by flow.** The export and import code lists share only 62 codes with identical descriptions; the rest
differ, and some codes mean different things (`00000` is wheat on exports and green coffee on imports; `50020` is
military aircraft engines on exports and U.S. goods returned on imports). Codes and names are therefore only ever
used together with their flow: `ENDUSE_LABELS[flow][code]`, `trade_enduse_labels.json` keyed `flow`+`code`.

**Civilian aircraft on exports.** Exports publish civilian aircraft, engines, equipment and parts as one category,
`22090` ($153.5B in 2025, the largest export category; the split is withheld, most likely for confidentiality).
`22000` (complete civilian aircraft, $0.6B) is a separate small line on exports from 2022. Imports split the same
goods into `22000` aircraft ($15.5B), `22010` parts ($17.1B) and `22020` engines ($28.2B). A card that compares
the two flows must not read the export line as "aircraft" and the import line as "aircraft" alone.

**Special entries.** Some lines are how a shipment crossed the border, not a kind of good. They are in every sum
(the categories sum to a partner's total only with them) but are listed in `special`, not `categories`, never ranked
and named in a footnote, like the HS files' chapters 98-99 (`ENDUSE_SPECIAL`):

| Flow | Code | Plain name | 2025 |
| --- | --- | --- | --- |
| Exports | `60000` | Minimum-value shipments | $54.7B |
| Exports | `60010` | Miscellaneous domestic exports & special transactions | $10.2B |
| Exports | `60040` | Undocumented exports to Canada (2024 on) | $0.3B |
| Imports | `50020` | U.S. goods returned & reimports | $103.6B |
| Imports | `50030` | Minimum-value shipments | $30.1B |
| Imports | `50040` | Movies, miscellaneous imports & special transactions | $11.5B |

Catch-all "n.e.c." and "other" categories that are still goods (Other industrial machines, Other chemicals, Other
vehicle parts, Other foods) are ranked. Military categories (`50xxx` on exports, `50000`/`50010` on imports) are
real kinds of goods and are ranked.

**Output** (whole dollars, keyed by `country_code`; same tuples as the HS files, `lib/trade-enduse-entities.ts`):

- `trade_enduse/<country_code>.json`: one row per (year, flow) for the partner: `value`, (imports: `con_value`,
  `duties`), `categories` (ranked, largest first; exports `[code, value]`, imports `[code, value, con_value,
  duties]`), `special`. **Every** category with trade is kept, not a top N: 236 files, 14.4 MB (about 5.1 MB gzipped
  as a tarball); the largest partner is Canada at 139 KB.
- `trade_enduse_national.json`: the same per (year, flow) for all countries, from the API's all-countries row. 153 KB.
- `trade_enduse_labels.json`: one row per (flow, code): plain `label`, Census's `census_desc`, `special`. 34 KB.
- `trade_enduse_partners.json`: per (year, flow), the top five partners of every ranked category, same tuples,
  largest first. **Exact**, derived from the per-partner rows (every partner row carries every category it trades),
  so unlike the HS headings no category is ranked from a truncated list. 670 KB.

**Validation (fails `pnpm transform`).** Zod on every row; every category in the data has a label and every label
is used (`lib/trade-enduse-labels.ts`; also `pipeline/transform/trade-enduse.test.ts`); in `validateEnduse` (tolerances
`ENDUSE_TOL`, measured values in `trade_report.json` under `enduse`):

- Each partner-year's categories (with special entries) sum to its `trade_by_country` total (exports, general imports;
  months 1 to `months` for the year in progress) within the larger of $1M and 0.1%. Measured worst among partners of
  $100M or more: 0.16% (Grenada exports, 2026: $0.2M on $132M, inside the $1M floor); exports to Canada in the
  year in progress are the one exception, with a 1.5% tolerance: 0.76% ($1.8B on $236.0B), the same Census revision
  timing as the HS files (the latest month and every full year agree).
- Imports for consumption and calculated duty sum to `duties_by_country` within 0.05% plus $1 per category. Measured
  worst: **$0 gap** (every partner-year).
- Against the HS-chapter files (`trade_products`, the same API and bases, a different classification of the same
  shipments), every partner-year's `value`, `con_value` and `duties` agree within 0.05% plus $1 per category.
  Measured worst: **$0 gap** (all 7,904 partner-year-flows).
- Per category-year, the partners' rows sum to the API's all-countries row within 0.2% (and $1M). Measured worst:
  **$0 gap** (per category and per year-flow total): the partner codes 1xxx-9xxx account for the all-countries row
  exactly, with the groupings and `1XXX` excluded.
- All-countries categories sum to the World goods total (Census basis, full years) within 0.1%. Measured worst:
  3e-8 ($0.05M on $1.5T, 2015 exports; the World table is whole $M).
- Partner lists: known non-aggregate countries, largest first, never more than the all-countries row, the leader is
  the largest partner row. Same months for both flows; no year without an all-countries row.

**Refresh.** The weekly `trade-freshness.yml` runs `pnpm fetch:census-enduse --recent` (the year in progress and the
three before it, about 280 calls, 35 s), then the usual transform. A new category code with no label fails the
transform with its Census description, to be named deliberately. A new Census country code fails the transform until
it is added to `countries.json`, like the other trade files. The full fetch (`pnpm fetch:census-enduse`) is only
needed to start over.

**The use list.** The right-hand list of the "What the U.S. trades" card, beside the chapters and sharing its year,
Country filter and Exports / Imports toggle; dollars, with each category's collected rate on imports, as for chapters.
Served per partner (and `all`, from `trade_enduse_national.json`) by the static route `/data/trade/enduse/[code]`
(`lib/trade-enduse-data.ts`, category codes only: the names are `lib/trade-enduse-labels.ts`, small enough for the
client). Every category with trade is ranked (special entries never; the one note under both lists sums them, and
adds the use tally only when it prints differently from the chapter tally). With all countries showing a line opens to its chapters (below) and its top five countries
(`/data/trade/enduse-partners/[year]`, from `trade_enduse_partners.json`); with one country picked rows do not open.
The Data notes name the 2010 start, the source and the civilian-aircraft asymmetry (exports one line, imports three).
The partner lag note is shared with the chapters: the end-use and HS files agree to the dollar. `next.config.ts` keeps
`trade_enduse/**` and `trade_enduse_partners.json` out of every server function's trace (as for `trade_products`),
since only those static routes read them. (A by-year chart of the five end-use groups sat beside the list until the
two lists were put side by side; see git history.)

## Goods by product and use (HS heading x end use)

What each product (HS heading) is *used for*, in dollars, 2010 on, all countries: the data behind an opened line's
breakdown in "What the U.S. trades" (a chapter's end uses, or a use's chapters). It joins the two classifications above ("Goods by product", "Goods by use") at the finest level Census
publishes, the 10-digit HS line, so each heading's value is split exactly among the end-use categories its lines are filed
under. Read by `components/trade/TradeProductsCard.tsx` (model `lib/trade-chapter-use.ts`) through the static
`/data/trade/chapter-use/[year]` route, which sums the file to chapter x use on the server (ranked and special pairs
apart) so the heading level never ships. It first fed a chapter -> product -> use Sankey card (PR #322), since removed. Fetch `pipeline/fetch/census-productuse.ts` (library
`census-productuse-lib.ts`, spreadsheet readers `pipeline/transform/xlsx.ts` and `xls.ts`); transform
`pipeline/transform/trade-productuse.ts` (run from `trade-run.ts`); schema `lib/trade-product-use-entities.ts`.

**Source.** Two Census downloads per (flow, year):

- The HS10 values, `timeseries/intltrade/{exports,imports}/hs`, `COMM_LVL=HS10&CTY_CODE=-&time=<year>-12` (the year in
  progress: its latest month, year to date). One call returns every line for all countries: 2025 exports 9,442 lines (0.45
  MB, 4-14 s), imports 18,850 (1.3 MB, 7-14 s). Same variables as the other trade files: exports `ALL_VAL_YR`; imports
  `GEN_VAL_YR`, `CON_VAL_YR`, `CAL_DUT_YR`. 34 calls for 2010-2026.
- Census's yearly HS10 -> end-use concordance, `https://www.census.gov/foreign-trade/reference/codes/concordance/`
  `expconcord<YY>` (Schedule B) and `impconcord<YY>` (HTS): one file per year and flow, `commodity` -> `end_use` (the
  same five-digit codes as the `enduse` API, so a code is only read with its flow, as in "Goods by use"). 2010-2019 are
  old binary `.xls` (read by `pipeline/transform/xls.ts`, a minimal BIFF8 reader, no dependency), 2020 on `.xlsx`. The
  index page lists only up to 2022; 2023-2026 exist at the same URL pattern. Column order differs by year, so columns are
  found by header name.

Both are cached under `pipeline/raw/census-trade/product-use/_cache/` (git-ignored, 121 MB) so an interrupted run resumes
and the join can be redone offline. Only the joined sums are committed:
`pipeline/raw/census-trade/product-use/{exports,imports}/<year>.json`, `[HS4, end use, ...values]` summed over the HS10
lines, whole dollars, one row per line (2.4 MB for both flows, 2010-2026, `assigned` lists included). A fetch from an empty cache
reproduces them byte for byte (`fetched_at` is carried over while nothing changed).

**The concordance is incomplete in 2017-2022** (found by the first full join; the feasibility check had only looked at 2025).
Census builds each year's file before the codes added during the year, so some HS10 lines that trade have no row in their
own year's file, and the code is in the *next* year's. Exports are affected 2017-2020 (12, 113, 2 and 4 lines), imports
2017-2022 (up to 197 lines and $32.5B in 2020). The join therefore looks a line up in its own year's file, then the next
year's, then the previous year's, then the hand maps below. Every line that did not come from its own year's file is listed
in the raw file (`assigned`: HS10, end use, source year or `map`, value), counted per (year, flow) in `trade_report.json`
(`product_use.assigned_lines`), and logged by the fetch. The adjacent-year answer is right where it can be checked: it takes
the dollars that do not match the published end-use totals from $10.8B to $78M for 2018 imports, and from $16.4B to $0.5B
for 2020 imports. A line still without a row fails `pnpm transform`, naming the HS10 code. A blank `end_use` cell is
treated as no row (two in the 2016 imports file, neither with trade).

**Hand maps** (`census-productuse-lib.ts`, each with the reasoning in its comment):

- *Exports, chapter 98.* The statistical codes 9880002000 and 9880004000 (low-value estimate, $54.7B in 2025) -> `60000`,
  9880006000 (undocumented exports to Canada, 2024 on) -> `60040`, 9870003000, 9870005000 and 9870007000 (special Canadian
  classifications, $0.15B) -> `60010`. They are missing from the concordance from 2022 on; with the map every 2025 export category
  matches to the dollar. A code a concordance does carry keeps that end use.
- *Imports, 17 lines in 2017, 2021 and 2022* that no concordance has (2 in 2017: metal furniture 9403200022/24 -> `41000`;
  5 in 2021: organic chemicals 2903392036/38/40 and 2931390020/30 -> `12540`; 10 in 2022: fresh vegetables `07xx` ->
  `00130` and 2206009010/20 -> `00190`). Each takes the end use its numerically nearest HS10 neighbours share in the same
  file; checked against the published totals (2017 imports: dollars under a different end use fell from $575M to $218M).
  Keyed by year and code, so it cannot hide a new gap.

**Special entries** are flagged, not dropped, as in the other files: a pair goes in `special` if its end use is in
`ENDUSE_SPECIAL` (minimum-value shipments, returned goods...) *or* its heading is in chapter 98/99. Both stay in every sum.
So a chapter-37 line filed under the special "Movies, miscellaneous imports" use is in `special` although its chapter is
ordinary, and a chapter-98 line under an ordinary use is too. `value`, `con_value` and `duties` are sums over both lists.

**Output** (`trade_product_use/<year>.json`, 2010-2026, 17 files, 2.3 MB; one row per flow, exports then imports; schema
`lib/trade-product-use-entities.ts`, validated by Zod). A row is `{year, months, flow, value, [con_value, duties,] rows,
special}`; `rows` and `special` hold tuples `[hs4, use, value]` (exports) or `[hs4, use, value, con_value, duties]` (imports),
ordered by heading, then value, largest first. The chapter is `hs4.slice(0, 2)`. 2025: exports 1,793 + 15 pairs (48 KB, 16
KB gzipped), imports 2,084 + 18 (93 KB, 37 KB gzipped; without `con_value` and duties it would be about 56 KB). A year's
file is about 2,000 rows per flow, so every read the card needs is one pass in the browser (under a millisecond; tested in
`trade-productuse.test.ts`):

| Card read | From one flow's chapter x use pairs |
| --- | --- |
| A chapter's uses | keep the chapter; its special pairs are one "Special entries" part |
| A use's chapters | keep the use; its chapter 98/99 pairs are one "Special entries" part |
| Lines linked to an open line (kept lit) | pairs worth 1% of the open line or of the other line |

A chapter's pairs (with its special ones) sum to its total in `trade_products_national.json` to the dollar. A use's sum
to Census's published category total only up to the concordance drift below: about 3% of use-years differ by 1.5% or
more (the largest, imports of 21200 in 2022, by 10%), so the breakdown splits each line over its own pairs, sums to
100%, and the card's Data notes say a use's split can differ from its total by a few percent (`lib/trade-chapter-use.test.ts`).
Names: end uses `lib/trade-enduse-labels.ts` (by flow); chapters `lib/trade-hs-chapters.ts`.

**Validation (fails `pnpm transform`; `validateProductUse`, tolerances `PRODUCT_USE_TOL`, measured values in
`trade_report.json` under `product_use`).** Zod on every row; every end use has a label for its flow; no duplicate
(heading, use); exports and imports cover the same months; no unmatched line. Against `trade_products_national.json` (the
same HS10 lines summed by the API): triples summed by **chapter** (all of them, 98/99 included) and by **heading** (its top 25
and every special heading) match within $1; measured **$0 gap** across all 34 (year, flow)s (3,315 chapter and 1,070 heading
comparisons; for imports, `con_value` and duties as well). The grand total matches `trade_enduse_national.json`'s
`value`, `con_value` and `duties` within $1 (measured $0). Against the same file, summed by **end use**, the join is not
exact: the concordance is the end-of-year file, so a line whose end use changed during the year is filed under its final
category here and split between the old and new in the API's end-use series (the $38.3M live-animals import line in 2025 is
the example). Measured over 2010-2026: the dollars under a different end use are 0% in 2013-14 and 2026 (and 2025 exports), and at most
0.25% of the flow (imports 2010; 0.23% in 2011, 0.13% in 2022-23, 0.03% or less in other years; exports at most 0.09%), and no single
category is off by more than $2.9B (0.15% of the flow: imports 2022, category 20005, with 41050 on the other side). The
tolerances are 0.3% of the flow per category and 0.5% for the total moved. Imports' `con_value` and duties are not compared
by end use. A category off by more than $1M turns up 217 times in the 34 (year, flow)s (the report lists the largest).

**Refresh.** The weekly `trade-freshness.yml` runs `pnpm fetch:census-productuse --recent` (the year in progress and the year
before: 4 HS10 calls, their concordances and the neighbouring years', about 25 s; `--recent` downloads them again), then
the usual transform. A full fetch (`pnpm fetch:census-productuse`, 2010-2026) takes about 3 minutes from an empty
cache (measured 3 min 17 s, two downloads at a time). A new Census year is picked up by itself (the concordance for it has to exist: the fetch fails otherwise, naming the
file). `next.config.ts` keeps `trade_product_use/**` out of every server function's trace: the only route that reads it is static.

**Not in this layer.** Per-country product-to-use (exact, via the HS10 call per partner, about 7,400 calls) is a separate
future session; these files are all countries only.

## Country codes

`country_code` is the join key. Rows in `countries.json` are one per **Census code**
(`census_code` is the source id); a `country_code` can have several Census codes.

- **ISO 3166-1 alpha-3** from Census's own Schedule C alpha-2 (`country.txt`) widened in
  `trade-iso.ts`. 237 partners are `kind=country`; a Census "country" includes dependencies
  and special areas (Hong Kong, Greenland, Puerto Rico), not only sovereign states.
- **No clean ISO3:** Kosovo `XKX`, West Bank `XWB`, Gaza Strip `XGZ` (ISO files both of the
  latter under one entity; Census reports them separately, so each gets a user-assigned code).
- **Dissolved or superseded codes** keep an ISO 3166-3-style code: `SUN` (USSR), `CSK`
  (Czechoslovakia), `YUG` (Yugoslavia), `SCG` (Serbia and Montenegro), `ANT` (Netherlands
  Antilles), `NTZ` (Iraq–Saudi Neutral Zone). `kind=former`, with a note on the successors.
- **Recodes keep one series.** Where Census moved a country to a new code, the codes share
  one `country_code` and their months are summed (Ethiopia 7740→7749 in 1993, Sudan 7320→7321
  in 2011, Serbia 4802→4801 in 2009). Distinct codes are exclusive partners, so this cannot
  double count; a changeover month can carry both (Ethiopia June 1993 does). Ethiopia's old code
  7740 included Eritrea; Eritrea (`ERI`) is reported from 1993. Sudan through 2011 includes
  South Sudan, which reports separately (`SSD`) from 2011, so Sudan's series drops at that break.
  Czech Republic and Slovakia start in 1993 (`CSK` covers Czechoslovakia in 1992); Russia etc. start in 1992 (`SUN` covers 1991–92), so no country series spans those breaks.
- **Germany** is one code (`DEU`, 4280) across the window; no East/West split appears after 1991.
- **Unallocated:** `UNALLOC_8220` (Unidentified Countries), `UNALLOC_8500` (International
  Organizations) are Census residuals and **are part of the country sum**.
- **Aggregates** (`is_aggregate=true`, code `AGG_<census code>`): World (NSA/SA), EU, regions,
  NAFTA/USMCA, CAFTA-DR, Pacific Rim, Advanced Technology Products. Filter on `is_aggregate`
  before summing countries. Aggregate codes in the duties API use a different numbering
  (e.g. `0021` is a different group there) and are not carried; the duties files hold countries
  only, and `duties_national.json` is the API's own all-countries row.

## Grain and size

Sharded by year (the `line-items/<year>.json` precedent), one row per (country, year) with
12-month arrays, so a selected year's partner table is one file and a country's series is a
walk over shards at build time. Measured: `trade_by_country/*` 2.0 MB total, largest year
59 KB; `duties_by_country/*` 1.5 MB total, largest year 94 KB; `trade_national.json` 149 KB.
Nothing is fetched at runtime in the app.

## Validation (fails `pnpm transform`)

Zod on every output row, and, in `trade.ts` `validateTrade` (tolerances in `TOL`):

- exports − imports = balance (national within $1.5M — the BOP table is in whole $M;
  by-country within $0.1M); no negative exports/imports; no duplicate keys.
- Each country-year's 12 months sum to its annual column within $1M (measured worst: $0.4M).
- **Within the Census basis**, non-aggregate country rows sum to the World NSA total each
  month within 0.2% (measured worst, 1992 onward: 0.07%). Before 1992 Census itemizes only
  about 80 partners, so countries cannot sum to World: the tolerance there is 3% and the
  measured shortfall is 2.1% (worst month, 1991-12 exports). A page must not present 1991
  country shares as summing to 100%. BOP totals are never forced to match Census country sums.
- Duties: country rows sum to the all-countries row within 0.1% for duties and imports
  (measured worst: 0, both sources), `rate = duties / import value`, no duties row for an aggregate, and every
  row's `source` equals its year's all-countries source.
- No gaps: BOP annual 1991–latest; monthly goods (NSA and SA) 1991-01 – latest; duties
  1993-01 – latest; every year has country rows.
- An unmapped Census country code, a changed column layout in either spreadsheet, or a
  duties row with an unknown code fails with a specific message.

Spot checks against Census's own fetched tables run in `pipeline/transform/trade.test.ts`
(1985 BOP goods and services −$121,879M / $289,071M / $410,951M; 1991 BOP and Census-basis figures).

## Latest month

`country.xlsx` zero-fills months not yet published. The last published month is the newest
month where the World NSA total is non-zero; later months of that year are `null`. The duties
file's last month is the newest month the API returned. The two can differ.

## Revisions

Census restates history (annual revisions each June). Raw snapshots are replaced on refresh
and the weekly job (`trade-freshness.yml`) opens a PR when the rebuilt output differs;
auto-merged only after the CI gate passes. Values are the latest revised as of the fetch (`fetched_at` in the duties raw files).
