import "server-only";
import { getMembersDirectory } from "./members-directory-data";
import { STATE_NAMES } from "./states";
import { getDecisionsPageData } from "./decisions-data";
import { getDemographicsPayload } from "./demographics-data";
import { getEnergyPayload } from "./energy-data";
import { getExecutiveOrdersData } from "./executive-orders-data";
import { firstFit, moneyWords } from "./entity-seo";
import { decodeAid, formatAidMoney, spendingByYear } from "./foreign-aid-derive";
import { getAidPayload } from "./foreign-aid-data";
import { getImmigrationPageData } from "./immigration-data";
import { getEconomyPayload } from "./indicator-data";
import { fmtDay } from "./indicator-time";
import { getCourtHubSummary } from "./justice-data";
import { presidentDisplay } from "./justice-derive";
import { getJusticeDirectory } from "./justice-directory-data";
import { getLawsPageData } from "./laws-data";
import { median } from "./og-sparkline";
import { topicCard } from "./og-topics";
import { getHubTariff } from "./trade-data";
import { fmtRate } from "./trade-hub";
import { decodeTroops, stackByRegion } from "./troops-derive";
import { getTroopsPayload } from "./troops-data";
import { getWealthData, SERIES_YEARS } from "./wealth-data";

/**
 * Search descriptions for the topic pages: a headline finding from the page's own data, then what the reader can explore.
 * Figures come through the same loaders the pages render from (most through `lib/og-topics.ts`, the share cards), so they
 * refresh with the data and cannot disagree with the page. Findings are plain facts and comparisons with the record
 * ("the most since 2013") or with a recent baseline rather than an all-time peak (troops vs 2008, the reserve vs five years
 * ago), never a cause or a grade (rule 2c). Each builder offers longer and shorter wordings; `firstFit` keeps the first
 * under 160 characters.
 */

const int = (n: number) => Math.round(n).toLocaleString("en-US");
const pct = (x: number) => `${Math.round(x * 100)}%`;

/** The last earlier entry that beat `value` ("the most since 2013"), or null when `value` is the record. */
function lastAbove<T>(series: readonly T[], value: number, get: (t: T) => number): T | null {
  for (let i = series.length - 2; i >= 0; i--) if (get(series[i]!) > value) return series[i]!;
  return null;
}

const BUILDERS: Record<string, () => string[]> = {
  "/congress/laws": () => {
    const d = getLawsPageData();
    // Laws whose closest recorded final-passage vote had under 60% yes (support band 1), per Congress.
    const close = d.bands.map((areas) => areas.reduce((a, b) => a + b[1]!, 0));
    const total = close.reduce((a, b) => a + b, 0);
    const i = close.length - 1;
    const ord = (c: number) => ordinalWord(c);
    const record = close.slice(0, -1).every((n) => close[i]! > n);
    const maxI = close.indexOf(Math.max(...close));
    const lead = record
      ? `The ${ord(d.congresses[i]!)} Congress ${d.partial[i] ? "has passed" : "passed"} ${close[i]} laws with under 60% support, the most of any Congress since 1973.`
      : `Since 1973, ${int(total)} laws have passed with under 60% support, the most (${close[maxI]}) in the ${ord(d.congresses[maxI]!)} Congress.`;
    return [
      `${lead} See how every member voted on each, by ideology, and each law's path through committee.`,
      `${lead} See how every member voted on each, by ideology.`,
      `${lead} See how every member voted.`,
    ];
  },
  "/congress/wealth": () => {
    const members = getWealthData();
    const i = SERIES_YEARS.length - 1;
    const latest = members.map((m) => m.series[i]).filter((v): v is number => v != null);
    const med = median(latest)!;
    const tenM = latest.filter((v) => v >= 10e6).length;
    const year = SERIES_YEARS[i];
    return [
      `The median member of Congress is worth an estimated ${moneyWords(med)}, and ${tenM} are worth $10 million or more. See every member's net worth over time, from ${year} financial disclosures.`,
      `The median member of Congress is worth an estimated ${moneyWords(med)}, and ${tenM} are worth $10 million or more. See every member's net worth over time.`,
      `The median member of Congress is worth an estimated ${moneyWords(med)}. See every senator's and representative's net worth over time.`,
    ];
  },
  "/presidency/immigration": () => {
    const ys = getImmigrationPageData().removalsYears.filter((y) => y.value != null);
    const last = ys[ys.length - 1]!;
    const above = lastAbove(ys, last.value!, (y) => y.value!);
    const since = above ? `, the most since fiscal ${above.fy}` : `, the most in any year since ${ys[0]!.fy}`;
    const prelim = last.status === "preliminary" ? " (preliminary)" : "";
    return [
      `The U.S. removed ${int(last.value!)} people in fiscal ${last.fy}${prelim}${since}. See green cards, refugee admissions, border encounters and deportations under every president.`,
      `The U.S. removed ${int(last.value!)} people in fiscal ${last.fy}${since}. See green cards, refugee admissions, border encounters and deportations under every president.`,
      `The U.S. removed ${int(last.value!)} people in fiscal ${last.fy}${since}. See green cards, refugees, border encounters and deportations by president.`,
    ];
  },
  "/presidency/economy": () => {
    const e = getEconomyPayload();
    const [gasDay, gas] = e.gas[e.gas.length - 1]!;
    const [, mort] = e.mort[e.mort.length - 1]!;
    // Unemployment is a monthly array; the newest months can be null until released.
    const un = [...e.un].reverse().find((v): v is number => v != null)!;
    return [
      `Gas is $${gas.toFixed(2)} a gallon, a 30-year mortgage ${mort.toFixed(2)}% and unemployment ${un.toFixed(1)}% (${fmtDay(gasDay).replace(/ \d+,/, "")}). See jobs, inflation, income and the deficit under every president since 1991.`,
      `Gas is $${gas.toFixed(2)} a gallon, a 30-year mortgage ${mort.toFixed(2)}% and unemployment ${un.toFixed(1)}%. See jobs, inflation, income and the deficit under every president since 1991.`,
      `Gas is $${gas.toFixed(2)} a gallon, a 30-year mortgage ${mort.toFixed(2)}% and unemployment ${un.toFixed(1)}%. See the economy under every president since 1991.`,
    ];
  },
  "/presidency/energy": () => {
    const { spr } = getEnergyPayload();
    const [day, now] = spr[spr.length - 1]!;
    // A recent baseline, not the all-time peak: the reading closest to five years before the latest.
    const target = day - Math.round(5 * 365.25);
    const then = spr.reduce((best, p) => (Math.abs(p[0] - target) < Math.abs(best[0] - target) ? p : best));
    const m = (kbbl: number) => `${int(kbbl / 1000)} million`;
    const dir = now < then[1] ? "down" : "up";
    const thenYear = fmtDay(then[0]).slice(-4);
    return [
      `The Strategic Petroleum Reserve holds ${m(now)} barrels of crude, ${dir} from ${m(then[1])} in ${thenYear}. See U.S. oil production, imports, electricity by source and LNG exports by president.`,
      `The Strategic Petroleum Reserve holds ${m(now)} barrels, ${dir} from ${m(then[1])} in ${thenYear}. See oil production, imports, electricity and LNG exports by president.`,
    ];
  },
  "/presidency/trade": () => {
    const t = getHubTariff();
    const vs = t.baseline ? `, up from ${fmtRate(t.baseline.rate)} in ${t.baseline.year}` : "";
    const up = t.baseline && t.latest.rate < t.baseline.rate ? vs.replace("up from", "down from") : vs;
    return [
      `The average tariff on U.S. imports is ${fmtRate(t.latest.rate)} (${t.latest.label})${up}. See imports, exports and tariffs with every country since 1991, by product and president.`,
      `The average tariff on U.S. imports is ${fmtRate(t.latest.rate)}${up}. See imports, exports and tariffs with every country since 1991, by product and president.`,
      `The average tariff on U.S. imports is ${fmtRate(t.latest.rate)}${up}. See trade and tariffs with every country since 1991.`,
    ];
  },
  "/presidency/foreign-aid": () => {
    const p = getAidPayload();
    const years = spendingByYear(decodeAid(p), p.years[0]!, p.defaultYear, -1, null);
    const last = years[years.length - 1]!;
    const prev = years[years.length - 2];
    const change = prev ? `, ${last.total < prev.total ? "down" : "up"} from ${formatAidMoney(prev.total)} the year before` : "";
    const words = (s: string) => s.replace(/\$([\d.]+)B$/, "$$$1 billion").replace(/\$([\d.]+)M$/, "$$$1 million");
    return [
      `The U.S. disbursed ${words(formatAidMoney(last.total))} in foreign aid in fiscal ${last.fy}${words(change)}. See where it went, by country and sector, under every president since 2001.`,
      `The U.S. disbursed ${words(formatAidMoney(last.total))} in foreign aid in fiscal ${last.fy}. See where it went, by country and sector, under every president since 2001.`,
    ];
  },
  "/presidency/troops-abroad": () => {
    const p = getTroopsPayload();
    const stacks = stackByRegion(decodeTroops(p), 0, 0, p.defaultYear).filter((s) => !s.unavailable);
    const last = stacks[stacks.length - 1]!;
    // Anchored to 2008, when the country-by-country location data begins: recent enough to matter (owner's call),
    // rather than the 1950s peak.
    const BASE_YEAR = 2008;
    const base = stacks.find((s) => p.years[s.yi]!.fy === BASE_YEAR) ?? stacks[0]!;
    const baseYear = p.years[base.yi]!.fy;
    const dir = last.total < base.total ? "down" : "up";
    return [
      `${int(last.total)} U.S. troops are stationed abroad (${p.periods[last.pi]!.label}), ${dir} from ${int(base.total)} in ${baseYear}. See where they serve, by country, region and branch, under every president.`,
      `${int(last.total)} U.S. troops are stationed abroad, ${dir} from ${int(base.total)} in ${baseYear}. See where they serve, by country, region and branch, under every president.`,
      `${int(last.total)} U.S. troops are stationed abroad, ${dir} from ${int(base.total)} in ${baseYear}. See where they serve, by country and branch.`,
    ];
  },
  "/presidency/executive-orders": () => {
    const d = getExecutiveOrdersData();
    const names = new Map(d.administrations.map((a) => [a.termId, presidentDisplay(a.president)]));
    // Each president's slice of each finished year: a transition year (2025: Biden, then Trump) has two, and the snippet
    // names the president who signed the orders rather than adding the two together.
    const slices = d.years.filter((y) => !y.partial).flatMap((y) => y.byTerm.map((t) => ({ year: y.year, total: t.total, president: names.get(t.termId) ?? "" })));
    const lastYear = Math.max(...slices.map((x) => x.year));
    const lead = slices.filter((x) => x.year === lastYear).sort((a, b) => b.total - a.total)[0]!;
    const above = lastAbove([...slices.filter((x) => x !== lead), lead], lead.total, (x) => x.total);
    const since = above ? "" : ", the most by any president in a year since 1994";
    return [
      `${lead.president} signed ${int(lead.total)} executive orders in ${lead.year}${since}. See every order since 1994 by year, topic and president, with links to the Federal Register.`,
      `${lead.president} signed ${int(lead.total)} executive orders in ${lead.year}${since}. See every order since 1994 by year, topic and president.`,
      `${lead.president} signed ${int(lead.total)} executive orders in ${lead.year}. See every order since 1994 by year, topic and president.`,
    ];
  },
  "/congress/ideology": () => {
    const c = topicCard("congress/ideology");
    const since = c.figure.replace(/^Most divided /, "");
    const lead = since === "ever" ? "Congress is more divided than ever" : `Congress is the most divided ${since}`;
    return [
      `${lead}, measured by the gap between the parties' voting records. See every member's ideology, House and Senate, back to 1789.`,
      `${lead}, by the gap between the parties' voting records. See every member's ideology back to 1789.`,
    ];
  },
  "/congress/demographics": () => {
    const views = getDemographicsPayload().views.both;
    const share = (v: (typeof views)[number]) => (v.women.D + v.women.R + v.women.O) / v.seats;
    const last = views[views.length - 1]!;
    const record = !views.slice(0, -1).some((v) => share(v) >= share(last));
    const age = last.ageAll.median;
    const ageText = age != null ? `, and the median member is ${Math.round(age)}` : "";
    return [
      `Women hold ${pct(share(last))} of seats in the ${ordinalWord(last.congress)} Congress${record ? ", a record" : ""}${ageText}. See age, gender and tenure in every Congress since 1933.`,
      `Women hold ${pct(share(last))} of seats in the ${ordinalWord(last.congress)} Congress${record ? ", a record" : ""}. See age, gender and tenure in every Congress since 1933.`,
    ];
  },
  "/supreme-court/decisions": () => {
    const d = getDecisionsPageData();
    // Each term's cases by dissent band: [9–0, 8–1, 7–2, 6–3, 5–4].
    const fiveFour = d.all.map((b, i) => ({ term: d.terms[i]!, n: b[4]!, cases: b.reduce((x, y) => x + y, 0) }));
    const last = fiveFour[fiveFour.length - 1]!;
    const above = lastAbove(fiveFour, last.n - 1, (x) => x.n);
    // "the most since 2019" only when it reaches back at least five terms; otherwise the count speaks for itself.
    const since = above && last.term - above.term >= 5 ? `, the most since the ${above.term} term` : "";
    const split = `${last.n} of its ${last.cases} argued cases`;
    return [
      `The Supreme Court split 5–4 in ${split} in the ${last.term} term${since}. See every decision since 1946, how each justice voted and on which issues.`,
      `The Supreme Court split 5–4 in ${split} in the ${last.term} term${since}. See every decision since 1946 and how each justice voted.`,
      `The Supreme Court split 5–4 in ${split} in the ${last.term} term. See every decision since 1946 and how each justice voted.`,
    ];
  },
  "/supreme-court/ideology": () => {
    const c = getCourtHubSummary();
    return [
      `${c.medianJusticeName} is the Supreme Court's median justice, the vote between its two wings, as of the ${c.lastTerm} term. See where every justice has stood, term by term, since 1937.`,
      `${c.medianJusticeName} is the Supreme Court's median justice as of the ${c.lastTerm} term. See where every justice has stood, term by term, since 1937.`,
    ];
  },
  "/supreme-court/justices": () => {
    const { rows } = getJusticeDirectory();
    const sitting = rows.filter((r) => r.sitting);
    const gop = sitting.filter((r) => r.party === "R").length;
    return [
      `${gop} of the ${sitting.length} sitting justices were appointed by Republican presidents. See every justice since 1937: tenure, Senate confirmation vote and how often they dissented.`,
      `${gop} of the ${sitting.length} sitting justices were appointed by Republican presidents. See every justice since 1937: tenure, confirmation vote and dissents.`,
    ];
  },
  "/timeline": () => {
    const c = topicCard("timeline");
    const [held, of] = c.figure.split(" of ");
    return [
      `Since 1933, one party has held the White House, both chambers and a friendly Supreme Court for ${held} of ${of}. See every landmark law and case against who held power that day.`,
      `Since 1933, one party has held the White House, Congress and a friendly Court for ${held} of ${of}. See every landmark law and case against who held power.`,
    ];
  },
  "/congress/members": () => {
    // Members in office today (the directory's list), voting seats only: the six House delegates are left out.
    const members = getMembersDirectory().members.filter((m) => m.state in STATE_NAMES);
    const seats = (chamber: "senate" | "house") => {
      const groups = members.filter((m) => m.chamber === chamber).map((m) => m.group);
      return { r: groups.filter((g) => g === "rep").length, d: groups.filter((g) => g === "dem").length };
    };
    const s = seats("senate");
    const h = seats("house");
    const hold = (x: { r: number; d: number }) => (x.r >= x.d ? { who: "Republicans", tally: `${x.r}–${x.d}` } : { who: "Democrats", tally: `${x.d}–${x.r}` });
    const sen = hold(s);
    const hou = hold(h);
    const lead = sen.who === hou.who ? `${sen.who} hold the Senate ${sen.tally} and the House ${hou.tally}` : `${sen.who} hold the Senate ${sen.tally} and ${hou.who} the House ${hou.tally}`;
    return [
      `${lead}. Search every current member by name, state or party, and compare their ideology, seniority and net worth.`,
      `${lead}. Search every current member and compare their ideology, seniority and net worth.`,
    ];
  },
};

const ordinalWord = (n: number) => {
  const v = n % 100;
  return `${n}${v >= 11 && v <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;
};

/** The topic page's description: its headline finding and what to explore, or `fallback` for a page with no builder. */
export function hubDescription(path: string, fallback: string): string {
  const build = BUILDERS[path];
  if (!build) return fallback;
  try {
    return firstFit(build());
  } catch {
    // A data file missing at build time must not take the page down: fall back to the plain description.
    return fallback;
  }
}

/** Paths with a data-driven description (tested to stay under 160 characters). */
export const hubDescriptionPaths = (): string[] => Object.keys(BUILDERS);

export { lastAbove };
