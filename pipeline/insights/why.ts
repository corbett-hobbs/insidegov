import type { Insight, Why } from "./types";

/**
 * Why a number moved, written by hand for a draft, keyed by insight id. It takes the place of the researched answer
 * (research.ts) for that draft and follows the same rules: the agency's own release first, words only apart from years,
 * no verdicts on whether a policy worked. Most drafts need no entry here.
 */
export const WHY: Record<string, Why> = {
  "energy.power_total:extreme_high:2026-08-01": {
    title: "Why it went up",
    captionLine: "EIA cites warmer weather and expects data centers to keep lifting use.",
    paragraphs: [
      "Hot weather. EIA's monthly review says August was warmer than a year earlier across most of the country, with more air-conditioning demand in nearly every state, and generation rose in all seven regions.",
      "Natural gas plants supplied most of the extra power over last August. EIA reports gas generation rose in every region except Texas.",
      "Over the past year, solar has added the most, while coal generation has fallen.",
      "Looking ahead, EIA expects U.S. electricity use to keep setting annual highs in 2026 and 2027, with data centers a growing share of demand.",
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
