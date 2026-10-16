/**
 * The takeaway under each Congress wealth card title (ARCHITECTURE_MAP rule 7c):
 * what the card shows for the default view (both chambers, every party, no
 * state), in at most two sentences. Net worth is built from disclosure value
 * bands, so every figure is worded as an estimate. Every figure here is checked
 * against pipeline/output in lib/wealth-takeaways.test.ts; a refresh that makes
 * one untrue fails CI.
 */
export const WEALTH_TAKEAWAYS = {
  scatter: {
    title: "Where they started, where they are now",
    takeaway:
      "Between members’ first usable filings, as early as 2013, and their latest, mostly for 2025, the estimated median net worth rose from about $970,000 to $1.6 million. Most dots sit above the no-change line: 77% of Democrats and 67% of Republicans grew.",
  },
  highest: {
    title: "Highest net worth",
    takeaway:
      "Across Congress, an estimated 292 of 500 ranked members (58%) were worth more than $1 million at their latest filing, mostly for 2025, and 17 more than $100 million. The estimated median was $1.9 million for Republicans and $1.4 million for Democrats.",
  },
  lowest: {
    title: "Lowest net worth",
    takeaway:
      "Across Congress, an estimated 83 of 500 ranked members (49 Democrats, 34 Republicans) reported more debt than assets at their latest filing, mostly for 2025, a net worth below zero. Another 25 were estimated at under $100,000.",
  },
} as const;
