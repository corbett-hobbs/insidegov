"use client";

import { SourceLink } from "@/components/SourceLink";
import { useMemo, useState } from "react";
import { EconomyStateProvider, activeDay, useEconomyActions, useEconomyValues } from "./EconomyState";
import { dateOfDay, dayOf, MONTH_NAMES } from "@/lib/indicator-time";
import { LegendToggle } from "@/components/charts/LegendToggle";
import { PageHeader } from "@/components/PageHeader";
import { fromEconomyPayload, withFiscalUnit, type EconomyPayload, type FiscalUnit } from "@/lib/indicator-payload";
import { PillGroup } from "@/components/charts/PillGroup";
import { readAll } from "@/lib/indicator-lookup";
import { EconomyCard } from "./EconomyCard";
import type { EconomyData } from "@/lib/indicator-payload";
import { EconomyFilterBar } from "./EconomyFilterBar";
import { CARD_ROWS, SPECS, USD_SPECS, type ChartSpec } from "./specs";
import { LEGEND_ITEM, LEGEND_ROW } from "@/components/charts/legend";
import { UpNext } from "@/components/UpNext";
import { ECONOMY_QUESTIONS, cardId, economyNews } from "./EconomyExtrasMock";
import { ChartJumpLink, InTheNews, NewsAndFaqBand, NewsQuestionsPills, Questions } from "@/components/news/NewsQuestionsMock";
import { enumParam, flagParam, yearsParam } from "@/lib/url-state";
import { useUrlState } from "@/lib/use-url-state";

const UNIT_PARAM = enumParam<FiscalUnit>(["usd", "pct"], "usd");


function Swatch({ color, border }: { color: string; border?: boolean }) {
  return <span aria-hidden className="inline-block size-3" style={{ background: color, border: border ? "1px solid var(--line)" : undefined }} />;
}

export function EconomyPageClient(props: PageProps) {
  return (
    <EconomyStateProvider>
      <EconomyPage {...props} />
    </EconomyStateProvider>
  );
}

interface PageProps {
  payload: EconomyPayload;
  fredNotice: string;
  mortgageAttribution: string;
}

/** "March 2009, Obama (D)" for an axis day. */
function describeDay(data: EconomyData, day: number): string {
  const { year, month } = dateOfDay(day);
  const t = data.terms.find((x) => day >= x.s && day < x.e) ?? data.terms[data.terms.length - 1];
  return `${MONTH_NAMES[month]} ${year}, ${t.label} (${t.party})`;
}

function EconomyPage({
  payload,
  fredNotice,
  mortgageAttribution,
}: PageProps) {
  const data = useMemo(() => fromEconomyPayload(payload), [payload]);
  const values = useEconomyValues();
  const { setRange, clearPin } = useEconomyActions();
  const [showCong, setShowCong] = useState(false);
  // MOCKUP: the card whose jump link was tapped (its DOM id); its news and questions are highlighted for a few seconds.
  const [focus, setFocus] = useState<string | null>(null);
  const jumpTo = (target: string) => {
    setFocus(target);
    window.setTimeout(() => setFocus((f) => (f === target ? null : f)), 4000);
  };
  // Deficit and debt open in dollars; the toggle switches both to a share of GDP. The other unit stays beside the headline and in the tooltip.
  const [unit, setUnit] = useState<FiscalUnit>("usd");
  const other: FiscalUnit = unit === "usd" ? "pct" : "usd";
  const fiscal = useMemo(() => withFiscalUnit(data, unit), [data, unit]);
  const fiscalAlt = useMemo(() => withFiscalUnit(data, other), [data, other]);
  const specs = useMemo<Record<keyof typeof SPECS, ChartSpec>>(() => ({ ...SPECS, ...(unit === "usd" ? USD_SPECS : {}) }), [unit]);
  const news = useMemo(() => economyNews(fiscal, specs), [fiscal, specs]);
  const altSpecs = useMemo(() => (unit === "usd" ? SPECS : USD_SPECS), [unit]);
  const day = activeDay(values);
  // Hero and cards read the same date, from the same lookup module.
  const latest = useMemo(() => readAll(fiscal, day), [fiscal, day]);
  const latestAlt = useMemo(() => readAll(fiscalAlt, day), [fiscalAlt, day]);
  const pinned = useMemo(() => (values.pin === null ? null : readAll(fiscal, values.pin)), [fiscal, values.pin]);
  const status =
    day === null
      ? "Hover over a chart to compare a date. Click to pin it."
      : `${describeDay(data, day)}${values.hover === null ? ", pinned" : ""}`;
  // Announced only when a date is pinned, never on every mouse move.
  const announcement =
    values.pin === null || pinned === null
      ? ""
      : `Pinned ${describeDay(data, values.pin)}. ` +
        (Object.keys(pinned) as (keyof typeof pinned)[])
          .map((k) => `${specs[k].title} ${pinned[k].value === null ? "no reading" : specs[k].head(pinned[k].value!)}`)
          .join("; ");

  const lastFy = Math.max(...Object.keys(fiscal.def).map(Number));
  const lastIncomeYear = Math.max(...Object.keys(data.inc).map(Number));
  const firstYear = dateOfDay(0).year;
  const lastYear = dateOfDay(data.span - 1).year;
  const range = useMemo<[number, number]>(() => values.range ?? [firstYear, lastYear], [values.range, firstYear, lastYear]);
  const view = useMemo<[number, number]>(() => [dayOf(range[0], 0, 1), Math.min(data.span, dayOf(range[1] + 1, 0, 1))], [range, data.span]);
  // Year window, deficit/debt unit and the Congress toggle live in the URL so a view can be linked (lib/use-url-state.ts).
  useUrlState(
    { years: yearsParam.format(values.range, firstYear, lastYear), unit: UNIT_PARAM.format(unit), cong: flagParam.format(showCong) },
    (q) => {
      const r = yearsParam.parse(q.get("years"), firstYear, lastYear);
      if (r) setRange(r);
      const u = UNIT_PARAM.parse(q.get("unit"));
      if (u) setUnit(u);
      if (flagParam.parse(q.get("cong"))) setShowCong(true);
    },
  );
  const common = { data, showCong, view };
  /** Deficit and debt read the unit-swapped data and spec, with the other unit beside them. */
  const isFiscal = (k: keyof typeof SPECS): k is "def" | "debt" => k === "def" || k === "debt";

  const incomeDollars = data.incomeUnits.match(/\d{4}/)?.[0] ?? "";
  const wageMonth = data.wageBase ? `${MONTH_NAMES[Number(data.wageBase.slice(5, 7)) - 1]} ${data.wageBase.slice(0, 4)}` : "";
  // Each note opens with what the chart measures (the line that used to sit under the title, now the takeaway's place).
  const notes: Record<keyof typeof SPECS, React.ReactNode> = {
    mis: <>The unemployment rate plus the year-over-year inflation rate, monthly: a rough one-number gauge of everyday economic strain, devised in the 1970s. Both parts come from the <SourceLink id="fred-unrate">Bureau of Labor Statistics</SourceLink>; the Unemployment and Inflation cards below explain how each is measured. A higher number means more strain. Neither part was collected in October 2025, so the line skips that month.</>,
    un: <>The share of the labor force that is out of work and looking for it, from the <SourceLink id="fred-unrate">Bureau of Labor Statistics</SourceLink>’ monthly household survey, seasonally adjusted. People who have stopped looking are not counted, so the rate can fall even when few jobs are added. The survey was not collected in October 2025, so the line has a one-month gap.</>,
    infl: <>The year-over-year change in the Consumer Price Index for all urban consumers, all items, from the <SourceLink id="fred-cpi">Bureau of Labor Statistics</SourceLink>. It tracks a fixed basket of what households buy, with housing the largest part, so it can differ from any one household’s costs. Prices were not collected in October 2025, so that year-over-year figure does not exist.</>,
    jobs: <>Month-over-month change in total nonfarm payroll employment from the <SourceLink id="fred-payrolls">Bureau of Labor Statistics</SourceLink>’ employer survey, in thousands of jobs. Each estimate is revised in the next two months and again every year, so recent bars can change. The axis is capped at ±1M a month so ordinary months stay readable; larger months run to the edge with a triangle, and the largest gain and loss are labeled with their true values. Gray columns mark recessions dated by the <SourceLink id="nber">National Bureau of Economic Research</SourceLink>; the 2020 one ran two months, from a February peak to an April trough.</>,
    gdp: <>GDP is the value of everything the U.S. produces, here adjusted for inflation. Bars compare each quarter with the same quarter a year earlier; the tooltip adds the annualized quarter-over-quarter rate that headlines report, which exaggerates swings. As first reported, GDP fell in the first two quarters of 2022, a common rule of thumb for recession, but the <SourceLink id="nber">National Bureau of Economic Research</SourceLink> declared none, and later revisions show only one decline. It did date a March–November 2001 recession, though output never fell from a year earlier: it weighs jobs, income and spending, not output alone.</>,
    wage: <>Average hourly pay of production and nonsupervisory employees, about 80% of private-sector workers, from the <SourceLink id="fred-wage">Bureau of Labor Statistics</SourceLink>’ employer survey, in {wageMonth} dollars: pay is divided by the Consumer Price Index so each point shows what that hourly wage buys in the latest month. Hourly pay misses cuts in hours, and it rises when lower-paid workers lose jobs, as in April 2020. Prices were not collected in October 2025, so that month has no value.</>,
    inc: <>Median household income from the <SourceLink id="fred-income">Census Bureau</SourceLink>, one value per year, in constant {incomeDollars} dollars that the Census Bureau re-bases with each release. Published each September for the prior year, so {lastIncomeYear + 1} isn’t available yet. Because it comes once a year, it lags the monthly charts by most of a year.</>,
    gas: <>Weekly national average retail price per gallon from the <SourceLink id="fred-gas">Energy Information Administration</SourceLink>, taxes included. Prices are not adjusted for inflation, so a dollar in 1991 buys more than a dollar today. Diesel is the dashed line and is plotted from March 1994, when the EIA series starts. Use the legend to show either line alone.</>,
    mort: <><SourceLink id="freddie-mac-pmms">Freddie Mac</SourceLink>’s weekly survey of the average 30-year fixed mortgage rate. It is an average, not the rate every borrower gets, and it is not adjusted for inflation. Freddie Mac changed how it collects the rate in November 2022, to rely on lender applications, so comparisons across that line aren’t exact. The dashed vertical line marks the change. Source: <SourceLink id="fred-mortgage">Freddie Mac</SourceLink>.</>,
    def: <>Budget receipts minus outlays, from the <SourceLink id="fred-deficit-usd">Office of Management and Budget</SourceLink>, in dollars or as a <SourceLink id="fred-deficit">share of GDP</SourceLink>. Dollars are not adjusted for inflation, so later years look larger partly because prices and the economy grew; the share of GDP corrects for that. Bars are fiscal years, which run October to September and are named for the year they end. Fiscal {lastFy + 1} isn’t reported yet. Negative is a deficit; positive is a surplus. The newest year can come from <SourceLink id="treasury-fiscal-data">Treasury Fiscal Data</SourceLink> before the other sources publish it.</>,
    debt: <>Total public debt, the figure the news reports, counts what the government owes itself, such as to the Social Security trust funds. The dashed line is debt held by the public, owed to investors outside government. Dollars are not adjusted for inflation, so the line climbs with prices and the economy; as a <SourceLink id="fred-debt">share of GDP</SourceLink> the ratio can fall when the economy grows faster than debt does. Sources: <SourceLink id="fred-debt-usd">Office of Management and Budget</SourceLink> and the <SourceLink id="fred">St. Louis Fed</SourceLink>; the newest dollar figures come from <SourceLink id="treasury-fiscal-data">Treasury Fiscal Data</SourceLink>.</>,
  };
  const key = (c: string, label: string) => (
    <span className={LEGEND_ITEM}>
      <Swatch color={c} />
      {label}
    </span>
  );
  const legends: Partial<Record<keyof typeof SPECS, React.ReactNode>> = {
    jobs: (
      <div className={`${LEGEND_ROW} mt-2`}>
        <span className={LEGEND_ITEM}>
          <svg width="10" height="10" aria-hidden><polygon points="0,9 10,9 5,1" fill="var(--ink)" /></svg>
          Month beyond the axis (true value in the tooltip)
        </span>
      </div>
    ),
    gdp: (
      <div className={`${LEGEND_ROW} mt-2`}>
        {key("var(--ink-faint)", "Growth")}
        {key("var(--ink)", "Shrinking economy")}
      </div>
    ),
    mort: (
      <div className={`${LEGEND_ROW} mt-2`}>
        <span className={LEGEND_ITEM}>
          <svg width="22" height="8" aria-hidden><line x1="0" x2="22" y1="4" y2="4" stroke="var(--ink-muted)" strokeWidth="1" strokeDasharray="3 3" /></svg>
          Survey method change, Nov 2022
        </span>
      </div>
    ),
    def: (
      <div className={`${LEGEND_ROW} mt-2`}>
        {key("var(--ink)", "Deficit")}
        {key("var(--ink-faint)", "Surplus")}
      </div>
    ),
  };

  return (
    <>
      <EconomyFilterBar
        terms={data.terms}
        range={range}
        firstYear={firstYear}
        lastYear={lastYear}
        onRange={setRange}
        status={status}
        canClear={values.pin !== null}
        onClear={clearPin}
      />
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 pb-16 pt-7 sm:px-6">
        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>
        <PageHeader eyebrow="Presidency · Economy" title="What Was the Economy Like?">
          <p>
            Track unemployment, inflation, job growth, real wages, gas prices, and the federal deficit since 1991&mdash;lined up directly against who controlled the White House and Congress.
          </p>
          <NewsQuestionsPills news={news} groups={ECONOMY_QUESTIONS} />
        </PageHeader>

        <label className="-mb-2 flex w-fit cursor-pointer items-center gap-2 text-[0.8rem] text-ink">
          <input
            type="checkbox"
            checked={showCong}
            onChange={(e) => setShowCong(e.target.checked)}
            className="m-0 accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
          Show Congress control under every chart
        </label>

        <EconomyCard
          {...common}
          hero
          spec={SPECS.mis}
          reading={latest.mis}
          takeaway={SPECS.mis.takeaway}
          notes={<p>{notes.mis}</p>}
          legend={
            <div className={`${LEGEND_ROW} mt-2.5`}>
              <span className="inline-flex items-center gap-1.5"><Swatch color="color-mix(in srgb, var(--ink) 9%, transparent)" border />Recession (NBER)</span>
            </div>
          }
        />

        {CARD_ROWS.map((row, i) => (
          <section key={row.label} aria-labelledby={`economy-row-${i}`} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <h2
                id={`economy-row-${i}`}
                className="m-0 flex flex-1 items-center gap-3 font-mono text-[0.68rem] font-medium uppercase tracking-[0.08em] text-ink-muted"
              >
                {row.label}
                <span aria-hidden className="h-px flex-1 bg-line" />
              </h2>
              {row.cards.some(isFiscal) && (
                <PillGroup
                  ariaLabel="Show deficit and debt as"
                  value={unit}
                  onChange={setUnit}
                  options={[
                    { value: "usd", label: "Dollars" },
                    { value: "pct", label: "% of GDP" },
                  ]}
                />
              )}
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:grid-rows-[repeat(5,auto)] md:gap-y-0">
              {row.cards.map((k) => (
                <EconomyCard
                  key={k}
                  {...common}
                  {...(isFiscal(k) ? { data: fiscal, alt: { data: fiscalAlt, spec: altSpecs[k] }, altReading: latestAlt[k] } : {})}
                  spec={specs[k]}
                  reading={latest[k]}
                  takeaway={specs[k].takeaway}
                  notes={<p>{notes[k]}</p>}
                  jump={<ChartJumpLink target={cardId(k)} news={news} groups={ECONOMY_QUESTIONS} onJump={jumpTo} />}
                  legend={
                    k === "gas" || k === "debt"
                      ? ({ only, isolate }) => (
                          <div className={`${LEGEND_ROW} mt-2`}>
                            <LegendToggle active={only === "main"} dimmed={only === "second"} onClick={() => isolate("main")}>
                              <svg width="22" height="8" aria-hidden><line x1="0" x2="22" y1="4" y2="4" stroke="var(--ink)" strokeWidth="2" /></svg>
                              {k === "gas" ? "Regular gasoline" : "Total public debt"}
                            </LegendToggle>
                            <LegendToggle active={only === "second"} dimmed={only === "main"} onClick={() => isolate("second")}>
                              <svg width="22" height="8" aria-hidden><line x1="0" x2="22" y1="4" y2="4" stroke="var(--ink-faint)" strokeWidth="2" strokeDasharray="4 3" /></svg>
                              {k === "gas" ? "Diesel (from 1994)" : "Held by the public"}
                            </LegendToggle>
                          </div>
                        )
                      : legends[k]
                  }
                />
              ))}
            </div>
          </section>
        ))}

        <NewsAndFaqBand>
          <InTheNews items={news} focus={focus} />
          <Questions groups={ECONOMY_QUESTIONS} focus={focus} />
        </NewsAndFaqBand>

        <UpNext />
        <div className="flex flex-col gap-2.5 text-[0.8rem] leading-[1.6] text-ink-muted">
          <p className="m-0">
            Source: U.S. Bureau of Labor Statistics, U.S. Bureau of Economic Analysis, U.S. Energy Information Administration, U.S. Census Bureau, U.S.
            Office of Management and Budget and the <SourceLink id="nber">National Bureau of Economic Research</SourceLink>, via <SourceLink id="fred">Federal Reserve Bank of St.
            Louis, FRED®</SourceLink>. Mortgage rates: {mortgageAttribution}. Chamber majorities: <SourceLink id="senate-party-division">U.S. Senate</SourceLink> and <SourceLink id="house-party-division">U.S. House
            historians’ party-division tables</SourceLink>.
          </p>
          <p className="m-0">{fredNotice}</p>
        </div>
      </main>
    </>
  );
}
