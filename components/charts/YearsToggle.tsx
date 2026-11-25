"use client";

import { track } from "@/lib/analytics";
import { sameRange } from "@/lib/year-range";

/**
 * The link beside a page's year slider that flips between every year and the modern era (`defaultYearRange`, 2017 on). Its text is
 * what a tap does: "Since 2017" while every year is shown, "All years" otherwise (a hand-picked window included). It is always
 * there, so both views are one tap apart. On phones the two words stack, so the track keeps its width.
 */
export function YearsToggle({
  value,
  full,
  recent,
  sinceYear = recent[0],
  onChange,
}: {
  /** The window shown now, the whole slider, and the modern-era window, all in the slider's own units. */
  value: readonly [number, number];
  full: readonly [number, number];
  recent: readonly [number, number];
  /** The year the label names, where the slider's units are not years. */
  sinceYear?: number;
  onChange: (next: [number, number]) => void;
}) {
  const showingAll = sameRange(value, full);
  if (showingAll && sameRange(recent, full)) return null;
  const [first, second] = showingAll ? ["Since", String(sinceYear)] : ["All", "years"];
  return (
    <button
      type="button"
      onClick={() => {
        track("filter_change", { control: "Years toggle", value: showingAll ? "recent" : "all" });
        onChange(showingAll ? [recent[0], recent[1]] : [full[0], full[1]]);
      }}
      className="mt-0.5 flex-none cursor-pointer text-center font-sans text-[0.8rem] font-medium leading-tight text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:whitespace-nowrap sm:leading-none"
    >
      <span className="block sm:inline">{first}</span> <span className="block sm:inline">{second}</span>
    </button>
  );
}
