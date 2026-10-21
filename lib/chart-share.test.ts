import { describe, expect, it } from "vitest";
import { shareLinks } from "./chart-share";

describe("chart share links", () => {
  it("carries the title and the exact view to every network", () => {
    const url = "https://insidegov.org/presidency/trade?country=CHN&years=2001-2010#the-goods-trade-balance-with-china";
    const links = shareLinks(url, "The goods trade balance with China · InsideGov");
    expect(links.map((l) => l.label)).toEqual(["Post on X", "Post on Bluesky", "Share on LinkedIn", "Email"]);
    for (const l of links) expect(decodeURIComponent(l.href)).toContain(url);
    expect(decodeURIComponent(links[0]!.href)).toContain("The goods trade balance with China");
  });
});
