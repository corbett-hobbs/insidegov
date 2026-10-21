import { describe, expect, it, vi } from "vitest";
import { MONTH_NAMES } from "./indicator-time";
import { GREY_ID, SANKEY_OTHER, SANKEY_OUTSIDE, SANKEY_TOP, namedLines, nodeSize, sankeyLinks, sankeyModel, sankeyTakeaway, type ProductUsePayload, type ProductUseTriple, type SankeyModel } from "./trade-sankey";

// The data module is server-only; under vitest it is just a file reader.
vi.mock("server-only", () => ({}));
const { getProductUsePayload, getProductUseYears } = await import("./trade-product-use-data");

/** A one-flow payload from imports triples (exports empty). */
const payload = (rows: ProductUseTriple[], special: ProductUseTriple[] = []): ProductUsePayload => ({
  year: 2025,
  months: 12,
  flows: { imports: { rows, special }, exports: { rows: [], special: [] } },
  names: {},
});
const byCol = (m: SankeyModel, col: number) => m.nodes.filter((n) => n.col === col);
const sumIn = (m: SankeyModel, id: string) => m.segments.filter((s) => s.target === id).reduce((a, s) => a + s.value, 0);
const sumOut = (m: SankeyModel, id: string) => m.segments.filter((s) => s.source === id).reduce((a, s) => a + s.value, 0);

/** Every node's bands add up to its drawn size: what comes in equals the node, and so does what goes out. */
function expectBalanced(m: SankeyModel) {
  for (const n of m.nodes) {
    if (n.col > 0 && !n.grey) expect(sumIn(m, n.id), `${n.id} in`).toBeCloseTo(nodeSize(n), 0);
    if (n.col < 2) expect(sumOut(m, n.id), `${n.id} out`).toBeCloseTo(nodeSize(n), 0);
  }
  for (const col of [0, 1, 2]) expect(byCol(m, col).filter((n) => !n.grey).reduce((a, n) => a + n.value, 0), `column ${col}`).toBeCloseTo(m.total, 0);
}

describe("namedLines", () => {
  it("keeps the largest lines at or over 1% of the selection, up to the cap", () => {
    const m = new Map([["a", 50], ["b", 30], ["c", 10], ["d", 9.1], ["e", 0.9]]);
    expect(namedLines(m, 100, 3)).toEqual({ keep: ["a", "b", "c"], rest: ["d", "e"] });
    // Under the cap, a line under 1% still folds.
    expect(namedLines(m, 100, 8)).toEqual({ keep: ["a", "b", "c", "d"], rest: ["e"] });
  });
});

describe("chapter pick", () => {
  // Chapter 85: ten headings, the first nine large, the tenth 0.5%; each heading feeds its own use, plus heading 8501 splits.
  const rows: ProductUseTriple[] = [];
  const heads = ["8501", "8502", "8503", "8504", "8505", "8506", "8507", "8508", "8509"];
  heads.forEach((h, i) => rows.push([h, `2${i}000`, 100 - i * 5]));
  rows.push(["8501", "29000", 20]);
  rows.push(["8510", "39000", 4]); // 0.5% of the selection
  // Outside the chapter: more of use 20000 (from chapters 84 and 94, and a special heading), and of 39000.
  rows.push(["8471", "20000", 60], ["8473", "20000", 15], ["8414", "20000", 5], ["8419", "20000", 5], ["9403", "20000", 1]);
  rows.push(["8471", "39000", 50]);
  const p = payload(rows, [["9817", "20000", 7]]);
  const m = sankeyModel(p, "imports", { kind: "chapter", code: "85" })!;
  const total = 100 + 95 + 90 + 85 + 80 + 75 + 70 + 65 + 60 + 20 + 4;

  it("draws the chapter, its top 8 headings + Other, and its top 6 uses + Other", () => {
    expect(m.total).toBe(total);
    expect(byCol(m, 0).map((n) => n.id)).toEqual(["c:85"]);
    const prods = byCol(m, 1).filter((n) => !n.grey);
    expect(prods).toHaveLength(SANKEY_TOP.products + 1);
    expect(prods.at(-1)).toMatchObject({ id: "p:other", label: "2 other products", folded: 2, colour: SANKEY_OTHER, value: 60 + 4 });
    const uses = byCol(m, 2);
    expect(uses).toHaveLength(SANKEY_TOP.uses + 1);
    expect(uses.at(-1)).toMatchObject({ id: "u:other", folded: 5 });
    expect(m.counts).toEqual({ chapters: 1, products: 10, uses: 11 });
    expectBalanced(m);
  });

  it("colours each band by the use it reaches, six solid colours, Other neutral", () => {
    const uses = byCol(m, 2);
    expect(new Set(uses.slice(0, 6).map((n) => n.colour)).size).toBe(6);
    for (const s of m.segments) {
      if (s.source === GREY_ID) expect(s.colour).toBe(SANKEY_OUTSIDE);
      else if (s.target.startsWith("u:")) expect(s.colour).toBe(m.nodes.find((n) => n.id === s.target)!.colour);
    }
    // 8501 -> its two uses: the chapter -> 8501 band is split in two colours.
    expect(m.segments.filter((s) => s.source === "c:85" && s.target === "p:8501")).toHaveLength(2);
  });

  it("brings each named use's outside part in as one grey band, special pairs included", () => {
    const u20000 = m.nodes.find((n) => n.id === "u:20000")!;
    expect(u20000.value).toBe(100);
    expect(u20000.outside).toBe(60 + 15 + 5 + 5 + 1 + 7);
    const g = m.grey.find((x) => x.target === "u:20000")!;
    expect(g.value).toBe(93);
    expect(g.count).toBe(3); // chapters 84, 94 and 98
    expect(g.top.map((t) => t.value)).toEqual([85, 7, 1]);
    expect(g.top[0].name).toBe("Machinery & computers");
    const greyNode = m.nodes.find((n) => n.id === GREY_ID)!;
    expect(greyNode).toMatchObject({ col: 1, label: "From other chapters", grey: true });
    expect(greyNode.value).toBe(m.grey.reduce((a, x) => a + x.value, 0));
    // 39000 takes 0.5% of the selection: folded into Other, so no grey band for it.
    expect(m.grey.some((x) => x.target === "u:39000")).toBe(false);
    expect(m.grey.every((x) => !x.target.endsWith("other"))).toBe(true);
  });
});

describe("product pick", () => {
  const rows: ProductUseTriple[] = [["8517", "21400", 90], ["8517", "41050", 52], ["8517", "30230", 0.5], ["8525", "21400", 24], ["9021", "41050", 57], ["8504", "20005", 40]];
  const m = sankeyModel(payload(rows), "imports", { kind: "product", code: "8517" })!;

  it("sizes the chapter to the product and keeps the chapter's total for the tooltip", () => {
    expect(byCol(m, 0)).toEqual([expect.objectContaining({ id: "c:85", value: 142.5, full: 142.5 + 24 + 40 })]);
    expect(byCol(m, 1).filter((n) => !n.grey).map((n) => n.id)).toEqual(["p:8517"]);
    expectBalanced(m);
  });

  it("names an Other of one line after it, without a grey band", () => {
    const one = byCol(m, 2).find((n) => n.folded === 1)!;
    expect(one).toMatchObject({ id: "u:other", code: "30230", label: "Other vehicle parts", colour: SANKEY_OTHER, outside: 0 });
  });

  it("grey comes from other products", () => {
    expect(m.nodes.find((n) => n.id === GREY_ID)?.label).toBe("From other products");
    expect(m.grey.find((g) => g.target === "u:21400")).toMatchObject({ value: 24, count: 1, top: [{ name: "Heading 8525", value: 24 }] });
  });
});

describe("use pick", () => {
  const rows: ProductUseTriple[] = [];
  // Use 41050 from nine chapters (the ninth 0.4%) and many headings; those headings also feed other uses.
  const chapters = ["85", "90", "94", "84", "42", "73", "39", "95", "96"];
  chapters.forEach((c, i) => {
    rows.push([`${c}01`, "41050", i === 8 ? 1 : 60 - i * 6]);
    rows.push([`${c}02`, "41050", i === 8 ? 0.2 : 4]);
    rows.push([`${c}01`, "21400", 100]);
  });
  const m = sankeyModel(payload(rows), "imports", { kind: "use", code: "41050" })!;

  it("draws top 6 chapters + Other, top 8 headings + Other, and the one use, with no grey", () => {
    expect(byCol(m, 0)).toHaveLength(SANKEY_TOP.chapters + 1);
    expect(byCol(m, 0).at(-1)).toMatchObject({ label: "3 other chapters", folded: 3 });
    expect(byCol(m, 1)).toHaveLength(SANKEY_TOP.products + 1);
    expect(byCol(m, 2).map((n) => n.id)).toEqual(["u:41050"]);
    expect(m.grey).toEqual([]);
    expect(m.nodes.some((n) => n.grey || n.outside > 0)).toBe(false);
    // Products are sized by what they send to this use only.
    expect(m.nodes.find((n) => n.id === "p:8501")).toMatchObject({ value: 60, full: 160 });
    expectBalanced(m);
  });

  it("colours bands by the chapter they start from", () => {
    for (const s of m.segments) {
      const [src] = s.source.split(">");
      if (s.source.startsWith("c:")) expect(s.colour).toBe(m.nodes.find((n) => n.id === src)!.colour);
    }
    expect(m.segments.filter((s) => s.target === "u:41050").every((s) => s.colour !== SANKEY_OUTSIDE)).toBe(true);
  });
});

it("returns null for a line with no trade", () => {
  expect(sankeyModel(payload([["8517", "21400", 5]]), "imports", { kind: "chapter", code: "01" })).toBeNull();
});

describe("on the real files", () => {
  const years = getProductUseYears();

  it("covers 2010 to the latest year", () => {
    expect(years[0]).toBe(2010);
    expect(years.length).toBeGreaterThanOrEqual(17);
  });

  it("balances and folds correctly for every chapter, its top product and its top use, every year and flow", () => {
    for (const y of years) {
      const p = getProductUsePayload(y)!;
      for (const flow of ["exports", "imports"] as const) {
        const rows = p.flows[flow].rows;
        const chapters = [...new Set(rows.map((t) => t[0].slice(0, 2)))];
        const all = new Map<string, number>();
        for (const t of [...rows, ...p.flows[flow].special]) all.set(t[1], (all.get(t[1]) ?? 0) + t[2]);
        for (const c of chapters) {
          const m = sankeyModel(p, flow, { kind: "chapter", code: c });
          if (!m) continue;
          expectBalanced(m);
          expect(byCol(m, 1).filter((n) => !n.grey).length).toBeLessThanOrEqual(SANKEY_TOP.products + 1);
          expect(byCol(m, 2).length).toBeLessThanOrEqual(SANKEY_TOP.uses + 1);
          for (const n of m.nodes) if (n.folded === 0 && !n.grey) expect(n.value / m.total, `${y} ${flow} ${c} ${n.id}`).toBeGreaterThanOrEqual(0.01);
          // A named use is drawn at its full total.
          for (const n of byCol(m, 2)) if (n.folded === 0) expect(nodeSize(n), `${y} ${flow} ${c} ${n.id}`).toBe(all.get(n.code!));
          const top = byCol(m, 1)[0];
          if (top.folded === 0) expectBalanced(sankeyModel(p, flow, { kind: "product", code: top.code! })!);
          const use = byCol(m, 2)[0];
          if (use.folded === 0) expectBalanced(sankeyModel(p, flow, { kind: "use", code: use.code! })!);
        }
      }
      expect(Object.values(p.names).every((n) => !/^Heading /.test(n)), String(y)).toBe(true);
    }
  }, 60_000); // every chapter of every year and flow: a few seconds alone, slower beside the full suite

  it("matches the mockup's 2025 chapter 85 imports", () => {
    const m = sankeyModel(getProductUsePayload(2025)!, "imports", { kind: "chapter", code: "85" })!;
    expect(m.counts.uses).toBe(29);
    expect(sankeyTakeaway(m, MONTH_NAMES)).toBe(
      "Imports of electronics & electrical equipment ($505B in 2025) feed 29 end uses; 58% goes to telecom equipment, electrical equipment and semiconductors. The chapter supplies 23% of all imports of other vehicle parts; most of the rest comes from vehicles & parts.",
    );
    const links = sankeyLinks(m);
    expect(links.reduce((a, l) => a + (l.source.col === 0 ? l.value : 0), 0)).toBe(m.total);
  });

  it("writes at most two sentences for every pick", () => {
    const p = getProductUsePayload(2025)!;
    for (const flow of ["exports", "imports"] as const) {
      const rows = p.flows[flow].rows;
      const picks = [
        ...[...new Set(rows.map((t) => t[0].slice(0, 2)))].map((code) => ({ kind: "chapter" as const, code })),
        ...[...new Set(rows.map((t) => t[0]))].map((code) => ({ kind: "product" as const, code })),
        ...[...new Set(rows.map((t) => t[1]))].map((code) => ({ kind: "use" as const, code })),
      ];
      for (const pick of picks) {
        const m = sankeyModel(p, flow, pick);
        if (!m) continue;
        const t = sankeyTakeaway(m, MONTH_NAMES);
        expect(t.split(/(?<=\.) (?=[A-Z])/).length, t).toBeLessThanOrEqual(2);
        expect(t, t).not.toMatch(/undefined|NaN|Heading \d/);
      }
    }
  });
});
