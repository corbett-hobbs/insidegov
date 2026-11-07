# Executive actions: pardons section, scope

Status: phases 1 to 3 built; phase 4 not started. Mockup: `docs/mockups/executive-actions-pardons.html` (real data, pulled Nov 3, 2026; `mockups` launch config, port 3300). Its parsing scripts were throwaway; the build writes a proper fetch and transform.

## The page

| Today | Proposed |
|---|---|
| `/presidency/executive-orders` | `/presidency/executive-actions`, with 308 redirects from the old route and its `/chart/[chart]` pages |
| Nav "Executive orders" | Nav "Executive actions" |
| H1 "How Many Executive Orders Does Each President Sign?" | "How Do Presidents Use Executive Power?" |
| Search title "Executive Orders by President and Year" | "Executive Orders and Pardons by President" |

It is one scrolling page with numbered sections, built like Immigration: **1 Executive orders**, then **2 Pardons**, using the shared `SectionPills`, `SectionStrip` and `SectionToc`. In the news and FAQs follow as one band at the bottom.

**The two sections cover nearly the same years:**

- The pinned bar holds only the year slider and term band, from 1993 (Clinton's first year) to now. No Show switch.
- Pardons run from fiscal 1993. Orders start in 1994, where the page's orders data begins, so a window that ends in 1993 gives the orders card a short notice.
- Data notes say Clinton's 1993 orders aren't shown, and that fiscal 1993 leaves out George H.W. Bush's 38 grants. Clinton's first grants came in fiscal 1995.

**Filters that apply to one section move into that section.** Topic sits in a row under the orders heading, and Type and Offense under the pardons heading. Each row stays pinned under the bar while its section is on screen, so a filter is never shown beside charts it doesn't affect. This is new: Immigration has no per-section filters. The executive orders card, list, Data notes and FAQ content otherwise don't change.

Orders count by calendar year and clemency by fiscal year, so the slider's years line up to within three months, and Data notes say so. Tapping a term sets fiscal years, so Obama's band shows orders through calendar 2017, which includes Trump's first orders. The build should set the orders window from the term's dates.

## Cards

The pardons section has a full-width hero, then three pairs (rule 10r), then the full-width list. The orders section keeps its one full-width card and list.

| Card | Shows | Coverage | Source |
|---|---|---|---|
| **Grants per fiscal year** | Stacked pardons, commutations, group grants; click a legend series to show only it | FY1993-now | DOJ statistics, then the Trump list |
| **Grants by president** | Total or per year | Clinton-now | DOJ statistics |
| **What happened to petitions** | Granted, denied, closed | Clinton-Biden | DOJ statistics |
| **What the offenses were** | Share by category | Clinton-now | Recipient lists plus classifier |
| **When in the term** | First year, middle, final year, last 90 days | Clinton-now | Recipient lists |
| **Years from sentence to pardon** | Median and middle half | Clinton-now | Recipient lists |
| **Petitions waiting** | Pending at start of each fiscal year | FY1993-Jan 2025 | DOJ statistics |
| **Every grant since Clinton** | Search by name, offense, district; filtered by the section row, the slider and tapping a year | Clinton-now | Recipient lists |

What the data shows, for checking whether each card earns its place:

- **Years from sentence to pardon:** median of 2 years in Trump's second term, against 12 to 24 for every president from Clinton through Biden.
- **When in the term:** Biden 96% in the last 90 days, Trump's first term 82%, Obama 56%, Clinton 54%, Bush 43 19%. Trump's second term so far is 97% in its first year.
- **What happened to petitions:** 9% granted under Clinton, 2% under Bush 43, 7% under Obama, 3% in Trump's first term, 15% under Biden including his group warrants.
- **What the offenses were:** drugs are 90% of Obama's listed grants, 65% of Biden's, 17% in Trump's second term.

### Filters, colours and layout

- **Type filter:** Pardons, Commutations, Group grants. Group grants shows no count, because its rows cover thousands of people. The hero legend and the dropdown stay in sync, and Grants by president dims filtered types without changing its totals.
- **Type colours:** pardons blue (`#1c8fd1` light, `#2f9bd8` dark), commutations orange (`#e2641b`, `#dc6a24`), group grants indigo (`#4a40b4`, `#7c78e8`). They pass the dataviz palette validator. The immigration offense colour is olive (`#6f9a3c`, `#98c460`) to stay clear of pardon blue.
- **When in the term colours:** first year uses the immigration offense colour, middle and final year the greys, last 90 days the violent offense colour. Owner's call: overlaps between separate charts are fine, and a grey-only scale was tried and rejected.
- **Bars:** every president-row card uses one bar height (16px) and row height (26px).
- **Paired chart heights:** Petitions waiting takes its height from Years from sentence to pardon, so the charts and their Data notes line up.
- **Grant list rows, modelled on the Supreme Court case list:** date on the left; name, coloured type pill and muted district; offense and sentence beneath; president column; coloured square and offense category on the far right. On a phone, date and offense share the top line, and the president comes last.

### Considered and left out

- **Map by federal district:** mostly tracks where federal cases are brought, not anything a president chose.
- **Donors or personal connections to the president:** no neutral dataset, and it would mean coding a judgment per person.
- **Restitution or fines erased:** only advocacy estimates exist. The sentence text is in the list for anyone looking at one case.
- **Grants that bypassed the Pardon Attorney:** a good measure, but DOJ publishes it for only three administrations (Obama 98%, Trump's first term 54%, Biden 28%). It goes in Data notes instead.
- **Per-person pages:** most recipients are private people, and individual pages would rank in searches on their names. The list stays a list.

## Data

**Source: DOJ Office of the Pardon Attorney, all public.**

- `justice.gov/pardon/clemency-statistics`: fiscal-year rows. Use fiscal 1993 on, Clinton's and later rows only. Stops at January 2025 and doesn't cover the current term.
- `justice.gov/pardon/clemency-recipients`: per-president pages. Use Clinton through the current term. Current-term page updated Oct 20, 2026.
- `justice.gov/pardon/past-clemency-action-and-statistics`: the Pardon Attorney share, Obama through Biden.

**Parsing is the main work.** There are two page formats in range:

| Era | Fields | Format |
|---|---|---|
| Clinton-Trump's first term and Biden | Name, district, sentence, offense | Four or five columns, mixed with labelled rows on Obama, Clinton and Bush 43 pages |
| Trump 2025- | Same, with pardons and commutations mixed under one date | Type comes from the heading or the warrant's title |

Parsed counts against DOJ's totals:

| Check | Listed | DOJ count |
|---|---|---|
| Clinton | 461 | 457 |
| Obama commutations | 1,718 | 1,715 |
| Obama pardons | 208 | 212 (4 still unparsed) |
| Biden commutations | 181 + 3,989 group | 4,165 |

The build should test against these and say in Data notes that the two DOJ sources differ slightly.

**Known data problems**

- **Biden's 3,989 group commutations are in PDFs.** The mock shows them as two group rows. The build should parse the PDFs into rows, or the Biden row on the offense chart stays partial.
- **Amended warrants can count twice** (Zuberi appears on May 28 and Oct 1, 2025). Decide on a rule; the mock counts every warrant.
- **18 Bush 43 pardons are dated "January 1, 2009" on DOJ's page.** Check before using them in the timing card.
- **The offense categories are a keyword prototype.** "Other" is 33% of Trump's second term (mostly Clean Air Act and clinic-access convictions), so the real categories need another look. Use the executive orders' classifier pattern: a committed cache, a verbatim evidence clause, a reviewed sample.
- **Proclamation details need sourcing.** 10887, 10467 and 10688 were checked against primary or archive sources. 10989's details came from Wikipedia, so check them.

**New files, following the executive orders track**

- `pipeline/fetch/clemency.ts`, `pipeline/transform/clemency-run.ts` (plus test), `lib/clemency-entities.ts`
- `pipeline/output/clemency_years.json`, `clemency_grants.json`
- `pipeline/reference/clemency-proclamations.json`: hand-maintained, like `tariff_actions.json`
- `pipeline/classification/clemency_offenses.json`: committed cache
- `.github/workflows/clemency-freshness.yml`: weekly, CI-gated merge
- `docs/CLEMENCY_METHODOLOGY.md`, plus a `lib/methodology-content.ts` entry

The list is about 3,250 rows, or about 7,250 with Biden's PDFs. It should load on demand rather than ship with the page, which matters more now that every visitor to the orders section gets this page too.

## Phases

1. **Rename and sections.** Move the route, add redirects, update every reference to the old path, and move Topic into a section row, with the Pardons section added in phase 3. Executive-orders references appear in about 88 files, though many are data and test names that don't change. The path itself is in `lib/verticals.ts`, `next.config.ts`, `lib/hub-seo.ts`, `lib/og-topics.ts`, `lib/og-charts.*`, `lib/structured-data.ts`, `lib/site-search-index.ts`, `lib/api-datasets.ts`, `lib/fast-facts.ts`, `components/presidents/notes.tsx` and `pipeline/insights/datasets.ts`.
2. **Data.** Fetch and transform from Clinton on, reconciliation tests, Biden PDFs, proclamations file, freshness workflow, offense classification.
3. **Cards and list.** Reuse `StackedBars`, `RangeSelector`, `TermBand`, `MultiSelectFilter`, `ChartCard`, `MethodologyNote`. New `components/clemency/` and `lib/clemency-takeaways.test.ts` checking every figure quoted. Context lines where an event explains the shape. Pardons FAQs through `pipeline/faq` and the owner's approval label, joining the orders FAQs in the shared bottom band.
4. **Afterward, separately.** A clemency card on president pages, a public API dataset, share cards and social posts.

## Settled

**Keep what's in the mock** (owner's call, 2026-11-03). Executive orders come first, the page title is "How Do Presidents Use Executive Power?", and the third pair of charts stays. No owner decisions remain open.

**FAQs at the bottom, covering both sections** (owner's request, 2026-11-03). The existing orders FAQs stay, and pardons questions join them in the shared band, starting with the difference between a pardon, a commutation and a group grant. "Group grant" is this site's label, not a legal term, and the answer says so. The mock's drafts go through `pipeline/faq` and the owner's approval label like every other page.

**Pardons start with Clinton, no earlier data** (owner's call, 2026-11-03). The slider and every card run from fiscal 1993, when his term began, one year before the orders data. DOJ's 457 Clinton grants all fall in fiscal 1995 or later, and Bush's 38 fiscal 1993 grants are left out, which Data notes say. Ford's and Carter's proclamations drop out, leaving Biden's two marijuana proclamations as the only count-less markers.

**No All grants or Individual warrants toggle** (owner's call, 2026-11-03). Individual warrants was only All grants without the Group series. The hero legend filters instead, like the orders chart: click a series to show only it, click again for all. The Type filter gains Group grants.

**One scrolling page, no switch** (owner's call, 2026-11-03). On the rest of the site a switch changes a filter, so it shouldn't swap whole sets of charts. Different date ranges don't require separate pages, because Immigration's pattern handles them. Two costs were accepted: the page is lopsided, with one orders card against eight pardons cards, and pardons get no page title of their own for search. If either becomes a problem, `/presidency/pardons` as its own page is the fallback.

**Mass grants count as mocked** (owner's call, 2026-11-03). Bars include DOJ's Biden group warrants (1,499 and 2,490) and the two Trump proclamations with a usable figure: January 6 at about 1,500 and the 2020 election proclamation at 77 named. Proclamations with no reliable count (Biden's marijuana pardons) are numbered markers, not bars. Data notes say the January 6 figure is reported, not official. A new proclamation follows the same test: it goes in the bars only with a usable figure.
