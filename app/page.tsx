import type { Metadata } from "next";
import Link from "next/link";
import { getBothTrend, getViewCurrent } from "@/lib/congress-data";
import { getBranch } from "@/lib/verticals";
import { site, ogDefaults, twitterDefaults } from "@/lib/site";
import { getCourtPayload } from "@/lib/justice-data";
import { getExecutiveOrdersData } from "@/lib/executive-orders-data";
import { EO_TOPICS, EO_TOPIC_LABELS, topicFill } from "@/lib/executive-orders-types";
import { HubEoChart } from "@/components/executive-orders/HubEoChart";
import { HubCompass } from "@/components/HubCompass";
import { CourtHubStrip } from "@/components/court/CourtHubStrip";
import { HomeHero } from "@/components/home/HomeHero";
import { BranchStrip } from "@/components/home/BranchStrip";
import { HomeBranchCard } from "@/components/home/HomeBranchCard";

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
    "Every member\u2019s votes as a two-dimensional ideology score, the laws Congress enacts and how broadly they are supported, who serves by age, gender and tenure, and estimated net worth from financial disclosures.",
  "supreme-court":
    "Where the justices sit over time, from Martin\u2013Quinn ideology scores, and how many cases the Court decides and how often it splits.",
  presidency:
    "Executive orders, the economy, energy, trade, immigration, foreign aid and troops abroad, laid out against each presidential term, from gas prices and tariffs to deportations.",
};

const KICKERS: Record<string, string> = {
  presidency: "The executive",
  congress: "The legislature",
  "supreme-court": "The judiciary",
};
const NUMERALS = ["I", "II", "III"];

/** Big serif headline figure with a one-line caption, used under each card's chart. */
function Stat({ figure, children }: { figure: string; children: React.ReactNode }) {
  return (
    <>
      <span className="font-serif text-[2.1rem] font-medium leading-[1.05] tracking-tight text-accent">{figure}</span>
      <span className="text-[0.85rem] leading-snug text-ink-muted">{children}</span>
    </>
  );
}

/** One topic colour swatch and name, for the executive-orders chart key. */
function TopicKey({ topic }: { topic: (typeof EO_TOPICS)[number] }) {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden="true" className="inline-block size-2.5 rounded-[2px]" style={{ background: topicFill(topic) }} />
      {EO_TOPIC_LABELS[topic]}
    </li>
  );
}

export default function Hub() {
  const presidency = getBranch("presidency");
  const congressBranch = getBranch("congress");
  const courtBranch = getBranch("supreme-court");
  const trend = getBothTrend();
  const congress = getViewCurrent("both");
  const court = getCourtPayload();
  const orders = getExecutiveOrdersData();

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
      <HomeHero
        kicker={site.tagline}
        title={
          <>
            Three branches. <em className="font-normal italic">One public record.</em>
          </>
        }
        intro={
          <p>
            Every order signed, roll call cast, ruling issued, and financial
            disclosure filed leaves a trail. We turn those records into data you
            can scrub through, compare, and dig into.
          </p>
        }
        startHref={href(presidency)}
        strip={<BranchStrip items={[presidency, congressBranch, courtBranch]} />}
      />

      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-4 pb-16 sm:px-6">
        <p className="home-reveal pb-3 pt-12 font-serif text-[clamp(1.35rem,2.6vw,1.9rem)] leading-snug tracking-tight">
          Explore the presidency, Congress, and the Supreme Court through{" "}
          <span className="bg-[linear-gradient(transparent_64%,#e8c877_64%)]">the public record</span>:
          executive orders, the economy, energy, trade, immigration, foreign aid,
          troops abroad, the laws Congress passes, ideology, demographics, net
          worth, and court decisions.
        </p>

        <HomeBranchCard
          index={0}
          grow
          branch={presidency}
          numeral={NUMERALS[0]}
          kicker={KICKERS.presidency}
          blurb={BLURBS.presidency}
          viz={
            <>
              <ul
                aria-label="Topic colours"
                className="pointer-events-none absolute left-4 top-3.5 z-10 hidden gap-1 font-mono text-[0.68rem] text-white/85 sm:grid"
              >
                {EO_TOPICS.map((t) => (
                  <TopicKey key={t} topic={t} />
                ))}
              </ul>
              <Link
                href={href(presidency)}
                aria-label={`${presidency.label}: open the first page`}
                className="flex flex-1"
              >
                <HubEoChart data={orders} stretch />
              </Link>
              <ul
                aria-hidden="true"
                className="mt-3 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[0.66rem] text-white/85 sm:hidden"
              >
                {EO_TOPICS.map((t) => (
                  <TopicKey key={t} topic={t} />
                ))}
              </ul>
            </>
          }
          stat={
            <Stat figure={(orders.years.find((y) => y.year === 2025)?.total ?? 0).toLocaleString("en-US")}>
              executive orders signed in 2025
            </Stat>
          }
        />

        <HomeBranchCard
          index={1}
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
          index={2}
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
      </div>
    </main>
  );
}
