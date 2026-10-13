import { LAW_ACTION_TYPES, type LawAction, type LawActionVote, type LawAmendment, type LawCosponsor, type LawDetail, type LawRelatedBill } from "../../lib/law-details-entities";
import type { RawLawExtras } from "../../lib/law-extras-entities";
import type { RawAction, RawLaw } from "../../lib/laws-entities";
import { decode } from "./laws-summary";

/**
 * Law-details transform logic (pure): the CRS summary as paragraphs and the action list, one record per law.
 * Nothing here invents text: paragraphs are the summary's own, cut at the markup, and an action keeps its own wording
 * minus the Congressional Record page references in trailing brackets. See `docs/LAWS_METHODOLOGY.md` ("Law pages").
 */

/** The fetchers keep at most this many characters of a summary's HTML (`SUMMARY_CAP` in `pipeline/fetch/laws-raw.ts`). */
export const RAW_SUMMARY_CAP = 3000;

/** A raw summary at the cap was cut by the fetcher, not by CRS. */
export const summaryWasCut = (html: string): boolean => html.length >= RAW_SUMMARY_CAP;

/** A paragraph that is only a stage note, "(LATEST SUMMARY)" or "(Measure passed House, amended)": not part of what the law does. */
const STAGE_NOTE_ONLY = /^\((?:latest summary|(?:this )?measure [^()]*|conference report[^()]*|reported[^()]*|passed[^()]*|introduced[^()]*)\)$/i;

/**
 * Plain paragraphs of a CRS summary: block tags become breaks, other tags are dropped, entities decoded, whitespace
 * collapsed. A leading all-bold paragraph (the law's name, which the page already shows) is dropped. When the fetcher cut
 * the summary, the last paragraph is trimmed back to its last finished sentence so it never ends mid-word.
 */
export function summaryParagraphs(html: string, cap: number = RAW_SUMMARY_CAP): { paragraphs: string[]; cut: boolean } {
  const cut = html.length >= cap;
  let h = html.replace(/^\s*<p>\s*<strong>[\s\S]*?<\/strong>\s*<\/p>/i, " ").replace(/^\s*<strong>[\s\S]*?<\/strong>/i, " ");
  h = h.replace(/<(?:\/?(?:p|div|ul|ol|h\d)|br\s*\/?)>/gi, "\u0001").replace(/<li>/gi, "\u0001• ").replace(/<\/li>/gi, "\u0001");
  h = h.replace(/<[^>]+>/g, "");
  const paragraphs = decode(h)
    .split("\u0001")
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0 && p !== "\u2022" && !STAGE_NOTE_ONLY.test(p));
  const untrimmed = [...paragraphs];
  // Cut by the fetcher: end on a finished sentence, dropping a trailing fragment or heading ("Subtitle E: Other Matters") with it.
  while (cut && paragraphs.length > 0) {
    const last = paragraphs[paragraphs.length - 1]!;
    if (/[.!?]["”')\]]*$/.test(last)) break;
    const end = Math.max(...[". ", "? ", "! "].map((x) => last.lastIndexOf(x)));
    if (end > 0) {
      paragraphs[paragraphs.length - 1] = last.slice(0, end + 1);
      break;
    }
    paragraphs.pop();
  }
  // A summary that opens with a long table of contents has no finished sentence in its first 3,000 characters: show what there is.
  return { paragraphs: paragraphs.length > 0 ? paragraphs : untrimmed, cut };
}

const PREFIX = /^Passed\/agreed to in (?:the )?(?:House|Senate):\s*/i;
/** Trailing Congressional Record references: "(consideration: CR S6003; text: CR S6003)", "(text of conference report: CR H1)". */
const CR_REFS = /\s*\((?:consideration|text)[^():]*:[^)]*\)\s*$/i;

/** An action's wording as the page shows it: the Library of Congress "Passed/agreed to in House:" prefix and the record references cut. */
export function cleanActionText(text: string): string {
  let t = text.trim().replace(PREFIX, "");
  for (let i = 0; i < 3 && CR_REFS.test(t); i++) t = t.replace(CR_REFS, "");
  return t.trim();
}

const TYPE_CODE = new Map<string, number>(LAW_ACTION_TYPES.map((t, i) => [t, i]));
const CHAMBER_CODE = { House: 0, Senate: 1 } as const;

/**
 * The action list, oldest first (introduction and committee steps first on a shared date). The source lists many actions twice (the House or Senate's own entry and the Library of
 * Congress copy that starts "Passed/agreed to in House:", or a President and a BecameLaw entry with the same text): two
 * actions on the same date with the same cleaned text are one, keeping the first type seen and merging their roll calls.
 */
export function buildActions(actions: readonly RawAction[]): LawAction[] {
  const out = new Map<string, { date: string; type: number; text: string; votes: LawActionVote[] }>();
  for (const a of actions) {
    const text = cleanActionText(a.text);
    if (!text) continue;
    const key = `${a.date}|${text}`;
    const cur = out.get(key) ?? { date: a.date, type: TYPE_CODE.get(a.type) ?? LAW_ACTION_TYPES.indexOf("NotUsed"), text, votes: [] };
    for (const v of a.votes ?? []) {
      const t: LawActionVote = [CHAMBER_CODE[v.chamber], v.roll, v.session];
      if (!cur.votes.some((x) => x[0] === t[0] && x[1] === t[1])) cur.votes.push(t);
    }
    out.set(key, cur);
  }
  return [...out.values()]
    .map((a, i) => ({ a, i }))
    .sort((x, y) => x.a.date.localeCompare(y.a.date) || x.i - y.i)
    .map(({ a }): LawAction => (a.votes.length > 0 ? [a.date, a.type, a.text, a.votes] : [a.date, a.type, a.text]));
}

/** The source's step names (any capitalisation) -> the phrase before the committee's name. Anything else ("Unknown", letters of interest) is not shown. */
const COMMITTEE_STEP = new Map<string, string>([
  ["referred to", "Referred to"],
  ["re-referred to", "Re-referred to"],
  ["re-committed to", "Re-committed to"],
  ["markup by", "Markup by"],
  ["reported by", "Reported by"],
  ["reported original measure", "Reported original measure by"],
  ["discharged from", "Discharged from"],
  ["hearings by", "Hearings by"],
  ["hearings by (full committee)", "Hearings by"],
  ["hearings by (subcommittee)", "Hearings by"],
]);

/** "House Ways and Means Committee": the chamber in front unless the name already starts with it or the committee is joint or unplaced. */
export function committeeLabel(name: string, chamber: string | null): string {
  if (chamber !== "House" && chamber !== "Senate") return name;
  return name.startsWith(chamber) ? name : `${chamber} ${name}`;
}

/**
 * The bill's dated committee and subcommittee steps and its introduction, as action rows (committee-level detail kept: which
 * committee, which subcommittee, what it did, when). A step with no date, or one the source names something we do not word, is left out.
 */
export function committeeActions(law: RawLaw): RawAction[] {
  const out: RawAction[] = [];
  if (law.introduced) out.push({ date: law.introduced, type: "Introduced", text: law.origin_chamber ? `Introduced in the ${law.origin_chamber}` : "Introduced", src: null });
  for (const c of law.committees) {
    const parent = committeeLabel(c.name, c.chamber);
    for (const a of c.activities) {
      const phrase = COMMITTEE_STEP.get(a.name.trim().toLowerCase());
      if (phrase && a.date) out.push({ date: a.date, type: "Committee", text: `${phrase} ${parent}`, src: null });
    }
    for (const s of c.subcommittees) {
      for (const a of s.activities) {
        const phrase = COMMITTEE_STEP.get(a.name.trim().toLowerCase());
        if (phrase && a.date) out.push({ date: a.date, type: "Committee", text: `${phrase} ${s.name} of the ${parent}`, src: null });
      }
    }
  }
  return out;
}

/** Committee steps the source's action list does not carry: dated hearings. (Referral, markup, report and discharge are actions of their own.) */
const HEARING = /^hearings by/i;
export function hearingActions(law: RawLaw): RawAction[] {
  return committeeActions(law).filter((a) => a.type === "Committee" && HEARING.test(a.text));
}

const amendmentTuple = (a: RawLawExtras["amendments"][number]): LawAmendment => [a.chamber === "House" ? 0 : 1, a.type, a.number, a.sponsor, a.sponsor_name, a.submitted, a.purpose, a.latest?.date ?? null, a.latest?.text ?? null];
const relatedTuple = (r: RawLawExtras["related"][number]): LawRelatedBill => [r.congress, r.type, r.number, r.title, r.rel];
const cosponsorTuple = (c: RawLawExtras["cosponsors"][number]): LawCosponsor => [c.id, c.date, c.original ? 1 : 0, c.withdrawn];

/**
 * One law's record. Without `extras` (a Congress the Phase 2 fetch has not covered) it is the Phase 1 record: the capped summary and the
 * kept actions with the introduction and committee steps built from the committee list. With `extras` the summary is complete, the action
 * list is the source's own (introduction, referral, markup, report, calendar, floor, presidential) plus dated hearings, and amendments,
 * related bills and every cosponsor with dates are added.
 */
export function buildLawDetail(law: RawLaw, extras?: RawLawExtras): LawDetail {
  if (!extras) {
    const s = law.summary_html ? summaryParagraphs(law.summary_html) : null;
    const has = s !== null && s.paragraphs.length > 0;
    return { summary: has ? s.paragraphs : null, ...(has && s.cut ? { cut: true as const } : {}), actions: buildActions([...committeeActions(law), ...law.actions]) };
  }
  const s = extras.summary_html ? summaryParagraphs(extras.summary_html, Infinity) : null;
  const has = s !== null && s.paragraphs.length > 0;
  return {
    summary: has ? s.paragraphs : null,
    actions: buildActions([...extras.actions, ...hearingActions(law)]),
    amendments: extras.amendments.map(amendmentTuple),
    related: extras.related.map(relatedTuple),
    cosponsors: extras.cosponsors.map(cosponsorTuple),
  };
}

/**
 * The extras must agree with the Laws track's own record of the same law, or one of the two fetches is wrong: the summary starts with the
 * capped one, and the cosponsors who had not withdrawn are the Laws track's cosponsors. Returns the disagreements (empty = pass).
 */
export function extrasDisagreements(law: RawLaw, extras: RawLawExtras): string[] {
  const out: string[] = [];
  if ((law.summary_html ?? null) === null !== ((extras.summary_html ?? null) === null)) out.push("summary present in one and not the other");
  else if (law.summary_html && extras.summary_html && !extras.summary_html.startsWith(law.summary_html)) out.push("summary text differs");
  const active = extras.cosponsors.filter((c) => c.withdrawn === null).map((c) => c.id);
  const want = new Set(law.cosponsors);
  if (active.length !== want.size || active.some((id) => !want.has(id))) out.push(`cosponsors differ (${active.length} active in the extras, ${want.size} in the law)`);
  return out;
}

/** The gate: the shards' law ids equal `laws.json`'s exactly. Returns the differences (empty = pass). */
export function lawIdDifferences(shardIds: readonly string[], lawIds: readonly string[]): { missing: string[]; extra: string[] } {
  const have = new Set(shardIds);
  const want = new Set(lawIds);
  return { missing: lawIds.filter((id) => !have.has(id)), extra: shardIds.filter((id) => !want.has(id)) };
}
