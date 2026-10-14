import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { enforcementRow } from "../../lib/enforcement-entities";
import { z } from "zod";
import {
  findIceBudgetPdf,
  frDocumentNumbers,
  iceSeriesStatus,
  latestBudgetFiscalYear,
  policyCandidates,
  policyWatchConfig,
  wrapsAsOf,
  wrapsListing,
  yearbookDue,
  type FrDoc,
} from "./refresh-lib";

const row = (metric: string, period: number, status: "final" | "preliminary", extra: Record<string, unknown> = {}) => ({
  metric: metric as never,
  period,
  status,
  arresting_agency: null,
  criminality: null,
  ...extra,
});

describe("iceSeriesStatus", () => {
  // 2026-10-13 minus 60 days is mid-August: FY2025 should be locked.
  const status = (rows: ReturnType<typeof row>[], today = "2026-10-13") => Object.fromEntries(iceSeriesStatus(rows as never, today).map((s) => [s.id, s]));

  it("flags a series whose newest final year is behind, and not one that is current", () => {
    const s = status([row("removals", 2025, "final"), row("administrative_arrests", 2024, "final")]);
    expect(s.removals.stale).toBe(false);
    expect(s.administrative_arrests.stale).toBe(true);
    expect(s.administrative_arrests.latestFinal).toBe(2024);
  });

  it("is not stale before the grace period ends", () => {
    const s = status([row("removals", 2024, "final")], "2026-10-13");
    expect(s.removals.stale).toBe(true);
    expect(status([row("removals", 2024, "final")], "2025-10-13").removals.stale).toBe(false);
  });

  it("does not count a preliminary year as locked, but reports it", () => {
    const s = status([row("removals", 2024, "final"), row("removals", 2025, "preliminary")]);
    expect(s.removals.stale).toBe(true);
    expect(s.removals.preliminary).toBe(2025);
  });

  it("tracks agency and criminality splits separately from national removals", () => {
    const s = status([
      row("removals", 2025, "final"),
      row("removals", 2024, "final", { arresting_agency: "ice" }),
      row("removals", 2025, "final", { criminality: "convicted" }),
    ]);
    expect(s.removals.stale).toBe(false);
    expect(s.removals_by_agency.stale).toBe(true);
    expect(s.removals_by_criminality.stale).toBe(false);
  });

  it("skips a discontinued series and flags a missing one", () => {
    const s = status([row("initial_book_ins", 2020, "final")]);
    expect(s.initial_book_ins.stale).toBe(false);
    expect(s.initial_book_ins.skipped).toMatch(/FY2020/);
    expect(s.detainers_issued.stale).toBe(true);
    expect(s.detainers_issued.latestFinal).toBeNull();
  });

  it("covers every metric the committed series carries", () => {
    const rows = z.array(enforcementRow).parse(JSON.parse(readFileSync("pipeline/output/enforcement_series.json", "utf8")));
    const metrics = new Set(rows.map((r) => r.metric));
    for (const m of metrics) expect(iceSeriesStatus([row(m, 2000, "final")] as never, "2026-10-13").some((s) => s.latestFinal === 2000), m).toBe(true);
  });
});

describe("DHS budget overview", () => {
  it("finds the newest budget fiscal year in the source ids", () => {
    expect(latestBudgetFiscalYear(["ice-statistics", "dhs-fy2027-ice-budget", "dhs-fy2026-ice-budget"])).toBe(2027);
    expect(latestBudgetFiscalYear(["ice-statistics"])).toBeNull();
  });
  it("finds the ICE overview link on a CBJ page, and not another component's", () => {
    const page = `<a href="https://www.dhs.gov/sites/default/files/2026-04/26_0403_ocfo_fy27-budget-office-of-inspector-general.pdf">OIG</a>
      <a href="https://www.dhs.gov/sites/default/files/2026-04/26_0403_ocfo_fy27-budget-immigration-and-customs-enforcement.pdf">ICE</a>`;
    expect(findIceBudgetPdf(page)).toMatch(/fy27-budget-immigration-and-customs-enforcement\.pdf$/);
    expect(findIceBudgetPdf("<a href='x'>none</a>")).toBeNull();
  });
});

describe("WRAPS", () => {
  it("reads the as-of date from a file name, encoded or not", () => {
    expect(wrapsAsOf("Refugee Admissions Report as of September 30, 2026.xlsx")).toBe("2026-09-30");
    expect(wrapsAsOf("https://www.wrapsnet.org/documents/Refugee%20Admissions%20Report%20as%20of%20January%205,%202027.xlsx")).toBe("2027-01-05");
    expect(wrapsAsOf("Affiliate Directory as of 13 JUN 2025.xlsx")).toBeNull();
  });
  it("lists the workbooks on the page newest first and ignores other files", () => {
    const html = `<a href="/documents/Affiliate Directory as of 13 JUN 2025.xlsx">x</a>
      <a href="/documents/Refugee Admissions Report as of August 31, 2026.xlsx">a</a>
      <a href="/documents/Refugee Admissions Report as of September 30, 2026.xlsx">b</a>`;
    expect(wrapsListing(html).map((l) => l.asOf)).toEqual(["2026-09-30", "2026-08-31"]);
    expect(wrapsListing("<html></html>")).toEqual([]);
  });
  it("says when the next yearbook is due", () => {
    expect(yearbookDue(2024, "2026-10-13")).toEqual({ fy: 2025, due: true });
    expect(yearbookDue(2024, "2026-08-15")).toEqual({ fy: 2025, due: false });
  });
});

describe("policy watch", () => {
  const doc = (n: string, title: string): FrDoc => ({ document_number: n, title, publication_date: "2026-01-01", presidential_document_number: "1" });
  const cfg = { strong_terms: ["refugee"], title_pattern: "alien|immigra|entry" };

  it("keeps strong hits and title-matched broad hits, drops the known and the unrelated", () => {
    const out = policyCandidates(
      [
        { term: "refugee", docs: [doc("a", "Anything at all"), doc("k", "Known")] },
        { term: "immigration", docs: [doc("b", "Restricting Entry of Aliens"), doc("c", "National Poison Prevention Week")] },
      ],
      cfg,
      new Set(["k"]),
    );
    expect(out.map((d) => d.document_number)).toEqual(["a", "b"]);
  });
  it("lists a document once even when several terms hit it", () => {
    const d = doc("a", "Immigration order");
    expect(policyCandidates([{ term: "refugee", docs: [d] }, { term: "immigration", docs: [d] }], cfg, new Set())).toHaveLength(1);
  });
  it("reads Federal Register numbers off catalog source ids", () => {
    expect(frDocumentNumbers([{ id: "fr-2025-02011", url: "x" }, { id: "app-pd-87-1", url: "y" }])).toEqual(["2025-02011"]);
  });
  it("the committed watch config parses and has no duplicate reviewed documents", () => {
    const cfgFile = policyWatchConfig.parse(JSON.parse(readFileSync("pipeline/reference/immigration-policy-watch.json", "utf8")));
    const nums = cfgFile.reviewed.map((r) => r.document_number);
    expect(new Set(nums).size).toBe(nums.length);
  });
});
