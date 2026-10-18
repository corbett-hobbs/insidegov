const BASE = "inline-flex max-w-full items-center border px-2 py-px align-baseline text-[0.7rem] font-medium leading-[1.35]";

/**
 * The one size and shape of every pill on a case: outcome (Liberal / Conservative), Landmark, Overruled precedent, Struck down,
 * and how a justice voted. Colour is the only thing that differs, so they read as one family wherever they sit.
 */
export const PILL = `${BASE} whitespace-nowrap rounded-full`;

/** The neutral pill (Landmark and the other facts about a case): a hairline border on the raised surface. */
export const PILL_NEUTRAL = `${PILL} border-line-strong bg-surface-raised text-ink-muted`;

/**
 * A neutral pill whose words can be long (a landmark's topic, "Discrimination based on sexual orientation or gender identity").
 * Same size and colour; it wraps onto a second line inside the pill, never past the card's edge, and never cuts the words off.
 */
export const PILL_TOPIC = `${BASE} rounded-2xl border-line-strong bg-surface-raised text-left text-ink-muted`;
