import Link from "next/link";
import { SetBackLink } from "@/components/BackLinkContext";
import { MethodologyNote } from "@/components/MethodologyNote";
import { PageHeader } from "@/components/PageHeader";
import { ChartCard } from "@/components/charts/ChartCard";
import { SourceLink } from "@/components/SourceLink";
import { DirectionTag } from "@/components/decisions/DirectionTag";
import { LANDMARK_WORD, PILL_LANDMARK, PILL_NEUTRAL } from "@/components/decisions/pill";
import { longDate } from "@/lib/law-details-derive";
import type { DecisionPageData, DecisionParty, RelatedDecision } from "@/lib/decision-page-types";
import { BenchCard } from "./BenchCard";
import { RelatedCasesCard } from "./RelatedCasesCard";
import { LeadBody } from "./LeadBody";
import { MatchedCards } from "./MatchedCards";

const BADGE = PILL_NEUTRAL;
const LINK = "text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** Majority and dissent are not party colours: the bar is a count, so ink and a pale line, as the law page's yea and nay. */
const MAJ = "var(--ink)";
const DIS = "var(--line-strong)";

/** The one-sentence ruling from the Decisions list, first under the title, as the law page's official title sits. A Claude-written one carries no tag here (the list tags it); the Summary card's note says so. */
function Gist({ d }: { d: DecisionPageData }) {
  if (!d.sentence) return null;
  return (
    <p className="m-0 text-[1rem] leading-[1.55] text-ink">
      {d.sentence.text}
    </p>
  );
}

/** Facts under the title: cite, docket, term and Court; dates; issue with its badges. The outcome tag and the opinion's author sit with the vote. */
function Facts({ d }: { d: DecisionPageData }) {
  const badges = [
    d.landmark && (
      <span key="lm" className={PILL_LANDMARK} title="On Wikipedia’s list of landmark decisions">
        <span className={LANDMARK_WORD}>Landmark</span>
        {d.landmark.topics ? ` · ${d.landmark.topics}` : ""}
      </span>
    ),
    d.precedentAltered && (
      <span key="pr" className={BADGE} title="The majority opinion says it overruled one of the Court’s own earlier decisions">
        Overruled precedent
      </span>
    ),
    d.struckDown && (
      <span key="sd" className={BADGE} title="The Court declared a law unconstitutional">
        {`Struck down ${d.struckDown.charAt(0).toLowerCase()}${d.struckDown.slice(1)}`}
      </span>
    ),
  ].filter(Boolean);
  return (
    <>
      <p className="m-0">
        {[d.cite, d.docket && `No. ${d.docket}`, `${d.term} term`, d.court].filter(Boolean).join(" · ")}
      </p>
      <p className="m-0">
        {`Decided ${longDate(d.decided)}`}
        {d.argued ? ` · argued ${longDate(d.argued)}` : ""}
        {d.reargued ? `, reargued ${longDate(d.reargued)}` : ""}
      </p>
      {/* The badges are about the issue, so they share the topic's line and drop below it only when it leaves no room. */}
      {(d.topic || badges.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          {d.topic && <p className="m-0">{d.topic.label}</p>}
          {badges}
        </div>
      )}
      {(d.area || d.issue) && (
        <p className="m-0">
          {"Supreme Court Database: "}
          {d.area?.label}
          {d.area && d.issue ? " · " : ""}
          {d.issue}
        </p>
      )}
    </>
  );
}

/** The vote, in the page header beside the facts: the split as one bar, the split as one bar, who prevailed and who wrote the opinion, then what the Court did. */
function Vote({ d }: { d: DecisionPageData }) {
  const { maj, min } = d.vote;
  const total = maj + min;
  const won = d.petitionerWon === null ? null : `${d.petitioner.name ?? "The party that brought the case"} ${d.petitionerWon ? "won" : "lost"}`;
  return (
    <section aria-label="The vote" className="lg:w-[25.5rem]">
      <h2 className="m-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.72rem] font-medium uppercase tracking-[0.06em] text-ink-faint">
        <span>The vote</span>
        <span className="inline-flex items-center gap-3 normal-case tracking-normal">
          <span className="inline-flex items-center gap-1.5">
            <i aria-hidden className="inline-block size-2 rounded-sm" style={{ background: MAJ }} />
            {maj === min ? "Each side" : "Majority"}
          </span>
          {min > 0 && maj !== min && (
            <span className="inline-flex items-center gap-1.5">
              <i aria-hidden className="inline-block size-2 rounded-sm" style={{ background: DIS }} />
              Dissent
            </span>
          )}
        </span>
      </h2>
      <p className="m-0 mt-2 flex items-center gap-2 text-[0.85rem]">
        <span aria-hidden className="flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-line">
          <span style={{ width: `${(maj / total) * 100}%`, background: MAJ }} />
          <span style={{ width: `${(min / total) * 100}%`, background: maj === min ? MAJ : DIS, marginLeft: maj === min ? 2 : 0 }} />
        </span>
        <span className="whitespace-nowrap font-medium tabular-nums text-ink">{`${maj}–${min}`}</span>
        <span className="sr-only">{maj === min ? `${maj} on each side` : `${maj} in the majority, ${min} in dissent`}</span>
      </p>
      {maj === min && <p className="m-0 mt-1.5 text-[0.82rem] text-ink-muted">Equally divided: the decision below stands</p>}
      {(d.direction || d.writer) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {d.direction && <DirectionTag outcome direction={d.direction} areaId={d.area?.id ?? null} />}
          {d.writer && (
            <p className="m-0 text-[0.82rem]">
              <span className="text-ink-muted">Majority opinion by </span>
              <Link href={d.writer.path} className={LINK}>
                {d.writer.name}
              </Link>
            </p>
          )}
        </div>
      )}
      {(d.disposition || won) && (
        <p className="m-0 mt-2.5 text-[0.85rem] text-ink">
          {d.disposition}
          {d.disposition && won ? ". " : ""}
          {won && <span className="text-ink-muted">{`${won}.`}</span>}
        </p>
      )}
      <MethodologyNote label="What this ruling means">
        {d.dispositionNote && <p>{d.dispositionNote}</p>}
        {won && (
          <p>
            {`${d.petitioner.name ? `${d.petitioner.name} was the petitioner` : "The petitioner is"}, the side that asked the Supreme Court to review the case. “${d.petitionerWon ? "Won" : "Lost"}” means the Court ${d.petitionerWon ? "gave" : "did not give"} that side the result it asked for.`}
          </p>
        )}
      </MethodologyNote>
    </section>
  );
}

/** The Wikipedia opening. With no opening but a one-sentence summary there is no card: the sentence is already in the header. */
function Summary({ d }: { d: DecisionPageData }) {
  const wiki = d.links.wikipedia;
  if (!d.summary && d.sentence) return null;
  return (
    <ChartCard title="Summary" lede="The opening of the case’s Wikipedia article: what the case was about and what the Court held.">
      {d.summary ? (
        <div className="flex flex-col gap-3 text-[0.9rem] leading-[1.65]">
          <LeadBody paragraphs={d.summary.paragraphs} />
          {wiki && (
            <p className="m-0 text-[0.82rem] text-ink-muted">
              <a href={wiki} target="_blank" rel="noreferrer" className={LINK}>
                Read the full article on Wikipedia
              </a>
            </p>
          )}
        </div>
      ) : (
        <p className="m-0 text-[0.88rem] text-ink-muted">
          {wiki ? (
            <>
              No summary is on file for this case.{" "}
              <a href={wiki} target="_blank" rel="noreferrer" className={LINK}>
                Search Wikipedia for it
              </a>
              .
            </>
          ) : (
            "Wikipedia has no article on this case, so there is no summary."
          )}
        </p>
      )}
      <MethodologyNote>
        <p>
          The text is Wikipedia’s (CC BY-SA 4.0), matched to the case by its citation, docket number or name and year, and is not checked against the opinion. The site keeps the article’s opening section, ending on its last full sentence. The one-sentence summary under the title is the Decisions list’s: Wikipedia’s own ruling sentence or, where Wikipedia’s opening does not state the ruling, one Claude wrote from this opening (the list tags those “AI-written”).
        </p>
      </MethodologyNote>
    </ChartCard>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-3 border-b border-line px-3 py-2 text-[0.82rem] last:border-b-0 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="m-0 min-w-0 text-ink">{children}</dd>
    </div>
  );
}

function PartyLine({ p }: { p: DecisionParty }) {
  return (
    <>
      {p.name ?? <span className="text-ink-muted">Not named in the caption</span>}
      {p.kind && <span className="block text-[0.75rem] text-ink-muted">{p.kind}</span>}
    </>
  );
}

function Parties({ d }: { d: DecisionPageData }) {
  return (
    <ChartCard title="The parties" lede="Who brought the case to the Court, who answered it, and how it got there.">
      <dl className="m-0 rounded-md border border-line">
        <Row label="Petitioner">
          <PartyLine p={d.petitioner} />
        </Row>
        <Row label="Respondent">
          <PartyLine p={d.respondent} />
        </Row>
        {d.jurisdiction && <Row label="Reached the Court by">{d.jurisdiction}</Row>}
        {d.certReason && <Row label="Why it was taken">{d.certReason}</Row>}
      </dl>
      <MethodologyNote>
        <p>
          The names are the two sides of the case’s title. The description under each is the <SourceLink id="scdb-codebook">Supreme Court Database’s category</SourceLink> for that party, in its own wording. The petitioner is the side that asked the Supreme Court to review the decision below. “Why it was taken” appears only when the majority opinion says lower courts disagreed or were unsure about the question; reasons that would fit any case (“to resolve the question presented”, “an important question”) are left out.
        </p>
      </MethodologyNote>
    </ChartCard>
  );
}

function Law({ d }: { d: DecisionPageData }) {
  const { type, provision, authority } = d.law;
  const empty = !type && !provision && authority.length === 0 && !d.struckDown && !d.precedentAltered;
  return (
    <ChartCard title="The law at issue" lede={empty ? "The record codes no legal provision for this case." : "The law the Court was asked to apply, and the kind of power it used to decide."}>
      {!empty && (
        <dl className="m-0 rounded-md border border-line">
          {provision && <Row label="Provision">{provision}</Row>}
          {type && <Row label="Kind of law">{type}</Row>}
          {authority.length > 0 && <Row label="Decided by">{authority.join("; ")}</Row>}
          {d.struckDown && <Row label="Struck down">{`${d.struckDown}, as unconstitutional`}</Row>}
          {d.precedentAltered && <Row label="Precedent">The Court overruled one of its own earlier decisions.</Row>}
        </dl>
      )}
      <MethodologyNote>
        <p>
          The <SourceLink id="scdb-codebook">Supreme Court Database</SourceLink> codes the main constitutional provision, statute or court rule each case turned on, and the basis of the decision: judicial review of a federal or state law, interpreting a statute, supervising the lower courts, and so on. A case can rest on more than one. “Overruled” counts only where the majority opinion says so.
        </p>
      </MethodologyNote>
    </ChartCard>
  );
}

function Timeline({ d }: { d: DecisionPageData }) {
  return (
    <ChartCard title="Timeline" lede="What happened at the Court and how the case got there, newest first.">
      <ol className="m-0 list-none p-0">
        {d.timeline.map((s, i) => (
          <li key={i} className={`grid grid-cols-1 gap-x-3 py-1.5 text-[0.82rem] leading-[1.45] sm:grid-cols-[6.5rem_9rem_minmax(0,1fr)] ${i > 0 ? "border-t border-line" : ""}`}>
            <span className={`tabular-nums text-ink-muted max-sm:mb-1 max-sm:w-fit max-sm:rounded max-sm:border max-sm:border-line-strong max-sm:bg-surface-raised max-sm:px-2 max-sm:py-0.5 max-sm:font-semibold max-sm:text-ink ${s.date ? "" : "max-sm:hidden"}`}>{s.date ? longDate(s.date) : "Not dated"}</span>
            <span className="text-[0.72rem] uppercase tracking-[0.04em] text-ink-faint max-sm:hidden">{s.kind}</span>
            <span className="min-w-0">
              <span className="text-[0.68rem] uppercase tracking-[0.04em] text-ink-faint sm:hidden">{`${s.kind} · `}</span>
              {s.text}
            </span>
          </li>
        ))}
      </ol>
      <MethodologyNote>
        <p>
          From the <SourceLink id="scdb">Supreme Court Database</SourceLink>: the court the case began in, the court whose decision the Supreme Court reviewed and what that court did, how the case came to the Court, and the dates of argument and decision. The database does not date the steps in the lower courts. Court names are the database’s.
        </p>
      </MethodologyNote>
    </ChartCard>
  );
}

function Related({ d }: { d: DecisionPageData }) {
  if (!d.related) return null;
  const { issue, cases } = d.related;
  return (
    <RelatedCasesCard title="Other decisions on the same issue" cases={cases} rest={` since 1946 on ${issue.charAt(0).toLowerCase()}${issue.slice(1).replace(/:\s+including\b/, ", including")}, newest first.`}>
      <MethodologyNote>
        <p>
          Every other orally argued case with a clear vote, from the 1946 term on, that the <SourceLink id="scdb">Supreme Court Database</SourceLink> files under the same issue as this one. The database gives each case one issue from a list of about 270 (abortion, search and seizure of vehicles, the death penalty, and so on), whatever law it turned on.
        </p>
      </MethodologyNote>
    </RelatedCasesCard>
  );
}

function SameTerm({ d }: { d: DecisionPageData }) {
  if (!d.sameTerm) return null;
  const { term, cases } = d.sameTerm;
  // The term's biggest topic by case count (ties: the first met, newest) and how many it spans. Topic labels hold commas and
  // ampersands, so they are not listed one after another.
  const tally = new Map<string, number>();
  for (const r of cases) if (r.areaId) tally.set(r.area, (tally.get(r.area) ?? 0) + 1);
  const lead = [...tally].sort((a, b) => b[1] - a[1])[0]?.[0];
  const low = lead ? lead.charAt(0).toLowerCase() + lead.slice(1) : "";
  const areas = !lead ? "" : tally.size > 1 ? `${tally.size} topics, most often ${low}` : `all in ${low}`;
  return (
    <RelatedCasesCard title="Other decisions from the same term" cases={cases} rest={` decided in the ${term} term${areas ? (areas.startsWith("all in") ? `, ${areas}` : `, across ${areas}`) : ""}, newest first.`}>
      <MethodologyNote>
        <p>
          Every other orally argued case with a clear vote that the <SourceLink id="scdb">Supreme Court Database</SourceLink> counts in the {term} term, the Court’s year from the first Monday in October through the following summer.
        </p>
      </MethodologyNote>
    </RelatedCasesCard>
  );
}

export function DecisionPageView({ d }: { d: DecisionPageData }) {
  const { oyez, justia, wikipedia } = d.links;
  const links = [
    justia && { href: justia, label: "the full opinion on Justia" },
    oyez && { href: oyez, label: "the argument audio on Oyez" },
    wikipedia && { href: wikipedia, label: "Wikipedia" },
  ].filter((l): l is { href: string; label: string } => Boolean(l));
  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 pb-16 pt-9 sm:px-6 sm:pt-11">
      <SetBackLink href="/supreme-court/decisions" />
      <PageHeader eyebrow="Supreme Court · Decisions" title={d.shortName}>
        <div className="flex flex-col gap-5 lg:flex-row lg:gap-8">
          <div className="flex min-w-0 flex-col gap-3 lg:flex-1">
            {d.shortName !== d.name && <p className="m-0 text-[0.9rem] text-ink-muted">Full case name: {d.name}</p>}
            <Gist d={d} />
            <Facts d={d} />
          </div>
          <div className="min-w-0 border-t border-line pt-4 lg:w-fit lg:flex-none lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <Vote d={d} />
          </div>
        </div>
      </PageHeader>
      <Summary d={d} />
      {d.bench.length > 0 && <BenchCard bench={d.bench} median={d.median} domain={d.domain} term={d.term} maj={d.vote.maj} min={d.vote.min} provisional={d.scoresProvisional} />}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Parties d={d} />
        <Law d={d} />
      </div>
      <Timeline d={d} />
      {(d.related || d.sameTerm) && (
        <MatchedCards className={`grid grid-cols-1 gap-6 ${d.related && d.sameTerm ? "lg:grid-cols-2" : ""}`}>
          <Related d={d} />
          <SameTerm d={d} />
        </MatchedCards>
      )}
      <section aria-label="Official record" className="rounded-[10px] border border-line bg-surface p-[1.1rem_1.35rem] text-[0.85rem] text-ink-muted">
        <h2 className="m-0 font-serif text-[1.05rem] font-medium text-ink">Official record</h2>
        <p className="m-0 mt-1">
          {links.length > 0 ? (
            <>
              {"Read "}
              {links.map((l, i) => (
                <span key={l.href}>
                  {i > 0 ? (i === links.length - 1 ? " and " : ", ") : ""}
                  <a href={l.href} target="_blank" rel="noreferrer" className={LINK}>
                    {l.label}
                  </a>
                </span>
              ))}
              .
            </>
          ) : (
            "The opinion is on the Supreme Court’s website and in the U.S. Reports."
          )}{" "}
          Case data from the Supreme Court Database, {d.scdbVersion}, through the {d.dataThroughTerm} term.
        </p>
      </section>
    </main>
  );
}
