import type { Administration } from "./executive-orders-entities";
import type { EncounterScope, EncountersNote, EncountersSeriesRow } from "./encounters-entities";
import type { EncounterParts, EncountersMarker, EncountersPayload, EncountersTerm, EncountersYear } from "./encounters-types";

/**
 * Pure shaping for the CBP border-encounters card: the fiscal-year series joined to presidents, with the numbered
 * definition changes. No I/O (the reader is `lib/encounters-data.ts`), so it is unit-tested over the real files. Only
 * type imports from the entities file, so client components can use it without pulling in Zod.
 *
 * CBP only: nothing here reads, sums or divides an ICE figure.
 */

const fail = (msg: string): never => {
  throw new Error(`encounters invariant: ${msg}`);
};

const lastName = (full: string) => full.split(" ").pop() ?? full;
const partyOf = (a: Administration): "D" | "R" => (a.party === "Democratic" ? "D" : "R");

/**
 * Checks the series as written (the transform runs it, the reader runs it again): unique keys, contiguous years, one
 * level of detail per year, the same rows nationwide and southwest, the southwest within the nationwide figure, Title 42
 * only FY2020–FY2023, only the newest year preliminary, and every cited note present.
 */
export function assertEncountersInvariants(series: readonly EncountersSeriesRow[], notes: readonly EncountersNote[]): void {
  const noteIds = new Set(notes.map((n) => n.id));
  const seen = new Set<string>();
  for (const r of series) {
    const k = `${r.period}|${r.scope}|${r.component}|${r.authority}`;
    if (seen.has(k)) fail(`duplicate row ${k}`);
    seen.add(k);
    for (const id of r.note_ids) if (!noteIds.has(id)) fail(`FY${r.period} cites unknown note ${id}`);
    if (r.authority === "title42" && (r.period < 2020 || r.period > 2023)) fail(`FY${r.period}: Title 42 row outside FY2020–FY2023`);
  }
  const fys = [...new Set(series.map((r) => r.period))].sort((a, b) => a - b);
  if (!fys.length) fail("no rows");
  fys.forEach((fy, i) => fy !== fys[0] + i && fail(`years not contiguous at FY${fy}`));
  const lastFy = fys.at(-1)!;
  for (const fy of fys) {
    const rows = series.filter((r) => r.period === fy);
    if (new Set(rows.map((r) => r.detail)).size !== 1 || new Set(rows.map((r) => r.status)).size !== 1 || new Set(rows.map((r) => r.months)).size !== 1) {
      fail(`FY${fy}: rows disagree on detail, status or months`);
    }
    if (rows[0].status === "preliminary" && fy !== lastFy) fail(`FY${fy} is preliminary but not the newest year`);
    if (rows[0].status === "final" && rows[0].months !== 12) fail(`FY${fy} is final with ${rows[0].months} months`);
    const keys = (s: EncounterScope) => rows.filter((r) => r.scope === s).map((r) => `${r.component}|${r.authority}`).sort().join(",");
    if (keys("nationwide") !== keys("southwest")) fail(`FY${fy}: nationwide and southwest rows differ`);
    if (!rows.some((r) => r.component === "usbp" && r.authority === "title8")) fail(`FY${fy}: no Border Patrol row`);
    for (const r of rows.filter((x) => x.scope === "southwest")) {
      const n = rows.find((x) => x.scope === "nationwide" && x.component === r.component && x.authority === r.authority)!;
      if (r.value > n.value) fail(`FY${fy} ${r.component} ${r.authority}: southwest ${r.value} exceeds nationwide ${n.value}`);
    }
  }
}

function parts(rows: readonly EncountersSeriesRow[], scope: EncounterScope): EncounterParts {
  const get = (c: string, a: string) => rows.find((r) => r.scope === scope && r.component === c && r.authority === a)?.value ?? null;
  const usbp = get("usbp", "title8") ?? fail(`FY${rows[0].period} ${scope}: no Border Patrol row`);
  const ofo = get("ofo", "title8");
  const t42u = get("usbp", "title42");
  const t42o = get("ofo", "title42");
  const title42 = t42u === null && t42o === null ? null : (t42u ?? 0) + (t42o ?? 0);
  return { usbp, ofo, title42, title42ByComponent: title42 === null ? null : { usbp: t42u ?? 0, ofo: t42o ?? 0 }, total: usbp + (ofo ?? 0) + (title42 ?? 0) };
}

export function buildEncountersPayload(input: { series: readonly EncountersSeriesRow[]; notes: readonly EncountersNote[]; admins: readonly Administration[] }): EncountersPayload {
  const { series, notes, admins } = input;
  assertEncountersInvariants(series, notes);
  const adminById = new Map(admins.map((a) => [a.term_id, a]));

  const fys = [...new Set(series.map((r) => r.period))].sort((a, b) => a - b);
  const years: EncountersYear[] = fys.map((fy) => {
    const rows = series.filter((r) => r.period === fy);
    const r0 = rows[0];
    const admin = adminById.get(r0.administration_term_id) ?? fail(`FY${fy} term ${r0.administration_term_id} is not in administrations.json`);
    return {
      fy,
      detail: r0.detail,
      preliminary: r0.status === "preliminary",
      months: r0.months,
      nationwide: parts(rows, "nationwide"),
      southwest: parts(rows, "southwest"),
      ofoRounded: rows.some((r) => r.component === "ofo" && r.rounding !== null),
      termId: r0.administration_term_id,
      party: partyOf(admin),
      blended: r0.blended,
      days: r0.administration_days.map((d) => ({ termId: d.term_id, last: lastName((adminById.get(d.term_id) ?? fail(`unknown term ${d.term_id}`)).president), days: d.days })),
      noteIds: [...new Set(rows.flatMap((r) => r.note_ids))],
    };
  });

  const terms: EncountersTerm[] = [...new Set(years.map((y) => y.termId))]
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

  const markers: EncountersMarker[] = notes
    .filter((n) => n.marker !== null)
    .sort((a, b) => a.marker!.date.localeCompare(b.marker!.date) || a.id.localeCompare(b.id))
    .map((n, i) => ({ n: i + 1, id: n.id, date: n.marker!.date, precision: n.marker!.precision, label: n.marker!.label, title: n.title, text: n.text }));

  const firstOfo = years.find((y) => y.nationwide.ofo !== null) ?? fail("no year has OFO figures");
  return {
    years,
    terms,
    markers,
    notes: notes.map((n) => ({ id: n.id, kind: n.kind, title: n.title, text: n.text })),
    firstFy: fys[0],
    lastFy: fys.at(-1)!,
    firstOfoFy: firstOfo.fy,
    asOf: series[0].as_of,
  };
}
