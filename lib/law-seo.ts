import type { ChamberTally } from "./laws-types";
import { clampDescription, DESCRIPTION_MAX, fitTitle, TITLE_MAX, truncateWords } from "./seo";

/**
 * Friendly names and search descriptions for law pages. Pure and isomorphic.
 *
 * Most laws already carry a short title ("Tax Cuts and Jobs Act"); thousands of older or minor ones only have the formal
 * long title ("To designate the facility of the United States Postal Service located at ... as the 'Ray Chavez Post
 * Office Building'."). `lawShortTitle` turns those into a name a reader would search for; the page shows the formal title
 * underneath. URLs keep slugging the stored title, so nothing here moves a page.
 */

/** Longest name shown as a heading; the formal title is printed in full beneath it. */
const SHORT_MAX = 100;

/** A formal long title describes what the bill does rather than naming it. */
const DESCRIPTIVE =
  /^(?:an?\s+(?:bill|act|joint resolution|resolution)\b|joint resolution\b|to\s|making\s|providing\s|proposing\s|designating\s|disapproving\s|authorizing\s|granting\s|extending\s|relating\s|amending\s|approving\s|waiving\s|directing\s|requesting\s|recognizing\s|expressing\s|commemorating\s|congratulating\s|declaring\s|establishing\s|permitting\s|consenting\s|for the relief\s|appointing\s|conferring\s|celebrating\s|honoring\s)/i;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Verbs that double their last consonant before "-ing" ("permit" -> "permitting"). */
const DOUBLES = new Set("admit allot bar ban begin commit compel confer control cut defer deter emit equip expel extol get incur occur omit patrol permit plan prefer propel put recur refer regret remit repel rid set ship stop submit sum transfer transmit upset".split(" "));

/** "amend the Act" -> "Amending the Act": a formal title's bare verb, as a heading reads it. */
function gerund(body: string): string {
  const ing = (v: string) => (DOUBLES.has(v) ? v + v.slice(-1) + "ing" : /ie$/.test(v) ? v.slice(0, -2) + "ying" : /[^e]e$/.test(v) ? v.slice(0, -1) + "ing" : v + "ing");
  // "authorize and direct the Secretary" -> "Authorizing and directing the Secretary"
  const pair = body.match(/^([a-z]+) and ([a-z]+)(\s+(?:the|a|an|certain|for|to|on|that)\b.*)$/);
  if (pair && !/ing$/.test(pair[1])) return `${cap(ing(pair[1]))} and ${ing(pair[2])}${pair[3]}`;
  const m = body.match(/^([a-z]+)\b(.*)$/);
  if (!m || /ing$/.test(m[1])) return cap(body);
  return cap(ing(m[1])) + m[2];
}

const tidy = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/\s+([.,;:])/g, "$1")
    .trim();

const shortenUs = (s: string) => s.replace(/United States Code/g, "U.S. Code").replace(/United States/g, "U.S.");

/** "designate ... as the 'Ray Chavez Post Office Building'" -> "Ray Chavez Post Office Building". */
function designatedName(t: string): string | null {
  if (!/\b(?:designat|redesignat|renam|nam)(?:e|es|ed|ing)\b/i.test(t)) return null;
  const quoted = [...t.matchAll(/"([^"]{3,90})"/g)].at(-1);
  if (quoted) return quoted[1].replace(/[.,]$/, "").trim();
  const bare = t.match(/\bas\s+(?:the\s+)?([A-Z][^"]{3,90}?)\.?$/);
  return bare && !/\bas\s/.test(bare[1]) ? bare[1].trim() : null;
}

/** Congressional Review Act disapprovals, which all open "Providing for congressional disapproval under chapter 8 ...". */
function disapprovalName(t: string): string | null {
  if (!/^(?:a joint resolution\s+)?(?:providing for congressional disapproval|disapproving)\b/i.test(t)) return null;
  const known = t.match(/\bknown as (?:the )?"?([^"]+?)"?\.?$/i);
  if (known) return `Disapproval of the ${known[1].replace(/^the\s+/i, "")}`;
  const agency = t.match(/\brule submitted by (?:the )?(.+?)(?:\s+(?:relating to|related to|entitled|titled|regarding|with respect to)\b|,|\.?$)/i)?.[1];
  const topic = t.match(/\b(?:relating to|related to|entitled|titled|regarding|with respect to)\s+(?:the\s+)?"?([^"]+?)"?\.?$/i)?.[1];
  if (!agency && !topic) return null;
  if (!topic) return `Disapproval of ${shortenUs(agency!)} Rule`;
  const withAgency = agency ? `Disapproval of ${shortenUs(agency)} Rule on ${shortenUs(topic)}` : "";
  return withAgency && withAgency.length <= SHORT_MAX ? withAgency : `Disapproval of Rule on ${shortenUs(topic)}`;
}

/** "Making emergency supplemental appropriations for the fiscal year ending September 30, 2024" -> "Emergency Supplemental Appropriations for Fiscal Year 2024". */
function appropriationsName(t: string): string | null {
  const m = t.match(/^(?:an?\s+(?:bill|act|joint resolution)\s+)?making\s+(.*?)appropriations\s+for\s+(?:the\s+)?fiscal\s+(?:years?\s+)?(?:ending\s+(?:june|september)\s+30,\s+)?(\d{4})/i);
  if (!m) return null;
  const kind = m[1].trim().replace(/\b\w/g, (c) => c.toUpperCase());
  return `${kind ? `${kind} ` : ""}Appropriations for Fiscal Year ${m[2]}`;
}

/**
 * The name to show and search for. A short title or popular name passes through; a formal long title becomes a named
 * designation, a rule disapproval, an appropriations year, or the description itself, trimmed to about 70 characters.
 */
export function lawShortTitle(title: string): string {
  const t = tidy(title);
  if (!DESCRIPTIVE.test(t)) return t.replace(/\.$/, "");
  const special = disapprovalName(t) ?? appropriationsName(t);
  if (special) return truncateWords(special, SHORT_MAX);
  const named = designatedName(t);
  if (named) return /\b(?:Act|Day|Week|Month|Year)$/.test(named) || named.length > 60 ? truncateWords(named, SHORT_MAX) : `${named} Designation`;
  const body = shortenUs(
    t
      .replace(/^(?:an?\s+)?(?:bill|act|joint resolution|resolution)\s+/i, "")
      .replace(/^to\s+/i, "")
      .replace(/,?\s+and for other purposes\.?$/i, "")
      .replace(/\.$/, ""),
  );
  return truncateWords(gerund(body), SHORT_MAX);
}

/** The page title: the short name, with the year it became law when the name has none and there is room. */
export function lawTitle(shortTitle: string, date: string): string {
  const withYear = `${shortTitle} (${date.slice(0, 4)})`;
  return !/\b(?:1[7-9]|20)\d{2}\b/.test(shortTitle) && withYear.length <= TITLE_MAX ? withYear : shortTitle;
}

/** "the House 224–201", "the Senate by voice vote": one chamber's final-passage vote, as a description says it. */
function chamberVote(chamber: "House" | "Senate", t: ChamberTally): string {
  if (t[0] === 0 && t[1] != null && t[2] != null) return `the ${chamber} ${t[1]}–${t[2]}`;
  if (t[0] === 1) return `the ${chamber} by voice vote`;
  if (t[0] === 2) return `the ${chamber} by unanimous consent`;
  return `the ${chamber}`;
}

/**
 * Hand-written vote leads, keyed by law id, for laws whose recorded final action misstates how they passed. The search
 * description says these instead of the computed "passed the House … and the Senate …".
 */
const VOTE_LEADS: Readonly<Record<string, string>> = {
  // H.R. 815: on 2024-04-20 the House voted on the package as four bills (Ukraine 311–112, Israel 366–58, Indo-Pacific
  // 385–34, H.R. 8038 360–58) and attached them by rule, so the bill's own House action reads as unanimous consent. The
  // Senate then passed the package 79–18 on 2024-04-23 (the recorded Senate tally).
  "118-pub-50": "The House passed it in four parts, Ukraine aid 311–112 and Israel aid 366–58; the Senate passed the package 79–18.",
};

export interface LawSeoInput {
  /** "118-pub-50", for the hand-written `VOTE_LEADS`. */
  lawId: string;
  shortTitle: string;
  officialTitle: string;
  summary: readonly string[] | null;
  president: string;
  /** Signing date (or the override date), ISO. */
  date: string;
  veto: boolean;
  originChamber: "House" | "Senate" | null;
  passage: { house: ChamberTally; senate: ChamberTally; override: [number | null, number | null, number | null, number | null] | null };
  /** Chambers the page's "Who voted for it" chart covers (each member's final-passage vote by ideology); empty = no chart. */
  chartChambers: readonly ("House" | "Senate")[];
  hasCommittees: boolean;
}

/**
 * Title and description for a law page. A law passed on a recorded vote leads with what only this site shows: the tally
 * and every member's vote by ideology, then its path through committee ("Tax Cuts and Jobs Act: How Congress Voted").
 * A voice-vote law (most minor laws) has no vote to show, so it keeps the plain summary of what it does.
 */
export function lawSeo(l: LawSeoInput): { title: string; description: string } {
  const year = Number(l.date.slice(0, 4));
  if (l.chartChambers.length === 0) {
    return { title: lawTitle(l.shortTitle, l.date), description: lawMetaDescription({ ...l, year }) };
  }
  const hasYear = /\b(?:1[7-9]|20)\d{2}\b/.test(l.shortTitle);
  const title = fitTitle(l.shortTitle, [...(hasYear ? [] : [`: How Congress Voted (${year})`]), ": How Congress Voted", ...(hasYear ? [] : [` (${year})`])], TITLE_MAX);

  const named = /\b(?:Act|Resolution|Amendments|Designation)\b/.test(l.shortTitle) ? `${/^the\s/i.test(l.shortTitle) ? "" : "The "}${l.shortTitle}` : "This law";
  const o = l.passage.override;
  let lead: string;
  if (VOTE_LEADS[l.lawId]) {
    lead = VOTE_LEADS[l.lawId];
  } else if (l.veto && o && o[0] != null && o[1] != null && o[2] != null && o[3] != null) {
    lead = `Congress overrode ${l.president}'s veto of the ${l.shortTitle}, ${o[0]}–${o[1]} in the House and ${o[2]}–${o[3]} in the Senate.`;
  } else {
    const first = l.originChamber === "Senate" ? chamberVote("Senate", l.passage.senate) : chamberVote("House", l.passage.house);
    const second = l.originChamber === "Senate" ? chamberVote("House", l.passage.house) : chamberVote("Senate", l.passage.senate);
    lead = `${named} passed ${first} and ${second}.`;
  }
  // The chart covers only the chambers that held a recorded vote: never promise "every member" for a voice-vote House.
  const who = l.chartChambers.length > 1 ? "every member" : l.chartChambers[0] === "Senate" ? "every senator" : "every House member";
  const tails = l.hasCommittees
    ? [` See how ${who} voted by ideology, its path through committee and what it does.`, ` See how ${who} voted by ideology and its path through committee.`, ` See how ${who} voted by ideology.`]
    : [` See how ${who} voted by ideology and what the law does.`, ` See how ${who} voted by ideology.`];
  for (const tail of tails) if (lead.length + tail.length <= DESCRIPTION_MAX) return { title, description: lead + tail };
  // A long name: the tally without it.
  const bare = lead.replace(/^(?:The |This law ).*? passed /, "Passed ").replace(/^Congress overrode .*?'s veto of the .*?, /, "Veto overridden, ");
  for (const tail of tails) if (bare.length + tail.length <= DESCRIPTION_MAX) return { title, description: bare + tail };
  return { title, description: clampDescription(lead) };
}

/** A paragraph that only names the law ("Government Employee Fair Treatment Act of 2019"), as CRS summaries often open. */
const isTitleLine = (p: string, names: string[]) =>
  names.some((n) => n && tidy(n).replace(/\.$/, "").toLowerCase() === p.replace(/\.$/, "").toLowerCase()) ||
  (!/[.!?]$/.test(p) && p.length < 140 && /\b(?:Act|Resolution|Amendments)\b(?: of \d{4})?$/.test(p));

/** A bare section heading ("Title I: Head Start Programs", "DIVISION A--HONORING HOMETOWN HEROES ACT"), not prose. */
const isHeading = (p: string) =>
  (/^(?:title|division|subtitle|part|chapter)\s+[\w-]+\s*(?:[:.]|--|—)/i.test(p) && !/\s-\s/.test(p) && p.length < 120) ||
  (p.replace(/[^A-Za-z]/g, "").length > 8 && p === p.toUpperCase());

/**
 * The first plain sentence of a CRS summary: skips "(Senate agreed to House amendment ...)" status notes and title-only
 * paragraphs, and strips the "Short Title - Title I: Heading - (Sec. 101)" lead-in older summaries carry.
 */
export function lawSummaryLead(summary: readonly string[] | null, names: string[] = []): string | null {
  for (const raw of summary ?? []) {
    // Drop "=Title I=" markup and leading "(Senate agreed to House amendment ...)" / "(This measure has not been amended ...)" notes.
    let p = tidy(raw).replace(/=([^=]+)=/g, "$1").replace(/^(?:\([^)]*\)\s*)+/, "");
    if (!p || isTitleLine(p, names) || isHeading(p)) continue;
    // "Name - Title I: Heading - Subtitle A: Heading - (Sec. 101) Amends ..." -> "Amends ..."
    for (let prev = ""; prev !== p; ) {
      prev = p;
      p = p
        .replace(/^[^.;]{2,180}?\s+-\s+(?=[A-Z(])/, (m) => (/^(?:This|The|Amends|Requires|Directs|Authorizes|Provides|Establishes|Makes|Designates|Prohibits|Revises|Extends)\b/.test(m) ? m : ""))
        .replace(/^\((?:Sec|Section)s?\.?\s*[\d\w, -]+(?:,[^)]*)?\)\s*/i, "")
        .trim();
    }
    if (p.length >= 25) return p;
  }
  return null;
}

/**
 * Meta description for a law page: what the law does, then who signed it and when when there is room. Falls back to a
 * plain sentence for the few laws with no usable summary.
 */
export function lawMetaDescription(opts: {
  shortTitle: string;
  officialTitle: string;
  summary: readonly string[] | null;
  president: string;
  year: number;
  veto: boolean;
  /** Final passage per chamber; both by voice vote (or both by unanimous consent) adds how it passed, when it fits. */
  passage?: { house: ChamberTally; senate: ChamberTally };
}): string {
  const plain = opts.veto ? `Enacted over ${opts.president}'s veto in ${opts.year}.` : `Signed by ${opts.president} in ${opts.year}.`;
  const kinds = opts.passage ? [opts.passage.house[0], opts.passage.senate[0]] : [];
  const method = kinds.length && kinds.every((k) => k === 1) ? "voice vote" : kinds.length && kinds.every((k) => k === 2) ? "unanimous consent" : null;
  const signedOptions = method && !opts.veto ? [`Passed by ${method}; signed by ${opts.president} in ${opts.year}.`, plain] : [plain];
  const how = opts.veto ? `enacted over ${opts.president}'s veto` : `signed into law by ${opts.president}`;
  const lead = lawSummaryLead(opts.summary, [opts.shortTitle, opts.officialTitle]);
  if (!lead) return clampDescription(`${opts.shortTitle}, ${how} in ${opts.year}: its path through Congress, sponsors and legislative history.`);
  for (const signed of signedOptions) {
    const first = clampDescription(lead, DESCRIPTION_MAX - 2 - signed.length);
    if (!first.endsWith("…") && first.length + signed.length + 1 <= DESCRIPTION_MAX) return `${/[.!?]["”']?$/.test(first) ? first : `${first}.`} ${signed}`;
  }
  const cut = clampDescription(lead);
  // A lead cut off inside a parenthesis or quotation reads as noise: say what the page holds instead.
  const open = (cut.match(/\(/g)?.length ?? 0) > (cut.match(/\)/g)?.length ?? 0) || (cut.match(/["“”]/g)?.length ?? 0) % 2 === 1;
  if (!open) return cut;
  return clampDescription(`${opts.shortTitle}, ${how} in ${opts.year}: what it does, its path through Congress, sponsors and legislative history.`);
}
