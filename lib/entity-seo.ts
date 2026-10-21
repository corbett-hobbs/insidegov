import { compactDollars } from "./format-number";
import { clampDescription, DESCRIPTION_MAX, fitTitle, TITLE_MAX } from "./seo";

/**
 * Search titles and descriptions for the one-per-entity pages: members, justices, presidents, committees and decisions.
 * Pure, so each is unit-tested. Titles lead with the name people search and add what the page shows when it fits in
 * `TITLE_MAX`; descriptions try the richest wording first and fall back to shorter ones under `DESCRIPTION_MAX`.
 */

/** The first candidate that fits, else the last one clamped. */
export function firstFit(candidates: readonly string[], max = DESCRIPTION_MAX): string {
  for (const c of candidates) if (c.length <= max) return c;
  return clampDescription(candidates[candidates.length - 1] ?? "", max);
}

/** "Democrat" is the noun; a description uses the adjective. */
export const partyAdjective = (party: string): string => (party === "Democrat" ? "Democratic" : party);

const ordinal = (n: number): string => {
  const v = n % 100;
  return `${n}${v >= 11 && v <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;
};

export interface MemberSeoInput {
  name: string;
  lastName: string;
  chamber: "senate" | "house";
  party: string;
  /** The caucus the member sits with ("Democrat" for an independent who caucuses with Democrats). */
  caucus: string;
  /** "D", "R", "I". */
  partyAbbr: string;
  state: string;
  stateName: string;
  district: number | null;
  firstTermYear: number | null;
  /**
   * Where the member sits within their caucus in their chamber on the liberal–conservative score: `toward` counts how many
   * caucus members sit further toward the caucus's own end (further left for Democrats, right for Republicans), `away` how
   * many sit further toward the other end, `of` the caucus size. Null when the member has no current score.
   */
  peers: { toward: number; away: number; of: number } | null;
  /** Enacted laws the member sponsored. */
  lawsSponsored: number;
  /** Latest usable net worth estimate (midpoint of the disclosed ranges), or null. */
  netWorth: number | null;
}

/** "$2.7M", "$896K", "below zero": a net worth estimate in a sentence (the compact number rule, `lib/format-number.ts`). */
export function moneyWords(v: number): string {
  return v < 0 ? "below zero" : compactDollars(v);
}

/**
 * A member page leads with what only this site shows: where the member sits within their own party in their chamber on the
 * liberal–conservative scale ("Lisa Murkowski is the Senate's 2nd most liberal Republican"; "Chuck Schumer votes more
 * liberally than 57% of Senate Democrats"), then their record: ideology over time, laws sponsored and net worth.
 */
export function memberSeo(m: MemberSeoInput): { title: string; description: string; jobDescription: string } {
  const senate = m.chamber === "senate";
  const seat = senate ? m.state : m.district != null && m.district > 0 ? `${m.state}-${m.district}` : `${m.state}-AL`;
  const base = `${senate ? "Sen." : "Rep."} ${m.name} (${m.partyAbbr}-${seat})`;
  const title = fitTitle(base, m.netWorth != null ? [": Ideology, Laws and Net Worth", ": Ideology and Net Worth", " Net Worth"] : [": Ideology, Laws and Committees", ": Ideology and Laws"], TITLE_MAX);

  const adj = partyAdjective(m.party);
  const role = senate ? "senator" : "representative";
  const district = !senate && m.district != null && m.district > 0 ? `${m.stateName}'s ${ordinal(m.district)} district` : `${m.stateName}${senate ? "" : " (at-large)"}`;
  const since = m.firstTermYear ? ` since ${m.firstTermYear}` : "";
  const jobDescription = `${m.name}, ${adj} U.S. ${role} ${senate ? "from" : "for"} ${district}.`;

  // Where the member sits in their caucus. Only the two major caucuses have a side to measure from.
  const dem = m.caucus === "Democrat";
  const room = senate ? "Senate" : "House";
  let peer: string | null = null;
  if (m.peers && (dem || m.caucus === "Republican") && m.peers.of > 1) {
    const own = dem ? "liberal" : "conservative";
    const other = dem ? "conservative" : "liberal";
    // An independent who caucuses with a party is a member of its caucus, not a Democrat.
    const one = m.party === m.caucus ? m.caucus : `member of the ${dem ? "Democratic" : "Republican"} caucus`;
    const many = m.party === m.caucus ? `${room} ${m.caucus}s` : `the ${room} ${dem ? "Democratic" : "Republican"} caucus`;
    const towardRank = m.peers.toward + 1;
    const awayRank = m.peers.away + 1;
    const nth = (n: number) => (n === 1 ? "" : `${ordinal(n)} `);
    if (towardRank <= 5) peer = `is the ${room}'s ${nth(towardRank)}most ${own} ${one}`;
    else if (awayRank <= 5) peer = `is the ${room}'s ${nth(awayRank)}most ${other} ${one}`;
    else {
      // Say the side the member is actually on: "more conservatively than 87%" rather than "more liberally than 13%".
      const pct = Math.round((100 * m.peers.away) / (m.peers.of - 1));
      peer = pct >= 60 ? `votes more ${own}ly than ${pct}% of ${many}` : pct <= 40 ? `votes more ${other}ly than ${100 - pct}% of ${many}` : `votes near the middle of ${many}`;
    }
  }

  if (!peer) {
    const tail = m.netWorth != null ? `How ${m.lastName} votes, laws sponsored, committees and estimated net worth.` : `How ${m.lastName} votes, laws sponsored and committee seats.`;
    return { title, jobDescription, description: firstFit([`${m.name}, ${adj} U.S. ${role} ${senate ? "from" : "for"} ${district}${since}. ${tail}`, `${m.name}, ${adj} ${role} from ${m.stateName}${since}. ${tail}`]) };
  }

  const where = `where ${m.lastName} has stood${since}`;
  const n = m.lawsSponsored.toLocaleString("en-US");
  const laws = m.lawsSponsored > 0 ? `the ${n} ${m.lawsSponsored === 1 ? "law" : "laws"} ${m.lastName} sponsored` : null;
  const lawsShort = m.lawsSponsored > 0 ? `${n} ${m.lawsSponsored === 1 ? "law" : "laws"} sponsored` : null;
  const worth = m.netWorth != null ? (m.netWorth < 0 ? "an estimated net worth below zero" : `an estimated ${moneyWords(m.netWorth)} net worth`) : null;
  const worthShort = m.netWorth != null ? (m.netWorth < 0 ? "a net worth below zero" : `a ${moneyWords(m.netWorth)} net worth`) : null;
  const list = (parts: (string | null)[]) => {
    const p = parts.filter((x): x is string => !!x);
    return p.length <= 2 ? p.join(" and ") : `${p.slice(0, -1).join(", ")} and ${p[p.length - 1]}`;
  };
  const tails = [` See ${list([where, laws, worth])}.`, ` See ${list([where, lawsShort, worthShort])}.`, ` See ${list([where, lawsShort ?? worthShort])}.`, ` See ${where}.`, ""];
  return { title, jobDescription, description: firstFit(tails.map((t) => `${m.name} ${peer}.${t}`)) };
}

export interface JusticeSeoInput {
  name: string;
  /** "Thomas"; "J. Roberts" where two share a surname. */
  last: string;
  /** "Chief Justice" or "Associate Justice". */
  role: string;
  /** "Served 1991–present · 34 terms" ("… in the data" when the record starts after their service did). */
  served: string;
  sitting: boolean;
  /** The directory's "Voting lean" (`votingLean` in `lib/justice-directory.ts`): "Conservative throughout", "From left of center to liberal", "Liberal so far". */
  lean: string;
  /** Rank by career ideology score on the justice's own side among every justice in the data (1 = most), and how many there are. */
  rank: { n: number; of: number; side: "liberal" | "conservative" };
  /** Terms the court record names this justice its most likely median justice. */
  medianTerms: number;
  /** A sitting justice's rank on their side of today's Court by latest-term score; null when not sitting. */
  benchRank: { n: number; side: "liberal" | "conservative" } | null;
  hasVotes: boolean;
}

const ordinalWord = (n: number) => (n === 1 ? "" : `${ordinal(n)} `);
/** "left of center" reads as an adverb after "voted"; "center" needs "near the". */
const leanWords = (band: string) => (band === "center" ? "near the center" : band);

/**
 * A justice page leads with what only this site shows: how the justice's ideology moved over their tenure and how it ranks
 * against every justice since 1937, then their case-by-case record. ("Clarence Thomas has voted conservative throughout 34
 * terms, the most conservative of 49 justices since 1937.")
 */
export function justiceSeo(j: JusticeSeoInput): { title: string; description: string } {
  const base = `${j.role === "Chief Justice" ? "Chief Justice" : "Justice"} ${j.name}`;
  const title = fitTitle(base, j.hasVotes ? [": Ideology Over Time and Voting Record", ": Ideology and Voting Record", ": Ideology Over Time", " Ideology"] : [": Ideology Over Time", " Ideology"], TITLE_MAX);

  const terms = j.served.match(/· (\d+) terms?$/)?.[1];
  const n = terms && Number(terms) > 1 ? terms : null;
  const over = n ? ` over ${n} terms` : "";
  const has = j.sitting ? "has voted" : "voted";
  const lean = j.lean.toLowerCase();
  const moved = lean.match(/^from (.+) to (.+)$/);
  const trajectory = moved
    ? `${j.name} ${j.sitting ? "has moved" : "moved"} from ${leanWords(moved[1])} to ${leanWords(moved[2])}${over}`
    : lean.endsWith(" throughout")
      ? `${j.name} ${has} ${leanWords(lean.replace(/ throughout$/, ""))} throughout${n ? ` ${n} terms` : ""}`
      : lean.endsWith(" so far")
        ? `${j.name} has voted ${leanWords(lean.replace(/ so far$/, ""))} so far`
        : `${j.name} ${has} ${leanWords(lean)}`;
  // How the justice compares with peers: the Court's swing vote, else an all-time extreme, else today's bench.
  const peers =
    j.medianTerms >= 2
      ? `, the Court's median justice in ${j.medianTerms} terms`
      : j.rank.n <= 10
        ? `, the ${ordinalWord(j.rank.n)}most ${j.rank.side} of ${j.rank.of} justices since 1937`
        : j.benchRank
          ? `, now the Court's ${ordinalWord(j.benchRank.n)}most ${j.benchRank.side} member`
          : "";
  // The second sentence carries on in the justice's own actions, like the first ("See how Thomas voted …"). The sentence has
  // already named the justice, so the chart label's disambiguating initial ("J. Roberts") is dropped.
  const surname = j.last.replace(/^[A-Z]\. /, "");
  const tails = j.hasVotes
    ? [
        ` See how ${surname} voted in every case, from landmark rulings to 5–4 splits.`,
        ` See how ${surname} voted in every case, including the 5–4 splits.`,
        ` See how ${surname} voted in every case.`,
        ` See every vote ${surname} cast.`,
        "",
      ]
    : [` See where ${surname} stood each term beside every colleague.`, ` See where ${surname} stood each term.`, ""];
  const candidates = [peers, ""].flatMap((r) => tails.map((t) => `${trajectory}${r}.${t}`));
  return { title, description: firstFit(candidates) };
}

export interface PresidentSeoInput {
  name: string;
  /** One per term: "42nd" and "1993–2001". */
  terms: { ordinal: string; years: string }[];
  party: "D" | "R";
  /** Still in office. */
  serving: boolean;
  /** Laws signed and how many Mayhew lists as major; null before the laws data (1973). */
  laws: { signed: number; major: number | null } | null;
  /** Executive orders, only when the record covers the whole time in office. */
  executiveOrders: number | null;
  /** Justices appointed (an elevation to chief not counted). */
  justices: number;
  /** Days in office with the president's party holding both chambers, one, or neither. */
  congress: { both: number; one: number; neither: number };
  /** Which of the page's data sections have figures for the term (the card ids in `PresidentPageData.cards`). */
  sections: readonly string[];
}

const yearsWord = (days: number) => {
  const y = Math.round((days / 365.25) * 10) / 10;
  return `${Number.isInteger(y) ? y : y.toFixed(1)} year${y === 1 ? "" : "s"}`;
};
const yearsNum = (days: number) => {
  const y = Math.round((days / 365.25) * 10) / 10;
  return Number.isInteger(y) ? String(y) : y.toFixed(1);
};

/**
 * A president page leads with the record in office, which is concrete and unique to the page: laws signed (and how many
 * were major), executive orders, justices appointed, and how long the president's party held Congress. Economy figures stay
 * out of the snippet: one line of numbers next to a president's name reads as credit or blame (rule 2c), with no room for
 * the caveat.
 */
export function presidentSeo(p: PresidentSeoInput): { title: string; description: string } {
  const title = fitTitle(`${p.name} Presidency`, [": Laws, Economy and Record", ": Laws and Record", " Record"], TITLE_MAX);
  const ords = [...new Set(p.terms.map((t) => t.ordinal))].join(" and ");
  const years = p.terms.map((t) => t.years).join(", ");

  const acts: string[] = [];
  if (p.laws) acts.push(`signed ${p.laws.signed.toLocaleString("en-US")} laws${p.laws.major ? ` (${p.laws.major} major)` : ""}`);
  if (p.executiveOrders) acts.push(`issued ${p.executiveOrders.toLocaleString("en-US")} executive orders`);
  if (p.justices > 0) acts.push(`appointed ${p.justices} ${p.justices === 1 ? "justice" : "justices"}`);
  // "has" once, before the list: "has signed 909 laws (40 major), issued 509 executive orders and appointed 3 justices".
  const joined = acts.length > 1 ? `${acts.slice(0, -1).join(", ")} and ${acts[acts.length - 1]}` : acts[0] ?? null;
  const actions = joined && p.serving ? `has ${joined}` : joined;

  const total = p.congress.both + p.congress.one + p.congress.neither;
  const partyPlural = p.party === "D" ? "Democrats" : "Republicans";
  const held = p.serving ? "have held" : "held";
  const all = (d: number) => Math.abs(d - total) < 2;
  const control =
    total === 0
      ? null
      : p.congress.both > 0
        ? all(p.congress.both)
          ? `${partyPlural} ${held} both chambers of Congress throughout.`
          : `${partyPlural} ${held} both chambers of Congress for ${yearsNum(p.congress.both)} of ${yearsWord(total)}.`
        : p.congress.one > 0
          ? `${partyPlural} ${held} one chamber of Congress for ${yearsNum(p.congress.one)} of ${yearsWord(total)}.`
          : `${partyPlural} ${held} neither chamber of Congress.`;
  // Only the sections the page draws for this term.
  const topics = [
    p.sections.includes("misery") ? "the economy" : p.sections.includes("fiscal") ? "the federal budget" : null,
    p.sections.includes("arrivals") || p.sections.includes("removals") ? "immigration" : null,
    p.sections.includes("trade") ? "trade" : null,
  ].filter((x): x is string => !!x);
  const tail = topics.length ? `See ${topics.length > 1 ? `${topics.slice(0, -1).join(", ")} and ${topics[topics.length - 1]}` : topics[0]} during the term.` : null;
  const who = `${p.name}, the ${ords} president (${years}),`;

  const candidates: string[] = [];
  const parts = (...xs: (string | null)[]) => xs.filter(Boolean).join(" ");
  if (actions) {
    candidates.push(parts(`${who} ${actions}.`, control, tail), parts(`${p.name} ${actions}.`, control, tail), parts(`${who} ${actions}.`, control), parts(`${p.name} ${actions}.`, control), parts(`${p.name} ${actions}.`, tail), `${p.name} ${actions}.`);
  } else {
    candidates.push(parts(`${p.name} was the ${ords} president (${years}).`, control, tail), parts(`${p.name} was the ${ords} president (${years}).`, control));
  }
  return { title, description: firstFit(candidates) };
}

/** Committees better known by another name than "<Chamber> <short name> Committee". */
const COMMITTEE_KNOWN_AS: Readonly<Record<string, string>> = {
  HSZS: "House Select Committee on China",
  JCSE: "Helsinki Commission",
  SCNC: "Senate Caucus on International Narcotics Control",
  HSQJ: "House Select Subcommittee on January 6",
};

export interface CommitteeSeoInput {
  committeeId: string;
  name: string;
  shortName: string;
  chamber: "house" | "senate" | "joint";
  latestCongress: number;
  memberCount: number;
  chair: string | null;
  rankingMember: string | null;
}

/** "Senate Committee on Armed Services" -> "Senate Armed Services Committee", the way it is reported and searched. */
export function committeeCommonName(c: Pick<CommitteeSeoInput, "committeeId" | "name" | "shortName" | "chamber">): string {
  const known = COMMITTEE_KNOWN_AS[c.committeeId];
  if (known) return known;
  if (c.chamber === "joint" || /^(?:Select|Special)\b|Caucus|Commission/.test(c.shortName)) return c.name;
  return `${c.chamber === "house" ? "House" : "Senate"} ${c.shortName} Committee`;
}

export function committeeSeo(c: CommitteeSeoInput): { title: string; description: string } {
  const common = committeeCommonName(c);
  const title = fitTitle(common, [": Members, Chair and Bills", ": Members and Bills", " Members"], TITLE_MAX);
  const leads = [c.chair && `chair ${c.chair}`, c.rankingMember && `ranking member ${c.rankingMember}`].filter(Boolean).join(", ");
  const congress = `${ordinal(c.latestCongress)} Congress`;
  const description = firstFit([
    `The ${common} in the ${congress}: ${leads ? `${leads}, ` : ""}all ${c.memberCount} members and their ideology, subcommittees and bills.`,
    `The ${common} in the ${congress}: ${leads ? `${leads}, ` : ""}all ${c.memberCount} members and the bills it handles.`,
    `The ${common} in the ${congress}: all ${c.memberCount} members, their ideology, subcommittees and bills.`,
  ]);
  return { title, description };
}

export interface DecisionSeoInput {
  shortName: string;
  /** ISO decision date. */
  decided: string;
  /** One-sentence ruling, else the opening of the Wikipedia article. */
  lead: string | null;
  maj: number;
  min: number;
  area: string | null;
  disposition: string | null;
}

export function decisionSeo(d: DecisionSeoInput): { title: string; description: string } {
  const year = d.decided.slice(0, 4);
  const title = fitTitle(`${d.shortName} (${year})`, [": Supreme Court Decision", " Supreme Court Case"], TITLE_MAX);
  // Some summaries say only that the case was decided ("The Court delivered its ruling on December 15, 2014."): skip those.
  const empty = !d.lead || d.lead.length < 50 || /^(?:was decided|the court (?:delivered|issued|announced|handed down) its (?:ruling|decision|opinion))/i.test(d.lead);
  if (d.lead && !empty) {
    const lead = clampDescription(d.lead);
    const named = `${d.shortName} (${year}): ${lead}`;
    return { title, description: named.length <= DESCRIPTION_MAX && !lead.endsWith("…") ? named : lead };
  }
  const area = d.area ? ` ${d.area.toLowerCase()}` : "";
  const outcome = d.disposition ? ` Outcome: ${d.disposition.toLowerCase()}.` : "";
  const description = firstFit([
    `${d.shortName}, a ${year} Supreme Court${area} case decided ${d.maj}–${d.min}.${outcome} How each justice voted and who wrote the opinion.`,
    `${d.shortName}, a ${year} Supreme Court${area} case decided ${d.maj}–${d.min}. How each justice voted and who wrote the opinion.`,
    `${d.shortName}, a ${year} Supreme Court case decided ${d.maj}–${d.min}. How each justice voted.`,
  ]);
  return { title, description };
}
