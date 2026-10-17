import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AID_CONTEXT, AID_TAKEAWAYS } from "../components/foreign-aid/takeaways";
import { SOURCE_LINKS } from "./source-links";
import { administration } from "./executive-orders-entities";
import { aidMeta, aidRow } from "./foreign-aid-entities";
import { SECTOR_PEACE, buildAidPayload, countryMilitary, decodeAid, nonCountryValue, rankCountries, spendingByYear, topRecipientsByYear, topRuns, yearTotal } from "./foreign-aid-derive";

/**
 * Every figure a Foreign aid card's takeaway cites, checked against the committed pipeline
 * output through the same derive functions the page draws with (default view: all countries,
 * all sectors). Dollars are nominal, as published. A data refresh that makes a sentence untrue
 * fails here: rewrite the takeaway in components/foreign-aid/takeaways.ts, then this check.
 */

const OUT = join(process.cwd(), "pipeline", "output");
const read = (f: string) => JSON.parse(readFileSync(join(OUT, f), "utf8"));
const meta = aidMeta.parse(read("foreign_assistance_meta.json"));
const payload = buildAidPayload(
  (read("foreign_assistance.json") as unknown[]).map((r) => aidRow.parse(r)),
  meta,
  (read("administrations.json") as unknown[]).map((r) => administration.parse(r)),
);
const d = decodeAid(payload);
const first = payload.years[0];
const last = payload.years[payload.years.length - 1];
const name = (ci: number) => payload.countries[ci].name;
const ci = (n: string) => payload.countries.findIndex((c) => c.name === n);
const billions = (v: number, digits = 1) => (v / 1e9).toFixed(digits);

const spending = spendingByYear(d, first, last, -1, null);
const total = (fy: number) => spending.find((r) => r.fy === fy)!.total;
const complete = spending.filter((r) => !payload.partialYears.includes(r.fy));
const tops = topRecipientsByYear(d, first, last, null);
const runs = topRuns(tops).map((r) => ({ name: name(r.ci), from: payload.years[r.from], to: payload.years[r.to] }));

const cases: Record<keyof typeof AID_TAKEAWAYS, { says: string[]; check: () => void }> = {
  spending: {
    says: ["In nominal dollars", "$15.0 billion in FY2001", "between $42 billion and $49 billion a year from FY2010 through FY2021", "peaked at $80.5 billion in FY2023", "Peace and security was the largest sector every year through FY2020"],
    check: () => {
      expect(meta.dollars).toBe("nominal");
      expect(first).toBe(2001);
      expect(billions(total(2001))).toBe("15.0");
      // FY2001 is the low point of the window's complete years, so "rose from" holds.
      expect(Math.min(...complete.map((r) => r.total))).toBe(total(2001));
      const band = complete.filter((r) => r.fy >= 2010 && r.fy <= 2021).map((r) => r.total);
      expect(band).toHaveLength(12);
      expect(billions(Math.min(...band), 0)).toBe("42");
      expect(billions(Math.max(...band), 0)).toBe("49");
      const peak = spending.reduce((a, b) => (b.total > a.total ? b : a));
      expect(peak.fy).toBe(2023);
      expect(billions(peak.total)).toBe("80.5");
      // Slot 0 (Peace and security) is the tallest band in every bar FY2001–FY2020, and not in FY2021.
      const leads = (r: (typeof spending)[number]) => r.slots.every((v, k) => k === SECTOR_PEACE || v < r.slots[SECTOR_PEACE]);
      expect(spending.filter((r) => r.fy <= 2020).every(leads)).toBe(true);
      expect(leads(spending.find((r) => r.fy === 2021)!)).toBe(false);
    },
  },
  map: {
    says: ["In FY2025", "Ukraine received the most, $6.8 billion", "Israel at $3.3 billion, nearly all of it military", "About a third of that year’s dollars went to global and regional programs"],
    check: () => {
      expect(payload.defaultYear).toBe(2025);
      const ranked = rankCountries(d, 2025, null);
      expect(name(ranked[0].ci)).toBe("Ukraine");
      expect(billions(ranked[0].value)).toBe("6.8");
      expect(name(ranked[1].ci)).toBe("Israel");
      expect(billions(ranked[1].value)).toBe("3.3");
      const isr = ci("Israel");
      expect(countryMilitary(d, isr, 2025 - first, null) / ranked[1].value).toBeGreaterThan(0.95);
      const programs = nonCountryValue(d, 2025 - first, null) / yearTotal(d, 2025, -1, null);
      expect(programs).toBeGreaterThan(0.3);
      expect(programs).toBeLessThan(0.37);
    },
  },
  firstPlace: {
    says: ["Afghanistan was the largest recipient for 13 straight years, FY2008 through FY2020", "Ukraine from FY2022 through FY2025", "$24.8 billion in FY2023 was 42% of the dollars tied to a single country, the largest share any No. 1 took"],
    check: () => {
      expect(runs).toContainEqual({ name: "Afghanistan", from: 2008, to: 2020 });
      expect(runs).toContainEqual({ name: "Ukraine", from: 2022, to: 2025 });
      const shares = tops.map((y) => ({ fy: y.fy, who: name(y.ranked[0].ci), value: y.ranked[0].value, share: y.ranked[0].value / y.countryTotal }));
      const ukr23 = shares.find((s) => s.fy === 2023)!;
      expect(ukr23.who).toBe("Ukraine");
      expect(billions(ukr23.value)).toBe("24.8");
      expect(Math.round(ukr23.share * 100)).toBe(42);
      expect(Math.max(...shares.map((s) => s.share))).toBe(ukr23.share);
    },
  },
};

describe("Foreign aid card takeaways", () => {
  for (const [key, c] of Object.entries(cases) as [keyof typeof AID_TAKEAWAYS, (typeof cases)[keyof typeof AID_TAKEAWAYS]][]) {
    it(`${key}: "${AID_TAKEAWAYS[key].slice(0, 48)}…" holds`, () => {
      for (const phrase of c.says) expect(AID_TAKEAWAYS[key]).toContain(phrase);
      c.check();
    });
  }

  it("stays short: two sentences, at most 45 words", () => {
    for (const [key, s] of Object.entries(AID_TAKEAWAYS)) {
      // A sentence ends at a period before a capital; "No. 1" is not a break.
      expect(s.split(/(?<=[.;])\s(?=[A-Z])/).filter((x) => x.endsWith(".")).length, key).toBeLessThanOrEqual(2);
      expect(s.split(/\s+/).length, key).toBeLessThanOrEqual(45);
    }
  });
});

/**
 * The context lines (rule 7d). Law numbers and dates come from the enacted laws (govinfo.gov) and the Federal Register, outside
 * the pipeline, so each is pinned to its phrase and its link; the data checks are that each action sits next to the highlight
 * the takeaway names.
 */
const fyOf = (iso: string) => (Number(iso.slice(5, 7)) >= 10 ? Number(iso.slice(0, 4)) + 1 : Number(iso.slice(0, 4)));
const contextCases: Record<keyof typeof AID_CONTEXT, { says: string[]; links: Record<string, string>; check: () => void }> = {
  spending: {
    says: ["P.L. 117-103 (March 15, 2022)", "P.L. 117-128 (May 21, 2022)", "P.L. 117-180 (September 30, 2022)", "P.L. 117-328 (December 29, 2022)"],
    links: { "plaw-117-103": "PLAW-117publ103", "plaw-117-128": "PLAW-117publ128", "plaw-117-180": "PLAW-117publ180", "plaw-117-328": "PLAW-117publ328" },
    check: () => {
      // All four fall in FY2022 or FY2023, the run-up to and year of the peak the takeaway names.
      for (const d of ["2022-03-15", "2022-05-21", "2022-09-30", "2022-12-29"]) expect([2022, 2023]).toContain(fyOf(d));
      expect(spending.reduce((a, b) => (b.total > a.total ? b : a)).fy).toBe(2023);
      // Ukraine is No. 1 in both years.
      for (const fy of [2022, 2023]) expect(name(tops.find((y) => y.fy === fy)!.ranked[0].ci)).toBe("Ukraine");
    },
  },
  map: {
    says: ["became law April 24, 2024 (P.L. 118-50)", "Executive Order 14169 paused new foreign development aid for a 90-day review on January 20, 2025"],
    links: { "plaw-118-50": "PLAW-118publ50", "fr-eo-14169": "2025-02091" },
    check: () => {
      // The map's default year is FY2025 (October 2024 to September 2025); the law came just before it, the order inside it.
      expect(payload.defaultYear).toBe(2025);
      expect(fyOf("2024-04-24")).toBe(2024);
      expect(fyOf("2025-01-20")).toBe(2025);
      const ranked = rankCountries(d, 2025, null);
      expect([name(ranked[0].ci), name(ranked[1].ci)]).toEqual(["Ukraine", "Israel"]);
    },
  },
};

describe("Foreign aid context lines", () => {
  for (const [key, c] of Object.entries(contextCases) as [keyof typeof AID_CONTEXT, (typeof contextCases)[keyof typeof AID_CONTEXT]][]) {
    it(`${key}: holds and names real sources`, () => {
      for (const phrase of c.says) expect(AID_CONTEXT[key].text).toContain(phrase);
      expect(AID_CONTEXT[key].sources.map((s) => s.id).sort()).toEqual(Object.keys(c.links).sort());
      for (const [id, part] of Object.entries(c.links)) expect(SOURCE_LINKS[id as keyof typeof SOURCE_LINKS], id).toMatch(new RegExp(`^https://.*${part}`));
      c.check();
    });
  }

  it("every context line belongs to a card, stays short and makes no causal claim", () => {
    expect(Object.keys(AID_CONTEXT).sort()).toEqual(Object.keys(contextCases).sort());
    for (const [key, line] of Object.entries(AID_CONTEXT)) {
      expect(line.text.replace(/P\.L\./g, "PL").split(/(?<=\.)\s+(?=[A-Z])/).length, key).toBeLessThanOrEqual(2);
      expect(line.text.split(/\s+/).length, key).toBeLessThanOrEqual(45);
      expect(line.text, key).not.toMatch(/\b(because|due to|caused|led to|drove|thanks to|soared|plunged)\b/i);
    }
  });
});
