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
  source: string;
  /** Ranking weight: how much a reader cares about this series (1 = default). */
  weight: number;
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
    }
  | {
      type: "bars";
      unit: UnitFormat | null;
      axisLabel: string;
      bars: { label: string; value: number; emphasis: boolean }[];
      /** Horizontal bars read better for long labels (administrations); vertical for years. */
      orientation: "horizontal" | "vertical";
    };

export type InsightKind = "extreme_high" | "extreme_low" | "move_up" | "move_down" | "term_comparison";

export type Insight = {
  id: string;
  dataset: DatasetId;
  seriesId: string;
  kind: InsightKind;
  /** The period the insight is about (the newest observation it rests on), YYYY-MM-DD. */
  period: string;
  /** Chart headline, short and factual. */
  headline: string;
  /** Deterministic caption built only from `facts`; used when no API key is set and as the model's reference. */
  template: string;
  facts: Fact[];
  /** Context the caption writer may use as words, not numbers (series definition, caveats). */
  context: string[];
  chart: ChartSpec;
  /** Canonical page path on the site, e.g. "/presidency/energy". */
  url: string;
  source: string;
  /** Higher is more notable; used to rank and pick drafts. */
  score: number;
  /** Alt text for the chart image. */
  alt: string;
};
