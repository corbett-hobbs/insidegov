import { STATE_NAMES } from "./states";

/**
 * The short name a Supreme Court case goes by ("Astrue v. Capato") from the full caption SCDB records ("Michael J.
 * Astrue, Commissioner of Social Security, Petitioner v. Karen K. Capato, on Behalf of B. N. C., et al."). Pure.
 *
 * A Wikipedia article title is the well-known name and wins when the case has one; otherwise each side is cut to its
 * first party, and a person to their surname, the way case names are cited.
 */

/** Words that mark a party as an organisation or government, never a person to cut to a surname. */
const ORG =
  /\b(?:Inc|Co|Corp|Corporation|Company|Companies|Ltd|LLC|L\.L\.C|L\.P|N\.A|Bank|Bancorp|Trust|Fund|Group|Union|Association|Society|Board|Commission|Commissioner|Committee|Council|Department|Dept|Bureau|Agency|Administration|Authority|Service|Services|County|City|Town|Township|Village|Parish|Borough|State|States|Commonwealth|District|School|Schools|University|College|Church|Railroad|Railway|Lines|Airlines|Insurance|Industries|Products|Oil|Gas|Electric|Power|Telephone|Motor|Motors|Works|Mills|Steel|Coal|Mining|Republic|Nation|Tribe|Indians|Band|People|Port|Hospital|Center|Federation|Brotherhood|Local|International|National|American|Federal|United|Partners|Partnership|Holdings|Enterprises|Systems|Laboratories|Club|League|Party|Foundation|Institute|Organization|Organisation|Museum|Estate|Bar|Press|News|Times|Publishing|Communications|Broadcasting|Pharmaceuticals?|Chemical|Energy|Refining|Manufacturing|Construction|Transport|Transportation|Shipping|Express|Stores|Market|Exchange|Securities|Financial|Credit|Savings|Loan|Mutual|Assurance|Life|Health|Care|Medical|Clinic|Labs?|Technologies|Technology|Software|Media|Studios|Pictures|Entertainment|Hotel|Hotels|Casino|Unit|Office|Court|Corps|Navy|Army|Prison|Jail|Police|Sheriff|Government|Music|Records|Magazine|Foods?|Brands|Airways|Aircraft|Paper|Packing|Lumber|Cement|Glass|Tobacco|Textiles?|Dairy|Farms?|Brewing|Distillers|Chemicals|Rubber|Machinery|Equipment|Supply|Trucking|Freight|Telegraph|Cable|Radio|Television|Wireless|Mobile|Healthcare|Hygiene|Prods|Research|Utility|Utilities|Edison|Compagnie|Societe|Société|Aktiebolag|GmbH|AG|S\.A|Colony|Parenthood)\b|&|\w['’]s\b/;

/** A descriptor after a party's name: "Reina, Chief of Police", "Barnhart, Commissioner of Social Security". */
const ROLE =
  /^(?:[a-z]|Commissioner|Secretary|Director|Warden|Attorney|Administrator|Administratrix|Superintendent|Sheriff|Chief|Judge|Justice|Governor|Mayor|Treasurer|Comptroller|Auditor|Trustee|Successor|Former|Acting|Executor|Executrix|Guardian|President|Chairman|Chair|Collector|Postmaster|Clerk|Individually|Next Friend|Personal Representative|Deputy|Special|Assistant|Regional|Receiver|Agent|Officer|Member|Through|By|Etc|Petitioners?|Respondents?|Appellants?|Appellees?|Doing Business)/;

const STATES = new Set([...Object.values(STATE_NAMES), "United States", "District of Columbia", "Puerto Rico"]);
const SUFFIX = /^(?:Jr\.?|Sr\.?|II|III|IV|V)$/;
const PARTICLE = /^(?:Van|Von|De|Del|Della|Di|Da|Du|La|Le|St\.|Mac|O'|ben|bin|al)$/i;
const NAME_TOKEN = /^(?:[A-Z]\.(?:[A-Z]\.)*|[A-Z][a-zà-ÿ]*(?:['’-][A-Z]?[a-zà-ÿ]+)*|Mc[A-Z][a-z]+|Mac[A-Z][a-z]+|[A-Z][a-z]+[A-Z][a-z]+|(?:van|von|de|del|della|di|da|du|la|le))$/;

/**
 * A person's name ("Gary E. Gisbrecht", "Blaine Lafler"), returned as the surname; null when it is not one. Two or more
 * capitalised words with no organisation word read as a person: in SCDB captions they almost always are.
 */
function surname(name: string): string | null {
  const tokens = name.split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 5 || ORG.test(name) || STATES.has(name)) return null;
  if (!tokens.every((t) => NAME_TOKEN.test(t) || SUFFIX.test(t))) return null;
  const core = tokens.filter((t) => !SUFFIX.test(t));
  let i = core.length - 1;
  while (i > 1 && PARTICLE.test(core[i - 1])) i--;
  return core.slice(i).join(" ");
}

/** One side of the caption cut to its first named party. */
function party(side: string): string {
  let s = side
    .replace(/,?\s+et\s+(?:al|ux|vir)\.?/gi, "")
    .replace(/,?\s+etc\.?/gi, "")
    .replace(/,?\s+(?:Jr|Sr)\.?(?=,|$)/g, "")
    .replace(/,?\s+(?:Petitioners?|Respondents?|Appellants?|Appellees?)\b\.?/g, "")
    .replace(/,?\s+(?:Doing Business As|d\/b\/a)\b.*$/i, "")
    .replace(/[,\s]+$/, "")
    .trim();
  // Split on commas that do not start a corporate suffix ("Dayton Christian Schools, Inc." stays whole).
  const parts = s.split(/,\s+(?!(?:Inc|Ltd|LLC|L\.L\.C|Co|Corp|N\.A|L\.P|P\.C|S\.A)\b)/);
  const head = parts[0];
  const andHead = head.split(/\s+and\s+/)[0];
  const person = surname(head) ?? (andHead !== head ? surname(andHead) : null);
  if (person) return person;
  // "Reina, Chief of Police", "Pottawattamie County, Iowa", and "Rainey, John C." (surname first) keep the head.
  const surnameFirst = parts.length > 1 && !/\s/.test(head) && /^[A-Z][a-z]+(?:\s+[A-Z]\.)*$/.test(parts[1]);
  if (parts.length > 1 && (ROLE.test(parts[1]) || STATES.has(parts[1]) || surnameFirst)) s = head;
  return s;
}

/** Agencies cited by their initials, and the corporate words citations abbreviate, as Wikipedia's case titles do. */
const CITED_AS: [RegExp, string][] = [
  [/^National Labor Relations Board$/, "NLRB"],
  [/^Federal Communications Commission$/, "FCC"],
  [/^Federal Trade Commission$/, "FTC"],
  [/^Securities and Exchange Commission$/, "SEC"],
  [/^Environmental Protection Agency$/, "EPA"],
  [/^Federal Energy Regulatory Commission$/, "FERC"],
  [/^Federal Election Commission$/, "FEC"],
  [/^Federal Power Commission$/, "FPC"],
  [/^Interstate Commerce Commission$/, "ICC"],
  [/^Equal Employment Opportunity Commission$/, "EEOC"],
  [/^Immigration and Naturalization Service$/, "INS"],
  [/^Commissioner of Internal Revenue$/, "Commissioner"],
  [/\bCorporation\b/g, "Corp."],
  [/\bCompany\b/g, "Co."],
  [/\bIncorporated\b/g, "Inc."],
];
const citedAs = (p: string) => CITED_AS.reduce((acc, [re, to]) => acc.replace(re, to), p);

/** Strip Wikipedia's disambiguation: "Morey v. Doud (1957)" -> "Morey v. Doud". */
const fromWiki = (title: string) => title.replace(/\s*\([^)]*\)$/, "").trim();

/** The name a case is known by. `wikiTitle` is the case's Wikipedia article title when it has one. */
export function shortCaseName(caption: string, wikiTitle?: string | null): string {
  if (wikiTitle) return fromWiki(wikiTitle);
  const c = caption.replace(/\s+/g, " ").trim();
  const at = c.search(/\s+v\.?\s+/);
  if (at < 0) return citedAs(party(c));
  const pet = c.slice(0, at);
  const res = c.slice(at).replace(/^\s+v\.?\s+/, "");
  return `${citedAs(party(pet))} v. ${citedAs(party(res))}`;
}
