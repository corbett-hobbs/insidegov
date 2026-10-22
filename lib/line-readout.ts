/**
 * Which lines a multi-line chart reports values for. A chart with a legend that isolates a line (`LegendToggle`,
 * `useIsolate`) lists every visible line as an equal row in its tooltip, header readout and phone readout; once one
 * line is isolated, that line is the only row, so no value of a hidden line is left on the card
 * (ARCHITECTURE_MAP "Page-level layout rules", rule 12e).
 */
export interface ReadoutLine<K extends string = string> {
  key: K;
  /** The line's name as the legend gives it, short enough for a header: "Regular", "Diesel". */
  label: string;
  /** The formatted value at the active date, or null when the line has no figure there. */
  value: string | null;
  /** Dropped while every line shows and this one has no figure (diesel before 1994). An isolated line always stays. */
  optional?: boolean;
}

/** The rows to print: just the isolated line, or every line that has something to say. */
export function readoutRows<L extends ReadoutLine>(lines: readonly L[], only: L["key"] | null): L[] {
  if (only !== null) {
    const picked = lines.filter((l) => l.key === only);
    if (picked.length > 0) return picked; // a pick that matches no line (a leftover) means nothing
  }
  return lines.filter((l) => !(l.optional && l.value === null));
}

/** "Regular $4.33", the form the phone readout (`PinLine.values`) takes; a missing figure prints a dash. */
export function rowValues(rows: readonly ReadoutLine[]): string[] {
  return rows.map((r) => `${r.label} ${r.value ?? "—"}`);
}

/** Whether a line is on the chart: everything is, until one is isolated. */
export function isShown<K extends string>(only: K | null, key: K): boolean {
  return only === null || only === key;
}
