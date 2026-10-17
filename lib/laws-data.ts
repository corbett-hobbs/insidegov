import "server-only";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { congressControlFile } from "./congress-control";
import { getCurrentMemberIndex } from "./congress-data";
import { displayName } from "./display-name";
import { legislator, term } from "./entities";
import { administration } from "./executive-orders-entities";
import { lawDetailsShard } from "./law-details-entities";
import { buildLawsList, buildLawsPayload, partyLetterOf, sponsorPartyFromTerms } from "./laws-derive";
import { lawCountRow, lawRow, lawsMeta } from "./laws-entities";
import { buildSearchIndex, lawKey } from "./laws-search";
import type { LawsSearchIndex } from "./laws-search";
import type { LawSponsor, LawsList, LawsPayload } from "./laws-types";
import { memberPath } from "./member-url";
import { HISTORICAL_ADMINISTRATIONS } from "./troops-presidents";

/**
 * Build-time reader for the Congress Laws page: parses `laws_counts.json`, `laws.json` and `laws_meta.json` at the boundary
 * (a bad file fails the build) and hands the page one dense payload. Shaping is the pure, unit-tested `lib/laws-derive.ts`.
 * The case-grain list (`laws.json`) is served to the browser separately, at `/data/laws/list` (`getLawsList`).
 */
const OUT = join(process.cwd(), "pipeline", "output");
const read = (file: string): unknown => JSON.parse(readFileSync(join(OUT, file), "utf8"));

let cache: LawsPayload | null = null;
let listCache: LawsList | null = null;

export function getLawsPageData(): LawsPayload {
  if (cache) return cache;
  const counts = z.array(lawCountRow).parse(read("laws_counts.json"));
  const laws = z.array(lawRow).parse(read("laws.json"));
  const meta = lawsMeta.parse(read("laws_meta.json"));
  const admins = [...HISTORICAL_ADMINISTRATIONS, ...z.array(administration).parse(read("administrations.json"))];
  const control = congressControlFile.parse(JSON.parse(readFileSync(join(process.cwd(), "pipeline", "reference", "congress-control.json"), "utf8")));
  const terms = z.array(term).parse(read("terms.json")).filter((t) => t.congress_number >= meta.first_congress);
  cache = { ...buildLawsPayload(counts, laws, meta, admins, control.rows, sponsorPartyFromTerms(terms)), listVersion: listVersion(), searchVersion: searchVersion() };
  return cache;
}

/**
 * Every public law as a compact tuple, newest first, with the sponsor table (name, party-state, and a profile path only for
 * a member of the current Congress: those are the only members with a page) and the signer table. The browser fetches this
 * once, on mount; it is served as static JSON by `app/data/laws/list/route.ts`.
 */
export function getLawsList(): LawsList {
  if (listCache) return listCache;
  const laws = z.array(lawRow).parse(read("laws.json"));
  const meta = lawsMeta.parse(read("laws_meta.json"));
  const admins = [...HISTORICAL_ADMINISTRATIONS, ...z.array(administration).parse(read("administrations.json"))];
  listCache = buildLawsList(laws, meta, admins, getLawSponsorResolver());
  return listCache;
}

let resolver: ((id: string, congress: number, origin: "House" | "Senate" | null) => LawSponsor | null) | null = null;

/**
 * Resolves a bioguide id to how a law shows a member: name, party-state, party and a profile path (only for a member of the
 * current Congress, the only members with a page). Shared by the Laws list and the individual law pages.
 */
export function getLawSponsorResolver() {
  if (resolver) return resolver;
  const meta = lawsMeta.parse(read("laws_meta.json"));
  const people = new Map(z.array(legislator).parse(read("legislators.json")).map((l) => [l.bioguide_id, l]));
  const terms = new Map<string, ReturnType<typeof term.parse>[]>();
  for (const t of z.array(term).parse(read("terms.json"))) {
    if (t.congress_number < meta.first_congress) continue;
    const key = `${t.bioguide_id}|${t.congress_number}`;
    terms.set(key, [...(terms.get(key) ?? []), t]);
  }
  const current = getCurrentMemberIndex();
  resolver = (id, congress, origin): LawSponsor | null => {
    const person = people.get(id);
    if (!person) return null;
    const mine = terms.get(`${id}|${congress}`) ?? [];
    const t = mine.find((x) => x.chamber === origin?.toLowerCase()) ?? mine[0];
    const name = displayName(person.name, id);
    const party = partyLetterOf(t?.caucus ?? t?.party ?? null);
    const place = t ? `${t.state}${t.chamber === "house" && t.district ? `-${t.district}` : ""}` : "";
    const cur = current.get(id);
    return [`${t?.chamber === "senate" ? "Sen." : t ? "Rep." : ""} ${name}`.trim(), place ? `${party}-${place}` : party, party, cur ? memberPath({ bioguideId: id, chamber: cur.chamber, name: cur.name }) : null];
  };
  return resolver;
}

/** A short hash of the list, for the fetch URL. */
function listVersion(): string {
  return createHash("sha1").update(JSON.stringify(getLawsList())).digest("hex").slice(0, 10);
}

let searchCache: LawsSearchIndex | null = null;

/**
 * The word index over every law's full CRS summary, for the list's search box (see `lib/laws-search.ts`). Built from the
 * per-Congress `law_details` shards, one at a time; served to the browser at `/data/laws/search` and fetched on first keystroke.
 */
export function getLawsSearchIndex(): LawsSearchIndex {
  if (searchCache) return searchCache;
  const docs: [number, string][] = [];
  for (const file of readdirSync(join(OUT, "law_details")).filter((f) => f.endsWith(".json"))) {
    const congress = Number.parseInt(file, 10);
    const shard = lawDetailsShard.parse(read(`law_details/${congress}.json`));
    for (const [id, d] of Object.entries(shard.laws)) if (d.summary) docs.push([lawKey(congress, Number(id.split("-pub-")[1])), d.summary.join(" ")]);
  }
  searchCache = buildSearchIndex(docs);
  return searchCache;
}

let searchVersionCache: string | null = null;

/** A short hash of the search index, for the fetch URL (the Laws page and the member pages share it). */
export function searchVersion(): string {
  searchVersionCache ??= createHash("sha1").update(JSON.stringify(getLawsSearchIndex())).digest("hex").slice(0, 10);
  return searchVersionCache;
}
