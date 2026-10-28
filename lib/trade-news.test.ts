import { describe, expect, it } from "vitest";
import type { NewsFile } from "./news-types";
import { tradeNews } from "../components/trade/trade-news";

const h = (outletId: string, lean: "Lean Left" | "Right") => ({ outletId, outlet: outletId, lean, title: `${outletId} headline`, url: "https://example.com/a" });
const story = (id: string, chartId?: string) => ({ id, date: "2026-10-27", topic: "Topic", ...(chartId ? { chartId } : {}), headlines: [h("nbcnews", "Lean Left"), h("foxnews", "Right")] });
const file = (...stories: ReturnType<typeof story>[]): NewsFile => ({ asOf: "2026-10-28", stories });

describe("tradeNews", () => {
  // Jan 1991 through Aug 2026 (428 months); duties trail imports by two months, as in the data.
  const n = 428;
  const exports = Array.from({ length: n }, (_, i) => 20_000 + i * 100);
  const imports = Array.from({ length: n }, (_, i) => 25_000 + i * 150);
  const national = { sa: { exports, imports }, duties: Array.from({ length: n }, (_, i) => (i < n - 2 ? 1e9 + i * 1e6 : null)), dutyImports: Array.from({ length: n }, (_, i) => (i < n - 2 ? 2e10 : null)) };

  it("sparklines the national series for stories on the balance and tariffs cards, linking to the card", () => {
    const [bal, tariff] = tradeNews(file(story("trade_deficit-2026-10-27", "trade-balance"), story("tariff.CAN-2026-10-27", "tariffs")), national);
    expect(bal.chart).toMatchObject({ target: "trade-balance", label: "Goods trade balance" });
    expect(bal.chart!.value).toMatch(/^[+−]?\$[\d.]+[BT]$/);
    expect(tariff.chart).toMatchObject({ target: "tariffs", label: "Tariff rate, all countries" });
    expect(tariff.chart!.value).toMatch(/^\d+\.\d%$/);
    for (const c of [bal.chart!, tariff.chart!]) {
      expect(c.pts.length).toBeGreaterThan(20);
      expect(c.pts.length).toBeLessThanOrEqual(36);
      expect(c.asOf).toMatch(/^[A-Z][a-z]+ \d{4}$/);
      expect(c.pts.at(-1)!.x).toBe(c === bal.chart ? n - 1 : n - 3);
      // x is the month index, rising, ending at the latest month the caption names.
      expect(c.pts.every((p, i) => i === 0 || p.x > c.pts[i - 1].x)).toBe(true);
    }
  });

  it("leaves a story with no chart, or on a card with no headline series, as plain headlines", () => {
    const out = tradeNews(file(story("trade_deals-2026-10-27"), story("p-2026-10-27", "who-the-u-s-trades-with")), national);
    expect(out.map((s) => s.chart)).toEqual([undefined, undefined]);
    expect(tradeNews(file(story("x-2026-10-27", "tariffs")))[0].chart).toBeUndefined();
    expect(tradeNews(null, national)).toEqual([]);
  });

  it("gives a partner's story the partner's own rate, and picks the partner on the chart when See chart is pressed", () => {
    const picked: string[] = [];
    // 36 months ending Jul 2026 (index 426): Canada's rate trails the national line by a month.
    const rates = { CAN: { name: "Canada", from: 391, rates: Array.from({ length: 36 }, (_, i) => 1 + i / 10) } };
    const [can, all] = tradeNews(file(story("tariff.CAN-2026-10-27", "tariffs"), story("tariff.all-2026-10-26", "tariffs")), national, rates, (c) => picked.push(c));
    expect(can.chart).toMatchObject({ target: "tariffs", label: "Tariff rate, Canada", value: "4.5%", asOf: "July 2026" });
    expect(can.chart!.pts).toHaveLength(36);
    expect(can.chart!.pts.at(-1)!.x).toBe(426);
    can.chart!.onSee!();
    expect(picked).toEqual(["CAN"]);
    // An all-countries story keeps the national line and picks nothing.
    expect(all.chart).toMatchObject({ label: "Tariff rate, all countries" });
    expect(all.chart!.onSee).toBeUndefined();
  });

  it("falls back to the all-countries line for a partner with under a year of rates, or none shipped", () => {
    const thin = { MEX: { name: "Mexico", from: 420, rates: [2, 2.1, null, 2.2, 2.3] } };
    const out = tradeNews(file(story("tariff.MEX-2026-10-27", "tariffs"), story("tariff.JPN-2026-10-27", "tariffs")), national, thin, () => {});
    expect(out.map((s) => s.chart!.label)).toEqual(["Tariff rate, all countries", "Tariff rate, all countries"]);
    expect(out.every((s) => s.chart!.onSee === undefined)).toBe(true);
  });
});
