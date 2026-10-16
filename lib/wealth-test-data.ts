import { readFileSync } from "node:fs";
import { join } from "node:path";
import { displayName } from "./display-name";
import {
  financialDisclosure,
  type FinancialDisclosure,
  type Legislator,
} from "./entities";
import {
  buildWealthMembers,
  type CurrentMemberFacts,
  type WealthMember,
} from "./wealth-derive";

/**
 * Builds the same `WealthMember[]` `lib/wealth-data.ts`'s `getWealthData()`
 * would, but by reading `pipeline/output/*.json` directly with plain
 * `node:fs` rather than through `lib/congress-data.ts` (which is
 * `"server-only"` and throws under vitest/Node — see that file's comment).
 * "Current member" is reproduced here exactly as `lib/congress-data.ts`
 * defines it: everyone with a `terms.json` row in each chamber's latest
 * `congress_number`.
 */
export function loadRealWealthMembers(): WealthMember[] {
  const outDir = join(process.cwd(), "pipeline", "output");
  const readJson = <T>(name: string): T =>
    JSON.parse(readFileSync(join(outDir, name), "utf8")) as T;

  const rawRows = readJson<unknown[]>("financial_disclosures.json");
  const rows: FinancialDisclosure[] = rawRows.map((row) =>
    financialDisclosure.parse(row),
  );

  const terms = readJson<
    {
      bioguide_id: string;
      congress_number: number;
      chamber: "house" | "senate";
      state: string;
      district: number | null;
      party: string;
      caucus: string | null;
    }[]
  >("terms.json");
  const legislators =
    readJson<{ bioguide_id: string; name: Legislator["name"] }[]>(
      "legislators.json",
    );
  const legByBioguide = new Map(legislators.map((l) => [l.bioguide_id, l]));
  const { withPhoto } = readJson<{ withPhoto: string[] }>("member-photos.json");
  const hasPhotoSet = new Set(withPhoto);

  const latestByChamber = new Map<string, number>();
  for (const t of terms) {
    const prev = latestByChamber.get(t.chamber);
    if (prev === undefined || t.congress_number > prev) {
      latestByChamber.set(t.chamber, t.congress_number);
    }
  }

  const currentMembers = new Map<string, CurrentMemberFacts>();
  for (const t of terms) {
    if (t.congress_number !== latestByChamber.get(t.chamber)) continue;
    if (currentMembers.has(t.bioguide_id)) continue; // first chamber wins, same as getChamberCurrent order
    const leg = legByBioguide.get(t.bioguide_id);
    const name = leg ? displayName(leg.name, leg.bioguide_id) : t.bioguide_id;
    currentMembers.set(t.bioguide_id, {
      name,
      chamber: t.chamber,
      state: t.state,
      district: t.district,
      caucus: t.caucus ?? t.party,
      hasPhoto: hasPhotoSet.has(t.bioguide_id),
    });
  }

  const firstCongressByMember = new Map<string, number>();
  for (const t of terms) {
    const prev = firstCongressByMember.get(t.bioguide_id);
    if (prev === undefined || t.congress_number < prev) {
      firstCongressByMember.set(t.bioguide_id, t.congress_number);
    }
  }

  return buildWealthMembers(rows, currentMembers, firstCongressByMember);
}
