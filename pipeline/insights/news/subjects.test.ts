import { describe, expect, it } from "vitest";
import { type CaseRow, type LawRow, caseTopics, lawName, lawTopics, parties } from "./subjects";
import { PAGE_TOPICS } from "./topics";
import { topicOf } from "./cards";
import { storyFor } from "./cards";
import type { Headline } from "../types";

const NOW = "2026-10-28T14:00:00.000Z";
const groupOf = new Map([["public-lands-and-natural-resources", "land-water-farming"], ["energy", "energy-environment"], ["commemorations", "commemorations"]]);
const law = (id: string, date: string, title: string, area = "public-lands-and-natural-resources"): LawRow => ({ law_id: id, date, title, area_id: area });
const topics = (...extra: ReturnType<typeof lawTopics>) => [...extra, ...PAGE_TOPICS];
const match = (title: string, ts = topics()) => topicOf(title, ts, [])?.topic;

describe("lawName", () => {
  it("takes the short title without the year, and only for a bill that has one", () => {
    expect(lawName("Chiricahua National Park Act")).toBe("Chiricahua National Park");
    expect(lawName("Crow Tribe Water Rights Settlement Amendments Act of 2025")).toBe("Crow Tribe Water Rights Settlement Amendments");
    expect(lawName("Southcentral Foundation Land Transfer Act of 2025")).toBe("Southcentral Foundation Land Transfer");
    expect(lawName("To require the Secretary of Agriculture to convey the Pleasant Valley Act")).toBeNull();
    expect(lawName("A joint resolution extending the time within which the President may transmit the Budget Act")).toBeNull();
  });
  it("skips a one-word name, too common in headlines to mean the law", () => {
    expect(lawName("Clergy Act")).toBeNull();
  });
});

describe("lawTopics", () => {
  const laws = [
    law("119-pub-133", "2026-10-20", "Chiricahua National Park Act"),
    law("119-pub-134", "2026-10-20", "License to Drill Act", "energy"),
    law("118-pub-9", "2025-02-01", "Old Short Title Act"),
    law("119-pub-1", "2026-03-01", "Clergy Act"),
  ];
  it("makes a topic for each recent law with a short title, filtered to the law's topic group", () => {
    const ts = lawTopics(laws, groupOf, NOW);
    expect(ts.map((t) => t.id).sort()).toEqual(["law.119-pub-133", "law.119-pub-134"]);
    expect(ts.find((t) => t.id === "law.119-pub-133")).toMatchObject({ page: "laws", chartId: "how-many-laws-does-congress-pass", groupId: "land-water-farming" });
  });
  it("matches the name in a headline, with or without 'Act', and nothing else", () => {
    const ts = lawTopics(laws, groupOf, NOW);
    expect(match("Trump signs Chiricahua National Park Act into law", topics(...ts))?.id).toBe("law.119-pub-133");
    expect(match("Chiricahua  National Park gets a new status", topics(...ts))?.id).toBe("law.119-pub-133");
    expect(match("Visiting Chiricahua National Monument this fall", topics(...ts))?.id).not.toBe("law.119-pub-133");
  });
  it("keeps the newer law where two share a name", () => {
    const ts = lawTopics([law("118-pub-1", "2026-01-05", "Rural Housing Act"), law("119-pub-2", "2026-09-05", "Rural Housing Act")], groupOf, NOW);
    expect(ts.map((t) => t.id)).toEqual(["law.119-pub-2"]);
  });
  it("labels the card with the law's name", () => {
    expect(lawTopics(laws, groupOf, NOW)[0]!.label()).toBe("Chiricahua National Park Act");
  });
});

describe("caseTopics", () => {
  const cases: CaseRow[] = [
    { case_id: "2025-059", date: "2026-06-30", name: "Trump v. Barbara", group_id: "immigration" },
    { case_id: "2025-040", date: "2026-06-23", name: "Cisco Systems v. Doe", group_id: "courts-procedure" },
    { case_id: "2025-041", date: "2026-06-25", name: "Monsanto Company v. Durnell", group_id: "states-tribes" },
    { case_id: "2020-001", date: "2021-03-01", name: "Old Case v. Other Party", group_id: "immigration" },
  ];
  it("splits the parties and drops company suffixes", () => {
    expect(parties("Monsanto Company v. Durnell")).toEqual(["Monsanto", "Durnell"]);
    expect(parties("Trump v. Barbara")).toEqual(["Trump", "Barbara"]);
  });
  it("makes a topic for each case decided recently, filtered to its topic", () => {
    const ts = caseTopics(cases, NOW);
    expect(ts.map((t) => t.id)).toEqual(["case.2025-059", "case.2025-040", "case.2025-041"]);
    expect(ts[0]).toMatchObject({ page: "decisions", groupId: "immigration", chartId: "how-many-cases-does-the-court-decide" });
  });
  it("matches the full name, or one distinctive party beside the Court", () => {
    const ts = [...caseTopics(cases, NOW), ...PAGE_TOPICS];
    expect(topicOf("Supreme Court rules in Trump v. Barbara", ts, [])?.topic.id).toBe("case.2025-059");
    expect(topicOf("Trump vs. Barbara decision expected", ts, [])?.topic.id).toBe("case.2025-059");
    expect(topicOf("Supreme Court sides with Monsanto on weedkiller suits", ts, [])?.topic.id).toBe("case.2025-041");
    expect(topicOf("Monsanto reports quarterly earnings", ts, [])?.topic.id).not.toBe("case.2025-041");
    // "Trump" and "Doe" alone never name a case.
    expect(topicOf("Supreme Court rules against Trump on tariffs", ts, [])?.topic.id).not.toBe("case.2025-059");
  });
});

describe("the general Laws and Decisions topics", () => {
  it("catches a Supreme Court ruling, on its subject when it names one", () => {
    expect(match("Supreme Court rules on a deportation fight")?.id).toBe("ruling_immigration");
    expect(match("Supreme Court strikes down a state's voting map")?.id).toBe("ruling_elections");
    expect(match("Supreme Court upholds the law")?.id).toBe("ruling");
    expect(match("Supreme Court nominee meets senators")).toBeUndefined();
  });
  it("catches a bill signed into law", () => {
    expect(match("Trump signs veterans bill into law")?.id).toBe("new_laws");
  });
  it("puts a ruling's story on the count chart filtered to its subject", () => {
    const c = topicOf("Supreme Court rules on a deportation fight", PAGE_TOPICS, [])!;
    const hl = (outletId: string, title: string): Headline => ({ title, source: outletId, url: `https://example.com/${outletId}`, published: "2026-10-27T15:00:00.000Z", feed: "outlet", outletId });
    const story = storyFor({ ...c, headlines: [hl("nbcnews", "Supreme Court rules on a deportation fight"), hl("foxnews", "Supreme Court decides deportation case")] }, [hl("nbcnews", "Supreme Court rules on a deportation fight"), hl("foxnews", "Supreme Court decides deportation case")], []);
    expect(story).toMatchObject({ topic: "Supreme Court rulings on immigration", chartId: "how-many-cases-does-the-court-decide", groupId: "immigration" });
  });
});
