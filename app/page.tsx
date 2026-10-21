import type { Metadata } from "next";
import Link from "next/link";
import { getBothTrend, getViewCurrent } from "@/lib/congress-data";
import { getBranch } from "@/lib/verticals";
import { site, ogDefaults, twitterDefaults } from "@/lib/site";
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

export const metadata: Metadata = {
  title: { absolute: `${site.name} · ${site.tagline}` },
  description: site.description,
  alternates: { canonical: "/" },
  openGraph: {
    ...ogDefaults,
    title: `${site.name} · ${site.tagline}`,
    description: site.description,
    url: "/",
  },
  twitter: twitterDefaults,
};

const BLURBS: Record<string, string> = {
  congress:
    "Every member\u2019s votes as a two-dimensional ideology score, the laws Congress enacts and how broadly they are supported, estimated net worth from financial disclosures, and who serves by age, gender and tenure.",
  "supreme-court":
    "Where the justices sit over time, based on their ideology, and how many cases the Court decides and how often it splits.",
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
            The news runs on numbers: gas prices, mortgage rates, tariffs,
            deportations, the deficit, the vote on a new law, a 6&ndash;3 ruling.
            The stories rarely come with the charts. InsideGov is where
            you find them, drawn from the government&rsquo;s own records so you
            can see the data behind the headlines for yourself.
          </p>
        }
        startHref={href(presidency)}
        strip={<BranchStrip items={[presidency, congressBranch, courtBranch]} />}
      />

      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-4 pb-16 sm:px-6">
        <p className="home-intro pb-3 pt-12 font-serif text-[clamp(1.35rem,2.6vw,1.9rem)] leading-snug tracking-tight">
          <IntroWords
            before="When a number makes the news, the same questions follow: is it high, has it happened before, and on whose watch did it change? Every chart here runs up to the latest figures and back through "
            highlight="who held power"
            after=". That includes the officeholders themselves, from how they vote to what they’re worth."
          />
        </p>

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
                href={href(presidency)}
                aria-label={`${presidency.label}: open the first page`}
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
              href={href(congressBranch)}
              aria-label={`${congressBranch.label}: open the first page`}
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
              href={href(courtBranch)}
              aria-label={`${courtBranch.label}: open the first page`}
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
