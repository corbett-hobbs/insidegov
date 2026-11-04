# Clemency: how the data is built

Source: the Justice Department's Office of the Pardon Attorney. Run: `pnpm fetch:clemency`, `pnpm classify:clemency`, `pipeline/transform/clemency-run.ts`. Weekly: `.github/workflows/clemency-freshness.yml`.

## Two DOJ sources

- **Statistics** (`clemency-statistics`): fiscal-year counts, used for the yearly bars, presidents' totals, petition outcomes and petitions waiting. It stops at January 2025.
- **Recipient lists**: one row per person, used for offenses, timing, years from sentence and the list, and for the current term's counts.

The two differ slightly. `pipeline/transform/clemency.test.ts` pins both sides, so any new gap fails the build:

| Group | Listed | DOJ count |
|---|---|---|
| Clinton pardons | 396 | 396 |
| Clinton commutations | 65 | 61 |
| George W. Bush pardons | 192 | 189 |
| George W. Bush commutations | 11 | 11 |
| Obama pardons | 210 | 212 |
| Obama commutations | 1,716 | 1,715 |
| Trump first-term pardons | 144 | 144 |
| Trump first-term commutations | 94 | 94 |
| Biden pardons | 80 | 80 |
| Biden individual commutations | 181 | 176 (4,165 minus 3,989 on group warrants) |

## Rules for the known problems

**Coverage.** Fiscal 1993 counts from Clinton's first day and leaves out George H.W. Bush's 38 grants. A grant belongs to the president whose page lists it, so Clinton keeps his January 20, 2001 grants.

**Biden's group warrants.** They count at DOJ's figures, 1,499 (Dec 12, 2024) and 2,490 (Jan 17, 2025). Owner's call, 2026-11-04: the total count is what matters, names needn't be extracted, and the list view says these names aren't listed. They are two group rows, not 3,989 person rows. The warrants are scans, and text extraction runs names together and misreads letters ("Tyrone Bragg Jason Beckham" is two people), so listing them would attribute grants to names that don't exist. They also list no offenses, so person rows wouldn't add to the offense chart. The exception is the disclosure table for January warrant 2, which has clean text: its 561 people are listed, with statutes, marked `inGroup` so they are never counted twice. Register numbers join nothing on the page and are never published. The other 3,428 people have no listed offense, and the offense chart says so.

**Amended warrants.** A warrant under a DOJ heading marked "(Amended)" for someone already listed that term stays in the list and isn't counted again. The original date stands for timing. Zuberi (May 28 and Oct 1, 2025) counts once. An "(Amended)" row with no earlier one counts as a new grant.

**18 Bush pardons dated January 1, 2009.** DOJ's page gives this date, and we keep it as printed. Every date it could stand for falls after Bush's November 24, 2008 list and before he left office, so these pardons land in his last 90 days and fiscal 2009 either way. The timing card doesn't depend on the true date.

**Mass proclamations.** `pipeline/reference/clemency-proclamations.json` is hand-maintained. A proclamation goes in the bars only with a usable figure: January 6 at about 1,500 (reported, no official count) and the 2020 election at 77 named. Biden's two marijuana proclamations have no count and are numbered markers. Sources: 10887 and 10989 from the Federal Register, 10467 and 10688 from the American Presidency Project. 10989's name, date and count were re-checked against the Federal Register text, replacing the mock's Wikipedia details.

**Years from sentence.** The latest year in the sentence field up to the grant, ignoring dollar amounts. A grant with no date (N/A, before conviction) is left out.

## Offense categories

Claude (Sonnet 5.5, xhigh) reads each distinct offense text and picks one category by the first offense listed (`pipeline/classification/clemency-offenses-auto.ts`). Each answer must quote its evidence verbatim from the text, or it is asked again; answers are cached in `clemency_offenses.json` and never overwritten.

The mock's keyword categories left 33% of Trump's second term in Other. **Regulatory & environmental** is new, for Clean Air Act, wildlife, labeling, export and licensing offenses. Clinic-access offenses stay in Other, since they are neither regulatory nor a category of their own at this size.

`docs/clemency-offense-audit.csv` is a seeded random sample of 100 for a person to review. Until that is done, Data notes say the categories are classifier-assigned and don't claim a human check.
