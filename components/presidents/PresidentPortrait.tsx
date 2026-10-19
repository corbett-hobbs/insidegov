import type { PresidentRef } from "@/lib/president-types";

const SIZES = {
  sm: "h-[60px] w-12 text-[0.85rem]",
  lg: "h-[90px] w-[72px] text-[1.4rem] sm:h-[140px] sm:w-28 sm:text-[2rem]",
} as const;

/** The official portrait (public domain, `public/images/presidents/`), or the president's initials on a party tint when there is none. */
export function PresidentPortrait({ president, size }: { president: Pick<PresidentRef, "name" | "photo" | "party">; size: keyof typeof SIZES }) {
  const box = `${SIZES[size]} flex-none rounded-md border border-line-strong bg-surface-raised`;
  if (president.photo) {
    // A pre-sized static asset from public/ — next/image would add an optimizer this fully-static site deliberately doesn't run.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={president.photo} alt="" width={size === "lg" ? 112 : 48} height={size === "lg" ? 140 : 60} className={`${box} object-cover object-top`} />;
  }
  const initials = president.name.split(" ").filter((w) => /^[A-Z]/.test(w)).map((w) => w[0]).join("").slice(0, 3);
  return (
    <span aria-hidden className={`${box} flex items-center justify-center font-serif font-medium text-ink`} style={{ background: `color-mix(in oklab, var(${president.party === "D" ? "--dem" : "--rep"}) 18%, var(--surface))` }}>
      {initials}
    </span>
  );
}
