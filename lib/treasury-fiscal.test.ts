import { describe, expect, it } from "vitest";
import { normalizeTreasuryFiscal, quarterEnds, quarterStartOfEnd } from "./treasury-fiscal";

describe("treasury fiscal supplement", () => {
  it("dates a quarter at its first day, the way FRED does", () => {
    expect(quarterStartOfEnd("2026-09-30")).toBe("2026-07-01");
    expect(quarterStartOfEnd("2026-03-31")).toBe("2026-01-01");
    expect(quarterStartOfEnd("2025-12-31")).toBe("2025-10-01");
  });
  it("lists only quarter ends that have passed", () => {
    expect(quarterEnds(2025, "2026-04-15")).toEqual(["2025-03-31", "2025-06-30", "2025-09-30", "2025-12-31", "2026-03-31"]);
    expect(quarterEnds(2026, "2026-06-30")).toEqual(["2026-03-31", "2026-06-30"]);
  });
  it("converts dollars to millions and flips the deficit to FRED's sign", () => {
    const out = normalizeTreasuryFiscal({
      fetched_at: "2026-10-16T00:00:00.000Z",
      debt: [{ quarter_end: "2026-09-30", record_date: "2026-09-30", total: 40_171_825_101_340.31, held: 32_425_012_546_390.57 }],
      deficit: [{ fiscal_year: 2026, record_date: "2026-09-30", deficit: 1_992_473_224_352.42 }],
    });
    expect(out.debt).toEqual([{ date: "2026-07-01", total: 40_171_825, held: 32_425_013 }]);
    expect(out.deficit).toEqual([{ fiscal_year: 2026, value: -1_992_473 }]);
  });
});
