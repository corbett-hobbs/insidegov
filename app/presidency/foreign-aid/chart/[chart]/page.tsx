import * as page from "../../page";
import { chartMetadata, chartParams } from "@/lib/og-chart-route";

/** `/presidency/foreign-aid/chart/<card id>`: this page under one chart's own link preview (`lib/og-charts.ts`). */
const PAGE = "/presidency/foreign-aid";

export const dynamicParams = false;

export function generateStaticParams() {
  return chartParams(PAGE);
}

export function generateMetadata({ params }: { params: Promise<{ chart: string }> }) {
  return chartMetadata(PAGE, page, params);
}

export { default } from "../../page";
