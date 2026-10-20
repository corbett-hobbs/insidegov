import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isSpecialEnduse } from "../../lib/trade-enduse-labels";
import { tradeEnduseNationalRow, type TradeEnduseNationalRow } from "../../lib/trade-enduse-entities";
import { tradeProductUseRow, type TradeProductUseRow } from "../../lib/trade-product-use-entities";
import { tradeProductsNationalRow, type TradeProductsNationalRow } from "../../lib/trade-products-entities";
import { TradeDataError } from "../../lib/trade-entities";
import {
  EXPORT_CHAPTER_98_USE,
  FLOWS,
  IMPORT_RESIDUAL_USE,
  PRODUCTUSE_RAW_DIR,
  joinHs10,
  parseRawProductUse,
  serializeRawProductUse,
  type RawProductUse,
} from "../fetch/census-productuse-lib";
import { PRODUCT_USE_TOL, buildProductUse, validateProductUse } from "./trade-productuse";

const OUT = "pipeline/output";
const readRows = (f: string) => JSON.parse(readFileSync(`${OUT}/${f}`, "utf8")) as unknown[];
const raws = FLOWS.flatMap((flow) =>
  readdirSync(`${PRODUCTUSE_RAW_DIR}/${flow}`)
    .filter((f) => /^\d{4}\.json$/.test(f))
    .map((f) => parseRawProductUse(JSON.parse(readFileSync(`${PRODUCTUSE_RAW_DIR}/${flow}/${f}`, "utf8")))),
);
const outRows = readdirSync(`${OUT}/trade_product_use`)
  .sort()
  .flatMap((f) => readRows(`trade_product_use/${f}`).map((r) => tradeProductUseRow.parse(r)));
const productsNational = readRows("trade_products_national.json").map((r) => tradeProductsNationalRow.parse(r));
const enduseNational = readRows("trade_enduse_national.json").map((r) => tradeEnduseNationalRow.parse(r));


describe("joinHs10", () => {
  const own = { year: 2018, map: new Map([["0101000001", "10000"], ["0101000002", "10000"], ["0202000001", "20000"]]) };
  const next = { year: 2019, map: new Map([["0303000001", "30000"]]) };
  const prev = { year: 2017, map: new Map([["0404000001", "40000"], ["0303000001", "99999"]]) };

  it("sums HS10 lines to (HS4, end use), skipping zero lines", () => {
    const j = joinHs10("exports", 2018, [["0101000001", 5], ["0101000002", 7], ["0202000001", 3], ["0202000009", 0]], [own]);
    expect(j.rows).toEqual([["0101", "10000", 12], ["0202", "20000", 3]]);
    expect(j.unmatched).toEqual([]);
    expect(j.assigned).toEqual([]);
  });

  it("falls back to the next year's concordance, then the previous year's, and records where each line came from", () => {
    const j = joinHs10("exports", 2018, [["0303000001", 4], ["0404000001", 6]], [own, next, prev]);
    expect(j.rows).toEqual([["0303", "30000", 4], ["0404", "40000", 6]]); // the next year's answer wins over the previous year's
    expect(j.assigned).toEqual([["0303000001", "30000", "2019", 4], ["0404000001", "40000", "2017", 6]]);
  });

  it("maps the chapter-98 export codes that Schedule B lacks, and only when no concordance has them", () => {
    const lines = [["9880002000", 50], ["9880006000", 3], ["9870003000", 1]] as const;
    const j = joinHs10("exports", 2025, lines, [own]);
    expect(j.rows).toEqual([["9870", "60010", 1], ["9880", "60000", 50], ["9880", "60040", 3]]);
    expect(j.assigned.every((a) => a[2] === "map")).toBe(true);
    const listed = { year: 2025, map: new Map([["9880006000", "60040"], ["9880002000", "12345"]]) };
    expect(joinHs10("exports", 2025, lines, [listed]).rows).toContainEqual(["9880", "12345", 50]);
    // The map is for exports; the same code on the import side is simply unmatched.
    expect(joinHs10("imports", 2025, [["9880002000", 5, 5, 0]], [own]).unmatched).toEqual([["9880002000", 5, 5, 0]]);
  });

  it("uses the hand-mapped import lines for their year only", () => {
    expect(IMPORT_RESIDUAL_USE["2017|9403200022"]).toBe("41000");
    expect(joinHs10("imports", 2017, [["9403200022", 10, 9, 1]], [own]).rows).toEqual([["9403", "41000", 10, 9, 1]]);
    expect(joinHs10("imports", 2018, [["9403200022", 10, 9, 1]], [own]).unmatched).toHaveLength(1);
  });

  it("returns lines with no match instead of dropping them", () => {
    const j = joinHs10("imports", 2018, [["0505000001", 8, 7, 1], ["0101000001", 2, 2, 0]], [own, next, prev]);
    expect(j.unmatched).toEqual([["0505000001", 8, 7, 1]]);
    expect(j.rows).toEqual([["0101", "10000", 2, 2, 0]]);
  });

  it("keeps every hand-mapped export code pointing at a special end use", () => {
    for (const use of Object.values(EXPORT_CHAPTER_98_USE)) expect(isSpecialEnduse("exports", use)).toBe(true);
  });
});

describe("raw files", () => {
  it("round-trips through the serializer", () => {
    const raw: RawProductUse = {
      fetched_at: "t",
      flow: "imports",
      year: 2024,
      through_month: 12,
      rows: [["8517", "21320", 5, 4, 3]],
      assigned: [["8517000001", "21320", "2025", 5]],
      unmatched: [["8517000002", 1, 1, 0]],
    };
    expect(parseRawProductUse(JSON.parse(serializeRawProductUse(raw)))).toEqual(raw);
    expect(parseRawProductUse(JSON.parse(serializeRawProductUse({ ...raw, rows: [], assigned: [], unmatched: [] }))).rows).toEqual([]);
  });

  it("rejects a row of the wrong width for its flow", () => {
    const base = { fetched_at: "t", flow: "exports", year: 2024, through_month: 12, assigned: [], unmatched: [] };
    expect(() => parseRawProductUse({ ...base, rows: [["8517", "21320", 5, 4, 3]] })).toThrow();
    expect(() => parseRawProductUse({ ...base, rows: [], unmatched: [["8517000002", 1, 1, 0]] })).toThrow();
  });

  it("has no unmatched lines in any committed file", () => {
    for (const r of raws) expect(r.unmatched, `${r.flow} ${r.year}`).toEqual([]);
  });
});

describe("buildProductUse", () => {
  const raw = (flow: "exports" | "imports", year: number, rows: RawProductUse["rows"], extra: Partial<RawProductUse> = {}): RawProductUse => ({
    fetched_at: "t",
    flow,
    year,
    through_month: 12,
    rows,
    assigned: [],
    unmatched: [],
    ...extra,
  });

  it("flags a special end use or a chapter 98/99 heading, keeps both in the totals, and orders by heading then value", () => {
    const b = buildProductUse([
      raw("exports", 2024, [["8517", "21320", 10], ["8517", "21300", 30], ["2710", "22090", 5], ["8517", "60000", 2], ["9880", "60000", 50], ["9801", "21320", 1]]),
      raw("imports", 2024, [["3706", "50040", 4, 3, 0], ["9801", "50020", 7, 7, 0], ["8517", "21300", 9, 8, 1]]),
    ]);
    const e = b.rows[0];
    expect(e.flow === "exports" && e.rows).toEqual([["2710", "22090", 5], ["8517", "21300", 30], ["8517", "21320", 10]]);
    expect(e.special).toEqual([["8517", "60000", 2], ["9801", "21320", 1], ["9880", "60000", 50]]);
    expect(e.value).toBe(98);
    const i = b.rows[1];
    expect(i.flow === "imports" && [i.value, i.con_value, i.duties]).toEqual([20, 18, 1]);
    expect(i.special.map((t) => t[0])).toEqual(["3706", "9801"]); // heading 3706 is a real chapter, but its use is a special entry
    expect(b.assigned.find((a) => a.flow === "imports")).toMatchObject({ adjacent: 0, mapped: 0 });
  });

  it("fails on a line with no concordance match, naming the code", () => {
    const bad = raw("exports", 2024, [["8517", "21300", 1]], { unmatched: [["8517123456", 5]] });
    expect(() => buildProductUse([bad])).toThrow(TradeDataError);
    expect(() => buildProductUse([bad])).toThrow(/8517123456/);
  });

  it("fails on an end use that has no label, on a duplicate pair, and on a year that differs between flows", () => {
    expect(() => buildProductUse([raw("exports", 2024, [["8517", "99999", 1]])])).toThrow(/99999/);
    expect(() => buildProductUse([raw("exports", 2024, [["8517", "21300", 1], ["8517", "21300", 2]])])).toThrow(/duplicate/);
    expect(() => buildProductUse([raw("exports", 2024, [["8517", "21300", 1]]), raw("imports", 2024, [["8517", "21300", 1, 1, 0]], { through_month: 8 })])).toThrow(/months/);
  });
});

describe("committed output", () => {
  it("is exactly what the committed raw files build", () => {
    const rebuilt = buildProductUse(raws).rows.map((r) => tradeProductUseRow.parse(r));
    expect(rebuilt).toEqual(outRows);
  });

  it("covers 2010 on, exports then imports, one file per year", () => {
    const files = readdirSync(`${OUT}/trade_product_use`).sort();
    expect(files[0]).toBe("2010.json");
    expect(files).toEqual(Array.from({ length: files.length }, (_, i) => `${2010 + i}.json`));
    for (const f of files) {
      const rows = readRows(`trade_product_use/${f}`).map((r) => tradeProductUseRow.parse(r));
      expect(rows.map((r) => r.flow), f).toEqual(["exports", "imports"]);
      expect(new Set(rows.map((r) => r.year)).size, f).toBe(1);
      expect(`${rows[0].year}.json`).toBe(f);
    }
  });

  it("flags exactly the special end uses and chapter 98/99 headings, in both lists' order", () => {
    for (const r of outRows) {
      for (const t of r.rows) {
        expect(isSpecialEnduse(r.flow, t[1]) || /^9[89]/.test(t[0]), `${r.year} ${r.flow} ${t[0]} ${t[1]} ranked but special`).toBe(false);
      }
      for (const t of r.special) {
        expect(isSpecialEnduse(r.flow, t[1]) || /^9[89]/.test(t[0]), `${r.year} ${r.flow} ${t[0]} ${t[1]} special`).toBe(true);
      }
      for (const list of [r.rows, r.special] as { 0: string; 1: string; 2: number }[][]) {
        for (let i = 1; i < list.length; i++) {
          const [a, b] = [list[i - 1], list[i]];
          expect(a[0] < b[0] || (a[0] === b[0] && a[2] >= b[2]), `${r.year} ${r.flow}: ${a[0]} ${a[1]} before ${b[0]} ${b[1]}`).toBe(true);
        }
      }
    }
  });

  it("reconciles to the national files: chapters, headings and the grand total to the dollar, end uses within the measured tolerance", () => {
    const v = validateProductUse({ build: buildProductUse(raws), productsNational, enduseNational });
    expect(v.checked.yearFlows).toBe(outRows.length);
    expect(v.worstTotal?.gap).toBe(0);
    expect(v.worstChapter?.gap).toBe(0);
    expect(v.worstHeading?.gap).toBe(0);
    // The one place the classifications drift (end use changed during the year): bounded, and the measured worst is recorded.
    expect(v.worstMoved!.share).toBeLessThan(PRODUCT_USE_TOL.useMovedShare);
    expect(v.worstMoved!.share).toBeGreaterThan(0.002); // 2010 imports, 0.25%: if this stops being the worst, update the docs
  });

  it("fails validation on a wrong chapter, heading, total or end use, and on a different month count", () => {
    const build = buildProductUse(raws);
    const bump = <T extends { year: number; flow: string }>(rows: T[], f: (r: T) => T) => rows.map((r) => (r.year === 2025 && r.flow === "exports" ? f(r) : r));
    const chapter = bump(productsNational, (r) => ({ ...r, chapters: r.chapters.map((c, i) => (i === 0 ? ([c[0], (c[1] as number) + 5] as typeof c) : c)) }) as TradeProductsNationalRow);
    expect(() => validateProductUse({ build, productsNational: chapter, enduseNational })).toThrow(/chapter/);
    const heading = bump(productsNational, (r) => ({ ...r, headings: r.headings.map((c, i) => (i === 0 ? ([c[0], (c[1] as number) + 5] as typeof c) : c)) }) as TradeProductsNationalRow);
    expect(() => validateProductUse({ build, productsNational: heading, enduseNational })).toThrow(/heading/);
    const total = bump(enduseNational, (r) => ({ ...r, value: r.value + 5 }) as TradeEnduseNationalRow);
    expect(() => validateProductUse({ build, productsNational, enduseNational: total })).toThrow(/trade_enduse_national/);
    const use = bump(enduseNational, (r) => ({ ...r, categories: r.categories.map((c, i) => (i === 0 ? ([c[0], c[1] + r.value * 0.01] as typeof c) : c)) }) as TradeEnduseNationalRow);
    expect(() => validateProductUse({ build, productsNational, enduseNational: use })).toThrow(/end use/);
    const months = bump(productsNational, (r) => ({ ...r, months: 7 }) as TradeProductsNationalRow);
    expect(() => validateProductUse({ build, productsNational: months, enduseNational })).toThrow(/months/);
  });

  it("names every end use in the output, for its flow", () => {
    for (const r of outRows) for (const t of [...r.rows, ...r.special]) expect(t[1]).toMatch(/^\d{5}$/);
  });
});

/**
 * The card's four reads, answered from one year's file with a single pass each. The card session owns the real model;
 * this shows the output shape supports them and that they are cheap (a year file is ~2,000 rows).
 */
describe("what the card will ask of one year's file", () => {
  const imports2025 = outRows.find((r) => r.year === 2025 && r.flow === "imports") as Extract<TradeProductUseRow, { flow: "imports" }>;
  const all = [...imports2025.rows, ...imports2025.special];
  const top = <K>(m: Map<K, number>, n: number) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n);
  const sumBy = (rows: typeof all, key: (t: (typeof all)[number]) => string) => {
    const m = new Map<string, number>();
    for (const t of rows) m.set(key(t), (m.get(key(t)) ?? 0) + t[2]);
    return m;
  };

  it("chapter -> top headings -> top uses, with each use's total from outside the selection", () => {
    const sel = all.filter((t) => t[0].startsWith("85"));
    const headings = top(sumBy(sel, (t) => t[0]), 5);
    expect(headings[0][0]).toBe("8517"); // phones & network equipment lead chapter 85 imports
    const uses = top(sumBy(sel, (t) => t[1]), 5);
    const useTotal = sumBy(all, (t) => t[1]);
    for (const [use, v] of uses) {
      expect(useTotal.get(use)! - v, `use ${use} outside chapter 85`).toBeGreaterThanOrEqual(0);
    }
    expect(sel.reduce((s, t) => s + t[2], 0)).toBe(sumBy(all, (t) => t[0].slice(0, 2)).get("85"));
  });

  it("one heading -> its uses", () => {
    const uses = sumBy(all.filter((t) => t[0] === "8517"), (t) => t[1]);
    expect(uses.size).toBeGreaterThan(1); // telecom equipment and cell phones & household goods
    expect(uses.has("41050")).toBe(true); // imports 41050 = Cell phones & household goods
    expect([...uses.values()].reduce((s, v) => s + v, 0)).toBe(sumBy(all, (t) => t[0]).get("8517"));
  });

  it("one use -> top chapters -> top headings", () => {
    const useTotals = sumBy(all, (t) => t[1]);
    const [bigUse] = top(useTotals, 1)[0];
    const sel = all.filter((t) => t[1] === bigUse);
    expect(top(sumBy(sel, (t) => t[0].slice(0, 2)), 3).length).toBeGreaterThan(0);
    expect(sel.reduce((s, t) => s + t[2], 0)).toBe(useTotals.get(bigUse));
  });

  it("each read is one pass over ~2,000 rows", () => {
    expect(all.length).toBeLessThan(2500);
    const t0 = performance.now();
    for (let i = 0; i < 50; i++) {
      top(sumBy(all.filter((t) => t[0].startsWith("85")), (t) => t[1]), 6);
      top(sumBy(all.filter((t) => t[1] === "21320"), (t) => t[0]), 8);
    }
    expect((performance.now() - t0) / 100, "ms per read").toBeLessThan(5);
  });
});
