"use client";

import { useState } from "react";
import type { ChamberMember, MemberProfile } from "@/lib/congress-types";
import { memberNoun } from "@/lib/chamber";
import { nearestNeighbors } from "@/lib/neighbors";
import { CompassPanel } from "@/components/senate/CompassPanel";
import { ProfileCompass } from "@/components/senate/ProfileCompass";
import { ordinal } from "@/components/senate/format";
import { ProfilePanel } from "./ProfilePanel";
import { MemberNeighborList } from "./MemberNeighborList";

const N = 5;

type Mode = "all" | "neighbors";

export function MemberCompassCard({
  profile,
  compassMembers,
  views,
}: {
  profile: MemberProfile;
  compassMembers: ChamberMember[];
  /** Median daily Wikipedia views by bioguide id. */
  views: Record<string, number>;
}) {
  const [mode, setMode] = useState<Mode>("all");
  const { bioguideId, chamber, name, latestCongress } = profile;

  const nounPlural = memberNoun(chamber, { plural: true });

  const anchorIndex = compassMembers.findIndex(
    (m) => m.bioguideId === bioguideId,
  );
  const inChamber = anchorIndex >= 0;
  const rank = inChamber ? anchorIndex + 1 : null;

  const neighbors = inChamber
    ? nearestNeighbors(compassMembers[anchorIndex], compassMembers, N)
    : [];
  const everyone = compassMembers
    .filter((m) => m.bioguideId !== bioguideId)
    .sort(
      (a, b) =>
        (views[b.bioguideId] ?? -1) - (views[a.bioguideId] ?? -1) ||
        a.lastName.localeCompare(b.lastName) ||
        a.name.localeCompare(b.name),
    )
    .map((member) => ({ member, distance: 0 }));
  const formerCount = compassMembers.filter((m) => m.isFormer).length;
  const canToggle = neighbors.length > 0;
  const neighborMode = mode === "neighbors" && canToggle;

  return (
    <ProfilePanel
      className="flex h-full flex-col"
      label={`In the ${ordinal(latestCongress)} Congress`}
      action={
        canToggle ? (
          <div
            role="group"
            aria-label="Compass view"
            className="flex flex-none overflow-hidden rounded-lg border border-line-strong text-[0.8rem] font-medium"
          >
            {(
              [
                ["all", "All members"],
                ["neighbors", "Nearest neighbors"],
              ] as const
            ).map(([value, text]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                className={`px-2 py-[0.35rem] transition-colors sm:px-[0.85rem] ${
                  mode === value
                    ? "bg-accent text-accent-ink"
                    : "bg-surface-raised text-ink-muted hover:text-ink"
                }`}
              >
                {text}
              </button>
            ))}
          </div>
        ) : undefined
      }
    >
      <p className="mb-2 max-w-[42rem] text-[0.78rem] text-ink-faint">
        {neighborMode
          ? `The ${neighbors.length} ${nounPlural} closest to ${name} in ideological space, ringed below; the rest of the chamber is faded.`
          : inChamber && rank
            ? `${name} sits ${ordinal(rank)} from the left of ${compassMembers.length} scored ${nounPlural}${formerCount ? ` (${formerCount} of them since left office, marked "former" below)` : ""}. Ringed below; the rest of the chamber is faded.`
            : `No plottable ${ordinal(latestCongress)}-Congress position for ${name} (too few votes). The chamber is shown for context.`}
      </p>

      <CompassPanel congress={latestCongress}>
        <ProfileCompass
          members={compassMembers}
          bioguideId={inChamber ? bioguideId : ""}
          height={320}
          neighborIds={
            neighborMode ? neighbors.map((n) => n.member.bioguideId) : undefined
          }
        />
      </CompassPanel>

      <MemberNeighborList
        rows={neighborMode ? neighbors : everyone}
        ranked={neighborMode}
        hasViews={Object.keys(views).length > 0}
      />
    </ProfilePanel>
  );
}
