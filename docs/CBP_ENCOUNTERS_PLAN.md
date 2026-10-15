# CBP border encounters — plan

Written 2026-10-15. Adds CBP border encounters to `/presidency/immigration` as
its own card, directly above the ICE removals chart, so a reader can compare
the border with removals year by year. It is split into sessions, each with a
model and an effort level. Copy a session's prompt into a new Claude Code
session, and run each session in its own git worktree, not the shared
checkout.

| Session | What | Model | Effort | Depends on |
| --- | --- | --- | --- | --- |
| L | Data: CBP encounters pipeline (source check first) | **Opus 5.5** | **High** | — |
| M | UI: encounters card above the removals chart, synced hover | Sonnet 5.5 | Medium | L |
| N | Refresh automation for the encounters track | Sonnet 5.5 | Medium | L |

M and N touch different files and can run side by side once L has merged.

### Session L status (2026-10-15): done

- **Data:** `pipeline/output/encounters_{series,monthly,notes,report}.json`, FY1980 to FY2026 (FY2026 preliminary,
  11 months through August). Methodology: `docs/CBP_ENCOUNTERS_METHODOLOGY.md`; source check:
  `docs/IMMIGRATION_SOURCE_NOTES.md` §9. Reader: `getEncountersPayload()` in `lib/encounters-data.ts` (shapes in
  `lib/encounters-types.ts`).
- **Coverage:** Border Patrol every year; **port-of-entry (OFO) figures from FY2004** (owner, 2026-10-15). FY2004–FY2014
  are OHSS's figures (CBP records, rounded to tens; `ofoRounded` on the year); FY2015 on are CBP's own. FY1980–FY2003
  have no OFO rows (`detail: "usbp_only"`), so the card draws them "Border Patrol only, no port-of-entry figures". The
  removals chart starts FY2003, so the two cards differ by one year.
- **Southwest toggle:** supported for every year, with the same rows as the nationwide view; no "not published"
  years.
- **Unique people: dropped.** CBP publishes no fiscal-year count of unique people (only single months against a
  rolling 12-month window, in 2021–2024 press releases). Session M builds no "Encounters / Unique people" pill; the
  `unique-people-not-published` note says why.
- **Markers for session M** (`encounters_notes.json`, `marker` set; `buildEncountersPayload().markers`):
  1. port figures begin (FY2004);
  2. ship crews counted (Apr 2008);
  3. Title 42 begins (Mar 21, 2020);
  4. CBP One appointments (Jan 2023, month precision);
  5. Title 42 ends (May 11, 2023).

  The pre-2000 "different mix of people" caveat is a note without a marker, for the Data notes.
- **Findings beyond the plan:**
  - CBP's FY2025 statistics page misprints FY2024 Border Patrol (1,577,319 for 1,557,319).
  - The same page's FY2018 total is 2,845 short of its own parts.
  - CBP and OHSS differ on FY2000 Border Patrol (5.1%).

  All three are documented exceptions; the methodology lists them.
- **Session N:** `pnpm fetch:cbp` is the refresh. CBP renames the monthly file each month, and the fetch finds it on
  the listing page. The fixed sources (history PDFs, archived pages, OHSS workbooks) never change; the OHSS KHSM and
  monthly tables stopped after Nov 2024, so no review issue is needed for them unless OHSS resumes.

**This reverses one earlier "not planned" item.** `docs/IMMIGRATION_EXPANSION_PLAN.md`
listed "Monthly Border Patrol encounters (not planned: different agency)". The
reason was the page's rule of one agency per chart and never summing across
agencies. This plan keeps that rule: CBP gets its **own** chart, separately
labelled, and is never added to, subtracted from or divided by an ICE figure.

---

## Background (shared by all sessions)

### Why a separate card, not a series on the removals chart

The owner asked whether encounters could go on the existing removals chart. They
don't, for three reasons. Don't re-open this.

1. **Scale.** Encounters peaked around 2.4M (southwest border, FY2022). Removals
   run about 60k–440k. On one axis the removals bars and their ICE / Border
   Patrol split collapse into a strip. A second axis was already rejected on this
   page (see the detention-line decision in `ARCHITECTURE_MAP.md`).
2. **No false funnel.** Side by side on one chart, readers do
   "encounters − removals = people who got in". That math is wrong:
   - Encounters count **events**, not people (repeat crossers count each time).
   - Most encounters end with CBP: returned, expelled under Title 42, or found
     inadmissible at a port. ICE never sees them.
   - A removal can land in a later fiscal year than the encounter.
3. **The removals chart is full.** It already carries the agency split, the
   detention line, the preliminary bar and five numbered markers.

The comparison happens through **alignment** instead: same fiscal-year slots,
same pixel width, the page's shared slider and term band, and a hover that
highlights the same year on both cards.

### What "encounters" means (get this right in copy)

CBP's encounters are the sum of three things. Name each one in the legend and
the Data notes:

- **Border Patrol apprehensions** (USBP, Title 8): people caught between ports
  of entry.
- **Office of Field Operations inadmissibles** (OFO, Title 8): people who came to
  a port of entry and were found inadmissible.
- **Title 42 expulsions** (both components, March 2020 to May 11, 2023):
  people turned back under the public-health order with no immigration
  processing.

Never call them "crossings", "illegal entries" or "migrants who entered". Don't
mention "got-aways": CBP estimates those separately, and they are out of scope.

### Sources to check in session L (verify, don't assume)

These are the leads. Session L confirms what each one covers before writing any
code, and records the result in `docs/IMMIGRATION_SOURCE_NOTES.md` as a new
section.

1. **CBP Nationwide Encounters** data files (cbp.gov, "Nationwide Encounters"
   stats page, CSV). Monthly rows by fiscal year, component (USBP / OFO), land
   border region (Southwest, Northern, Coastal/other), area of responsibility,
   citizenship, demographic, title of authority (Title 8 / Title 42) and
   encounter type. Believed to start around FY2020. Confirm the start year and
   the column set.
2. **Border Patrol historical apprehensions** (cbp.gov Border Patrol
   statistics): nationwide and southwest-sector apprehensions by fiscal year,
   reaching back decades (FY1925 for nationwide totals). USBP only: no OFO and no
   port-of-entry figures.
3. **OHSS** (DHS Office of Homeland Security Statistics): the Yearbook
   enforcement tables (apprehensions by program, long history) and the monthly
   "Immigration Enforcement and Legal Processes" tables. Use these as a
   cross-check on 1 and 2, and possibly as the bridge for OFO before CBP's own
   files begin. The OHSS raw snapshot in `pipeline/raw/ohss/` may already hold
   some of this.

**Coverage: every year from FY1980 (owner, 2026-10-15).** The page's slider
spans FY1980–FY2025 (`components/immigration/ImmigrationFilterBar.tsx`), and
the green-card and refugee cards already fill it, so the encounters card must
too. It shows full three-way detail where CBP publishes it, and Border Patrol
apprehensions alone before that, drawn differently (see session M). Don't
widen the slider before FY1980: it would empty the other cards. Don't stop
the card at FY2003 to match ICE either. The removals chart already shows its
pre-FY2003 years as empty.

Older apprehensions are not the same measure as today's encounters. Before
the 2000s, most people caught were Mexican adults given voluntary return,
often caught several times a year. Today a larger share are families and
asylum seekers from farther away. The FY1980s–FY2000 peaks (around 1.6M) need
a numbered marker or Data note that says this, so readers don't treat the
long line as one like-for-like count.

### Rules for the track (from the existing page rules)

- **One agency and one definition per chart, named in the subtitle.** CBP only.
  Never sum with ICE, OHSS removals or anything else.
- **No ratios or differences across agencies:** no "removals per encounter", no
  "share of encounters removed", in copy, cards or tables.
- **No per-president averages.** Presidents appear only as the term band.
  Fiscal years go to the administration in office on September 30, like the
  rest of the page (blended years show the day split on the year's card).
- **Definition changes are numbered markers on the axis** (rule 6), not a key.
  At least: Title 42 start (March 2020) and end (May 11, 2023), and the point
  where OFO figures begin. Session L lists any others it finds (for example,
  changes to the counting of repeat encounters).
- **Preliminary data is hatched** (rule 10l). CBP's monthly figures are
  operational and get revised; mark the newest fiscal year preliminary until
  the source locks it.
- `lib/immigration-derive.ts` already joins fiscal years to presidents; reuse it.
  Don't add a second terms table.

### Decisions (owner, 2026-10-15)

1. **Scope: all borders by default, with a "Southwest border" toggle.** ICE
   removals are nationwide, so the default matches them; the toggle is a
   `charts/PillGroup` ("All borders" / "Southwest border") because public
   debate quotes the southwest figure. Session L must make sure the southwest
   series covers the same years. Where it can't, the toggle shows those years
   as "no southwest split published", never as zero.
2. **Unique encounters: yes, as a toggle**, if session L finds a consistent
   series ("Encounters" / "Unique people"). It covers only the years CBP
   publishes it. Earlier years show "not published", not a gap that reads as
   zero. Its Data notes say how CBP de-duplicates. If L finds no consistent
   series, drop the toggle and say so in the Session L status.

---

## Session L — data pipeline (Opus 5.5, high effort)

> Read `docs/CBP_ENCOUNTERS_PLAN.md` (Background and this section),
> `ARCHITECTURE_MAP.md` (the Immigration enforcement and Legal immigration
> tracks, and "Page-level layout rules"), `docs/DATA_CONVENTIONS.md` (§9 and
> §17) and `docs/IMMIGRATION_ENFORCEMENT_METHODOLOGY.md`. Follow the
> conventions of the existing enforcement, refugee and LPR tracks: committed raw
> snapshots, a curated catalog with verbatim quotes, Zod schemas, a pure
> transform with gates, and a report file.
>
> **Step 1, source check (stop and report before building).** Download the
> sources listed under "Sources to check" into `pipeline/raw/cbp/` with a
> `.txt` extract each. Then write a short findings section in
> `docs/IMMIGRATION_SOURCE_NOTES.md`:
> - what each source covers (years, components, borders, Title 8 / Title 42);
> - where they overlap, and whether the overlaps agree;
> - how far back each split goes;
> - any definition changes;
> - whether the data supports the two owner decisions (the southwest toggle
>   across the years, and a unique-encounters series).
>
> Message me with the findings and a proposed data model, and wait for a go
> before step 2.
>
> **Step 2, build.**
> - `pnpm fetch:cbp` (`pipeline/fetch/cbp.ts`): re-runnable and keyless. If
>   CBP's file URLs are unstable, follow `fetch:ice`'s pattern.
> - `pipeline/transform/encounters-run.ts`, with the pure logic in
>   `encounters.ts`. It writes:
>   - `pipeline/output/encounters_series.json`: one row per
>     `(period, scope, component, authority)`, where `scope` is
>     nationwide / southwest and `component` is usbp / ofo, with
>     `status` final/preliminary, provenance per value, and presidential
>     attribution (Sept 30 rule, `blended`, days).
>   - `encounters_notes.json`
>   - `encounters_report.json`
>
>   Monthly rows can be stored if the source has them, but the card is
>   fiscal-year.
> - **Gates (fail the transform):**
>   - every year's components add up to its printed total;
>   - overlapping sources agree, or a documented exception explains why not;
>   - schemes never mix within a year;
>   - the Title 42 rows fall only between March 2020 and May 2023.
> - Schemas in `lib/encounters-entities.ts`, the reader in
>   `lib/encounters-data.ts` (server-only), pure derivations and invariants in
>   `lib/encounters-derive.ts`, with tests over the real files.
> - Docs:
>   - write `docs/CBP_ENCOUNTERS_METHODOLOGY.md`;
>   - add a new section to `docs/DATA_CONVENTIONS.md` (keyed by `period`,
>     never `bioguide_id`; CBP only);
>   - add rows for the new files to `ARCHITECTURE_MAP.md`;
>   - add an entry to `lib/methodology-content.ts` (under Immigration);
>   - add the source to the README Data table;
>   - add a dataset entry to `lib/api-datasets.ts`, so the API and MCP serve it.
> - Add a "Session L status" note to the top of this plan file.
>
> Run `pnpm validate`, `pnpm transform`, `pnpm pipeline:check`, typecheck, lint
> and tests. Open one PR. No UI in this session.

## Session M — UI (Sonnet 5.5, medium effort)

> Read `docs/CBP_ENCOUNTERS_PLAN.md` (Background, the Session L status and this
> section) and the "Immigration page" section and "Page-level layout rules" in
> `ARCHITECTURE_MAP.md`. Build on `RemovalsCard` / `RemovalsChart` and the
> refugee and LPR cards. Don't fork them.
>
> **Where it goes:**
> - Section 3 of `/presidency/immigration`, as a new card **directly above**
>   "Removals and detention by fiscal year".
> - Rename section 3 to cover both, e.g. "Who Is Stopped at the Border, and Who
>   Is Removed?". Update the numbered pills, the strip and the bottom source note
>   to match.
> - Rewrite the section intro so it defines CBP and ICE once and says the two
>   cards count different things.
>
> **The card ("Border encounters by fiscal year"):**
> - **Bars:** one bar per fiscal year, stacked Border Patrol apprehensions /
>   port-of-entry inadmissibles (OFO) / Title 42 expulsions. Use solid tokens.
>   Border Patrol reuses `--agency-cbp`, so it matches the removals chart's
>   "Border arrests (Border Patrol)" colour; pick the other two from the
>   existing tokens and validate them with `validate_palette.js`.
> - **Years with Border Patrol figures only:** a neutral bar labelled "Border
>   Patrol only, no port-of-entry figures", the way ICE's FY2003–FY2006 bars read
>   "removals only".
> - **Axis:** its own y-axis, sized from the data (rule 10d).
> - **Geometry:** the same slots, gutter, width and term band as
>   `RemovalsChart`, so FY2022 sits directly above FY2022.
> - **Peaks and markers:** label the peak and low; add numbered markers for the
>   definition changes from `encounters_notes.json`; hatch the preliminary
>   newest year.
> - **Legend:** entries isolate a series (rule 12c).
> - **Synced hover:** lift the hovered / pinned fiscal year into
>   `ImmigrationPageClient`, so hovering or tapping a year on either card
>   highlights it on both. Each card keeps its own tooltip and its own numbers.
>   The encounters tooltip may show that year's ICE removals as a separate,
>   labelled line ("ICE removals, a separate count"). It must never show a
>   difference or a ratio.
> - **Removals chart:** its "Title 42 expulsions not counted" annotation now
>   points up to the encounters card ("counted by CBP, above").
> - **Below the chart:** Data notes (60–100 words: events, not people; most
>   encounters never reach ICE; Title 42; source), then "View as table".
> - **Toggles (owner decisions above):** an "All borders" / "Southwest border"
>   pill (default all borders), and an "Encounters" / "Unique people" pill if
>   session L shipped that series. Both sit in the card header, like the
>   criminal-history card's pills. Years a toggle has no data for read "not
>   published", never zero.
>
> Then:
> - update the page intro and the hub blurb in `lib/verticals.ts` if they now
>   undersell the page;
> - update the Immigration section of `ARCHITECTURE_MAP.md` with the decisions;
> - check it in the dev server at desktop and phone widths: no horizontal
>   overflow, and labels never vanish (rule 10).
>
> Typecheck, lint and tests, then open one PR.

## Session N — refresh automation (Sonnet 5.5, medium effort)

> Read `docs/CBP_ENCOUNTERS_PLAN.md` and the refresh notes in `ARCHITECTURE_MAP.md`
> (`refugee-freshness.yml`, `.github/actions/gate-and-merge`,
> `.github/actions/open-review-issue`).
>
> Add `.github/workflows/encounters-freshness.yml`:
> - run it weekly; CBP posts monthly, around mid-month;
> - re-run `fetch:cbp` and the transform;
> - open a PR only when the output changed, and merge it through
>   `gate-and-merge`;
> - if a source changed shape or the gates fail, leave the PR open with a
>   `needs-curation` label.
>
> If the historical Border Patrol tables are a manual source, add a yearly
> review issue for them through `open-review-issue`.
>
> Document the workflow in `ARCHITECTURE_MAP.md`. Open one PR.
