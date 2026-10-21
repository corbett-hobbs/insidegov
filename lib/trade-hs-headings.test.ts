import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HS_CHAPTERS } from "./trade-hs-chapters";
import { HS_HEADINGS, fallbackHeadingName, headingName } from "./trade-hs-headings";
import type { TradeProductUseRow } from "./trade-product-use-entities";
import type { TradeProductsHeading, TradeProductsNationalRow } from "./trade-products-entities";

/**
 * Every heading the products card can show (any partner's top 10, the all-countries top 25) gets a readable name:
 * the hand-written one in `HS_HEADINGS`, or a cleaned-up Census description. The all-countries list, which the card
 * shows by default, must be fully hand-named: a refresh that brings a new heading into it fails here, and the fix is
 * a new line in `lib/trade-hs-headings.ts`.
 */

const OUT = "pipeline/output";
const read = <T>(file: string) => JSON.parse(readFileSync(`${OUT}/${file}`, "utf8")) as T[];
const descs = new Map(read<TradeProductsHeading>("trade_products_headings.json").map((h) => [h.hs, h.census_desc]));
const headingsOf = (rows: TradeProductsNationalRow[]) => new Set(rows.flatMap((r) => r.headings.map((h) => h[0])));
const national = headingsOf(read<TradeProductsNationalRow>("trade_products_national.json"));
const shown = new Set(national);
for (const f of readdirSync(`${OUT}/trade_products`)) for (const hs of headingsOf(read(`trade_products/${f}`))) shown.add(hs);

describe("HS heading names", () => {
  it("are short, plain, and keyed by a real ordinary heading", () => {
    for (const [hs, name] of Object.entries(HS_HEADINGS)) {
      expect(hs, name).toMatch(/^\d{4}$/);
      expect(HS_CHAPTERS[hs.slice(0, 2)]?.kind, hs).toBe("goods");
      expect(descs.has(hs), `${hs} is in trade_products_headings.json`).toBe(true);
      expect(name.length, hs).toBeLessThanOrEqual(42);
      expect(name, hs).toMatch(/^[A-Z0-9]/);
      expect(name, hs).not.toMatch(/\b[A-Z]{4,}\b/); // no Census capitals; short acronyms (PVC, SUVs, LED) are fine
    }
  });

  it("cover every heading in the all-countries top list", () => {
    expect([...national].filter((hs) => !HS_HEADINGS[hs])).toEqual([]);
  });

  it("cover every ordinary heading in the product-to-use files, which the Sankey card can name", () => {
    const missing = new Set<string>();
    for (const f of readdirSync(`${OUT}/trade_product_use`)) for (const r of read<TradeProductUseRow>(`trade_product_use/${f}`)) for (const t of r.rows) if (!HS_HEADINGS[t[0]]) missing.add(t[0]);
    expect([...missing].sort()).toEqual([]);
  });

  it("give every heading a partner list shows a readable name, hand-written or not", () => {
    const fallbacks: string[] = [];
    for (const hs of shown) {
      const name = headingName(hs, descs.get(hs));
      if (!HS_HEADINGS[hs]) fallbacks.push(`${hs} ${name}`);
      expect(name.length, hs).toBeGreaterThan(2);
      expect(name, hs).not.toBe(descs.get(hs)); // never the raw upper-case description
      expect(name, hs).not.toMatch(/^Heading /);
    }
    // At the time of writing every shown heading is hand-named; the fallback is for headings a refresh adds.
    expect(fallbacks.length, fallbacks.join("\n")).toBeLessThanOrEqual(50);
  });

  it("fall back to a sentence-case Census description", () => {
    expect(fallbackHeadingName("PARTS ETC FOR MACHINE TOOLS OF HEAD 8456 TO 8465")).toBe("Parts for machine tools of head 8456 to 8465");
    expect(fallbackHeadingName("VEGETABLES NESOI, FRESH OR CHILLED")).toBe("Vegetables, fresh or chilled");
    expect(fallbackHeadingName("COFFEE; COFFEE HUSKS ETC; SUBSTITUTES WITH COFFEE")).toBe("Coffee");
    expect(fallbackHeadingName("ELECTRIC MOTORS AND GENERATORS (NO SETS)")).toBe("Electric motors and generators (no sets)");
    for (const [hs, d] of descs) {
      const name = fallbackHeadingName(d);
      expect(name.length, hs).toBeGreaterThan(0);
      expect(name, hs).not.toMatch(/\b(NESOI|ETC)\b/);
    }
    expect(headingName("0000", undefined)).toBe("Heading 0000");
  });
});
