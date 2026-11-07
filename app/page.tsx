import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { getBothTrend, getViewCurrent } from "@/lib/congress-data";
import { getBranch } from "@/lib/verticals";
import { site } from "@/lib/site";
import { getCourtPayload } from "@/lib/justice-data";
import { getHubTariff } from "@/lib/trade-data";
import { fmtRate } from "@/lib/trade-hub";
import { HubTariffChart } from "@/components/trade/HubTariffChart";
import { HubCompass } from "@/components/HubCompass";
import { CourtHubStrip } from "@/components/court/CourtHubStrip";
import { HomeHero } from "@/components/home/HomeHero";
import { BranchStrip } from "@/components/home/BranchStrip";
import { HomeTimelineCard } from "@/components/home/HomeTimelineCard";
import { getTimelinePayload } from "@/lib/timeline-data";
import { HomeBranchCard } from "@/components/home/HomeBranchCard";
import { HomeMotion } from "@/components/home/HomeMotion";
import { IntroWords } from "@/components/home/IntroWords";
import { FastFacts } from "@/components/home/FastFacts";
import { getFastFacts } from "@/lib/fast-facts-data";

export const metadata: Metadata = pageMetadata({ title: site.homeTitle, description: site.description, path: "/", absolute: true });

const BLURBS: Record<string, string> = {
  congress:
    "Every member\u2019s votes as a two-dimensional ideology score, the laws Congress enacts and how broadly they are supported, estimated net worth from financial disclosures, and who serves by age, gender and tenure.",
  "supreme-court":
    "Where the justices sit over time based on their ideology, how many cases the Court decides, and how often it splits.",
  presidency:
    "The economy, trade, immigration, energy, foreign aid, troops abroad and executive orders, laid out against each presidential term, from gas prices and tariffs to deportations.",
};

const KICKERS: Record<string, string> = {
  presidency: "The executive",
  congress: "The legislature",
  "supreme-court": "The judiciary",
};
const NUMERALS = ["I", "II", "III"];
/** Terms shorter than this (in months) are too narrow to name under the tariff chart; a short sitting term gets its own line. */
const TERM_LABEL_MONTHS = 36;

/** Big serif headline figure with a one-line caption, used under each card's chart. */
function Stat({ figure, children }: { figure: string; children: React.ReactNode }) {
  return (
    <>
      <span className="font-serif text-[2.1rem] font-medium leading-[1.05] tracking-tight text-accent">{figure}</span>
      <span className="text-[0.85rem] leading-snug text-ink-muted">{children}</span>
    </>
  );
}

export default function Hub() {
  const presidency = getBranch("presidency");
  const congressBranch = getBranch("congress");
  const courtBranch = getBranch("supreme-court");
  const trend = getBothTrend();
  const congress = getViewCurrent("both");
  const court = getCourtPayload();
  const tariff = getHubTariff();
  const fastFacts = getFastFacts();

  // Party gap per Congress, to say how today's divide ranks historically.
  const gaps = trend
    .filter((p) => p.dem != null && p.rep != null)
    .map((p) => ({ year: p.year, gap: (p.rep as number) - (p.dem as number) }));
  const nowGap = gaps[gaps.length - 1];
  const wider = gaps.filter((g) => g.gap > nowGap.gap).length;
  const lastWider = [...gaps].reverse().find((g) => g.gap > nowGap.gap);

  const seated = court.justices.filter(
    (j) => j.t0 <= court.lastTerm && court.lastTerm <= j.t1,
  );
  const gopAppointed = seated.filter((j) => j.party === "R").length;

  const href = (b: { href: string; defaultSection: string }) => `${b.href}/${b.defaultSection}`;

  return (
    <main className="flex flex-1 flex-col">
      <HomeMotion />
      <HomeHero
        kicker={site.tagline}
        title={
          <>
            Three branches. <em className="font-normal italic">One public record.</em>
          </>
        }
        intro={
          <p>
            The headlines give you the numbers&mdash;gas prices, tariffs, court rulings, national debt&mdash;but rarely show you the full context. InsideGov pulls straight from official public records, putting the historical data behind the news directly in your hands.
          </p>
        }
        startHref={href(presidency)}
        strip={<BranchStrip items={[presidency, congressBranch, courtBranch]} />}
      />

      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-4 pb-16 sm:px-6">
        <h2 className="-mb-3 pt-12 font-mono text-[0.68rem] font-medium uppercase tracking-[0.14em] text-accent">The Data Behind the Headlines</h2>
        <p className="home-intro pb-3 font-serif text-[clamp(1.35rem,2.6vw,1.9rem)] leading-snug tracking-tight">
          <IntroWords
            before="When a number makes headlines, three questions immediately follow: Is it unusually high, has it happened before, and "
            highlight="on whose watch did it change?"
            after=" Every chart tracks historical trends across changing political administrations, while parallel pages let you look up individual lawmakers—from their personal voting records to financial disclosures."
          />
        </p>

        <FastFacts facts={fastFacts.facts} updated={fastFacts.updated} />

        <HomeBranchCard
          grow
          branch={presidency}
          numeral={NUMERALS[0]}
          kicker={KICKERS.presidency}
          blurb={BLURBS.presidency}
          viz={
            <>
              <span
                aria-hidden="true"
                className="hub-trend-lab pointer-events-none absolute left-4 top-3.5 z-10 font-mono text-[0.68rem] text-[#e8c877]"
              >
                Average tariff on imports · {tariff.first.slice(0, 4)}&ndash;{tariff.latest.label.slice(-4)}
              </span>
              <Link
                href={`${presidency.href}/trade#tariffs`}
                aria-label="Presidency: open the trade page"
                className="flex flex-1"
              >
                <HubTariffChart data={tariff} stretch />
              </Link>
              <div aria-hidden="true" className="mt-1.5 font-mono text-[0.56rem] tracking-tight text-white/75 sm:text-[0.62rem] sm:tracking-normal">
                <div className="relative h-4">
                  {tariff.terms
                    .filter((t) => t.e - t.s >= TERM_LABEL_MONTHS)
                    .map((t) => (
                      <span
                        key={`${t.label}-${t.s}`}
                        className="absolute -translate-x-1/2 whitespace-nowrap"
                        style={{ left: `${(((t.s + t.e) / 2) / tariff.rates.length) * 100}%` }}
                      >
                        {t.label}
                      </span>
                    ))}
                </div>
                {tariff.terms
                  .filter((t) => t.current && t.e - t.s < TERM_LABEL_MONTHS)
                  .map((t) => (
                    <div key={t.label} className="text-right">
                      {t.label}, {t.startYear}&ndash;
                    </div>
                  ))}
              </div>
            </>
          }
          stat={
            <Stat figure={fmtRate(tariff.latest.rate)}>
              average tariff on U.S. imports in {tariff.latest.label}
              {tariff.baseline && <>, up from {fmtRate(tariff.baseline.rate)} in {tariff.baseline.year}</>}
              {tariff.peak && <>{tariff.baseline ? ", but" : ","} down from {fmtRate(tariff.peak.rate)} in {tariff.peak.label}</>}
            </Stat>
          }
        />

        <HomeBranchCard
          branch={congressBranch}
          numeral={NUMERALS[1]}
          kicker={KICKERS.congress}
          blurb={BLURBS.congress}
          viz={
            <Link
              href={`${congressBranch.href}/ideology`}
              aria-label="Congress: open the ideology page"
              className="block"
            >
              <HubCompass members={congress.plottable} />
            </Link>
          }
          stat={
            <Stat figure={wider === 0 ? "Most divided ever" : `Most divided since ${lastWider!.year}`}>
              The two parties are{" "}
              {wider === 0
                ? "farther apart than at any point"
                : `farther apart than at any point since ${lastWider!.year}`}
              , judging by how members vote
            </Stat>
          }
        />

        <HomeBranchCard
          branch={courtBranch}
          numeral={NUMERALS[2]}
          kicker={KICKERS["supreme-court"]}
          blurb={BLURBS["supreme-court"]}
          viz={
            <Link
              href={`${courtBranch.href}/ideology`}
              aria-label="Supreme Court: open the ideology page"
              className="block"
            >
              <CourtHubStrip data={court} compact />
            </Link>
          }
          stat={
            <Stat figure={`${gopAppointed} of ${seated.length}`}>
              justices were appointed by Republican presidents
            </Stat>
          }
        />

        <HomeTimelineCard data={getTimelinePayload()} />
      </div>
    </main>
  );
}
