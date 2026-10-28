import { type DerivedPoint, monthlyChange, realHourlyEarnings, yearOverYearPercent } from "../../lib/indicator-derive";
import { addMonths } from "./format";
import type { CellRef, Point, Series, UnitFormat } from "./types";

/**
 * The Economy page's cards as series for the news lane: the measures the cards chart (inflation as a rate, jobs as a
 * monthly change, pay in latest-month dollars, the deficit and debt merged with Treasury's newer figures), computed with
 * the page's own functions (lib/indicator-derive.ts) so a post and its card never disagree. Pure: `loadGas`
 * (datasets.ts) reads the files and passes the rows in.
 *
 * Each point keeps the cells it came from. A derived value cites the cell it is read at and says how it is derived
 * (types.ts CellRef.derive), so verify.ts can re-run it from the committed rows. All of them are news-only: they post
 * when the news is about them, never from a data release.
 */

const OBS = "pipeline/output/indicator_observations.json";
const TREASURY = "pipeline/output/treasury_fiscal.json";

type Row = Record<string, unknown>;
export type TreasuryFiscal = { deficit: { fiscal_year: number; value: number }[]; debt: { date: string; total: number; held: number }[] };

const obs = (series_id: string, date: string, extra: Partial<CellRef> = {}): CellRef => ({ file: OBS, key: { series_id, date }, field: "value", ...extra });

const PCT1: UnitFormat = { scale: 1, decimals: 1, suffix: "%" };
const PP1: UnitFormat = { scale: 1, decimals: 1, suffix: " percentage points" };

type Config = Pick<Series, "id" | "title" | "name" | "axisLabel" | "unit" | "frequency" | "moveMode" | "kind" | "source" | "weight" | "releaseLagDays" | "anchor"> & Partial<Pick<Series, "changeUnit" | "context" | "note">>;

const make = (cfg: Config, points: Point[]): Series => ({ dataset: "gas", url: "/presidency/economy", seasonal: false, newsOnly: true, ...cfg, points });

/** The page's derived points without the months it cannot compute (null), each with the cells that make it. */
function derived(points: DerivedPoint[], cells: (date: string) => CellRef[]): Point[] {
  return points.flatMap((p) => (p.value === null ? [] : [{ date: p.date, value: p.value, cells: cells(p.date) }]));
}

/** FRED's points, then Treasury's for any later period (FRED always wins where it has a value), as the page merges them. */
function withNewer(fred: Point[], treasury: Point[]): Point[] {
  const last = fred.at(-1)?.date ?? "";
  return [...fred, ...treasury.filter((p) => p.date > last)];
}

export function economySeries(rows: Row[], treasury: TreasuryFiscal): Series[] {
  const raw = (id: string) =>
    rows
      .filter((r) => r.series_id === id && typeof r.value === "number")
      .map((r) => ({ date: String(r.date), value: r.value as number }))
      .sort((a, b) => a.date.localeCompare(b.date));
  const plain = (id: string, from = ""): Point[] => raw(id).filter((p) => p.date >= from).map((p) => ({ ...p, cells: [obs(id, p.date)] }));

  const cpi = raw("CPIAUCSL");
  const out: Series[] = [];

  const PCT2: UnitFormat = { scale: 1, decimals: 2, suffix: "%" };
  out.push(
    make({ id: "economy.mortgage_rate", title: "Mortgage rates", anchor: "#chart-mort", name: "the average rate on a fixed-rate mortgage", note: "30-year fixed-rate mortgage, weekly average", axisLabel: "percent", unit: PCT2, changeUnit: { scale: 1, decimals: 2, suffix: " percentage points" }, frequency: "weekly", moveMode: "abs", kind: "level", source: "Freddie Mac, via FRED", weight: 1.1, releaseLagDays: 1, context: ["Weekly average rate on a standard fixed-rate home loan, from Freddie Mac's Primary Mortgage Market Survey."] }, plain("MORTGAGE30US")),
    make({ id: "economy.unemployment", title: "Unemployment", anchor: "#chart-un", name: "the U.S. unemployment rate", note: "Seasonally adjusted", axisLabel: "percent of the labor force", unit: PCT1, changeUnit: PP1, frequency: "monthly", moveMode: "abs", kind: "level", source: "Bureau of Labor Statistics, via FRED", weight: 1.2, releaseLagDays: 7, context: ["Share of the labor force without a job and looking for one, seasonally adjusted, from the BLS household survey."] }, plain("UNRATE")),
  );

  out.push(
    make(
      {
        id: "economy.inflation", title: "Inflation",
        anchor: "#chart-infl",
        name: "the U.S. inflation rate",
        note: "Change in consumer prices (CPI-U) from a year earlier",
        axisLabel: "percent from a year earlier",
        unit: PCT1,
        changeUnit: PP1,
        frequency: "monthly",
        moveMode: "abs",
        kind: "level",
        source: "Bureau of Labor Statistics, via FRED",
        weight: 1.3,
        releaseLagDays: 14,
        context: ["The year-over-year change in the Consumer Price Index for all urban consumers (CPI-U), all items."],
      },
      derived(yearOverYearPercent(cpi), (d) => [obs("CPIAUCSL", d, { derive: { op: "pct_change", from: obs("CPIAUCSL", addMonths(d, -12)) } })]),
    ),
    make(
      {
        id: "economy.jobs_added", title: "Jobs added each month",
        anchor: "#chart-jobs",
        name: "the monthly change in U.S. jobs",
        note: "Nonfarm payrolls · Seasonally adjusted",
        axisLabel: "jobs added in a month",
        unit: { scale: 1000, decimals: 0, suffix: " jobs" },
        frequency: "monthly",
        moveMode: "abs",
        kind: "flow",
        source: "Bureau of Labor Statistics, via FRED",
        weight: 1.3,
        releaseLagDays: 7,
        context: ["The change from the previous month in total nonfarm payroll employment, seasonally adjusted, from the BLS employer survey. A negative figure is jobs lost."],
      },
      derived(monthlyChange(raw("PAYEMS")), (d) => [obs("PAYEMS", d, { derive: { op: "diff", from: obs("PAYEMS", addMonths(d, -1)) } })]),
    ),
  );

  const earnings = realHourlyEarnings(raw("AHETPI"), cpi);
  if (earnings.baseDate) {
    const base = obs("CPIAUCSL", earnings.baseDate);
    out.push(
      make(
        {
          id: "economy.real_earnings", title: "Hourly pay",
          anchor: "#chart-wage",
          name: "U.S. real average hourly earnings",
          axisLabel: "dollars an hour",
          unit: { scale: 1, decimals: 2, prefix: "$", suffix: " an hour" },
          frequency: "monthly",
          moveMode: "pct",
          kind: "level",
          source: "Bureau of Labor Statistics, via FRED",
          weight: 1.1,
          releaseLagDays: 7,
          note: "Adjusted for inflation, in the dollars of the latest month",
          context: ["Average hourly earnings of production and nonsupervisory workers, divided by the Consumer Price Index and restated in the dollars of the latest month, so every value is what the pay buys today."],
        },
        derived(earnings.points, (d) => [obs("AHETPI", d, { derive: { op: "deflate", by: obs("CPIAUCSL", d), base } })]),
      ),
    );
  }

  out.push(
    make({ id: "economy.gdp_growth", title: "Economic growth", anchor: "#chart-gdp", name: "U.S. real GDP growth from a year earlier", note: "Real GDP, change from a year earlier", axisLabel: "percent from a year earlier", unit: PCT1, changeUnit: PP1, frequency: "quarterly", moveMode: "abs", kind: "level", source: "Bureau of Economic Analysis, via FRED", weight: 1.3, releaseLagDays: 30, context: ["Real gross domestic product, the change from the same quarter a year earlier."] }, plain("A191RO1Q156NBEA")),
    make({ id: "economy.household_income", title: "Household income", anchor: "#chart-inc", name: "U.S. real median household income", axisLabel: "dollars a year", unit: { scale: 1, decimals: 0, prefix: "$", suffix: "" }, frequency: "annual", moveMode: "pct", kind: "level", source: "Census Bureau, via FRED", weight: 1, releaseLagDays: 270, note: "Median · Adjusted for inflation", context: ["Median household income, adjusted for inflation, from the Census Bureau's annual survey."] }, plain("MEHOINUSA672N")),
  );

  // The deficit: FRED's fiscal-year figure, then Treasury's for a year FRED has not published. Negated, so a deficit reads as a positive number.
  const deficitFred = plain("FYFSD", "1991-01-01").map((p) => ({ ...p, value: -p.value, cells: p.cells.map((c) => ({ ...c, negate: true })) }));
  const deficitTreasury = treasury.deficit.map((d): Point => ({ date: `${d.fiscal_year}-09-30`, value: -d.value, cells: [{ file: `${TREASURY}#deficit`, key: { fiscal_year: d.fiscal_year }, field: "value", negate: true }] }));
  const USD_B: UnitFormat = { scale: 0.001, decimals: 0, prefix: "$", suffix: "B" };
  out.push(
    make({ id: "economy.deficit", title: "The federal deficit", anchor: "#chart-def", name: "the federal budget deficit", note: "A surplus shows as negative", axisLabel: "dollars, billions", unit: USD_B, changeUnit: USD_B, frequency: "fiscal_year", moveMode: "abs", kind: "flow", source: "OMB and Treasury, via FRED", weight: 1.2, releaseLagDays: 18, context: ["A surplus, when revenue exceeds spending, shows as a negative number. The federal government's budget deficit for the fiscal year, which runs October through September, in nominal dollars. Treasury's own figure stands in until FRED publishes the year."] }, withNewer(deficitFred, deficitTreasury)),
  );

  const debtFred = plain("GFDEBTN", "1991-01-01");
  const debtTreasury = treasury.debt.map((d): Point => ({ date: d.date, value: d.total, cells: [{ file: `${TREASURY}#debt`, key: { date: d.date }, field: "total" }] }));
  out.push(
    make({ id: "economy.debt", title: "The national debt", anchor: "#chart-debt", name: "total federal debt", note: "Total public debt at the end of the quarter", axisLabel: "dollars, trillions", unit: { scale: 1e-6, decimals: 1, prefix: "$", suffix: "T" }, changeUnit: { scale: 1e-6, decimals: 1, prefix: "$", suffix: "T" }, frequency: "quarterly", moveMode: "pct", kind: "level", source: "Treasury Fiscal Service, via FRED", weight: 1.1, releaseLagDays: 10, context: ["Total public debt outstanding at the end of the quarter, in nominal dollars, including debt the government owes itself. Treasury's own figure stands in until FRED publishes the quarter."] }, withNewer(debtFred, debtTreasury)),
  );
  return out;
}
