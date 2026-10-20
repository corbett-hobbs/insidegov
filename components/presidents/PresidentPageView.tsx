"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SetBackLink } from "@/components/BackLinkContext";
import { MethodologyNote } from "@/components/MethodologyNote";
import { SourceLink } from "@/components/SourceLink";
import { dateLabel, ordinalWord, termYears } from "@/lib/president-derive";
import { congressTakeaway, fmtInt, panelTakeaway, tenureText } from "@/lib/president-format";
import { presidentPath, PRESIDENTS_PATH } from "@/lib/president-url";
import type { PresidentPageData, SeriesCardId, SeriesPanel } from "@/lib/president-types";
import { CongressCard, EosCard, JusticesCard, LawsCard, SeriesCard, type PresidentLite } from "./PresidentCards";
import { PresidentTimelineCard } from "./PresidentTimelineCard";
import { PresidentPortrait } from "./PresidentPortrait";
import { MAJOR_LAW_DEFINITION, MAJOR_LIST_NOTE, MORE, NOTES } from "./notes";

/** Previous / next president: a small round portrait (initials when there is none) beside the name, shown as the surname so the row fits the header's 500px identity column on one line. */
function NeighbourLink({ president, dir }: { president: NonNullable<PresidentPageData["prev"]>; dir: "prev" | "next" }) {
  const thumb = president.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={president.photo} alt="" width={28} height={28} className="size-7 flex-none rounded-full border border-line-strong object-cover object-top" />
  ) : (
    <span aria-hidden className="flex size-7 flex-none items-center justify-center rounded-full border border-line-strong font-serif text-[0.7rem] text-ink" style={{ background: `color-mix(in oklab, var(${president.party === "D" ? "--dem" : "--rep"}) 18%, var(--surface))` }}>
      {president.name.split(" ").filter((w) => /^[A-Z]/.test(w)).map((w) => w[0]).join("").slice(0, 2)}
    </span>
  );
  const label = (
    <span className="truncate underline decoration-line-strong underline-offset-2 group-hover:decoration-accent">
      {president.last}
    </span>
  );
  return (
    <Link href={presidentPath(president.slug)} aria-label={`${dir === "prev" ? "Previous" : "Next"} president: ${president.name}`} className="group inline-flex min-w-0 items-center gap-1.5 font-medium text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
      {dir === "prev" && <span aria-hidden>←</span>}
      {thumb}
      {label}
      {dir === "next" && <span aria-hidden>→</span>}
    </Link>
  );
}

const LINK = "font-medium text-accent underline decoration-line-strong underline-offset-2 hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

function Row({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="m-0 flex items-center gap-3 font-mono text-[0.68rem] font-medium uppercase tracking-[0.08em] text-ink-muted">
        {label}
        <span aria-hidden className="h-px flex-1 bg-line" />
      </h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:grid-rows-[repeat(4,auto)] md:gap-y-0">{children}</div>
    </section>
  );
}

/**
 * A count tile. With `tip`, the label explains itself: a hover or focus popover on desktop (the label is dotted-underlined), and a
 * small "?" button on a phone that opens the same text on tap and closes on a tap elsewhere.
 */
function Stat({ value, label, note, tip }: { value: string; label: string; note?: string; tip?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={box} className="group relative flex min-w-0 flex-col gap-0.5 rounded-[8px] border border-line bg-surface px-3 py-2.5">
      <span className="font-serif text-[1.2rem] font-medium leading-none tabular-nums text-ink sm:text-[1.55rem]">{value}</span>
      <span className="flex items-start gap-1 text-[0.78rem] leading-tight text-ink-muted">
        <span tabIndex={tip ? 0 : undefined} className={tip ? "md:cursor-help md:underline md:decoration-dotted md:decoration-line-strong md:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" : undefined}>
          {label}
        </span>
        {tip && (
          <button
            type="button"
            aria-label={`What is this? ${label}`}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="flex size-4 flex-none items-center justify-center rounded-full border border-line-strong font-mono text-[0.62rem] leading-none text-ink-muted md:hidden"
          >
            ?
          </button>
        )}
      </span>
      {note && <span className="text-[0.68rem] leading-tight text-ink-faint">{note}</span>}
      {tip && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 w-max max-w-[15rem] -translate-x-1/2 rounded-md border border-line-strong bg-surface px-3 py-2 text-[0.72rem] leading-snug text-ink-muted shadow-[0_8px_24px_rgba(26,34,51,0.22)] md:group-focus-within:visible md:group-focus-within:opacity-100 md:group-hover:visible md:group-hover:opacity-100 ${open ? "visible opacity-100" : "invisible opacity-0"}`}
        >
          {tip}
        </span>
      )}
    </div>
  );
}

const partyWord = (p: "D" | "R") => (p === "D" ? "Democrat" : "Republican");
const longDate = (iso: string) => dateLabel(iso).replace(/^(\w{3})/, (m) => ({ Jan: "January", Feb: "February", Mar: "March", Apr: "April", May: "May", Jun: "June", Jul: "July", Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December" })[m] ?? m);

/** Card ids for each themed pair, in page order; their takeaways and Data notes. */
const SERIES_ROWS: { label: string; id: string; cards: [SeriesCardId, SeriesCardId] }[] = [
  { label: "Economy", id: "economy", cards: ["misery", "fiscal"] },
  { label: "Immigration", id: "immigration", cards: ["arrivals", "removals"] },
  { label: "The U.S. and the world", id: "world", cards: ["trade", "aid"] },
  { label: "Security and energy", id: "security", cards: ["troops", "spr"] },
];

const TITLES: Record<SeriesCardId, string> = {
  misery: "Misery index",
  fiscal: "Federal deficit and debt",
  arrivals: "Green cards and refugees",
  removals: "Removals and border encounters",
  trade: "Goods trade balance",
  aid: "Foreign aid",
  troops: "Troops abroad",
  spr: "Strategic Petroleum Reserve",
};

function seriesTakeaway(id: SeriesCardId, panels: SeriesPanel[], data: PresidentPageData): string {
  const [p] = panels;
  switch (id) {
    case "misery":
      return panelTakeaway(p, p.id === "misery" ? "The misery index (unemployment plus inflation)" : "The unemployment rate");
    case "fiscal":
      return p.id === "deficit" ? panelTakeaway(p, "The federal budget balance, as a share of GDP,") : panelTakeaway(p, "Total public debt");
    case "arrivals":
      return panelTakeaway(p, p.id === "lpr" ? "New green cards" : "Refugee admissions", "numbered");
    case "removals":
      return panelTakeaway(p, p.id === "removals" ? "Removals" : "Border encounters", "numbered");
    case "trade":
      return panelTakeaway(p, "The monthly goods trade balance");
    case "aid":
      return `${panelTakeaway(p, "Foreign aid disbursed", "came to")}${data.aidTop ? ` ${data.aidTop.name} received the most in ${data.aidTop.years} of those years.` : ""}`;
    case "troops":
      return `${panelTakeaway(p, "Troops stationed abroad", "numbered")}${data.troopsTop ? ` ${data.troopsTop.name} hosted the most in ${data.troopsTop.years} of those years.` : ""}`;
    case "spr":
      return panelTakeaway(p, "The reserve", "held");
  }
}

function justicesTakeaway(data: PresidentPageData): string {
  const js = data.justices;
  if (js.length === 0) return `${data.president.name} appointed no justices.`;
  const names = [...js].reverse().map((j) => `${j.name.split(" ").pop()} (${j.elevated ? "elevated to chief justice, " : ""}${j.nominated.slice(0, 4)})`);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  const n = js.filter((j) => !j.elevated).length;
  return `${data.president.name} ${n === 0 ? "made one appointment" : `appointed ${n === 1 ? "one justice" : `${n} justices`}`}${js.some((j) => j.elevated) && n > 0 ? " and elevated one" : ""}: ${list}.`;
}

/**
 * One president's page: identity header, headline counts, then themed pairs of cards, each a series from another page
 * clipped to the time in office. A card with no data for the term is left out; its partner then spans the row (rule 10r).
 */
export function PresidentPageView({ data }: { data: PresidentPageData }) {
  const p = data.president;
  const lite: PresidentLite = { name: p.name, last: p.last, party: p.party };
  const first = p.terms[0];
  const last = p.terms[p.terms.length - 1];
  const serving = last.end === null;
  const ordinals = p.terms.map((t) => ordinalWord(t.ordinal)).join(" and ");

  const eosTakeaway = data.eos
    ? `Signed ${fmtInt(data.eos.total)} executive orders${data.eos.topics[0] ? `; the most common topic was ${data.eos.topics[0].label.toLowerCase()} (${fmtInt(data.eos.topics[0].n)})` : ""}.`
    : "";

  const early = data.earlyMajor.length;
  const majorTotal = data.laws?.major == null && early === 0 ? null : (data.laws?.major ?? 0) + early;
  const majorNote =
    majorTotal === null
      ? data.timeline
        ? "Landmark laws below"
        : data.laws
          ? "Not yet assessed"
          : "Data starts 1947"
      : first.start < "1947-01-03"
        ? "From 1947"
        : data.laws?.majorPartial
          ? "Later term not yet assessed"
          : undefined;
  const majorCount = (data.laws?.majorList.length ?? 0) + data.earlyMajor.length;
  const majorPart = data.laws?.majorPartial ? ` Laws after the ${ordinalWord(data.laws.majorThrough)} Congress are not yet assessed.` : "";
  const lawsCardTakeaway = data.laws
    ? `Signed ${fmtInt(data.laws.signed)} laws${first.start < "1973-01-03" ? " from 1973, when the site's full record of laws begins" : ""}${data.laws.overridden ? `; Congress enacted ${fmtInt(data.laws.overridden)} more over a veto` : ""}.${majorCount > 0 ? ` ${fmtInt(majorCount)} major laws${first.start < "1973-01-03" ? " over the whole time in office" : ""} are listed with how each passed the House and Senate.` : ""}${majorPart}`
    : `${fmtInt(majorCount)} of the laws ${p.last} signed are major laws, listed newest first with how each passed the House and Senate. The site's full record of laws starts in 1973, so earlier years show the major laws only.`;

  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-7 px-4 pb-16 pt-9 sm:px-6 sm:pt-11">
      <SetBackLink href={PRESIDENTS_PATH} />

      <header className="flex flex-col gap-4">
        {/* Same layout as the member and justice headers: portrait and identity on the left (500px from lg), the Wikipedia lead on the right. */}
        <div className={data.bio ? "flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-0" : "flex flex-row items-start gap-4 sm:gap-6"}>
          <div className={`flex min-w-0 flex-col gap-4 ${data.bio ? "lg:w-[500px] lg:flex-none" : ""}`}>
            <div className="flex flex-row items-start gap-4 sm:gap-6">
              <PresidentPortrait president={p} size="lg" />
              <div className="min-w-0">
              <p className="mb-1.5 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-ink-faint">President</p>
              <h1 className="mb-1.5 font-serif text-[clamp(2rem,4vw,2.8rem)] font-semibold leading-[1.05] tracking-[-0.01em]">{p.name}</h1>
              <p className="text-[1rem] text-ink-muted">
                <span aria-hidden className="mr-1.5 inline-block size-[0.55rem] rounded-full align-middle" style={{ background: `var(${p.party === "D" ? "--dem" : "--rep"})` }} />
                {ordinals.replace(/^./, (c) => c.toUpperCase())} president · {partyWord(p.party)}
              </p>
              <p className="mt-1.5 text-[0.9rem] text-ink-muted">{p.terms.map((t) => `${longDate(t.start)} – ${t.end ? longDate(t.end) : "present"}`).join("; ")}</p>
              </div>
            </div>
            <nav aria-label="Other presidents" className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-x-6">
            {data.prev && <NeighbourLink president={data.prev} dir="prev" />}
            {data.next && <NeighbourLink president={data.next} dir="next" />}
            <Link href={PRESIDENTS_PATH} className={`${LINK} whitespace-nowrap`}>
              All presidents
            </Link>
            </nav>
          </div>
          {data.bio && (
            <section aria-label="About" className="border-t border-line pt-4 lg:min-w-0 lg:flex-1 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <div className="flex flex-col gap-1.5 lg:h-full lg:justify-center">
                <p className="flex-none font-mono text-[0.72rem] uppercase tracking-[0.12em] text-ink-faint">About</p>
                <p className="font-serif text-[1.0625rem] leading-[1.35] text-ink lg:text-[1.3rem] lg:leading-[1.4]">{data.bio.extract}</p>
                <p className="flex-none text-xs leading-[1.4] text-ink-muted ">
                  From{" "}
                  <a href={data.bio.url} rel="noopener" className="text-accent underline underline-offset-2">
                    Wikipedia
                  </a>{" "}
                  (text may be abridged), licensed under{" "}
                  <a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="noopener" className="text-accent underline underline-offset-2">
                    CC BY-SA 4.0
                  </a>
                  .
                </p>
              </div>
            </section>
          )}
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat value={tenureText(data.days)} label={serving ? "In office so far" : "In office"} note={`${fmtInt(data.days)} days`} />
        <Stat
          value={majorTotal === null ? "—" : fmtInt(majorTotal)}
          label="Major laws signed"
          tip={MAJOR_LAW_DEFINITION}
          note={majorNote}
        />
        <Stat value={String(data.justices.filter((j) => !j.elevated).length)} label="Justices appointed" note={data.justices.some((j) => j.elevated) ? "plus one elevated to chief" : undefined} />
      </div>

      <Row label="Who held power" id="power">
        <CongressCard congress={data.congress} takeaway={congressTakeaway(data.congress, p.party)} notes={NOTES.congress} more={MORE.congress} />
        <JusticesCard justices={data.justices} takeaway={justicesTakeaway(data)} notes={NOTES.justices} more={MORE.justices} />
      </Row>

      {(data.laws || majorCount > 0 || data.timeline) && (
        <Row label="Laws" id="laws">
          {data.timeline && <PresidentTimelineCard p={p} timeline={data.timeline} />}
          {(data.laws || majorCount > 0) && (
            <LawsCard
              title="Laws signed"
              takeaway={lawsCardTakeaway}
              count={data.laws ? { panel: data.laws.panel, coverage: data.laws.coverage, breakdown: data.laws.groups } : null}
              president={lite}
              major={data.laws?.majorList ?? []}
              early={data.earlyMajor}
              listNote={MAJOR_LIST_NOTE}
              notes={
                <>
                  {data.laws && NOTES.laws(data.laws.dataThrough)}
                  {majorCount > 0 && NOTES.major}
                </>
              }
              more={MORE.laws}
            />
          )}
        </Row>
      )}

      {SERIES_ROWS.map((row) => {
        const present = row.cards.filter((id) => data.cards[id]);
        if (present.length === 0) return null;
        const slots = Math.max(...present.map((id) => data.cards[id]!.length));
        return (
          <Row key={row.id} label={row.label} id={row.id}>
            {present.map((id) => (
              <SeriesCard
                key={id}
                title={TITLES[id]}
                takeaway={seriesTakeaway(id, data.cards[id]!, data)}
                panels={data.cards[id]!}
                slots={slots}
                wide={present.length === 1}
                president={lite}
                notes={NOTES[id]}
                more={MORE[id]}
              />
            ))}
          </Row>
        );
      })}

      {data.eos && (
        <Row label="Executive orders" id="orders">
          <EosCard
            title="Executive orders signed"
            takeaway={eosTakeaway}
            panel={data.eos.panel}
            coverage={data.eos.coverage}
            breakdown={data.eos.topics}
            orders={data.eos.orders}
            president={lite}
            notes={NOTES.eos}
            more={MORE.eos}
          />
        </Row>
      )}

      <MethodologyNote className="-mb-3">
      
        <p>
          Each card takes a series from one of the site&rsquo;s Presidency, Congress or Supreme Court pages and shows only the time {p.last} was in office{p.terms.length > 1 ? ", each term on its own" : ""}. Monthly figures run from the month of the inauguration to the month the term ended{serving ? " (or the latest month published)" : ""}; a fiscal or calendar year counts for the president who held office for most of its days. Cards whose data begins after {termYears(first).slice(0, 4)} say where it starts, and a card with no data for the term is left out.
        </p>
        <p>
          These are conditions during a presidency, not a scorecard. Congress, the courts, the Federal Reserve, the business cycle and events abroad move every one of these numbers, and many policies take effect years after they are signed, so a change during a term is not a measure of what the president caused.
        </p>
      
      </MethodologyNote>

      <p className="m-0 text-[0.8rem] leading-[1.6] text-ink-muted">
        Source: the site&rsquo;s Presidency, Congress and Supreme Court data, each named in its card&rsquo;s Data notes; party control of Congress from the <SourceLink id="house-party-division">House</SourceLink> and <SourceLink id="senate-party-division">Senate</SourceLink> historians; appointments from the <SourceLink id="fjc">Federal Judicial Center</SourceLink>. Portrait: public domain, via <SourceLink href={data.bio?.photoSource ?? "https://commons.wikimedia.org/"}>Wikimedia Commons</SourceLink>. Built {longDate(data.asOf)}.
      </p>
    </main>
  );
}
