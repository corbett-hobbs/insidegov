/**
 * Pure logic for the OHSS (DHS Office of Homeland Security Statistics) refresh check, the green-card/naturalization
 * part of Session K. OHSS posts every edition at a new address and its page dates are unreliable
 * (docs/IMMIGRATION_SOURCE_NOTES.md §8), so the check compares the files a page *lists* with the catalog's sources
 * and never trusts a "last updated" line. The script is `ohss-staleness.ts`.
 */

export const OHSS_ORIGIN = "https://ohss.dhs.gov";
export const QUARTERLY_PAGE = `${OHSS_ORIGIN}/topics/immigration/legal-immigration-and-adjustment-status-report`;
export const yearbookPageUrl = (fy: number): string => `${OHSS_ORIGIN}/topics/immigration/yearbook/${fy}`;

/** Every .xlsx / .xls / .zip link on a page, as absolute URLs, each once, in page order. Hrefs are kept exactly as written. */
export function workbookLinks(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/href="([^"]+\.(?:xlsx|xls|zip))"/gi)) {
    const url = new URL(m[1], OHSS_ORIGIN).href;
    if (!out.includes(url)) out.push(url);
  }
  return out;
}

/** The path of a URL, which is what identifies a file: catalogs and pages may differ in host spelling only. */
export const pathOf = (url: string): string => new URL(url).pathname;

export interface CatalogSource {
  id: string;
  url: string;
}

/** "ohss-quarterly-fy2025" -> 2025. */
export function quarterlyFiscalYear(sourceId: string): number | null {
  const m = sourceId.match(/^ohss-quarterly-fy(\d{4})$/);
  return m ? Number(m[1]) : null;
}

/** Fiscal year in a quarterly report's file name: "...fy-2025q4.xlsx", "fy2019_q4_d_final.xlsx", "fy_2020_q4...". */
export function quarterlyFileFiscalYear(url: string): number | null {
  const m = pathOf(url).match(/fy[-_]?(\d{4})/i);
  return m ? Number(m[1]) : null;
}

export interface QuarterlyFinding {
  kind: "new_year" | "replaced_file";
  url: string;
  fy: number | null;
  /** The catalog source a replaced file would supersede. */
  replaces?: string;
}

/**
 * Files on the quarterly report page that no catalog source points to. A file for a fiscal year the catalog has no
 * source for is a new quarter/year; one for a year it does have is a replacement (OHSS reposted or restated it).
 * Catalog sources the page no longer lists are returned too, since a dropped file means the page changed.
 */
export function compareQuarterly(
  pageLinks: readonly string[],
  sources: readonly CatalogSource[],
): { findings: QuarterlyFinding[]; unlisted: string[] } {
  const quarterly = sources.filter((s) => quarterlyFiscalYear(s.id) !== null);
  const known = new Set(quarterly.map((s) => pathOf(s.url)));
  const byYear = new Map(quarterly.map((s) => [quarterlyFiscalYear(s.id)!, s.id]));
  const listed = new Set(pageLinks.map(pathOf));
  const findings = pageLinks
    .filter((u) => !known.has(pathOf(u)))
    .map((url): QuarterlyFinding => {
      const fy = quarterlyFileFiscalYear(url);
      const replaces = fy !== null ? byYear.get(fy) : undefined;
      return replaces ? { kind: "replaced_file", url, fy, replaces } : { kind: "new_year", url, fy };
    });
  return { findings, unlisted: quarterly.filter((s) => !listed.has(pathOf(s.url))).map((s) => s.id) };
}

/** "ohss-yearbook-2024-lpr" -> { fy: 2024, topic: "lpr" } (zip editions before FY2022 are included). */
export function yearbookSource(sourceId: string): { fy: number; topic: "lpr" | "naturalizations" } | null {
  const m = sourceId.match(/^ohss-yearbook-(\d{4})-(lpr|naturalizations)$/);
  return m ? { fy: Number(m[1]), topic: m[2] as "lpr" | "naturalizations" } : null;
}

/** Newest Yearbook edition the catalog carries. */
export function latestYearbookFiscalYear(sources: readonly CatalogSource[]): number | null {
  const years = sources.map((s) => yearbookSource(s.id)?.fy).filter((y): y is number => y !== undefined);
  return years.length ? Math.max(...years) : null;
}

/** The LPR and naturalization workbooks a Yearbook edition page links (other topics' files are ignored). */
export function yearbookWorkbooks(html: string): { lpr: string | null; naturalizations: string | null } {
  const links = workbookLinks(html);
  const find = (re: RegExp) => links.find((l) => re.test(pathOf(l))) ?? null;
  return { lpr: find(/lawful[_-]permanent[_-]residents/i), naturalizations: find(/naturalizations/i) };
}

export interface YearbookFinding {
  kind: "new_edition" | "replaced_file" | "edition_page_missing_file";
  fy: number;
  topic?: "lpr" | "naturalizations";
  url?: string;
  replaces?: string;
}

/** What the newest catalogued edition's own page lists now, against the catalog: a different address means OHSS reposted it. */
export function compareYearbookEdition(
  fy: number,
  workbooks: { lpr: string | null; naturalizations: string | null },
  sources: readonly CatalogSource[],
): YearbookFinding[] {
  const out: YearbookFinding[] = [];
  for (const topic of ["lpr", "naturalizations"] as const) {
    const source = sources.find((s) => {
      const y = yearbookSource(s.id);
      return y?.fy === fy && y.topic === topic;
    });
    const listed = workbooks[topic];
    if (!source || !listed) continue;
    if (pathOf(listed) !== pathOf(source.url)) out.push({ kind: "replaced_file", fy, topic, url: listed, replaces: source.id });
  }
  return out;
}
