"use client";

import { useEffect, useState } from "react";
import { ROSTER_SHAPE, type DemoRoster } from "@/lib/demographics-types";

let cached: Promise<DemoRoster> | null = null;

async function get(version: string, cache: RequestCache): Promise<DemoRoster> {
  const r = await fetch(`/data/demographics/members?v=${encodeURIComponent(version)}`, { cache });
  if (!r.ok) throw new Error(`roster ${r.status}`);
  return (await r.json()) as DemoRoster;
}

/** The roster ships separately from the page (it is most of a megabyte): fetched once, on mount, then shared by the three lists. */
function load(version: string): Promise<DemoRoster> {
  cached ??= get(version, "default").then((r) => (r.shape === ROSTER_SHAPE ? r : get(version, "reload")));
  cached.catch(() => (cached = null));
  return cached;
}

export function useRoster(version: string): { roster: DemoRoster | null; failed: boolean } {
  const [roster, setRoster] = useState<DemoRoster | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    load(version).then(
      (r) => live && setRoster(r),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [version]);
  return { roster, failed };
}
