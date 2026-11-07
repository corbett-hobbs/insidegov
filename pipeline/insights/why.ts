import type { Insight, Why } from "./types";

/**
 * Why a number moved, written by hand for a draft, keyed by insight id. It takes the place of the researched answer
 * (research.ts) for that draft and follows the same rules: the agency's own release first, one or two short paragraphs
 * that name no agency or outlet (the sources are the footnote), words only apart from years, no verdicts on whether a policy worked. Most drafts need no entry here.
 */
const OCTOBER_2026_LAWS: Why = {
  title: "Why it rose, and what passed",
  captionLine: "NPR and CBS News tie the October 2025 figure to a shutdown and a House that stayed out.",
  paragraphs: [
    "Last October no public laws were enacted. That month fell during a government shutdown, when the House held no votes and funding bills did not clear the Senate.",
    "In October 2026 the President signed a series of bills, mostly narrow ones: public land transfers and park designations, tribal land and water measures, and agency reporting requirements.",
  ],
  sources: [
    { name: "NPR, shutdown talks in Congress, October 17, 2025", url: "https://www.npr.org/2025/10/17/nx-s1-5577136/government-shutdown-congress-trump" },
    { name: "CBS News, Senate votes fail again as shutdown drags on, October 2025", url: "https://www.cbsnews.com/live-updates/government-shutdown-latest-senate-votes-day-8/" },
    { name: "White House, bills signed into law October 20, 2026", url: "https://www.whitehouse.gov/briefings-statements/2026/10/congressional-bills-h-r-227-h-r-837-h-r-1721-h-r-2388-h-r-2481-h-r-3620-h-r-4307-h-r-4467-h-r-6380-and-h-r-7831-signed-into-law/" },
    { name: "White House, bills signed into law October 22, 2026", url: "https://www.whitehouse.gov/briefings-statements/2026/10/congressional-bills-h-r-952-and-h-r-7022-signed-into-law/" },
  ],
};

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
  // The gasoline and diesel news draft of November 3, 2026, whose research found no reason twice in a row. Worded as
  // "reports" so the text names no outlet and never says "both outlets"; the sources are the footnote. Drafts that day only.
  "news:gasoline:2026-11-03": {
    title: "Why it rose",
    captionLine: "CNBC and Fox Business tie it to the U.S.-Iran war and disrupted Hormuz shipping.",
    paragraphs: ["Gasoline and diesel are well above a year ago. Reports tie this to the U.S.-Iran war, which has disrupted oil shipping through the Strait of Hormuz, and crude oil rose again in October."],
    sources: [
      { name: "EIA Gasoline and Diesel Fuel Update, October 27, 2026", url: "https://www.eia.gov/petroleum/gasdiesel/" },
      { name: "CNBC, October 31, 2026", url: "https://www.cnbc.com/2026/10/31/trump-gas-diesel-price-midterm-election.html" },
      { name: "Fox Business, diesel record", url: "https://www.foxbusiness.com/politics/diesel-tops-6-fuel-shock-threatens-truckers-farmers-consumers" },
    ],
  },
  // The researched answer for the October 2026 laws post, kept word for word when the draft is regenerated. A month drafts
  // one post per series, and the new-high post outranks the latest-reading one, so both ids carry it.
  "laws.monthly:latest:2026-10-01": OCTOBER_2026_LAWS,
  "laws.monthly:extreme_high:2026-10-01": OCTOBER_2026_LAWS,
};

export function withWhy(insight: Insight): Insight {
  const why = WHY[insight.id];
  return why ? { ...insight, why } : insight;
}
