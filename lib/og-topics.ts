import "server-only";
import { getBothTrend } from "./congress-data";
import { getDemographicsPayload } from "./demographics-data";
import { getDecisionsPageData } from "./decisions-data";
import { getEnergyPayload } from "./energy-data";
import { getExecutiveOrdersData } from "./executive-orders-data";
import { decodeAid, formatAidMoney, spendingByYear } from "./foreign-aid-derive";
import { getAidPayload } from "./foreign-aid-data";
import { getImmigrationPageData } from "./immigration-data";
import { getEconomyPayload } from "./indicator-data";
import { fmtDay } from "./indicator-time";
import { getCourtPayload } from "./justice-data";
import { getJusticeDirectory } from "./justice-directory-data";
import { getLawsPageData } from "./laws-data";
import { ordinal } from "./laws-entities";
import { median } from "./og-sparkline";
import { getTimelinePayload } from "./timeline-data";
import { buildSpans, changePoints, fracYear, powerIndex, yearsByStatus } from "./timeline-derive";
import { getHubTariff } from "./trade-data";
import { fmtRate } from "./trade-hub";
import { decodeTroops, stackByRegion } from "./troops-derive";
import { getTroopsPayload } from "./troops-data";
import { getWealthData, SERIES_YEARS } from "./wealth-data";

/**
 * The headline figure and sparkline on each topic page's share card
 * (`app/<page>/opengraph-image.tsx` → `app/_og/topic-card.tsx`). Every figure is read
 * through the same loaders and derive functions the page itself renders from, so the
 * card can't disagree with the page after a data refresh. Keep each caption plain:
 * what the number is and when (rule 2c: no cause or grade).
 */

export type OgBranch = "presidency" | "congress" | "supreme-court" | "timeline";

export interface TopicCard {
  branch: OgBranch;
  /** "Section · Page", the page header's eyebrow. */
  eyebrow: string;
  /** The page's `<h1>` question. */
  title: string;
  /** The big number. */
  figure: string;
  /** One line under it: what the number is, and when. */
  caption: string;
  /** Sparkline values, oldest first. */
  series: number[];
  /** Labels under the sparkline's two ends. */
  from: string;
  to: string;
  /** Alternative to `series` for the timeline: coloured spans across the strip, as fractions of its width. */
  strip?: { x: number; w: number; color: string }[];
}

export const TOPIC_PATHS = [
  "presidency/economy",
  "presidency/energy",
  "presidency/trade",
  "presidency/immigration",
  "presidency/foreign-aid",
  "presidency/troops-abroad",
  "presidency/executive-orders",
  "congress/ideology",
  "congress/laws",
  "congress/wealth",
  "congress/demographics",
  "supreme-court/decisions",
  "supreme-court/ideology",
  "supreme-court/justices",
  "timeline",
] as const;
export type TopicPath = (typeof TOPIC_PATHS)[number];

const int = (n: number) => Math.round(n).toLocaleString("en-US");
const dayYear = (day: number) => fmtDay(day).slice(-4);

const DEM = "#5b8fd6";
const REP = "#d9625b";

const BUILDERS: Record<TopicPath, () => TopicCard> = {
  "presidency/economy": () => {
    const { gas } = getEconomyPayload();
    const [day, price] = gas[gas.length - 1]!;
    return {
      branch: "presidency",
      eyebrow: "Presidency · Economy",
      title: "What was the economy like?",
      figure: `$${price.toFixed(2)}`,
      caption: `A gallon of regular gas, week of ${fmtDay(day)}`,
      series: gas.map(([, v]) => v),
      from: dayYear(gas[0]![0]),
      to: dayYear(day),
    };
  },
  "presidency/energy": () => {
    const { spr } = getEnergyPayload();
    const [day, kbbl] = spr[spr.length - 1]!;
    return {
      branch: "presidency",
      eyebrow: "Presidency · Energy",
      title: "How has U.S. energy changed?",
      figure: `${int(kbbl / 1000)}M`,
      caption: `Barrels of crude in the Strategic Petroleum Reserve, ${fmtDay(day)}`,
      series: spr.map(([, v]) => v),
      from: dayYear(spr[0]![0]),
      to: dayYear(day),
    };
  },
  "presidency/trade": () => {
    const t = getHubTariff();
    return {
      branch: "presidency",
      eyebrow: "Presidency · Trade",
      title: "How does the U.S. trade with the world?",
      figure: fmtRate(t.latest.rate),
      caption: `Average tariff on U.S. imports, ${t.latest.label} (${fmtRate(t.baseline.rate)} in ${t.baseline.year})`,
      series: t.rates,
      from: t.first.slice(0, 4),
      to: t.latest.label.slice(-4),
    };
  },
  "presidency/immigration": () => {
    const ys = getImmigrationPageData().removalsYears.filter((y) => y.value != null);
    const last = ys[ys.length - 1]!;
    return {
      branch: "presidency",
      eyebrow: "Presidency · Immigration",
      title: "How many people come in and out of the U.S.?",
      figure: int(last.value!),
      caption: `Removals from the U.S. in fiscal ${last.fy}${last.status === "preliminary" ? " (preliminary)" : ""}`,
      series: ys.map((y) => y.value!),
      from: String(ys[0]!.fy),
      to: String(last.fy),
    };
  },
  "presidency/foreign-aid": () => {
    const p = getAidPayload();
    const d = decodeAid(p);
    const years = spendingByYear(d, p.years[0]!, p.defaultYear, -1, null);
    const last = years[years.length - 1]!;
    return {
      branch: "presidency",
      eyebrow: "Presidency · Foreign aid",
      title: "Where does U.S. foreign aid go?",
      figure: formatAidMoney(last.total),
      caption: `U.S. foreign aid disbursed in fiscal ${last.fy}`,
      series: years.map((y) => y.total),
      from: String(years[0]!.fy),
      to: String(last.fy),
    };
  },
  "presidency/troops-abroad": () => {
    const p = getTroopsPayload();
    const stacks = stackByRegion(decodeTroops(p), 0, 0, p.defaultYear).filter((s) => !s.unavailable);
    const last = stacks[stacks.length - 1]!;
    return {
      branch: "presidency",
      eyebrow: "Presidency · Troops abroad",
      title: "Where are U.S. troops stationed abroad?",
      figure: int(last.total),
      caption: `U.S. troops stationed abroad, ${p.periods[last.pi]!.label}`,
      series: stacks.map((s) => s.total),
      from: String(p.years[stacks[0]!.yi]!.fy),
      to: String(p.years[last.yi]!.fy),
    };
  },
  "presidency/executive-orders": () => {
    const d = getExecutiveOrdersData();
    const last = d.years[d.years.length - 1]!;
    const done = d.years.filter((y) => !y.partial);
    return {
      branch: "presidency",
      eyebrow: "Presidency · Executive orders",
      title: "How many executive orders does each president sign?",
      figure: int(last.total),
      caption: last.partial ? `Executive orders signed so far in ${last.year} (through ${fmtIso(d.throughDate).replace(/, \d{4}$/, "")})` : `Executive orders signed in ${last.year}`,
      series: done.map((y) => y.total),
      from: String(done[0]!.year),
      to: String(done[done.length - 1]!.year),
    };
  },
  "congress/ideology": () => {
    const gaps = getBothTrend()
      .filter((p) => p.dem != null && p.rep != null)
      .map((p) => ({ congress: p.congress, year: p.year, gap: (p.rep as number) - (p.dem as number) }));
    const now = gaps[gaps.length - 1]!;
    const lastWider = [...gaps].reverse().find((g) => g.gap > now.gap);
    return {
      branch: "congress",
      eyebrow: "Congress · Ideology",
      title: "How does Congress vote?",
      figure: lastWider ? `Most divided since ${lastWider.year}` : "Most divided ever",
      caption: `Gap between the parties' average voting scores, ${ordinal(now.congress)} Congress`,
      series: gaps.map((g) => g.gap),
      from: String(gaps[0]!.year),
      to: String(now.year),
    };
  },
  "congress/laws": () => {
    const d = getLawsPageData();
    const perCongress = d.counts.map((row) => row.reduce((a, b) => a + b, 0));
    const done = perCongress.filter((_, i) => !d.partial[i]);
    return {
      branch: "congress",
      eyebrow: "Congress · Laws",
      title: "What laws does Congress pass?",
      figure: int(d.lawCount),
      caption: `Public laws enacted since the ${ordinal(d.congresses[0]!)} Congress`,
      series: done,
      from: String(1789 + (d.congresses[0]! - 1) * 2),
      to: String(1789 + (d.congresses[done.length - 1]! - 1) * 2),
    };
  },
  "congress/wealth": () => {
    const members = getWealthData();
    const medians = SERIES_YEARS.map((year, i) => {
      const vals = members.map((m) => m.series[i]);
      const n = vals.filter((v) => v != null).length;
      return { year, n, median: median(vals) };
    }).filter((y): y is { year: number; n: number; median: number } => y.median != null && y.n >= members.length / 2);
    const last = medians[medians.length - 1]!;
    const m = last.median;
    return {
      branch: "congress",
      eyebrow: "Congress · Wealth",
      title: "How much is Congress worth?",
      figure: m >= 1e6 ? `$${(m / 1e6).toFixed(1)}M` : `$${int(m / 1000)}K`,
      caption: `Median estimated net worth of a current member of Congress, ${last.year} disclosures`,
      series: medians.map((y) => y.median),
      from: String(medians[0]!.year),
      to: String(last.year),
    };
  },
  "congress/demographics": () => {
    const views = getDemographicsPayload().views.both;
    const share = (v: (typeof views)[number]) => (v.women.D + v.women.R + v.women.O) / v.seats;
    const last = views[views.length - 1]!;
    return {
      branch: "congress",
      eyebrow: "Congress · Demographics",
      title: "Who serves in Congress?",
      figure: `${Math.round(share(last) * 100)}%`,
      caption: `Of members of the ${ordinal(last.congress)} Congress are women`,
      series: views.map(share),
      from: String(views[0]!.year),
      to: String(last.year),
    };
  },
  "supreme-court/decisions": () => {
    const d = getDecisionsPageData();
    const unan = d.all.map((b) => {
      const n = b.reduce((x, y) => x + y, 0);
      return n ? b[0]! / n : 0;
    });
    const i = d.terms.length - 1;
    return {
      branch: "supreme-court",
      eyebrow: "Supreme Court · Decisions",
      title: "How does the Supreme Court decide?",
      figure: `${Math.round(unan[i]! * 100)}%`,
      caption: `Of argued cases decided unanimously in the ${d.terms[i]} term`,
      series: unan,
      from: String(d.terms[0]),
      to: String(d.terms[i]),
    };
  },
  "supreme-court/ideology": () => {
    const c = getCourtPayload();
    const last = c.terms[c.terms.length - 1]!;
    const sign = last.median > 0 ? "+" : last.median < 0 ? "−" : "";
    return {
      branch: "supreme-court",
      eyebrow: "Supreme Court · Ideology",
      title: "How does the Supreme Court lean?",
      figure: `${sign}${Math.abs(last.median).toFixed(2)}`,
      caption: `The median justice's Martin–Quinn score, ${last.term} term (above 0 leans conservative)`,
      series: c.terms.map((t) => t.median),
      from: String(c.terms[0]!.term),
      to: String(last.term),
    };
  },
  "supreme-court/justices": () => {
    const { rows, asOf } = getJusticeDirectory();
    const sitting = rows.filter((r) => r.sitting);
    const gop = sitting.filter((r) => r.party === "R").length;
    const lastYear = Number(asOf.slice(0, 4));
    const years: number[] = [];
    const counts: number[] = [];
    for (let y = 1937; y <= lastYear; y++) {
      const at = `${y}-07-01`;
      years.push(y);
      counts.push(rows.filter((r) => r.party === "R" && r.start <= at && (r.end == null || r.end > at)).length);
    }
    return {
      branch: "supreme-court",
      eyebrow: "Supreme Court · Justices",
      title: "Who has sat on the Supreme Court?",
      figure: `${gop} of ${sitting.length}`,
      caption: "Sitting justices appointed by Republican presidents",
      series: counts,
      from: String(years[0]),
      to: String(lastYear),
    };
  },
  timeline: () => {
    const data = getTimelinePayload();
    const FIRST = 1933;
    const maxYear = Number(data.today.slice(0, 4));
    const spans = buildSpans(powerIndex(data), changePoints(data), "lean");
    const years = yearsByStatus(spans, FIRST, maxYear);
    const total = years.all4 + years.tri + years.split;
    const t0 = FIRST;
    const t1 = fracYear(data.today);
    const pos = (iso: string) => Math.max(0, Math.min(1, (fracYear(iso) - t0) / (t1 - t0)));
    const strip = spans
      .filter((s) => s.st.status !== "split")
      .map((s) => {
        const x = pos(s.from);
        const party = s.st.P === "D" ? DEM : s.st.P === "R" ? REP : "#9aa2af";
        return { x, w: Math.max(0, pos(s.to) - x), color: s.st.status === "all4" ? party : `${party}66` };
      })
      .filter((s) => s.w > 0);
    return {
      branch: "timeline",
      eyebrow: "Across the branches · Timeline",
      title: "Who held power when it happened?",
      figure: `${Math.round(years.all4)} of ${Math.round(total)} years`,
      caption: `One party held the White House and Congress with the Court leaning its way, ${FIRST} to today`,
      series: [],
      strip,
      from: String(FIRST),
      to: String(maxYear),
    };
  },
};

function fmtIso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return fmtDay(Math.round((Date.UTC(y!, m! - 1, d!) - Date.UTC(1991, 0, 1)) / 86_400_000));
}

export function topicCard(path: TopicPath): TopicCard {
  return BUILDERS[path]();
}
