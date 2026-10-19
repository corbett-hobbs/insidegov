import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { administration } from "./executive-orders-entities";
import { HISTORICAL_ADMINISTRATIONS } from "./troops-presidents";
import { presidentBio } from "./president-entities";
import { justice as justiceSchema } from "./court-entities";
import { getJusticeProfile } from "./justice-data";
import { justicePath } from "./justice-url";
import { getTimelinePayload } from "./timeline-data";
import { getLawsList, getLawsPageData } from "./laws-data";
import { seriesOf, tallyText } from "./laws-derive";
import { lawId, lawPath } from "./law-url";
import { getExecutiveOrdersData } from "./executive-orders-data";
import { EO_TOPICS, EO_TOPIC_LABELS, topicFill } from "./executive-orders-types";
import { getIndicatorObservations } from "./indicator-data";
import { yearOverYearPercent } from "./indicator-derive";
import { getLprPayload } from "./lpr-data";
import { getRefugeePayload } from "./refugee-data";
import { getImmigrationPageData } from "./immigration-data";
import { getEncountersPayload } from "./encounters-data";
import { getTradeNational } from "./trade-data";
import { periodOf } from "./trade-derive";
import { getAidPayload } from "./foreign-aid-data";
import { decodeAid, spendingByYear, topRecipientsByYear } from "./foreign-aid-derive";
import { getTroopsPayload } from "./troops-data";
import { decodeTroops, periodView } from "./troops-derive";
import { lawMajorFile } from "./laws-entities";
import { energyObservation } from "./energy-entities";
import { groupObservations } from "./energy-derive";
import {
  addDays,
  biggestMajorLaw,
  buildPresidents,
  congressSummary,
  countByTermYear,
  coverageNote,
  dateLabel,
  daysInOffice,
  fiscalYearBounds,
  fiscalYearsInTerm,
  fracYear,
  inTerms,
  justicesAppointed,
  longestLeader,
  pointsInTerm,
  termLast,
  termYearSegments,
  type Granularity,
} from "./president-derive";
import type {
  CountBreakdown,
  EosSummary,
  LawsSummary,
  PresidentPageData,
  PresidentRef,
  PresidentSummary,
  PresidentTerm,
  SeriesCardId,
  SeriesFormat,
  SeriesPanel,
  SeriesSegment,
} from "./president-types";

/**
 * Build-time reader for the Presidents directory and the president pages. It reads nothing new from the pipeline except
 * the portraits and bios (`president_bios.json`): every number comes through the loader the matching Presidency, Congress
 * or Court page already uses, then is clipped to the president's time in office by `lib/president-derive.ts`.
 */
const OUT = join(process.cwd(), "pipeline", "output");
const read = (file: string): unknown => JSON.parse(readFileSync(join(OUT, file), "utf8"));

const today = () => new Date().toISOString().slice(0, 10);

let presidentsCache: PresidentRef[] | null = null;
let biosCache: Map<string, z.infer<typeof presidentBio>> | null = null;

function bios() {
  biosCache ??= new Map(z.array(presidentBio).parse(read("president_bios.json")).map((b) => [b.slug, b]));
  return biosCache;
}

/** Every president with a page, oldest first. */
export function getPresidents(): PresidentRef[] {
  if (presidentsCache) return presidentsCache;
  const admins = [...HISTORICAL_ADMINISTRATIONS, ...z.array(administration).parse(read("administrations.json"))];
  const photos = new Map([...bios().values()].flatMap((b) => (b.photo ? [[b.slug, b.photo.path] as const] : [])));
  presidentsCache = buildPresidents(admins, photos);
  return presidentsCache;
}

export const getPresidentSlugs = () => getPresidents().map((p) => p.slug);

const allTerms = (): PresidentTerm[] => getPresidents().flatMap((p) => p.terms);

// ------------------------------------------------------------------------------------------------ laws and orders

function lawsFor(p: PresidentRef, now: string): LawsSummary | null {
  const list = getLawsList();
  const page = getLawsPageData();
  const first = list.rows.reduce((m, r) => (r[2] < m ? r[2] : m), "9999");
  if (p.terms.every((t) => termLast(t, now) < first)) return null;
  const signerIds = new Set(list.signers.flatMap(([name], i) => (name === p.name ? [i] : [])));
  const mine = list.rows.filter((r) => signerIds.has(r[13]) && inTerms(r[2], p.terms, now));
  const signed = mine.filter((r) => r[10] === 0);
  const groupOfArea = page.areas.map((a) => a.group);
  const groupLabel = new Map(page.groups.map((g) => [g.id, g.label]));
  const fill = new Map(seriesOf(page).map((s, i) => [s.id, s.id === "not-classified" ? "var(--ink-faint)" : `var(--laws-${i + 1})`]));
  const n = new Map<string, number>();
  for (const r of signed) n.set(groupOfArea[r[4]], (n.get(groupOfArea[r[4]]) ?? 0) + 1);
  const groups: CountBreakdown[] = [...n.entries()]
    .map(([id, c]) => ({ id, label: groupLabel.get(id) ?? "Not classified", n: c, color: fill.get(id) ?? "var(--ink-faint)" }))
    .sort((a, b) => b.n - a.n);
  const byYear = countByTermYear(signed.map((r) => r[2]), p.terms, now);
  const assessed = signed.filter((r) => r[0] <= page.majorThrough);
  const majorRows = signed.filter((r) => r[9] === 1);
  return {
    signed: signed.length,
    overridden: mine.length - signed.length,
    major: assessed.length > 0 ? majorRows.length : null,
    majorThrough: page.majorThrough,
    majorPartial: signed.some((r) => r[0] > page.majorThrough),
    majorList: majorRows.map((r) => ({
      title: r[3],
      date: r[2],
      path: lawPath(lawId(r[0], r[1]), r[3]),
      summary: r[11],
      area: { label: groupLabel.get(groupOfArea[r[4]]) ?? "Not classified", color: fill.get(groupOfArea[r[4]]) ?? "var(--ink-faint)" },
      house: r[6],
      senate: r[7],
      votes: r[5] === 0 && r[6][0] === 3 && r[7][0] === 3 ? "No vote method recorded" : `${tallyText("House", r[6])} · ${tallyText("Senate", r[7])}`,
    })),
    byYear,
    panel: { id: "laws", title: "Laws signed per year in office", kind: "bars", format: "count", color: "var(--ink-muted)", segments: termYearSegments(byYear, p.terms, now) },
    groups,
    coverage: coverageNote(first, p.terms),
    dataThrough: page.dataThrough,
  };
}

function eosFor(p: PresidentRef, now: string): EosSummary | null {
  const data = getExecutiveOrdersData();
  const termIds = new Set(p.terms.map((t) => t.termId));
  if (!data.administrations.some((a) => termIds.has(a.termId))) return null;
  const items = data.years.flatMap((y) => y.items).filter((o) => termIds.has(o.termId));
  const first = data.years.flatMap((y) => y.items).reduce((m, o) => (o.signed < m ? o.signed : m), "9999");
  const n = new Map<string, number>();
  for (const o of items) n.set(o.topic, (n.get(o.topic) ?? 0) + 1);
  const byYear = countByTermYear(items.map((o) => o.signed), p.terms, now);
  return {
    total: items.length,
    byYear,
    panel: { id: "eos", title: "Executive orders per year in office", kind: "bars", format: "count", color: "var(--ink-muted)", segments: termYearSegments(byYear, p.terms, now) },
    topics: EO_TOPICS.filter((t) => n.has(t))
      .map((t) => ({ id: t, label: EO_TOPIC_LABELS[t], n: n.get(t)!, color: topicFill(t) }))
      .sort((a, b) => b.n - a.n),
    coverage: coverageNote(first, p.terms),
    throughDate: data.throughDate,
  };
}

// ------------------------------------------------------------------------------------------------ series

type Dated = { date: string; value: number | null; label?: string };

function panel(
  p: PresidentRef,
  now: string,
  spec: { id: string; title: string; kind: SeriesPanel["kind"]; format: SeriesFormat; color: string },
  segs: (t: PresidentTerm) => SeriesSegment,
  firstDate: string | null,
): SeriesPanel | null {
  const segments = p.terms.map(segs);
  if (segments.every((s) => s.points.length === 0) || firstDate === null) return null;
  // A term with no values at all (before the series starts) is left out rather than drawn empty.
  const kept = segments.filter((s) => s.points.length > 0);
  return { ...spec, segments: kept, coverage: coverageNote(firstDate, p.terms.filter((t) => kept.some((s) => s.termId === t.termId))) };
}

const dated = (p: PresidentRef, now: string, pts: readonly Dated[], g: Granularity) => (t: PresidentTerm) => pointsInTerm(pts, t, g, now);
const firstOf = (pts: readonly Dated[]) => pts.find((x) => x.value !== null)?.date ?? null;

let seriesCache: ReturnType<typeof loadSeries> | null = null;

function loadSeries() {
  const un = getIndicatorObservations("UNRATE", { fullHistory: true });
  const infl = yearOverYearPercent(getIndicatorObservations("CPIAUCSL", { fullHistory: true })).filter((x) => x.value !== null);
  const inflBy = new Map(infl.map((x) => [x.date, x.value as number]));
  const misery = un.flatMap((x) => (inflBy.has(x.date) ? [{ date: x.date, value: x.value + inflBy.get(x.date)! }] : []));
  const deficit = getIndicatorObservations("FYFSGDA188S", { fullHistory: true }).map((x) => ({ fy: Number(x.date.slice(0, 4)), value: x.value }));
  const debt = getIndicatorObservations("GFDEGDQ188S", { fullHistory: true });

  const lpr = getLprPayload().years.map((y) => ({ fy: y.fy, value: y.lpr, preliminary: y.preliminary, termId: y.termId }));
  const refugees = getRefugeePayload().years.map((y) => ({ fy: y.fy, value: y.admissions, preliminary: y.preliminary, termId: y.termId }));
  const removals = getImmigrationPageData().removalsYears.map((y) => ({ fy: y.fy, value: y.value, preliminary: y.status === "preliminary", termId: y.termId }));
  const encounters = getEncountersPayload().years.map((y) => ({
    fy: y.fy,
    value: y.nationwide.usbp + (y.nationwide.ofo ?? 0) + (y.nationwide.title42 ?? 0),
    preliminary: y.preliminary,
    termId: y.termId,
  }));

  const trade = getTradeNational();
  const tradeBalance: Dated[] = trade.sa.exports.map((ex, i) => {
    const im = trade.sa.imports[i];
    return { date: `${periodOf(i)}-01`, value: ex === null || im === null ? null : (ex - im) / 1000 };
  });

  const aidPayload = getAidPayload();
  const aid = decodeAid(aidPayload);
  const fy0 = aidPayload.years[0];
  const fy1 = aidPayload.years[aidPayload.years.length - 1];
  const aidYears = spendingByYear(aid, fy0, fy1, -1, null).map((y) => ({ fy: y.fy, value: y.total / 1e9, preliminary: aidPayload.partialYears.includes(y.fy) }));
  const aidTop = topRecipientsByYear(aid, fy0, fy1, null).map((y) => ({ fy: y.fy, name: y.ranked[0] ? aidPayload.countries[y.ranked[0].ci].name : null }));

  const troopsPayload = getTroopsPayload();
  const troops = decodeTroops(troopsPayload);
  const troopYears = troopsPayload.years.flatMap((y) => {
    const v = periodView(troops, 0, y.period);
    if (v.unavailable) return [];
    const period = troopsPayload.periods[y.period];
    const top = v.ranked[0] ? troopsPayload.places[v.ranked[0].place].name : null;
    return [{ date: `${period.period}-01`, fy: y.fy, label: period.label, value: v.abroad, partial: y.partial, termId: troopsPayload.terms[y.term].termId, top }];
  });

  const energy = groupObservations(z.array(energyObservation).parse(read("energy_observations.json")));
  // Weekly SPR stocks are dated by the week's last day; shift to its first so a week sits inside the term it belongs to.
  const spr: Dated[] = (energy.get("WCSSTUS1") ?? []).map((o) => ({ date: addDays(o.date, -6), value: o.value / 1000, label: dateLabel(o.date) }));

  return { un, infl, misery, deficit, debt, lpr, refugees, removals, encounters, tradeBalance, aidYears, aidTop, troopYears, spr };
}

function seriesCards(p: PresidentRef, now: string): Pick<PresidentPageData, "cards" | "aidTop" | "troopsTop"> {
  seriesCache ??= loadSeries();
  const s = seriesCache;
  const all = allTerms();
  const fy = (rows: readonly { fy: number; value: number; preliminary?: boolean; termId?: string }[]) => (t: PresidentTerm) => fiscalYearsInTerm(rows, t, all, now);
  const firstFy = (rows: readonly { fy: number }[]) => (rows.length ? fiscalYearBounds(rows[0].fy)[0] : null);
  const cards: PresidentPageData["cards"] = {};
  const put = (id: SeriesCardId, panels: (SeriesPanel | null)[]) => {
    const kept = panels.filter((x): x is SeriesPanel => x !== null);
    if (kept.length) cards[id] = kept;
  };

  const misery = panel(p, now, { id: "misery", title: "Misery index", kind: "line", format: "num", color: "var(--ink)" }, dated(p, now, s.misery, "month"), firstOf(s.misery));
  const parts = panel(p, now, { id: "unemployment", title: "Unemployment rate", kind: "line", format: "pct", color: "var(--sector-econ)" }, dated(p, now, s.un, "month"), firstOf(s.un));
  const inflation = panel(p, now, { id: "inflation", title: "Inflation", kind: "line", format: "pct", color: "var(--sector-health)" }, dated(p, now, s.infl, "month"), firstOf(s.infl));
  if (parts && inflation) parts.parts = [{ id: inflation.id, title: inflation.title, color: inflation.color, segments: inflation.segments }];
  put("misery", [misery, parts && { ...parts, title: "Unemployment and inflation", lineTitle: parts.title }]);

  put("fiscal", [
    panel(p, now, { id: "deficit", title: "Budget balance, % of GDP", kind: "bars", format: "pctSigned", color: "var(--ink-muted)" }, fy(s.deficit), firstFy(s.deficit)),
    panel(p, now, { id: "debt", title: "Public debt, % of GDP", kind: "line", format: "pct", color: "var(--ink)" }, dated(p, now, s.debt, "quarter"), firstOf(s.debt)),
  ]);

  put("arrivals", [
    panel(p, now, { id: "lpr", title: "Green cards", kind: "bars", format: "count", color: "var(--ink-muted)" }, fy(s.lpr), firstFy(s.lpr)),
    panel(p, now, { id: "refugees", title: "Refugee admissions", kind: "bars", format: "count", color: "var(--ink-muted)" }, fy(s.refugees), firstFy(s.refugees)),
  ]);
  put("removals", [
    panel(p, now, { id: "removals", title: "Removals", kind: "bars", format: "count", color: "var(--ink-muted)" }, fy(s.removals), firstFy(s.removals)),
    panel(p, now, { id: "encounters", title: "Border encounters", kind: "bars", format: "count", color: "var(--ink-muted)" }, fy(s.encounters), firstFy(s.encounters)),
  ]);

  put("trade", [panel(p, now, { id: "trade", title: "Goods balance, $B a month", kind: "line", format: "usdB", color: "var(--ink)" }, dated(p, now, s.tradeBalance, "month"), firstOf(s.tradeBalance))]);
  const aidPanel = panel(p, now, { id: "aid", title: "Disbursed, $ billions", kind: "bars", format: "usdB", color: "var(--ink-muted)" }, fy(s.aidYears), firstFy(s.aidYears));
  put("aid", [aidPanel]);
  const aidFys = new Set(aidPanel?.segments.flatMap((g) => g.points.map((x) => Number(x.label.slice(2)))) ?? []);
  const aidTop = longestLeader(s.aidTop.filter((y) => aidFys.has(y.fy) && y.name).map((y) => ({ name: y.name! })));

  const troopRows = (t: PresidentTerm): SeriesSegment => {
    const seg = pointsInTerm([], t, "month", now);
    seg.points = s.troopYears
      .filter((y) => y.termId === t.termId)
      // One bar per year, centred in its fiscal year like every other bar panel, whatever month its snapshot was taken
      // (the year in progress shows its latest quarter, but it still sits in its own year's slot).
      .map((y) => {
        const [a, b] = fiscalYearBounds(y.fy);
        return { x: Math.min(seg.x1, Math.max(seg.x0, (fracYear(a) + fracYear(addDays(b, 1))) / 2)), value: y.value, label: y.label, ...(y.partial ? { preliminary: true } : {}) };
      });
    return seg;
  };
  const troopsPanel = panel(p, now, { id: "troops", title: "Active-duty troops abroad", kind: "bars", format: "count", color: "var(--ink-muted)" }, troopRows, s.troopYears[0]?.date ?? null);
  put("troops", [troopsPanel]);
  const troopTermIds = new Set(p.terms.map((t) => t.termId));
  const troopsTop = longestLeader(s.troopYears.filter((y) => troopTermIds.has(y.termId) && y.top).map((y) => ({ name: y.top! })));

  put("spr", [panel(p, now, { id: "spr", title: "Reserve level, million barrels", kind: "line", format: "mbbl", color: "var(--ink)" }, dated(p, now, s.spr, "week"), firstOf(s.spr))]);

  return { cards, aidTop: aidPanel ? aidTop : null, troopsTop: troopsPanel ? troopsTop : null };
}

// ------------------------------------------------------------------------------------------------ pages

let justicesCache: z.infer<typeof justiceSchema>[] | null = null;

export function getPresidentPage(slug: string): PresidentPageData | null {
  const list = getPresidents();
  const i = list.findIndex((p) => p.slug === slug);
  if (i < 0) return null;
  const p = list[i];
  const now = today();
  const bio = bios().get(slug) ?? null;
  const timeline = getTimelinePayload();

  justicesCache ??= z.array(justiceSchema).parse(JSON.parse(readFileSync(join(OUT, "court", "justices.json"), "utf8")));
  const justices = justicesAppointed(
    justicesCache.map((j) => ({ ...j, id: j.justice_id, name: j.name.full })),
    p.terms,
    now,
  ).map((a) => {
    const profile = getJusticeProfile(a.id);
    return { ...a, name: profile?.justice.name ?? a.name, path: profile ? justicePath(profile.justice) : null, photo: profile?.photoSrc ?? null, serving: justicesCache!.find((j) => j.justice_id === a.id)?.service_end === null };
  });

  return {
    president: p,
    bio: bio ? { extract: bio.extract, url: bio.url, photoSource: bio.photo?.source_url ?? null, photoLicense: bio.photo?.license ?? null } : null,
    prev: i > 0 ? { slug: list[i - 1].slug, name: list[i - 1].name, last: list[i - 1].last, party: list[i - 1].party, photo: list[i - 1].photo } : null,
    next: i < list.length - 1 ? { slug: list[i + 1].slug, name: list[i + 1].name, last: list[i + 1].last, party: list[i + 1].party, photo: list[i + 1].photo } : null,
    days: daysInOffice(p.terms, now),
    asOf: now,
    congress: congressSummary(timeline.congresses, p.terms, p.party, now),
    justices,
    laws: lawsFor(p, now),
    eos: eosFor(p, now),
    ...seriesCards(p, now),
  };
}

let majorRankCache: Map<string, number> | null = null;

/** Law id -> rank for `biggestMajorLaw`: 2 when Mayhew prints its entry in capitals and the entry names only that law, 1 when the capitals entry is shared. */
function majorRanks(): Map<string, number> {
  if (majorRankCache) return majorRankCache;
  const { laws } = lawMajorFile.parse(read("laws_major.json"));
  const sharedBy = new Map<string, number>();
  for (const entries of Object.values(laws)) for (const e of entries) if (e[2] === 1) sharedBy.set(e[0], (sharedBy.get(e[0]) ?? 0) + 1);
  majorRankCache = new Map(
    Object.entries(laws).map(([id, entries]) => {
      const caps = entries.filter((e) => e[2] === 1);
      return [id, caps.length === 0 ? 0 : caps.some((e) => sharedBy.get(e[0]) === 1) ? 2 : 1] as const;
    }),
  );
  return majorRankCache;
}

/** The directory rows, newest first (lists with dates run newest first). */
export function getPresidentDirectory(): PresidentSummary[] {
  const ranks = majorRanks();
  return getPresidents()
    .map((p) => {
      const page = getPresidentPage(p.slug)!;
      const laws = page.laws;
      const top = laws ? biggestMajorLaw(laws.majorList, (l) => ranks.get(l.path.split("/")[3]) ?? 0) : null;
      const misery = page.cards.misery?.[0];
      const pts = misery?.segments.flatMap((s) => s.points) ?? [];
      return {
        ...p,
        days: page.days,
        major: laws?.major ?? null,
        majorTop: top ? { title: top.title, path: top.path } : null,
        majorFromStart: laws?.coverage === undefined,
        majorPartial: laws?.majorPartial ?? false,
        majorThrough: laws?.majorThrough ?? 0,
        noLawsData: laws === null,
        control: page.congress.days,
        justices: page.justices
          .filter((j) => !j.elevated)
          .map((j) => ({ id: j.id, name: j.name, photo: j.photo, path: j.path, nominated: j.nominated, serving: j.serving })),
        misery: misery && pts.length
          ? {
              segments: misery.segments.map((s) => ({ x0: s.x0, x1: s.x1, points: s.points.map((q): [number, number] => [q.x, q.value]) })),
              first: pts[0].value,
              last: pts[pts.length - 1].value,
              firstLabel: pts[0].label,
              lastLabel: pts[pts.length - 1].label,
            }
          : null,
      };
    })
    .reverse();
}
