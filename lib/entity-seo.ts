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
  /** "D", "R", "I". */
  partyAbbr: string;
  state: string;
  stateName: string;
  district: number | null;
  firstTermYear: number | null;
  hasWealth: boolean;
}

export function memberSeo(m: MemberSeoInput): { title: string; description: string; jobDescription: string } {
  const senate = m.chamber === "senate";
  const seat = senate ? m.state : m.district != null && m.district > 0 ? `${m.state}-${m.district}` : `${m.state}-AL`;
  const base = `${senate ? "Sen." : "Rep."} ${m.name} (${m.partyAbbr}-${seat})`;
  const title = fitTitle(base, m.hasWealth ? [": Ideology, Laws and Net Worth", ": Ideology and Net Worth", " Net Worth"] : [": Ideology, Laws and Committees", ": Ideology and Laws"], TITLE_MAX);

  const adj = partyAdjective(m.party);
  const role = senate ? "senator" : "representative";
  const district = !senate && m.district != null && m.district > 0 ? `${m.stateName}'s ${ordinal(m.district)} district` : `${m.stateName}${senate ? "" : " (at-large)"}`;
  const since = m.firstTermYear ? ` since ${m.firstTermYear}` : "";
  const tail = m.hasWealth ? `How ${m.lastName} votes, laws sponsored, committees and estimated net worth.` : `How ${m.lastName} votes, laws sponsored and committee seats.`;
  const shortTail = m.hasWealth ? `How ${m.lastName} votes, laws sponsored and net worth.` : `How ${m.lastName} votes and laws sponsored.`;
  const description = firstFit([
    `${m.name}, ${adj} U.S. ${role} ${senate ? "from" : "for"} ${district}${since}. ${tail}`,
    `${m.name}, ${adj} ${role} ${senate ? "from" : "for"} ${district}${since}. ${tail}`,
    `${m.name}, ${adj} ${role} from ${m.stateName}${since}. ${tail}`,
    `${m.name}, ${adj} ${role} from ${m.stateName}${since}. ${shortTail}`,
  ]);
  return { title, description, jobDescription: `${m.name}, ${adj} U.S. ${role} ${senate ? "from" : "for"} ${district}.` };
}

export interface JusticeSeoInput {
  name: string;
  /** "Thomas"; "J. Roberts" where two share a surname. */
  last: string;
  /** "Chief Justice" or "Associate Justice". */
  role: string;
  appointedBy: string;
  /** "Served 1991–present · 34 terms". */
  served: string;
  hasVotes: boolean;
}

export function justiceSeo(j: JusticeSeoInput): { title: string; description: string } {
  const base = `${j.role === "Chief Justice" ? "Chief Justice" : "Justice"} ${j.name}`;
  const title = fitTitle(base, j.hasVotes ? [": Voting Record and Ideology", ": Votes and Ideology", " Voting Record"] : [": Ideology and Record", " Ideology"], TITLE_MAX);
  const span = j.served.match(/(\d{4})–(\d{4}|present)/);
  const when = span ? (span[2] === "present" ? ` since ${span[1]}` : ` (${span[1]}–${span[2]})`) : "";
  const what = j.hasVotes ? `Every vote and dissent, ideology by term and how ${j.last} compares with every justice since 1937.` : `Ideology by term and how ${j.last} compares with every justice since 1937.`;
  const brief = j.hasVotes ? "Every vote and dissent, and ideology by term." : `Ideology by term against every justice since 1937.`;
  const description = firstFit([
    `${j.name}, ${j.role.toLowerCase()} of the U.S. Supreme Court${when}, appointed by ${j.appointedBy}. ${what}`,
    `${j.name}, Supreme Court ${j.role.toLowerCase()}${when}, appointed by ${j.appointedBy}. ${what}`,
    `${j.name}, ${j.role.toLowerCase()} of the U.S. Supreme Court${when}, appointed by ${j.appointedBy}. ${brief}`,
    `${j.name}, Supreme Court ${j.role.toLowerCase()}${when}, appointed by ${j.appointedBy}. ${brief}`,
  ]);
  return { title, description };
}

export interface PresidentSeoInput {
  name: string;
  /** One per term: "42nd" and "1993–2001". */
  terms: { ordinal: string; years: string }[];
}

export function presidentSeo(p: PresidentSeoInput): { title: string; description: string } {
  const title = fitTitle(`${p.name} Presidency`, [": Laws, Economy and Record", ": Laws and Record", " Record"], TITLE_MAX);
  const ords = [...new Set(p.terms.map((t) => t.ordinal))].join(" and ");
  const years = p.terms.map((t) => t.years).join(", ");
  const description = firstFit([
    `${p.name}, the ${ords} president (${years}): laws signed, executive orders, Supreme Court picks, party control of Congress and the economy in office.`,
    `${p.name}, ${ords} president (${years}): laws signed, executive orders, Supreme Court picks, control of Congress and the economy.`,
    `${p.name}, ${ords} president (${years}): laws signed, executive orders, Supreme Court picks and the economy.`,
  ]);
  return { title, description };
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
