import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INTRO_BRANCHES, introLook } from "./carousel";
import { paleOf } from "./chart";
import { INTRO_INSTAGRAM_CAPTION, introCarousel } from "./intro";

describe("Instagram intro", () => {
  it("cycles the three branches so no slide shares a look with its neighbour", () => {
    expect(INTRO_BRANCHES).toEqual(["presidency", "supreme-court", "congress"]);
    const looks = Array.from({ length: 6 }, (_, i) => introLook(i));
    for (let i = 1; i < looks.length; i++) expect(looks[i]!.branch).not.toBe(looks[i - 1]!.branch);
    expect(looks[3]!.branch).toBe(looks[0]!.branch);
  });

  it("makes the cover dark (white type, gold marks) and every other slide pale, unless asked not to", () => {
    expect(introLook(0).dark).toBe(true);
    expect(introLook(0).ink).toBe("#ffffff");
    expect([1, 2, 3, 4, 5].some((i) => introLook(i).dark)).toBe(false);
    expect(introLook(0, false).dark).toBe(false);
  });

  it("tints a pale ground from the branch colour, never pure white", () => {
    expect(paleOf("#2f4f87")).toBe("#f0f3f7");
    for (const c of ["#2f4f87", "#2f6b4f", "#7a2e3b"]) expect(paleOf(c)).not.toBe("#ffffff");
  });

  it("is five slides, and the copy no longer promises weekly gas and energy charts", () => {
    const slides = introCarousel();
    expect(slides).toHaveLength(5);
    expect(slides[0]!.kind).toBe("cover");
    const words = JSON.stringify(slides) + INTRO_INSTAGRAM_CAPTION;
    expect(words).not.toMatch(/weekly updates|gas and energy weekly/i);
    expect(INTRO_INSTAGRAM_CAPTION).toContain("(link in bio)");
  });

  it("puts the proof and the personal note up front, before the explanations", () => {
    const slides = introCarousel();
    expect(slides.map((s) => s.kind)).toEqual(["cover", "text", "text", "list", "list"]);
    const [cover, why, bio] = slides;
    // The cover names who is behind it, so the credential is on the first slide a stranger sees.
    expect(cover).toMatchObject({ kind: "cover", byline: expect.stringContaining("Corby Hobbs") });
    // The premise carries a compact real chart (gas prices from the Obama term, labelled by series), not a mock-up.
    if (why!.kind !== "text" || !why.chart) throw new Error("no chart under the premise");
    expect(why.chart.label).toMatch(/^Gas prices/);
    expect(why.chart.insight.seriesId).toBe("gas.regular");
    expect(why.chart.insight.chart.type).toBe("line");
    if (why.chart.insight.chart.type !== "line") throw new Error("not a line");
    expect(why.chart.insight.chart.points[0]!.date.slice(0, 7)).toBe("2009-01");
    // The bio keeps its order so "it" in the last line is the InsideGov just before it, and carries a photo that exists.
    if (bio!.kind !== "text") throw new Error("not a text slide");
    expect(bio.paragraphs[0]).toMatch(/Georgetown/);
    expect(bio.paragraphs[1]).toMatch(/original InsideGov at Graphiq/);
    expect(bio.paragraphs[2]).toMatch(/^Bringing it back is a labor of love/);
    expect(bio.photo && existsSync(bio.photo)).toBe(true);
  });

  it("ends on the link in the bio, once", () => {
    const slides = introCarousel();
    const signs = slides.flatMap((s) => (s.kind === "text" || s.kind === "list") && s.sign ? [s.sign] : []);
    expect(signs).toHaveLength(1);
    expect(signs[0]).toContain("link in bio");
    const last = slides.at(-1)!;
    expect(last.kind === "list" && last.sign).toBe(signs[0]);
  });
});
