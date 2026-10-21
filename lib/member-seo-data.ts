import "server-only";
import type { Chamber } from "./chamber";
import { getChamberCurrent } from "./congress-data";
import type { MemberProfile } from "./congress-types";
import type { MemberSeoInput } from "./entity-seo";
import { getMemberLaws } from "./member-laws-data";
import { getMemberWealthProfile } from "./wealth-data";
import { partyAbbr } from "@/components/senate/format";

/**
 * Build-time inputs for a member page's search title and description (`memberSeo` in `lib/entity-seo.ts`): where the
 * member sits within their caucus in the current chamber, enacted laws they sponsored, and their latest net worth estimate.
 */
export function memberSeoInput(chamber: Chamber, profile: MemberProfile): MemberSeoInput {
  const plottable = getChamberCurrent(chamber).plottable;
  const me = plottable.find((m) => m.bioguideId === profile.bioguideId);
  const caucus = plottable.filter((m) => m.group === profile.group);
  const dem = profile.group === "dem";
  const peers =
    me && profile.group !== "other"
      ? {
          // Further toward the caucus's own end: left for Democrats, right for Republicans.
          toward: caucus.filter((m) => (dem ? m.dim1! < me.dim1! : m.dim1! > me.dim1!)).length,
          away: caucus.filter((m) => (dem ? m.dim1! > me.dim1! : m.dim1! < me.dim1!)).length,
          of: caucus.length,
        }
      : null;
  const usable = (getMemberWealthProfile(profile.bioguideId)?.years ?? []).filter((y) => y.kind === "usable");
  const latest = usable[usable.length - 1];
  return {
    name: profile.name,
    lastName: profile.lastName,
    chamber,
    party: profile.party,
    caucus: profile.caucus,
    partyAbbr: partyAbbr(profile.party),
    state: profile.state,
    stateName: profile.stateName,
    district: profile.district,
    firstTermYear: profile.firstTermYear,
    peers,
    lawsSponsored: getMemberLaws(profile.bioguideId).roles.filter((r) => r === 1).length,
    netWorth: latest && "midpoint" in latest ? latest.midpoint : null,
  };
}
