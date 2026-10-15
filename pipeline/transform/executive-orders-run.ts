import { readFile, writeFile, mkdir } from "node:fs/promises";
import { z } from "zod";
import {
  administration,
  eoTopicCacheEntry,
  executiveOrder,
  rawExecutiveOrder,
  type EoTopicCacheEntry,
} from "../../lib/executive-orders-entities";
import { existsSync } from "node:fs";
import { readEoTexts } from "../fetch/executive-order-texts";
import { RAW_DIR } from "../fetch/lib";
import { EO_SUMMARIES, checkedSummaries, eoSummaryCache } from "./eo-summaries";
import { ADMINISTRATIONS } from "./administrations";
import {
  ExecutiveOrderDataError,
  buildExecutiveOrders,
  normalizeRaw,
  validateExecutiveOrders,
} from "./executive-orders";

/**
 * Executive-orders track transform: raw/federal-register + the committed
 * classification cache -> pipeline/output/{executive_orders,administrations}.json
 * + executive_orders_report.json. The build never classifies: a topic missing
 * from the cache is fatal (see executive-orders.ts), never silently defaulted.
 * Summaries come from the committed cache `classification/eo_summaries.json`,
 * each re-checked against the order's text in raw/federal-register/executive_order_texts.json;
 * an order without a passing summary gets `summary: null`.
 */
export const RAW = `${RAW_DIR}/federal-register/executive_orders.json`;
export const CACHE = "pipeline/classification/eo_topics.json";
const OUT = "pipeline/output";

export async function readRaw() {
  const rows = JSON.parse(await readFile(RAW, "utf8")) as unknown[];
  return rows.map((row, i) => {
    const r = rawExecutiveOrder.safeParse(row);
    if (!r.success) throw new ExecutiveOrderDataError(`${RAW}: row ${i} fails the schema\n${z.prettifyError(r.error)}`);
    return r.data;
  });
}

export async function readCache(): Promise<Map<number, EoTopicCacheEntry>> {
  const rows = JSON.parse(await readFile(CACHE, "utf8")) as unknown[];
  const cache = new Map<number, EoTopicCacheEntry>();
  rows.forEach((row, i) => {
    const r = eoTopicCacheEntry.safeParse(row);
    if (!r.success) throw new ExecutiveOrderDataError(`${CACHE}: entry ${i} fails the schema\n${z.prettifyError(r.error)}`);
    if (cache.has(r.data.eo_number)) throw new ExecutiveOrderDataError(`${CACHE}: duplicate eo_number ${r.data.eo_number}`);
    cache.set(r.data.eo_number, r.data);
  });
  return cache;
}

export const oneRowPerLine = (rows: readonly unknown[]) =>
  rows.length === 0 ? "[]\n" : `[\n${rows.map((r) => JSON.stringify(r)).join(",\n")}\n]\n`;

async function main() {
  console.log("transform:executive-orders");
  const administrations = ADMINISTRATIONS.map((a) => administration.parse(a));
  const norm = normalizeRaw(await readRaw());
  const cached = existsSync(EO_SUMMARIES) ? eoSummaryCache.parse(JSON.parse(await readFile(EO_SUMMARIES, "utf8"))) : [];
  const texts = new Map([...readEoTexts()].map(([n, r]) => [n, r.text] as const));
  const { summaries, report: summaryReport } = checkedSummaries(cached, texts, new Set(norm.rows.map((r) => r.eo_number)));
  const rows = buildExecutiveOrders(norm, administrations, await readCache(), summaries).map((r) => executiveOrder.parse(r));
  const summary = validateExecutiveOrders(rows, administrations);

  const byMethod: Record<string, number> = {};
  for (const r of rows) byMethod[r.topic_method] = (byMethod[r.topic_method] ?? 0) + 1;

  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/administrations.json`, oneRowPerLine(administrations));
  await writeFile(`${OUT}/executive_orders.json`, oneRowPerLine(rows));
  await writeFile(
    `${OUT}/executive_orders_report.json`,
    JSON.stringify(
      {
        counts: { executive_orders: rows.length, administrations: administrations.length },
        signing_range: [summary.firstSigning, summary.lastSigning],
        dropped_not_an_eo: norm.droppedNoNumber,
        dropped_corrections: norm.droppedCorrections,
        out_of_order_numbering: summary.explainedOutOfOrder,
        anchors: { biden: summary.bidenCount, trump_2025: summary.trump2025Count, total_2025: summary.total2025 },
        topic_method: byMethod,
        needs_review: rows.filter((r) => r.needs_review).length,
        summaries: { ...summaryReport, without: rows.length - summaryReport.summarized },
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `  ${rows.length} executive orders ${summary.firstSigning}..${summary.lastSigning}; anchors ok (Biden ${summary.bidenCount}, Trump 2025 ${summary.trump2025Count}, 2025 total ${summary.total2025})`,
  );
  console.log(`  summaries: ${summaryReport.summarized} of ${rows.length} orders${summaryReport.failing_check.length ? `; ${summaryReport.failing_check.length} cached summaries fail the check and are not shown: ${summaryReport.failing_check.join(", ")}` : ""}`);
  console.log(`  dropped: ${norm.droppedNoNumber.length} non-EO, ${norm.droppedCorrections.length} correction/republication docs; topics by method ${JSON.stringify(byMethod)}`);
}

// Only run as a script (the classifier and validate import the helpers above).
if (process.argv[1]?.endsWith("executive-orders-run.ts")) {
  main().catch((err: unknown) => {
    console.error("\ntransform:executive-orders FAILED");
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
