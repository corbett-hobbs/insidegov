/**
 * Shared shapes for the social-post insight pipeline (pipeline/insights/README.md).
 *
 * A dataset is loaded into `Series` (dated numeric observations) or `EventSet` (dated records such as executive orders),
 * every number keeping the data cells it came from. The detectors (detect.ts) turn those into `Insight`s: a headline,
 * a deterministic template caption, a chart spec, and the `Fact`s that are the ONLY numbers a caption may use.
 */

export type DatasetId = "energy" | "gas" | "encounters" | "ice" | "trade" | "executive_orders" | "laws";

/** One cell of a committed output file: the row whose fields equal `key`, and the numeric `field` read from it. */
export type CellRef = {
  file: string;
  key: Record<string, string | number | null>;
  /** The numeric field read, or "__row" for 1 per matching row (counting records such as executive orders). */
  field: string;
  /** Read the value negated (a trade balance shown as a deficit). */
  negate?: boolean;
  /** The field holds an array (one value per month, as in duties_by_country): read this element. */
  index?: number;
};

/** A value is the sum of its cells (one cell for most series; several for e.g. encounters, which add components). */
export type Point = { date: string; value: number; cells: CellRef[] };

export type Frequency = "weekly" | "monthly" | "fiscal_year";

/** How a series' numbers are written: `prefix + (value * scale).toLocaleString(decimals) + suffix`. */
export type UnitFormat = { scale: number; decimals: number; prefix?: string; suffix: string };

export type Series = {
  id: string;
  dataset: DatasetId;
  /** Noun phrase that reads after "U.S." is already in it, e.g. "U.S. crude oil production". */
  name: string;
  /** Short label for the chart's y axis, e.g. "million barrels a day". */
  axisLabel: string;
  unit: UnitFormat;
  frequency: Frequency;
  /** Seasonal series compare a month with the same calendar month in other years (and moves are year over year). */
  seasonal: boolean;
  /** `flow` values add up over a term (encounters, a trade deficit); `level` values are compared start to end (a price). */
  kind: "level" | "flow";
  /** Moves as a percent change, or as an absolute change (for series that cross or sit near zero, like a balance). */
  moveMode: "pct" | "abs";
  /** Skip moves (e.g. a weekly stock whose moves are policy releases, not news), extremes, or term comparisons. */
  skip?: ("extreme" | "move" | "term")[];
  /** Plain words for "higher" and "lower", e.g. ["more", "fewer"] for counts. */
  words?: { high: string; low: string; up: string; down: string };
  /** Unit for totals over a term (trade sums run to trillions). Defaults to `unit`. */
  totalUnit?: UnitFormat;
  /** Axis label for those totals. Defaults to `axisLabel`. */
  totalAxisLabel?: string;
  /** Caveats every caption writer should know (nominal dollars, preliminary figures). */
  context?: string[];
  points: Point[];
  url: string;
  /**
   * Where on the page the post links: the chart card's anchor, with any filter ("#gas-price", "?country=CAN#tariffs").
   * Card ids are the share button's (components/charts/ChartShare.tsx: the title slugged) unless the card sets its own.
   */
  anchor?: string;
  source: string;
  /** Ranking weight: how much a reader cares about this series (1 = default). */
  weight: number;
  /** The dataset's headline series gets a routine `latest` post when nothing notable happened (schedule.ts). */
  headline?: boolean;
  /**
   * Typical days from the end of a period to its publication. Only used to ESTIMATE release dates for the backfill;
   * the freshness workflows know the real one (the day they see the data).
   */
  releaseLagDays: number;
};

export type EventRecord = { date: string; cell: CellRef };

export type EventSet = {
  id: string;
  dataset: DatasetId;
  /** Plural noun, e.g. "executive orders". */
  name: string;
  /** Past-tense verb phrase that follows the count, e.g. "signed". */
  verb: string;
  events: EventRecord[];
  /** Dates before this are not covered, so a term that starts earlier is left out of comparisons. */
  coverageStart: string;
  url: string;
  source: string;
  weight: number;
};

export type Administration = { term_id: string; president: string; start: string; end: string | null };

/**
 * How a fact's value is re-derived from the data (verify.ts). Cells are resolved against the committed files, so a
 * caption number can always be traced to a row.
 */
export type Derivation =
  | { op: "value"; cells: CellRef[] }
  | { op: "pct_change"; from: CellRef[]; to: CellRef[] }
  | { op: "change"; from: CellRef[]; to: CellRef[] }
  | { op: "date"; date: string; style: DateStyle }
  | { op: "duration"; from: string; to: string; unit: "days" | "months" | "years" };

export type DateStyle = "month" | "day" | "year" | "fiscal_year";

export type Fact = {
  id: string;
  /** The value as it is written in a caption, e.g. "$3.12", "13.6 million barrels a day", "August 2026". */
  text: string;
  value: number | string;
  /** How `text` is produced from `value` (verify.ts re-formats and compares). */
  format: { kind: "unit"; unit: UnitFormat } | { kind: "unit_abs"; unit: UnitFormat } | { kind: "pct"; decimals: number } | { kind: "int" } | { kind: "date"; style: DateStyle };
  derivation: Derivation;
  /** For a term's start-year fact: the president's last name, so the caption check can tell which terms a caption names. */
  president?: string;
};

export type ChartSpec =
  | {
      type: "line";
      unit: UnitFormat;
      axisLabel: string;
      points: { date: string; value: number }[];
      /** Dates to mark with a dot and a label (the latest value, the comparison point). */
      marks: { date: string; label: string; emphasis: boolean }[];
      frequency: Frequency;
      /**
       * A second, neutral line to read the main one against (news charts: a country's tariff rate against all
       * countries). Both lines carry an end label naming them, since the headline names only the main one.
       */
      comparison?: { label: string; mainLabel: string; points: { date: string; value: number }[] };
    }
  | {
      type: "bars";
      unit: UnitFormat | null;
      axisLabel: string;
      bars: { label: string; value: number; emphasis: boolean }[];
      /** Horizontal bars read better for long labels (administrations); vertical for years. */
      orientation: "horizontal" | "vertical";
    };

/**
 * `latest` is the routine reading (newest value, change on the period and on the year) that keeps a refresh postable.
 * `news` is a context chart drafted because a topic is in the news (news/README section in pipeline/insights/README.md).
 */
export type InsightKind = "extreme_high" | "extreme_low" | "move_up" | "move_down" | "term_comparison" | "latest" | "news";

export type Insight = {
  id: string;
  dataset: DatasetId;
  seriesId: string;
  kind: InsightKind;
  /** The period the insight is about (the newest observation it rests on), YYYY-MM-DD. */
  period: string;
  /** How often the data comes out (event roundups count as monthly). */
  frequency: Frequency;
  /** Chart headline, short and factual. */
  headline: string;
  /** Deterministic caption built only from `facts`; used when no API key is set and as the model's reference. */
  template: string;
  facts: Fact[];
  /** Context the caption writer may use as words, not numbers (series definition, caveats). */
  context: string[];
  chart: ChartSpec;
  /** Canonical page path on the site, e.g. "/presidency/energy" (printed on the chart). */
  url: string;
  /** Appended to `url` for the post's link: the chart card and its filter (Series.anchor). */
  anchor?: string;
  source: string;
  /** Higher is more notable; used to rank and pick drafts. */
  score: number;
  /** Alt text for the chart image. */
  alt: string;
  /** Freshness (freshness.ts): set when the insight is stamped with the day its data was released. */
  release?: Release;
  /**
   * Fixed opening words the caption must start with (news drafts: "Diesel is in the news."). Written by code, never by
   * the model, so the news is named as a topic and never described.
   */
  lead?: string;
  /** Set on news drafts: the story that triggered it. */
  news?: NewsTrigger;
};

/** A headline as the watcher saw it (news/feeds.ts). */
export type Headline = { title: string; source: string; url: string; published: string; feed: string };

/** Why a news draft exists and how long it stays postable. */
export type NewsTrigger = {
  /** Catalog topic (news/topics.ts), e.g. "tariff_country". */
  topic: string;
  /** Topic plus parameter, the dedupe key: "tariff_country.CAN", "diesel". */
  key: string;
  /** First time the watcher saw the story (ISO). */
  seenAt: string;
  /** Last moment it may post (ISO): news goes stale in hours, not weeks. */
  expiresAt: string;
  /** The headlines behind it, newest first (shown to the reviewer, never posted). */
  headlines: Headline[];
  /** Why the classifier (or the keyword rule, without an API key) took it. */
  reason: string;
};

/** When the data behind an insight came out, and what that means for posting it. */
export type Release = {
  /** Last day the newest period covers (a month's last day, a week's date, September 30 for a fiscal year). */
  periodEnd: string;
  /** Day the data was published (or first seen by a freshness workflow). */
  releasedOn: string;
  /** Whether the release date is an estimate (backfill) rather than observed (workflow). */
  estimated: boolean;
  /** The period ends long before the release, so chart and caption must say the data is newly released. */
  lagged: boolean;
  /** Last day the draft may post; after that it is stale (newer data is out or due). */
  expiresOn: string;
};
