"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SetBackLink } from "@/components/BackLinkContext";
import { HowToRead } from "@/components/HowToRead";
import { PageHeader } from "@/components/PageHeader";
import { PageShortcuts } from "@/components/PageShortcuts";
import { SourceLink } from "@/components/SourceLink";
import { dateLabel, ordinalWord, termYears } from "@/lib/president-derive";
import { congressTakeaway, fmtInt, panelTakeaway, tenureText } from "@/lib/president-format";
import { presidentPath, PRESIDENTS_PATH } from "@/lib/president-url";
import type { PresidentPageData, SeriesCardId, SeriesPanel } from "@/lib/president-types";
import { CongressCard, CountCard, JusticesCard, MajorLawsCard, SeriesCard, type PresidentLite } from "./PresidentCards";
import { PresidentPortrait } from "./PresidentPortrait";
import { MORE, NOTES } from "./notes";

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

function Stat({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-[8px] border border-line bg-surface px-3 py-2.5">
      <span className="font-serif text-[1.2rem] font-medium leading-none tabular-nums text-ink sm:text-[1.55rem]">{value}</span>
      <span className="text-[0.78rem] leading-tight text-ink-muted">{label}</span>
      {note && <span className="text-[0.68rem] leading-tight text-ink-faint">{note}</span>}
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

  const lawsTakeaway = data.laws
    ? `Signed ${fmtInt(data.laws.signed)} laws${data.laws.major !== null ? `, ${fmtInt(data.laws.major)} of them major laws` : ""}${data.laws.overridden ? `. Congress enacted ${fmtInt(data.laws.overridden)} more over a veto` : ""}.`
    : "";
  const eosTakeaway = data.eos
    ? `Signed ${fmtInt(data.eos.total)} executive orders${data.eos.topics[0] ? `; the most common topic was ${data.eos.topics[0].label.toLowerCase()} (${fmtInt(data.eos.topics[0].n)})` : ""}.`
    : "";

  const counts = [data.laws ? "laws" : null, data.eos ? "eos" : null].filter(Boolean);

  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-7 px-4 pb-16 pt-9 sm:px-6 sm:pt-11">
      <SetBackLink href={PRESIDENTS_PATH} />

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        <span className="hidden sm:block">
          <PresidentPortrait president={p} size="lg" />
        </span>
        <div className="min-w-0 flex-1">
          <PageHeader
            eyebrow="Presidency · Presidents"
            title={
              <span className="flex items-center gap-3">
                <span className="sm:hidden">
                  <PresidentPortrait president={p} size="sm" />
                </span>
                {p.name}
              </span>
            }
          >
            <p className="text-ink">
              <span aria-hidden className="mr-1.5 inline-block size-[0.55rem] rounded-full align-middle" style={{ background: `var(${p.party === "D" ? "--dem" : "--rep"})` }} />
              {ordinals.replace(/^./, (c) => c.toUpperCase())} president · {partyWord(p.party)} ·{" "}
              {p.terms.map((t) => `${longDate(t.start)} – ${t.end ? longDate(t.end) : "present"}`).join("; ")}
            </p>
            {data.bio && (
              <p>
                {data.bio.extract}{" "}
                <span className="text-[0.8rem]">
                  (<SourceLink href={data.bio.url}>Wikipedia</SourceLink>, <SourceLink href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</SourceLink>)
                </span>
              </p>
            )}
            <HowToRead>
              <p>
                Each card takes a series from one of the site&rsquo;s Presidency, Congress or Supreme Court pages and shows only the time {p.last} was in office{p.terms.length > 1 ? ", each term on its own" : ""}. Monthly figures run from the month of the inauguration to the month the term ended{serving ? " (or the latest month published)" : ""}; a fiscal or calendar year counts for the president who held office for most of its days. Cards whose data begins after {termYears(first).slice(0, 4)} say where it starts, and a card with no data for the term is left out.
              </p>
              <p>
                These are conditions during a presidency, not a scorecard. Congress, the courts, the Federal Reserve, the business cycle and events abroad move every one of these numbers, and many policies take effect years after they are signed, so a change during a term is not a measure of what the president caused.
              </p>
            </HowToRead>
            <PageShortcuts>
              <p>
                <Link href={PRESIDENTS_PATH} className={LINK}>
                  All presidents
                </Link>
              </p>
              {data.prev && (
                <p>
                  <Link href={presidentPath(data.prev.slug)} className={LINK}>
                    ← {data.prev.name}
                  </Link>
                </p>
              )}
              {data.next && (
                <p>
                  <Link href={presidentPath(data.next.slug)} className={LINK}>
                    {data.next.name} →
                  </Link>
                </p>
              )}
            </PageShortcuts>
          </PageHeader>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat value={tenureText(data.days)} label={serving ? "In office so far" : "In office"} note={`${fmtInt(data.days)} days`} />
        <Stat value={data.laws ? fmtInt(data.laws.signed) : "—"} label="Laws signed" note={data.laws ? data.laws.coverage : "Data starts 1973"} />
        <Stat value={data.eos ? fmtInt(data.eos.total) : "—"} label="Executive orders" note={data.eos ? data.eos.coverage : "Data starts 1994"} />
        <Stat value={String(data.justices.filter((j) => !j.elevated).length)} label="Justices appointed" note={data.justices.some((j) => j.elevated) ? "plus one elevated to chief" : undefined} />
      </div>

      <Row label="Who held power" id="power">
        <CongressCard congress={data.congress} takeaway={congressTakeaway(data.congress, p.party)} notes={NOTES.congress} more={MORE.congress} />
        <JusticesCard justices={data.justices} takeaway={justicesTakeaway(data)} notes={NOTES.justices} more={MORE.justices} />
      </Row>

      {counts.length > 0 && (
        <Row label="Laws and orders" id="laws">
          {data.laws && (
            <CountCard
              title="Laws signed"
              takeaway={lawsTakeaway}
              panel={data.laws.panel}
              coverage={data.laws.coverage}
              slots={1}
              breakdown={data.laws.groups}
              breakdownLabel="By policy area"
              president={lite}
              notes={NOTES.laws(data.laws.dataThrough)}
              more={MORE.laws}
              wide={counts.length === 1}
            />
          )}
          {data.eos && (
            <CountCard
              title="Executive orders"
              takeaway={eosTakeaway}
              panel={data.eos.panel}
              coverage={data.eos.coverage}
              slots={1}
              breakdown={data.eos.topics}
              breakdownLabel="By topic"
              president={lite}
              notes={NOTES.eos}
              more={MORE.eos}
              wide={counts.length === 1}
            />
          )}
          {data.laws && data.laws.majorList.length > 0 && (
            <MajorLawsCard
              laws={data.laws.majorList}
              takeaway={`${fmtInt(data.laws.majorList.length)} of the laws ${p.last} signed are counted as important enactments, newest first, with how each passed the House and Senate.${data.laws.majorPartial ? ` Laws after the ${ordinalWord(data.laws.majorThrough)} Congress are not yet assessed.` : ""}`}
              notes={NOTES.major}
              more={MORE.major}
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

      <p className="m-0 text-[0.8rem] leading-[1.6] text-ink-muted">
        Source: the site&rsquo;s Presidency, Congress and Supreme Court data, each named in its card&rsquo;s Data notes; party control of Congress from the <SourceLink id="house-party-division">House</SourceLink> and <SourceLink id="senate-party-division">Senate</SourceLink> historians; appointments from the <SourceLink id="fjc">Federal Judicial Center</SourceLink>. Portrait: public domain, via <SourceLink href={data.bio?.photoSource ?? "https://commons.wikimedia.org/"}>Wikimedia Commons</SourceLink>. Built {longDate(data.asOf)}.
      </p>
    </main>
  );
}
