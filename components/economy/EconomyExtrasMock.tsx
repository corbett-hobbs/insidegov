import { readAll, type EconomyKey } from "@/lib/indicator-lookup";
import type { EconomyData } from "@/lib/indicator-payload";
import { weeklyPoints } from "@/lib/economy-series";
import type { Headline, NewsItem, QuestionGroup } from "@/components/news/NewsQuestionsMock";
import { chartPoints } from "./EconomyChart";
import { SPECS, type ChartSpec } from "./specs";

/**
 * MOCKUP ONLY: the Economy page's sample "In the news" headlines and "Questions" (`components/news/NewsQuestionsMock`).
 * Headlines, dates and answers are placeholders, not real reporting or checked figures; outlet leans are AllSides' real
 * ratings. The sparklines are real data.
 */

/** A card's DOM id, which the ↑ chips scroll to. */
export const cardId = (k: EconomyKey) => `chart-${k}`;

/**
 * The one chart a headline points to, the best fit when a story touches several (a deficit report goes to the deficit,
 * not the debt as well); `diesel` draws the gas card's second line instead of regular gasoline.
 */
type ChartRef = { k: EconomyKey; diesel?: boolean };

/** Sample stories: each outlet's real AllSides rating, with made-up headlines. */
const NEWS: { date: string; topic: string; chart: ChartRef; headlines: Headline[] }[] = [
  {
    date: "Oct 24",
    topic: "Diesel prices",
    chart: { k: "gas", diesel: true },
    headlines: [
      { outlet: "HuffPost", mark: "HP", lean: "Left", title: "Diesel spike squeezes farmers at harvest as costs keep piling up" },
      { outlet: "Wall Street Journal", mark: "WSJ", lean: "Center", title: "Diesel Prices Climb as Harvest Demand Tightens Supplies" },
      { outlet: "Fox Business", mark: "FB", lean: "Lean Right", title: "Diesel prices jump heading into winter, hitting truckers and farmers" },
    ],
  },
  {
    date: "Oct 23",
    topic: "Mortgage rates",
    chart: { k: "mort" },
    headlines: [
      { outlet: "Freddie Mac", mark: "FM", lean: "Data", title: "Mortgage rates decrease for the third consecutive week" },
      { outlet: "NBC News", mark: "NBC", lean: "Lean Left", title: "Mortgage rates dip again, but buyers still face a tight market" },
      { outlet: "Washington Examiner", mark: "WE", lean: "Lean Right", title: "Mortgage rates fall for a third straight week" },
    ],
  },
  {
    date: "Oct 22",
    topic: "Federal deficit",
    chart: { k: "def" },
    headlines: [
      { outlet: "U.S. Treasury", mark: "UST", lean: "Data", title: "Monthly Treasury Statement for September 2026" },
      { outlet: "New York Times", mark: "NYT", lean: "Lean Left", title: "Federal Deficit Tops $2 Trillion for the Fiscal Year" },
      { outlet: "Fox News", mark: "FOX", lean: "Right", title: "Deficit hits $2 trillion as spending outpaces revenue" },
    ],
  },
  {
    date: "Oct 20",
    topic: "Gas prices",
    chart: { k: "gas" },
    headlines: [
      { outlet: "The Guardian", mark: "G", lean: "Left", title: "US gas prices ease as winter blend arrives, but relief may be short-lived" },
      { outlet: "BBC News", mark: "BBC", lean: "Center", title: "US petrol prices drift lower ahead of winter" },
      { outlet: "New York Post", mark: "NYP", lean: "Right", title: "Gas prices finally slide as stations switch to winter fuel" },
    ],
  },
  {
    date: "Oct 15",
    topic: "Inflation",
    chart: { k: "infl" },
    headlines: [
      { outlet: "Bureau of Labor Statistics", mark: "BLS", lean: "Data", title: "Consumer Price Index, September 2026" },
      { outlet: "CBS News", mark: "CBS", lean: "Lean Left", title: "Inflation ticks up again as energy costs rise" },
      { outlet: "Washington Times", mark: "WT", lean: "Lean Right", title: "Consumer prices climb again, led by energy" },
    ],
  },
  {
    date: "Oct 3",
    topic: "Unemployment",
    chart: { k: "un" },
    headlines: [
      { outlet: "Bureau of Labor Statistics", mark: "BLS", lean: "Data", title: "The Employment Situation, September 2026" },
      { outlet: "HuffPost", mark: "HP", lean: "Left", title: "Hiring slows again as the job market cools" },
      { outlet: "Fox Business", mark: "FB", lean: "Lean Right", title: "Jobless rate unchanged as employers pull back on hiring" },
    ],
  },
];

const q = (k: EconomyKey) => ({ target: cardId(k), label: SPECS[k].title });

export const ECONOMY_QUESTIONS: QuestionGroup[] = [
  {
    row: "Everyday costs",
    items: [
      {
        q: "Why do diesel prices matter if I don't drive a diesel?",
        a: "Diesel engines in trucks, trains, boats and barges move nearly all the products Americans buy, so the cost of shipping goods rises with the fuel. Diesel also powers most farm and construction equipment, and generators that make electricity.",
        source: "Energy Information Administration",
        charts: [q("gas")],
      },
      {
        q: "Who feels diesel prices the most?",
        a: "Trucking companies most directly: fuel is about a fifth of what it costs to run a truck (48 cents of $2.34 a mile in 2025). Farms rely on it too, since diesel is about two-thirds of their fuel spending ($10.9 billion of $16.5 billion in 2023), though fuel is a small part of a grain farm's total costs (about 3% to 4% for Illinois corn and soybeans).",
        source: "American Transportation Research Institute; USDA National Agricultural Statistics Service; University of Illinois farmdoc",
        charts: [q("gas")],
      },
      {
        q: "Why can mortgage rates move when the Fed hasn't changed rates?",
        a: "The 30-year rate follows long-term borrowing costs, chiefly the 10-year Treasury yield, more closely than the Fed's overnight rate. Expectations about inflation and future Fed decisions move that yield every day.",
        source: "Federal Reserve Bank of St. Louis, What Determines Mortgage Rates? (2026)",
        charts: [q("mort")],
      },
    ],
  },
  {
    row: "Behind the misery index",
    items: [
      {
        q: "Who is hit hardest when inflation rises?",
        a: "Households that spend most of their budget on necessities. Lower-income households put a larger share of their spending into food and housing than higher-income ones, so price increases there take up more of what they spend.",
        source: "Bureau of Labor Statistics, Consumer Expenditure Survey",
        charts: [q("infl")],
      },
    ],
  },
  {
    row: "Federal finances",
    items: [
      {
        q: "What is the difference between the deficit and the debt?",
        a: "The deficit is one year's shortfall: what the government spent minus what it took in. The debt is the running total of past borrowing, so each deficit adds to it and a surplus pays some down.",
        source: "Treasury Fiscal Data",
        charts: [q("def"), q("debt")],
      },
      {
        q: "Who does the government owe the debt to?",
        a: "About four-fifths (81% on October 23, 2026) is held by the public: investors outside the federal government, including the Federal Reserve and foreign governments and investors. The rest is owed to government accounts, and Social Security is the largest of those holders.",
        source: "Treasury Fiscal Data, Debt to the Penny; Congressional Research Service, Foreign Holdings of Federal Debt",
        charts: [q("debt")],
      },
    ],
  },
];

/** The headlines with their sparklines: the last three years of weekly and monthly series, twelve of fiscal and quarterly. */
export function economyNews(data: EconomyData, specs: Record<EconomyKey, ChartSpec>): NewsItem[] {
  // The latest readings, captioned exactly as the chart cards caption their own headline number.
  const latest = readAll(data, null);
  return NEWS.map(({ chart, ...item }) => {
    const all = chart.diesel ? weeklyPoints(data.diesel) : chartPoints(data, chart.k);
    const known = all.filter((p) => p.value !== null).map((p) => ({ x: p.day, value: p.value! }));
    const last = known[known.length - 1];
    const years = chart.k === "def" || chart.k === "debt" ? 12 : 3;
    const spec = specs[chart.k];
    const pts = known.filter((p) => p.x >= last.x - years * 365.25);
    return {
      ...item,
      chart: {
        target: cardId(chart.k),
        label: chart.diesel ? "Diesel" : spec.title,
        value: spec.head(last.value),
        asOf: latest[chart.k].caption,
        pts,
        bars: chart.k === "def",
      },
    };
  });
}
