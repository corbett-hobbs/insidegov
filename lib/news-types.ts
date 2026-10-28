import { z } from "zod";

/**
 * The contract for the page-level "In the news" and "Frequently asked questions" sections: the shape of
 * `pipeline/output/news_<page>.json` and `faq_<page>.json` (page = `economy` | `immigration` | `energy` | `trade`), which the news and FAQ
 * pipelines write and `lib/news-data.ts` reads. Pure (no `server-only`), so the pipelines' tests and the unit tests can import it.
 *
 * `chartId` / `chartIds` are the DOM id of the card a story or question is about (a story may have none):
 *  - Economy: `chart-<key>` for a key of `SPECS` (`chart-gas`, `chart-mort`, `chart-def`, `chart-debt`, `chart-infl`, `chart-un` …),
 *    plus `chart-diesel` for the gas card's diesel line.
 *  - Immigration: `chart-green-cards`, `chart-refugees`, `chart-encounters`, `chart-removals`.
 *  - Energy (FAQ only): `electricity`, `supply`, `oil`, `lng`, `spr`.
 *  - Trade (FAQ only): `trade-balance`, `tariffs`, `who-the-u-s-trades-with`, `what-the-u-s-trades`, `did-tariffs-shift-trade`.
 * An id the page does not know is dropped (the story or the chip), never an error. The sparkline, latest value and its date
 * caption come from the page's own chart data, not from these files.
 */

/** AllSides Media Bias Rating of the outlet's news coverage, as published; "Data" marks an agency's own data release. */
export const LEANS = ["Data", "Left", "Lean Left", "Center", "Lean Right", "Right"] as const;
export type Lean = (typeof LEANS)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const newsHeadline = z.object({
  /** Key of the outlet's site icon in `public/outlet-logos/<outletId>.png` (see `OUTLET_LOGO_IDS`); lowercase letters and digits. */
  outletId: z.string().regex(/^[a-z0-9]+$/),
  /** The outlet's display name. */
  outlet: z.string().min(1),
  lean: z.enum(LEANS),
  title: z.string().min(1),
  url: z.url(),
});
export type NewsHeadline = z.infer<typeof newsHeadline>;

export const newsStory = z.object({
  id: z.string().min(1),
  /** The story's date (the data release or the first headline), YYYY-MM-DD; shown as "Oct 24". */
  date: isoDate,
  /** A plain topic in our words, never a take: "Diesel prices". */
  topic: z.string().min(1),
  /** The chart the story is about; absent for a story the page has no chart for (the card shows headlines over a plain wash). */
  chartId: z.string().min(1).optional(),
  /** At most three; see `hasEnoughOutlets` for what a story needs to be shown. */
  headlines: z.array(newsHeadline).min(1).max(3),
});
export type NewsStory = z.infer<typeof newsStory>;

export const newsFile = z.object({
  /** When the file was last built, YYYY-MM-DD (empty in the file shipped before a pipeline has run). */
  asOf: z.union([isoDate, z.literal("")]),
  stories: z.array(newsStory),
});
export type NewsFile = z.infer<typeof newsFile>;

export const faqSource = z.object({ label: z.string().min(1), url: z.url() });
export type FaqSource = z.infer<typeof faqSource>;

export const faqItem = z.object({
  id: z.string().min(1),
  q: z.string().min(1),
  a: z.string().min(1),
  sources: z.array(faqSource),
  chartIds: z.array(z.string().min(1)),
});
export type FaqItem = z.infer<typeof faqItem>;

export const faqGroup = z.object({
  /** The page's own row or section name, in the page's order ("Everyday costs", "Refugees"). */
  row: z.string().min(1),
  items: z.array(faqItem).min(1),
});
export type FaqGroup = z.infer<typeof faqGroup>;

export const faqFile = z.object({
  asOf: z.union([isoDate, z.literal("")]),
  groups: z.array(faqGroup),
});
export type FaqFile = z.infer<typeof faqFile>;

export type NewsPage = "economy" | "immigration" | "energy" | "trade";
