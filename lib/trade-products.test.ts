import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { HS_CHAPTERS } from "./trade-hs-chapters";
import { fmtDollars, fmtPct, lagOf, partnersOf, periodText, productsView, specialNote, type ProductPartnersPayload, type ProductsRow, type ProductsView, type TradeProductsPayload } from "./trade-products";
import { MONTH_NAMES } from "./indicator-time";
import type { TradeByCountryRow } from "./trade-entities";

// The data module is server-only; under vitest it is just a file reader.
vi.mock("server-only", () => ({}));
const { getProductsCodes, getProductsPayload } = await import("./trade-products-data");

const OUT = "pipeline/output";
const read = <T>(file: string) => JSON.parse(readFileSync(`${OUT}/${file}`, "utf8")) as T[];

describe("goods-by-product payloads", () => {
  it("serve every partner file and all countries, chapters only (no top headings)", () => {
    const codes = getProductsCodes();
    expect(codes.length).toBeGreaterThan(200);
    expect(codes).toContain("CHN");
    for (const code of ["all", "CHN", "CAN", "TUV"]) {
      const p = getProductsPayload(code)!;
      expect(p.code).toBe(code === "all" ? null : code);
      for (const r of p.rows) expect(r).not.toHaveProperty("headings");
      expect(p.rows[0]).not.toHaveProperty("country_code");
    }
    expect(getProductsPayload("XXX")).toBeNull();
  });
});

describe("partnersOf", () => {
  const payload: ProductPartnersPayload = {
    names: { CHN: "China", MEX: "Mexico" },
    rows: [
      { year: 2025, months: 12, flow: "imports", chapters: { "85": [["CHN", 60, 50, 5], ["MEX", 30, 0, 0]] } },
      { year: 2025, months: 12, flow: "exports", chapters: { "85": [["MEX", 20]] } },
    ],
  };

  it("names each country, shares its value of the line, and takes a duty rate from imports only", () => {
    expect(partnersOf(payload, 2025, "imports", "85", 100)).toEqual([
      { code: "CHN", name: "China", value: 60, share: 0.6, rate: 0.1 },
      { code: "MEX", name: "Mexico", value: 30, share: 0.3, rate: null },
    ]);
    expect(partnersOf(payload, 2025, "exports", "85", 40)![0]).toEqual({ code: "MEX", name: "Mexico", value: 20, share: 0.5, rate: null });
  });

  it("is null for a year, chapter or flow the payload does not carry", () => {
    expect(partnersOf(payload, 2024, "imports", "85", 100)).toBeNull();
    expect(partnersOf(payload, 2025, "exports", "84", 100)).toBeNull();
  });
});

describe("productsView", () => {
  const china = getProductsPayload("CHN")!;

  it("ranks ordinary chapters only and keeps 98/99 as special entries", () => {
    const v = productsView(china, 2025, "imports")!;
    expect(v.chapters.every((c) => HS_CHAPTERS[c.code].kind === "goods")).toBe(true);
    expect(v.chapters.map((c) => c.value)).toEqual([...v.chapters.map((c) => c.value)].sort((a, b) => b - a));
    expect(v.chapters.reduce((a, c) => a + c.value, 0) + v.specialTotal).toBe(v.total);
    expect(v.special.map((s) => s.code)).toContain("9999");
    expect(v.special.find((s) => s.code === "9999")!.label).toBe("Low-value shipments (estimated)");
  });

  it("uses duties over imports for consumption for the collected rate, never over general imports", () => {
    const row = china.rows.find((r) => r.year === 2025 && r.flow === "imports")! as Extract<ProductsRow, { flow: "imports" }>;
    const v = productsView(china, 2025, "imports")!;
    const t = row.chapters.find((c) => c[0] === "85")!;
    const c = v.chapters.find((x) => x.code === "85")!;
    expect(c.rate).toBe(t[3] / t[2]);
    expect(c.rate).not.toBe(t[3] / t[1]);
    expect(c.value).toBe(t[1]);
    expect(v.rate).toBe(row.duties / row.con_value);
    expect(productsView(china, 2025, "exports")!.chapters.every((x) => x.rate === null)).toBe(true);
  });

  it("returns null for a year with no row and marks the year in progress", () => {
    expect(productsView(china, 2009, "exports")).toBeNull();
    const ytd = productsView(china, 2026, "exports")!;
    expect(ytd.months).toBeLessThan(12);
    expect(periodText(2026, ytd.months, MONTH_NAMES)).toMatch(/^January to \w+ 2026$/);
    expect(periodText(2025, 12, MONTH_NAMES)).toBe("2025");
  });
});

describe("special-entry footnote", () => {
  const label = (code: string) => (code === "9999" ? "Low-value shipments (estimated)" : code === "9801" ? "Returned American goods" : "U.S. government imports");
  const view = (special: [string, number][], specialTotal: number): ProductsView => ({
    year: 2025, months: 12, flow: "imports", total: 1e12, rate: 0.1, chapters: [], specialTotal,
    special: special.map(([code, value]) => ({ code, value, label: label(code) })),
  });

  it("names the two largest and sums the rest", () => {
    expect(specialNote(view([["9999", 8.7e9], ["9801", 4.1e9], ["9808", 1e9]], 13.8e9))).toBe(
      "Plus $13.8B in special entries, not ranked as chapters: low-value shipments (estimated) $8.7B, returned American goods $4.1B, other $1.0B.",
    );
    expect(specialNote(view([["9808", 5e6]], 5e6))).toBe("Plus $5.0M in special entries, not ranked as chapters: U.S. government imports $5.0M.");
    expect(specialNote(view([], 0))).toBeNull();
  });

  it("is built from the real all-countries file", () => {
    const all = getProductsPayload("all") as TradeProductsPayload;
    expect(specialNote(productsView(all, 2025, "imports")!)).toMatch(/^Plus \$1\d\dB in special entries, not ranked as chapters: returned American goods \$\d+B, low-value shipments \(estimated\) \$\d+(\.\d)?B, other/);
  });
});

describe("formatting", () => {
  it("prints whole dollars compactly", () => {
    expect([fmtDollars(2.4152e12), fmtDollars(412e9), fmtDollars(12.34e9), fmtDollars(450e6), fmtDollars(4.5e6), fmtDollars(12_300), fmtDollars(850)]).toEqual([
      "$2.42T", "$412B", "$12.3B", "$450M", "$4.5M", "$12K", "$850",
    ]);
  });
  it("prints shares and rates", () => {
    expect([fmtPct(0), fmtPct(0.0001), fmtPct(0.021), fmtPct(0.25), fmtPct(0.1296), fmtPct(0.0998), fmtPct(0.0994)]).toEqual(["0%", "<0.1%", "2.1%", "25%", "13%", "10%", "9.9%"]);
  });
});

describe("year-in-progress lag behind the goods file", () => {
  it("flags only gaps of 0.5% or more on $1B or more, and never a full year", () => {
    expect(lagOf("CAN", { year: 2026, months: 8, flow: "exports", value: 234_176e6 }, 235_972)).toMatchObject({ code: "CAN", gap: expect.closeTo(-0.0076, 4) });
    expect(lagOf("CAN", { year: 2025, months: 12, flow: "exports", value: 300e9 }, 310_000)).toBeNull();
    expect(lagOf("GRD", { year: 2026, months: 8, flow: "exports", value: 130e6 }, 132)).toBeNull();
    expect(lagOf("MEX", { year: 2026, months: 8, flow: "exports", value: 200_100e6 }, 200_000)).toBeNull();
  });

  it("stays within the transform's 1.5% tolerance wherever it shows", () => {
    const year = Number(read<{ period: string }>("trade_national.json").at(-1)!.period.slice(0, 4));
    const goods = new Map(read<TradeByCountryRow>(`trade_by_country/${year}.json`).map((r) => [r.country_code, r]));
    const lags = getProductsCodes().flatMap((code) => {
      const g = goods.get(code);
      return g ? (getProductsPayload(code)!.rows.filter((r) => r.year === year).flatMap((r) => lagOf(code, r, g[r.flow].reduce<number>((a, x) => a + (x ?? 0), 0)) ?? [])) : [];
    });
    // At the time of writing (2026 through August) this is Canada's exports alone, -0.76%; the Data notes name whichever it is.
    for (const l of lags) expect(Math.abs(l.gap), l.code).toBeLessThan(0.015);
  });
});
