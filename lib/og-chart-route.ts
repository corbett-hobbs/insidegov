import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { chartImagePath, chartsOf } from "./og-charts";
import { pageMetadata } from "./seo";

/**
 * The two exports every `app/<page>/chart/[chart]/page.tsx` needs (the route renders the page itself, see
 * `lib/og-charts.ts`): the chart ids to prerender, and metadata that is the page's own with the chart's title and image.
 * The canonical stays the page.
 */
type PageModule = { metadata?: Metadata; generateMetadata?: () => Metadata | Promise<Metadata> };

export function chartParams(page: string): { chart: string }[] {
  return chartsOf(page).map((c) => ({ chart: c.id }));
}

export async function chartMetadata(page: string, mod: PageModule, params: Promise<{ chart: string }>): Promise<Metadata> {
  const { chart } = await params;
  const entry = chartsOf(page).find((c) => c.id === chart);
  if (!entry) notFound();
  const base = mod.generateMetadata ? await mod.generateMetadata() : (mod.metadata ?? {});
  const description = typeof base.description === "string" ? base.description : "";
  return pageMetadata({
    title: entry.title,
    description,
    path: page,
    image: { url: chartImagePath(page, chart), alt: `${entry.title}: a chart from InsideGov` },
  });
}
