import { describe, expect, it } from "vitest";
import { embedSnippet, embedSourceUrl, embedUrl } from "./embed";

describe("chart embeds", () => {
  const page = "https://insidegov.org/presidency/trade?country=CHN&years=2001-2010";

  it("points at the same view with the card id and theme, and no hash", () => {
    const u = new URL(embedUrl(`${page}#old`, "goods-trade-balance", "dark"));
    expect(u.pathname).toBe("/presidency/trade");
    expect(u.hash).toBe("");
    expect(u.searchParams.get("country")).toBe("CHN");
    expect(u.searchParams.get("years")).toBe("2001-2010");
    expect(u.searchParams.get("embed")).toBe("goods-trade-balance");
    expect(u.searchParams.get("theme")).toBe("dark");
  });

  it("replaces an embed already in the URL instead of stacking a second", () => {
    const again = embedUrl(embedUrl(page, "a", "light"), "b", "dark");
    expect(new URL(again).searchParams.getAll("embed")).toEqual(["b"]);
  });

  it("links an embed back to the full chart at its card, filters kept", () => {
    const back = new URL(embedSourceUrl(embedUrl(page, "goods-trade-balance", "light")));
    expect(back.searchParams.has("embed")).toBe(false);
    expect(back.searchParams.has("theme")).toBe(false);
    expect(back.searchParams.get("country")).toBe("CHN");
    expect(back.hash).toBe("#goods-trade-balance");
  });

  it("writes an iframe that survives being pasted into HTML, plus the resize script", () => {
    const code = embedSnippet({ url: embedUrl(page, "x", "light"), title: 'The "big" one', height: 520, origin: "https://insidegov.org" });
    expect(code).toContain('src="https://insidegov.org/presidency/trade?country=CHN&amp;years=2001-2010&amp;embed=x&amp;theme=light"');
    expect(code).toContain('title="The &quot;big&quot; one"');
    expect(code).toContain('height="520"');
    expect(code).toContain('<script src="https://insidegov.org/embed.js" async></script>');
  });
});
