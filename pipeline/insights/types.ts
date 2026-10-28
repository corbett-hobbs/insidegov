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
  /** A committed output file; `file.json#prop` reads the array at that property of a file that holds an object. */
  file: string;
  key: Record<string, string | number | null>;
  /** The numeric field read, or "__row" for 1 per matching row (counting records such as executive orders). */
  field: string;
  /** Read the value negated (a trade balance shown as a deficit). */
  negate?: boolean;
  /** The field holds an array (one value per month, as in duties_by_country): read this element. */
  index?: number;
  /**
   * The cell's value is derived from this cell and another one instead of read as is (a rate computed from an index):
   * the page's own derivations (lib/indicator-derive.ts), spelled out so verify.ts can re-run them from the rows.
   * `pct_change`: (this / from - 1) x 100. `diff`: this - from. `deflate`: this x base / by (earnings in latest-month dollars).
   */
  derive?: { op: "pct_change" | "diff"; from: CellRef } | { op: "deflate"; by: CellRef; base: CellRef };
};

/** A value is the sum of its cells (one cell for most series; several for e.g. encounters, which add components). */
export type Point = { date: string; value: number; cells: CellRef[] };

/** `quarterly` dates are the quarter's first day (FRED's dating), `annual` the calendar year's January 1, `fiscal_year` the September 30 it ends. */
export type Frequency = "weekly" | "monthly" | "quarterly" | "annual" | "fiscal_year";

/** How a series' numbers are written: `prefix + (value * scale).toLocaleString(decimals) + suffix`. */
export type UnitFormat = { scale: number; decimals: number; prefix?: string; suffix: string };

export type Series = {
  id: string;
  dataset: DatasetId;
  /**
   * The chart's title, in plain words a reader would say ("Inflation", "Jobs added each month", "The federal deficit"):
   * never method or a unit's fine print, which go in `note` (printed beside the source). title.ts builds the drawn
   * title from this and enforces the rule; `name` is for the caption's sentence.
   */
  title: string;
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
  /** Unit for an absolute change when it differs from `unit` (a rate in %: its change is in percentage points). */
  changeUnit?: UnitFormat;
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
  /** Data notes printed on the chart beside the source, bottom left ("Nonfarm payrolls · Seasonally adjusted"); captions never repeat them. Never in the title or axis label. */
  note?: string;
  /** Ranking weight: how much a reader cares about this series (1 = default). */
  weight: number;
  /** The dataset's headline series gets a routine `latest` post when nothing notable happened (schedule.ts). */
  headline?: boolean;
  /**
   * Posts only when the news is about it: no data-release drafts (no highs, lows, moves, term comparisons or routine
   * readings), but the news lane can still chart it. Weekly series (gas, diesel, the SPR) and the single electricity
   * sources (a record for solar, then wind, then nuclear would be three posts for one release) are news-only.
   */
  newsOnly?: boolean;
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
  /** The chart's plain title, as `Series.title`: "Executive orders signed". */
  title: string;
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

/** "month_bare" and "day_bare" drop the year ("September", "October 12") when the caption has already said it. */
export type DateStyle = "month" | "day" | "year" | "fiscal_year" | "quarter" | "month_bare" | "day_bare";

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
  /** What the draft says it is about, for the issue and the index: short and factual. */
  headline: string;
  /** The title drawn on the chart and its slides (title.ts chartTitle): plain words, no method; data notes are `note`. */
  title: string;
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
  /** Series.note: printed on the chart after the source. */
  note?: string;
  /** What drove the change, as verified facts (breakdown.ts): each source's or partner's part, for the carousel. */
  breakdown?: Breakdown;
  /** Why the number moved, from named sources (research.ts, or why.ts by hand), for the caption and the carousel. */
  why?: Why;
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
/** One headline from a feed. `source` is the outlet's (or agency's) name, `outletId` its key in news/outlets.ts. */
export type Headline = { title: string; source: string; url: string; published: string; feed: string; outletId?: string };

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

/**
 * A carousel breakdown slide: one or two blocks of rows (each a fact id, so every number is verified), with a total.
 * Row facts are signed changes or levels in the series' unit.
 */
export type Breakdown = {
  title: string;
  blocks: { label: string; rows: { name: string; fact: string }[]; total?: { name: string; fact: string } }[];
  note: string;
};

/**
 * Why a number moved. `captionLine` is one attributed sentence for the post; `paragraphs` expand on it for the carousel
 * (words only, years apart); `sources` are the pages they come from, each on the allowed list and actually read.
 */
export type Why = { title: string; captionLine: string; paragraphs: string[]; sources: { name: string; url: string }[] };
