import { readFile, writeFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { wikipediaPageviews, wikipediaSummary, type WikipediaPageviews } from "../validate/schemas";
import { fetchPageviews, pageviewWindow, PAGEVIEWS_SOURCE } from "../wikipedia/pageviews";
import { RAW_DIR, run } from "./lib";

/**
 * How often each current member's English Wikipedia article is read: the
 * median daily views over the trailing 90 days (pipeline/wikipedia/pageviews.ts),
 * for the Members directory's "Most looked up" sort. Writes
 * `pipeline/output/wikipedia_pageviews_members.json`, keyed by `bioguide_id`.
 *
 * The article title is the one the member's bio was fetched from
 * (`wikipedia_summaries.json`, already resolved past redirects, so views land
 * on the real article), else congress-legislators' `id.wikipedia`; views
 * through redirects to it are added in. A member
 * with neither, or whose article has no views in the window (404), gets no
 * record. Any request that still fails after retries aborts the run without
 * touching the file.
 */
const LEGISLATORS = `${RAW_DIR}/congress-legislators/legislators-current.yaml`;
const SUMMARIES = "pipeline/output/wikipedia_summaries.json";
const OUT = "pipeline/output/wikipedia_pageviews_members.json";

const yamlEntry = z.looseObject({
  id: z.looseObject({ bioguide: z.string(), wikipedia: z.string().optional() }),
});

await run("wikipedia-pageviews", async () => {
  const ids = (parseYaml(await readFile(LEGISLATORS, "utf8")) as unknown[]).map((e) => yamlEntry.parse(e).id);
  const current = new Set(ids.map((id) => id.bioguide));
  const titleById = new Map<string, string>();
  for (const id of ids) if (id.wikipedia) titleById.set(id.bioguide, id.wikipedia);
  // The bio's title wins: it is the canonical article, past any redirect.
  for (const r of JSON.parse(await readFile(SUMMARIES, "utf8")) as unknown[]) {
    const s = wikipediaSummary.parse(r);
    if (current.has(s.bioguide_id)) titleById.set(s.bioguide_id, s.title);
  }
  const noTitle = [...current].filter((id) => !titleById.has(id));

  const today = new Date().toISOString().slice(0, 10);
  const window = pageviewWindow(today);
  const { stats, missing, failures } = await fetchPageviews([...titleById.values()], window, (done, total) => {
    if (done % 1000 === 0) console.log(`  ${done}/${total}`);
  });
  if (failures.length) {
    throw new Error(`${failures.length} title(s) failed; ${OUT} left untouched:\n  ${failures.sort().join("\n  ")}`);
  }

  const rows = [...titleById]
    .flatMap(([id, title]) => {
      const s = stats.get(title);
      return s ? [{ id, title, median: s.median, total: s.total, redirects: s.redirects }] : [];
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const out: WikipediaPageviews = wikipediaPageviews.parse({
    source: PAGEVIEWS_SOURCE,
    agent: "user",
    ...window,
    fetched_at: today,
    rows,
  });
  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n");

  console.log(`  ${rows.length} members, window ${window.start} to ${window.end}`);
  if (noTitle.length) console.log(`  no Wikipedia title: ${noTitle.join(", ")}`);
  for (const t of missing.sort()) console.log(`  no views (404): ${t}`);
});
