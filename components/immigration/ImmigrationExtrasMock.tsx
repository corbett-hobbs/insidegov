import type { ImmigrationPageData } from "@/lib/immigration-derive";
import type { EncountersPayload } from "@/lib/encounters-types";
import type { LprPayload } from "@/lib/lpr-types";
import type { RefugeePayload } from "@/lib/refugee-types";
import type { Headline, NewsItem, QuestionGroup, SparkPoint } from "@/components/news/NewsQuestionsMock";

/**
 * MOCKUP ONLY: the Immigration page's sample "In the news" headlines and "Questions" (`components/news/NewsQuestionsMock`).
 * Headlines, dates and answers are placeholders, not real reporting or checked figures. The sparklines are real data.
 */

/** The DOM ids of the cards the ↑ chips scroll to (wrappers in `ImmigrationPageClient`). */
export const IMMIGRATION_CHARTS = {
  greenCards: { target: "chart-green-cards", label: "Green cards" },
  refugees: { target: "chart-refugees", label: "Refugee admissions" },
  encounters: { target: "chart-encounters", label: "Border encounters" },
  removals: { target: "chart-removals", label: "ICE removals" },
} as const;

type ChartKey = keyof typeof IMMIGRATION_CHARTS;

/** Counts of 10,000 or more in compact form (rule 2g): "1.2M", "442.6K". */
const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}K` : n.toLocaleString("en-US"));

/** Sample stories: each outlet's real AllSides rating, with made-up headlines. */
const NEWS: { date: string; topic: string; chart: ChartKey; headlines: Headline[] }[] = [
  {
    date: "Oct 21",
    topic: "Border encounters",
    chart: "encounters",
    headlines: [
      { outlet: "U.S. Customs and Border Protection", mark: "CBP", lean: "Data", title: "CBP releases September 2026 monthly update" },
      { outlet: "NBC News", mark: "NBC", lean: "Lean Left", title: "What the latest border numbers show, and what they leave out" },
      { outlet: "Fox News", mark: "FOX", lean: "Right", title: "New border data shows September encounter totals" },
    ],
  },
  {
    date: "Oct 16",
    topic: "Green card waits",
    chart: "greenCards",
    headlines: [
      { outlet: "New York Times", mark: "NYT", lean: "Lean Left", title: "For Families Waiting on Green Cards, the Line Barely Moves" },
      { outlet: "Washington Examiner", mark: "WE", lean: "Lean Right", title: "Visa bulletin leaves family green card backlog unchanged" },
    ],
  },
  {
    date: "Oct 9",
    topic: "ICE removals",
    chart: "removals",
    headlines: [
      { outlet: "The Guardian", mark: "G", lean: "Left", title: "ICE publishes deportation figures for fiscal 2026" },
      { outlet: "The Hill", mark: "HILL", lean: "Center", title: "ICE releases removal totals for the fiscal year" },
      { outlet: "New York Post", mark: "NYP", lean: "Right", title: "ICE reveals deportation numbers for fiscal 2026" },
    ],
  },
  {
    date: "Oct 1",
    topic: "Refugee cap",
    chart: "refugees",
    headlines: [
      { outlet: "Federal Register", mark: "FR", lean: "Data", title: "Presidential Determination on Refugee Admissions for Fiscal Year 2027" },
      { outlet: "CBS News", mark: "CBS", lean: "Lean Left", title: "White House sets refugee admissions cap for 2027" },
      { outlet: "Washington Times", mark: "WT", lean: "Lean Right", title: "Refugee ceiling for 2027 announced" },
    ],
  },
];

export const IMMIGRATION_QUESTIONS: QuestionGroup[] = [
  {
    row: "Green cards",
    items: [
      {
        q: "What is the difference between a green card and citizenship?",
        a: "A green card makes someone a lawful permanent resident: they can live and work in the U.S. indefinitely but cannot vote in federal elections. Most can apply to naturalize as citizens after five years, or three if married to and living with a U.S. citizen.",
        source: "Immigration and Nationality Act, via U.S. Citizenship and Immigration Services",
        charts: [IMMIGRATION_CHARTS.greenCards],
      },
    ],
  },
  {
    row: "Refugees",
    items: [
      {
        q: "What is the difference between a refugee and an asylum seeker?",
        a: "Both are seeking protection from persecution. A refugee applies from outside the U.S. and is approved before traveling; an asylum seeker applies after arriving in the U.S. or at its border. Only refugee admissions count toward the yearly ceiling.",
        source: "U.S. Citizenship and Immigration Services; Immigration and Nationality Act, section 207",
        charts: [IMMIGRATION_CHARTS.refugees],
      },
      {
        q: "Who sets the refugee ceiling?",
        a: "The President, before each fiscal year, in a Presidential Determination made after consulting Congress, as the law requires. It is a maximum, not a target, and can be raised during the year if an unforeseen emergency arises.",
        source: "Immigration and Nationality Act, section 207; Federal Register",
        charts: [IMMIGRATION_CHARTS.refugees],
      },
    ],
  },
  {
    row: "Border & removals",
    items: [
      {
        q: "What is the difference between a removal and a return?",
        a: "A removal is a confirmed departure under a final order of removal, which carries penalties if the person later tries to come back. A return is a confirmed departure without an order, so it does not carry those removal penalties.",
        source: "DHS Office of Homeland Security Statistics",
        charts: [IMMIGRATION_CHARTS.removals],
      },
      {
        q: "Where do most border encounters happen?",
        a: "It has changed. From fiscal 2019 through 2024, 71% to 89% each year were on the southwest border. In fiscal 2026 so far, about two-thirds are at ports of entry such as airports, seaports and land crossings, mostly away from the southwest border; Border Patrol's arrests between ports are still mostly on the southwest border.",
        source: "U.S. Customs and Border Protection, Nationwide Encounters (fiscal 2026 through August, preliminary)",
        charts: [IMMIGRATION_CHARTS.encounters],
      },
    ],
  },
];

/** The last twelve fiscal years of a series. */
const recent = (pts: SparkPoint[]) => pts.filter((p) => p.x > pts[pts.length - 1].x - 12);

/** The headlines with their sparklines and each series' newest fiscal-year figure. */
export function immigrationNews(data: ImmigrationPageData, lpr: LprPayload, refugees: RefugeePayload, encounters: EncountersPayload): NewsItem[] {
  const series: Record<ChartKey, SparkPoint[]> = {
    greenCards: recent(lpr.years.map((y) => ({ x: y.fy, value: y.lpr }))),
    refugees: recent(refugees.years.map((y) => ({ x: y.fy, value: y.admissions }))),
    encounters: recent(encounters.years.map((y) => ({ x: y.fy, value: y.nationwide.total }))),
    removals: recent(data.years.map((y) => ({ x: y.fy, value: y.value }))),
  };
  return NEWS.map(({ chart, ...item }) => {
    const pts = series[chart];
    return { ...item, chart: { ...IMMIGRATION_CHARTS[chart], value: compact(pts[pts.length - 1].value), asOf: `FY${pts[pts.length - 1].x}`, pts } };
  });
}
