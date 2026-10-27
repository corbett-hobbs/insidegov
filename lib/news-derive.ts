import { LEANS, type FaqFile, type FaqSource, type Lean, type NewsHeadline, type NewsStory } from "./news-types";

/** Most stories the row shows. */
export const MAX_STORIES = 6;

/**
 * Outlets whose site icon is in `public/outlet-logos/<id>.png` (a test keeps this list and the folder in step). An outlet
 * not listed gets its initials in a small square instead. Icons are served from our own site, never hotlinked, so readers'
 * browsers never ask the publishers' servers for them.
 */
export const OUTLET_LOGO_IDS: ReadonlySet<string> = new Set([
  "bbc", "bls", "cbp", "cbsnews", "federalregister", "foxbusiness", "foxnews", "freddiemac", "guardian", "huffpost",
  "nbcnews", "nypost", "nytimes", "thehill", "treasury", "washingtonexaminer", "washingtontimes", "wsj",
]);

export const isLeftOfCenter = (lean: Lean) => lean === "Left" || lean === "Lean Left";
export const isRightOfCenter = (lean: Lean) => lean === "Lean Right" || lean === "Right";

/**
 * A story is shown only when it has at least one left-of-center and one right-of-center headline (the agency's data
 * release and a center outlet may sit beside them, up to three in all). A story one side headlined is not shown.
 */
export function isBalanced(headlines: readonly NewsHeadline[]): boolean {
  return headlines.length <= 3 && headlines.some((h) => isLeftOfCenter(h.lean)) && headlines.some((h) => isRightOfCenter(h.lean));
}

/** The data release first (the facts), then outlets from left to right; ties keep the file's order. */
export function orderHeadlines<T extends { lean: Lean }>(headlines: readonly T[]): T[] {
  return headlines.map((h, i) => ({ h, i })).sort((a, b) => LEANS.indexOf(a.h.lean) - LEANS.indexOf(b.h.lean) || a.i - b.i).map((x) => x.h);
}

/** Balanced stories only, newest first, at most `MAX_STORIES`, headlines ordered for display. */
export function selectStories(stories: readonly NewsStory[]): NewsStory[] {
  return stories
    .filter((s) => isBalanced(s.headlines))
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (a.s.date < b.s.date ? 1 : a.s.date > b.s.date ? -1 : a.i - b.i))
    .slice(0, MAX_STORIES)
    .map(({ s }) => ({ ...s, headlines: orderHeadlines(s.headlines) }));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-24" → "Oct 24". Computed from the string, so it never shifts with the reader's time zone. */
export function formatStoryDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

/** The file's `asOf` as "Oct 27" for the footnote; undefined when the file has none. */
export const updatedLabel = (asOf: string | undefined) => (asOf ? formatStoryDate(asOf) : undefined);

/** The outlet's initials for the square shown when it has no icon: "Washington Examiner" → "WE", at most three letters. */
export function outletInitials(outlet: string): string {
  const words = outlet.split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w) && !/^(the|of|and)$/i.test(w));
  return words.map((w) => w[0].toUpperCase()).join("").slice(0, 3) || outlet.slice(0, 2).toUpperCase();
}

/** A chart a question points to: the card's DOM id and the chip's label. */
export type QuestionChart = { target: string; label: string };
export type Question = { id: string; q: string; a: string; sources: FaqSource[]; charts: QuestionChart[] };
/** Questions grouped under the page's own row or section names, in the page's order. */
export type QuestionGroup = { row: string; items: Question[] };

/**
 * The FAQ file as the page shows it: each chart id goes through the page's `resolve` (null for an id the page does not
 * know, which drops that chip only; a question with no known chart is a general question, shown without chips).
 */
export function toQuestionGroups(file: FaqFile | null, resolve: (chartId: string) => QuestionChart | null): QuestionGroup[] {
  if (!file) return [];
  return file.groups
    .map((g) => ({
      row: g.row,
      items: g.items.map((it) => ({
        id: it.id,
        q: it.q,
        a: it.a,
        sources: it.sources,
        charts: it.chartIds.map(resolve).filter((c): c is QuestionChart => c !== null),
      })),
    }))
    .filter((g) => g.items.length > 0);
}

/** How many questions and stories point at one chart, for its "N questions · N in the news ↓" link. */
export function countsFor(target: string, stories: readonly { chart: { target: string } }[], groups: readonly QuestionGroup[]) {
  const questions = groups.flatMap((g) => g.items).filter((it) => it.charts.some((c) => c.target === target)).length;
  const news = stories.filter((s) => s.chart.target === target).length;
  return { questions, news };
}
