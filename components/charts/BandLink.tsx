"use client";

import { useCallback, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { presidentPathByName } from "@/lib/president-url";
import { Tooltip, usePinnedTooltip } from "./Tooltip";
import { TipCard } from "./TipCard";

const OPEN_EVENT = "band-link-open";

/** "Barack Obama: tap to show these years" / "Barack Obama (2009–2017): tap …" → "Barack Obama". */
export const presidentOfBandLabel = (label: string) => label.split(":")[0].replace(/\s*\(.*\)\s*$/, "").trim();

/**
 * The president-page link a tapped term band offers (rule 10v): pressing a band still edits the chart's year window, and
 * also pins a small card naming the president with "Open president page →" (the card is the link, as on every chart: rule
 * 10e). It closes on a press elsewhere, Esc, a second press on the same band, or when another band opens its own card.
 * Presidents without a page (Roosevelt and earlier) get no card.
 */
export function useBandLink(president: string) {
  const path = presidentPathByName(president);
  const pin = usePinnedTooltip<string>();
  const router = useRouter();
  const id = useId();
  const { hide, show } = pin;
  const open = pin.state !== null;

  useEffect(() => {
    if (!open) return;
    const other = (e: Event) => (e as CustomEvent<string>).detail !== id && hide();
    window.addEventListener(OPEN_EVENT, other);
    window.addEventListener("scroll", hide, { passive: true });
    return () => {
      window.removeEventListener(OPEN_EVENT, other);
      window.removeEventListener("scroll", hide);
    };
  }, [open, id, hide]);

  const toggle = useCallback(
    (x: number, y: number) => {
      if (!path) return;
      if (open) return hide();
      window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
      show(president, { clientX: x, clientY: y });
    },
    [path, open, hide, show, president, id],
  );

  const card = path ? (
    <Tooltip state={pin.state} onActivate={() => (hide(), router.push(path))} activateHint="Open president page →">
      {(name) => <TipCard title={name} />}
    </Tooltip>
  ) : null;

  return { toggle, card, linked: path !== null };
}
