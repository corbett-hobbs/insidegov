import { dateOfDay, dayOf, MONTH_ABBR } from "@/lib/indicator-time";

export interface TimeTick {
  day: number;
  label: string;
  /** January ticks (the year) read as major when months are shown between them. */
  major: boolean;
}

/**
 * x-axis ticks for a day-indexed window `[vs, ve)` drawn `pw` px wide. At full width they are years
 * (every 1, 2, 5 or 10); once zoomed so a year is wide enough, they become months (every 1, 2, 3 or 6),
 * with January printing the year so the reader never loses which year they are in.
 */
export function timeAxisTicks(vs: number, ve: number, pw: number): TimeTick[] {
  const yearsShown = (ve - vs) / 365.25;
  const pxPerYear = pw / yearsShown;
  const monthStep = [1, 2, 3, 6].find((m) => (pxPerYear / 12) * m >= 34);
  const ticks: TimeTick[] = [];
  if (monthStep !== undefined) {
    const start = dateOfDay(vs);
    for (let y = start.year; dayOf(y, 0, 1) < ve; y++) {
      for (let m = 0; m < 12; m += monthStep) {
        const d = dayOf(y, m, 1);
        if (d >= vs && d < ve) ticks.push({ day: d, label: m === 0 ? String(y) : MONTH_ABBR[m], major: m === 0 });
      }
    }
    return ticks;
  }
  const step = [1, 2, 5, 10].find((s) => pxPerYear * s >= 42 && !(s === 2 && yearsShown > 20)) ?? 10;
  for (let y = dateOfDay(vs).year; dayOf(y, 0, 1) < ve; y++) {
    if (y % step === 0 && dayOf(y, 0, 1) >= vs) ticks.push({ day: dayOf(y, 0, 1), label: String(y), major: true });
  }
  return ticks;
}
