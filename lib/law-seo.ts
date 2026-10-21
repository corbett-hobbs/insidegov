import { clampDescription, TITLE_MAX, truncateWords } from "./seo";

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
}): string {
  const signed = opts.veto ? `Enacted over ${opts.president}'s veto in ${opts.year}.` : `Signed by ${opts.president} in ${opts.year}.`;
  const lead = lawSummaryLead(opts.summary, [opts.shortTitle, opts.officialTitle]);
  if (!lead) {
    const how = opts.veto ? `enacted over ${opts.president}'s veto` : `signed into law by ${opts.president}`;
    return clampDescription(`${opts.shortTitle}, ${how} in ${opts.year}: the votes in Congress, sponsors and legislative history.`);
  }
  const first = clampDescription(lead, 158 - signed.length);
  if (first.endsWith("…") || first.length + signed.length + 1 > 160) {
    const cut = clampDescription(lead);
    // A lead cut off inside a parenthesis or quotation reads as noise: say what the page holds instead.
    const open = (cut.match(/\(/g)?.length ?? 0) > (cut.match(/\)/g)?.length ?? 0) || (cut.match(/["“”]/g)?.length ?? 0) % 2 === 1;
    if (!open) return cut;
    const how = opts.veto ? `enacted over ${opts.president}'s veto` : `signed into law by ${opts.president}`;
    return clampDescription(`${opts.shortTitle}, ${how} in ${opts.year}: what it does, the votes in Congress, sponsors and legislative history.`);
  }
  return `${/[.!?]["”']?$/.test(first) ? first : `${first}.`} ${signed}`;
}
