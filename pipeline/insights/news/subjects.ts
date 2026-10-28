import { DECISIONS_COUNT_CHART, LAWS_COUNT_CHART, type PageTopic } from "./topics";

/**
 * Topics the data itself supplies: a law the Laws page lists, a case the Decisions page lists. The catalog in topics.ts
 * is a fixed list of subjects; whether a particular law or ruling is in the news cannot be known until it is enacted or
 * decided, so each one recently on the site gets a topic of its own, named by the title the headlines use, and the
 * story it makes points at the page's count chart filtered to its topic (`groupId`). Pure; news/pages.ts reads the data
 * files and passes them in (tested in subjects.test.ts).
 */

/** A law or ruling this recent can still be the news; older ones are only history. */
export const LAW_NEWS_DAYS = 365;
export const CASE_NEWS_DAYS = 270;

/** A law this new is still being reported by its lead word alone ("Chiricahua's rock spires"): the Guardian's headline never says "Chiricahua National Park Act". */
export const LEAD_WORD_DAYS = 90;
/** Lead words too ordinary to mean one law, and endings of ordinary English words (a proper name rarely ends so). */
const COMMON_LEAD = /^(american|americans|continuing|appropriations|authorization|comprehensive|infrastructure|environmental|protecting|improving|enhancing|preventing|strengthening|department|government|community|national|education|international|information|legislative|healthcare|technology|conservation|agriculture|transportation|restoration|settlement)$|(ing|ed|tion|ment|ship|ity|ness|ance|ence)$/i;

/** The name's first word when it alone can stand for the law: a long proper name, not an ordinary word. */
export function leadWord(name: string): string | null {
  const w = name.split(/\s+/)[0]!.replace(/['’]s$/, "");
  return /^[A-Z][a-z]{8,}$/.test(w) && !COMMON_LEAD.test(w) ? w : null;
}

export type LawRow = { law_id: string; date: string; title: string; area_id: string };
export type CaseRow = { case_id: string; date: string; name: string; group_id: string | null };

const DAY = 86_400_000;
const fixed = (s: string) => () => s;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Spaces in a name match any run of whitespace and either dash/hyphen, since outlets set titles differently. */
const phrase = (s: string) => s.trim().split(/\s+/).map(escape).join("[\\s\\u00a0]+");
const recent = (date: string, now: string, days: number) => Date.parse(now) - Date.parse(`${date}T12:00:00Z`) <= days * DAY;

/** "Chiricahua National Park Act" → "Chiricahua National Park"; "Crow Tribe … Act of 2025" likewise. Null for a bill with no short title. */
export function lawName(title: string): string | null {
  if (/^(to|a|an|making|providing|authorizing|designating|expressing|approving|recognizing)\s/i.test(title)) return null;
  const m = title.match(/^(.*?),?\s+Act(?:\s+of\s+\d{4}|,\s*\d{4})?$/i);
  const core = m?.[1]?.trim();
  // One word ("Clergy") is too common in headlines to mean the law.
  return core && core.split(/\s+/).length >= 2 ? core : null;
}

/** Laws enacted in the last LAW_NEWS_DAYS with a short title, as topics. Where two laws share a name the newer one wins. */
export function lawTopics(laws: readonly LawRow[], groupOf: ReadonlyMap<string, string>, now: string): PageTopic[] {
  const byName = new Map<string, LawRow>();
  for (const l of laws) {
    const name = lawName(l.title);
    if (!name || !recent(l.date, now, LAW_NEWS_DAYS)) continue;
    const key = name.toLowerCase();
    if (!byName.has(key) || byName.get(key)!.date < l.date) byName.set(key, l);
  }
  return [...byName.values()].map((l) => {
    const name = lawName(l.title)!;
    const group = groupOf.get(l.area_id);
    const lead = leadWord(name);
    return {
      id: `law.${l.law_id}`,
      page: "laws",
      chartId: LAWS_COUNT_CHART,
      ...(group && group !== "not-classified" ? { groupId: group } : {}),
      label: fixed(`${name} Act`),
      chart: `the number of laws Congress enacts each Congress, by topic; the ${name} Act became law on ${l.date}`,
      match: new RegExp(`\\b${phrase(name)}\\b${lead && recent(l.date, now, LEAD_WORD_DAYS) ? `|\\b${lead}\\b` : ""}`, "i"),
    };
  });
}

/** Parties too common in headlines to identify a case by themselves. */
const GENERIC_PARTY = /^(united states|u\.?s\.?|trump|biden|doe|roe|state|people|commonwealth|secretary|attorney general|[a-z]\.\s?[a-z]\.?)$/i;
const STATES = new Set(["alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine", "maryland", "massachusetts", "michigan", "minnesota", "mississippi", "missouri", "montana", "nebraska", "nevada", "new hampshire", "new jersey", "new mexico", "new york", "north carolina", "north dakota", "ohio", "oklahoma", "oregon", "pennsylvania", "rhode island", "south carolina", "south dakota", "tennessee", "texas", "utah", "vermont", "virginia", "washington", "west virginia", "wisconsin", "wyoming"]);
const SUFFIX = /,?\s+(inc|corp|co|llc|ltd|company|corporation)\.?$/i;

/** The party names of "A v. B", company suffixes dropped. */
export function parties(name: string): string[] {
  return name.split(/\s+v\.?\s+/i).map((p) => p.replace(SUFFIX, "").trim()).filter(Boolean);
}

/** A party that names the case on its own: not a government or a person's generic name, and either several words or a long distinctive one. */
function distinctive(party: string): boolean {
  if (GENERIC_PARTY.test(party) || STATES.has(party.toLowerCase()) || /^(state of|united states)\b/i.test(party)) return false;
  return party.split(/\s+/).length >= 2 || party.length >= 8;
}

/** Cases decided in the last CASE_NEWS_DAYS, as topics: "Trump v. Slaughter" in full, or its one distinctive party beside the Court. */
export function caseTopics(cases: readonly CaseRow[], now: string): PageTopic[] {
  const out: PageTopic[] = [];
  for (const c of cases) {
    if (!recent(c.date, now, CASE_NEWS_DAYS)) continue;
    const ps = parties(c.name);
    if (ps.length < 2) continue;
    const full = `${phrase(ps[0]!)}[\\s\\u00a0]+v(?:s?\\.|s)?[\\s\\u00a0]+${phrase(ps[1]!)}`;
    const alone = ps.filter(distinctive).map(phrase);
    const court = "(?=.*\\b(Supreme Court|justices|high court)\\b)";
    const parts = [`\\b${full}\\b`, ...(alone.length ? [`^${court}(?=.*\\b(${alone.join("|")})\\b)`] : [])];
    out.push({
      id: `case.${c.case_id}`,
      page: "decisions",
      chartId: DECISIONS_COUNT_CHART,
      ...(c.group_id ? { groupId: c.group_id } : {}),
      label: fixed(c.name),
      chart: `the number of cases the Supreme Court decides each term, by topic; ${c.name} was decided on ${c.date}`,
      match: new RegExp(parts.join("|"), "i"),
    });
  }
  return out;
}
