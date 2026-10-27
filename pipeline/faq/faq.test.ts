import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkFaqAnswer, numberInSource, numbersIn } from "./check";
import { debtFacts, encountersFacts } from "./facts";
import { blockComment, issueBody, parseFaqBlock, type FaqDraft } from "./issue";
import { FAQ_PAGES, checkQuestion, readQuestionList, type Question } from "./questions";
import { htmlToText, sourceNotAllowed } from "./sources";

const NASS = { label: "NASS", url: "https://www.nass.usda.gov/x.pdf", text: "Farm production expenditures, 2024. Total fuel expense is $15.4 billion. Diesel, the largest sub-component, is $9.9 billion, accounting for 64.3 percent." };
const ok = (a: string, cited = [NASS]) => checkFaqAnswer(a, cited);

describe("checkFaqAnswer", () => {
  it("passes a plain answer whose numbers are all in its source", () => {
    expect(ok("Farms spend most of their fuel money on diesel. In 2024 it was $9.9B of $15.4B, or 64.3%.")).toBeNull();
  });

  it("accepts a figure written as the source writes it, or compacted from a longer one", () => {
    expect(ok("Farms spend most of their fuel money on diesel. In 2024 it was $9.9 billion of $15.4 billion.")).toBeNull();
    const table = { ...NASS, text: "Encounters 348,866 in fiscal year 2026." };
    expect(ok("Most encounters were at ports. There were 348.9K in fiscal 2026.", [table])).toBeNull();
  });

  it("rejects a number the cited sources do not give, including derived shares", () => {
    expect(ok("Farms spend most of their fuel money on diesel. In 2024 it was $9.8B of $15.4B.")).toMatch(/9\.8B is not in the sources/);
    expect(ok("Farms spend most of their fuel money on diesel. It was 64% of fuel spending in 2024.")).toMatch(/64 is not in the sources/);
    expect(ok("Farms spend most of their fuel money on diesel. That was true in 2023 as well.")).toMatch(/2023 is not in the sources/);
  });

  it("checks numbers only against the sources the answer cites", () => {
    const other = { label: "Other", url: "https://www.eia.gov/a", text: "Trucks move goods." };
    expect(checkFaqAnswer("Diesel moves goods. Farms spent $9.9B on it in 2024.", [other])).toMatch(/9\.9B/);
  });

  it("accepts small numbers spelled out in the source", () => {
    const law = { label: "INA", url: "https://www.govinfo.gov/x", text: "after five years of residence, or three years if married" };
    expect(ok("A permanent resident can apply to naturalize after 5 years. A spouse of a citizen can apply after 3 years.", [law])).toBeNull();
  });

  it("requires figures of 10,000 or more to be compact", () => {
    const src = { ...NASS, text: "Encounters 348,866." };
    expect(ok("Most were at ports of entry. There were 348,866 in all.", [src])).toMatch(/compact form/);
  });

  it("requires 2 to 4 sentences of plain prose", () => {
    expect(ok("Diesel matters to farms.")).toMatch(/1 sentences/);
    expect(ok("A. B. C. D. E.".replace(/[A-E]/g, "Diesel matters to farms"))).toMatch(/5 sentences/);
    expect(ok("Diesel matters to farms.\nIt matters to trucks.")).toMatch(/plain prose/);
    expect(ok("Diesel matters to **farms**. It matters to trucks.")).toMatch(/plain prose/);
    expect(ok("Diesel matters to farms. It matters to trucks")).toMatch(/full stop/);
  });

  it("does not split sentences at U.S.", () => {
    expect(ok("A green card lets someone live in the U.S. permanently. A citizen can also vote in federal elections.", [{ ...NASS, text: "" }])).toBeNull();
  });

  it("rejects causal claims about policy", () => {
    expect(ok("Encounters fell after the order. They dropped because of the new policy.", [{ ...NASS, text: "" }])).toMatch(/causal claim/);
    expect(ok("Prices rose. Tariffs led to higher costs for farms.", [{ ...NASS, text: "" }])).toMatch(/causal claim/);
    // A cause that is not a policy is fine.
    expect(ok("Diesel matters because trucks run on it. Most goods move by truck.", [{ ...NASS, text: "" }])).toBeNull();
  });

  it("rejects loaded words carried from sources", () => {
    expect(ok("Encounters saw a surge at ports. Most were in the southwest.", [{ ...NASS, text: "" }])).toMatch(/"surge" is a loaded word/);
    expect(ok("The debt reached a historic level. It is owed to many holders.", [{ ...NASS, text: "" }])).toMatch(/historic/);
  });

  it("rejects politicians and parties unless the question list allows the name", () => {
    const none = [{ ...NASS, text: "" }];
    expect(ok("President Trump sets the ceiling each year. Congress is consulted first.", none)).toMatch(/name the office/);
    expect(ok("The Biden administration raised it. Congress is consulted first.", none)).toMatch(/Biden/);
    expect(ok("Republicans wanted it lower. Congress is consulted first.", none)).toMatch(/parties/);
    expect(checkFaqAnswer("The Reagan administration signed it into law. Congress passed it first.", none, { allowNames: ["Reagan"] })).toBeNull();
    expect(ok("The President sets the ceiling each year. Congress is consulted first.", none)).toBeNull();
  });

  it("rejects sources off the allowed list, and an answer with none", () => {
    expect(checkFaqAnswer("Diesel moves goods. Farms use it.", [{ label: "Blog", url: "https://www.example.com/a", text: "" }])).toMatch(/not on the allowed source list/);
    expect(checkFaqAnswer("Diesel moves goods. Farms use it.", [])).toMatch(/cites no source/);
  });
});

describe("numbers", () => {
  it("reads values, decimals and scales", () => {
    expect(numbersIn("$9.9B, 348.9K, 1,234 and 2.5 million in 2026; 64.3%").map((n) => [n.value, n.scale])).toEqual([
      [9.9, 1e9],
      [348.9, 1e3],
      [1234, 1],
      [2.5, 1e6],
      [2026, 1],
      [64.3, 1],
    ]);
  });

  it("matches a compact figure only at the precision shown", () => {
    const src = numbersIn("348,866");
    expect(numberInSource(numbersIn("348.9K")[0]!, src, "")).toBe(true);
    expect(numberInSource(numbersIn("349K")[0]!, src, "")).toBe(true);
    expect(numberInSource(numbersIn("348.5K")[0]!, src, "")).toBe(false);
  });
});

describe("sources", () => {
  it("allows federal agencies, the Fed, universities and named industry institutes only", () => {
    for (const u of ["https://www.bls.gov/x", "https://fiscaldata.treasury.gov/y", "https://www.stlouisfed.org/z", "https://farmdoc.illinois.edu/a", "https://truckingresearch.org/b", "https://www.congress.gov/crs-product/RS22331"])
      expect(sourceNotAllowed(u)).toBeNull();
    for (const u of ["https://www.heritage.org/x", "https://www.americanprogress.org/y", "https://www.investopedia.com/z", "https://www.ca.gov/a", "http://www.bls.gov/x", "https://notbls.gov.example.com/"])
      expect(sourceNotAllowed(u)).not.toBeNull();
  });

  it("reads a page's main text without its menus and scripts", () => {
    const html = "<html><nav>Menu</nav><main><h1>Diesel</h1><p>Trucks&nbsp;use&#x20;it.</p><script>x()</script></main><footer>F</footer></html>";
    expect(htmlToText(html)).toBe("Diesel\nTrucks use it.");
  });
});

describe("facts", () => {
  it("writes the latest encounter shares, so a stale share fails the number check", () => {
    const row = (period: number, scope: string, component: string, value: number) => ({ period, period_type: "fiscal_year", scope, component, value, status: "final", months: 12 }) as never;
    const text = encountersFacts([row(2024, "nationwide", "usbp", 1557319), row(2024, "nationwide", "ofo", 1343823), row(2024, "southwest", "usbp", 1530523), row(2024, "southwest", "ofo", 604482)]);
    expect(text).toContain("Fiscal year 2024: 2.9M encounters nationwide.");
    expect(text).toContain("Southwest border: 2.1M, 74% of nationwide encounters.");
    const cited = [{ label: "CBP", url: "https://www.cbp.gov/newsroom/stats/nationwide-encounters", text }];
    expect(checkFaqAnswer("Most encounters were on the southwest border. In fiscal 2024 it was 74%.", cited)).toBeNull();
    expect(checkFaqAnswer("Most encounters were on the southwest border. In fiscal 2024 it was 89%.", cited)).toMatch(/89/);
  });

  it("writes the debt held by the public as a share of the total", () => {
    expect(debtFacts([{ date: "2026-07-01", total: 40171825, held: 32425013 }])).toBe(
      "Debt to the Penny (InsideGov's copy of Treasury's data), July 2026: total federal debt $40.2 trillion. Debt held by the public $32.4 trillion, 81% of the total. Intragovernmental holdings $7.7 trillion, 19% of the total.",
    );
  });
});

describe("question lists", () => {
  const base: Question = { id: "x", kind: "difference", q: "What is the difference between a refugee and an asylum seeker?", searched: "x", chartIds: ["chart-x"], sources: [{ label: "x", url: "https://www.uscis.gov/" }] };

  it("keeps to the two kinds of question", () => {
    expect(checkQuestion(base)).toBeNull();
    expect(checkQuestion({ ...base, kind: "matters", q: "Who feels diesel prices the most?" })).toBeNull();
    expect(checkQuestion({ ...base, kind: "matters", q: "Why did diesel prices go up in 2022?" })).toMatch(/context line/);
    expect(checkQuestion({ ...base, kind: "matters", q: "Why are diesel prices so high?" })).toMatch(/context line/);
    expect(checkQuestion({ ...base, q: "How is unemployment measured?" })).toMatch(/Data notes/);
    expect(checkQuestion({ ...base, q: "Is a refugee an asylum seeker?" })).toMatch(/difference between/);
  });

  it.each(FAQ_PAGES)("%s: valid, 5-8 questions, sources on the allowed list", (page) => {
    const list = readQuestionList(page);
    const qs = list.groups.flatMap((g) => g.questions);
    expect(qs.length).toBeGreaterThanOrEqual(5);
    expect(qs.length).toBeLessThanOrEqual(8);
    for (const s of qs.flatMap((q) => q.sources)) expect(sourceNotAllowed(s.url), s.url).toBeNull();
  });

  it.each(FAQ_PAGES)("%s: a change to any of its data files re-runs the re-check workflow", (page) => {
    const workflow = readFileSync(".github/workflows/faq-recheck.yml", "utf8");
    for (const f of readQuestionList(page).dataFiles) expect(workflow, f).toContain(`- ${f}`);
  });
});

describe("issue block", () => {
  const draft: FaqDraft = {
    page: "economy",
    asOf: "2026-10-27",
    model: "claude-sonnet-5-5",
    groups: [{ row: "Everyday costs", items: [{ id: "diesel-why", q: "Why -- now?", a: "Diesel moves goods. Farms use it.", sources: [{ label: "EIA", url: "https://www.eia.gov/a" }], chartIds: ["chart-diesel"] }] }],
    dropped: [],
  };

  it("round-trips through the issue body, even with -- in the text", () => {
    expect(blockComment(draft).slice(4, -3)).not.toContain("--");
    expect(parseFaqBlock(issueBody(draft))).toEqual(draft);
  });

  it("returns null for a missing or broken block", () => {
    expect(parseFaqBlock("no block")).toBeNull();
    expect(parseFaqBlock("<!-- faq-draft\n{ not json\n-->")).toBeNull();
  });
});

describe("answers that talk about their sources", () => {
  const none = [{ ...NASS, text: "" }];
  it("are rejected", () => {
    expect(ok("The sources don't rank who feels it most. Trucks use diesel.", none)).toMatch(/do not talk about the sources/);
    expect(ok("The report does not show income groups. Housing is the largest cost.", none)).toMatch(/do not talk about the sources/);
  });

  it("count a sentence that ends in U.S.", () => {
    const five = "A green card lets a person live in the U.S. A citizen can vote. A resident cannot. Both pay taxes. Both obey laws.";
    expect(ok(five, none)).toMatch(/5 sentences/);
  });
});
