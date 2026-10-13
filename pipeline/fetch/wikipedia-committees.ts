import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import {
  committeeSummary,
  type CommitteeWikipediaSummary,
} from "../validate/schemas";
import { needsReview } from "../wikipedia/trim";
import { describe } from "../wikipedia/committee-lead";
import { CONCURRENCY, getJson, pool } from "../wikipedia/client";
import { run } from "./lib";

/**
 * A short Wikipedia description per committee, for the committee page header.
 *
 * Reads `pipeline/output/committees.json`, maps each committee to its English
 * Wikipedia article (see `articleTitle`), trims the lead to a few sentences
 * (pipeline/wikipedia/trim.ts sentence splitting — trim only, never rewritten) and writes
 * `pipeline/output/committee_summaries.json`, keyed by `committee_id`.
 * Build-time only: the app never calls Wikipedia at request time. Same
 * contract as `fetch/wikipedia.ts` (members): no article, 404 or non-standard
 * page = NO record; a failed fetch aborts without touching the file;
 * `revision` / `fetched_at` carry over while the shown text is unchanged.
 */
const COMMITTEES = "pipeline/output/committees.json";
const OUT = "pipeline/output/committee_summaries.json";

const API = "https://en.wikipedia.org/w/api.php";
/** One request: redirects followed, whole lead as plain text, canonical URL, revision id, disambiguation flag. */
const queryUrl = (title: string) =>
  `${API}?${new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    redirects: "1",
    prop: "extracts|info|revisions|pageprops",
    exintro: "1",
    explaintext: "1",
    inprop: "url",
    rvprop: "ids",
    ppprop: "disambiguation",
    titles: title,
  })}`;

const queryResponse = z.looseObject({
  query: z.looseObject({
    pages: z
      .array(
        z.looseObject({
          title: z.string(),
          missing: z.boolean().optional(),
          extract: z.string().optional(),
          fullurl: z.string().optional(),
          pageprops: z.looseObject({ disambiguation: z.string().optional() }).optional(),
          revisions: z.array(z.looseObject({ revid: z.number() })).optional(),
        }),
      )
      .length(1),
  }),
});

/**
 * Articles whose title is not the committee's own name with "United States"
 * added. `null` = no matching article (the committee gets no description).
 */
const TITLE_OVERRIDES: Record<string, string | null> = {
  // "January 6th Committee" is the 117th Congress's committee, not this 2025 select subcommittee.
  HSQJ: null,
  HSZS: "Select Committee on Strategic Competition between the United States and the Chinese Communist Party",
  JSLC: "Joint Committee on the Library",
  JCSE: "Commission on Security and Cooperation in Europe",
};

/**
 * One line written for this site, for a committee whose Wikipedia lead never says what it
 * does (or that has no article). Used only where `describe` finds nothing, so a later
 * Wikipedia edit that adds the jurisdiction takes over. Plain statements of jurisdiction
 * from the House and Senate rules; no names, counts or dates that go stale.
 */
const WRITTEN: Record<string, string> = {
  HSED: "Handles legislation on education from preschool through college, and on labor and the workforce, including wages and hours, job training, pensions, unions and workplace safety.",
  HSPW: "Handles legislation on highways, public transit, railroads, aviation, the Coast Guard and maritime transportation, water resources, public buildings, and disaster response and emergency management.",
  HSSM: "Has jurisdiction over the Small Business Administration and the federal programs that help small businesses, including loans, government contracting and help for new entrepreneurs.",
  HSSO: "Investigates alleged violations of House rules and federal law by members, officers and staff, enforces the House Code of Official Conduct, and advises members on its rules. Its seats are split evenly between the parties.",
  HSQJ: "A select panel created by the House in 2025 to look into the unanswered questions about the January 6, 2021 attack on the Capitol.",
  JSTX: "A nonpartisan joint committee of both chambers whose staff estimates the revenue effect of tax bills, reviews large tax refunds, and advises the House and Senate tax-writing committees.",
  SSCM: "Has jurisdiction over interstate commerce, science and technology policy, and transportation, including aviation, railroads, shipping, telecommunications, consumer protection and the Coast Guard.",
  SSHR: "Handles legislation on health, education, labor and retirement security, covering public health agencies, schools and student aid, workplace rules and private pensions.",
};

const committeeRow = z.looseObject({
  committee_id: z.string(),
  name: z.string(),
  chamber: z.enum(["house", "senate", "joint"]),
});

/** "House Committee on Ways and Means" -> "United States House Committee on Ways and Means". */
function articleTitle(c: z.infer<typeof committeeRow>): string | null {
  if (c.committee_id in TITLE_OVERRIDES) return TITLE_OVERRIDES[c.committee_id];
  if (c.chamber === "joint") return c.name;
  return `United States ${c.name.replace(/^United States /, "")}`;
}

await run("wikipedia-committees", async () => {
  const committees = (JSON.parse(await readFile(COMMITTEES, "utf8")) as unknown[]).map((r) =>
    committeeRow.parse(r),
  );

  const previous = new Map<string, CommitteeWikipediaSummary>();
  if (existsSync(OUT)) {
    for (const r of JSON.parse(await readFile(OUT, "utf8")) as unknown[]) {
      const rec = committeeSummary.parse(r);
      previous.set(rec.committee_id, rec);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const records: CommitteeWikipediaSummary[] = [];
  const noArticle: string[] = [];
  const skipped: string[] = [];
  const writtenIds: string[] = [];
  const failures: string[] = [];

  const todo = committees.flatMap((c) => {
    const title = articleTitle(c);
    if (title === null) noArticle.push(c.name);
    return [{ c, title }];
  });

  /** A written line when Wikipedia has nothing usable; otherwise no record. */
  const fallback = (c: { committee_id: string }, why: string) => {
    const extract = WRITTEN[c.committee_id];
    if (!extract) {
      skipped.push(`${c.committee_id}: ${why}`);
      return;
    }
    const prev = previous.get(c.committee_id);
    records.push(
      committeeSummary.parse({
        committee_id: c.committee_id,
        source: "written",
        title: null,
        extract,
        url: null,
        revision: null,
        fetched_at: prev && prev.source === "written" && prev.extract === extract ? prev.fetched_at : today,
        needs_review: false,
      }),
    );
    writtenIds.push(c.committee_id);
  };

  await pool(todo, CONCURRENCY, async ({ c, title }) => {
    const label = `${c.name} (${c.committee_id}, "${title}")`;
    if (title === null) return fallback(c, "no article");
    try {
      const out = await getJson(queryUrl(title));
      if (out.kind === "skip") return fallback(c, out.reason);
      const parsed = queryResponse.safeParse(out.body);
      if (!parsed.success) {
        throw new Error(`unexpected response shape\n${z.prettifyError(parsed.error)}`);
      }
      const page = parsed.data.query.pages[0];
      if (page.missing) return fallback(c, "no such article");
      if (page.pageprops?.disambiguation !== undefined) return fallback(c, "disambiguation page");
      const extract = describe(page.extract ?? "");
      const revid = page.revisions?.[0]?.revid;
      if (!extract || !page.fullurl || revid === undefined) {
        return fallback(c, "lead never says what it does");
      }
      const draft = {
        committee_id: c.committee_id,
        source: "wikipedia" as const,
        title: page.title,
        extract,
        url: page.fullurl,
        revision: String(revid),
        needs_review: needsReview(extract),
      };
      const prev = previous.get(draft.committee_id);
      const unchanged =
        prev &&
        prev.source === "wikipedia" &&
        prev.title === draft.title &&
        prev.extract === draft.extract &&
        prev.url === draft.url &&
        prev.needs_review === draft.needs_review;
      const record = committeeSummary.safeParse({
        ...draft,
        revision: unchanged ? prev.revision : draft.revision,
        fetched_at: unchanged ? prev.fetched_at : today,
      });
      if (!record.success) {
        throw new Error(`record failed schema\n${z.prettifyError(record.error)}`);
      }
      records.push(record.data);
    } catch (err) {
      failures.push(`${label}: ${err instanceof Error ? err.message : err}`);
    }
  });

  if (failures.length) {
    throw new Error(
      `${failures.length} committee(s) failed; ${OUT} left untouched:\n  ${failures.sort().join("\n  ")}`,
    );
  }

  records.sort((a, b) => a.committee_id.localeCompare(b.committee_id));
  await writeFile(OUT, JSON.stringify(records, null, 2) + "\n");

  const review = records.filter((r) => r.needs_review);
  console.log(
    `  ${records.length} descriptions (${writtenIds.length} written), ${noArticle.length} without an article, ${skipped.length} skipped, ${review.length} need review`,
  );
  for (const n of noArticle.sort()) console.log(`  no article: ${n}`);
  for (const w of writtenIds.sort()) console.log(`  written: ${w}`);
  for (const s of skipped.sort()) console.log(`  skipped: ${s}`);
  for (const r of review) console.log(`  needs_review: ${r.committee_id} ${r.title}`);
});
