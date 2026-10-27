import type { Insight, Why } from "./types";

/**
 * Why a number moved, for the carousel's "why" slide (carousel.tsx), keyed by insight id. Written by hand for now, from
 * the agency's own release first and other neutral sources after it (never advocacy groups or commentary). Words only,
 * apart from years: a figure here would not be checked against the data (the breakdown slide carries the numbers), and
 * no verdicts on whether a policy worked. A draft with no entry falls back to the "How to read this" slide.
 */
export const WHY: Record<string, Why> = {
  "energy.power_total:extreme_high:2026-08-01": {
    title: "Why it went up",
    paragraphs: [
      "Hot weather. EIA's monthly review says August was warmer than a year earlier across most of the country, with more air-conditioning demand in nearly every state, and generation rose in all seven regions.",
      "Natural gas plants supplied most of the extra power over last August. EIA reports gas generation rose in every region except Texas.",
      "Over the past year, solar has added the most, while coal generation has fallen.",
      "Looking ahead, EIA expects U.S. electricity use to keep setting annual highs in 2026 and 2027, with data centers a growing share of demand.",
    ],
    sources: ["EIA Electricity Monthly Update, October 2026", "EIA Short-Term Energy Outlook, September 2026"],
  },
};

export function withWhy(insight: Insight): Insight {
  const why = WHY[insight.id];
  return why ? { ...insight, why } : insight;
}
