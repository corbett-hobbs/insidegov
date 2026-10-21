"use client";

import { useState } from "react";
import { downloadCardPng } from "@/lib/chart-png";
import { site } from "@/lib/site";
import { TABLE_TOGGLE } from "./table-toggle";

/**
 * "Download PNG" at the end of a chart's notes row (`ChartNotesRow`), styled like its
 * "View as table" neighbour (rule 15: the quietest controls under a chart). Saves the
 * card it sits in, the nearest `[data-chart-card]`, `section` or `article`, as a PNG with
 * a credit line naming the page and the exact view (`lib/chart-png.ts`).
 */
export function ChartDownload() {
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  return (
    <button
      type="button"
      data-png-skip=""
      disabled={state === "busy"}
      onClick={async (e) => {
        const card = e.currentTarget.closest<HTMLElement>("[data-chart-card], section, article");
        if (!card) return;
        setState("busy");
        try {
          await downloadCardPng(card, site.name);
          setState("idle");
        } catch {
          setState("failed");
        }
      }}
      className={`${TABLE_TOGGLE} m-0 border-0 bg-transparent p-0 leading-[inherit] disabled:cursor-wait`}
    >
      {state === "busy" ? "Saving…" : state === "failed" ? "Couldn’t save, try again" : "Download PNG"}
    </button>
  );
}
