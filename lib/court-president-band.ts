import type { Administration } from "./executive-orders-entities";

/** One president's span on the court charts' term axis, ready for the term band under the axis. */
export interface CourtBandTerm {
  id: string;
  president: string;
  last: string;
  party: "D" | "R";
  /** Term-axis position of inauguration and of leaving office (clamped to the axis). */
  from: number;
  to: number;
}

/** A term `t` runs October `t` to June `t+1`, so the term axis reads calendar date `d` (a fractional year) as `d - 0.75`. */
const TERM_OFFSET = 0.75;

const fracYear = (iso: string): number => {
  const y = Number(iso.slice(0, 4));
  const start = Date.UTC(y, 0, 1);
  const end = Date.UTC(y + 1, 0, 1);
  return y + (Date.parse(`${iso}T00:00:00Z`) - start) / (end - start);
};

/**
 * The presidents who held office between the first and last term on the Court charts, as spans on the term axis (a sitting
 * president's `end` is null: they run to the axis's right edge). One entry per tenure; spans that fall wholly outside the axis are dropped.
 */
export function courtPresidentBand(admins: readonly Administration[], firstTerm: number, lastTerm: number): CourtBandTerm[] {
  const out: CourtBandTerm[] = [];
  for (const a of [...admins].sort((x, y) => x.start.localeCompare(y.start))) {
    const from = Math.max(firstTerm, fracYear(a.start) - TERM_OFFSET);
    const to = Math.min(lastTerm, a.end === null ? lastTerm : fracYear(a.end) + 1 / 365 - TERM_OFFSET);
    if (to <= from) continue;
    out.push({ id: a.term_id, president: a.president, last: a.president.split(" ").pop() ?? a.president, party: a.party === "Democratic" ? "D" : "R", from, to });
  }
  return out;
}
