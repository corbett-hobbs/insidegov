import type { ContextEntry } from "@/lib/chart-context";
import type { EconomyKey } from "@/lib/indicator-lookup";

/** Presentation config for the eleven economy charts. Domains were checked against the 1991-onward data. */
export interface ChartSpec {
  key: EconomyKey;
  title: string;
  /** One or two sentences under the title on what the chart shows (see ARCHITECTURE_MAP rule 7c). Every figure is checked by lib/economy-takeaways.test.ts. */
  takeaway: string;
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
  /** Values are a share of GDP, so a tooltip names the base ("of GDP"). */
  share?: boolean;
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
    takeaway:
      "The misery index peaked at 15.1 in April 2020, when unemployment spiked. It also topped 12 in 2009, 2011 and 2022, and bottomed at 5.0 in September 2015, when prices were barely rising.",
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
    takeaway:
      "Regular gas peaked at $5.01 a gallon in June 2022, above its 2008 high of $4.11. In 2026 it climbed from $2.78 in January to $4.50 in May, and diesel hit a record $6.53 in September.",
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
    takeaway:
      "After nearly a decade at 3% or below, inflation peaked at 9.0% in June 2022, the highest since 1981. A year later it was back down to 3.1%.",
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
    takeaway:
      "The economy lost 20.5 million jobs in April 2020, the largest one-month loss on record, yet regained its pre-pandemic total by June 2022. After the 2008 recession, getting back to the old peak took until May 2014.",
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
    takeaway:
      "The economy shrank from a year earlier in only three stretches: 1991, late 2008–2009 and 2020. The 2020 drop (−7.4%) was the deepest, and the rebound a year later (+12.6%) the strongest.",
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
    takeaway:
      "After inflation, hourly pay was flat in the early 1990s and has risen about a quarter since its 1995 low. The 2020 spike came from lower-paid workers losing jobs; by mid-2022, inflation had pulled pay back to its early-2020 level.",
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
    takeaway:
      "Unemployment hit 14.8% in April 2020, the highest since records began in 1948, but was back under 4% by December 2021. After the 2009 peak of 10.0%, it took until 2016 to fall below 5%.",
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
    takeaway:
      "The 30-year rate fell to a record low of 2.65% in January 2021, then nearly tripled to 7.79% by October 2023, the highest since 2000.",
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
    takeaway:
      "After inflation, median household income fell after 2007 and didn’t pass that level again until 2016. It set a record in 2019, slipped about 5% by 2022, then set a new record in 2025.",
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
    takeaway:
      "The budget ran a surplus only in 1998–2001. From 2020 through 2025 the deficit topped 5% of GDP every year; before 2020 it went that deep only in 2009–2012.",
    kind: "fiscal",
    domain: [-16, 4],
    ticks: [-15, -10, -5, 0],
    tick: (v) => (v === 0 ? "0%" : `${MINUS}${Math.abs(v)}%`),
    head: (v) => `${v < 0 ? MINUS : "+"}${fx(Math.abs(v), 1)}%`,
    aria: "Bar chart of the federal surplus or deficit as a percent of GDP by fiscal year since 1991",
    unit: "% of GDP",
    share: true,
  },
  debt: {
    key: "debt",
    title: "Federal debt",
    takeaway:
      "Total debt fell to 54% of GDP in 2001, then more than doubled to a peak of 133% in mid-2020. It eased to 116% in early 2023 and was back at 123% by early 2026.",
    kind: "debt",
    label2: "Held by the public",
    domain: [20, 140],
    ticks: [40, 80, 120],
    tick: (v) => `${v}%`,
    head: (v) => `${fx(v, 1)}%`,
    aria: "Line chart of federal debt as a percent of GDP, quarterly since 1991, showing total public debt and the part held by the public",
    unit: "% of GDP",
    share: true,
  },
};

/** Dollars from a figure in billions: "$1.8T" from a trillion up, "$269B" below. */
export const usd = (billions: number, dp = 1) => {
  const a = Math.abs(billions);
  const body = a >= 1000 ? `$${fx(a / 1000, dp)}T` : `$${nf(a)}B`;
  return billions < 0 ? `${MINUS}${body}` : body;
};

/** The deficit and debt charts in nominal dollars (their data is in billions). The default view; `SPECS` holds the percent-of-GDP versions. */
export const USD_SPECS: Pick<Record<EconomyKey, ChartSpec>, "def" | "debt"> = {
  def: {
    key: "def",
    title: "Federal deficit",
    takeaway:
      "The deficit hit a record $3.1 trillion in fiscal 2020 and, after easing to $1.4 trillion in 2022, has climbed back to $2.0 trillion in 2026. The budget ran a surplus only in 1998–2001.",
    kind: "fiscal",
    domain: [-3500, 500],
    ticks: [-3000, -2000, -1000, 0],
    tick: (v) => (v === 0 ? "$0" : usd(v, 0)),
    head: (v) => `${v > 0 ? "+" : ""}${usd(v)}`,
    aria: "Bar chart of the federal surplus or deficit in dollars by fiscal year since 1991",
    unit: "$ billions",
  },
  debt: {
    key: "debt",
    title: "Federal debt",
    takeaway:
      "Total federal debt has grown more than elevenfold since 1991, from $3.5 trillion to $40.2 trillion in 2026. It passed $10 trillion in 2008, $20 trillion in 2017 and $30 trillion in 2022.",
    kind: "debt",
    label2: "Held by the public",
    domain: [0, 42000],
    ticks: [10000, 20000, 30000, 40000],
    tick: (v) => usd(v, 0),
    head: (v) => usd(v),
    aria: "Line chart of federal debt in dollars, quarterly since 1991, showing total public debt and the part held by the public",
    unit: "$ billions",
  },
};

/** The cards after the hero, in pairs: each row is a theme with a quiet label. */
export const CARD_ROWS: { label: string; cards: [EconomyKey, EconomyKey] }[] = [
  { label: "Behind the misery index", cards: ["un", "infl"] },
  { label: "Everyday costs", cards: ["gas", "mort"] },
  { label: "What people earn", cards: ["wage", "inc"] },
  { label: "Federal finances", cards: ["def", "debt"] },
  { label: "Jobs and output", cards: ["jobs", "gdp"] },
];

/**
 * Context lines (ARCHITECTURE_MAP rule 7d): a dated political event behind something a card shows, placed next to it, with a
 * cause only where an agency states one (BLS, DOE, CBO). The October 2025 shutdown sits on the Unemployment card only, the one
 * whose survey can never be filled in; the misery index, inflation and wages show the same gap, and their Data notes say so.
 * Recession dates and method stay in the Data notes. Cards not listed have none. Checked by lib/economy-takeaways.test.ts.
 */
export const ECONOMY_CONTEXT = {
  un: {
    text: "The government shut down for 43 days, October 1 through November 12, 2025, when funding lapsed. BLS says the lapse kept it from collecting October’s household survey and prices, which it never collected, so this line, inflation and the misery index skip that month.",
    sources: [
      { id: "bls-cps-shutdown-2025", label: "BLS household survey" },
      { id: "bls-cpi-shutdown-2025", label: "BLS CPI" },
    ],
  },
  jobs: {
    text: "Proclamation 9994 declared a national emergency over COVID-19 on March 13, 2020, the month before the record loss. BLS attributed April’s losses to the pandemic and efforts to contain it.",
    sources: [
      { id: "fr-proclamation-9994", label: "Proclamation 9994" },
      { id: "bls-empsit-april-2020", label: "BLS, April 2020" },
    ],
  },
  gas: {
    text: "DOE began emergency sales from the oil reserve in March 2022, after Russia invaded Ukraine, 180M barrels in all; gas peaked in June. On March 11, 2026, the week gas hit $3.50, DOE announced a 172M-barrel release to lower prices; gas reached $4.50 in May.",
    sources: [
      { id: "doe-spr-history", label: "DOE release history" },
      { id: "doe-spr-172m-exchange-2026", label: "DOE, March 2026" },
    ],
  },
  mort: {
    text: "The Federal Reserve held its target rate at 0–0.25% from March 2020 to March 2022, the stretch with the record low, then raised it 11 times, to 5.25–5.50% in July 2023. The 7.79% high came three months later.",
    sources: [{ id: "fomc-statements", label: "FOMC statements" }],
  },
  def: {
    text: "The CARES Act, enacted March 27, 2020, and the American Rescue Plan Act, March 11, 2021, fall in fiscal 2020 and 2021, the two deepest deficits on the chart. CBO estimated the CARES Act alone would add about $1.8T to deficits over 2020–2030.",
    sources: [
      { id: "cbo-cares-act", label: "CBO" },
      { id: "congress-arpa", label: "Congress.gov" },
    ],
  },
} satisfies Partial<Record<EconomyKey, ContextEntry>>;

export const contextFor = (key: EconomyKey): ContextEntry | null =>
  (ECONOMY_CONTEXT as Partial<Record<EconomyKey, ContextEntry>>)[key] ?? null;
