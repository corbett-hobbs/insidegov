import { describe, expect, it, vi } from "vitest";
import { endusePartnersOf, enduseView, type EndusePartnersPayload, type TradeEndusePayload } from "./trade-enduse";
import { specialNote } from "./trade-products";

// The data module is server-only; under vitest it is just a file reader.
vi.mock("server-only", () => ({}));
const { getEnduseCodes, getEndusePayload, getEndusePartnerRows } = await import("./trade-enduse-data");

describe("goods-by-use payloads", () => {
  it("serve every partner file and all countries, and every ranked category has a name", () => {
    const codes = getEnduseCodes();
    expect(codes.length).toBeGreaterThan(200);
    for (const code of ["all", "CHN", "CAN", "TUV"]) {
      const p = getEndusePayload(code)!;
      expect(p.code).toBe(code === "all" ? null : code);
      expect(p.rows[0]).not.toHaveProperty("country_code");
      for (const r of p.rows) {
        const v = enduseView(p, r.year, r.flow)!;
        for (const c of v.categories) expect(c.name, `${code} ${r.flow} ${c.code}`).not.toMatch(/^Category /);
        for (const s of v.special) expect(s.label, `${code} ${r.flow} ${s.code}`).not.toMatch(/^Special entry /);
        // Ranked plus special entries make the partner's total, to the dollar.
        expect(v.categories.reduce((a, c) => a + c.value, 0) + v.specialTotal).toBe(v.total);
      }
    }
    expect(getEndusePayload("XXX")).toBeNull();
    expect(getEndusePartnerRows().length).toBeGreaterThan(0);
  });
});

describe("enduseView", () => {
  const payload: TradeEndusePayload = {
    code: null,
    rows: [
      {
        year: 2025,
        months: 12,
        flow: "imports",
        value: 1000,
        con_value: 900,
        duties: 90,
        categories: [["41050", 300, 300, 30], ["21300", 500, 400, 0], ["21320", 0, 0, 0]],
        special: [["50030", 50, 50, 0], ["50020", 150, 150, 60]],
      },
    ],
  };

  it("ranks the categories largest first, skips empty ones and keeps special entries out of the ranking", () => {
    const v = enduseView(payload, 2025, "imports")!;
    expect(v.categories.map((c) => [c.code, c.name, c.share, c.rate])).toEqual([
      ["21300", "Computers", 0.5, 0],
      ["41050", "Cell phones & household goods", 0.3, 0.1],
    ]);
    expect(v.rate).toBe(0.1);
    expect(v.special.map((s) => s.code)).toEqual(["50020", "50030"]);
    expect(v.specialTotal).toBe(200);
    expect(specialNote(v, "uses")).toBe("Plus $200 in special entries, not ranked as uses: U.S. goods returned & reimports $150, minimum-value shipments $50.");
    expect(enduseView(payload, 2025, "exports")).toBeNull();
  });

  it("reads a code with its own flow's name", () => {
    const both: TradeEndusePayload = { code: "BRA", rows: [{ year: 2025, months: 12, flow: "exports", value: 10, categories: [["00000", 10]], special: [] }] };
    expect(enduseView(both, 2025, "exports")!.categories[0].name).toBe("Wheat"); // green coffee on imports
  });
});

describe("endusePartnersOf", () => {
  const payload: EndusePartnersPayload = {
    names: { CHN: "China", MEX: "Mexico" },
    rows: [{ year: 2025, months: 12, flow: "imports", categories: { "21300": [["MEX", 60, 50, 5], ["CHN", 30, 0, 0]] } }],
  };

  it("names each country, shares its value of the line, and takes a duty rate from imports", () => {
    expect(endusePartnersOf(payload, 2025, "imports", "21300", 100)).toEqual([
      { code: "MEX", name: "Mexico", value: 60, share: 0.6, rate: 0.1 },
      { code: "CHN", name: "China", value: 30, share: 0.3, rate: null },
    ]);
    expect(endusePartnersOf(payload, 2025, "imports", "99999", 100)).toBeNull();
    expect(endusePartnersOf(payload, 2024, "imports", "21300", 100)).toBeNull();
  });
});
