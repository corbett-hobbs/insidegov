import { describe as suite, expect, it } from "vitest";
import { describe } from "./committee-lead";

suite("describe (committee lead -> About text)", () => {
  it("keeps the identity sentence plus the sentences that say what the committee does", () => {
    const lead =
      "The Committee on Ways and Means is the chief tax-writing committee of the House. The committee has jurisdiction over all taxation and tariffs. Its chair is Jason Smith. It meets in Longworth.";
    expect(describe(lead)).toBe(
      "The Committee on Ways and Means is the chief tax-writing committee of the House. The committee has jurisdiction over all taxation and tariffs.",
    );
  });

  it("drops sentences naming the chair or counting members, and trivia", () => {
    const lead =
      "The Committee on Aging studies issues of older Americans. There are 45 members of this committee. Alaska has 11,772 special earmarked projects.";
    expect(describe(lead)).toBe("The Committee on Aging studies issues of older Americans.");
  });

  it("returns null when the lead never says what the committee does", () => {
    expect(describe("The Committee on X is a standing committee of the House.")).toBeNull();
  });

  it("falls back to a lone long jurisdiction sentence (Finance)", () => {
    const long = `The committee concerns itself with ${"taxation and revenue; ".repeat(20)}and more.`;
    const out = describe(`The Senate Committee on Finance is a standing committee. ${long}`);
    expect(out).toBe(long);
  });
});
