import { describe, expect, it } from "vitest";
import { slidePlan } from "./carousel";
import { FOLDS, MAX_FOLDED, coveredByDraft, datasetOfId, foldedFacts, selectInsights, wholeOf } from "./collect";
import { superlativeTitle, termExtreme } from "./title";
import { checkReplies, foldedCardStart, planThread, replyNumbers } from "./thread";
import type { DatasetId, Fact, Insight } from "./types";

/** A term comparison's bars: three earlier terms (5, 6, 7) and the current one, emphasised (6.5 sits in the middle: no superlative). */
const termBars = (current: number): Insight["chart"] => ({ type: "bars", unit: null, axisLabel: "", bars: [{ label: "a", value: 5, emphasis: false }, { label: "b", value: 6, emphasis: false }, { label: "c", value: 7, emphasis: false }, { label: "now", value: current, emphasis: true }], orientation: "horizontal" });

/** A minimal insight, as a detector hands it over. */
function ins(seriesId: string, kind: Insight["kind"], score: number, over: Partial<Insight> = {}): Insight {
  const dataset = seriesId.split(".")[0] as DatasetId;
  const period = over.period ?? "2026-09-01";
  const chart: Insight["chart"] =
    kind === "term_comparison"
      ? termBars(6.5)
      : { type: "line", unit: { scale: 1, decimals: 1, suffix: "" }, axisLabel: "", frequency: "monthly", points: [{ date: "2026-08-01", value: 1 }, { date: period, value: 2 }], marks: [] };
  return {
    id: `${seriesId}:${kind}:${period}`, dataset, seriesId, kind, period, frequency: "monthly", headline: `${seriesId} ${kind}`, title: `${seriesId} title`,
    template: "U.S. goods imports stood at $344.2B in September 2026, the highest in data going back to January 1991.", facts: [], context: [],
    chart, url: "/presidency/trade", source: "U.S. Census Bureau", score, alt: `${seriesId} chart`, ...over,
  };
}

const fact = (id: string, text: string): Fact => ({ id, text, value: 1, format: { kind: "int" }, derivation: { op: "date", date: "2026-09-01", style: "month" } });
const pick = (insights: Insight[], max = 9) => selectInsights(insights, { max });

describe("one post per data update", () => {
  const deficitTerm = ins("trade.deficit", "term_comparison", 14);
  const importsHigh = ins("trade.imports", "extreme_high", 38.5);
  const importsTerm = ins("trade.imports", "term_comparison", 11);
  const exportsTerm = ins("trade.exports", "term_comparison", 10);

  it("gives a dataset one post however many readings the refresh produced", () => {
    const posts = pick([ins("encounters.total", "move_up", 8), ins("encounters.total", "extreme_high", 7), ins("encounters.southwest", "latest", 2)]);
    expect(posts.map((p) => p.id)).toEqual(["encounters.total:move_up:2026-09-01"]);
  });

  it("gives each dataset its own post, best first, cut to max", () => {
    const all = [ins("trade.deficit", "extreme_high", 9), ins("energy.petroleum_imports", "move_up", 12), ins("encounters.total", "latest", 2)];
    expect(pick(all).map((p) => p.dataset)).toEqual(["energy", "trade", "encounters"]);
    expect(pick(all, 2).map((p) => p.dataset)).toEqual(["energy", "trade"]);
  });

  it("looks only at the dataset's newest period: an older month is stale beside it", () => {
    const older = ins("trade.deficit", "extreme_high", 90, { period: "2026-08-01" });
    expect(pick([older, deficitTerm]).map((p) => p.id)).toEqual([deficitTerm.id]);
  });

  it("leads the release with imports' high, the sensational reading, and folds the deficit's term comparison in behind it", () => {
    for (const order of [[deficitTerm, importsHigh, importsTerm, exportsTerm], [importsTerm, exportsTerm, importsHigh, deficitTerm]]) {
      const posts = pick(order);
      expect(posts.map((p) => p.id)).toEqual([importsHigh.id]);
      // The deficit follows; the part's term comparison (a bar chart of the part) and the exports' are dropped.
      expect(posts[0]!.folded?.map((f) => f.id)).toEqual([deficitTerm.id]);
    }
  });

  it("titles the lead with its superlative, and leaves the follower's title plain", () => {
    const high = ins("trade.imports", "extreme_high", 38.5, { headline: "U.S. goods imports: the highest in data going back to January 1991" });
    const [post] = pick([deficitTerm, high]);
    expect(post!.title).toBe("U.S. goods imports are the highest in data going back to January 1991");
    expect(post!.folded![0]!.title).toBe(deficitTerm.title);
  });

  it("keeps the whole in the lead when it is a high or a low itself, with the part's high behind it", () => {
    const deficitHigh = ins("trade.deficit", "extreme_high", 12, { headline: "U.S. goods trade deficit: the largest in data going back to January 1991" });
    const [post] = pick([deficitHigh, importsHigh]);
    expect(post!.id).toBe(deficitHigh.id);
    expect(post!.folded?.map((f) => f.id)).toEqual([importsHigh.id]);
  });

  it("leads with the deficit's term comparison when its current term tops every earlier one, with imports' high behind it", () => {
    const HEAD = "The U.S. goods trade deficit at the same point in each presidential term";
    const topped = ins("trade.deficit", "term_comparison", 14, { headline: HEAD, chart: termBars(9) });
    const [post] = pick([topped, importsHigh]);
    expect(post!.id).toBe(topped.id);
    expect(post!.title).toBe("The U.S. goods trade deficit is the highest of 4 terms at the same point");
    expect(post!.folded?.map((f) => f.id)).toEqual([importsHigh.id]);
    // A comparison the current term does not top has no superlative, so the part's high leads instead.
    expect(pick([{ ...topped, chart: termBars(6.5) }, importsHigh])[0]!.id).toBe(importsHigh.id);
  });

  it("keeps the whole in the lead when its parts have no high or low, and folds a part's move behind it", () => {
    const exportsMove = ins("trade.exports", "move_up", 15);
    const [post] = pick([deficitTerm, exportsMove, importsTerm]);
    expect(post!.id).toBe(deficitTerm.id);
    expect(post!.folded?.map((f) => f.id)).toEqual([exportsMove.id]);
  });

  it("folds at most MAX_FOLDED readings, best first, and never a bar chart", () => {
    const exportsHigh = ins("trade.exports", "extreme_high", 20);
    const exportsMove = ins("trade.exports", "move_up", 15);
    const posts = pick([deficitTerm, importsHigh, exportsHigh, exportsMove]);
    expect(MAX_FOLDED).toBe(2);
    // The two best parts fold; the better of them leads, and the deficit and the other part follow.
    expect(posts[0]!.id).toBe(importsHigh.id);
    expect(posts[0]!.folded?.map((f) => f.id)).toEqual([deficitTerm.id, exportsHigh.id]);
  });

  it("lets the parts compete when the whole has only its routine reading, and then folds nothing", () => {
    const routine = ins("trade.deficit", "latest", 1.5);
    const posts = pick([routine, importsHigh, importsTerm]);
    expect(posts.map((p) => p.id)).toEqual([importsHigh.id]);
    expect(posts[0]!.folded).toBeUndefined();
  });

  it("does not fold into a post that is not the whole", () => {
    const energy = [ins("energy.petroleum_imports", "extreme_high", 30), ins("energy.power_total", "extreme_high", 12)];
    expect(pick(energy).map((p) => p.id)).toEqual([energy[0]!.id]);
    expect(pick(energy)[0]!.folded).toBeUndefined();
  });

  it("names the deficit's parts and no others", () => {
    expect(FOLDS["trade.deficit"]).toEqual(["trade.imports", "trade.exports"]);
    expect(wholeOf("trade.imports")).toBe("trade.deficit");
    expect(wholeOf("trade.deficit")).toBeUndefined();
    expect(wholeOf("energy.petroleum_imports")).toBeUndefined();
  });
});

describe("the daily catch-up never opens a second post for an update", () => {
  const drafted = ["trade.deficit:term_comparison:2026-09-01"];
  it("covers every other insight of the dataset's update, and older ones", () => {
    expect(coveredByDraft({ dataset: "trade", kind: "extreme_high", period: "2026-09-01" }, drafted)).toBe(true);
    expect(coveredByDraft({ dataset: "trade", kind: "term_comparison", period: "2026-08-01" }, drafted)).toBe(true);
  });
  it("lets a newer update, another dataset and a news draft through", () => {
    expect(coveredByDraft({ dataset: "trade", kind: "extreme_high", period: "2026-10-01" }, drafted)).toBe(false);
    expect(coveredByDraft({ dataset: "energy", kind: "extreme_high", period: "2026-09-01" }, drafted)).toBe(false);
    expect(coveredByDraft({ dataset: "trade", kind: "extreme_high", period: "2026-09-01" }, ["news:diesel:2026-09-02"])).toBe(false);
  });
  it("lets a notable reading replace a routine one for the same update", () => {
    const routine = ["trade.deficit:latest:2026-09-01"];
    expect(coveredByDraft({ dataset: "trade", kind: "extreme_high", period: "2026-09-01" }, routine)).toBe(false);
    expect(coveredByDraft({ dataset: "trade", kind: "latest", period: "2026-09-01" }, routine)).toBe(true);
  });
  it("reads a dataset from an id, event sets included", () => {
    expect(datasetOfId("trade.imports:extreme_high:2026-09-01")).toBe("trade");
    expect(datasetOfId("executive_orders:term_comparison:2026-09-30")).toBe("executive_orders");
    expect(datasetOfId("laws.monthly:extreme_high:2026-09-30")).toBe("laws");
  });
});

describe("a folded reading in the carousel and the thread", () => {
  const deficit = ins("trade.deficit", "term_comparison", 14, { facts: [fact("term_2025-01-20", "$2.00T")], template: "The U.S. goods trade deficit totaled $2.00T in the first 20 full months of the term, the highest of the 6 terms shown.", alt: "Bar chart of the deficit." });
  const post = ins("trade.imports", "extreme_high", 38.5, { facts: [fact("latest_value", "$344.2B"), fact("latest_date", "September 2026"), fact("series_start", "January 1991")], folded: [deficit] });

  it("follows the post's own slides with one chart slide per folded reading, before the end slide", () => {
    const kinds = slidePlan(post).map((s) => s.kind);
    expect(kinds.slice(0, 3)).toEqual(["hook", "chart", "folded"]);
    expect(kinds.at(-1)).toBe("end");
    expect(slidePlan(post).find((s) => s.kind === "folded")?.folded?.id).toBe(deficit.id);
    expect(slidePlan({ ...post, folded: undefined }).map((s) => s.kind)).not.toContain("folded");
  });

  it("adds one reply and one chart card with the reading's own sentence, numbers checked against its facts", () => {
    const plan = planThread(post)!;
    const reply = plan.replies.find((r) => r.text.startsWith("Also in this release."))!;
    expect(reply.text).toContain("$2.00T in the first 20 full months of the term");
    expect(reply.chart).toBe(foldedCardStart(post));
    expect(reply.alt).toBe("Bar chart of the deficit.");
    // The reading's facts count for the replies under prefixed ids, never colliding with the post's own.
    const facts = [...post.facts, ...foldedFacts(deficit)];
    expect(foldedFacts(deficit).map((f) => f.id)).toEqual(["deficit_term_2025-01-20"]);
    expect(checkReplies(plan.replies, facts, replyNumbers(plan.replies))).toEqual([]);
    expect(checkReplies([{ text: "Also in this release. The deficit reached $9.99T in the first months of the term." }], facts)).not.toEqual([]);
  });

  it("ends the thread with the sources", () => {
    expect(planThread(post)!.replies.at(-1)!.text).toMatch(/^Data: /);
  });
});

describe("the folded reading's title", () => {
  it("is the superlative itself, with the right verb, when the reading is a high or a low", () => {
    expect(superlativeTitle({ kind: "extreme_high", headline: "U.S. goods imports: the highest in data going back to January 1991", chart: termBars(1) })).toBe("U.S. goods imports are the highest in data going back to January 1991");
    expect(superlativeTitle({ kind: "extreme_low", headline: "U.S. electricity generation: the lowest since July 2008", chart: termBars(1) })).toBe("U.S. electricity generation is the lowest since July 2008");
  });
  it("titles a folded high with its superlative (a follower, behind the whole's own high), and leaves a folded move with its plain title", () => {
    const deficitHigh = ins("trade.deficit", "extreme_high", 12, { headline: "U.S. goods trade deficit: the largest in data going back to January 1991" });
    const high = ins("trade.imports", "extreme_high", 38.5, { headline: "U.S. goods imports: the highest in data going back to January 1991" });
    const move = ins("trade.exports", "move_up", 20, { headline: "U.S. goods exports: up 9%" });
    const [post] = selectInsights([deficitHigh, high, move], { max: 9 });
    expect(post!.title).toBe("U.S. goods trade deficit is the largest in data going back to January 1991");
    expect(post!.folded!.map((f) => f.title)).toEqual(["U.S. goods imports are the highest in data going back to January 1991", "trade.exports title"]);
  });
  it("falls back to the plain title for a move, a headline it cannot read, or a title that breaks the rule", () => {
    expect(superlativeTitle({ kind: "move_up", headline: "U.S. goods imports: the highest in data going back to January 1991", chart: termBars(1) })).toBeNull();
    expect(superlativeTitle({ kind: "extreme_high", headline: "Imports hit a high", chart: termBars(1) })).toBeNull();
    expect(superlativeTitle({ kind: "extreme_high", headline: `${"Very long series name ".repeat(4)}: the highest in data going back to January 1991`, chart: termBars(1) })).toBeNull();
  });
});

describe("a term comparison's superlative", () => {
  const HEAD = "The U.S. goods trade deficit at the same point in each presidential term";
  it("is the highest or the lowest of at least three terms, and nothing in between", () => {
    expect(termExtreme({ kind: "term_comparison", chart: termBars(9) })).toBe("highest");
    expect(termExtreme({ kind: "term_comparison", chart: termBars(1) })).toBe("lowest");
    expect(termExtreme({ kind: "term_comparison", chart: termBars(6.5) })).toBeNull();
    expect(termExtreme({ kind: "extreme_high", chart: termBars(9) })).toBeNull();
    const two = termBars(9);
    if (two.type === "bars") two.bars = two.bars.slice(2);
    expect(termExtreme({ kind: "term_comparison", chart: two })).toBeNull();
  });
  it("makes a title with the right verb, or none when the headline is another shape", () => {
    expect(superlativeTitle({ kind: "term_comparison", headline: HEAD, chart: termBars(9) })).toBe("The U.S. goods trade deficit is the highest of 4 terms at the same point");
    expect(superlativeTitle({ kind: "term_comparison", headline: "U.S. goods imports at the same point in each presidential term", chart: termBars(1) })).toBe("U.S. goods imports are the lowest of 4 terms at the same point");
    expect(superlativeTitle({ kind: "term_comparison", headline: "Executive orders signed in the first 300 days of each term", chart: termBars(9) })).toBeNull();
  });
});
