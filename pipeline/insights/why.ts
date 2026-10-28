import type { Insight, Why } from "./types";

/**
 * Why a number moved, written by hand for a draft, keyed by insight id. It takes the place of the researched answer
 * (research.ts) for that draft and follows the same rules: the agency's own release first, one or two short paragraphs
 * that name no agency or outlet (the sources are the footnote), words only apart from years, no verdicts on whether a policy worked. Most drafts need no entry here.
 */
export const WHY: Record<string, Why> = {
  "energy.power_total:extreme_high:2026-08-01": {
    title: "Why it went up",
    captionLine: "EIA cites warmer weather and expects data centers to keep lifting use.",
    paragraphs: [
      "Hot weather raised air-conditioning demand in nearly every state, and natural gas plants supplied most of the extra power.",
      "Over the past year solar has added the most while coal has fallen, and electricity use is expected to keep setting highs as data centers grow.",
    ],
    sources: [
      { name: "EIA Electricity Monthly Update, October 2026", url: "https://www.eia.gov/electricity/monthly/update/" },
      { name: "EIA Short-Term Energy Outlook, September 2026", url: "https://www.eia.gov/pressroom/releases/press592.php" },
    ],
  },
};

export function withWhy(insight: Insight): Insight {
  const why = WHY[insight.id];
  return why ? { ...insight, why } : insight;
}
