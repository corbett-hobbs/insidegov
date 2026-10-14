import type { Administration } from "./executive-orders-entities";
import type {
  RefugeeCountryRow,
  RefugeeDeterminationRow,
  RefugeeNote,
  RefugeePolicyRow,
  RefugeeRegionRow,
  RefugeeSeriesRow,
} from "./refugee-entities";
import {
  GEO_STACK,
  type GeoGroup,
  type RankedCountry,
  type RefugeeCountryYear,
  type RefugeeMarker,
  type RefugeePayload,
  type RefugeeRegionYear,
  type RefugeeTerm,
  type RefugeeYear,
  type RegionRow,
  type TopYear,
} from "./refugee-types";

/**
 * Pure shaping for the refugee section of /presidency/immigration: the ceiling and admissions series, regions, countries and the
 * dated rules joined to presidents. No I/O (the reader is `lib/refugee-data.ts`), so it is unit-tested over the real files.
 * Only type imports from the entities file, so client components can use the ranking helpers below without pulling in Zod.
 */

/** The payload starts with the first admissions year (the Refugee Act's FY1980): the page's slider runs from here. */
export const PAYLOAD_FIRST_FY = 1980;

/** Admissions by source country begin here; the years before it have a region split and a ceiling but no country list. */
export const COUNTRY_FIRST_FY = 2001;

/** Notes shown on a year's card: the few that explain a year on their own. The generic caveats live in the Data notes. */
export const CARD_NOTE_IDS: readonly string[] = ["covid-19", "usrap-suspension-2025", "fy2017-50000-cap", "doe-v-trump-fy2018-counting", "fy2026-preliminary"];

const GEO_SET = new Set<string>(GEO_STACK);
const isGeo = (g: string): g is GeoGroup => GEO_SET.has(g);

const lastName = (full: string) => full.split(" ").pop() ?? full;
const partyOf = (a: Administration): "D" | "R" => (a.party === "Democratic" ? "D" : "R");

/** The cap shown for a region: the State Department's year-end ceiling, else the last determination's allocation, else the first. */
function capOf(r: RefugeeRegionRow | undefined): [number, number] | null {
  const x = r?.year_end_ceiling ?? r?.allocation_final ?? r?.allocation_initial ?? null;
  return x ? [x.min, x.max] : null;
}

export function buildRefugeePayload(input: {
  series: readonly RefugeeSeriesRow[];
  regions: readonly RefugeeRegionRow[];
  countries: readonly RefugeeCountryRow[];
  policy: readonly RefugeePolicyRow[];
  notes: readonly RefugeeNote[];
  determinations: readonly RefugeeDeterminationRow[];
  admins: readonly Administration[];
}): RefugeePayload {
  const { series, regions, countries, policy, notes, determinations, admins } = input;
  const fail = (msg: string): never => {
    throw new Error(`refugee invariant: ${msg}`);
  };
  const adminById = new Map(admins.map((a) => [a.term_id, a]));
  const noteById = new Map(notes.map((n) => [n.id, n]));
  for (const id of CARD_NOTE_IDS) if (!noteById.has(id)) fail(`card note ${id} missing from refugee_notes.json`);

  // Years with an admissions report (the ceiling-only FY2027 is not drawn).
  const rows = series.filter((r) => r.period >= PAYLOAD_FIRST_FY && r.admissions !== null).sort((a, b) => a.period - b.period);
  if (rows.length === 0) fail("no series rows");
  rows.forEach((r, i) => {
    if (r.period !== PAYLOAD_FIRST_FY + i) fail(`years not contiguous at ${r.period}`);
    if (r.admissions_status === "preliminary" && i !== rows.length - 1) fail(`only the latest year may be preliminary, got FY${r.period}`);
    if (!adminById.has(r.administration_term_id)) fail(`FY${r.period} term ${r.administration_term_id} is not in administrations.json`);
  });

  const regionBy = new Map(regions.map((r) => [`${r.fy}|${r.region_group}`, r]));
  const years: RefugeeYear[] = rows.map((r) => {
    const byRegion = Object.fromEntries(GEO_STACK.map((g) => [g, regionBy.get(`${r.period}|${g}`)?.admissions ?? 0])) as Record<GeoGroup, number>;
    const sum = GEO_STACK.reduce((s, g) => s + byRegion[g], 0);
    // The Private Sector Initiative (FY1988-FY1993) is reported outside the five regions: the regions and it add to the year's total.
    const privateSector = regionBy.get(`${r.period}|private_sector`)?.admissions ?? 0;
    if (sum + privateSector !== r.admissions) fail(`FY${r.period} regions sum to ${sum} (+${privateSector} private sector), admissions ${r.admissions}`);
    return {
      fy: r.period,
      ceiling: r.ceiling,
      ceilingInitial: r.ceiling_initial,
      revised: r.ceiling_revised,
      admissions: r.admissions!,
      preliminary: r.admissions_status === "preliminary",
      share: r.share_of_ceiling,
      termId: r.administration_term_id,
      party: partyOf(adminById.get(r.administration_term_id)!),
      blended: r.blended,
      days: r.administration_days.map((d) => ({ termId: d.term_id, last: lastName(adminById.get(d.term_id)!.president), days: d.days })),
      regions: byRegion,
      privateSector,
      cardNotes: r.note_ids
        .filter((id) => CARD_NOTE_IDS.includes(id))
        .map((id) => ({ id, title: noteById.get(id)!.title, text: noteById.get(id)!.text })),
    };
  });

  const termIds = [...new Set(years.map((y) => y.termId))];
  const terms: RefugeeTerm[] = termIds
    .map((id) => adminById.get(id)!)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((a) => ({
      termId: a.term_id,
      president: a.president,
      last: lastName(a.president),
      party: partyOf(a),
      startYear: Number(a.start.slice(0, 4)),
      endYear: a.end === null ? null : Number(new Date(Date.parse(`${a.end}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 4)),
    }));

  const markers: RefugeeMarker[] = [...policy]
    .sort((a, b) => a.effective.localeCompare(b.effective) || a.id.localeCompare(b.id))
    .map((p, i) => ({
      n: i + 1,
      id: p.id,
      date: p.effective,
      instrument: p.instrument,
      citation: p.citation,
      signed: p.signed,
      ended: p.ended,
      title: p.title,
      summary: p.summary,
      effect: p.refugee_effect,
      status: p.status,
      statusAsOf: p.status_as_of,
    }));

  // Regions: admissions against the cap, per year.
  const groupYears = new Set(determinations.filter((d) => d.allocation_text !== null).map((d) => d.fy));
  const regionYears: RefugeeRegionYear[] = years.map((y) => {
    const cur = (g: string) => regionBy.get(`${y.fy}|${g}`);
    const prev = (g: string) => regionBy.get(`${y.fy - 1}|${g}`)?.admissions ?? null;
    const out: RegionRow[] = GEO_STACK.map((g) => ({ group: g, admissions: y.regions[g], cap: capOf(cur(g)), prev: prev(g) }));
    out.sort((a, b) => b.admissions! - a.admissions! || GEO_STACK.indexOf(a.group as GeoGroup) - GEO_STACK.indexOf(b.group as GeoGroup));
    const reserve = capOf(cur("unallocated"));
    if (reserve && reserve[1] > 0) out.push({ group: "unallocated", admissions: null, cap: reserve, prev: null });
    const anyCap = out.some((r) => r.cap !== null);
    return { fy: y.fy, rows: out, noCaps: anyCap ? null : groupYears.has(y.fy) ? "group" : "category" };
  });

  // Countries.
  const refByKey = new Map<string, number>();
  const refs: { key: string; name: string }[] = [];
  const countryYears: RefugeeCountryYear[] = years.filter((y) => y.fy >= COUNTRY_FIRST_FY).map((y) => {
    const list = countries.filter((c) => c.fy === y.fy);
    const total = list.reduce((s, c) => s + c.admissions, 0);
    if (total !== y.admissions) fail(`FY${y.fy} countries sum to ${total}, admissions ${y.admissions}`);
    const sorted = [...list].sort((a, b) => b.admissions - a.admissions || a.country_name.localeCompare(b.country_name));
    return {
      fy: y.fy,
      total,
      rows: sorted.map((c) => {
        if (!isGeo(c.region_group)) fail(`FY${y.fy} ${c.country_key} sits in non-geographic group ${c.region_group}`);
        if (!refByKey.has(c.country_key)) {
          refByKey.set(c.country_key, refs.length);
          refs.push({ key: c.country_key, name: c.country_name });
        }
        return [refByKey.get(c.country_key)!, c.admissions, c.region_group as GeoGroup];
      }),
    };
  });

  return {
    years,
    terms,
    markers,
    regionYears,
    countries: refs,
    countryYears,
    firstFy: years[0].fy,
    lastFy: years[years.length - 1].fy,
    asOf: rows[0].as_of,
  };
}

// ---- ranked views (client-safe) ----

/** Every source country in one fiscal year, largest first, with the change from the year before (zero for a newcomer). */
export function rankCountries(p: RefugeePayload, fy: number): RankedCountry[] {
  const cur = p.countryYears.find((c) => c.fy === fy);
  if (!cur) return [];
  const prev = p.countryYears.find((c) => c.fy === fy - 1);
  const prevBy = new Map((prev?.rows ?? []).map(([ci, v]) => [ci, v]));
  return cur.rows.map(([ci, value, group], i) => ({
    ci,
    key: p.countries[ci].key,
    name: p.countries[ci].name,
    value,
    group,
    rank: i + 1,
    change: prev ? value - (prevBy.get(ci) ?? 0) : null,
  }));
}

/** The largest source country in each fiscal year from `fromFy` to `toFy` (years without country detail are skipped). */
export function topByYear(p: RefugeePayload, fromFy: number, toFy: number): TopYear[] {
  const out: TopYear[] = [];
  for (let fy = fromFy; fy <= toFy; fy++) {
    const c = p.countryYears.find((x) => x.fy === fy);
    const y = p.years.find((x) => x.fy === fy);
    if (!c || !y) continue;
    out.push({ fy, ranked: c.rows.slice(0, 3).map(([ci, value, group]) => ({ ci, value, group })), total: c.total, preliminary: y.preliminary });
  }
  return out;
}

export interface TopRun {
  /** Country index, or -1 for a year with no ranked country. */
  ci: number;
  /** Slot indices into the `topByYear` list, inclusive. */
  from: number;
  to: number;
}

/** Consecutive years the same country was No. 1, as spans. */
export function topRuns(years: readonly TopYear[]): TopRun[] {
  const runs: TopRun[] = [];
  years.forEach((y, i) => {
    const ci = y.ranked[0]?.ci ?? -1;
    const last = runs[runs.length - 1];
    if (last && last.ci === ci) last.to = i;
    else runs.push({ ci, from: i, to: i });
  });
  return runs;
}

/** The change text shared with the ICE list: "+1,204", "−310", "0", and "" with nothing to compare. */
export { formatChange } from "./removals-country-derive";
