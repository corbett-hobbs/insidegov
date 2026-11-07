import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { candidatePrompt, checkCandidate, type CandidateInput } from "./classify";
import { PAGE_CHARTS } from "./topics";

const base: CandidateInput = {
  topic: "Oil imports",
  chart: "no chart on the page",
  headlines: [
    { title: "U.S. imports of Venezuelan crude rise", outlet: "NBC News", published: "2026-10-27T10:00:00Z" },
    { title: "Venezuelan oil tanker arrives in Texas", outlet: "Fox News", published: "2026-10-27T11:00:00Z" },
  ],
};
const answering = (input: unknown) => ({ beta: { messages: { create: async () => ({ stop_reason: "tool_use", content: [{ type: "tool_use", input }] }) } } }) as unknown as Anthropic;

describe("the chart pick", () => {
  it("offers the page's charts only for a chartless story", () => {
    expect(JSON.parse(candidatePrompt(base))).not.toHaveProperty("pick_chart");
    const p = JSON.parse(candidatePrompt({ ...base, pickChart: PAGE_CHARTS.energy }));
    expect(p.pick_chart.map((c: { id: string }) => c.id)).toContain("oil");
  });

  it("returns the picked chart when it is one of those offered", async () => {
    const r = await checkCandidate(answering({ keep: [1, 2], reason: "same tanker", chart: "oil" }), { ...base, pickChart: PAGE_CHARTS.energy });
    expect(r).toEqual({ keep: [0, 1], reason: "same tanker", chart: "oil" });
  });

  it("drops \"none\", an id the page does not have, and a pick nobody asked for", async () => {
    for (const chart of ["none", "chart-gas", ""]) {
      const r = await checkCandidate(answering({ keep: [1, 2], reason: "x", chart }), { ...base, pickChart: PAGE_CHARTS.energy });
      expect(r).not.toHaveProperty("chart");
    }
    const unasked = await checkCandidate(answering({ keep: [1, 2], reason: "x", chart: "oil" }), base);
    expect(unasked).not.toHaveProperty("chart");
  });

  it("still reads an answer with no chart field", async () => {
    expect(await checkCandidate(answering({ keep: [1], reason: "x" }), { ...base, pickChart: PAGE_CHARTS.energy })).toEqual({ keep: [0], reason: "x" });
  });
});
