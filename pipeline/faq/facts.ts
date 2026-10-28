import { readFileSync } from "node:fs";
import { compactNumber } from "../../lib/format-number";

/**
 * Figures an FAQ answer may quote from the site's own copy of an agency's data, written out as plain sentences so the drafting
 * model and the number check read them like any other source. Used where the agency's page only renders in a browser (CBP's
 * encounter dashboard). Because they are recomputed from `pipeline/output`, the re-check workflow catches an answer whose
 * figures a data update has overtaken (the southwest share of encounters fell from 71-89% in FY2019-FY2024 to 37% in FY2026).
 * They also keep answers on the latest year: EIA's "Energy Explained" pages lag its monthly data by a year or more.
 */

export type FactsKey = "encounters" | "debt" | "electricity" | "ngExports" | "aid" | "troops";

const pct = (part: number, whole: number) => `${Math.round((part / whole) * 100)}%`;
const read = <T>(file: string): T => JSON.parse(readFileSync(file, "utf8")) as T;

type EncounterRow = { period: number; period_type: string; scope: "nationwide" | "southwest"; component: "usbp" | "ofo"; value: number; status: string; months: number };

/**
 * One paragraph for each of the latest two fiscal years: nationwide, by CBP component, and the southwest border's share of
 * each. Only two, so a share from an older year cannot pass the number check by matching some other year's figure.
 */
export function encountersFacts(rows: readonly EncounterRow[]): string {
  const years = new Map<number, { months: number; status: string; n: Record<string, number> }>();
  for (const r of rows) {
    if (r.period_type !== "fiscal_year") continue;
    const y = years.get(r.period) ?? { months: r.months, status: r.status, n: {} };
    const k = `${r.scope}.${r.component}`;
    y.n[k] = (y.n[k] ?? 0) + r.value;
    years.set(r.period, y);
  }
  const out = ["CBP encounters by fiscal year (InsideGov's copy of CBP's published encounter data):"];
  for (const [fy, y] of [...years].sort((a, b) => b[0] - a[0]).slice(0, 2)) {
    const g = (k: string) => y.n[k] ?? 0;
    const usbp = g("nationwide.usbp");
    const ofo = g("nationwide.ofo");
    const all = usbp + ofo;
    const sw = g("southwest.usbp") + g("southwest.ofo");
    const partial = y.months < 12 ? ` (${y.status}, first ${y.months} months)` : y.status === "final" ? "" : ` (${y.status})`;
    out.push(
      `Fiscal year ${fy}${partial}: ${compactNumber(all)} encounters nationwide. ` +
        `Office of Field Operations, at ports of entry: ${compactNumber(ofo)}, ${pct(ofo, all)} of nationwide encounters. ` +
        `U.S. Border Patrol, between ports of entry: ${compactNumber(usbp)}, ${pct(usbp, all)} of nationwide encounters. ` +
        `Southwest border: ${compactNumber(sw)}, ${pct(sw, all)} of nationwide encounters. ` +
        `${pct(g("southwest.usbp"), usbp)} of Border Patrol's apprehensions and ${pct(g("southwest.ofo"), ofo)} of the Office of Field Operations' encounters were on the southwest border.`,
    );
  }
  return out.join("\n");
}

type DebtRow = { date: string; total: number; held: number };

/** The latest total, public and intragovernmental debt (the data is in millions of dollars). */
export function debtFacts(debt: readonly DebtRow[]): string {
  const last = [...debt].sort((a, b) => a.date.localeCompare(b.date)).at(-1)!;
  const t = (millions: number) => `$${(millions / 1e6).toFixed(1)} trillion`;
  const month = new Date(`${last.date}T00:00:00Z`).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const intra = last.total - last.held;
  return `Debt to the Penny (InsideGov's copy of Treasury's data), ${month}: total federal debt ${t(last.total)}. Debt held by the public ${t(last.held)}, ${pct(last.held, last.total)} of the total. Intragovernmental holdings ${t(intra)}, ${pct(intra, last.total)} of the total.`;
}

type EnergyObs = { series_id: string; date: string; value: number };

const ELECTRICITY: [string, string][] = [
  ["NGETPUS", "natural gas"],
  ["NUETPUS", "nuclear"],
  ["CLETPUS", "coal"],
  ["WYETPUS", "wind"],
  ["SOETPUS", "utility-scale solar"],
  ["HVETPUS", "conventional hydropower"],
];

/** Sums of each series over the months of one year present for every series; null when a series has no month. */
function yearSums(obs: readonly EnergyObs[], ids: readonly string[], year: number, months?: number) {
  const sums: Record<string, number> = {};
  const n: Record<string, number> = {};
  for (const o of obs) {
    if (!ids.includes(o.series_id) || !o.date.startsWith(`${year}-`)) continue;
    if (months && Number(o.date.slice(5, 7)) > months) continue;
    sums[o.series_id] = (sums[o.series_id] ?? 0) + o.value;
    n[o.series_id] = (n[o.series_id] ?? 0) + 1;
  }
  return { sums, months: Math.min(...ids.map((id) => n[id] ?? 0)) };
}

const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * Each source's share of utility-scale generation in the latest full year and the current year so far, and how solar splits
 * between utility-scale plants and small-scale systems (EIA Monthly Energy Review series on the Energy page).
 */
export function electricityFacts(obs: readonly EnergyObs[]): string {
  const ids = ["ELETPUS", "ELEC_SMALL_SOLAR", ...ELECTRICITY.map(([id]) => id)];
  const lastDate = obs.filter((o) => o.series_id === "ELETPUS").map((o) => o.date).sort().at(-1)!;
  const thisYear = Number(lastDate.slice(0, 4));
  const out = ["U.S. electricity net generation, all sectors (InsideGov's copy of EIA Monthly Energy Review data):"];
  for (const [year, label] of [
    [thisYear - 1, `In ${thisYear - 1}`],
    [thisYear, `In ${thisYear} so far (January to ${MONTH[Number(lastDate.slice(5, 7)) - 1]}, preliminary)`],
  ] as const) {
    const { sums, months } = yearSums(obs, ids, year);
    if (year < thisYear && months < 12) continue;
    const total = sums.ELETPUS!;
    const shares = ELECTRICITY.map(([id, name]) => `${name} ${pct(sums[id]!, total)}`).join(", ");
    const wsh = sums.WYETPUS! + sums.SOETPUS! + sums.HVETPUS!;
    const solar = sums.SOETPUS! + sums.ELEC_SMALL_SOLAR!;
    out.push(
      `${label}, shares of utility-scale generation: ${shares}. Wind, utility-scale solar and conventional hydropower together: ${pct(wsh, total)}. ` +
        `Of all solar generation, utility-scale plants made ${pct(sums.SOETPUS!, solar)} and small-scale systems ${pct(sums.ELEC_SMALL_SOLAR!, solar)}.`,
    );
  }
  return out.join("\n");
}

/** A volume in million cubic feet as billions ("645.8 billion cubic feet") or trillions ("5.5 trillion cubic feet"). */
const cf = (mmcf: number) => (mmcf >= 1e6 ? `${(mmcf / 1e6).toFixed(1)} trillion cubic feet` : `${(mmcf / 1e3).toFixed(1)} billion cubic feet`);

/**
 * The latest year of EIA's exports-by-country table (the page text, from `readSource`): pipeline against LNG, and the five
 * largest LNG buyers with their shares; then LNG exports so far this year from the Energy page's monthly series.
 */
export function ngExportsFacts(pageText: string, obs: readonly EnergyObs[]): string {
  const lines = pageText.split("\n").map((l) => l.trim()).filter(Boolean);
  const years = lines.filter((l, i) => /^\d{4}$/.test(l) && i < 40).map(Number);
  const year = Math.max(...years);
  const rows: { name: string; value: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === "Export Prices") break;
    const m = lines[i]!.match(/^\d{4}-(\d{4})$/);
    if (!m) continue;
    let j = i - 1;
    while (j >= 0 && /^[\d,]+$/.test(lines[j]!)) j--;
    const nums = lines.slice(j + 1, i);
    rows.push({ name: lines[j]!, value: Number(m[1]) === year && nums.length ? Number(nums.at(-1)!.replace(/,/g, "")) : 0 });
  }
  const at = (name: string, from = 0) => rows.findIndex((r, k) => k >= from && r.name === name);
  const get = (name: string, from = 0) => rows[at(name, from)]?.value ?? 0;
  const total = get("Total");
  const pipeline = get("Pipeline");
  const canada = get("Canada", at("Pipeline"));
  const mexico = get("Mexico", at("Pipeline"));
  const lng = get("LNG");
  const buyers = rows.slice(at("By Vessel") + 1, at("By Truck")).filter((r) => r.value > 0);
  const top = [...buyers].sort((a, b) => b.value - a.value).slice(0, 5);
  const out = [
    `U.S. natural gas exports by country in ${year} (EIA): ${cf(total)} in all. By pipeline: ${cf(pipeline)}, ${pct(pipeline, total)} of exports, ${pct(mexico, pipeline)} of it to Mexico and ${pct(canada, pipeline)} to Canada. ` +
      `As LNG: ${cf(lng)}, ${pct(lng, total)} of exports, shipped to ${buyers.length} countries. ` +
      `Largest LNG buyers in ${year}: ${top.map((r) => `${r.name} ${cf(r.value)} (${pct(r.value, lng)} of U.S. LNG exports)`).join(", ")}.`,
  ];
  const last = obs.filter((o) => o.series_id === "N9133US2").map((o) => o.date).sort().at(-1);
  if (last) {
    const y = Number(last.slice(0, 4));
    const m = Number(last.slice(5, 7));
    const now = yearSums(obs, ["N9133US2"], y, m).sums.N9133US2!;
    const before = yearSums(obs, ["N9133US2"], y - 1, m).sums.N9133US2!;
    out.push(`LNG exports January to ${MONTH[m - 1]} ${y} (preliminary): ${cf(now)}, ${pct(now - before, before)} more than in the same months of ${y - 1} (${cf(before)}).`);
  }
  return out.join("\n");
}

type AidRow = { recipient_type: "country" | "regional" | "global"; recipient_name: string; fiscal_year: number; disbursements_usd: number; military_disbursements_usd: number };
type AidMeta = { data_through: string; years: { fiscal_year: number; is_partial: boolean }[] };

const aidMoney = (usd: number) => (usd >= 0.95e9 ? `$${(usd / 1e9).toFixed(1)} billion` : `$${Math.round(usd / 1e6)} million`);

/**
 * The Foreign aid page's figures for the latest full fiscal year and the year so far (ForeignAssistance.gov disbursements):
 * the total, the military share, the share tied to one country, the five largest country recipients with their share of
 * the country dollars, and the three largest recipients of military assistance. The year so far is labelled partial, as the page labels it.
 */
export function aidFacts(rows: readonly AidRow[], meta: AidMeta): string {
  const full = meta.years.filter((y) => !y.is_partial).at(-1)!.fiscal_year;
  const last = meta.years.at(-1)!;
  const through = new Date(`${meta.data_through}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const out = ["U.S. foreign aid disbursements, nominal dollars (InsideGov's copy of ForeignAssistance.gov data):"];
  for (const fy of last.is_partial && last.fiscal_year > full ? [full, last.fiscal_year] : [full]) {
    const ys = rows.filter((r) => r.fiscal_year === fy);
    const total = ys.reduce((s, r) => s + r.disbursements_usd, 0);
    const military = ys.reduce((s, r) => s + r.military_disbursements_usd, 0);
    const byCountry = new Map<string, number>();
    for (const r of ys) if (r.recipient_type === "country") byCountry.set(r.recipient_name, (byCountry.get(r.recipient_name) ?? 0) + r.disbursements_usd);
    const country = [...byCountry.values()].reduce((s, v) => s + v, 0);
    const top = [...byCountry].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const byMilitary = new Map<string, number>();
    for (const r of ys) if (r.recipient_type === "country" && r.military_disbursements_usd > 0) byMilitary.set(r.recipient_name, (byMilitary.get(r.recipient_name) ?? 0) + r.military_disbursements_usd);
    const topMilitary = [...byMilitary].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const label = fy === full ? `Fiscal year ${fy}` : `Fiscal year ${fy} so far (partial: reported through ${through}; the source reports with a lag of about 45 days)`;
    out.push(
      `${label}: ${aidMoney(total)} disbursed in all, ${aidMoney(military)} of it (${pct(military, total)}) military assistance and the rest economic and other assistance. ` +
        `${aidMoney(country)} (${pct(country, total)}) went to single countries and ${aidMoney(total - country)} (${pct(total - country, total)}) to global and regional programs. ` +
        `Largest country recipients: ${top.map(([name, v]) => `${name} ${aidMoney(v)} (${pct(v, country)} of the country total)`).join(", ")}. ` +
        `Largest recipients of military assistance: ${topMilitary.map(([name, v]) => `${name} ${aidMoney(v)} (${pct(v, military)} of military assistance)`).join(", ")}.`,
    );
  }
  return out.join("\n");
}

type TroopsRow = { period: string; name: string; class: "host" | "territory" | "afloat_unassigned"; total: number | null };
type TroopsPeriod = { period: string; as_of: string; abroad_total?: number; printed: { grand_total: { total: number | null } } };

/**
 * The Troops abroad page's figures (DMDC active-duty location tables) for the latest September snapshot, the one the page's
 * yearly charts use, and the latest quarter when it is newer: troops abroad, all active-duty troops, how many host countries,
 * and the five largest hosts with their share of the troops at foreign hosts.
 */
export function troopsFacts(rows: readonly TroopsRow[], periods: readonly TroopsPeriod[]): string {
  const withAbroad = periods.filter((p) => p.abroad_total != null);
  const september = withAbroad.filter((p) => p.period.endsWith("-09")).at(-1)!;
  const latest = withAbroad.at(-1)!;
  const out = ["U.S. active-duty troops abroad, permanently assigned (InsideGov's copy of Defense Manpower Data Center location tables):"];
  for (const p of latest.period === september.period ? [september] : [september, latest]) {
    const hosts = rows.filter((r) => r.period === p.period && r.class === "host" && (r.total ?? 0) > 0);
    const atHosts = hosts.reduce((s, r) => s + r.total!, 0);
    const top = [...hosts].sort((a, b) => b.total! - a.total!).slice(0, 5);
    const date = new Date(`${p.as_of}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
    const all = p.printed.grand_total.total;
    out.push(
      `As of ${date}: ${compactNumber(p.abroad_total!)} active-duty troops abroad${all ? ` (outside the 50 states, D.C. and U.S. territories), of ${compactNumber(all)} active-duty troops in all` : ""}, in ${hosts.length} host countries. ` +
        `Largest hosts: ${top.map((r) => `${r.name} ${compactNumber(r.total!)} (${pct(r.total!, atHosts)} of troops at foreign hosts)`).join(", ")}. ` +
        `The top three together: ${pct(top.slice(0, 3).reduce((s, r) => s + r.total!, 0), atHosts)}.`,
    );
  }
  return out.join("\n");
}

/** `page` is the source page's own text, for the facts that come from it (`ngExports`). */
export function factsText(key: FactsKey, page = ""): string {
  if (key === "encounters") return encountersFacts(read<EncounterRow[]>("pipeline/output/encounters_series.json"));
  if (key === "troops") return troopsFacts(read<TroopsRow[]>("pipeline/output/troops_location.json"), read<{ periods: TroopsPeriod[] }>("pipeline/output/troops_location_meta.json").periods);
  if (key === "aid") return aidFacts(read<AidRow[]>("pipeline/output/foreign_assistance.json"), read<AidMeta>("pipeline/output/foreign_assistance_meta.json"));
  if (key === "debt") return debtFacts(read<{ debt: DebtRow[] }>("pipeline/output/treasury_fiscal.json").debt);
  const obs = read<EnergyObs[]>("pipeline/output/energy_observations.json");
  if (key === "electricity") return electricityFacts(obs);
  return ngExportsFacts(page, obs);
}
