import { findExtremes } from "./chart-extremes";
import { compactNumber } from "./format-number";
import type { CongressSummary, SeriesFormat, SeriesPanel, SeriesPoint } from "./president-types";

/**
 * Number formats and the generated one-line takeaways for the president pages. A takeaway names readings, never causes
 * (ARCHITECTURE_MAP rule 7c): it is built from the very values the chart draws, so it cannot drift from the data.
 */
const MINUS = "−";
const trim = (v: number, dp: number) => v.toFixed(dp).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
const neg = (s: string, v: number) => (v < 0 ? `${MINUS}${s}` : s);

/** The value as a card and its takeaway print it: "7.8%", "−3.1%", "1.1M" (counts follow rule 2g, `compactNumber`), "−$46.7B", "703M bbl". */
export function fmtValue(v: number, f: SeriesFormat): string {
  const a = Math.abs(v);
  switch (f) {
    case "num":
      return neg(trim(a, 1), v);
    case "pct":
      return neg(`${trim(a, 1)}%`, v);
    case "pctSigned":
      return v === 0 ? "0%" : `${v < 0 ? MINUS : "+"}${trim(a, 1)}%`;
    case "count":
      return compactNumber(v);
    case "usdB":
      return neg(`$${trim(a, 1)}B`, v);
    case "mbbl":
      return neg(`${Math.round(a)}M bbl`, v);
  }
}

/** A full-precision value for tooltips and tables ("1,130,818"). */
export function fmtExact(v: number, f: SeriesFormat): string {
  return f === "count" ? neg(Math.round(Math.abs(v)).toLocaleString("en-US"), v) : fmtValue(v, f);
}

/** Axis tick text: shorter than `fmtValue` ("1.2M", "800k", "−10%", "$40B", "700"). */
export function fmtAxis(v: number, f: SeriesFormat): string {
  const a = Math.abs(v);
  switch (f) {
    case "num":
      return neg(trim(a, 1), v);
    case "pct":
    case "pctSigned":
      return neg(`${trim(a, 1)}%`, v);
    case "count":
      return neg(a >= 1_000_000 ? `${trim(a / 1_000_000, 1)}M` : a >= 1000 ? `${trim(a / 1000, 0)}k` : String(a), v);
    case "usdB":
      return neg(`$${trim(a, 0)}B`, v);
    case "mbbl":
      return neg(String(Math.round(a)), v);
  }
}

const LONG: Record<string, string> = { Jan: "January", Feb: "February", Mar: "March", Apr: "April", May: "May", Jun: "June", Jul: "July", Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December" };
/** "Jan 2009" → "January 2009" for prose; other labels unchanged. */
export const longLabel = (label: string) => label.replace(/^([A-Z][a-z]{2}) (\d{4})$/, (_, m: string, y: string) => `${LONG[m] ?? m} ${y}`);

/** The highest and lowest reading among `points` (none for a flat or one-point series). */
export function extremesOf(points: readonly SeriesPoint[]): { peak: SeriesPoint | null; low: SeriesPoint | null } {
  const ex = findExtremes(points.map((p, day) => ({ day, value: p.value, p })));
  return { peak: ex.peak?.p ?? null, low: ex.low?.p ?? null };
}

/** "in January 2009", "in FY2010", "on Jan 17, 2009". */
const when = (label: string) => `${/\d, \d{4}$/.test(label) ? "on" : "in"} ${longLabel(label)}`;

function segmentSentence(points: readonly SeriesPoint[], f: SeriesFormat): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (points.length === 1) return `${fmtValue(first.value, f)} ${when(first.label)}`;
  const base = `${fmtValue(first.value, f)} ${when(first.label)} and ${fmtValue(last.value, f)} ${when(last.label)}`;
  const { peak, low } = extremesOf(points);
  // Name the high (or, for a reading that only fell, the low) when it is not already one of the two ends.
  const inner = [peak, low].find((p) => p !== null && p !== first && p !== last);
  if (!inner) return base;
  return `${base}, with a ${inner === peak ? "high" : "low"} of ${fmtValue(inner.value, f)} ${when(inner.label)}`;
}

/**
 * "The unemployment rate was 7.8% in January 2009 and 4.7% in January 2017, with a high of 10% in October 2009." Two terms
 * read "…; then 4.7% in January 2017 and …". The high (or low) is named only when it is not one of the ends.
 */
export function panelTakeaway(panel: Pick<SeriesPanel, "title" | "format" | "segments">, subject = panel.title.replace(/,.*$/, ""), verb = "was"): string {
  const segs = panel.segments.filter((s) => s.points.length > 0);
  if (segs.length === 1) return `${subject} ${verb} ${segmentSentence(segs[0].points, panel.format)}.`;
  return `${subject} ${verb} ${segs.map((s, i) => `${i === 0 ? "" : "then "}${segmentSentence(s.points, panel.format)}`).join("; ")}.`;
}

const yearsText = (days: number) => {
  const y = days / 365.25;
  return y < 0.95 ? `${Math.max(1, Math.round(days / 30.4))} months` : `${trim(Math.round(y * 2) / 2, 1)} year${Math.round(y * 2) / 2 === 1 ? "" : "s"}`;
};

/** "Democrats held both chambers for 2 years of the term, one chamber for 4 years and neither for 2 years." */
export function congressTakeaway(c: CongressSummary, party: "D" | "R"): string {
  const who = party === "D" ? "Democrats" : "Republicans";
  const parts: string[] = [];
  if (c.days.both) parts.push(`both chambers for ${yearsText(c.days.both)}`);
  if (c.days.one) parts.push(`one chamber for ${yearsText(c.days.one)}`);
  if (c.days.neither) parts.push(`neither for ${yearsText(c.days.neither)}`);
  if (parts.length === 1 && c.days.neither) return `${who} held neither chamber of Congress during the time in office.`;
  if (parts.length === 1 && c.days.both) return `${who} held both chambers of Congress throughout the time in office.`;
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
  return `${who} held ${list}.`;
}

/** "1 year, 9 months" style duration in office. */
export function tenureText(days: number): string {
  const totalMonths = Math.floor(days / 30.4375);
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  const ys = y ? `${y} year${y === 1 ? "" : "s"}` : "";
  const ms = m ? `${m} month${m === 1 ? "" : "s"}` : "";
  return [ys, ms].filter(Boolean).join(", ") || `${days} days`;
}

export const fmtInt = (n: number) => n.toLocaleString("en-US");
