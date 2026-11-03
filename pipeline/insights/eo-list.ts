import { readFileSync } from "node:fs";
import { EO_TOPIC_LABELS, type EoTopic } from "../../lib/executive-orders-entities";
import { monthName } from "./format";
import { monthLaws } from "./laws-list";
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

/** `id` and `score` are a law's (laws-list.ts): its law id, and how widely the news covered it (0 = no coverage on record). */
export type ListedOrder = { id?: string; score?: number; number: number; title: string; date: string; topic: string; summary: string | null };

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

/** The monthly series that list the month's items (a term comparison lists none): executive orders, and laws (laws-list.ts). */
export type ListKind = "orders" | "laws";
const MONTHLY: Record<string, ListKind> = { "executive_orders.monthly": "orders", "laws.monthly": "laws" };
const NOUN: Record<ListKind, string> = { orders: "executive orders", laws: "laws" };

/** Which list a post carries: its month's executive orders or laws, null for any other insight. */
export function listKind(insight: Pick<Insight, "seriesId">): ListKind | null {
  return MONTHLY[insight.seriesId] ?? null;
}

/** The orders or laws a monthly insight lists (none for any other insight): every one signed in its period's month. Laws come most-covered-by-the-news first, then newest. */
export function insightOrders(insight: Pick<Insight, "seriesId" | "period">, limit = 200): ListedOrder[] {
  const kind = listKind(insight);
  if (!kind) return [];
  try {
    return kind === "laws" ? monthLaws(insight.period, limit) : ordersInMonth(readOrders(), insight.period, limit);
  } catch {
    return [];
  }
}

/** The slide's and card's title: "Executive orders signed in October", "Laws signed in October". */
export function ordersHeading(period: string, kind: ListKind = "orders"): string {
  return `${kind === "laws" ? "Laws" : "Executive orders"} signed in ${monthName(period)}`;
}

/** Said when the month has more than fit: where to see them all. */
export function moreNote(period: string, path: string, kind: ListKind = "orders"): string {
  return `To see all of ${monthName(period)}'s ${NOUN[kind]}, visit ${path}.`;
}

/** How the rows are ordered, as the slide and reply say it: laws the news covered come first, only when some row was. */
export function orderingNote(orders: readonly ListedOrder[], kind: ListKind = "orders"): string {
  return kind === "laws" && orders.some((o) => (o.score ?? 0) > 0) ? "Laws that more outlets covered come first, then the newest" : "Newest first";
}

/** The fine print under the rows: the order, and where each summary comes from. */
export function listFootnote(orders: readonly ListedOrder[], kind: ListKind = "orders"): string {
  return kind === "laws"
    ? `${orderingNote(orders, kind)}, by signing date. Summaries are the Congressional Research Service's, from Congress.gov.`
    : "Newest first, by signing date. Summaries are AI-written from each order's text in the Federal Register.";
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
export function ordersAlt(orders: ListedOrder[], period: string, kind: ListKind = "orders"): string {
  return `${ordersHeading(period, kind)}, ${orderingNote(orders, kind).toLowerCase()}.${orders.map((o) => `${o.title}, signed ${orderDate(o.date)}, ${o.topic || "no topic"}${o.summary ? `: ${o.summary}` : ""}`).join(" ")}`.slice(0, 1000);
}
