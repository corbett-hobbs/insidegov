"use client";

import { FilterCaption } from "./FilterBarParts";

export interface PartyOption<T extends string> {
  id: T;
  label: string;
}

/**
 * The Party dropdown in a pinned filter bar (Demographics, Wealth, Laws): one pick or "All parties" (`null`), a controlled select with no state
 * of its own. The options are the page's to name ("Democrats"); the accent border says a party is picked, like `MultiSelectFilter`. It carries its
 * own mono caption ("Party", or "Sponsor" on Laws, where the party is the bill's sponsor's) from `sm`, as every dropdown in a pinned bar does (rule 5d); on phones
 * the caption is read by screen readers only, so the bar stays one row.
 */
export function PartyFilter<T extends string>({
  value,
  onChange,
  options,
  label = "Party",
  ariaLabel,
  allLabel = "All parties",
  className = "flex-none",
  selectClassName = "",
}: {
  value: T | null;
  onChange: (party: T | null) => void;
  options: readonly PartyOption<T>[];
  /** The caption beside the select (also its accessible name). */
  label?: string;
  /** The select's accessible name where the caption is shorter than the question ("Sponsor" / "Sponsor party"); defaults to the caption. */
  ariaLabel?: string;
  /** The empty option's text; "All parties" by default. */
  allLabel?: string;
  /** The caption-and-select wrapper: `flex-none` by default; a phone row that splits between controls sets its basis here. */
  className?: string;
  /** Sizes the select itself, e.g. `flex-1 sm:w-[8.5rem] sm:flex-none`. */
  selectClassName?: string;
}) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${className}`}>
      <FilterCaption>{label}</FilterCaption>
      <select
        aria-label={ariaLabel ?? label}
        value={value ?? ""}
        onChange={(e) => onChange((e.target.value || null) as T | null)}
        className={`min-w-0 rounded-md border bg-surface-raised px-[0.55rem] py-[0.42rem] text-[0.8rem] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${value ? "border-accent" : "border-line-strong"} ${selectClassName}`}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
