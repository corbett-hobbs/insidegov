/**
 * The one size and shape of every pill on a case: outcome (Liberal / Conservative), Landmark, Overruled precedent, Struck down,
 * and how a justice voted. Colour is the only thing that differs, so they read as one family wherever they sit.
 */
export const PILL = "inline-flex max-w-full items-center whitespace-nowrap rounded-full border px-2 py-px align-baseline text-[0.7rem] font-medium leading-[1.35]";

/** The neutral pill (Landmark and the other facts about a case): a hairline border on the raised surface. */
export const PILL_NEUTRAL = `${PILL} border-line-strong bg-surface-raised text-ink-muted`;
