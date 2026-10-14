import type { Administration } from "./executive-orders-entities";
import type { LprCountryRow, LprNote, LprSeriesRow } from "./lpr-entities";
import { LPR_CLASS_STACK, type LprClassKey, type LprCountryRef, type LprCountryYear, type LprPayload, type LprTerm, type LprYear, type RankedLprCountry } from "./lpr-types";

/**
 * Pure shaping for the legal-immigration track (green cards and naturalizations): the national
 * series, classes and countries joined to presidents. No I/O (the reader is `lib/lpr-data.ts`), so it
 * is unit-tested over the real files. Only type imports from the entities file, so client components
 * can use the ranking helper without pulling in Zod.
 *
 * `assertLprInvariants` also runs at the end of `pnpm transform` (lpr-run.ts), so a bad output fails
 * there rather than at the next site build.
 */

const fail = (msg: string): never => {
  throw new Error(`lpr invariant: ${msg}`);
};

/** Half the rounding unit per cell, plus one for the total: the most rounding alone can move a sum. */
const slackOf = (rows: readonly { rounding: 10 | null; cells: readonly string[] }[]) =>
  rows.reduce((s, r) => s + (r.rounding ? (r.rounding / 2) * r.cells.length : 0), 0) + (rows.some((r) => r.rounding) ? 5 : 0);

/**
 * What every consumer may rely on:
 *   - one national row per (metric, year); green cards and naturalizations each run without gaps;
 *   - only the newest year may be preliminary, and a preliminary year is the same for both metrics;
 *   - from the first year with classes, every year has all seven classes and both types, the classes
 *     add up to the total and new arrivals plus adjustments to the total (within OHSS's rounding);
 *   - by-country rows add up to the national total of their year (within rounding), one basis per
 *     metric-year, birth everywhere except a preliminary year;
 *   - every note a row cites exists.
 */
export function assertLprInvariants(series: readonly LprSeriesRow[], byCountry: readonly LprCountryRow[], notes: readonly LprNote[]): void {
  const noteIds = new Set(notes.map((n) => n.id));
  for (const r of series) for (const id of r.note_ids) if (!noteIds.has(id)) fail(`FY${r.period} ${r.metric} cites unknown note ${id}`);

  const totals = new Map<string, LprSeriesRow>();
  for (const r of series.filter((x) => x.admission_type === null && x.class === null)) {
    const k = `${r.metric}|${r.period}`;
    if (totals.has(k)) fail(`two national rows for ${k}`);
    totals.set(k, r);
  }
  const lastFy = Math.max(...series.map((r) => r.period));
  for (const metric of ["lpr", "naturalizations"] as const) {
    const fys = [...totals.values()].filter((r) => r.metric === metric).map((r) => r.period).sort((a, b) => a - b);
    if (!fys.length) fail(`no ${metric} rows`);
    fys.forEach((fy, i) => {
      if (fy !== fys[0] + i) fail(`${metric} years not contiguous at FY${fy}`);
    });
    for (const r of series.filter((x) => x.metric === metric && x.status === "preliminary")) if (r.period !== lastFy) fail(`${metric} FY${r.period} is preliminary but not the newest year`);
  }
  const prelim = new Set(series.filter((r) => r.status === "preliminary").map((r) => r.period));
  for (const fy of prelim) for (const r of series.filter((x) => x.period === fy)) if (r.status !== "preliminary") fail(`FY${fy} mixes final and preliminary rows`);

  const detail = series.filter((r) => r.metric === "lpr" && (r.class !== null || r.admission_type !== null));
  const firstDetail = Math.min(...detail.map((r) => r.period));
  for (let fy = firstDetail; fy <= lastFy; fy++) {
    const total = totals.get(`lpr|${fy}`) ?? fail(`FY${fy}: no LPR total`);
    for (const type of [null, "new_arrival", "adjustment"] as const) {
      const rows = detail.filter((r) => r.period === fy && r.admission_type === type && r.class !== null);
      const head = type === null ? total : (detail.find((r) => r.period === fy && r.admission_type === type && r.class === null) ?? fail(`FY${fy}: no ${type} total`));
      if (rows.length !== LPR_CLASS_STACK.length) fail(`FY${fy} ${type ?? "all"}: ${rows.length} classes, expected ${LPR_CLASS_STACK.length}`);
      const sum = rows.reduce((s, r) => s + r.value, 0);
      if (Math.abs(sum - head.value) > slackOf([...rows, head])) fail(`FY${fy} ${type ?? "all"}: classes sum to ${sum}, total ${head.value}`);
    }
    const na = detail.find((r) => r.period === fy && r.admission_type === "new_arrival" && r.class === null)!;
    const adj = detail.find((r) => r.period === fy && r.admission_type === "adjustment" && r.class === null)!;
    if (Math.abs(na.value + adj.value - total.value) > slackOf([na, adj, total])) fail(`FY${fy}: new arrivals ${na.value} + adjustments ${adj.value} != ${total.value}`);
  }

  const groups = new Map<string, LprCountryRow[]>();
  for (const r of byCountry) {
    const k = `${r.metric}|${r.fy}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  for (const [k, rows] of groups) {
    const [metric, fyS] = k.split("|");
    const fy = Number(fyS);
    const bases = new Set(rows.map((r) => r.basis));
    if (bases.size !== 1) fail(`${k}: more than one country basis`);
    const preliminary = rows[0].status === "preliminary";
    if (rows.some((r) => (r.status === "preliminary") !== preliminary)) fail(`${k}: mixed statuses`);
    if (rows[0].basis === "nationality" && !preliminary) fail(`${k}: final year by nationality (the Yearbook is by birth)`);
    const keys = new Set<string>();
    for (const r of rows) {
      if (keys.has(r.country_key)) fail(`${k}: ${r.country_key} twice`);
      keys.add(r.country_key);
    }
    const total = totals.get(k) ?? fail(`${k}: by-country rows for a year with no national total`);
    const sum = rows.reduce((s, r) => s + r.value, 0);
    if (Math.abs(sum - total.value) > slackOf([...rows, total])) fail(`${k}: countries sum to ${sum}, national total ${total.value}`);
    if (fy < firstDetail) fail(`${k}: countries before the first detail year`);
    void metric;
  }
}

const lastName = (full: string) => full.split(" ").pop() ?? full;
const partyOf = (a: Administration): "D" | "R" => (a.party === "Democratic" ? "D" : "R");

export function buildLprPayload(input: {
  series: readonly LprSeriesRow[];
  byCountry: readonly LprCountryRow[];
  notes: readonly LprNote[];
  admins: readonly Administration[];
}): LprPayload {
  const { series, byCountry, notes, admins } = input;
  assertLprInvariants(series, byCountry, notes);
  const adminById = new Map(admins.map((a) => [a.term_id, a]));
  const admin = (id: string) => adminById.get(id) ?? fail(`term ${id} is not in the administrations table`);

  const lprTotals = series.filter((r) => r.metric === "lpr" && r.admission_type === null && r.class === null).sort((a, b) => a.period - b.period);
  const at = (fy: number, metric: "lpr" | "naturalizations", type: "new_arrival" | "adjustment" | null, cls: LprClassKey | null) =>
    series.find((r) => r.period === fy && r.metric === metric && r.admission_type === type && r.class === cls);

  const years: LprYear[] = lprTotals.map((t) => {
    const fy = t.period;
    const hasDetail = at(fy, "lpr", null, "other") !== undefined;
    const nat = at(fy, "naturalizations", null, null);
    return {
      fy,
      preliminary: t.status === "preliminary",
      lpr: t.value,
      classes: hasDetail ? (Object.fromEntries(LPR_CLASS_STACK.map((c) => [c, at(fy, "lpr", null, c)!.value])) as Record<LprClassKey, number>) : null,
      newArrivals: at(fy, "lpr", "new_arrival", null)?.value ?? null,
      adjustments: at(fy, "lpr", "adjustment", null)?.value ?? null,
      naturalizations: nat?.value ?? null,
      rounded: t.rounding !== null,
      termId: t.administration_term_id,
      party: partyOf(admin(t.administration_term_id)),
      blended: t.blended,
      days: t.administration_days.map((d) => ({ termId: d.term_id, last: lastName(admin(d.term_id).president), days: d.days })),
      noteIds: [...new Set([...t.note_ids, ...(nat?.note_ids ?? [])])],
    };
  });

  const terms: LprTerm[] = [...new Set(years.flatMap((y) => y.days.map((d) => d.termId)))]
    .map(admin)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((a) => ({ termId: a.term_id, president: a.president, last: lastName(a.president), party: partyOf(a) }));

  const refs: LprCountryRef[] = [];
  const refIndex = new Map<string, number>();
  const groups = new Map<string, LprCountryRow[]>();
  for (const r of byCountry) {
    const k = `${r.metric}|${r.fy}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const countryYears: LprCountryYear[] = [...groups.values()]
    .map((rows) => {
      const sorted = [...rows].sort((a, b) => b.value - a.value || a.country_key.localeCompare(b.country_key));
      return {
        fy: rows[0].fy,
        metric: rows[0].metric,
        basis: rows[0].basis,
        preliminary: rows[0].status === "preliminary",
        total: sorted.reduce((s, r) => s + r.value, 0),
        rows: sorted.map((r): [number, number] => {
          if (!refIndex.has(r.country_key)) {
            refIndex.set(r.country_key, refs.length);
            refs.push({ key: r.country_key, name: r.country_name, kind: r.kind });
          }
          return [refIndex.get(r.country_key)!, r.value];
        }),
      };
    })
    .sort((a, b) => a.metric.localeCompare(b.metric) || a.fy - b.fy);

  return {
    years,
    terms,
    notes: notes.map((n) => ({ id: n.id, kind: n.kind, metric: n.metric, fyStart: n.fy_start, fyEnd: n.fy_end, title: n.title, text: n.text })),
    countries: refs,
    countryYears,
    firstFy: years[0].fy,
    lastFy: years[years.length - 1].fy,
    firstDetailFy: years.find((y) => y.classes !== null)?.fy ?? fail("no year with classes"),
    asOf: lprTotals[0].as_of,
  };
}

/**
 * Countries for one metric and year, largest first, with the change from the year before when that
 * year is on the same basis (a nationality year is never compared with a birth year). Buckets
 * (all other countries, unknown, withheld) are left out of the ranking.
 */
export function rankLprCountries(p: LprPayload, metric: "lpr" | "naturalizations", fy: number): RankedLprCountry[] {
  const cur = p.countryYears.find((c) => c.metric === metric && c.fy === fy);
  if (!cur) return [];
  const prev = p.countryYears.find((c) => c.metric === metric && c.fy === fy - 1 && c.basis === cur.basis);
  const prevBy = new Map((prev?.rows ?? []).map(([ci, v]) => [ci, v]));
  return cur.rows
    .filter(([ci]) => p.countries[ci].kind === "country")
    .map(([ci, value], i) => ({ ci, key: p.countries[ci].key, name: p.countries[ci].name, value, rank: i + 1, change: prev ? value - (prevBy.get(ci) ?? 0) : null }));
}
