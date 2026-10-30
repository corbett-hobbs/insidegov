import * as page from "../../page";
import { chartMetadata, chartParams } from "@/lib/og-chart-route";

/** `/presidency/executive-orders/chart/<card id>`: this page under one chart's own link preview (`lib/og-charts.ts`). */
const PAGE = "/presidency/executive-orders";

export const dynamicParams = false;

export function generateStaticParams() {
  return chartParams(PAGE);
}

export function generateMetadata({ params }: { params: Promise<{ chart: string }> }) {
  return chartMetadata(PAGE, page, params);
}

export { default } from "../../page";
