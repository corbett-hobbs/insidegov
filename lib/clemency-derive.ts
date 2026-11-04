import { CLEMENCY_TERMS, OFFENSE_CATEGORIES, type ClemencyFile, type ClemencyGrant, type ClemencyPayload, type ClemencyPresident, type TimingBucket } from "./clemency-types";

const DAY = 86_400_000;
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const quantile = (sorted: readonly number[], q: number) => {
  const p = (sorted.length - 1) * q;
  const lo = Math.floor(p);
  return sorted[lo]! + (sorted[Math.min(lo + 1, sorted.length - 1)]! - sorted[lo]!) * (p - lo);
};
/** Grants that count: an amended warrant or a person inside a group warrant's figure is listed but not counted again. */
export const counted = (g: ClemencyGrant) => !g.amended && !g.inGroup;

/** First year, final year before the last 90 days, last 90 days, or the middle. A term still running is measured against its scheduled end. */
export function timingBucket(date: string, start: string, end: string): TimingBucket {
  const t = ms(date);
  if (t >= ms(end) - 90 * DAY) return "last90";
  if (t < ms(start) + 365 * DAY) return "first";
  if (t >= ms(end) - 365 * DAY) return "finalYear";
  return "middle";
}

export function buildClemencyPayload(file: ClemencyFile, grants: readonly ClemencyGrant[]): ClemencyPayload {
  const presidents: ClemencyPresident[] = CLEMENCY_TERMS.map((t) => {
    const years = file.years.filter((y) => y.term === t.id);
    const here = grants.filter((g) => g.term === t.id);
    const pardons = years.reduce((n, y) => n + y.pardons, 0);
    const commutations = years.reduce((n, y) => n + y.commutations, 0);
    const group = years.reduce((n, y) => n + y.group, 0);
    const total = pardons + commutations + group;
    const end = t.end ?? `${Number(t.start.slice(0, 4)) + 4}-01-20`;
    const months = (Math.min(ms(t.end ?? file.updated), ms(end)) - ms(t.start)) / (DAY * 30.4375);

    const denied = years.every((y) => y.denied != null) ? years.reduce((n, y) => n + (y.denied ?? 0), 0) : null;
    const closed = years.reduce((n, y) => n + (y.closed ?? 0), 0);
    const outcome = denied == null ? null : { granted: total, denied, closed, share: total / (total + denied + closed) };

    const counts = Object.fromEntries(OFFENSE_CATEGORIES.map((c) => [c, 0])) as ClemencyPresident["offense"]["counts"];
    let offenseN = 0;
    for (const g of here) {
      if (g.amended || !g.category) continue;
      counts[g.category]++;
      offenseN++;
    }

    // Group warrants and proclamations weigh by the people they cover; a proclamation with no count has no weight.
    const timing: ClemencyPresident["timing"]["counts"] = { first: 0, middle: 0, finalYear: 0, last90: 0 };
    let timingN = 0;
    for (const g of here) {
      if (!counted(g)) continue;
      const w = g.people === undefined ? 1 : (g.people ?? 0);
      timing[timingBucket(g.date, t.start, end)] += w;
      timingN += w;
    }

    const allPardons = here.filter((g) => g.type === "p" && !g.amended);
    const gaps = allPardons.flatMap((g) => (g.sentenceYear == null ? [] : [Number(g.date.slice(0, 4)) - g.sentenceYear])).sort((a, b) => a - b);
    const age = gaps.length
      ? { n: gaps.length, of: allPardons.length, q1: quantile(gaps, 0.25), median: quantile(gaps, 0.5), q3: quantile(gaps, 0.75), within5: gaps.filter((v) => v <= 5).length / gaps.length }
      : null;

    return { term: t.id, label: t.label, president: t.president, party: t.party, firstFy: Math.min(...years.map((y) => y.fy)), lastFy: Math.max(...years.map((y) => y.fy)), months, pardons, commutations, group, total, outcome, offense: { n: offenseN, counts }, timing: { n: timingN, counts: timing }, age };
  });
  const pendingByFy = new Map<number, number>();
  for (const y of file.years) if (y.pendingStart != null && !pendingByFy.has(y.fy)) pendingByFy.set(y.fy, y.pendingStart);
  return {
    updated: file.updated,
    firstFy: 1993,
    lastFy: Math.max(...file.years.map((y) => y.fy)),
    years: file.years,
    presidents,
    proclamations: file.proclamations,
    pending: [...pendingByFy].map(([fy, value]) => ({ fy, value })).sort((a, b) => a.fy - b.fy),
    endOfBidenPending: file.endOfBidenPending,
    listed: grants.length,
  };
}
