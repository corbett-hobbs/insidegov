"use client";

import { useRouter } from "next/navigation";
import type { ChamberMember } from "@/lib/congress-types";
import { memberPath } from "@/lib/member-url";
import { CompassChart } from "./CompassChart";

/**
 * The Session 3 compass, focused on one member: their dot is ringed, the rest
 * of the chamber fades back, and clicking another dot opens that member.
 *
 * `neighborIds` switches it to "nearest neighbors" mode — the anchor plus those
 * ids are ringed, everyone else fades (see components/profile/MemberCompassCard).
 */
export function ProfileCompass({
  members,
  bioguideId,
  neighborIds,
  height,
}: {
  members: ChamberMember[];
  bioguideId: string;
  neighborIds?: readonly string[];
  height?: number;
}) {
  const router = useRouter();
  return (
    <CompassChart
      variant="explorer"
      members={members}
      highlightedId={bioguideId}
      highlightedIds={neighborIds}
      dimUnfocused
      height={height}
      onSelect={(m) => router.push(memberPath(m))}
    />
  );
}
