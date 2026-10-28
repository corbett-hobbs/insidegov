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

  it("is six slides, and the copy no longer promises weekly gas and energy charts", () => {
    const slides = introCarousel();
    expect(slides).toHaveLength(6);
    expect(slides[0]!.kind).toBe("cover");
    const words = JSON.stringify(slides) + INTRO_INSTAGRAM_CAPTION;
    expect(words).not.toMatch(/weekly updates|gas and energy weekly/i);
    expect(INTRO_INSTAGRAM_CAPTION).toContain("(link in bio)");
  });
});
