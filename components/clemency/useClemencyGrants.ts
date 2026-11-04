"use client";

import { useEffect, useState } from "react";
import type { ClemencyGrant } from "@/lib/clemency-types";

let cached: Promise<ClemencyGrant[]> | null = null;

/** The list ships separately from the page, so a reader of the orders section doesn't pay for it: fetched once, when `load` turns on. */
export function useClemencyGrants(load: boolean): { rows: ClemencyGrant[] | null; failed: boolean } {
  const [rows, setRows] = useState<ClemencyGrant[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!load) return;
    let live = true;
    cached ??= fetch("/data/clemency/grants").then((r) => {
      if (!r.ok) throw new Error(`grants ${r.status}`);
      return r.json() as Promise<ClemencyGrant[]>;
    });
    cached.catch(() => (cached = null));
    cached.then(
      (l) => live && setRows(l),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [load]);
  return { rows, failed };
}
