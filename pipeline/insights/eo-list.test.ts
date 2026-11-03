import { describe, expect, it } from "vitest";
import { loadAdministrations, loadExecutiveOrders } from "./datasets";
import { eventInsightsAt } from "./collect";
import { slidePlan } from "./carousel";
import { CARD_ORDERS, SLIDE_ORDERS, type ListedOrder, fitOrders, insightOrders, moreNote, ordersHeading, ordersInMonth } from "./eo-list";
import { breakdownCardCount, planThread } from "./thread";

const order = (n: number, date: string, summary: string | null = "Directs an agency to do something within 30 days."): ListedOrder => ({ number: n, title: `Order ${n}`, date, topic: "Foreign policy", summary });

describe("executive order list", () => {
  it("lists only the orders signed in the month, newest first, never the month before to fill room", () => {
    const all = [order(4, "2026-11-02"), order(3, "2026-10-19"), order(2, "2026-10-16"), order(1, "2026-09-29")];
    expect(ordersInMonth(all, "2026-10-01", 5).map((o) => o.number)).toEqual([3, 2]);
    expect(ordersInMonth(all, "2026-10-31", 1).map((o) => o.number)).toEqual([3]);
    expect(ordersInMonth(all, "2026-08-01", 5)).toEqual([]);
  });

  it("fits as many as the surface holds, in order, and always at least one", () => {
    const many = Array.from({ length: 12 }, (_, i) => order(12 - i, `2026-10-${String(20 - i).padStart(2, "0")}`));
    for (const layout of [SLIDE_ORDERS, CARD_ORDERS]) {
      const fit = fitOrders(many, layout);
      expect(fit.length).toBeGreaterThan(1);
      expect(fit.length).toBeLessThan(many.length);
      expect(fit.map((o) => o.number)).toEqual(many.slice(0, fit.length).map((o) => o.number));
    }
    const long = { ...order(1, "2026-10-01"), summary: "x ".repeat(3000) };
    expect(fitOrders([long], SLIDE_ORDERS)).toHaveLength(1);
    expect(fitOrders([], SLIDE_ORDERS)).toEqual([]);
  });

  it("lists orders only for an executive-order insight, from the committed data", () => {
    expect(insightOrders({ seriesId: "gas.regular", period: "2026-10-01" })).toEqual([]);
    // The quarterly term comparison is about the term, not the month: no list.
    expect(insightOrders({ seriesId: "executive_orders", period: "2026-09-30" })).toEqual([]);
    // The month's orders as the file has them (the data keeps growing, so compare with the file, not a fixed list).
    const october = insightOrders({ seriesId: "executive_orders.monthly", period: "2026-10-01" });
    expect(october.map((o) => o.number)).toEqual(expect.arrayContaining([14437, 14436, 14435]));
    expect(october.every((o) => o.date.startsWith("2026-10"))).toBe(true);
    const orders = insightOrders({ seriesId: "executive_orders.monthly", period: "2026-09-01" });
    expect(orders.length).toBeGreaterThan(3);
    expect(orders.every((o) => o.date.startsWith("2026-09"))).toBe(true);
    expect(orders.every((o, i) => i === 0 || o.date <= orders[i - 1]!.date)).toBe(true);
  });

  it("names the month, and says where to see the rest only when orders are left out", () => {
    expect(ordersHeading("2026-10-01")).toBe("Executive orders signed in October");
    expect(moreNote("2026-09-01", "insidegov.fyi/presidency/executive-orders")).toBe("To see all of September's executive orders, visit insidegov.fyi/presidency/executive-orders.");
    const sept = insightOrders({ seriesId: "executive_orders.monthly", period: "2026-09-01" });
    for (const layout of [SLIDE_ORDERS, CARD_ORDERS]) {
      // Too many for the page: some are left out, and the rows that stay leave room for the note.
      expect(fitOrders(sept, layout).length).toBeLessThan(sept.length);
    }
    // Few enough: every one shows and nothing is reserved.
    const three = sept.slice(0, 3).map((o) => ({ ...o, summary: "Short." }));
    expect(fitOrders(three, SLIDE_ORDERS)).toHaveLength(3);
  });

  it("gives an executive-order post a bar per month, a slide and a thread card", () => {
    const set = loadExecutiveOrders();
    const [insight] = eventInsightsAt(set, loadAdministrations(), ["2026-10-31"]).filter((i) => i.seriesId === "executive_orders.monthly");
    expect(insight).toBeDefined();
    expect(insight!.chart.type).toBe("bars");
    if (insight!.chart.type === "bars") {
      expect(insight!.chart.bars.length).toBeGreaterThan(12);
      expect(insight!.chart.bars.at(-1)!.label).toBe("Oct ’26");
    }
    const slides = slidePlan(insight!, insightOrders(insight!));
    expect(slides.map((s) => s.kind).slice(-2)).toEqual(["orders", "end"]);
    const listed = slides.find((s) => s.kind === "orders")!;
    // The slide says where to see the rest exactly when some of the month's orders were left out.
    expect(listed.more).toBe(listed.orders!.length < insightOrders(insight!).length);
    // September's eleven do not all fit.
    const sept = { ...insight!, period: "2026-09-01" };
    const crowded = slidePlan(sept, insightOrders(sept)).find((s) => s.kind === "orders")!;
    expect(crowded.orders!.length).toBeLessThan(insightOrders(sept).length);
    expect(crowded.more).toBe(true);
    const cards = planThread(insight!)!.replies.filter((r) => r.chart !== undefined);
    expect(cards.map((r) => r.chart)).toEqual([breakdownCardCount(insight!)]);
    expect(slidePlan(insight!).some((s) => s.kind === "orders")).toBe(false);
  });
});
