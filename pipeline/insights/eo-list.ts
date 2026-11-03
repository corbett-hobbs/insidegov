import { readFileSync } from "node:fs";
import { EO_TOPIC_LABELS, type EoTopic } from "../../lib/executive-orders-entities";
import { monthName } from "./format";
import type { Insight } from "./types";

/**
 * The executive orders listed on a monthly executive-order post's slide and thread card ("Executive orders signed in
 * October"): the orders signed in the post's month, and only those (a month with three lists three, never the month
 * before to fill the room), newest first, each with its title, signing date, topic and short summary, as many as fit the
 * surface (fitOrders). A month with more than fit says where to see them all (moreNote). The rows are the committed
 * output file's own (title, date, topic, the AI-written summary the Executive Orders page shows with its disclosure);
 * nothing here is computed, so the cards add no number a caption could get wrong. The file is read from the working
 * tree, so a backfill against an older git ref lists the same orders as long as the month filter holds.
 */

const FILE = "pipeline/output/executive_orders.json";

export type ListedOrder = { number: number; title: string; date: string; topic: string; summary: string | null };

type Row = { eo_number: number; title: string; signing_date: string; topic?: string; summary?: string | null };

const cache = new Map<string, ListedOrder[]>();

/** Every order in the file, newest signing first (ties: the higher number first). */
export function readOrders(file = FILE): ListedOrder[] {
  const hit = cache.get(file);
  if (hit) return hit;
  const rows = JSON.parse(readFileSync(file, "utf8")) as Row[];
  const orders = rows
    .map((r) => ({
      number: r.eo_number,
      title: r.title.trim(),
      date: r.signing_date,
      topic: EO_TOPIC_LABELS[r.topic as EoTopic] ?? "",
      summary: r.summary?.trim() || null,
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.number - a.number);
  cache.set(file, orders);
  return orders;
}

/** The newest `limit` orders signed in the month that `date` falls in. */
export function ordersInMonth(all: ListedOrder[], date: string, limit: number): ListedOrder[] {
  const month = date.slice(0, 7);
  return all.filter((o) => o.date.startsWith(month)).slice(0, limit);
}

/** The monthly executive-order series' id: the monthly post is the one that lists the month's orders (a term comparison does not). */
const MONTHLY = "executive_orders.monthly";

/** The orders a monthly executive-order insight lists (none for any other insight): every one signed in its period's month. */
export function insightOrders(insight: Pick<Insight, "seriesId" | "period">, limit = 200): ListedOrder[] {
  if (insight.seriesId !== MONTHLY) return [];
  try {
    return ordersInMonth(readOrders(), insight.period, limit);
  } catch {
    return [];
  }
}

/** The slide's and card's title: "Executive orders signed in October". */
export function ordersHeading(period: string): string {
  return `Executive orders signed in ${monthName(period)}`;
}

/** Said when the month has more orders than fit: where to see them all. */
export function moreNote(period: string, path: string): string {
  return `To see all of ${monthName(period)}'s executive orders, visit ${path}.`;
}

/** "Oct 19, 2026". */
export function orderDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/**
 * How a surface sets a row, for estimating how many fit: characters per line of the title and of the summary, their
 * line heights, the height of the date-and-topic line (`stacked` above the title, else in a column beside the text), the gap
 * under a row, the height available for all rows, and the height the "see all" note takes when some orders are left out. Satori cannot measure text, so the estimate leaves a margin.
 */
export type OrderLayout = { titleChars: number; titleLine: number; summaryChars: number; summaryLine: number; metaH: number; stacked: boolean; gap: number; budget: number; reserve: number };

const lines = (text: string, perLine: number) => Math.max(1, Math.ceil(text.length / perLine));

export function rowHeight(o: ListedOrder, l: OrderLayout): number {
  const text = lines(o.title, l.titleChars) * l.titleLine + (o.summary ? lines(o.summary, l.summaryChars) * l.summaryLine : 0);
  return (l.stacked ? text + l.metaH : Math.max(text, l.metaH)) + l.gap;
}

function fitWithin(orders: ListedOrder[], l: OrderLayout, budget: number): ListedOrder[] {
  const out: ListedOrder[] = [];
  let used = 0;
  for (const o of orders) {
    const h = rowHeight(o, l);
    if (out.length && used + h > budget) break;
    out.push(o);
    used += h;
  }
  return out;
}

/**
 * The leading orders that fit the layout's height (always at least one), still newest first. When not all fit, the
 * rows leave room for the "see all" note (moreNote), so the caller shows it exactly when `result.length < orders.length`.
 */
export function fitOrders(orders: ListedOrder[], l: OrderLayout): ListedOrder[] {
  const all = fitWithin(orders, l, l.budget);
  return all.length === orders.length ? all : fitWithin(orders, l, l.budget - l.reserve);
}

/** The portrait slide's rows (carousel.tsx): date and topic above the title, the summary under it. */
export const SLIDE_ORDERS: OrderLayout = { titleChars: 48, titleLine: 29, summaryChars: 74, summaryLine: 22, metaH: 22, stacked: true, gap: 24, budget: 640, reserve: 34 };

/** The thread card's rows (thread-charts.tsx): date and topic in a column beside the title and summary. */
export const CARD_ORDERS: OrderLayout = { titleChars: 50, titleLine: 33, summaryChars: 80, summaryLine: 25, metaH: 50, stacked: false, gap: 20, budget: 452, reserve: 30 };

/** What the card says, for its alt text and the reply under it. */
export function ordersAlt(orders: ListedOrder[], period: string): string {
  return `${ordersHeading(period)}, newest first. ${orders.map((o) => `${o.title}, signed ${orderDate(o.date)}, ${o.topic || "no topic"}${o.summary ? `: ${o.summary}` : ""}`).join(" ")}`.slice(0, 1000);
}
