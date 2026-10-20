# Product-to-use Sankey: data feasibility (2026-10-20)

Question: can the trade page link HS chapters and headings ("products") to Census end-use categories ("uses"),
exactly, for a Sankey card under "What the U.S. trades"? **Yes, exactly, for all countries and (at a cost) per
country.** Mockup: `docs/mockups/trade-sankey-mock.html` (served by the `mockups` launch config, port 3300),
screenshots in `docs/mockups/trade-sankey/`. Nothing is built.

## Concordance (HS10 -> end use)

- Census publishes one file per year and flow: `https://www.census.gov/foreign-trade/reference/codes/concordance/`
  `expconcord<YY>` (Schedule B, exports) and `impconcord<YY>` (HTS, imports). Columns: `commodity` (10 digits),
  descriptions, units, `sitc`, **`end_use`** (5 digits, the same codes as the `enduse` API), `naics`, `usda`,
  `hitech`. Every row has an end use; each HS10 has exactly one.
- Years: 2002-2026. The index page lists only 2002-2022, but `...23`, `24`, `25`, `26` exist at the same URL
  pattern. 2002-2019 are old binary `.xls` (needs an xls reader), 2020 on `.xlsx` (~0.6 MB exports, ~1.3 MB imports).
- Codes change every year, so each year needs its own file. 2024 -> 2025: exports 9,724 -> 9,728 codes (8 new,
  4 dropped, 2 changed end use); imports 19,978 -> 20,064 (125 new, 39 dropped, 6 changed end use).
- Not usable: the AES concordance files (`expaescsv.txt`, `impaescsv.txt`) have no end-use column; the Schedule B
  download `sbsdf.zip` has `econcord.txt` / `iconcord.txt` (not checked; the annual xlsx is enough). The intltrade
  HS endpoints have no end-use variable.

## HS10 values from the API

- `timeseries/intltrade/{exports,imports}/hs?get=<E|I>_COMMODITY,<ALL_VAL_YR|GEN_VAL_YR>&COMM_LVL=HS10&CTY_CODE=-&time=<YYYY>-12`
  returns every HS10 line for all countries in one call. 2025: exports 9,442 rows, 450 KB, 5-17 s; imports 18,845
  rows, 1.1 MB, 9 s. 2010 and 2018 also work (exports 417 / 440 KB, imports 788 / 854 KB).
- Per partner: one call per partner works (`CTY_CODE=5700` China imports 2025: 14,455 rows, 713 KB, 6 s; Canada
  12,264 rows, 600 KB, 5 s). An all-partner call with a commodity wildcard (`I_COMMODITY=85*`) fails at HS10, as at
  HS4 (see TRADE_METHODOLOGY "Goods by product"). So per-country = one call per partner per year per flow,
  about 7,400 calls for 2010-2026.

## Join check, 2025, all countries

Joined the API's HS10 rows to the 2025 concordance and summed by HS2, HS4 and end use.

| Check | Exports | Imports |
| --- | --- | --- |
| HS10 total vs `trade_enduse_national.json` | $0 gap | $0 gap |
| HS2 chapters vs `trade_products_national.json` | $0 max gap | $0 max gap |
| HS4 (top 25 + special) vs the same | $0 max gap | $0 max gap |
| End-use categories vs `trade_enduse_national.json` | $0 after a 5-code fix (below) | 2 categories off by $38.3M |
| HS10 lines not in the concordance | 6 (all chapter 98, $55.1B) | 0 |

- **Exports, chapter 98.** The statistical codes 9880002000 and 9880004000 (low-value estimate, $54.66B),
  9880006000 (undocumented exports to Canada, $0.33B) and 9870003000/5000/7000 ($0.15B) are not in Schedule B. They
  map one to one to the special entries 60000, 60040 and 60010; with that hand map every export category matches to
  the dollar. These are special entries anyway (never drawn).
- **Imports.** One HS10 line moved $38.3M between 12060 and 00150 (live animals): the concordance is the end-of-year
  file and that line's end use changed during 2025. Every other category matches to the dollar.
- So the join is exact in practice. A pipeline should validate against both national files with a small tolerance
  and keep the chapter-98 export map in code.

## How many-to-many it is (2025)

| | Exports | Imports |
| --- | --- | --- |
| HS4 headings | 1,231 | 1,232 |
| ...split across 2+ uses | 354 (56% of value) | 459 (68% of value) |
| ...where the second use is 5%+ of the heading | 262 (34% of value) | 326 (42% of value) |
| End uses fed by 2+ headings | 121 of 137 | 126 of 142 |
| End uses fed by 2+ chapters | 97 | 110 |
| (chapter, heading, use) triples | 1,807 | 2,102 |

Examples (imports unless stated):

- **8517 Phones & network equipment** $142.2B -> Telecom equipment $90.1B, Cell phones & household goods $52.1B,
  Other vehicle parts $17M. It is 79% of telecom-equipment imports and 48% of cell phones & household goods.
  Exports $47.1B -> telecom $31.6B, cell phones $14.7B, vehicle parts $0.9B.
- **8471 Computers** $251.1B -> Computers $218.2B (all of that use), Computer accessories $32.9B (23% of that use;
  8473 computer parts supply most of the rest). Exports $61.3B -> $44.9B / $16.4B.
- **Chapter 85** imports $504.8B -> 48 headings -> 29 uses. Exports $226.5B -> 25 uses.
- **Cell phones & household goods (41050)** imports $108.8B <- 61 headings in 21 chapters (85 $59.5B, 90 $25.0B
  mostly 9021 hearing aids and implants, 94 lamps, 42 handbags, ...).
- **Export civilian aircraft (22090)** $153.5B is **one heading, 8800, in one chapter** (88), in 2025 and back to
  2010 (8800 is Schedule B's aggregate code for civil aircraft, engines and parts). The brief's guess that it draws
  on chapters 84/88 is wrong: the reversed view of that use is a single band.
- Many 1:1 pairs: 8542 -> Semiconductors, 3004 -> Pharmaceuticals, 8703 -> Passenger cars (99%), 21300 Computers <- 8471 only.

## Size and refresh (all countries)

- Fetch: 2 calls per year (one per flow), 34 for 2010-2026, plus 34 concordance files. Weekly refresh: the year in
  progress and the one before, 4 calls.
- Output as `[hs4, use, value]` triples (chapter is the first two digits): ~48 KB exports + ~56 KB imports per year,
  about 1.8 MB for 2010-2026; one file per year so the page loads only the year shown.
- Raw HS10 responses (~1.5 MB per year) belong in a git-ignored cache; only the triples need committing.
- Per country, if wanted later: ~7,400 calls (a few hours first time, under 1 GB of cache), output far smaller per
  partner than nationally. It would be exact, not an estimate.

## Mockup decisions after the owner's first look (2026-10-20)

- A **use** pick shows only that use: products are sized by what they send to it, with no "other uses" band.
- With a **country** picked, the card is removed (it already only appears once a line is tapped).
- Still open: grey "from outside the selection" inflows on chapter and product picks; colours; per-country later or never.
