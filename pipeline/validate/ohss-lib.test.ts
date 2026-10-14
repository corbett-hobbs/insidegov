import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lprCatalog } from "../../lib/lpr-entities";
import {
  compareQuarterly,
  compareYearbookEdition,
  latestYearbookFiscalYear,
  quarterlyFileFiscalYear,
  quarterlyFiscalYear,
  workbookLinks,
  yearbookWorkbooks,
} from "./ohss-lib";

const src = [
  { id: "ohss-quarterly-fy2024", url: "https://ohss.dhs.gov/sites/default/files/2025-06/2025_0624_ohss_legal-immigration-adjustment-of-status-fy-2024q4_0.xlsx" },
  { id: "ohss-quarterly-fy2025", url: "https://ohss.dhs.gov/system/files/2026-06/2026_0604_ohss_legal-immigration-adjustment-of-status-fy-2025q4.xlsx" },
  { id: "ohss-yearbook-2024-lpr", url: "https://ohss.dhs.gov/system/files/2026-06/2026_0604_ohss_yearbook_lawful_permanent_residents_fy2024.xlsx" },
  { id: "ohss-yearbook-2024-naturalizations", url: "https://ohss.dhs.gov/system/files/2026-06/2026_0604_ohss_yearbook_naturalizations_fy2024.xlsx" },
  { id: "ohss-yearbook-2022-lpr", url: "https://ohss.dhs.gov/sites/default/files/2023-12/2023_0818_plcy_yearbook_lawful_permanent_residents_fy2022_0.xlsx" },
];
const page = (hrefs: string[]) => hrefs.map((h) => `<a href="${h}">x</a>`).join("\n");

describe("workbookLinks", () => {
  it("makes links absolute, keeps each once, and ignores PDFs", () => {
    expect(workbookLinks(page(["/a/b.xlsx", "/a/b.xlsx", "/c.pdf", "https://ohss.dhs.gov/d.zip"]))).toEqual(["https://ohss.dhs.gov/a/b.xlsx", "https://ohss.dhs.gov/d.zip"]);
  });
});

describe("quarterly names", () => {
  it("reads the fiscal year from every spelling OHSS has used", () => {
    expect(quarterlyFileFiscalYear("https://x/y/2026_0604_ohss_legal-immigration-adjustment-of-status-fy-2025q4.xlsx")).toBe(2025);
    expect(quarterlyFileFiscalYear("https://x/y/fy2019_q4_d_final.xlsx")).toBe(2019);
    expect(quarterlyFileFiscalYear("https://x/y/fy_2020_q4_d_final_v2.pdf.xlsx")).toBe(2020);
    expect(quarterlyFiscalYear("ohss-quarterly-fy2025")).toBe(2025);
    expect(quarterlyFiscalYear("ohss-yearbook-2024-lpr")).toBeNull();
  });
});

describe("compareQuarterly", () => {
  const listed = src.filter((s) => s.id.includes("quarterly")).map((s) => s.url);
  it("is quiet when the page lists exactly the catalog's files", () => {
    expect(compareQuarterly(listed, src)).toEqual({ findings: [], unlisted: [] });
  });
  it("flags a new fiscal year", () => {
    const r = compareQuarterly([...listed, "https://ohss.dhs.gov/system/files/2027-06/2027_0601_ohss_legal-immigration-adjustment-of-status-fy-2026q4.xlsx"], src);
    expect(r.findings).toMatchObject([{ kind: "new_year", fy: 2026 }]);
  });
  it("flags a repost of a year the catalog has", () => {
    const r = compareQuarterly([listed[0], "https://ohss.dhs.gov/system/files/2026-09/2026_0901_ohss_legal-immigration-adjustment-of-status-fy-2025q4_v2.xlsx"], src);
    expect(r.findings).toMatchObject([{ kind: "replaced_file", fy: 2025, replaces: "ohss-quarterly-fy2025" }]);
  });
  it("reports a catalog file the page no longer lists", () => {
    expect(compareQuarterly([listed[0]], src).unlisted).toEqual(["ohss-quarterly-fy2025"]);
  });
});

describe("yearbook", () => {
  const html = page([
    "/system/files/2025-08/2025_0812_ohss_yearbook_refugees_fy2024.xlsx",
    "/system/files/2026-06/2026_0604_ohss_yearbook_lawful_permanent_residents_fy2024.xlsx",
    "/system/files/2026-06/2026_0604_ohss_yearbook_naturalizations_fy2024.xlsx",
  ]);
  it("picks the LPR and naturalization workbooks and ignores the other topics", () => {
    const w = yearbookWorkbooks(html);
    expect(w.lpr).toMatch(/lawful_permanent_residents_fy2024/);
    expect(w.naturalizations).toMatch(/naturalizations_fy2024/);
    expect(yearbookWorkbooks(page(["/x/refugees.xlsx"]))).toEqual({ lpr: null, naturalizations: null });
  });
  it("finds the newest catalogued edition", () => {
    expect(latestYearbookFiscalYear(src)).toBe(2024);
  });
  it("is quiet when the edition page matches, and flags a repost", () => {
    expect(compareYearbookEdition(2024, yearbookWorkbooks(html), src)).toEqual([]);
    const reposted = yearbookWorkbooks(page(["/system/files/2026-09/2026_0901_ohss_yearbook_lawful_permanent_residents_fy2024.xlsx"]));
    expect(compareYearbookEdition(2024, reposted, src)).toMatchObject([{ kind: "replaced_file", topic: "lpr", replaces: "ohss-yearbook-2024-lpr" }]);
  });
  it("the committed catalog has a quarterly source for each year it lists and a newest yearbook", () => {
    const c = lprCatalog.parse(JSON.parse(readFileSync("pipeline/reference/lpr-catalog.json", "utf8")));
    expect(latestYearbookFiscalYear(c.sources)).not.toBeNull();
    expect(c.sources.some((s) => quarterlyFiscalYear(s.id) !== null)).toBe(true);
  });
});
