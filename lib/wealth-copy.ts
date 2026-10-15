import type { ChamberView } from "./chamber";

/** The wealth page's party pick: a caucus, or `null` for every member. */
export type WealthParty = "Democrat" | "Republican";

/** "members" / "senators" / "House members" — the wealth page's own copy for
 *  counts and subtitles, distinct from lib/chamber.ts's `viewNoun` ("member(s)
 *  of Congress" for "both", used for chamber-neutral prose elsewhere). Shared
 *  by the filter bar and the scatter card so the noun never drifts between
 *  the two. */
export function wealthCountNoun(view: ChamberView): string {
  if (view === "senate") return "senators";
  if (view === "house") return "House members";
  return "members";
}

/** "Democrats" / "Republicans": the party on its own, for a caption ("Democrats in Texas highlighted"). */
export function wealthPartyName(party: WealthParty): string {
  return party === "Democrat" ? "Democrats" : "Republicans";
}

/** `wealthCountNoun` with the party in front when one is picked: "Democratic senators", "Republican House members". */
export function wealthPartyNoun(view: ChamberView, party: WealthParty | null): string {
  const noun = wealthCountNoun(view);
  return party ? `${party === "Democrat" ? "Democratic" : "Republican"} ${noun}` : noun;
}
