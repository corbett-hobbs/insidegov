import { describe, expect, it, vi } from "vitest";
import { SANKEY_WIDE_MIN, fitText, labelBox, layoutSankey, type Measure } from "./trade-sankey-layout";
import { nodeSize, sankeyModel, type SankeyPick } from "./trade-sankey";
import { fmtDollars } from "./trade-products";

vi.mock("server-only", () => ({}));
const { getProductUsePayload } = await import("./trade-product-use-data");

// IBM Plex Sans averages a little over half an em per character; mono is 0.6 em. A slightly generous estimate.
const measure: Measure = (t, px, mono) => t.length * px * (mono ? 0.6 : 0.56);
const valueOf = (n: Parameters<typeof nodeSize>[0]) => fmtDollars(nodeSize(n));

it("shortens a name with an ellipsis until it fits", () => {
  expect(fitText("Short", 100, 12, measure)).toBe("Short");
  const t = fitText("Medical, optical & scientific instruments", 120, 12, measure);
  expect(t.endsWith("…")).toBe(true);
  expect(measure(t, 12, false)).toBeLessThanOrEqual(120);
});

describe("every label stays inside the chart", () => {
  const years = [2010, 2018, 2025, 2026];
  // Phone plot widths (360px and 375px screens, after the card's padding and the 12px bleed), a tablet, desktop.
  const widths = [304, 319, 680, SANKEY_WIDE_MIN, 1090];
  for (const y of years) {
    it(String(y), () => {
      const p = getProductUsePayload(y)!;
      for (const flow of ["exports", "imports"] as const) {
        const rows = p.flows[flow].rows;
        const picks: SankeyPick[] = [
          ...[...new Set(rows.map((t) => t[0].slice(0, 2)))].map((code) => ({ kind: "chapter" as const, code })),
          ...[...new Set(rows.map((t) => t[1]))].map((code) => ({ kind: "use" as const, code })),
          ...["8517", "8471", "8703", "2709", "3004", "8800", "1201"].map((code) => ({ kind: "product" as const, code })),
        ];
        for (const pick of picks) {
          const m = sankeyModel(p, flow, pick);
          if (!m) continue;
          for (const w of widths) {
            const L = layoutSankey(m, w, measure, valueOf);
            expect(L.wide).toBe(w >= SANKEY_WIDE_MIN);
            for (const l of L.labels) {
              const b = labelBox(l, measure);
              const where = `${y} ${flow} ${pick.kind} ${pick.code} @${w}: ${l.name}`;
              expect(b.x0, where).toBeGreaterThanOrEqual(-0.5);
              expect(b.x1, where).toBeLessThanOrEqual(w + 0.5);
              expect(b.y0, where).toBeGreaterThanOrEqual(-0.5);
              expect(b.y1, where).toBeLessThanOrEqual(L.height + 0.5);
            }
            for (const n of L.nodes) {
              expect(n.x, pick.code).toBeGreaterThanOrEqual(0);
              expect(n.x + (L.wide ? L.bar : n.len), pick.code).toBeLessThanOrEqual(w + 0.5);
            }
            expect(L.labels).toHaveLength(m.nodes.length);
          }
        }
      }
    }, 30_000);
  }
});

it("lays out wide left to right with labels outside the bars, narrow top to bottom", () => {
  const p = getProductUsePayload(2025)!;
  const m = sankeyModel(p, "imports", { kind: "chapter", code: "85" })!;
  const wide = layoutSankey(m, 1090, measure, valueOf);
  const ch = wide.nodes.find((n) => n.node.col === 0)!;
  const chLabel = wide.labels.find((l) => l.id === ch.node.id)!;
  expect(chLabel).toMatchObject({ anchor: "end", rotate: 0 });
  expect(chLabel.x).toBeLessThan(ch.x);
  expect(wide.labels.filter((l) => l.halo).every((l) => m.nodes.find((n) => n.id === l.id)!.col === 1)).toBe(true);
  expect(wide.captions.map((c) => c.text)).toEqual(["Chapter", "Product", "Use"]);

  const narrow = layoutSankey(m, 319, measure, valueOf);
  const ys = [0, 1, 2].map((c) => narrow.nodes.find((n) => n.node.col === c)!.y);
  expect(ys[0]).toBeLessThan(ys[1]);
  expect(ys[1]).toBeLessThan(ys[2]);
  const slanted = narrow.labels.filter((l) => l.rotate !== 0);
  expect(slanted.length).toBeGreaterThan(0);
  // About 55 degrees, steeper only where needed; never past vertical.
  for (const l of slanted) {
    expect(-l.rotate).toBeGreaterThanOrEqual(54.9);
    expect(-l.rotate).toBeLessThanOrEqual(90);
  }
  // Row 0 rises from the left corner (start anchor); row 2 ends at the right corner (end anchor).
  for (const l of slanted) {
    const col = m.nodes.find((n) => n.id === l.id)!.col;
    if (col === 0) expect(l.anchor).toBe("start");
    if (col === 2) expect(l.anchor).toBe("end");
  }
});
