import { readFileSync } from "node:fs";
import { compactNumber } from "../../lib/format-number";

/**
 * Figures an FAQ answer may quote from the site's own copy of an agency's data, written out as plain sentences so the drafting
 * model and the number check read them like any other source. Used where the agency's page only renders in a browser (CBP's
 * encounter dashboard). Because they are recomputed from `pipeline/output`, the re-check workflow catches an answer whose
 * figures a data update has overtaken (the southwest share of encounters fell from 71-89% in FY2019-FY2024 to 37% in FY2026).
 */

export type FactsKey = "encounters" | "debt";

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

export function factsText(key: FactsKey): string {
  if (key === "encounters") return encountersFacts(read<EncounterRow[]>("pipeline/output/encounters_series.json"));
  return debtFacts(read<{ debt: DebtRow[] }>("pipeline/output/treasury_fiscal.json").debt);
}
