import "server-only";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { memberHasPhoto } from "./congress-data";
import { displayName, familyName } from "./display-name";
import { legislator, term } from "./entities";
import { administration } from "./executive-orders-entities";
import { buildDemographics, buildRoster } from "./demographics-derive";
import type { DemoRoster, DemographicsPayload } from "./demographics-types";
import { HISTORICAL_ADMINISTRATIONS } from "./troops-presidents";

/**
 * Build-time reader for /congress/demographics: parses `legislators.json`, `terms.json` and `administrations.json` at the
 * boundary (a bad file fails the build), then hands the page a small payload (47 Congresses x 3 chamber views). Shaping is
 * the pure, unit-tested `lib/demographics-derive.ts`; nothing pre-joined is stored. The names behind the charts are a
 * separate roster (`getDemographicsRoster`), served as static JSON from `/data/demographics/members` and fetched once the
 * page has loaded.
 */
const OUT = join(process.cwd(), "pipeline", "output");
const read = (file: string): unknown[] => JSON.parse(readFileSync(join(OUT, file), "utf8"));

const legislators = () => read("legislators.json").map((r) => legislator.parse(r));
const terms = () => read("terms.json").map((r) => term.parse(r));

let cache: DemographicsPayload | null = null;

export function getDemographicsPayload(): DemographicsPayload {
  if (cache) return cache;
  const admins = (read("administrations.json") as unknown[]).map((r) => administration.parse(r));
  const all = [...HISTORICAL_ADMINISTRATIONS, ...admins].filter((a, i, l) => l.findIndex((b) => b.term_id === a.term_id) === i);
  cache = buildDemographics(legislators(), terms(), all);
  return cache;
}

let rosterCache: DemoRoster | null = null;

/** Every member behind the charts, Congress by Congress, as compact arrays (see `RosterEntry`). */
export function getDemographicsRoster(): DemoRoster {
  if (rosterCache) return rosterCache;
  rosterCache = buildRoster(
    legislators().map((l) => ({ bioguide_id: l.bioguide_id, birthday: l.birthday, gender: l.gender, name: displayName(l.name, l.bioguide_id), family: familyName(l.name, l.bioguide_id), photo: memberHasPhoto(l.bioguide_id) })),
    terms(),
  );
  return rosterCache;
}

/** A short hash of the roster, for the fetch URL, so a new build never serves a stale cached copy. */
export function getRosterVersion(): string {
  return createHash("sha1").update(JSON.stringify(getDemographicsRoster())).digest("hex").slice(0, 10);
}
