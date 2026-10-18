const BASE = "inline-flex max-w-full items-center border px-2 py-px align-baseline text-[0.7rem] font-medium leading-[1.35]";

/**
 * The one size and shape of every pill on a case: outcome (Liberal / Conservative), Landmark, Overruled precedent, Struck down,
 * and how a justice voted. Colour is the only thing that differs, so they read as one family wherever they sit.
 */
export const PILL = `${BASE} whitespace-nowrap rounded-full`;

/** The neutral pill (Landmark and the other facts about a case): a hairline border on the raised surface. */
export const PILL_NEUTRAL = `${PILL} border-line-strong bg-surface-raised text-ink-muted`;

/**
 * The Landmark pill: "Landmark" in the accent colour, then what the case concerned, in one pill so the topic never floats free of
 * the word that explains it. Same size as every pill; its words wrap inside it (never past the card's edge, never cut off).
 */
export const PILL_LANDMARK = "inline-block max-w-full rounded-2xl border border-[color-mix(in_oklab,var(--accent)_40%,var(--line-strong))] bg-surface-raised px-2 py-px align-baseline text-[0.7rem] font-medium leading-[1.35] text-ink-muted no-underline";
/** The word "Landmark" inside that pill. */
export const LANDMARK_WORD = "font-semibold text-[var(--accent)]";
