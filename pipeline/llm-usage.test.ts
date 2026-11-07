import { beforeEach, describe, expect, it } from "vitest";
import { formatUsage, recordUsage, resetUsage, usageRows } from "./llm-usage";

describe("recordUsage", () => {
  beforeEach(resetUsage);

  it("adds calls up per script and model", () => {
    recordUsage("a", "m1", { input_tokens: 10, output_tokens: 5 });
    recordUsage("a", "m1", { input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 7 });
    recordUsage("a", "m2", { input_tokens: 3, output_tokens: 3, server_tool_use: { web_search_requests: 2 } });
    const rows = usageRows();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ script: "a", model: "m1", calls: 2, input: 11, output: 7, cacheRead: 7 });
    expect(rows[1]).toMatchObject({ model: "m2", webSearches: 2 });
  });

  it("counts a call with no usage block without throwing", () => {
    recordUsage("a", undefined, undefined);
    expect(usageRows()[0]).toMatchObject({ model: "unknown", calls: 1, input: 0 });
  });

  it("formats one line per row and only mentions cache and searches when used", () => {
    recordUsage("a", "m1", { input_tokens: 1200, output_tokens: 5 });
    recordUsage("b", "m1", { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 9, server_tool_use: { web_search_requests: 1 } });
    const [a, b] = formatUsage(usageRows());
    expect(a).toBe("LLM usage  a  m1  1 call  in 1,200  out 5");
    expect(b).toContain("cache read 9");
    expect(b).toContain("web searches 1");
  });
});
