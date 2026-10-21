import { describe, expect, it, vi } from "vitest";
import { breakdown, linkedCodes, type ChapterUsePayload } from "./trade-chapter-use";
import { productsView } from "./trade-products";
import { enduseView } from "./trade-enduse";

// The data modules are server-only; under vitest they are just file readers.
vi.mock("server-only", () => ({}));
const { getChapterUsePayload, getChapterUseYears } = await import("./trade-chapter-use-data");
const { getProductsPayload } = await import("./trade-products-data");
const { getEndusePayload } = await import("./trade-enduse-data");

const payload: ChapterUsePayload = {
  year: 2025,
  months: 12,
  flows: {
    imports: [
      ["84", "21300", 500],
      ["84", "21301", 200],
      ["85", "21301", 150],
      ["84", "20000", 100],
      ["84", "21180", 60],
      ["84", "30230", 50],
      ["84", "41050", 40],
      ["84", "10000", 30],
      ["84", "12500", 5],
    ],
    exports: [],
  },
  special: { imports: [["98", "21301", 50], ["84", "50040", 3]], exports: [] },
};
const name = (c: string) => `n${c}`;
const whole = (c: string) => ({ "21301": 350, "84": 985 })[c] ?? null;

describe("breakdown", () => {
  it("names the top five, folds the rest into one Other line, and shares each of the line", () => {
    const b = breakdown(payload, "imports", "chapter", "84", name, whole);
    expect(b.count).toBe(8);
    expect(b.parts.map((p) => p.name)).toEqual(["n21300", "n21301", "n20000", "n21180", "n30230", "3 other uses"]);
    const other = b.parts.at(-1)!;
    expect([other.code, other.value, other.folded, other.whole]).toEqual([null, 75, 3, null]);
    expect(b.parts[1]).toMatchObject({ code: "21301", value: 200, whole: 350 });
    expect(b.parts.reduce((a, p) => a + p.share, 0)).toBeCloseTo(1);
  });

  it("keeps an Other of one line under its own name, and folds a part under 1% even inside the top five", () => {
    const none = { exports: [], imports: [] };
    const small: ChapterUsePayload = { ...payload, special: none, flows: { exports: [], imports: [["84", "a", 990], ["84", "b", 5], ["84", "c", 5]] } };
    expect(breakdown(small, "imports", "chapter", "84", name, whole).parts.map((p) => p.name)).toEqual(["na", "2 other uses"]);
    const one: ChapterUsePayload = { ...payload, special: none, flows: { exports: [], imports: [["84", "a", 995], ["84", "b", 5]] } };
    expect(breakdown(one, "imports", "chapter", "84", name, whole).parts.map((p) => p.name)).toEqual(["na", "nb"]);
  });

  it("turns a use around: its chapters, then its special entries, all on the line's own total", () => {
    const b = breakdown(payload, "imports", "use", "21301", name, whole);
    expect(b.total).toBe(400);
    expect(b.parts.map((p) => [p.code, p.value, p.special])).toEqual([["84", 200, false], ["85", 150, false], [null, 50, true]]);
    expect(b.parts.reduce((a, p) => a + p.share, 0)).toBeCloseTo(1);
  });

  it("leaves special entries under 0.5% of the line out of the parts, but in the total", () => {
    const b = breakdown(payload, "imports", "chapter", "84", name, whole);
    expect(b.total).toBe(988);
    expect(b.parts.some((p) => p.special)).toBe(false);
  });
});

describe("linkedCodes", () => {
  it("links a pair worth 1% of either side", () => {
    // 12500 is 0.5% of chapter 84, but all of its own use, so it stays linked.
    expect([...linkedCodes(payload, "imports", "chapter", "84")].sort()).toEqual(["10000", "12500", "20000", "21180", "21300", "21301", "30230", "41050"]);
    expect([...linkedCodes(payload, "imports", "use", "21301")].sort()).toEqual(["84", "85"]);
  });
});

describe("the real chapter x use files", () => {
  const years = getChapterUseYears();

  it("cover every year from 2010, both flows", () => {
    expect(years[0]).toBe(2010);
    for (const y of years) {
      const p = getChapterUsePayload(y)!;
      expect(p.flows.exports.length, String(y)).toBeGreaterThan(100);
      expect(p.flows.imports.length, String(y)).toBeGreaterThan(100);
    }
  });

  it("split every chapter to its published total, and nearly every use within 1.5% of its own", () => {
    const products = getProductsPayload("all")!;
    const enduse = getEndusePayload("all")!;
    let uses = 0;
    let off = 0;
    for (const y of years) {
      const p = getChapterUsePayload(y)!;
      for (const flow of ["exports", "imports"] as const) {
        for (const l of productsView(products, y, flow)!.chapters) {
          const b = breakdown(p, flow, "chapter", l.code, name, () => null);
          expect(b.total, `${y} ${flow} chapter ${l.code}`).toBe(l.value);
          expect(b.parts.length).toBeLessThanOrEqual(7);
        }
        for (const l of enduseView(enduse, y, flow)!.categories) {
          const b = breakdown(p, flow, "use", l.code, name, () => null);
          uses++;
          if (Math.abs(b.total - l.value) / l.value >= 0.015) off++;
          expect(b.parts.length).toBeLessThanOrEqual(7);
        }
      }
    }
    // Census's ten-digit concordance against its own category totals: about 3% of use-years differ by 1.5% or more (the Data notes say so).
    expect(off / uses).toBeLessThan(0.05);
  }, 60_000);
});
