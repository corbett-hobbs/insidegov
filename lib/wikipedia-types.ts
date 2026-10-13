/** What the profile header needs from a `wikipedia_summaries.json` record. */
export interface WikipediaBio {
  /** Trimmed lead text (pipeline/wikipedia/trim.ts). */
  extract: string;
  /** Canonical article URL, for the CC BY-SA attribution link. */
  url: string;
}

/** What a committee header's About block needs from a `committee_summaries.json` record. */
export interface CommitteeAbout {
  extract: string;
  /** The Wikipedia article for the credit link; `null` = a line written for this site. */
  url: string | null;
}
