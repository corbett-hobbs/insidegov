import type { EconomyKey } from "@/lib/indicator-lookup";

/** Presentation config for the eleven economy charts. Domains were checked against the 1991-onward data. */
export interface ChartSpec {
  key: EconomyKey;
  title: string;
  desc: string;
  kind: "line" | "jobs" | "growth" | "income" | "fiscal" | "debt";
  domain: [number, number];
  ticks: number[];
  tick: (v: number) => string;
  /** Header readout format. */
  head: (v: number) => string;
  aria: string;
  /** Unit label for the table fallback. */
  unit: string;
  /** Name of the second series (shown in the tooltip and readout) when the chart has one. */
  label2?: string;
}

const MINUS = "−";
export const fx = (x: number, n: number) => {
  const s = (x + (x >= 0 ? 1e-9 : -1e-9)).toFixed(n);
  return Number(s) === 0 ? s.replace("-", "") : s.replace("-", MINUS); // no "−0.0%"
};
const nf = (n: number) => String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
export const JOBS_CAP = 1000;

export const SPECS: Record<EconomyKey, ChartSpec> = {
  mis: {
    key: "mis",
    title: "Misery index",
    desc: "Unemployment rate plus the inflation rate, monthly. A rough one-number gauge of everyday economic strain, devised in the 1970s.",
    kind: "line",
    domain: [0, 16],
    ticks: [0, 5, 10, 15],
    tick: (v) => `${v}%`,
    head: (v) => fx(v, 1),
    aria: "Line chart of the misery index, the unemployment rate plus the year-over-year inflation rate, monthly from 1991 to the latest month",
    unit: "points",
  },
  gas: {
    key: "gas",
    title: "Gas price",
    desc: "National weekly average retail price, dollars per gallon.",
    label2: "Diesel",
    kind: "line",
    domain: [0.5, 6.7],
    ticks: [1, 2, 3, 4, 5, 6],
    tick: (v) => `$${v}`,
    head: (v) => `$${fx(v, 2)}`,
    aria: "Line chart of the weekly US regular gas price and diesel price per gallon since 1991",
    unit: "$ per gallon",
  },
  infl: {
    key: "infl",
    title: "Inflation",
    desc: "Year-over-year change in consumer prices (CPI, all items).",
    kind: "line",
    domain: [-3, 10],
    ticks: [0, 5, 10],
    tick: (v) => `${v}%`,
    head: (v) => `${fx(v, 1)}%`,
    aria: "Line chart of year-over-year consumer price inflation since 1991",
    unit: "%",
  },
  jobs: {
    key: "jobs",
    title: "Jobs added",
    desc: "Change in total nonfarm payrolls from the previous month.",
    kind: "jobs",
    domain: [-JOBS_CAP, JOBS_CAP],
    ticks: [-1000, -500, 0, 500, 1000],
    tick: (v) => (v === 0 ? "0" : `${v < 0 ? MINUS : "+"}${Math.abs(v) === 1000 ? "1M" : `${Math.abs(v)}K`}`),
    head: (v) => `${v >= 0 ? "+" : MINUS}${nf(v)}K`,
    aria: "Bar chart of monthly job gains and losses since 1991, axis capped at plus or minus one million with larger months marked at the edges",
    unit: "thousand jobs",
  },
  gdp: {
    key: "gdp",
    title: "GDP growth",
    desc: "Change in real (inflation-adjusted) output from the same quarter a year earlier.",
    label2: "Annualized quarterly rate",
    kind: "growth",
    domain: [-9, 14],
    ticks: [-5, 0, 5, 10],
    tick: (v) => (v === 0 ? "0%" : `${v < 0 ? MINUS : ""}${Math.abs(v)}%`),
    head: (v) => `${fx(v, 1)}%`,
    aria: "Bar chart of real GDP growth from a year earlier, quarterly since 1991, with the 2020 drop and rebound shown at full size",
    unit: "% vs. a year earlier",
  },
  wage: {
    key: "wage",
    title: "Real hourly earnings",
    desc: "", // filled with the base month at render time
    kind: "line",
    domain: [24.5, 33.5],
    ticks: [26, 28, 30, 32],
    tick: (v) => `$${v}`,
    head: (v) => `$${fx(v, 2)}`,
    aria: "Line chart of average hourly earnings of production and nonsupervisory workers in latest-month dollars, monthly since 1991",
    unit: "$ per hour, latest-month dollars",
  },
  un: {
    key: "un",
    title: "Unemployment",
    desc: "Share of the labor force without a job, seasonally adjusted.",
    kind: "line",
    domain: [0, 15],
    ticks: [0, 5, 10, 15],
    tick: (v) => `${v}%`,
    head: (v) => `${fx(v, 1)}%`,
    aria: "Line chart of the monthly unemployment rate since 1991",
    unit: "%",
  },
  mort: {
    key: "mort",
    title: "Mortgage rate",
    desc: "Average 30-year fixed rate, weekly (Freddie Mac survey).",
    kind: "line",
    domain: [2, 10],
    ticks: [2, 4, 6, 8, 10],
    tick: (v) => `${v}%`,
    head: (v) => `${fx(v, 2)}%`,
    aria: "Line chart of the weekly 30-year fixed mortgage rate since 1991, with the November 2022 survey method change marked",
    unit: "%",
  },
  inc: {
    key: "inc",
    title: "Household income",
    desc: "", // filled from the series' units field at render time
    kind: "income",
    domain: [60000, 90000],
    ticks: [60000, 70000, 80000, 90000],
    tick: (v) => `$${v / 1000}K`,
    head: (v) => `$${nf(v)}`,
    aria: "Line chart of real median household income by year since 1991",
    unit: "$",
  },
  def: {
    key: "def",
    title: "Federal deficit",
    desc: "Federal surplus (+) or deficit (−) as a share of GDP, by fiscal year.",
    kind: "fiscal",
    domain: [-16, 4],
    ticks: [-15, -10, -5, 0],
    tick: (v) => (v === 0 ? "0%" : `${MINUS}${Math.abs(v)}%`),
    head: (v) => `${v < 0 ? MINUS : "+"}${fx(Math.abs(v), 1)}%`,
    aria: "Bar chart of the federal surplus or deficit as a percent of GDP by fiscal year since 1991",
    unit: "% of GDP",
  },
  debt: {
    key: "debt",
    title: "Federal debt",
    desc: "Federal debt as a share of GDP, quarterly.",
    kind: "debt",
    label2: "Total",
    domain: [20, 140],
    ticks: [40, 80, 120],
    tick: (v) => `${v}%`,
    head: (v) => `${fx(v, 1)}%`,
    aria: "Line chart of federal debt as a percent of GDP, quarterly since 1991, showing debt held by the public and total public debt",
    unit: "% of GDP",
  },
};

/** The cards after the hero, in pairs: each row is a theme with a quiet label. */
export const CARD_ROWS: { label: string; cards: [EconomyKey, EconomyKey] }[] = [
  { label: "Behind the misery index", cards: ["un", "infl"] },
  { label: "Jobs and output", cards: ["jobs", "gdp"] },
  { label: "What people earn", cards: ["wage", "inc"] },
  { label: "Everyday costs", cards: ["gas", "mort"] },
  { label: "Federal finances", cards: ["def", "debt"] },
];
