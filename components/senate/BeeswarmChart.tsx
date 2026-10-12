"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { scaleLinear } from "d3-scale";
import { forceCollide, forceSimulation, forceX, forceY } from "d3-force";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { Axis } from "@/components/charts/Axis";
import { Tooltip, useTooltip } from "@/components/charts/Tooltip";
import type { ChamberMember } from "@/lib/congress-types";
import { hasProfilePage, memberPath } from "@/lib/member-url";
import { partyFillClass } from "@/lib/party-palette";
import { MemberTooltip } from "./MemberTooltip";

const W = 640;
const MARGIN = { top: 14, right: 24, bottom: 34, left: 24 };
const INNER_W = W - MARGIN.left - MARGIN.right;
const TICKS = [-1, -0.5, 0, 0.5, 1];
const R = 6;

interface BeeNode {
  m: ChamberMember;
  x: number;
  y: number;
}

/**
 * One state's delegation as a beeswarm along dimension 1. The x-position is the
 * real DW-NOMINATE score; the vertical offset is collision-detection only
 * (d3-force: forceX pinned to the true x, forceCollide sized to the dot) so
 * dots don't overlap. It is not a second data dimension.
 */
export function BeeswarmChart({
  members,
  highlightId,
  fill = false,
}: {
  members: ChamberMember[];
  highlightId?: string;
  /**
   * Stretch to the height of a flex parent (the parent must be a flex column):
   * the plot grows taller, dots stay centred and the gridlines run the full
   * height, so a card sharing a row with a taller neighbour has no blank space.
   */
  fill?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = boxRef.current;
    if (!fill || !el) return;
    const ro = new ResizeObserver(([e]) =>
      setBox({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [fill]);
  const router = useRouter();
  const tip = useTooltip<ChamberMember>();

  const { nodes, swarmHeight } = useMemo(() => {
    const x = scaleLinear().domain([-1, 1]).range([0, INNER_W]);
    const plottable = members.filter((m) => m.dim1 != null);

    const sim = forceSimulation<BeeNode>(
      plottable.map((m) => ({ m, x: x(m.dim1 as number), y: 0 })),
    )
      .force("x", forceX<BeeNode>((d) => x(d.m.dim1 as number)).strength(1))
      .force("y", forceY(0).strength(0.05))
      .force("collide", forceCollide(R + 1))
      .stop();
    for (let i = 0; i < 240; i++) sim.tick();

    const ns = sim.nodes();
    const ys = ns.map((n) => n.y);
    const lo = Math.min(0, ...ys) - R;
    const hi = Math.max(0, ...ys) + R;
    for (const n of ns) n.y -= lo;

    return { nodes: ns, swarmHeight: Math.max(hi - lo, 2 * R + 8) };
  }, [members]);

  const naturalHeight = MARGIN.top + swarmHeight + MARGIN.bottom;
  // Viewbox units are width/W px; the box's pixel height converts back to units.
  const wantHeight = box && box.w > 0 ? (box.h * W) / box.w : 0;
  const height = fill ? Math.max(naturalHeight, wantHeight) : naturalHeight;
  const shiftY = (height - naturalHeight) / 2;

  const frame = (
    <>
      <ChartFrame
        width={W}
        height={height}
        margin={MARGIN}
        ariaLabel="Beeswarm of a state's House delegation by DW-NOMINATE dimension 1"
      >
        {({ innerWidth, innerHeight }) => {
          const x = scaleLinear().domain([-1, 1]).range([0, innerWidth]);
          return (
            <>
              <Axis
                scale={x}
                orientation="bottom"
                ticks={TICKS}
                offset={innerHeight}
                gridExtent={innerHeight}
                zeroAt={0}
                format={(v) => v.toFixed(1)}
              />
              {nodes.map((n) => {
                const isHi = n.m.bioguideId === highlightId;
                // No profile page for former members (e.g. a scrubbed-back
                // historical delegation) — don't link them to a 404.
                const navigable = hasProfilePage(n.m);
                return (
                  <circle
                    key={n.m.bioguideId}
                    cx={n.x}
                    cy={n.y + shiftY}
                    r={isHi ? 8 : R}
                    className={`dot ${partyFillClass(n.m)}${isHi ? " is-highlighted" : ""}`}
                    style={navigable ? { cursor: "pointer" } : undefined}
                    onPointerEnter={(e) => tip.show(n.m, e)}
                    onPointerMove={tip.move}
                    onPointerLeave={tip.hide}
                    onClick={
                      navigable ? () => router.push(memberPath(n.m)) : undefined
                    }
                  />
                );
              })}
            </>
          );
        }}
      </ChartFrame>
      <Tooltip state={tip.state}>{(m) => <MemberTooltip member={m} />}</Tooltip>
    </>
  );
  if (!fill) return frame;
  return (
    <div
      ref={boxRef}
      className="relative min-h-0 flex-1"
      style={{ minHeight: box ? (naturalHeight * box.w) / W : undefined }}
    >
      <div className="absolute inset-0">{frame}</div>
    </div>
  );
}
