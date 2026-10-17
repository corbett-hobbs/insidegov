import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LAWS_CONTEXT, LAWS_TAKEAWAYS } from "../components/laws/takeaways";
import { SOURCE_LINKS } from "./source-links";

/**
 * Every figure a Laws card's takeaway cites, checked against the committed pipeline output in the page's default view (every
 * Congress, all policy areas, any vote, any sponsor). A data refresh that makes a sentence untrue fails here: rewrite the
 * takeaway in components/laws/takeaways.ts, then this check. Commemorations are a quarter of all laws, so each card's
 * claims about them are checked with them in and out. Congresses are labelled by their two years ("1987–88"); the one
 * still in session (`partial_congresses`) is left out of every "through 2024" claim, as the chart leaves it out of its labels.
 */

type CountRow = { congress: number; area_id: string; n: number; bands: [number, number, number, number, number] };
type Meta = { partial_congresses: number[]; areas: { id: string; group: string }[] };
type Law = { congress: number; band: number; house: [number, ...unknown[]] | null; senate: [number, ...unknown[]] | null };
const counts = JSON.parse(readFileSync("pipeline/output/laws_counts.json", "utf8")) as CountRow[];
const meta = JSON.parse(readFileSync("pipeline/output/laws_meta.json", "utf8")) as Meta;
const laws = JSON.parse(readFileSync("pipeline/output/laws.json", "utf8")) as Law[];

const groupOf = new Map(meta.areas.map((a) => [a.id, a.group]));
const COMMEM = "commemorations";
const openYear = (c: number) => 1789 + 2 * (c - 1);
const years = (c: number) => `${openYear(c)}–${String(openYear(c) + 1).slice(2)}`;
const pct = (x: number) => Math.round(x * 100);

/** Per Congress: laws in each support band `[voice/consent, under 60, 60–75, 75–90, 90+]`, all areas or one filter. */
function perCongress(keep: (group: string) => boolean): Map<number, number[]> {
  const m = new Map<number, number[]>();
  for (const r of counts) {
    if (!keep(groupOf.get(r.area_id)!)) continue;
    const b = m.get(r.congress) ?? [0, 0, 0, 0, 0];
    r.bands.forEach((n, k) => (b[k]! += n));
    m.set(r.congress, b);
  }
  return m;
}
const sum = (b: readonly number[]) => b.reduce((a, x) => a + x, 0);
const all = perCongress(() => true);
const noCommem = perCongress((g) => g !== COMMEM);
const commem = perCongress((g) => g === COMMEM);
const complete = [...all.keys()].filter((c) => !meta.partial_congresses.includes(c)).sort((a, b) => a - b);
const argmax = <T,>(cs: T[], f: (c: T) => number) => cs.reduce((best, c) => (f(c) > f(best) ? c : best));
const argmin = (cs: number[], f: (c: number) => number) => cs.reduce((best, c) => (f(c) < f(best) ? c : best));

/** Laws per band for one topic group (or all) over every Congress, as the groups card's bars show them by default. */
function groupBands(group: string | null): number[] {
  const b = [0, 0, 0, 0, 0];
  for (const r of counts) if (group === null || groupOf.get(r.area_id) === group) r.bands.forEach((n, k) => (b[k]! += n));
  return b;
}

const cases: Record<keyof typeof LAWS_TAKEAWAYS, { says: string[]; check: () => void }> = {
  count: {
    says: ["From 1973 through 2024", "the most laws in 1987–88 (713)", "the fewest in 2023–24 (274)", "Commemorations peaked at 40% of laws in 1985–86", "without them, the most was 596, in 1973–74"],
    check: () => {
      expect(openYear(complete[0]!)).toBe(1973);
      expect(openYear(complete[complete.length - 1]!) + 1).toBe(2024);
      const n = (c: number) => sum(all.get(c)!);
      const hi = argmax(complete, n);
      const lo = argmin(complete, n);
      expect([years(hi), n(hi)]).toEqual(["1987–88", 713]);
      expect([years(lo), n(lo)]).toEqual(["2023–24", 274]);
      // The 1980s peak is commemorations: the share's high is 1985–86, and with them out the busiest Congress moves to 1973–74.
      const share = (c: number) => sum(commem.get(c) ?? []) / n(c);
      const top = argmax(complete, share);
      expect([years(top), pct(share(top))]).toEqual(["1985–86", 40]);
      const other = (c: number) => sum(noCommem.get(c)!);
      const hiOther = argmax(complete, other);
      expect([years(hiOther), other(hiOther)]).toEqual(["1973–74", 596]);
      // With them out the fewest is still 2023–24, so "the fewest" holds either way.
      expect(years(argmin(complete, other))).toBe("2023–24");
    },
  },
  support: {
    says: ["from 1981 through 2024", "peaking at 89% in 1985–86", "the one exception was 2021–22, at 48%", "Through 2024", "under 60% yes never reached 6%"],
    check: () => {
      const voice = (c: number) => all.get(c)![0]! / sum(all.get(c)!);
      const from1981 = complete.filter((c) => openYear(c) >= 1981);
      expect(openYear(from1981[0]!)).toBe(1981);
      const under = from1981.filter((c) => voice(c) <= 0.5);
      expect(under.map(years)).toEqual(["2021–22"]);
      expect(pct(voice(under[0]!))).toBe(48);
      const hi = argmax(complete, voice);
      expect([years(hi), pct(voice(hi))]).toEqual(["1985–86", 89]);
      // Without commemorations the exception is the same Congress, so the sentence reads the same either way.
      const voiceOther = (c: number) => noCommem.get(c)![0]! / sum(noCommem.get(c)!);
      expect(from1981.filter((c) => voiceOther(c) <= 0.5).map(years)).toEqual(["2021–22"]);
      // The band also holds laws with no passage method stated (most of the 1970s, hence "from 1981"). Counting only recorded voice
      // votes and consent, "most" still holds in every Congress from 1981 but the exception.
      for (const c of from1981.filter((x) => !under.includes(x))) {
        const recorded = laws.filter((l) => l.congress === c && l.band === 0 && l.house?.[0] !== 3 && l.senate?.[0] !== 3).length;
        expect(recorded / sum(all.get(c)!), years(c)).toBeGreaterThan(0.5);
      }
      // Under 60%: every complete Congress below 6%, and the closest to it above 5%, so "never reached 6%" is the tight bound.
      const close = (c: number) => all.get(c)![1]! / sum(all.get(c)!);
      const most = Math.max(...complete.map(close));
      expect(most).toBeLessThan(0.06);
      expect(most).toBeGreaterThan(0.05);
    },
  },
  groups: {
    says: ["Commemorations are the largest group", "a quarter of all laws", "their 1,066 in the 1980s are the most of any group in a decade", "Economy, taxes & trade laws had the most close votes", "9% passed with under 60% yes", "against 2% of all laws"],
    check: () => {
      const groups = [...new Set(meta.areas.map((a) => a.group))].filter((g) => g !== "not-classified");
      const total = (g: string) => sum(groupBands(g));
      expect(argmax(groups, total)).toBe(COMMEM);
      expect(pct(total(COMMEM) / sum(groupBands(null)))).toBe(25);
      // The heatmap's busiest cell of any group, by decade (the decade a Congress opened in).
      const byDecade = new Map<string, number>();
      for (const r of counts) {
        const key = `${groupOf.get(r.area_id)}|${Math.floor(openYear(r.congress) / 10) * 10}`;
        byDecade.set(key, (byDecade.get(key) ?? 0) + r.n);
      }
      const [topKey, topN] = [...byDecade].reduce((a, b) => (b[1] > a[1] ? b : a));
      expect([topKey, topN]).toEqual([`${COMMEM}|1980`, 1066]);
      const close = (g: string | null) => groupBands(g)[1]! / sum(groupBands(g));
      expect(argmax(groups, close)).toBe("economy-taxes-trade");
      expect(pct(close("economy-taxes-trade"))).toBe(9);
      expect(pct(close(null))).toBe(2);
    },
  },
};

describe("Laws card takeaways", () => {
  for (const [key, c] of Object.entries(cases) as [keyof typeof LAWS_TAKEAWAYS, (typeof cases)[keyof typeof LAWS_TAKEAWAYS]][]) {
    it(`${LAWS_TAKEAWAYS[key].title}: "${LAWS_TAKEAWAYS[key].takeaway.slice(0, 48)}…" holds`, () => {
      for (const phrase of c.says) expect(LAWS_TAKEAWAYS[key].takeaway).toContain(phrase);
      c.check();
    });
  }

  it("stays short: two sentences, at most 45 words", () => {
    for (const s of Object.values(LAWS_TAKEAWAYS)) {
      expect(s.takeaway.split(/(?<=[.;])\s/).filter((x) => x.endsWith(".")).length, s.title).toBeLessThanOrEqual(2);
      expect(s.takeaway.split(/\s+/).length, s.title).toBeLessThanOrEqual(45);
    }
  });
});

/**
 * The context lines (rule 7d). Facts from documents outside the pipeline are pinned to the phrases the lines use and to their
 * links: the 2023 Speaker elections are House History's multiple-ballot table (McCarthy "15" ballots, "January 3–7, 2023";
 * Johnson elected "October 17–25, 2023"), the vote vacating the chair is Clerk roll call 519 (H.Res. 757, October 3, 2023,
 * 216–210), the swearing-in rule is 2 U.S.C. 25 (the Speaker swears members in "previous to entering on any other business"),
 * and the 1995 rule's date is CRS's (report 98-662: "At the opening of the 104th Congress on January 4, 1995"). The counts are
 * checked here.
 */
const contextCases: Record<keyof typeof LAWS_CONTEXT, { says: string[]; links: Record<string, string>; check: () => void }> = {
  count: {
    says: ["The 2023–24 low", "took 15 ballots to elect a Speaker in January 2023", "by law no member could be sworn in before then", "In October it voted 216–210 to remove Speaker McCarthy", "went 22 days without one"],
    links: {
      "house-speaker-ballots": "history\\.house\\.gov/People/Office/Speakers-Multiple-Ballots/$",
      "house-roll-call-2023-519": "clerk\\.house\\.gov/Votes/2023519$",
      "usc-2-25": "uscode/text/2/25$",
    },
    check: () => {
      // The 118th Congress opened in January 2023 and is the takeaway's record low (2023–24), with commemorations in or out.
      expect(years(118)).toBe("2023–24");
      const n = (c: number) => sum(all.get(c)!);
      expect(argmin(complete, n)).toBe(118);
      expect(argmin(complete, (c) => sum(noCommem.get(c)!))).toBe(118);
      // October 3, 2023 (the vacating vote) to October 25, 2023 (Johnson's election).
      expect((Date.UTC(2023, 9, 25) - Date.UTC(2023, 9, 3)) / 86_400_000).toBe(22);
    },
  },
  groups: {
    says: ["On January 4, 1995, the House adopted a rule", "from 1,066 laws in the 1980s to 551 in the 1990s", "from 135 in 1993–94 to 42 in 1995–96"],
    links: { "crs-commemorative-legislation": "everycrsreport\\.com/reports/98-662" },
    check: () => {
      // The heatmap's commemorations row, by the decade a Congress opened in: the takeaway's 1980s peak, then the 1990s.
      const decade = (d: number) => counts.filter((r) => groupOf.get(r.area_id) === COMMEM && Math.floor(openYear(r.congress) / 10) * 10 === d).reduce((t, r) => t + r.n, 0);
      expect(decade(1980)).toBe(1066);
      expect(decade(1990)).toBe(551);
      // January 1995 opened the 104th Congress, the Congress that fell to 42.
      expect(years(104)).toBe("1995–96");
      expect(years(103)).toBe("1993–94");
      expect(sum(commem.get(103)!)).toBe(135);
      expect(sum(commem.get(104)!)).toBe(42);
    },
  },
};

describe("Laws context lines", () => {
  for (const [key, c] of Object.entries(contextCases) as [keyof typeof LAWS_CONTEXT, (typeof contextCases)[keyof typeof LAWS_CONTEXT]][]) {
    it(`${key}: holds and names real sources`, () => {
      for (const phrase of c.says) expect(LAWS_CONTEXT[key].text).toContain(phrase);
      expect(LAWS_CONTEXT[key].sources.map((s) => s.id).sort()).toEqual(Object.keys(c.links).sort());
      for (const [id, part] of Object.entries(c.links)) expect(SOURCE_LINKS[id as keyof typeof SOURCE_LINKS], id).toMatch(new RegExp(`^https://.*${part}`));
      c.check();
    });
  }

  it("every context line belongs to a card, stays short and makes no causal claim", () => {
    expect(Object.keys(LAWS_CONTEXT).sort()).toEqual(Object.keys(contextCases).sort());
    for (const [key, line] of Object.entries(LAWS_CONTEXT)) {
      expect(line.text.split(/(?<=\.)\s+(?=[A-Z])/).length, key).toBeLessThanOrEqual(2);
      expect(line.text.split(/\s+/).length, key).toBeLessThanOrEqual(45);
      expect(line.text, key).not.toMatch(/\b(because|due to|caused|led to|drove|thanks to|soared|plunged|fewer laws|more laws)\b/i);
    }
  });
});
