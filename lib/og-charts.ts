import manifest from "./og-charts.json";

/**
 * Link-preview images for individual charts, shared by the server (`app/<page>/chart/[chart]`), the share menu
 * (`components/charts/ChartShare.tsx`) and the generator (`scripts/og-charts.ts`). Pure data, no I/O.
 *
 * A preview is built from the URL's path, never its `#anchor`, and reading the query in `generateMetadata` would make
 * the page dynamic, so a chart's share link goes to a static route: `<page>/chart/<card id>` (for example
 * `/presidency/trade/chart/trade-balance?country=CAN#trade-balance`). It renders the same page, with that chart's image
 * as its preview; the filters and the anchor ride along. The image is a screenshot of the chart's own card in its default
 * view, taken from the built site (`pnpm og:charts`), so every chart is covered without a per-chart builder.
 */

/** Every page whose charts have share cards. Each has `app/<page>/chart/[chart]/page.tsx` (checked by `lib/og-charts.test.ts`). */
export const CHART_PAGES = [
  "/congress/demographics",
  "/congress/laws",
  "/congress/wealth",
  "/presidency/economy",
  "/presidency/energy",
  "/presidency/executive-orders",
  "/presidency/foreign-aid",
  "/presidency/immigration",
  "/presidency/trade",
  "/presidency/troops-abroad",
  "/supreme-court/decisions",
  "/supreme-court/ideology",
  "/supreme-court/justices",
  "/timeline",
] as const;
export type ChartPage = (typeof CHART_PAGES)[number];

export interface ChartEntry {
  /** The card's anchor (`ChartShare` gives every card one). */
  id: string;
  /** The card's title at the default view. */
  title: string;
}

/** The charts the generator found on each page, in page order (`lib/og-charts.json`, written by `pnpm og:charts`). */
export const CHARTS = manifest.pages as Partial<Record<string, ChartEntry[]>>;

export const chartSlug = (page: string) => page.replace(/^\//, "").replace(/\//g, "-");

/** Where a chart's image lives (`public/og-charts/...`). */
export const chartImagePath = (page: string, id: string) => `/og-charts/${chartSlug(page)}/${id}.png`;

export const chartsOf = (page: string): ChartEntry[] => CHARTS[page] ?? [];

/**
 * The path to share for a chart card: its chart route when the page has an image for it, else the current path.
 * Works from the page or from another chart's route.
 */
export function chartSharePath(pathname: string, cardId: string): string {
  const page = pathname.replace(/\/chart\/[^/]+$/, "");
  return chartsOf(page).some((c) => c.id === cardId) ? `${page}/chart/${cardId}` : page;
}
