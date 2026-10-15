import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildEncountersPayload } from "./encounters-derive";
import { encountersNoteRow, encountersSeriesRow } from "./encounters-entities";
import { administration } from "./executive-orders-entities";
import { HISTORICAL_ADMINISTRATIONS } from "./troops-presidents";
import { barValue, markerGroups, monthsLabel, segments, windowYears } from "./encounters-chart";

const read = (f: string) => JSON.parse(readFileSync(`pipeline/output/${f}`, "utf8")) as unknown[];
const admins = read("administrations.json").map((r) => administration.parse(r));
const payload = buildEncountersPayload({
  series: read("encounters_series.json").map((r) => encountersSeriesRow.parse(r)),
  notes: read("encounters_notes.json").map((r) => encountersNoteRow.parse(r)),
  admins: [...HISTORICAL_ADMINISTRATIONS, ...admins.filter((a) => !HISTORICAL_ADMINISTRATIONS.some((h) => h.term_id === a.term_id))],
});
const year = (fy: number) => payload.years.find((y) => y.fy === fy)!;

describe("encounters chart helpers", () => {
  it("draws Border Patrol-only years as one neutral segment", () => {
    const y = year(1995);
    const s = segments(y, "nationwide", null);
    expect(s).toHaveLength(1);
    expect(s[0].key).toBe("usbp_only");
    expect(s[0].value).toBe(y.nationwide.usbp);
  });

  it("stacks the published parts, and they add up to the total", () => {
    for (const fy of [2010, 2022, 2025]) {
      const y = year(fy);
      for (const scope of ["nationwide", "southwest"] as const) {
        const s = segments(y, scope, null);
        expect(s.reduce((a, b) => a + b.value, 0)).toBe(y[scope].total);
        s.forEach((seg, i) => expect(seg.from).toBe(s.slice(0, i).reduce((a, b) => a + b.value, 0)));
      }
    }
    expect(segments(year(2022), "nationwide", null).map((s) => s.key)).toEqual(["usbp", "ofo", "title42"]);
  });

  it("isolating a series draws it from zero, and nothing where it has no figure", () => {
    expect(segments(year(2022), "nationwide", "ofo")).toEqual([{ key: "ofo", value: year(2022).nationwide.ofo!, from: 0 }]);
    expect(barValue(year(1995), "nationwide", "ofo")).toBeNull();
    expect(segments(year(1995), "nationwide", "ofo")).toEqual([]);
    expect(segments(year(2015), "nationwide", "title42")).toEqual([]);
  });

  it("windows the years and keeps the in-progress year when the window reaches ICE's newest year", () => {
    const ys = windowYears(payload.years, [2020, 2025], 2025).map((y) => y.fy);
    expect(ys[0]).toBe(2020);
    expect(ys.at(-1)).toBe(payload.lastFy);
    expect(windowYears(payload.years, [2020, 2024], 2025).at(-1)?.fy).toBe(2024);
  });

  it("places the five markers, hides those outside the window and merges close pills", () => {
    expect(payload.markers).toHaveLength(5);
    const all = markerGroups(payload.markers, payload.firstFy, payload.years.length, 23, 24);
    expect(all.flatMap((g) => g.markers.map((m) => m.n)).sort()).toEqual([1, 2, 3, 4, 5]);
    // CBP One (Jan 2023) and the end of Title 42 (May 2023) are under a pill apart at 23px a slot.
    expect(all.find((g) => g.markers.some((m) => m.id === "title-42-ends"))!.label).toMatch(/–/);
    const late = markerGroups(payload.markers, 2021, 2026 - 2021 + 1, 80, 24);
    expect(late.flatMap((g) => g.markers.map((m) => m.id))).not.toContain("port-figures-begin");
  });

  it("names the months of an in-progress year", () => {
    expect(monthsLabel(11)).toBe("11 months (Oct to Aug)");
    expect(monthsLabel(12)).toBe("12 months");
  });
});
