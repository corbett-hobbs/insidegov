import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IDEOLOGY_CONTEXT, IDEOLOGY_TAKEAWAYS } from "../components/senate/takeaways";
import { SOURCE_LINKS } from "./source-links";
import { congressStartYear, partyGroup, type PartyGroup } from "./congress-types";

/**
 * Every figure a Congress ideology card's takeaway cites, checked against the
 * committed pipeline output. lib/congress-data.ts and lib/committee-data.ts
 * are "server-only" and throw under vitest, so their joins are reproduced here
 * from the same files: a term joined to its Congress's ideology score, the
 * Voteview origin sentinel treated as unscored, and only scores resting on 10+
 * votes plotted (isPlottable). A data refresh that makes a sentence untrue
 * fails here: rewrite the takeaway in components/senate/takeaways.ts, then
 * this check.
 */

type Chamber = "house" | "senate";
type View = Chamber | "both";
type Term = { bioguide_id: string; congress_number: number; chamber: Chamber; state: string; party: string | null; caucus: string | null };
type Score = { bioguide_id: string; congress_number: number; chamber: Chamber; nokken_poole_dim1: number | null; nokken_poole_dim2: number | null; n_votes: number | null };
type Committee = { committee_id: string; short_name: string; chamber: Chamber | "joint" };
type Seat = { committee_id: string; bioguide_id: string };
type Member = { id: string; chamber: Chamber; state: string; group: PartyGroup; dim1: number | null; dim2: number | null; nVotes: number | null };

const read = <T,>(name: string) => JSON.parse(readFileSync(`pipeline/output/${name}`, "utf8")) as T[];
const legislators = new Set(read<{ bioguide_id: string }>("legislators.json").map((l) => l.bioguide_id));
const scoreByKey = new Map(read<Score>("ideology_scores.json").map((s) => [`${s.chamber}:${s.bioguide_id}:${s.congress_number}`, s]));

const byCongress: Record<Chamber, Map<number, Member[]>> = { house: new Map(), senate: new Map() };
for (const t of read<Term>("terms.json")) {
  if (!legislators.has(t.bioguide_id)) continue;
  const s = scoreByKey.get(`${t.chamber}:${t.bioguide_id}:${t.congress_number}`);
  const sentinel = s?.nokken_poole_dim1 === 0 && s?.nokken_poole_dim2 === 0;
  const members = byCongress[t.chamber].get(t.congress_number) ?? [];
  members.push({
    id: t.bioguide_id,
    chamber: t.chamber,
    state: t.state,
    group: partyGroup(t.caucus ?? t.party ?? "Unknown", t.congress_number),
    dim1: sentinel ? null : (s?.nokken_poole_dim1 ?? null),
    dim2: sentinel ? null : (s?.nokken_poole_dim2 ?? null),
    nVotes: s?.n_votes ?? null,
  });
  byCongress[t.chamber].set(t.congress_number, members);
}

const plottable = (m: Member) => m.dim1 != null && m.dim2 != null && (m.nVotes ?? 0) >= 10;
const chambersOf = (v: View): Chamber[] => (v === "both" ? ["house", "senate"] : [v]);
const shown = (v: View, congress: number) => chambersOf(v).flatMap((c) => (byCongress[c].get(congress) ?? []).filter(plottable));
const latest = Math.max(...byCongress.house.keys(), ...byCongress.senate.keys());
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
const dim1s = (ms: Member[], g: PartyGroup) => ms.filter((m) => m.group === g).map((m) => m.dim1 as number);

/** The distance between the party-mean lines, every Congress both parties have a line. */
function gaps(v: View) {
  const congresses = [...new Set(chambersOf(v).flatMap((c) => [...byCongress[c].keys()]))].sort((a, b) => a - b);
  return congresses.flatMap((c) => {
    const ms = shown(v, c);
    const dem = dim1s(ms, "dem");
    const rep = dim1s(ms, "rep");
    return dem.length && rep.length ? [{ year: congressStartYear(c), gap: mean(rep) - mean(dem) }] : [];
  });
}
const gapIn = (g: ReturnType<typeof gaps>, year: number) => g.find((x) => x.year === year)!.gap;
const widenedInMost = (g: ReturnType<typeof gaps>, from: number) => {
  const after = g.filter((x) => x.year >= from);
  const ups = after.filter((x) => x.gap > g[g.indexOf(x) - 1].gap).length;
  expect(ups, `widened in ${ups} of ${after.length} Congresses from ${from}`).toBeGreaterThan(after.length / 2);
};
const lowYear = (g: ReturnType<typeof gaps>) => g.reduce((a, b) => (b.gap < a.gap ? b : a)).year;
const stayedNear = (g: ReturnType<typeof gaps>, from: number, to: number) => {
  const low = Math.min(...g.map((x) => x.gap));
  for (const x of g.filter((x) => x.year >= from && x.year <= to)) expect(x.gap - low, `${x.year}`).toBeLessThan(0.07);
};
const ranked = (g: ReturnType<typeof gaps>) => [...g].sort((a, b) => b.gap - a.gap).map((x) => x.year);

/** Delegations as the "How each state votes" card builds them (DelegationChart). */
const NON_STATES = new Set(["DC", "PR", "GU", "VI", "AS", "MP"]);
function rangeRows(v: View) {
  const byState = new Map<string, Member[]>();
  for (const m of shown(v, latest)) byState.set(m.state, [...(byState.get(m.state) ?? []), m]);
  return [...byState].map(([state, ms]) => ({
    state,
    mixed: ms.some((m) => m.group === "dem") && ms.some((m) => m.group === "rep"),
    gap: spread(ms.map((m) => m.dim1 as number)),
  }));
}
function senatePairs() {
  const byState = new Map<string, Member[]>();
  for (const m of shown("senate", latest)) byState.set(m.state, [...(byState.get(m.state) ?? []), m]);
  return [...byState].map(([state, ms]) => {
    const [a, b] = [...ms].sort((x, y) => (y.nVotes ?? 0) - (x.nVotes ?? 0)).slice(0, 2);
    return { state, split: a.group !== b.group, gap: Math.abs((a.dim1 as number) - (b.dim1 as number)) };
  });
}
function mixedWiderThanOneParty(v: View) {
  const rows = rangeRows(v);
  const mixed = rows.filter((r) => r.mixed);
  expect(Math.min(...mixed.map((r) => r.gap))).toBeGreaterThan(Math.max(...rows.filter((r) => !r.mixed).map((r) => r.gap)));
  return { mixedStates: mixed.filter((r) => !NON_STATES.has(r.state)).length, widest: [...rows].sort((a, b) => b.gap - a.gap)[0].state };
}

/** Committees as lib/committee-data.ts blends them: every seat joined to its member's latest-Congress score (Senate first). */
const memberIndex = new Map<string, Member>();
for (const c of ["senate", "house"] as const) for (const m of byCongress[c].get(latest) ?? []) if (!memberIndex.has(m.id)) memberIndex.set(m.id, m);
const seats = read<Seat>("committee_memberships.json");
const committees = read<Committee>("committees.json").map((c) => {
  const roster = seats.filter((s) => s.committee_id === c.committee_id).map((s) => memberIndex.get(s.bioguide_id)).filter((m): m is Member => m != null);
  const scored = roster.filter(plottable);
  const xs = scored.map((m) => m.dim1 as number);
  return {
    name: c.short_name,
    chamber: c.chamber,
    blend: Math.round(mean(xs) * 1000) / 1000,
    spread: Math.round(spread(xs) * 100) / 100,
    dems: roster.filter((m) => m.group === "dem").length,
    reps: roster.filter((m) => m.group === "rep").length,
    separated: Math.max(...dim1s(scored, "dem")) < Math.min(...dim1s(scored, "rep")),
  };
});
const committeesIn = (v: View) => committees.filter((c) => v === "both" || c.chamber === v);
const named = (c: { name: string; chamber: string }) => (c.name.startsWith("Select Subcommittee to Investigate the Remaining Questions Surrounding January 6") ? "January 6" : c.name);
const byBlend = (v: View) => [...committeesIn(v)].sort((a, b) => a.blend - b.blend);
const bySpread = (v: View) => [...committeesIn(v)].sort((a, b) => b.spread - a.spread);

type Key = keyof typeof IDEOLOGY_TAKEAWAYS;
const cases: Record<Key, Record<View, { says: string[]; check: () => void }>> = {
  members: Object.fromEntries(
    (["both", "senate", "house"] as const).map((v) => [
      v,
      {
        says: ["In the 119th Congress", "left of the center line", "every Republican right of it", "don't overlap", "Republicans spread across a wider range than Democrats"],
        check: () => {
          const ms = shown(v, latest);
          expect(ms.every((m) => m.group !== "other")).toBe(true);
          expect(Math.max(...dim1s(ms, "dem"))).toBeLessThan(0);
          expect(Math.min(...dim1s(ms, "rep"))).toBeGreaterThan(0);
          expect(spread(dim1s(ms, "rep"))).toBeGreaterThan(spread(dim1s(ms, "dem")));
        },
      },
    ]),
  ) as Record<View, { says: string[]; check: () => void }>,
  states: {
    both: {
      says: ["30 states send members of both parties", "spans a wider range than any one-party delegation", "Texas's spans the widest"],
      check: () => expect(mixedWiderThanOneParty("both")).toEqual({ mixedStates: 30, widest: "TX" }),
    },
    senate: {
      says: ["47 states have two senators who caucus with the same party", "Only Maine, Pennsylvania and Wisconsin split", "Wisconsin's pair sits farthest apart"],
      check: () => {
        const pairs = senatePairs();
        expect(pairs).toHaveLength(50);
        expect(pairs.filter((p) => p.split).map((p) => p.state).sort()).toEqual(["ME", "PA", "WI"]);
        expect([...pairs].sort((a, b) => b.gap - a.gap)[0].state).toBe("WI");
      },
    },
    house: {
      says: ["29 states send House delegations with members of both parties", "each spans a wider range than any one-party delegation", "Texas's spans the widest"],
      check: () => expect(mixedWiderThanOneParty("house")).toEqual({ mixedStates: 29, widest: "TX" }),
    },
  },
  committees: {
    both: {
      says: ["every committee's members average out right of the center line", "Senate Environment and Public Works sits closest to center", "January 6 select subcommittee sits farthest right"],
      check: () => {
        const cs = byBlend("both");
        expect(cs[0].blend).toBeGreaterThan(0);
        expect([cs[0].chamber, cs[0].name]).toEqual(["senate", "Environment and Public Works"]);
        expect(named(cs.at(-1)!)).toBe("January 6");
        expect(cs.at(-1)!.chamber).toBe("house");
      },
    },
    senate: {
      says: ["every Senate committee's members average out right of the center line", "Environment and Public Works sits closest to center", "Homeland Security and Governmental Affairs sits farthest right"],
      check: () => {
        const cs = byBlend("senate");
        expect(cs[0].blend).toBeGreaterThan(0);
        expect(cs[0].name).toBe("Environment and Public Works");
        expect(cs.at(-1)!.name).toBe("Homeland Security and Governmental Affairs");
      },
    },
    house: {
      says: ["every House committee's members average out right of the center line", "Ethics, split evenly between the parties, sits closest to center", "January 6 select subcommittee sits farthest right"],
      check: () => {
        const cs = byBlend("house");
        expect(cs[0].blend).toBeGreaterThan(0);
        expect(cs[0].name).toBe("Ethics");
        expect(cs[0].dems).toBe(cs[0].reps);
        expect(named(cs.at(-1)!)).toBe("January 6");
      },
    },
  },
  committeeSpread: {
    both: {
      says: ["On every committee in the 119th Congress, each Republican member sits to the right of each Democrat", "Senate Armed Services and Aging span the widest range", "Commission on Security and Cooperation in Europe spans the narrowest"],
      check: () => {
        const cs = bySpread("both");
        expect(cs.every((c) => c.separated)).toBe(true);
        const top = cs.filter((c) => c.spread === cs[0].spread);
        expect(top.map((c) => `${c.chamber} ${c.name}`).sort()).toEqual(["senate Aging", "senate Armed Services"]);
        expect(cs.at(-1)!.name).toBe("Commission on Security and Cooperation in Europe");
        expect(cs.at(-2)!.spread).toBeGreaterThan(cs.at(-1)!.spread);
      },
    },
    senate: {
      says: ["On every Senate committee in the 119th Congress, each Republican member sits to the right of each Democrat", "Armed Services and Aging span the widest range", "Ethics spans the narrowest"],
      check: () => {
        const cs = bySpread("senate");
        expect(cs.every((c) => c.separated)).toBe(true);
        expect(cs.filter((c) => c.spread === cs[0].spread).map((c) => c.name).sort()).toEqual(["Aging", "Armed Services"]);
        expect(cs.at(-1)!.name).toBe("Ethics");
        expect(cs.at(-2)!.spread).toBeGreaterThan(cs.at(-1)!.spread);
      },
    },
    house: {
      says: ["On every House committee in the 119th Congress, each Republican member sits to the right of each Democrat", "Budget spans the widest range", "House Administration spans the narrowest"],
      check: () => {
        const cs = bySpread("house");
        expect(cs.every((c) => c.separated)).toBe(true);
        expect(cs[0].name).toBe("Budget");
        expect(cs[0].spread).toBeGreaterThan(cs[1].spread);
        expect(cs.at(-1)!.name).toBe("House Administration");
        expect(cs.at(-2)!.spread).toBeGreaterThan(cs.at(-1)!.spread);
      },
    },
  },
  trend: {
    both: {
      says: ["narrowest in 1947", "stayed near that low through the 1970s", "widened in most Congresses after that", "within 0.01 of its 1903 peak in 2025"],
      check: () => {
        const g = gaps("both");
        expect(lowYear(g)).toBe(1947);
        stayedNear(g, 1947, 1979);
        widenedInMost(g, 1981);
        expect(ranked(g)[0]).toBe(1903);
        expect(gapIn(g, 1903) - gapIn(g, 2025)).toBeLessThan(0.01);
      },
    },
    senate: {
      says: ["In the Senate", "narrowest in 1939", "stayed near that low through the 1950s", "widened in most Congresses after that", "its two widest gaps came in 2023 and 2025"],
      check: () => {
        const g = gaps("senate");
        expect(lowYear(g)).toBe(1939);
        stayedNear(g, 1939, 1959);
        widenedInMost(g, 1961);
        expect(ranked(g).slice(0, 2).sort()).toEqual([2023, 2025]);
      },
    },
    house: {
      says: ["In the House", "narrowest in 1967", "from the late 1930s through the 1970s", "widened in most Congresses after that", "only 1903's gap was wider than 2025's"],
      check: () => {
        const g = gaps("house");
        expect(lowYear(g)).toBe(1967);
        stayedNear(g, 1937, 1979);
        widenedInMost(g, 1981);
        expect(ranked(g).slice(0, 2)).toEqual([1903, 2025]);
      },
    },
  },
};

describe("Congress ideology card takeaways", () => {
  it("describe the 119th Congress, the latest in the data", () => {
    expect(latest).toBe(119);
    expect(congressStartYear(latest)).toBe(2025);
  });

  for (const key of Object.keys(cases) as Key[]) {
    for (const view of ["both", "senate", "house"] as const) {
      const text = IDEOLOGY_TAKEAWAYS[key].byView[view];
      it(`${IDEOLOGY_TAKEAWAYS[key].title} (${view}): "${text.slice(0, 48)}…" holds`, () => {
        for (const phrase of cases[key][view].says) expect(text).toContain(phrase);
        cases[key][view].check();
      });
    }
  }

  it("stays short: two sentences, at most 45 words", () => {
    for (const { title, byView } of Object.values(IDEOLOGY_TAKEAWAYS)) {
      for (const [view, text] of Object.entries(byView)) {
        expect(text.split(/(?<=\.)\s/).length, `${title} (${view})`).toBeLessThanOrEqual(2);
        expect(text.split(/\s+/).length, `${title} (${view})`).toBeLessThanOrEqual(45);
      }
    }
  });
});

/**
 * The trend card's context lines (rule 7d), one per chamber view. The statutes' years are pinned to their phrases and Statutes at
 * Large links (78 Stat. 241, 79 Stat. 437); "first time since 1952" is House History's party-divisions table, checked here against
 * the terms too. The shares count every member a former Confederate state sent in that Congress (caucus, else party), from terms.json
 * joined to legislators.json as above.
 */
const SOUTH = new Set(["AL", "AR", "FL", "GA", "LA", "MS", "NC", "SC", "TN", "TX", "VA"]);
const rawTerms = read<Term>("terms.json").filter((t) => legislators.has(t.bioguide_id));
const label = (t: Term) => t.caucus ?? t.party;
const southDemShare = (v: View, congress: number) => {
  const ts = rawTerms.filter((t) => t.congress_number === congress && SOUTH.has(t.state) && chambersOf(v).includes(t.chamber));
  return Math.round((100 * ts.filter((t) => label(t) === "Democrat").length) / ts.length);
};
const houseMajority = (congress: number) => {
  const ts = rawTerms.filter((t) => t.chamber === "house" && t.congress_number === congress);
  const r = ts.filter((t) => label(t) === "Republican").length;
  const d = ts.filter((t) => label(t) === "Democrat").length;
  return r > d ? "R" : "D";
};
const LINKS = {
  "civil-rights-act-1964": "STATUTE-78-Pg241\\.pdf$",
  "voting-rights-act-1965": "STATUTE-79-Pg437\\.pdf$",
  "house-party-division": "history\\.house\\.gov/.*Party-Divisions",
};
const contextCases: Record<View, [number, number]> = { both: [90, 48], senate: [96, 41], house: [89, 49] };

describe("Congress ideology context lines", () => {
  it("only the trend card has one", () => expect(Object.keys(IDEOLOGY_CONTEXT)).toEqual(["trend"]));

  for (const [view, [from, to]] of Object.entries(contextCases) as [View, [number, number]][]) {
    it(`trend (${view}): holds and names real sources`, () => {
      const line = IDEOLOGY_CONTEXT.trend[view];
      for (const phrase of ["the Civil Rights Act in 1964", "the Voting Rights Act in 1965", "11 former Confederate states", `were ${from}%`, `in 1963 and ${to}% in 1995`, "won the House in 1994 for the first time since 1952"])
        expect(line.text).toContain(phrase);
      expect(congressStartYear(88)).toBe(1963);
      expect(congressStartYear(104)).toBe(1995);
      expect(southDemShare(view, 88)).toBe(from);
      expect(southDemShare(view, 104)).toBe(to);
      // Republicans took the House in the 104th, last held it in the 83rd (elected 1952), and not in between.
      expect(houseMajority(104)).toBe("R");
      expect(houseMajority(83)).toBe("R");
      for (let c = 84; c <= 103; c++) expect(houseMajority(c), `${c}`).toBe("D");
      expect(line.sources.map((s) => s.id).sort()).toEqual(Object.keys(LINKS).sort());
      for (const [id, part] of Object.entries(LINKS)) expect(SOURCE_LINKS[id as keyof typeof SOURCE_LINKS], id).toMatch(new RegExp(`^https://.*${part}`));
    });
  }

  it("stays short and makes no causal or labelling claim", () => {
    for (const [view, line] of Object.entries(IDEOLOGY_CONTEXT.trend)) {
      expect(line.text.split(/(?<=\.)\s+(?=[A-Z])/).length, view).toBeLessThanOrEqual(2);
      expect(line.text.split(/\s+/).length, view).toBeLessThanOrEqual(45);
      expect(line.text, view).not.toMatch(/\b(because|due to|caused|led to|drove|thanks to|extreme|radical|polariz\w*)\b/i);
    }
  });
});
