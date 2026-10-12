"use client";

/** Tiny filter box that sits on the right of a list's grey header line (member and committee lists). */
export function ListSearch({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search"
      aria-label={label}
      className="h-6 w-28 rounded border border-line-strong bg-surface-raised px-2 text-[0.72rem] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
    />
  );
}
