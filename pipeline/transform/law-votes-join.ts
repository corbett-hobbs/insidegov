import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { z } from "zod";
import { LawsDataError, RAW_SOURCES, lawVoteExceptions, rawCongressFile, type RawCongressFile, type RawLaw } from "../../lib/laws-entities";
import { RAW_DIR } from "../fetch/lib";
import { rollcallManifest, type RollcallTuple } from "../fetch/voteview-rollcalls-lib";
import { chooseSources, splitPending } from "./laws";
import { buildPassage, indexRollcalls, type Chamber } from "./laws-votes";

/**
 * Which Voteview roll call is a law's final-passage vote in each chamber, found with the same join the Laws transform uses for the tallies
 * (`buildPassage`). Shared by the member-votes fetch (which roll calls to keep) and the law-votes transform (which to publish).
 * A roll call is used only when Voteview's tally agrees with the action text's (exact, within the Laws gate's tolerance, or a recorded exception):
 * a join found only by date and bill that disagrees might be a different vote the same day, so it is left out rather than shown wrongly.
 */
export interface LawRollJoin {
  law: RawLaw;
  House?: RollcallTuple;
  Senate?: RollcallTuple;
}

const readJson = async (path: string) => JSON.parse(await readFile(path, "utf8")) as unknown;

export async function loadLawRollJoins(): Promise<{ joins: LawRollJoin[]; lastDate: { H: string; S: string } }> {
  const files: RawCongressFile[] = [];
  for (const source of RAW_SOURCES) {
    const dir = `${RAW_DIR}/${source}`;
    if (!existsSync(dir)) continue;
    for (const name of (await readdir(dir)).filter((n) => /^\d+\.json$/.test(n))) files.push(rawCongressFile.parse(await readJson(`${dir}/${name}`)));
  }
  const independent = z.object({ counts: z.record(z.string(), z.number().int()) }).parse(await readJson("pipeline/reference/law-counts-independent.json")).counts;
  const manifest = rollcallManifest.parse(await readJson(`${RAW_DIR}/voteview/rollcalls_manifest.json`));
  const rolls = (await readJson(`${RAW_DIR}/voteview/rollcalls_93on.json`)) as RollcallTuple[];
  if (rolls.length !== manifest.rows) throw new LawsDataError(`rollcalls_93on.json has ${rolls.length} rows, its manifest says ${manifest.rows}`);
  const idx = indexRollcalls(rolls, manifest.last_date);
  const exceptions = lawVoteExceptions.parse(await readJson("pipeline/reference/law-vote-exceptions.json")).exceptions;
  const joins: LawRollJoin[] = [];
  for (const [congress, { primary }] of [...chooseSources(files)].sort((a, b) => a[0] - b[0])) {
    for (const law of splitPending(primary, independent[String(congress)] === undefined).file.laws) {
      const resolved = buildPassage(law, idx, exceptions).resolved;
      const pick = (c: Chamber) => {
        const r = resolved.get(c);
        return r?.row && (r.check === "exact" || r.check === "minor" || r.check === "exception") ? r.row : undefined;
      };
      const h = pick("House");
      const s = pick("Senate");
      if (h || s) joins.push({ law, ...(h ? { House: h } : {}), ...(s ? { Senate: s } : {}) });
    }
  }
  return { joins, lastDate: manifest.last_date };
}
