import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { congressControlFile, type CongressControlRow } from "./congress-control";
import { courtTermRow, justice, type CourtTermRow, type Justice } from "./court-entities";
import { decisionCaseRow, justiceVotesFile, ROLE_MAJORITY, VOTE_DISSENT, VOTE_MAJORITY, type DecisionCaseRow, type JusticeVotesFile } from "./decisions-entities";
import { administration, type Administration } from "./executive-orders-entities";
import { lawVotesShard, type LawVotesShard } from "./law-votes-entities";
import { lawRow, type LawRow } from "./laws-entities";
import { lawPath } from "./law-url";
import { timelineEventsFile, type TimelineEventsFile } from "./timeline-entities";
import { applyVacancyRule, TIMELINE_START } from "./timeline-derive";
import type { Side, TimelinePayload, TlCongress, TlEvent, TlJustice, TlLean, TlPresident, TlTally } from "./timeline-types";
import { HISTORICAL_ADMINISTRATIONS } from "./troops-presidents";

/**
 * Joins the hand-picked events in `pipeline/reference/timeline-events.json` to the pipeline at build time for /timeline:
 * presidents (`HISTORICAL_ADMINISTRATIONS` + `administrations.json`), Congress majorities and seats
 * (`reference/congress-control.json`), the Court (`court/justices.json`, `court/court_terms.json`), case votes
 * (`decisions_cases.json`, `court/justice_votes.json`) and law votes (`laws.json`, `law_votes/`, members' caucus from
 * `terms.json` on the day of the roll call, dated by Voteview's `raw/voteview/rollcalls_93on.json`). Nothing pre-joined is stored. Pure apart from `loadTimelineInputs`; the server-only reader is
 * `lib/timeline-data.ts`.
 */
export interface TimelineInputs {
  ref: TimelineEventsFile;
  administrations: Administration[];
  control: z.infer<typeof congressControlFile>;
  justices: Justice[];
  courtTerms: CourtTermRow[];
  cases: Map<string, DecisionCaseRow>;
  justiceVotes: JusticeVotesFile;
  laws: Map<string, LawRow>;
  lawVotes: Map<number, LawVotesShard>;
  /** `bioguide|congress|chamber` → caucus ("Democrat", "Republican", …), with the dated changes for a member who switched mid-Congress. */
  caucus: Map<string, { caucus: string | null; changes?: { start: string; caucus: string }[] }>;
  /** `congress|H|roll` → the roll call's date (Voteview), to place a member who switched parties mid-Congress. */
  rollDates: Map<string, string>;
}

const termCaucus = z.object({
  bioguide_id: z.string(),
  congress_number: z.number().int(),
  chamber: z.string(),
  caucus: z.string().nullable(),
  party_affiliations: z.array(z.object({ start: z.string(), party: z.string(), caucus: z.string().optional() })).optional(),
});

/** Reads and validates every input at the boundary (a bad file fails the build). `root` is the repo root. */
export function loadTimelineInputs(root = process.cwd()): TimelineInputs {
  const out = join(root, "pipeline", "output");
  const read = (...p: string[]): unknown => JSON.parse(readFileSync(join(out, ...p), "utf8"));
  const ref = timelineEventsFile.parse(JSON.parse(readFileSync(join(root, "pipeline", "reference", "timeline-events.json"), "utf8")));
  const laws = new Map(z.array(lawRow).parse(read("laws.json")).map((l) => [l.law_id, l]));
  const congresses = new Set<number>();
  for (const e of ref.events) if (e.kind === "law" && e.law_id && laws.has(e.law_id)) congresses.add(laws.get(e.law_id)!.congress);
  const lawVotes = new Map<number, LawVotesShard>();
  for (const c of congresses) if (existsSync(join(out, "law_votes", `${c}.json`))) lawVotes.set(c, lawVotesShard.parse(read("law_votes", `${c}.json`)));
  const caucus: TimelineInputs["caucus"] = new Map();
  for (const t of z.array(termCaucus).parse(read("terms.json")))
    if (congresses.has(t.congress_number))
      caucus.set(`${t.bioguide_id}|${t.congress_number}|${t.chamber}`, { caucus: t.caucus, ...(t.party_affiliations ? { changes: t.party_affiliations.map((a) => ({ start: a.start, caucus: a.caucus ?? a.party })) } : {}) });
  const rollDates = new Map<string, string>();
  const rollcall = z.tuple([z.number().int(), z.enum(["H", "S"]), z.number().int(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).rest(z.unknown());
  for (const [c, ch, roll, date] of z.array(rollcall).parse(JSON.parse(readFileSync(join(root, "pipeline", "raw", "voteview", "rollcalls_93on.json"), "utf8"))))
    if (congresses.has(c)) rollDates.set(`${c}|${ch}|${roll}`, date);
  return {
    ref,
    rollDates,
    administrations: z.array(administration).parse(read("administrations.json")),
    control: congressControlFile.parse(JSON.parse(readFileSync(join(root, "pipeline", "reference", "congress-control.json"), "utf8"))),
    justices: z.array(justice).parse(read("court", "justices.json")),
    courtTerms: z.array(courtTermRow).parse(read("court", "court_terms.json")),
    cases: new Map(z.array(decisionCaseRow).parse(read("decisions_cases.json")).map((c) => [c.case_id, c])),
    justiceVotes: justiceVotesFile.parse(read("court", "justice_votes.json")),
    laws,
    lawVotes,
    caucus,
  };
}

const side = (party: string): Side => (party.startsWith("Democrat") ? "D" : "R");

/** First day of a Congress (the 73rd opened on 4 March 1933; from the 74th, Congresses open on 3 January). */
export const congressStart = (n: number) => (n === 73 ? TIMELINE_START : `${1789 + 2 * (n - 1)}-01-03`);

export function buildPresidents(administrations: readonly Administration[]): TlPresident[] {
  const all = [...HISTORICAL_ADMINISTRATIONS, ...administrations].sort((a, b) => a.start.localeCompare(b.start));
  return all.map((a, i) => ({ name: a.president, party: side(a.party), start: a.start, end: all[i + 1]?.start ?? null }));
}

/** One row per Congress: its seats at the start (`seats`) and who held each chamber's majority (`rows`, by date). */
export function buildCongresses(control: { rows: readonly CongressControlRow[]; seats?: { congress: number; house: { D: number; R: number; other: number }; senate: { D: number; R: number; other: number } }[] }): TlCongress[] {
  const seats = control.seats ?? [];
  if (seats.length === 0) throw new Error("timeline: congress-control.json has no seat counts");
  const rowsOf = (ch: "house" | "senate") => control.rows.filter((r) => r.chamber === ch).sort((a, b) => a.from.localeCompare(b.from));
  const at = (ch: "house" | "senate", iso: string) => {
    const r = rowsOf(ch).find((x) => x.from <= iso && (x.to === null || x.to >= iso));
    if (!r) throw new Error(`timeline: no ${ch} majority on ${iso}`);
    return r.party;
  };
  return seats.map((s) => {
    const start = congressStart(s.congress);
    const end = congressStart(s.congress + 1);
    // The Senate majority at the start, then every change inside the Congress (2001, 2021).
    const senateMaj: [string, Side][] = [[start, at("senate", start)]];
    for (const r of rowsOf("senate")) if (r.from > start && r.from < end) senateMaj.push([r.from, r.party]);
    return {
      n: s.congress,
      start,
      end,
      house: [s.house.D, s.house.R, s.house.other],
      senate: [s.senate.D, s.senate.R, s.senate.other],
      senateMaj,
      houseMaj: at("house", start),
    };
  });
}

export function buildJustices(justices: readonly Justice[], extra: TimelineEventsFile["extra_justices"]): TlJustice[] {
  const rows: TlJustice[] = justices.map((j) => ({ id: j.justice_id, name: j.name.last, full: j.name.full, party: side(j.appointing_party), by: j.appointing_president, start: j.service_start, end: j.service_end }));
  extra.forEach((j, i) => rows.push({ id: -1 - i, name: j.last, full: j.full, party: side(j.appointing_party), by: j.appointing_president, start: j.service_start, end: j.service_end }));
  return rows;
}

/** The median justice of each term. A term split into segments (a justice joined or left mid-term) keeps the later segment, the one sitting at the term's end. */
export function buildLean(terms: readonly CourtTermRow[], justices: readonly TlJustice[]): TlLean[] {
  const byTerm = new Map<number, CourtTermRow>();
  for (const t of terms) {
    const had = byTerm.get(t.term);
    if (!had || (t.segment ?? "") > (had.segment ?? "")) byTerm.set(t.term, t);
  }
  const name = new Map(justices.map((j) => [j.id, j.name]));
  return [...byTerm.values()].sort((a, b) => a.term - b.term).map((t) => [t.term, Math.round(t.median_score * 1000) / 1000, name.get(t.median_justice_id) ?? null]);
}

const count = (js: readonly TlJustice[]) => {
  const n: Partial<Record<Side, number>> = {};
  for (const j of js) n[j.party] = (n[j.party] ?? 0) + 1;
  return n;
};

/** Final-passage yes / no votes by caucus in each chamber with a recorded member vote. */
function lawSplit(law: LawRow, inputs: TimelineInputs): TlEvent["split"] | undefined {
  const shard = inputs.lawVotes.get(law.congress);
  const rec = shard?.laws[law.law_id];
  if (!shard || !rec) return undefined;
  const out: NonNullable<TlEvent["split"]> = {};
  for (const [key, chamber] of [["H", "house"], ["S", "senate"]] as const) {
    const votes = rec[key];
    if (!votes) continue;
    const tally: TlTally = { D: [0, 0], R: [0, 0] };
    const day = inputs.rollDates.get(`${law.congress}|${key}|${votes[0]}`) ?? law.date;
    shard.rosters[key].forEach((bio, i) => {
      const cast = votes[1][i];
      if (bio === "" || (cast !== "1" && cast !== "2")) return;
      const m = inputs.caucus.get(`${bio}|${law.congress}|${chamber}`);
      // A member who switched mid-Congress counts with the caucus they sat with on the day of the vote (Specter, a Democrat by the
      // December 2009 health-care vote; Jeffords, still a Republican on the May 2001 tax-cut vote).
      const c = m?.changes ? m.changes.filter((a) => a.start <= day).pop()?.caucus : m?.caucus;
      const p = c?.startsWith("Democrat") ? "D" : c === "Republican" ? "R" : null;
      if (p) tally[p][cast === "1" ? 0 : 1]++;
    });
    out[chamber] = tally;
  }
  return out;
}

/** The whole page payload. `today` is the build date (the timeline's right edge). */
export function buildTimelinePayload(inputs: TimelineInputs, today: string): TimelinePayload {
  const { ref } = inputs;
  const rawJustices = buildJustices(inputs.justices, ref.extra_justices);
  const justices = applyVacancyRule(rawJustices);
  const byId = new Map(rawJustices.map((j) => [j.id, j]));
  // Each justice's vote on the listed cases only.
  const wanted = new Set(ref.events.flatMap((e) => (e.kind === "case" && e.case_id ? [e.case_id] : [])));
  const votes = new Map<string, [number, number, number][]>();
  for (const [jid, rows] of Object.entries(inputs.justiceVotes))
    for (const [cid, v, role] of rows) if (wanted.has(cid)) votes.set(cid, [...(votes.get(cid) ?? []), [Number(jid), v, role]]);

  const events: Omit<TlEvent, "no">[] = ref.events.map((e) => {
    const base = { id: e.id, kind: e.kind, name: e.name, what: e.what, wiki: e.wiki };
    if (e.kind === "case") {
      if (e.case_id) {
        const c = inputs.cases.get(e.case_id);
        if (!c) throw new Error(`timeline: ${e.id}: case ${e.case_id} is not in decisions_cases.json`);
        const rows = votes.get(e.case_id) ?? [];
        const pick = (v: number) => rows.filter(([j, vote]) => vote === v && byId.has(j)).map(([j]) => byId.get(j)!);
        const author = rows.find(([j, , role]) => role === ROLE_MAJORITY && byId.has(j));
        return { ...base, date: e.date ?? c.date, vote: `${c.maj}–${c.min}`, ...(author ? { author: byId.get(author[0])!.name } : {}), majority: count(pick(VOTE_MAJORITY)), dissent: count(pick(VOTE_DISSENT)) };
      }
      // Before 1946: the bench that day (the recorded service dates, no vacancy rule) split by the hand-entered dissenters.
      const date = e.date!;
      const hand = e.hand_vote!;
      const bench = rawJustices.filter((j) => j.start <= date && (j.end === null || j.end >= date));
      const dis = bench.filter((j) => hand.dissenters.includes(j.name));
      if (dis.length !== hand.dissenters.length) throw new Error(`timeline: ${e.id}: dissenters ${hand.dissenters.join(", ")} not all on the bench on ${date}`);
      return { ...base, date, vote: hand.vote, voteHand: true, majority: count(bench.filter((j) => !dis.includes(j))), dissent: count(dis) };
    }
    if (e.law_id && inputs.laws.has(e.law_id)) {
      const law = inputs.laws.get(e.law_id)!;
      if (e.date && e.date !== law.date) throw new Error(`timeline: ${e.id}: date ${e.date} disagrees with laws.json's ${law.date}`);
      const split = lawSplit(law, inputs);
      return { ...base, date: law.date, lawPath: lawPath(law.law_id, law.title), ...(split ? { split } : {}), ...(law.veto_override ? { override: true } : {}) };
    }
    if (!e.date) throw new Error(`timeline: ${e.id}: no date, and ${e.law_id} is not in laws.json`);
    return { ...base, date: e.date, ...(e.hand_split ? { split: e.hand_split, splitHand: true } : {}) };
  });

  // Numbered in date order; the file's order breaks ties.
  const numbered: TlEvent[] = events
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.date.localeCompare(b.e.date) || a.i - b.i)
    .map(({ e }, k) => ({ ...e, no: k + 1 }));
  const byEvent = new Map(numbered.map((e) => [e.id, e]));
  for (const t of ref.tested) {
    byEvent.get(t.law)!.tested = { id: t.case, text: t.outcome };
    byEvent.get(t.case)!.ruledOn = { id: t.law, text: t.outcome };
  }
  for (const l of ref.case_links) {
    const earlier = byEvent.get(l.earlier)!;
    const later = byEvent.get(l.later)!;
    (earlier.laterCases ??= []).push({ id: l.later, text: l.did });
    (later.earlierCases ??= []).push({ id: l.earlier, text: l.did });
  }

  const presidents = buildPresidents(inputs.administrations);
  const congresses = buildCongresses(inputs.control);
  const first = numbered[0]!.date;
  if (first < TIMELINE_START) throw new Error(`timeline: event ${numbered[0]!.id} (${first}) is before ${TIMELINE_START}`);
  return { today, reviewed: ref.last_reviewed, presidents, congresses, justices, lean: buildLean(inputs.courtTerms, rawJustices), events: numbered };
}
