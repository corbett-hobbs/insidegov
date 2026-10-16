import type { Side, TimelinePayload, TlCongress, TlEvent, TlJustice, TlLean, TlPresident } from "./timeline-types";

/**
 * Pure logic behind /timeline ("Who Held Power When It Happened?"): who held the presidency, each chamber and the Court on
 * any date, the eras between changes of hands, the status of each event, and how event markers share space on the chart.
 * No I/O; unit-tested in `lib/timeline-derive.test.ts`.
 */

/** How the Court row and everything that follows it (strip, tiles, eras, notes) read the Court. */
export type CourtMode = "lean" | "appt";
/** D / R, "T" = the centre (lean) or an even split (appointed by), "N" = no lean score yet (before the October 1937 term). */
export type CourtSide = Side | "T" | "N";
/** all4: one party held the White House, both chambers and the Court; tri: the first three but not the Court; split: divided. */
export type PowerStatus = "all4" | "tri" | "split";

/** A median Martin-Quinn score within this distance of zero counts as the centre, on neither side. */
export const LEAN_CENTRE = 0.15;
/** A seat empty for less than this many days counts with the party of the justice who left it. */
export const VACANCY_DAYS = 183;
/** The first day on the timeline: Roosevelt's inauguration and the 73rd Congress. */
export const TIMELINE_START = "1933-03-04";

const DAY = 864e5;
const shift = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

/**
 * A seat left empty for under six months counts with the party of the justice who left it, so a summer vacancy doesn't
 * flip the Court's balance; a longer one (Scalia's, 2016-17) shows as the even split it was. Each departing justice is paired
 * with the next justice to join after them; a successor's start may fall a few days before the predecessor's recorded end
 * (Scalia began the day before Burger left), so a week's overlap is allowed or the pairing would slide down the line.
 */
export function applyVacancyRule(justices: readonly TlJustice[]): TlJustice[] {
  const out = justices.map((j) => ({ ...j }));
  const claimed = new Set<TlJustice>();
  for (const j of [...out].filter((x) => x.end).sort((a, b) => a.end!.localeCompare(b.end!))) {
    const next = out
      .filter((k) => !claimed.has(k) && k !== j && k.start >= shift(j.end!, -7))
      .sort((a, b) => a.start.localeCompare(b.start))[0];
    if (!next) continue;
    claimed.add(next);
    const gap = (Date.parse(next.start) - Date.parse(j.end!)) / DAY;
    if (gap > 1 && gap < VACANCY_DAYS) j.end = shift(next.start, -1);
  }
  return out;
}

/** The side a term's median falls on. */
export function leanSide(lean: TlLean | null): CourtSide {
  if (!lean) return "N";
  if (Math.abs(lean[1]) < LEAN_CENTRE) return "T";
  return lean[1] < 0 ? "D" : "R";
}

/** The party whose presidents appointed most of the sitting justices; "T" when they are even. */
export const apptSide = (c: { D: number; R: number }): CourtSide => (c.D > c.R ? "D" : c.R > c.D ? "R" : "T");

export interface CourtAt {
  D: number;
  R: number;
  seats: number;
  sitting: TlJustice[];
}

export interface PowerState {
  iso: string;
  pres: TlPresident;
  P: Side;
  S: Side;
  H: Side;
  C: CourtSide;
  cong: TlCongress;
  court: CourtAt;
  lean: TlLean | null;
  status: PowerStatus;
}

export const statusOf = (P: Side, S: Side, H: Side, C: CourtSide): PowerStatus => (P === S && S === H ? (C === P ? "all4" : "tri") : "split");

/** Lookups over one payload: who held each institution on a date. */
export function powerIndex(data: Pick<TimelinePayload, "presidents" | "congresses" | "justices" | "lean" | "today">) {
  const { presidents, congresses, justices, lean, today } = data;
  const presAt = (iso: string): TlPresident => presidents.find((p) => p.start <= iso && iso < (p.end ?? "9999")) ?? presidents[presidents.length - 1]!;
  const congAt = (iso: string): TlCongress => {
    let c = congresses[0]!;
    for (const x of congresses) if (x.start <= iso) c = x;
    return c;
  };
  const senMajAt = (iso: string): Side => {
    const c = congAt(iso);
    let p = c.senateMaj[0]![1];
    for (const [from, q] of c.senateMaj) if (from <= iso) p = q;
    return p;
  };
  const courtAt = (iso: string): CourtAt => {
    const sitting = justices.filter((j) => j.start <= iso && (!j.end || j.end >= iso));
    const n = { D: 0, R: 0 };
    for (const j of sitting) n[j.party]++;
    return { ...n, seats: sitting.length, sitting };
  };
  /** The term sitting on a date: a term opens in October. */
  const leanAt = (iso: string): TlLean | null => {
    const y = Number(iso.slice(0, 4));
    const term = Number(iso.slice(5, 7)) >= 10 ? y : y - 1;
    return lean.find((l) => l[0] === term) ?? null;
  };
  const stateAt = (iso: string, mode: CourtMode): PowerState => {
    const pres = presAt(iso);
    const cong = congAt(iso);
    const court = courtAt(iso);
    const l = leanAt(iso);
    const P = pres.party;
    const S = senMajAt(iso);
    const H = cong.houseMaj;
    const C = mode === "lean" ? leanSide(l) : apptSide(court);
    return { iso, pres, P, S, H, C, cong, court, lean: l, status: statusOf(P, S, H, C) };
  };
  return { presAt, congAt, senMajAt, courtAt, leanAt, stateAt, today };
}
export type PowerIndex = ReturnType<typeof powerIndex>;

/** Every date any institution changed hands (or a Court term opened), from the first day to today. */
export function changePoints(data: Pick<TimelinePayload, "presidents" | "congresses" | "justices" | "lean" | "today">): string[] {
  const { today } = data;
  const cuts = new Set([TIMELINE_START, today]);
  for (const p of data.presidents) cuts.add(p.start);
  for (const c of data.congresses) {
    cuts.add(c.start);
    for (const [from] of c.senateMaj) cuts.add(from);
  }
  for (const j of data.justices) {
    if (j.start > TIMELINE_START) cuts.add(j.start);
    if (j.end && j.end > TIMELINE_START && j.end < today) cuts.add(shift(j.end, 1));
  }
  for (const [term] of data.lean) cuts.add(`${term}-10-01`);
  return [...cuts].filter((c) => c >= TIMELINE_START && c <= today).sort();
}

export interface Span {
  from: string;
  /** Exclusive. */
  to: string;
  st: PowerState;
}

/** The timeline cut at every change point, each piece with who held power. */
export function buildSpans(idx: PowerIndex, cuts: readonly string[], mode: CourtMode): Span[] {
  const out: Span[] = [];
  for (let i = 0; i < cuts.length - 1; i++) out.push({ from: cuts[i]!, to: cuts[i + 1]!, st: idx.stateAt(cuts[i]!, mode) });
  return out;
}

export interface Era {
  from: string;
  to: string;
  st: PowerState;
  presidents: string[];
}

/** Neighbouring spans in which no institution changed sides, merged: one row of "Era by era" each. */
export function buildEras(spans: readonly Span[]): Era[] {
  const eras: (Era & { key: string })[] = [];
  for (const sp of spans) {
    const key = sp.st.P + sp.st.S + sp.st.H + sp.st.C;
    const last = eras[eras.length - 1];
    if (last && last.key === key) {
      last.to = sp.to;
      if (!last.presidents.includes(sp.st.pres.name)) last.presidents.push(sp.st.pres.name);
    } else eras.push({ key, from: sp.from, to: sp.to, st: sp.st, presidents: [sp.st.pres.name] });
  }
  return eras.map((e) => ({ from: e.from, to: e.to, st: e.st, presidents: e.presidents }));
}

/** Fractional year of an ISO date (2022-07-02 ≈ 2022.5). */
export function fracYear(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const t0 = Date.UTC(y, 0, 1);
  return y + (Date.UTC(y, m - 1, d) - t0) / (Date.UTC(y + 1, 0, 1) - t0);
}

/** The ISO date at a fractional year. */
export function isoOfFrac(fy: number): string {
  const y = Math.floor(fy);
  const t0 = Date.UTC(y, 0, 1);
  return new Date(t0 + (fy - y) * (Date.UTC(y + 1, 0, 1) - t0)).toISOString().slice(0, 10);
}

export type Kind = TlEvent["kind"];

/** Is the event inside the [lo, hi] calendar-year window? */
export const inYears = (e: { date: string }, lo: number, hi: number) => {
  const y = Number(e.date.slice(0, 4));
  return y >= lo && y <= hi;
};

export interface TileCount {
  status: PowerStatus;
  n: number;
  laws: number;
  cases: number;
  /** Share of the events counted, 0-1. */
  share: number;
}

/** The three status tiles: events of the shown kinds in the year window, by who held power that day. Every status keeps a tile. */
export function tileCounts(events: readonly TlEvent[], statusOfEvent: (e: TlEvent) => PowerStatus, kinds: ReadonlySet<Kind>, lo: number, hi: number): TileCount[] {
  const evs = events.filter((e) => kinds.has(e.kind) && inYears(e, lo, hi));
  const total = evs.length || 1;
  return (["all4", "tri", "split"] as const).map((status) => {
    const sub = evs.filter((e) => statusOfEvent(e) === status);
    const laws = sub.filter((e) => e.kind === "law").length;
    return { status, n: sub.length, laws, cases: sub.length - laws, share: sub.length / total };
  });
}

/** Years spent in each status inside the [lo, hi] window, for the chart's lede. */
export function yearsByStatus(spans: readonly Span[], lo: number, hi: number): Record<PowerStatus, number> {
  const out: Record<PowerStatus, number> = { all4: 0, tri: 0, split: 0 };
  for (const sp of spans) {
    const a = Math.max(fracYear(sp.from), lo);
    const b = Math.min(fracYear(sp.to), hi + 1);
    if (b > a) out[sp.st.status] += b - a;
  }
  return out;
}

const PL = { D: "Democrats", R: "Republicans" } as const;
const ADJ = { D: "Democratic", R: "Republican" } as const;

/** The status names, which follow the Court measure. */
export function statusNames(mode: CourtMode): Record<PowerStatus, { name: string; short: string }> {
  const lean = mode === "lean";
  return {
    all4: lean
      ? { name: "One party held the White House and Congress, and the Court leaned its way", short: "All four on one side" }
      : { name: "One party held all four", short: "One party held all four" },
    tri: {
      name: lean ? "One party held the White House and Congress; the Court didn't lean its way" : "One party held the White House and Congress, not the Court",
      short: "White House and Congress, not the Court",
    },
    split: { name: "Power was divided", short: "Power was divided" },
  };
}

/** One line on who held power in an era: "Democrats held the White House and Congress; a Court leaning conservative". */
export function eraLabel(st: Pick<PowerState, "P" | "S" | "H" | "C" | "status">, mode: CourtMode): string {
  const court =
    mode === "lean"
      ? { D: "a Court leaning liberal", R: "a Court leaning conservative", T: "a Court with its median at the centre", N: "a Court with no lean score yet (before 1937)" }[st.C]
      : st.C === "T" || st.C === "N"
        ? "a Court split evenly between the parties' appointees"
        : `a Court of mostly ${ADJ[st.C]} appointees`;
  if (st.status === "all4") return mode === "lean" ? `${PL[st.P]} held the White House and Congress, and the Court leaned ${st.P === "D" ? "liberal" : "conservative"}` : `${PL[st.P]} held all four`;
  if (st.status === "tri") return `${PL[st.P]} held the White House and Congress; ${court}`;
  if (st.S === st.H) return `${ADJ[st.P]} president, ${ADJ[st.S]} Congress; ${court}`;
  return `${ADJ[st.P]} president, ${ADJ[st.S]} Senate, ${ADJ[st.H]} House; ${court}`;
}

/** Every word typed must appear in the event's name, its line, its Wikipedia title or its year (accents and dash styles ignored). */
const norm = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[’‘]/g, "'");
export function matchesQuery(e: Pick<TlEvent, "name" | "what" | "wiki" | "date">, q: string): boolean {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = norm(`${e.name} ${e.what} ${e.wiki} ${e.date.slice(0, 4)}`);
  return words.every((w) => hay.includes(w));
}

/** Width of a bin, in px: markers in a lane sit at least two bins apart, since bins alternate between two sub-lanes. */
export const MARKER_BIN = 22;
const MARK_CHAR_W = 6.3;

export interface PlacedMarker<T> {
  items: T[];
  /** "22" for one event; "22+4" for event 22 and four more. */
  label: string;
  lane: 0 | 1;
  cx: number;
  w: number;
  /** Free px to the right before the next marker in the lane (for a name label). */
  room: number;
}

/**
 * Where the event markers of one row go. Fixed bins of `bin` px alternate between two sub-lanes, so markers in a lane
 * sit at least two bins apart and a group never spans more than one bin. A bin holding several events shows one marker,
 * "22+4"; a lone event sits at its exact date. Markers held in at the right edge push their lane neighbours left rather
 * than overlap them.
 */
export function placeMarkers<T extends { no: number }>(items: readonly { item: T; x: number }[], left: number, width: number, bin = MARKER_BIN): PlacedMarker<T>[] {
  const bins = new Map<number, { b: number; items: T[]; xs: number[] }>();
  for (const { item, x } of [...items].sort((a, b) => a.item.no - b.item.no)) {
    const b = Math.floor((x - left) / bin);
    if (!bins.has(b)) bins.set(b, { b, items: [], xs: [] });
    bins.get(b)!.items.push(item);
    bins.get(b)!.xs.push(x);
  }
  const placed = [...bins.values()].map((g) => {
    const n = g.items.length;
    const label = n === 1 ? String(g.items[0]!.no) : `${g.items[0]!.no}+${n - 1}`;
    const w = n === 1 ? 18 : label.length * MARK_CHAR_W + 10;
    const want = n === 1 ? g.xs[0]! : left + (g.b + 0.5) * bin;
    return { items: g.items, label, w, lane: (((g.b % 2) + 2) % 2) as 0 | 1, cx: Math.max(left + w / 2, Math.min(left + width - w / 2, want)), room: 0 };
  });
  for (const lane of [0, 1] as const) {
    const ms = placed.filter((p) => p.lane === lane).sort((a, b) => a.cx - b.cx);
    for (let i = ms.length - 2; i >= 0; i--) {
      const lim = ms[i + 1]!.cx - ms[i + 1]!.w / 2 - 3 - ms[i]!.w / 2;
      if (ms[i]!.cx > lim) ms[i]!.cx = lim;
    }
    ms.forEach((p, i) => {
      const right = i + 1 < ms.length ? ms[i + 1]!.cx - ms[i + 1]!.w / 2 : left + width;
      p.room = right - (p.cx + p.w / 2) - 8;
    });
  }
  return placed;
}

/** "Dobbs v. Jackson…" cut to `chars` characters with an ellipsis; whole when it fits. */
export function clipName(name: string, chars: number): string {
  return name.length <= chars ? name : `${name.slice(0, Math.max(1, chars - 1)).trimEnd()}…`;
}

/** The English Wikipedia address for an article title. */
export const wikiUrl = (title: string) =>
  `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_")).replace(/%2C/g, ",").replace(/%27/g, "'").replace(/%3A/g, ":")}`;

/** A president's last name ("George H. W. Bush" → "Bush"). */
export const lastName = (n: string) => n.replace(/ (Jr\.|Sr\.)$/, "").split(" ").pop()!;

/** Calendar years a president's term covers on a [first, last] axis; `end` is the successor's first day. */
export function termYears(p: Pick<TlPresident, "start" | "end">, first: number, last: number): [number, number] {
  return [Math.max(first, Number(p.start.slice(0, 4))), Math.min(last, p.end ? Number(p.end.slice(0, 4)) : last)];
}

const MONTHS = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];
/** "June 24, 2022". */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
/** "June 2022". */
export function fmtMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number) as [number, number];
  return `${MONTHS[m - 1]} ${y}`;
}

/** "D 50–50" / "R 53–47": the majority party, then its seats first. */
export const seatsLabel = (seats: readonly [number, number, number]) => (seats[0] >= seats[1] ? `${seats[0]}–${seats[1]}` : `${seats[1]}–${seats[0]}`);
