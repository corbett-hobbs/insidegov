import { z } from "zod";
import { expectedFinalFiscalYear, isNationalRemovals, type EnforcementRow } from "../../lib/enforcement-entities";

/**
 * Pure logic for the immigration refresh checks (Session D of docs/IMMIGRATION_EXPANSION_PLAN.md).
 * The scripts next to this file (ice-staleness.ts, refugee-staleness.ts, policy-watch.ts) do the I/O;
 * each prints a markdown report and exits 1 when a human is needed. None of them edits data.
 */

// ---- ICE: every series, not just national removals ----

export interface IceSeriesSpec {
  id: string;
  label: string;
  match: (r: Pick<EnforcementRow, "metric" | "arresting_agency" | "criminality">) => boolean;
  /** Set when ICE no longer prints the series; the check skips it and says why. */
  discontinued?: string;
}

/**
 * The series the Immigration page and the breakdown tables draw on. Each is checked on its own: a new
 * annual report can add the arrest counts and still leave the criminality split a year behind.
 * The "ICE" and "CBP" rows are still ICE's own counts (see ARRESTING_AGENCIES).
 */
export const ICE_SERIES: readonly IceSeriesSpec[] = [
  { id: "removals", label: "Removals (national)", match: isNationalRemovals },
  { id: "removals_by_agency", label: "Removals by arresting agency (ICE / CBP)", match: (r) => r.metric === "removals" && r.arresting_agency !== null && r.criminality === null },
  { id: "removals_by_criminality", label: "Removals by criminal history", match: (r) => r.metric === "removals" && r.criminality !== null },
  { id: "administrative_arrests", label: "Administrative arrests", match: (r) => r.metric === "administrative_arrests" },
  { id: "at_large_arrests", label: "At-large arrests", match: (r) => r.metric === "at_large_arrests" },
  { id: "detainers_issued", label: "Detainers issued", match: (r) => r.metric === "detainers_issued" },
  { id: "detention_adp", label: "Average daily detention population", match: (r) => r.metric === "detention_adp" },
  {
    id: "initial_book_ins",
    label: "Initial book-ins",
    match: (r) => r.metric === "initial_book_ins",
    discontinued: "ICE's reports stopped printing book-ins after FY2020",
  },
];

export interface IceSeriesStatus {
  id: string;
  label: string;
  /** Newest fiscal year carried as `final`, or null. */
  latestFinal: number | null;
  /** A later `preliminary` year (a budget document's actuals), if any. */
  preliminary: number | null;
  expected: number;
  stale: boolean;
  skipped: string | null;
}

/** A series is stale when ICE should have locked `expected` by now (60 days after the year ends) and the output has no final row for it. */
export function iceSeriesStatus(
  rows: readonly Pick<EnforcementRow, "metric" | "arresting_agency" | "criminality" | "period" | "status">[],
  today: string,
): IceSeriesStatus[] {
  const expected = expectedFinalFiscalYear(today);
  return ICE_SERIES.map((s) => {
    const mine = rows.filter(s.match);
    const finals = mine.filter((r) => r.status === "final").map((r) => r.period);
    const latestFinal = finals.length ? Math.max(...finals) : null;
    const prelim = mine.filter((r) => r.status === "preliminary" && (latestFinal === null || r.period > latestFinal)).map((r) => r.period);
    return {
      id: s.id,
      label: s.label,
      latestFinal,
      preliminary: prelim.length ? Math.max(...prelim) : null,
      expected,
      stale: !s.discontinued && (latestFinal === null || latestFinal < expected),
      skipped: s.discontinued ?? null,
    };
  });
}

/** Fiscal year of the newest `dhs-fy<YYYY>-…` budget overview in the ICE catalog's sources. */
export function latestBudgetFiscalYear(sourceIds: readonly string[]): number | null {
  const years = sourceIds.map((id) => id.match(/^dhs-fy(\d{4})-/)?.[1]).filter((y): y is string => !!y).map(Number);
  return years.length ? Math.max(...years) : null;
}

/** DHS's per-fiscal-year Congressional Budget Justification page, which links each component's overview PDF. */
export const dhsBudgetPageUrl = (fy: number): string => `https://www.dhs.gov/publication/congressional-budget-justification-fiscal-year-fy-${fy}`;

/** The ICE budget overview PDF linked from a DHS CBJ page, or null when the page has none. */
export function findIceBudgetPdf(html: string): string | null {
  const m = html.match(/href="([^"]*immigration-and-customs-enforcement\.pdf)"/i);
  return m ? m[1] : null;
}

// ---- WRAPS / OHSS ----

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** "Refugee Admissions Report as of September 30, 2026.xlsx" -> "2026-09-30" (also URL-encoded names). */
export function wrapsAsOf(name: string): string | null {
  const m = decodeURIComponent(name).match(/Refugee Admissions Report as of (\w+) (\d{1,2}),? (\d{4})/i);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase());
  if (month < 0) return null;
  return `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

/** Every admissions-report workbook linked from the Refugee Processing Center's "Admissions & Arrivals" page, newest first. */
export function wrapsListing(html: string): { href: string; asOf: string }[] {
  const out: { href: string; asOf: string }[] = [];
  for (const m of html.matchAll(/href="([^"]*Refugee(?:%20| )Admissions(?:%20| )Report[^"]*\.xlsx)"/gi)) {
    const asOf = wrapsAsOf(m[1]);
    if (asOf && !out.some((o) => o.asOf === asOf)) out.push({ href: m[1], asOf });
  }
  return out.sort((a, b) => b.asOf.localeCompare(a.asOf));
}

/** "ohss-yearbook-refugees-fy2024" -> 2024. */
export function yearbookFiscalYear(sourceId: string): number | null {
  const m = sourceId.match(/^ohss-yearbook-refugees-fy(\d{4})$/);
  return m ? Number(m[1]) : null;
}

/** OHSS posted FY2024's refugee yearbook in August 2025, so the next edition is due once September of the following year starts. */
export function yearbookDue(catalogFy: number, today: string): { fy: number; due: boolean } {
  const fy = catalogFy + 1;
  return { fy, due: today >= `${fy + 1}-09-01` };
}

// ---- Federal Register policy watch ----

export const policyWatchConfig = z.strictObject({
  /** Only presidential documents published on or after this date are searched. */
  since: z.iso.date(),
  /** Full-text searches whose every hit is a candidate (specific phrases). */
  strong_terms: z.array(z.string().min(1)).min(1),
  /** Broader searches whose hits are candidates only when the title matches `title_pattern`. */
  broad_terms: z.array(z.string().min(1)),
  title_pattern: z.string().min(1),
  /** Documents read and deliberately left out of the policy table. */
  reviewed: z.array(z.strictObject({ document_number: z.string().min(1), reason: z.string().min(1) })),
});
export type PolicyWatchConfig = z.infer<typeof policyWatchConfig>;

export interface FrDoc {
  document_number: string;
  title: string;
  publication_date: string;
  presidential_document_number: string | null;
  html_url?: string | null;
}

/**
 * Candidates for the review issue: documents a strong term hit, or a broad term hit with a matching title,
 * minus everything already accounted for (`known`: the refugee catalog's sources and reviewed list, the
 * Federal Register index the refugee gate already covers, and this config's reviewed list).
 */
export function policyCandidates(
  hits: readonly { term: string; docs: readonly FrDoc[] }[],
  config: Pick<PolicyWatchConfig, "strong_terms" | "title_pattern">,
  known: ReadonlySet<string>,
): FrDoc[] {
  const title = new RegExp(config.title_pattern, "i");
  const out = new Map<string, FrDoc>();
  for (const { term, docs } of hits) {
    const strong = config.strong_terms.includes(term);
    for (const d of docs) {
      if (known.has(d.document_number)) continue;
      if (strong || title.test(d.title)) out.set(d.document_number, d);
    }
  }
  return [...out.values()].sort((a, b) => a.publication_date.localeCompare(b.publication_date) || a.document_number.localeCompare(b.document_number));
}

/** Federal Register document numbers in a catalog's source list (ids `fr-2025-02011`, urls `…/2025-02011.htm`). */
export function frDocumentNumbers(sources: readonly { id: string; url: string }[]): string[] {
  return sources.flatMap((s) => {
    const m = s.id.match(/^fr-(\d{2,4}-\d+)$/);
    return m ? [m[1]] : [];
  });
}

/** One markdown report shared by the three checks: a heading, what is stale, and (optionally) what could not be checked. */
export function renderReport(title: string, lines: readonly string[], unchecked: readonly string[] = []): string {
  const parts = [`${title}`, "", ...lines];
  if (unchecked.length) parts.push("", "**Could not check** (network or layout problem, not a finding):", ...unchecked.map((u) => `- ${u}`));
  return parts.join("\n") + "\n";
}
