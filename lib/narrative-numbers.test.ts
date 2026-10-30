import { describe, expect, it } from "vitest";
import { COURT_CONTEXT, COURT_TAKEAWAYS } from "../components/court/takeaways";
import { DECISIONS_CONTEXT, DECISIONS_TAKEAWAYS } from "../components/decisions/takeaways";
import { DEMO_TAKEAWAYS } from "../components/demographics/takeaways";
import { ECONOMY_CONTEXT, SPECS, USD_SPECS } from "../components/economy/specs";
import { ENERGY_CONTEXT, ENERGY_TAKEAWAYS } from "../components/energy/takeaways";
import { EO_TAKEAWAYS } from "../components/executive-orders/takeaways";
import { AID_CONTEXT, AID_TAKEAWAYS } from "../components/foreign-aid/takeaways";
import { IMMIGRATION_CONTEXT, IMMIGRATION_TAKEAWAYS } from "../components/immigration/takeaways";
import { LAWS_CONTEXT, LAWS_TAKEAWAYS } from "../components/laws/takeaways";
import { IDEOLOGY_CONTEXT, IDEOLOGY_TAKEAWAYS } from "../components/senate/takeaways";
import { TRADE_CONTEXT, TRADE_TAKEAWAYS } from "../components/trade/takeaways";
import { TROOPS_CONTEXT, TROOPS_TAKEAWAYS } from "../components/troops/takeaways";
import { WEALTH_TAKEAWAYS } from "../components/wealth/takeaways";
import { UNCOMPACT_FIGURE } from "./format-number";

/**
 * Rule 2g over every takeaway and context line on the topic pages: a figure of 10,000 or more is in short form ("166.6K",
 * "1.8M", "$47.8B"), never exact or spelled out. Each page's own test checks the figures themselves.
 */
const NARRATIVE_KEYS = new Set(["takeaway", "byView", "text"]);
function collect(node: unknown, path: string, inNarrative: boolean, out: [string, string][]) {
  if (typeof node === "string") {
    if (inNarrative) out.push([path, node]);
  } else if (typeof node === "function") {
    // Trade's data-dated takeaways take month names or window labels.
    if (inNarrative) out.push([path, String(node("August", "September"))]);
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) collect(v, `${path}.${k}`, inNarrative || NARRATIVE_KEYS.has(k), out);
  }
}

const sources: Record<string, unknown> = {
  COURT_TAKEAWAYS, COURT_CONTEXT, DECISIONS_TAKEAWAYS, DECISIONS_CONTEXT, DEMO_TAKEAWAYS, SPECS, USD_SPECS, ECONOMY_CONTEXT,
  ENERGY_TAKEAWAYS, ENERGY_CONTEXT, EO_TAKEAWAYS, AID_CONTEXT, IMMIGRATION_TAKEAWAYS, IMMIGRATION_CONTEXT, LAWS_TAKEAWAYS,
  LAWS_CONTEXT, IDEOLOGY_TAKEAWAYS, IDEOLOGY_CONTEXT, TRADE_TAKEAWAYS, TRADE_CONTEXT, TROOPS_TAKEAWAYS, TROOPS_CONTEXT,
  WEALTH_TAKEAWAYS,
};
const lines: [string, string][] = [];
for (const [name, node] of Object.entries(sources)) collect(node, name, false, lines);
// Foreign aid's takeaways are bare strings keyed by card.
collect(AID_TAKEAWAYS, "AID_TAKEAWAYS", true, lines);

describe("numbers in prose (rule 2g)", () => {
  it("finds the narratives", () => expect(lines.length).toBeGreaterThan(60));
  for (const [path, text] of lines) {
    it(`${path} uses short forms from 10,000 up`, () => expect(text.match(UNCOMPACT_FIGURE)?.[0] ?? null).toBeNull());
  }
});

describe("UNCOMPACT_FIGURE", () => {
  it("flags what rule 2g shortens and passes what it keeps", () => {
    for (const bad of ["166,573 troops", "1,079,008", "207.1k", "1.08M", "34.0K", "1.08 million", "$15.0 billion"]) expect(bad).toMatch(UNCOMPACT_FIGURE);
    for (const ok of ["2,464 laws", "7,500 admissions", "166.6K", "1.1M", "$47.8B", "$3.1 trillion", "FY2024", "1,000 or more"]) expect(ok).not.toMatch(UNCOMPACT_FIGURE);
  });
});
