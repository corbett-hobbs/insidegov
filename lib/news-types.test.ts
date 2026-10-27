import { describe, expect, it } from "vitest";
import { faqFile, newsFile } from "./news-types";

const headline = { outletId: "wsj", outlet: "Wall Street Journal", lean: "Center", title: "T", url: "https://www.wsj.com/x" };
const story = { id: "s", date: "2026-10-24", topic: "Diesel prices", chartId: "chart-diesel", headlines: [headline] };

describe("newsFile", () => {
  it("accepts a story and the empty shipped shape", () => {
    expect(newsFile.safeParse({ asOf: "2026-10-27", stories: [story] }).success).toBe(true);
    expect(newsFile.safeParse({ asOf: "", stories: [] }).success).toBe(true);
  });
  it("rejects more than three headlines, an unknown lean, a bad date and a relative url", () => {
    const four = { ...story, headlines: [headline, headline, headline, headline] };
    expect(newsFile.safeParse({ asOf: "", stories: [four] }).success).toBe(false);
    expect(newsFile.safeParse({ asOf: "", stories: [{ ...story, headlines: [{ ...headline, lean: "Far Left" }] }] }).success).toBe(false);
    expect(newsFile.safeParse({ asOf: "", stories: [{ ...story, date: "Oct 24" }] }).success).toBe(false);
    expect(newsFile.safeParse({ asOf: "", stories: [{ ...story, headlines: [{ ...headline, url: "/x" }] }] }).success).toBe(false);
  });
});

describe("faqFile", () => {
  const item = { id: "q", q: "Why?", a: "Because.", sources: [{ label: "EIA", url: "https://www.eia.gov/" }], chartIds: ["chart-gas"] };
  it("accepts groups of items", () => {
    expect(faqFile.safeParse({ asOf: "2026-10-27", groups: [{ row: "Costs", items: [item] }] }).success).toBe(true);
    expect(faqFile.safeParse({ asOf: "", groups: [] }).success).toBe(true);
  });
  it("rejects an empty group and a source without a url", () => {
    expect(faqFile.safeParse({ asOf: "", groups: [{ row: "Costs", items: [] }] }).success).toBe(false);
    expect(faqFile.safeParse({ asOf: "", groups: [{ row: "Costs", items: [{ ...item, sources: [{ label: "x" }] }] }] }).success).toBe(false);
  });
});
