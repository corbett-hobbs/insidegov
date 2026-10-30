import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHART_PAGES, CHARTS, chartImagePath, chartSharePath, chartsOf } from "./og-charts";

describe("chart share images", () => {
  it("has a chart route for every page", () => {
    for (const page of CHART_PAGES) expect(existsSync(`app${page}/chart/[chart]/page.tsx`), page).toBe(true);
  });

  it("has an image for every chart in the manifest, and no chart on an unlisted page", () => {
    for (const [page, charts] of Object.entries(CHARTS)) {
      expect(CHART_PAGES as readonly string[], page).toContain(page);
      for (const c of charts ?? []) expect(existsSync(`public${chartImagePath(page, c.id)}`), `${page} ${c.id}`).toBe(true);
    }
  });

  it("keeps card ids unique within a page and titles free of years", () => {
    for (const page of CHART_PAGES) {
      const ids = chartsOf(page).map((c) => c.id);
      expect(new Set(ids).size, page).toBe(ids.length);
      for (const c of chartsOf(page)) expect(c.title, `${page} ${c.id}`).not.toMatch(/\b(19|20)\d\d\b|so far/);
    }
  });
});

describe("chartSharePath", () => {
  const page = "/presidency/trade";
  const id = chartsOf(page)[0]!.id;
  it("sends a chart with an image to its chart route, from the page or from another chart's route", () => {
    expect(chartSharePath(page, id)).toBe(`${page}/chart/${id}`);
    expect(chartSharePath(`${page}/chart/${id}`, id)).toBe(`${page}/chart/${id}`);
  });
  it("leaves a chart without an image, or another page, on its own path", () => {
    expect(chartSharePath(page, "no-such-card")).toBe(page);
    expect(chartSharePath("/about", "anything")).toBe("/about");
  });
});
