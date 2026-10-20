import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CHAMBERS } from "./chamber";
import { getCurrentMemberIndex, getFirstTermStarts } from "./congress-data";
import { isPlottable } from "./congress-types";
import { getWealthData, isListEligible } from "./wealth-data";
import { ageOn } from "./demographics-derive";
import { legislator } from "./entities";
import type { DirectoryMember } from "./members-directory";

/**
 * Build-time rows for the Members directory (`/congress/members`): every
 * member in office today (the current Congress's roster minus those who have
 * left, `sitting.json`), joined with their first term start, current-Congress
 * ideology score, latest net worth estimate and Wikipedia interest. File I/O
 * only; the filtering and sorting is `lib/members-directory.ts` (pure, tested).
 */

export interface PageviewsWindow {
  start: string;
  end: string;
  days: number;
}

interface PageviewsFile extends PageviewsWindow {
  rows: { id: string; median: number }[];
}

function readPageviews(): PageviewsFile | null {
  try {
    const path = join(process.cwd(), "pipeline", "output", "wikipedia_pageviews_members.json");
    return JSON.parse(readFileSync(path, "utf8")) as PageviewsFile;
  } catch {
    return null; // graceful before the fetch has run: no "Most looked up" values
  }
}

/** Median daily Wikipedia views by bioguide id; empty before the fetch has run. */
export function getMemberViews(): Record<string, number> {
  return Object.fromEntries(readPageviews()?.rows.map((r) => [r.id, r.median]) ?? []);
}

export interface MembersDirectoryData {
  members: DirectoryMember[];
  /** The pageviews window, for the Data notes; `null` when the file is absent. */
  pageviews: PageviewsWindow | null;
}

export function getMembersDirectory(): MembersDirectoryData {
  const pv = readPageviews();
  const views = new Map(pv?.rows.map((r) => [r.id, r.median]) ?? []);
  const since = new Map(CHAMBERS.map((c) => [c, getFirstTermStarts(c)]));
  const today = new Date().toISOString().slice(0, 10);
  const age = new Map(
    (JSON.parse(readFileSync(join(process.cwd(), "pipeline", "output", "legislators.json"), "utf8")) as unknown[])
      .map((r) => legislator.parse(r))
      .filter((l) => l.birthday)
      .map((l) => [l.bioguide_id, ageOn(l.birthday!, today)] as const),
  );
  const wealth = new Map(getWealthData().filter(isListEligible).map((w) => [w.bioguideId, w.points.at(-1)!]));

  const members: DirectoryMember[] = [];
  for (const m of getCurrentMemberIndex().values()) {
    if (m.isFormer) continue;
    const nw = wealth.get(m.bioguideId);
    members.push({
      bioguideId: m.bioguideId,
      chamber: m.chamber,
      name: m.name,
      lastName: m.lastName,
      state: m.state,
      district: m.district,
      party: m.party,
      group: m.group,
      hasPhoto: m.hasPhoto ?? false,
      since: since.get(m.chamber)!.get(m.bioguideId) ?? null,
      age: age.get(m.bioguideId) ?? null,
      ideology: isPlottable(m) ? m.dim1 : null,
      netWorth: nw ? nw.midpoint : null,
      netWorthOpenEnded: nw ? nw.range.openEnded : false,
      views: views.get(m.bioguideId) ?? null,
      leaderRole: m.leaderRole ?? null,
    });
  }
  return {
    members: members.sort((a, b) => a.lastName.localeCompare(b.lastName)),
    pageviews: pv ? { start: pv.start, end: pv.end, days: pv.days } : null,
  };
}
