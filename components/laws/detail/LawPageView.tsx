import Link from "next/link";
import { SetBackLink } from "@/components/BackLinkContext";
import { MethodologyNote } from "@/components/MethodologyNote";
import { PageHeader } from "@/components/PageHeader";
import { ChartCard } from "@/components/charts/ChartCard";
import { longDate, methodText, yeaShare } from "@/lib/law-details-derive";
import { CommitteeSeal } from "@/components/committee/CommitteeSeal";
import type { LawCommitteeEntry, LawPageData } from "@/lib/law-details-types";
import { ordinal } from "@/lib/laws-entities";
import { AmendmentsList } from "./AmendmentsList";
import { RelatedList } from "./LawLists";
import { CosponsorsHeader } from "./CosponsorsHeader";
import { LawVotesCard } from "./LawVotesCard";
import { SummaryBody } from "./SummaryBody";
import { TimelineList } from "./TimelineList";
import { Dot, LINK, Person } from "./LawPeople";
import type { ChamberTally } from "@/lib/laws-types";

const BADGE = "inline-flex items-center rounded-full border border-line-strong px-2 py-px text-[0.68rem] font-medium text-ink-muted";


/** Facts under the title: number, bill, date, signer, policy area. The sponsor and cosponsors sit in the column to the right. */
function Facts({ law }: { law: LawPageData }) {
  const signerParty = law.president.party;
  return (
    <>
      <p className="m-0">
        {law.publicLaw} · {law.billLabel} · {ordinal(law.congress)} Congress
        {law.originChamber ? ` · began in the ${law.originChamber}` : ""}
      </p>
      <p className="m-0">
        {law.veto ? "Vetoed by " : "Signed by "}
        <span className="whitespace-nowrap text-ink">{law.president.name}</span>
        <span className="text-ink-faint">{` (${signerParty})`}</span>
        {law.veto ? `; passed over the veto on ${longDate(law.date)}` : ` on ${longDate(law.date)}`}
        {law.area ? ` · ${law.area}` : ""}
      </p>
      {(law.major === true || law.veto) && (
        <p className="m-0 flex flex-wrap gap-1.5">
          {law.major === true && (
            <span className={BADGE} title="One of David Mayhew’s important enactments">
              Major law
            </span>
          )}
          {law.veto && <span className={BADGE}>Veto override</span>}
        </p>
      )}
    </>
  );
}

const LABEL = "m-0 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-ink-faint";

/** The right-hand header column: the sponsor, then the cosponsors, in the committee header's label-above style. */
function SponsorColumn({ law }: { law: LawPageData }) {
  return (
    <aside aria-label="Sponsor and cosponsors" className="flex min-w-0 flex-col gap-4 border-t border-line pt-4 lg:w-[23rem] lg:flex-none lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
      <div className="flex flex-col gap-1">
        <p className={LABEL}>Sponsor</p>
        {law.sponsor ? (
          <p className="m-0">
            <span className="inline-flex items-center gap-1">
              <Dot party={law.sponsor.party} />
              <Person p={law.sponsor} />
            </span>
            {` (${law.sponsor.label})`}
          </p>
        ) : (
          <p className="m-0">Not recorded</p>
        )}
      </div>
      <CosponsorsHeader people={law.cosponsors} unresolved={law.cosponsorsUnresolved} withdrawn={law.withdrawn} />
    </aside>
  );
}

function Summary({ law }: { law: LawPageData }) {
  return (
    <ChartCard title="Summary" lede="The Congressional Research Service’s plain-language summary of what the law does.">
      {law.summary ? (
        <div className="flex flex-col gap-3 text-[0.9rem] leading-[1.65]">
          <SummaryBody paragraphs={law.summary} />
          {law.summaryCut && (
            <p className="m-0 text-[0.82rem] text-ink-muted">
              The summary is cut off here because it is long.{" "}
              {law.congressGovUrl && (
                <a href={law.congressGovUrl} target="_blank" rel="noreferrer" className={LINK}>
                  Read the full text on Congress.gov
                </a>
              )}
            </p>
          )}
        </div>
      ) : (
        <p className="m-0 text-[0.88rem] text-ink-muted">The Congressional Research Service has not written a summary of this law.</p>
      )}
    </ChartCard>
  );
}

function Timeline({ law }: { law: LawPageData }) {
  return (
    <ChartCard title="Timeline" lede={`From introduction to ${law.veto ? "the override" : "signing"}, newest first: the committees, the floor and the president. ${law.actions.length} actions.`}>
      <TimelineList actions={law.actions} />
      <MethodologyNote>
        {law.full ? (
          <p>Every action the Library of Congress lists for the bill, from introduction to signing, plus the dated committee hearings. The source lists many steps twice (the chamber’s own entry and the Library of Congress copy, or a presidential and a became-law entry with the same words); those are shown once. Amendments are listed in their own section.</p>
        ) : (
          <p>Shows the introduction, each committee and subcommittee step the source dates (referral, hearings, markup, report, discharge), and the floor, conference, presidential and became-law steps. Calendar placements, messages between the chambers, amendments and committee report numbers are not shown for laws of this Congress yet. Two entries the source lists twice are shown once.</p>
        )}
      </MethodologyNote>
    </ChartCard>
  );
}

function Amendments({ law }: { law: LawPageData }) {
  const n = law.amendments.length;
  return (
    <ChartCard title="Amendments" lede={n === 0 ? "No amendments to this bill are on record." : `${n} amendment${n === 1 ? "" : "s"} offered to the bill, with the last recorded step of each.`}>
      {n > 0 && (
        <AmendmentsList amendments={law.amendments} />
      )}
      <MethodologyNote>
        <p>Amendments offered to this bill in either chamber, as the Library of Congress records them: each with a status read from its last recorded step: agreed to, rejected, withdrawn, ruled out of order, fell with another amendment, or offered with no vote recorded (most Senate amendments are only ever offered). The wording of each amendment is the source’s. Amendments to amendments and amendments to other bills are not listed. {law.congress < 108 ? "For this Congress the source gives a one-line description rather than the sponsor and filing date." : ""}</p>
      </MethodologyNote>
    </ChartCard>
  );
}

function Related({ law }: { law: LawPageData }) {
  const n = law.related.length;
  return (
    <ChartCard title="Related bills" lede={n === 0 ? "The record lists no related bills." : `${n} bill${n === 1 ? "" : "s"} the Library of Congress relates to this one.`}>
      {n > 0 && <RelatedList related={law.related} />}
      <MethodologyNote>
        <p>Related bills are identified by the Congressional Research Service, the House and the Senate: companion and identical bills, bills with similar text, bills that were folded into this law, and rules that brought it to the floor. A bill that is itself a public law in this site’s data links here; the others link to Congress.gov.</p>
      </MethodologyNote>
    </ChartCard>
  );
}

/** Yea and nay are not party colours: the source holds totals only, so blue and red would read as Democrats and Republicans. */
const YEA = "var(--ink)";
const NAY = "var(--line-strong)";

const isCounted = (t: ChamberTally): boolean => t[0] === 0 && t[1] !== null && t[2] !== null;

function VoteRow({ chamber, t, label }: { chamber: string; t: ChamberTally; label?: string }) {
  const counted = t[0] === 0 && t[1] !== null && t[2] !== null;
  const share = yeaShare(t[1], t[2]);
  return (
    <li className="grid min-w-0 grid-cols-1 items-center gap-x-3 gap-y-1 py-1.5 text-[0.85rem] sm:w-[17rem] sm:grid-cols-[4.5rem_minmax(0,1fr)]">
      <span className="font-medium text-ink">{chamber}</span>
      <span className="min-w-0 text-ink-muted">
        {label ?? methodText(t)}
        {counted && <span className="sr-only">{`: ${t[1]} yea, ${t[2]} nay`}</span>}
      </span>
      {counted && share !== null ? (
        <span className="flex items-center gap-2 sm:col-span-2">
          <span aria-hidden className="flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-line">
            <span style={{ width: `${share * 100}%`, background: YEA }} />
            <span style={{ width: `${(1 - share) * 100}%`, background: NAY }} />
          </span>
          <span className="whitespace-nowrap tabular-nums text-ink">{`${t[1]}–${t[2]}`}</span>
        </span>
      ) : null}
    </li>
  );
}

/** The passage votes, in the page header under the facts. */
function Votes({ law }: { law: LawPageData }) {
  const { house, senate, override } = law.passage;
  // The Yea / Nay key only appears when a bar is drawn: a voice vote or unanimous consent has no count to colour.
  const hasBars = [house, senate].some(isCounted) || (override !== null && (override[0] !== null || override[2] !== null));
  return (
    <section aria-label="Passage votes" className="mt-1">
      <h2 className="m-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.72rem] font-medium uppercase tracking-[0.06em] text-ink-faint">
        <span>Passage votes</span>
        {hasBars && (
          <span className="inline-flex items-center gap-3 normal-case tracking-normal">
            <span className="inline-flex items-center gap-1.5">
              <i aria-hidden className="inline-block size-2 rounded-sm" style={{ background: YEA }} />
              Yea
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i aria-hidden className="inline-block size-2 rounded-sm" style={{ background: NAY }} />
              Nay
            </span>
          </span>
        )}
      </h2>
      <ul className="m-0 grid list-none grid-cols-2 gap-x-5 p-0 sm:flex sm:flex-wrap sm:gap-x-8">
        <VoteRow chamber="House" t={house} />
        <VoteRow chamber="Senate" t={senate} />
      </ul>
      {override && (
        <>
          <h3 className="mb-0 mt-3 text-[0.82rem] font-medium text-ink">Veto override votes</h3>
          <ul className="m-0 grid list-none grid-cols-2 gap-x-5 p-0 sm:flex sm:flex-wrap sm:gap-x-8">
            <VoteRow chamber="House" t={override[0] === null ? [3, null, null] : [0, override[0], override[1]]} label={override[0] === null ? "Not recorded" : "Needs two-thirds"} />
            <VoteRow chamber="Senate" t={override[2] === null ? [3, null, null] : [0, override[2], override[3]]} label={override[2] === null ? "Not recorded" : "Needs two-thirds"} />
          </ul>
        </>
      )}
      <MethodologyNote>
        <p>
          The final version of the law, as each chamber passed it. A chamber that passed it by voice vote or unanimous consent has no count. “Method not stated” means the record does not say how the chamber voted. Where the record has a member-by-member vote, the “Who voted for it” section shows who voted yea.
        </p>
      </MethodologyNote>
    </section>
  );
}

function CommitteeItem({ c }: { c: LawCommitteeEntry }) {
  return (
    <li className="flex items-start gap-2.5 border-b border-line px-3 py-2 text-[0.82rem] last:border-b-0">
      {c.chamber && <CommitteeSeal chamber={c.chamber} size={28} className="mt-px size-7" />}
      <div className="min-w-0">
      {c.path ? (
        <Link href={c.path} className={LINK}>
          {c.name}
        </Link>
      ) : (
        <span className="text-ink">{c.name}</span>
      )}
      {c.chamber && <span className="text-ink-faint">{` · ${c.chamber}`}</span>}
      {c.steps.length > 0 && <span className="text-ink-muted">{` · ${c.steps.join(", ")}`}</span>}
      {c.subcommittees.length > 0 && <span className="block text-[0.75rem] text-ink-muted">{`Subcommittee: ${c.subcommittees.join("; ")}`}</span>}
      </div>
    </li>
  );
}

function Committees({ law }: { law: LawPageData }) {
  return (
    <ChartCard title="Committees" lede={law.committees.length === 0 ? "The record shows no committee referral for this bill." : "The committees the bill was sent to, and what each did with it."}>
      {law.committees.length > 0 && <ul className="m-0 list-none rounded-md border border-line p-0">{law.committees.map((c, i) => <CommitteeItem key={`${c.name}-${i}`} c={c} />)}</ul>}
      <MethodologyNote>
        <p>A committee links to its page only where it exists in the current Congress; older and renamed committees are named without a link.</p>
      </MethodologyNote>
    </ChartCard>
  );
}

export function LawPageView({ law }: { law: LawPageData }) {
  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 pb-16 pt-9 sm:px-6 sm:pt-11">
      <SetBackLink href="/congress/laws" />
      <PageHeader eyebrow="Congress · Laws" title={law.title}>
        <div className="flex flex-col gap-5 lg:flex-row lg:gap-8">
          <div className="flex min-w-0 flex-col gap-3 lg:flex-1">
            <Facts law={law} />
            <Votes law={law} />
          </div>
          <SponsorColumn law={law} />
        </div>
      </PageHeader>
      <Summary law={law} />
      {law.votes.length > 0 && <LawVotesCard chambers={law.votes} congressLabel={ordinal(law.congress)} />}
      <Timeline law={law} />
      {law.full && <Amendments law={law} />}
      <Committees law={law} />
      {law.full && <Related law={law} />}
      <section aria-label="Official record" className="rounded-[10px] border border-line bg-surface p-[1.1rem_1.35rem] text-[0.85rem] text-ink-muted">
        <h2 className="m-0 font-serif text-[1.05rem] font-medium text-ink">Official record</h2>
        <p className="m-0 mt-1">
          {law.congressGovUrl ? (
            <>
              The bill’s full text{law.full ? "" : " and every action, including introduction and committee steps,"} {law.full ? "is" : "are"} on{" "}
              <a href={law.congressGovUrl} target="_blank" rel="noreferrer" className={LINK}>
                Congress.gov
              </a>
              .
            </>
          ) : (
            "The bill’s full record is on Congress.gov."
          )}{" "}
          Data through {longDate(law.dataThrough)}.
        </p>
      </section>
    </main>
  );
}
