import { describe, expect, it } from "vitest";
import { districtWikiUrl } from "./district-wiki";

const W = "https://en.wikipedia.org/wiki/";

describe("districtWikiUrl", () => {
  it("links a numbered district", () => {
    expect(districtWikiUrl("CA", "California", 12)).toBe(`${W}California's_12th_congressional_district`);
    expect(districtWikiUrl("NY", "New York", 1)).toBe(`${W}New_York's_1st_congressional_district`);
  });
  it("links at-large seats and territories", () => {
    expect(districtWikiUrl("AK", "Alaska", null)).toBe(`${W}Alaska's_at-large_congressional_district`);
    expect(districtWikiUrl("DC", "DC", null)).toBe(`${W}District_of_Columbia's_at-large_congressional_district`);
  });
});
